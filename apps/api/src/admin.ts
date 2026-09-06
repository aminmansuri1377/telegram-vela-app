import { db } from './db';
import { fail } from './security';
import { deleteAccount } from './profiles';
import { genders } from '../../../packages/shared/validation';
import { z } from 'zod';
import type { User } from '@prisma/client';
export function requireAdmin(u: User) { const allow = (process.env.ADMIN_TELEGRAM_IDS || '').split(',').map(x => x.trim()); if (u.role !== 'ADMIN' || !(allow.includes(u.telegramId) || process.env.NODE_ENV !== 'production' && u.isTest))
    fail('FORBIDDEN', 403); }
export async function overview() { const [users, dau, mau, matches, messages, reports, active, paid] = await Promise.all([db.user.count(), db.user.count({ where: { lastActive: { gte: new Date(Date.now() - 86400000) } } }), db.user.count({ where: { lastActive: { gte: new Date(Date.now() - 30 * 86400000) } } }), db.conversation.count(), db.message.count(), db.report.count({ where: { status: 'OPEN' } }), db.user.count({ where: { premiumUntil: { gt: new Date() } } }), db.paymentIntent.aggregate({ where: { status: 'PAID' }, _sum: { stars: true } })]); return { users, dau, mau, matches, messages, reports, active, stars: paid._sum.stars || 0 }; }
export async function adminList(kind: string, query: string, cursor?: string) { const cursorWhere = cursor ? { id: { gt: cursor } } : {}; switch (kind) {
    case 'users': return db.user.findMany({ where: { ...cursorWhere, OR: [{ firstName: { contains: query, mode: 'insensitive' } }, { telegramId: { contains: query } }] }, select: { id: true, firstName: true, telegramId: true, banned: true, isTest: true, role: true, premiumUntil: true }, orderBy: { id: 'asc' }, take: 50 });
    case 'reports': return db.report.findMany({ where: cursorWhere, orderBy: { id: 'asc' }, take: 50 });
    case 'payments': return db.paymentIntent.findMany({ where: cursorWhere, orderBy: { id: 'asc' }, take: 50 });
    case 'photos': return db.photo.findMany({ where: { ...cursorWhere, status: 'PENDING' }, orderBy: { id: 'asc' }, take: 50 });
    case 'policies': return db.policy.findMany();
    case 'content': return db.content.findMany();
    case 'plans': return db.plan.findMany();
    case 'audit': return db.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
    default: fail('NOT_FOUND', 404);
} }
export async function adminChange(actor: string, kind: string, id: string, body: unknown) { return db.$transaction(async (tx) => { switch (kind) {
    case 'users': {
        const p = z.object({ banned: z.boolean() }).strict().parse(body);
        if (id === actor)
            fail('INVALID_TARGET');
        await tx.user.update({ where: { id }, data: p });
        if (p.banned)
            await tx.session.deleteMany({ where: { userId: id } });
        break;
    }
    case 'delete':
        if (id === actor)
            fail('INVALID_TARGET');
        await deleteAccount(id, tx);
        break;
    case 'reports':
        await tx.report.update({ where: { id }, data: z.object({ status: z.enum(['OPEN', 'IN_REVIEW', 'RESOLVED', 'REJECTED']), adminNote: z.string().max(2000) }).strict().parse(body) });
        break;
    case 'photos':
        await tx.photo.update({ where: { id }, data: z.object({ status: z.enum(['APPROVED', 'REJECTED']) }).strict().parse(body) });
        break;
    case 'plans':
        await tx.plan.update({ where: { id }, data: z.object({ stars: z.number().int().min(1).max(100000), days: z.number().int().min(1).max(365), active: z.boolean() }).strict().parse(body) });
        break;
    case 'policies':
        await tx.policy.update({ where: { gender: z.enum(genders).parse(id) }, data: z.object({ dailyStarts: z.number().int().min(-1).max(1000), seeLikes: z.boolean() }).strict().parse(body) });
        break;
    case 'content': {
        if (!/^(terms|privacy|safety)(\.(en|zh|ru|hi|ur|fa|ar|tr|es|de|it))?$/.test(id))
            fail('INVALID_CONTENT');
        await tx.content.upsert({ where: { key: id }, create: { key: id, ...z.object({ value: z.string().max(20000) }).strict().parse(body) }, update: z.object({ value: z.string().max(20000) }).strict().parse(body) });
        break;
    }
    default: fail('NOT_FOUND', 404);
} await tx.auditLog.create({ data: { actor, action: kind, target: id } }); return { ok: true }; }); }
