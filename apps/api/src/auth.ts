import type { Request, Response } from 'express';
import { db } from './db';
import { digest, fail, randomToken, validateTelegram } from './security';
import { locales } from '../../../packages/shared/validation';
import { z } from 'zod';
export const cookieName = 'vela_session';
const prod = () => process.env.NODE_ENV === 'production';
const options = () => ({ httpOnly: true, secure: prod(), sameSite: 'lax' as const, path: '/' });
export async function requireSession(req: Request, mutation = false) {
    const token = req.cookies?.[cookieName];
    if (typeof token !== 'string')
        fail('AUTH_REQUIRED', 401);
    const session = await db.session.findUnique({ where: { tokenHash: digest(token) }, include: { user: { include: { profile: true } } } });
    if (!session || session.expiresAt < new Date() || session.user.banned)
        fail('AUTH_REQUIRED', 401);
    if (mutation && (req.headers.origin !== process.env.FRONTEND_URL || req.headers['x-csrf-token'] !== session.csrf))
        fail('CSRF_INVALID', 403);
    return session;
}
export async function issue(userId: string, res: Response) { const token = randomToken(); const session = await db.session.create({ data: { userId, tokenHash: digest(token), csrf: randomToken(), expiresAt: new Date(Date.now() + 7 * 86400000) } }); res.cookie(cookieName, token, { ...options(), maxAge: 7 * 86400000 }); return { csrf: session.csrf }; }
export async function login(body: unknown, req: Request, res: Response) {
    if (req.headers.origin !== process.env.FRONTEND_URL)
        fail('ORIGIN_INVALID', 403);
    const data = z.object({ initData: z.string().min(1).max(16000) }).parse(body);
    const { user, replay } = validateTelegram(data.initData, process.env.TELEGRAM_BOT_TOKEN || '');
    // Reuse an already-authenticated session, but never issue a second session for a replay.
    const current = typeof req.cookies?.[cookieName] === 'string' ? await db.session.findUnique({ where: { tokenHash: digest(req.cookies[cookieName]) }, include: { user: true } }) : null;
    if (current && current.expiresAt > new Date() && current.user.telegramId === String(user.id) && !current.user.banned)
        return { csrf: current.csrf };
    const browserToken = typeof req.cookies?.vela_launch === 'string' ? req.cookies.vela_launch : randomToken();
    const record = await db.$transaction(async (tx) => {
        const claimed = await tx.authReplay.createMany({ data: [{ hash: replay, browserHash: digest(browserToken), expiresAt: new Date(Date.now() + 360000) }], skipDuplicates: true });
        if (!claimed.count) {
            const existing = await tx.authReplay.findUniqueOrThrow({ where: { hash: replay } });
            if (existing.browserHash !== digest(browserToken))
                fail('REOPEN_TELEGRAM', 401);
        }
        const u = await tx.user.upsert({ where: { telegramId: String(user.id) }, create: { telegramId: String(user.id), firstName: user.first_name, username: user.username, notifications: !!user.allows_write_to_pm, locale: locales.includes(user.language_code as typeof locales[number]) ? user.language_code : 'en' }, update: { username: user.username, firstName: user.first_name, lastActive: new Date() } });
        if (u.banned)
            fail('AUTH_REQUIRED', 403);
        return u;
    });
    res.cookie('vela_launch', browserToken, { ...options(), maxAge: 360000 });
    return issue(record.id, res);
}
export function devEnabled() { return !prod() && process.env.DEV_LOGIN_ENABLED === 'true'; }
export async function devLogin(body: unknown, req: Request, res: Response) { if (!devEnabled())
    fail('NOT_FOUND', 404); if (req.headers.origin !== process.env.FRONTEND_URL)
    fail('ORIGIN_INVALID', 403); const { telegramId } = z.object({ telegramId: z.string().regex(/^test-(?:woman|man)-\d{2}$/) }).parse(body); const u = await db.user.findUnique({ where: { telegramId } }); if (!u?.isTest || u.banned)
    fail('AUTH_REQUIRED', 401); return issue(u.id, res); }
export async function logout(req: Request, res: Response) { const s = await requireSession(req, true); await db.session.delete({ where: { id: s.id } }); res.clearCookie(cookieName, options()); return { ok: true }; }
