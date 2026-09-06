import { config } from 'dotenv';
import { resolve } from 'node:path';
config({ path: resolve(__dirname, '../.env') });
import { PrismaClient } from '@prisma/client';
const db = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL || process.env.DATABASE_URL } } });
async function run() { for (const [id, days, stars] of [['BASIC', 7, 100], ['PREMIUM', 30, 300], ['VIP', 90, 750]] as const)
    await db.plan.upsert({ where: { id }, create: { id, days, stars }, update: {} }); for (const [gender, dailyStarts, seeLikes] of [['MALE', 3, false], ['FEMALE', -1, true], ['OTHER', -1, true]] as const)
    await db.policy.upsert({ where: { gender }, create: { gender, dailyStarts, seeLikes }, update: {} }); const ids = (process.env.ADMIN_TELEGRAM_IDS || '').split(',').map(x => x.trim()).filter(Boolean); await db.user.updateMany({ where: { telegramId: { in: ids } }, data: { role: 'ADMIN' } }); console.log('Plans/policies initialized; existing allowlisted users promoted. No fictional users created.'); }
run().catch((error: unknown) => {
    const e = error as { code?: string; errorCode?: string };
    const code = e?.code || e?.errorCode || 'UNKNOWN';
    const help: Record<string, string> = {
        P1000: 'Authentication failed: check the database password and URL-encode special password characters.',
        P1001: 'Database unreachable: check Supabase status, your network and Session Pooler port 5432.',
        P1002: 'Database connection timed out. Check connectivity and retry.',
        P1012: 'Missing configuration: set DATABASE_URL and DIRECT_URL in the project .env file.',
        P1013: 'Invalid database URL: check the copied connection string and password encoding.',
        P2021: 'Missing tables: run npm run db:migrate against the intended database, then retry.',
        P2022: 'Outdated schema: run npm run db:migrate and npm run db:generate, then retry.',
        P2024: 'Connection pool timeout: retry using Session Pooler port 5432.',
    };
    const known = Object.hasOwn(help, code);
    console.error(`Initialization failed [${known ? code : 'UNKNOWN'}]. ${known ? help[code] : 'Check .env and run npm run db:generate. Raw errors are hidden to protect credentials.'}`);
    process.exitCode = 1;
}).finally(() => db.$disconnect());
