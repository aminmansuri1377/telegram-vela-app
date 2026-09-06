import { db, lockUsers, Tx } from './db';
import { fail } from './security';
import { z } from 'zod';
export async function telegram<T = unknown>(method: string, body: unknown): Promise<T> { const token = process.env.TELEGRAM_BOT_TOKEN; if (!token)
    fail('TELEGRAM_NOT_CONFIGURED', 503); const res = await fetch(`https://api.telegram.org/bot${token}/${process.env.TELEGRAM_TEST_ENV === 'true' ? 'test/' : ''}${method}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(8000) }); const json = await res.json() as {
    ok: boolean;
    result: T;
}; if (!res.ok || !json.ok)
    fail('TELEGRAM_UNAVAILABLE', 503); return json.result; }
export async function invoice(userId: string, body: unknown) { const { planId } = z.object({ planId: z.enum(['BASIC', 'PREMIUM', 'VIP']) }).parse(body); const plan = await db.plan.findUnique({ where: { id: planId } }); if (!plan?.active)
    fail('PLAN_UNAVAILABLE', 404); if (!process.env.TELEGRAM_BOT_TOKEN)
    fail('TELEGRAM_NOT_CONFIGURED', 503); const intent = await db.paymentIntent.create({ data: { userId, planId, stars: plan.stars, days: plan.days, expiresAt: new Date(Date.now() + 30 * 60000) } }); try {
    const url = await telegram<string>('createInvoiceLink', { title: `Vela ${planId}`, description: `${plan.days} days of Vela membership. One-time purchase.`, payload: intent.id, currency: 'XTR', prices: [{ label: planId, amount: plan.stars }], provider_token: '' });
    await db.paymentIntent.update({ where: { id: intent.id }, data: { invoiceUrl: url } });
    return { id: intent.id, url };
}
catch (e) {
    await db.paymentIntent.update({ where: { id: intent.id }, data: { status: 'FAILED' } });
    throw e;
} }
export const successfulPaymentSchema = z.object({ currency: z.literal('XTR'), total_amount: z.number().int().positive(), invoice_payload: z.string().uuid(), telegram_payment_charge_id: z.string().min(1).max(300) });
export async function settle(tx: Tx, telegramId: string, raw: unknown) {
    const payment = successfulPaymentSchema.parse(raw);
    const initial = await tx.paymentIntent.findUnique({ where: { id: payment.invoice_payload } });
    if (!initial)
        fail('PAYMENT_UNKNOWN');
    if (initial.userId)
        await lockUsers(tx, [initial.userId]);
    await tx.$queryRaw `SELECT id FROM "PaymentIntent" WHERE id=${initial.id}::uuid FOR UPDATE`;
    const intent = await tx.paymentIntent.findUniqueOrThrow({ where: { id: initial.id }, include: { user: true } });
    if (intent.chargeId === payment.telegram_payment_charge_id)
        return { ok: true, duplicate: true };
    if (intent.chargeId || intent.stars !== payment.total_amount || intent.user && intent.user.telegramId !== telegramId)
        fail('PAYMENT_MISMATCH');
    if (!intent.user || intent.user.banned) {
        await tx.outbox.create({ data: { kind: 'REFUND', payload: { telegramId, chargeId: payment.telegram_payment_charge_id } } });
        await tx.paymentIntent.update({ where: { id: intent.id }, data: { chargeId: payment.telegram_payment_charge_id, status: 'REFUND_PENDING', paidAt: new Date() } });
        return { ok: true };
    }
    const base = Math.max(Date.now(), intent.user.premiumUntil?.getTime() || 0);
    await tx.user.update({ where: { id: intent.user.id }, data: { premiumUntil: new Date(base + intent.days * 86400000) } });
    await tx.paymentIntent.update({ where: { id: intent.id }, data: { chargeId: payment.telegram_payment_charge_id, status: 'PAID', paidAt: new Date() } });
    return { ok: true };
}
const updateSchema = z.object({ update_id: z.number().int(), pre_checkout_query: z.object({ id: z.string(), from: z.object({ id: z.number().int().safe() }), currency: z.string(), total_amount: z.number(), invoice_payload: z.string() }).optional(), message: z.object({ from: z.object({ id: z.number().int().safe() }).optional(), chat: z.object({ id: z.number().int().safe() }), text: z.string().optional(), successful_payment: z.unknown().optional() }).optional() });
export async function webhook(raw: unknown) {
    const update = updateSchema.parse(raw);
    const q = update.pre_checkout_query;
    if (q) {
        const intent = await db.paymentIntent.findUnique({ where: { id: z.string().uuid().safeParse(q.invoice_payload).success ? q.invoice_payload : '00000000-0000-0000-0000-000000000000' }, include: { user: true } });
        const ok = !!intent && intent.status === 'PENDING' && intent.expiresAt > new Date() && q.currency === 'XTR' && q.total_amount === intent.stars && intent.user?.telegramId === String(q.from.id) && !intent.user.banned;
        await telegram('answerPreCheckoutQuery', { pre_checkout_query_id: q.id, ok, ...(!ok ? { error_message: 'This invoice is no longer valid. Please create a new invoice.' } : {}) });
        return { ok: true };
    }
    if (update.message?.successful_payment) {
        if (!update.message.from)
            fail('PAYMENT_MISMATCH');
        return db.$transaction(tx => settle(tx, String(update.message!.from!.id), update.message!.successful_payment));
    }
    const m = update.message;
    if (m?.text && m.from && ['/start', '/terms', '/privacy', '/support', '/paysupport'].includes(m.text.split(' ')[0])) {
        const cmd = m.text.split(' ')[0];
        await telegram('sendMessage', { chat_id: m.chat.id, text: cmd === '/start' ? 'Welcome to Vela. Open the app to continue (18+).' : cmd === '/terms' || cmd === '/privacy' ? `${process.env.TELEGRAM_WEBAPP_URL}/?legal=${cmd.slice(1)}` : `Payment and safety support: ${process.env.SUPPORT_URL || 'Contact the bot owner.'}`, ...(cmd === '/start' ? { reply_markup: { inline_keyboard: [[{ text: 'Open Vela', web_app: { url: process.env.TELEGRAM_WEBAPP_URL } }]] } } : {}) });
    }
    return { ok: true };
}
