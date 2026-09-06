import { z } from 'zod';
export const locales = ['en', 'zh', 'ru', 'hi', 'ur', 'fa', 'ar', 'tr', 'es', 'de', 'it'] as const;
export const genders = ['MALE', 'FEMALE', 'OTHER'] as const;
export const goals = ['DATING', 'FRIENDSHIP', 'CHAT', 'RELATIONSHIP', 'CASUAL'] as const;
export function ageAt(birth: Date, now = new Date()) { let age = now.getUTCFullYear() - birth.getUTCFullYear(); if (now.getUTCMonth() < birth.getUTCMonth() || (now.getUTCMonth() === birth.getUTCMonth() && now.getUTCDate() < birth.getUTCDate()))
    age--; return age; }
export const profileSchema = z.object({
    displayName: z.string().trim().min(2).max(40), birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s => { const d = new Date(s); return !isNaN(+d) && d.toISOString().slice(0, 10) === s && ageAt(d) >= 18 && ageAt(d) <= 100; }, 'ADULT_REQUIRED'),
    gender: z.enum(genders), interestedIn: z.array(z.enum(genders)).min(1).max(3), bio: z.string().trim().max(500), city: z.string().trim().min(1).max(80), country: z.string().trim().min(1).max(80), languages: z.array(z.enum(locales)).min(1).max(11), interests: z.array(z.string().trim().min(1).max(30)).max(12), fetish: z.string().trim().max(300).default(''), showFetish: z.boolean().default(false), goal: z.enum(goals), visible: z.boolean(), minAge: z.number().int().min(18).max(100), maxAge: z.number().int().min(18).max(100), maxDistance: z.number().int().min(1).max(20000), latitude: z.number().min(-90).max(90).nullable(), longitude: z.number().min(-180).max(180).nullable(), filterLanguages: z.array(z.enum(locales)).max(11).default([]), filterInterests: z.array(z.string().max(30)).max(12).default([]), filterGoal: z.enum(goals).nullable().default(null), terms: z.literal(true)
}).strict().refine(p => p.minAge <= p.maxAge, 'AGE_RANGE').refine(p => (p.latitude === null) === (p.longitude === null), 'LOCATION_PAIR');
export const messageSchema = z.object({ body: z.string().trim().max(2000), photoId: z.string().uuid().optional(), clientId: z.string().uuid() }).strict().refine(x => !!x.body || !!x.photoId, 'EMPTY_MESSAGE');
export const uuid = z.string().uuid();
export function orderedPair(a: string, b: string) { return [a, b].sort() as [
    string,
    string
]; }
export function utcDay(date = new Date()) { return date.toISOString().slice(0, 10); }
export function isPremium(until: Date | null, now = new Date()) { return !!until && until > now; }
export function entitlement(gender: string, until: Date | null, policy: {
    dailyStarts: number;
    seeLikes: boolean;
}) { const premium = isPremium(until); return { premium, dailyStarts: premium ? -1 : policy.dailyStarts, seeLikes: premium || policy.seeLikes, unlimitedSwipes: true }; }
export function distanceKm(a: {
    latitude: number | null;
    longitude: number | null;
}, b: {
    latitude: number | null;
    longitude: number | null;
}) { if (a.latitude === null || a.longitude === null || b.latitude === null || b.longitude === null)
    return null; const r = Math.PI / 180, dLat = (b.latitude - a.latitude) * r, dLon = (b.longitude - a.longitude) * r; const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.latitude * r) * Math.cos(b.latitude * r) * Math.sin(dLon / 2) ** 2; return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h))); }

export const filterSchema = z.object({
    interestedIn: z.array(z.enum(genders)).min(1).max(3),
    minAge: z.number().int().min(18).max(100), maxAge: z.number().int().min(18).max(100),
    maxDistance: z.number().int().min(1).max(20000),
    latitude: z.number().min(-90).max(90).nullable(), longitude: z.number().min(-180).max(180).nullable(),
    filterLanguages: z.array(z.enum(locales)).max(11),
    filterInterests: z.array(z.string().trim().min(1).max(30)).max(12),
    filterGoal: z.enum(goals).nullable(),
}).strict().refine(p => p.minAge <= p.maxAge, 'AGE_RANGE').refine(p => (p.latitude === null) === (p.longitude === null), 'LOCATION_PAIR');
