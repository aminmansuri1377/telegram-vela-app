import { db, lockUsers, Tx } from './db';
import { fail } from './security';
import { ageAt, entitlement, distanceKm, profileSchema, locales } from '../../../packages/shared/validation';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import { randomUUID } from 'node:crypto';
import type { Prisma, User, Profile, Photo } from '@prisma/client';
export function storage() { if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY)
    fail('STORAGE_NOT_CONFIGURED', 503); return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } }).storage.from(process.env.SUPABASE_STORAGE_BUCKET || 'dating-app-photos'); }
export async function photoUrl(photo: Photo) { if (photo.path.startsWith('seed:'))
    return photo.path; const { data, error } = await storage().createSignedUrl(photo.path, 300); if (error)
    fail('STORAGE_ERROR', 503); return data.signedUrl; }
export async function policyFor(user: User & {
    profile: Profile | null;
}, tx: Tx = db) { const p = await tx.policy.findUnique({ where: { gender: user.profile?.gender || 'OTHER' } }); return entitlement(user.profile?.gender || 'OTHER', user.premiumUntil, p || { dailyStarts: 3, seeLikes: false }); }
export async function me(userId: string) { const user = await db.user.findUniqueOrThrow({ where: { id: userId }, include: { profile: true, photos: { where: { purpose: 'PROFILE' }, orderBy: { position: 'asc' } } } }); await db.user.update({ where: { id: userId }, data: { lastActive: new Date() } }); return { id: user.id, firstName: user.firstName, locale: user.locale, role: user.role, isTest: user.isTest, notifications: user.notifications, premiumUntil: user.premiumUntil, profile: user.profile, photos: await Promise.all(user.photos.map(async (p) => ({ ...p, url: await photoUrl(p) }))), entitlements: await policyFor(user) }; }
export async function saveProfile(userId: string, body: unknown) { const p = profileSchema.parse(body); const { terms: _terms, ...data } = p; data.latitude = data.latitude === null ? null : Math.round(data.latitude * 100) / 100; data.longitude = data.longitude === null ? null : Math.round(data.longitude * 100) / 100; return db.$transaction(async (tx) => { await lockUsers(tx, [userId]); await tx.user.update({ where: { id: userId }, data: { termsVersion: '1.0', termsAt: new Date() } }); return tx.profile.upsert({ where: { userId }, create: { userId, ...data, birthDate: new Date(p.birthDate) }, update: { ...data, birthDate: new Date(p.birthDate) } }); }); }
export async function settings(userId: string, body: unknown) { const p = z.object({ locale: z.enum(locales).optional(), notifications: z.boolean().optional() }).strict().parse(body); await db.user.update({ where: { id: userId }, data: p }); return { ok: true }; }
export type Candidate = User & {
    profile: Profile | null;
    photos: Photo[];
};
export async function publicProfile(u: Candidate, viewer?: Profile | null) { const p = u.profile; if (!p)
    return null; const km = viewer ? distanceKm(viewer, p) : null; return { id: u.id, displayName: p.displayName, age: ageAt(p.birthDate), gender: p.gender, bio: p.bio, city: p.city, country: p.country, languages: p.languages, interests: p.interests, ...(p.showFetish ? { fetish: p.fetish } : {}), goal: p.goal, isTest: u.isTest, distance: km === null ? null : Math.max(5, Math.round(km / 5) * 5), photos: await Promise.all(u.photos.filter(x => x.status === 'APPROVED' && x.purpose === 'PROFILE').map(async (x) => ({ id: x.id, url: await photoUrl(x) }))) }; }
export const candidateInclude = { profile: true, photos: { where: { status: 'APPROVED', purpose: 'PROFILE' }, orderBy: { position: 'asc' as const } } };
export async function eligible(tx: Tx, a: string, b: string) { if (a === b)
    fail('INVALID_TARGET'); const users = await tx.user.findMany({ where: { id: { in: [a, b] }, banned: false }, include: { profile: true, photos: { where: { status: 'APPROVED', purpose: 'PROFILE' } } } }); if (users.length !== 2 || users.some(u => !u.profile || !u.profile.visible || !u.photos.length || !u.termsAt))
    fail('PROFILE_UNAVAILABLE', 404); const block = await tx.block.findFirst({ where: { OR: [{ fromId: a, toId: b }, { fromId: b, toId: a }] } }); if (block)
    fail('PROFILE_UNAVAILABLE', 404); return users; }
