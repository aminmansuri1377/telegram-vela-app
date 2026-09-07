import { config } from 'dotenv';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
config({ path: resolve(__dirname, '../.env') });
const db = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL || process.env.DATABASE_URL } } });
async function run() {
    if (process.env.DEMO_PROFILES_ENABLED !== 'true') throw new Error('Set DEMO_PROFILES_ENABLED=true and DEMO_TELEGRAM_IDS in .env first.');
    const ids = (process.env.DEMO_TELEGRAM_IDS || '').split(',').map(x => x.trim()).filter(Boolean);
    if (!ids.length || ids.some(x => !/^\d+$/.test(x))) throw new Error('DEMO_TELEGRAM_IDS must contain numeric Telegram user IDs.');
    const owner = await db.user.findFirst({ where: { telegramId: { in: ids }, isTest: false }, include: { profile: true } });
    if (!owner?.profile) throw new Error('First sign in through Telegram and complete a real tester profile.');
    const p = owner.profile;
    const women = ['Lina','Maya','Nora','Sofia','Darya','Sara','Mina','Leila','Zara','Emma','Giulia','Aisha','Mei','Priya','Alina','Clara','Elena','Yasmin','Luna','Nadia'];
    const men = ['Adrian','Arman','Leo','Deniz','Omar','Alex','Ravi','Luca','Daniel','Wei'];
    await db.$transaction(async tx => {
        for (let i = 0; i < 30; i++) {
            const female = i < 20, n = female ? i : i - 20;
            const telegramId = `test-${female ? 'woman' : 'man'}-${String(n + 1).padStart(2, '0')}`;
            const name = (female ? women : men)[n];
            const existing = await tx.user.findUnique({ where: { telegramId } });
            if (existing && !existing.isTest) throw new Error('A reserved demo identifier belongs to a non-test account.');
            const user = await tx.user.upsert({ where: { telegramId }, create: { telegramId, firstName: name, isTest: true, termsAt: new Date(), termsVersion: '1.0', notifications: false }, update: { firstName: name, role: 'USER', notifications: false } });
            const profile = { displayName: name, birthDate: new Date(`${1990 + i % 10}-06-15`), gender: female ? 'FEMALE' : 'MALE', interestedIn: ['MALE','FEMALE','OTHER'], bio: `Fictional test profile. I enjoy ${['music and coffee','travel and photography','books and cooking'][i % 3]}. Likes and chat replies are simulated.`, city: p.city, country: p.country, languages: [...new Set([...p.languages, 'en'])], interests: [['Music','Coffee'],['Travel','Photography'],['Books','Cooking']][i % 3], goal: ['DATING','FRIENDSHIP','CHAT','RELATIONSHIP','CASUAL'][i % 5], minAge: 18, maxAge: 100, visible: true, latitude: p.latitude, longitude: p.longitude };
            await tx.profile.upsert({ where: { userId: user.id }, create: { userId: user.id, ...profile }, update: profile });
            const path = `seed:${female ? n % 3 : 3 + n % 3}:${user.id}`;
            await tx.photo.upsert({ where: { path }, create: { userId: user.id, path, purpose: 'PROFILE', status: 'APPROVED' }, update: { status: 'APPROVED' } });
        }
    }, { timeout: 120000, maxWait: 10000 });
    console.log('Ready: 20 fictional women and 10 fictional men. Existing swipes/messages were preserved. Render must have the same DEMO settings.');
}
run().catch(error => { console.error(error instanceof Error && !('code' in error) && !error.message.includes('prisma') ? error.message : 'Demo seed failed. Check database connectivity and migrations.'); process.exitCode = 1; }).finally(() => db.$disconnect());
