import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
async function run() { for (const [id, days, stars] of [['BASIC', 7, 100], ['PREMIUM', 30, 300], ['VIP', 90, 750]] as const)
    await db.plan.upsert({ where: { id }, create: { id, days, stars }, update: {} }); for (const [gender, dailyStarts, seeLikes] of [['MALE', 3, false], ['FEMALE', -1, true], ['OTHER', -1, true]] as const)
    await db.policy.upsert({ where: { gender }, create: { gender, dailyStarts, seeLikes }, update: {} }); const ids = (process.env.ADMIN_TELEGRAM_IDS || '').split(',').map(x => x.trim()).filter(Boolean); await db.user.updateMany({ where: { telegramId: { in: ids } }, data: { role: 'ADMIN' } }); console.log('Plans/policies initialized; existing allowlisted users promoted. No fictional users created.'); }
run().catch(() => { console.error('Initialization failed'); process.exitCode = 1; }).finally(() => db.$disconnect());