export async function discovery(userId: string, cursor?: string) {
    const own = await db.user.findUniqueOrThrow({ where: { id: userId }, include: { profile: true, photos: true } });
    if (!own.profile || !own.photos.some(p => p.status === 'APPROVED' && p.purpose === 'PROFILE'))
        fail('PROFILE_INCOMPLETE', 409);
    const p = own.profile;
    const age = ageAt(p.birthDate);
    const rows = await db.user.findMany({ where: { id: { not: userId, ...(cursor ? { gt: cursor } : {}) }, banned: false, isTest: process.env.NODE_ENV === 'production' ? false : undefined, termsAt: { not: null }, profile: { is: { visible: true, gender: { in: p.interestedIn }, interestedIn: { has: p.gender }, minAge: { lte: age }, maxAge: { gte: age } } }, received: { none: { fromId: userId } }, blockedBy: { none: { fromId: userId } }, blocks: { none: { toId: userId } }, reported: { none: { fromId: userId } }, reports: { none: { toId: userId } }, photos: { some: { status: 'APPROVED', purpose: 'PROFILE' } } }, include: candidateInclude, orderBy: { id: 'asc' }, take: 200 });
    const filtered = rows.filter(u => { const q = u.profile!; const d = distanceKm(p, q); return ageAt(q.birthDate) >= p.minAge && ageAt(q.birthDate) <= p.maxAge && (p.latitude === null || d !== null && d <= p.maxDistance) && (!p.filterLanguages.length || p.filterLanguages.some(x => q.languages.includes(x))) && (!p.filterInterests.length || p.filterInterests.some(x => q.interests.includes(x))) && (!p.filterGoal || p.filterGoal === q.goal); });
    filtered.sort((a, b) => Number(!!b.premiumUntil && b.premiumUntil > new Date()) - Number(!!a.premiumUntil && a.premiumUntil > new Date()));
    return { items: await Promise.all(filtered.map(u => publicProfile(u, p))), nextCursor: rows.length === 200 ? rows[rows.length - 1].id : null };
}
export async function upload(userId: string, file: Express.Multer.File | undefined, purpose: string) {
    if (!file || !['PROFILE', 'CHAT'].includes(purpose))
        fail('INVALID_IMAGE');
    if (file.size > 5 * 1024 * 1024)
        fail('IMAGE_TOO_LARGE');
    const allowed = ['jpeg', 'png', 'webp'];
    let image: Buffer;
    try {
        const metadata = await sharp(file.buffer, { limitInputPixels: 20000000 }).metadata();
        if (!allowed.includes(metadata.format || '') || metadata.pages && metadata.pages > 1)
            fail('INVALID_IMAGE');
        image = await sharp(file.buffer, { limitInputPixels: 20000000 }).rotate().resize(1600, 1600, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
    }
    catch {
        fail('INVALID_IMAGE');
    }
    const path = `${userId}/${randomUUID()}.webp`;
    const bucket = storage();
    const { error } = await bucket.upload(path, image, { contentType: 'image/webp', upsert: false });
    if (error)
        fail('STORAGE_ERROR', 503);
    try {
        return await db.$transaction(async (tx) => { await lockUsers(tx, [userId]); const count = await tx.photo.count({ where: { userId, purpose } }); if (purpose === 'PROFILE' && count >= 6)
            fail('PHOTO_LIMIT'); return tx.photo.create({ data: { userId, path, purpose, position: count, status: purpose === 'CHAT' ? 'APPROVED' : 'PENDING' } }); });
    }
    catch (e) {
        await db.outbox.create({ data: { kind: 'DELETE_PHOTO', payload: { path } } });
        throw e;
    }
}
export async function removePhoto(userId: string, id: string) { return db.$transaction(async (tx) => { await lockUsers(tx, [userId]); const photo = await tx.photo.findFirst({ where: { id, userId, purpose: 'PROFILE' } }); if (!photo)
    fail('NOT_FOUND', 404); await tx.outbox.create({ data: { kind: 'DELETE_PHOTO', payload: { path: photo.path } } }); await tx.photo.delete({ where: { id } }); return { ok: true }; }); }
export async function orderPhotos(userId: string, body: unknown) { const { ids } = z.object({ ids: z.array(z.string().uuid()).min(1).max(6) }).parse(body); return db.$transaction(async (tx) => { await lockUsers(tx, [userId]); const rows = await tx.photo.findMany({ where: { userId, purpose: 'PROFILE' } }); if (new Set(ids).size !== rows.length || ids.length !== rows.length || rows.some(p => !ids.includes(p.id)))
    fail('INVALID_PHOTOS'); for (let i = 0; i < ids.length; i++)
    await tx.photo.update({ where: { id: ids[i] }, data: { position: i } }); return { ok: true }; }); }
export async function deleteAccount(userId: string, txInput?: Prisma.TransactionClient) { const work = async (tx: Tx) => { await lockUsers(tx, [userId]); const photos = await tx.photo.findMany({ where: { userId } }); for (const p of photos)
    await tx.outbox.create({ data: { kind: 'DELETE_PHOTO', payload: { path: p.path } } }); const u = await tx.user.findUniqueOrThrow({ where: { id: userId } }); await tx.outbox.deleteMany({ where: { kind: 'NOTIFY', payload: { path: ['telegramId'], equals: u.telegramId } } }); await tx.user.delete({ where: { id: userId } }); return { ok: true }; }; return txInput ? work(txInput) : db.$transaction(work); }
