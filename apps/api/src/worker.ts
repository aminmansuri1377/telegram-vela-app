import 'dotenv/config';
import { db } from './db';
import { storage } from './profiles';
import { telegram } from './payments';
import type { Outbox } from '@prisma/client';
const matchTexts: Record<string, string> = { en: 'You have a new match on Vela.', zh: '你在 Vela 有新的配对。', ru: 'У вас новая пара в Vela.', hi: 'Vela पर आपका नया मैच है।', ur: 'Vela پر آپ کا نیا میچ ہے۔', fa: 'در Vela یک مچ جدید دارید.', ar: 'لديك تطابق جديد في Vela.', tr: 'Vela’da yeni bir eşleşmeniz var.', es: 'Tienes una nueva conexión en Vela.', de: 'Du hast ein neues Match auf Vela.', it: 'Hai un nuovo match su Vela.' };
export async function tick() {
    const jobs = await db.$queryRaw<Outbox[]> `UPDATE "Outbox" SET "lockedAt"=NOW() WHERE id IN (SELECT id FROM "Outbox" WHERE "runAt"<=NOW() AND ("lockedAt" IS NULL OR "lockedAt"<NOW()-INTERVAL '5 minutes') ORDER BY "runAt" LIMIT 20 FOR UPDATE SKIP LOCKED) RETURNING *`;
    for (const job of jobs) {
        const p = job.payload as Record<string, string>;
        try {
            if (job.kind === 'DELETE_PHOTO' && !p.path.startsWith('seed:')) {
                const { error } = await storage().remove([p.path]);
                if (error)
                    throw error;
            }
            else if (job.kind === 'NOTIFY') {
                const user = await db.user.findUnique({ where: { telegramId: p.telegramId } });
                if (user && !user.banned && user.notifications)
                    await telegram('sendMessage', { chat_id: p.telegramId, text: matchTexts[user.locale] || matchTexts.en });
            }
            else if (job.kind === 'REFUND') {
                await telegram('refundStarPayment', { user_id: Number(p.telegramId), telegram_payment_charge_id: p.chargeId });
                await db.paymentIntent.updateMany({ where: { chargeId: p.chargeId }, data: { status: 'REFUNDED' } });
            }
            await db.outbox.delete({ where: { id: job.id } });
        }
        catch {
            await db.outbox.update({ where: { id: job.id }, data: { attempts: { increment: 1 }, lockedAt: null, runAt: new Date(Date.now() + Math.min(3600000, 10000 * 2 ** Math.min(job.attempts, 9))) } });
            process.stderr.write(JSON.stringify({ event: 'outbox_retry', id: job.id, attempt: job.attempts + 1 }) + '\n');
        }
    }
    await db.authReplay.deleteMany({ where: { expiresAt: { lt: new Date() } } });
    await db.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
    await db.paymentIntent.updateMany({ where: { status: 'PENDING', expiresAt: { lt: new Date() } }, data: { status: 'EXPIRED' } });
    // Remove abandoned chat uploads after 24h; message references are deliberately retained.
    const stale = await db.photo.findMany({ where: { purpose: 'CHAT', createdAt: { lt: new Date(Date.now() - 86400000) } }, take: 100 });
    for (const p of stale)
        await db.$transaction(async (tx) => { await tx.$queryRaw `SELECT id FROM "User" WHERE id=${p.userId}::uuid FOR UPDATE`; if (!await tx.message.count({ where: { photoId: p.id } })) {
            await tx.outbox.create({ data: { kind: 'DELETE_PHOTO', payload: { path: p.path } } });
            await tx.photo.deleteMany({ where: { id: p.id } });
        } });
}
if (require.main === module) {
    let running = true;
    process.on('SIGTERM', () => { running = false; });
    (async () => { while (running) {
        try {
            await tick();
        }
        catch {
            process.stderr.write('Worker iteration failed; retrying.\n');
        }
        await new Promise(r => setTimeout(r, 5000));
    } await db.$disconnect(); })().catch(() => { process.exitCode = 1; });
}
