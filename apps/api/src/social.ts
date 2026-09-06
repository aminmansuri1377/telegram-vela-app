import { db, lockUsers, Tx } from './db';
import { fail } from './security';
import { eligible, publicProfile, candidateInclude, policyFor, photoUrl } from './profiles';
import { orderedPair, utcDay, messageSchema } from '../../../packages/shared/validation';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
export const events = { emit: (_ids: string[], _event: string, _payload: unknown) => { } };
export async function swipe(userId: string, body: unknown) { const { toId, kind } = z.object({ toId: z.string().uuid(), kind: z.enum(['LIKE', 'PASS']) }).strict().parse(body); const [aId, bId] = orderedPair(userId, toId); const result = await db.$transaction(async (tx) => { await lockUsers(tx, [aId, bId]); const users = await eligible(tx, userId, toId); await tx.swipe.upsert({ where: { fromId_toId: { fromId: userId, toId } }, create: { fromId: userId, toId, kind }, update: {} }); const mine = await tx.swipe.findUniqueOrThrow({ where: { fromId_toId: { fromId: userId, toId } } }); const other = await tx.swipe.findUnique({ where: { fromId_toId: { fromId: toId, toId: userId } } }); if (mine.kind !== 'LIKE' || other?.kind !== 'LIKE')
    return { match: null }; const existing = await tx.conversation.findUnique({ where: { aId_bId: { aId, bId } } }); if (existing)
    return { match: existing.active ? existing.id : null }; const conversation = await tx.conversation.create({ data: { aId, bId } }); for (const u of users)
    if (u.notifications && !u.isTest)
        await tx.outbox.create({ data: { kind: 'NOTIFY', payload: { telegramId: u.telegramId, locale: u.locale } } }); return { match: conversation.id }; }); if (result.match)
    events.emit([aId, bId], 'match', result); return result; }
export async function likes(userId: string) { const own = await db.user.findUniqueOrThrow({ where: { id: userId }, include: { profile: true } }); if (!(await policyFor(own)).seeLikes)
    fail('PREMIUM_REQUIRED', 402); const rows = await db.swipe.findMany({ where: { toId: userId, kind: 'LIKE', from: { banned: false, profile: { is: { visible: true } }, blocks: { none: { toId: userId } }, blockedBy: { none: { fromId: userId } }, received: { none: { fromId: userId } } } }, include: { from: { include: candidateInclude } }, take: 100 }); return Promise.all(rows.map(x => publicProfile(x.from, own.profile))); }
export async function member(tx: Tx, userId: string, id: string) { const c = await tx.conversation.findUnique({ where: { id }, include: { a: true, b: true } }); if (!c || !c.active || ![c.aId, c.bId].includes(userId) || c.a.banned || c.b.banned)
    fail('CHAT_UNAVAILABLE', 404); const blocked = await tx.block.findFirst({ where: { OR: [{ fromId: c.aId, toId: c.bId }, { fromId: c.bId, toId: c.aId }] } }); if (blocked)
    fail('CHAT_UNAVAILABLE', 404); return c; }
export async function conversations(userId: string) { const rows = await db.conversation.findMany({ where: { active: true, OR: [{ aId: userId }, { bId: userId }], a: { banned: false }, b: { banned: false } }, include: { a: { include: candidateInclude }, b: { include: candidateInclude }, messages: { orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 1 } }, orderBy: { createdAt: 'desc' }, take: 100 }); return Promise.all(rows.map(async (c) => ({ id: c.id, other: await publicProfile(c.aId === userId ? c.b : c.a), last: c.messages[0] || null, readAt: c.aId === userId ? c.readAAt : c.readBAt, otherReadAt: c.aId === userId ? c.readBAt : c.readAAt }))); }
export async function history(userId: string, id: string, cursor?: string) { await member(db, userId, id); const pivot = cursor ? await db.message.findFirst({ where: { id: cursor, conversationId: id } }) : null; if (cursor && !pivot)
    fail('INVALID_CURSOR'); const rows = await db.message.findMany({ where: { conversationId: id, ...(pivot ? { OR: [{ createdAt: { lt: pivot.createdAt } }, { createdAt: pivot.createdAt, id: { lt: pivot.id } }] } : {}) }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 40 }); return { items: await Promise.all(rows.map(async (m) => ({ ...m, image: m.photoId ? await db.photo.findUnique({ where: { id: m.photoId } }).then(p => p ? photoUrl(p) : null) : null }))), nextCursor: rows.length === 40 ? rows[rows.length - 1].id : null }; }
export async function sendMessage(userId: string, id: string, body: unknown) {
    const data = messageSchema.parse(body);
    const c = await member(db, userId, id);
    const result = await db.$transaction(async (tx) => {
        await lockUsers(tx, [c.aId, c.bId]);
        const current = await member(tx, userId, id);
        const duplicate = await tx.message.findUnique({ where: { senderId_clientId: { senderId: userId, clientId: data.clientId } } });
        if (duplicate) {
            if (duplicate.conversationId !== id)
                fail('IDEMPOTENCY_CONFLICT', 409);
            return duplicate;
        }
        if (data.photoId && !await tx.photo.findFirst({ where: { id: data.photoId, userId, purpose: 'CHAT', status: 'APPROVED' } }))
            fail('INVALID_IMAGE');
        if (!current.startedAt) {
            const u = await tx.user.findUniqueOrThrow({ where: { id: userId }, include: { profile: true } });
            const p = await policyFor(u, tx);
            const day = utcDay();
            const usage = await tx.dailyUsage.upsert({ where: { userId_day: { userId, day } }, create: { userId, day }, update: {} });
            if (p.dailyStarts >= 0 && usage.starts >= p.dailyStarts)
                fail('DAILY_LIMIT', 402);
            await tx.dailyUsage.update({ where: { userId_day: { userId, day } }, data: { starts: { increment: 1 } } });
            await tx.conversation.update({ where: { id }, data: { startedAt: new Date(), startedBy: userId } });
        }
        return tx.message.create({ data: { id: randomUUID(), conversationId: id, senderId: userId, ...data } });
    });
    events.emit([c.aId, c.bId], 'message', { conversationId: id });
    return result;
}
export async function markRead(userId: string, id: string) { const c = await member(db, userId, id); await db.conversation.update({ where: { id }, data: c.aId === userId ? { readAAt: new Date() } : { readBAt: new Date() } }); events.emit([c.aId, c.bId], 'read', { conversationId: id }); return { ok: true }; }
export async function unmatch(userId: string, id: string) { const c = await member(db, userId, id); await db.$transaction(async (tx) => { await lockUsers(tx, [c.aId, c.bId]); await tx.conversation.update({ where: { id }, data: { active: false } }); }); events.emit([c.aId, c.bId], 'match', {}); return { ok: true }; }
export async function block(userId: string, toId: string) { if (userId === toId)
    fail('INVALID_TARGET'); const [aId, bId] = orderedPair(userId, toId); await db.$transaction(async (tx) => { await lockUsers(tx, [aId, bId]); if (!await tx.user.findUnique({ where: { id: toId } }))
    fail('NOT_FOUND', 404); await tx.block.upsert({ where: { fromId_toId: { fromId: userId, toId } }, create: { fromId: userId, toId }, update: {} }); await tx.conversation.updateMany({ where: { aId, bId }, data: { active: false } }); }); events.emit([aId, bId], 'match', {}); return { ok: true }; }
export async function report(userId: string, body: unknown) { const p = z.object({ toId: z.string().uuid(), reason: z.enum(['SPAM', 'HARASSMENT', 'UNDERAGE', 'FAKE', 'OTHER']), note: z.string().max(1000).default('') }).strict().parse(body); if (userId === p.toId)
    fail('INVALID_TARGET'); await block(userId, p.toId); return db.report.create({ data: { fromId: userId, ...p } }); }
