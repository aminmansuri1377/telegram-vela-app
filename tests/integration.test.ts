import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHmac } from 'node:crypto';
import { databaseHarness } from './database-harness';
import { useTestDatabase } from '../apps/api/src/db';
import { seed } from '../prisma/seed';
import { swipe, sendMessage, block, history, likes } from '../apps/api/src/social';
import { discovery, deleteAccount, saveProfile, removePhoto } from '../apps/api/src/profiles';
import { settle } from '../apps/api/src/payments';
import { issue, requireSession, logout, login, devLogin } from '../apps/api/src/auth';
import { requireAdmin } from '../apps/api/src/admin';
test('PostgreSQL-backed service integration', { timeout: 120000 }, async (t) => {
    process.env.NODE_ENV = 'test';
    process.env.FRONTEND_URL = 'http://localhost:5173';
    const harness = await databaseHarness();
    const db = harness.client;
    useTestDatabase(db);
    try {
        await t.test('Migration and repeatable seed create exactly 20 women and 10 men', async () => { await seed(db); await seed(db); assert.equal(await db.user.count(), 30); assert.equal(await db.profile.count({ where: { gender: 'FEMALE' } }), 20); assert.equal(await db.profile.count({ where: { gender: 'MALE' } }), 10); });
        const man = await db.user.findUniqueOrThrow({ where: { telegramId: 'test-man-01' } });
        const women = await db.user.findMany({ where: { telegramId: { startsWith: 'test-woman-' } }, orderBy: { telegramId: 'asc' } });
        await t.test('Mutual likes create exactly one match', async () => { const a = await swipe(man.id, { toId: women[5].id, kind: 'LIKE' }); assert.ok(a.match); const b = await swipe(man.id, { toId: women[5].id, kind: 'LIKE' }); assert.equal(a.match, b.match); });
        await t.test('Free male cannot access received likes', async () => { await assert.rejects(() => likes(man.id)); });
        const chats = await db.conversation.findMany({ where: { OR: [{ aId: man.id }, { bId: man.id }], startedAt: null }, orderBy: { id: 'asc' } });
        await t.test('Three starts allowed, fourth denied; retries and replies do not consume quota', async () => { for (const c of chats.slice(0, 3)) {
            const body = { body: 'Hello', clientId: randomUUID() };
            const a = await sendMessage(man.id, c.id, body);
            assert.equal((await sendMessage(man.id, c.id, body)).id, a.id);
        } await assert.rejects(() => sendMessage(man.id, chats[3].id, { body: 'Fourth', clientId: randomUUID() })); await sendMessage(man.id, chats[0].id, { body: 'Another message', clientId: randomUUID() }); assert.equal((await db.dailyUsage.findFirstOrThrow({ where: { userId: man.id } })).starts, 3); });
        await t.test('Chat membership enforced', async () => { await assert.rejects(() => history(women[19].id, chats[0].id)); });
        await t.test('Message pagination has no overlap', async () => { for (let i = 0; i < 42; i++)
            await sendMessage(man.id, chats[0].id, { body: String(i), clientId: randomUUID() }); const page = await history(man.id, chats[0].id); assert.equal(page.items.length, 40); const older = await history(man.id, chats[0].id, page.nextCursor!); assert.ok(older.items.length > 0); assert.equal(page.items.some(x => older.items.some(y => y.id === x.id)), false); });
        await t.test('Block closes chat and removes user from discovery', async () => { const other = chats[0].aId === man.id ? chats[0].bId : chats[0].aId; await block(man.id, other); await assert.rejects(() => sendMessage(man.id, chats[0].id, { body: 'Blocked', clientId: randomUUID() })); const cards = await discovery(man.id); assert.ok(!cards.items.some(x => x?.id === other)); });
        await t.test('Discovery excludes already swiped people and private fields', async () => { const cards = await discovery(man.id); assert.ok(cards.items.length); for (const card of cards.items) {
            assert.ok(!('telegramId' in card!));
            assert.ok(!('latitude' in card!));
            assert.ok(!await db.swipe.findUnique({ where: { fromId_toId: { fromId: man.id, toId: card!.id } } }));
        } });
        await t.test('Only owner can delete a photo', async () => { const photo = await db.photo.findFirstOrThrow({ where: { userId: women[0].id } }); await assert.rejects(() => removePhoto(man.id, photo.id)); });
        await t.test('Invalid profile rejected server-side', async () => { await assert.rejects(() => saveProfile(man.id, { birthDate: '2020-01-01' })); });
        await t.test('Payment verifies amount and payer; duplicate settlement does not extend twice', async () => { const intent = await db.paymentIntent.create({ data: { userId: man.id, planId: 'BASIC', stars: 100, days: 7, expiresAt: new Date(Date.now() + 60000) } }); const payload = { currency: 'XTR', total_amount: 100, invoice_payload: intent.id, telegram_payment_charge_id: 'test-charge-one' }; await assert.rejects(() => db.$transaction(tx => settle(tx, man.telegramId, { ...payload, total_amount: 1 }))); await assert.rejects(() => db.$transaction(tx => settle(tx, '999', payload))); await db.$transaction(tx => settle(tx, man.telegramId, payload)); const expires = (await db.user.findUniqueOrThrow({ where: { id: man.id } })).premiumUntil; assert.ok(expires! > new Date()); await db.$transaction(tx => settle(tx, man.telegramId, payload)); assert.deepEqual((await db.user.findUniqueOrThrow({ where: { id: man.id } })).premiumUntil, expires); await sendMessage(man.id, chats[3].id, { body: 'Premium starts', clientId: randomUUID() }); });
        await t.test('Logout revokes session and CSRF rejects mutation', async () => { let cookie = ''; const res = { cookie: (_k: string, v: string) => cookie = v, clearCookie: () => { } } as any; const s = await issue(man.id, res); const req = { cookies: { vela_session: cookie }, headers: { origin: process.env.FRONTEND_URL, 'x-csrf-token': s.csrf } } as any; assert.equal((await requireSession(req)).userId, man.id); await assert.rejects(() => requireSession({ ...req, headers: { origin: 'https://evil.example' } }, true)); await logout(req, res); await assert.rejects(() => requireSession(req)); });
        await t.test('Telegram logout/relogin retains identity but another browser cannot replay initData', async () => { process.env.TELEGRAM_BOT_TOKEN = 'test-token'; const p = new URLSearchParams({ auth_date: String(Math.floor(Date.now() / 1000)), user: JSON.stringify({ id: 1234567, first_name: 'New test' }) }); const secret = createHmac('sha256', 'WebAppData').update('test-token').digest(); p.set('hash', createHmac('sha256', secret).update([...p.entries()].sort().map(([k, v]) => `${k}=${v}`).join('\n')).digest('hex')); const cookies: Record<string, string> = {}; const res = { cookie: (k: string, v: string) => cookies[k] = v, clearCookie: (k: string) => delete cookies[k] } as any; const req = { cookies, headers: { origin: process.env.FRONTEND_URL } } as any; const first = await login({ initData: p.toString() }, req, res); req.headers['x-csrf-token'] = first.csrf; const id = (await requireSession(req)).userId; await logout(req, res); const again = await login({ initData: p.toString() }, req, res); req.headers['x-csrf-token'] = again.csrf; assert.equal((await requireSession(req)).userId, id); await assert.rejects(() => login({ initData: p.toString() }, { cookies: {}, headers: { origin: process.env.FRONTEND_URL } } as any, res)); });
        await t.test('Admin requires role and dev login is disabled in production', async () => { assert.throws(() => requireAdmin(man)); const admin = await db.user.findUniqueOrThrow({ where: { telegramId: 'test-man-10' } }); assert.doesNotThrow(() => requireAdmin(admin)); process.env.NODE_ENV = 'production'; try {
            assert.throws(() => requireAdmin(admin));
            await assert.rejects(() => devLogin({ telegramId: 'test-man-01' }, {} as any, {} as any));
        }
        finally {
            process.env.NODE_ENV = 'test';
        } });
        await t.test('Female policy allows more than three new starts', async () => { const woman = women[18]; const men = await db.user.findMany({ where: { telegramId: { in: ['test-man-04', 'test-man-05', 'test-man-06', 'test-man-07'] } } }); for (const m of men) {
            await swipe(woman.id, { toId: m.id, kind: 'LIKE' });
            const pair = await swipe(m.id, { toId: woman.id, kind: 'LIKE' });
            await sendMessage(woman.id, pair.match!, { body: 'Hello', clientId: randomUUID() });
        } assert.equal((await db.dailyUsage.findFirstOrThrow({ where: { userId: woman.id } })).starts, 4); });
        await t.test('Account deletion cascades personal records and queues media deletion', async () => { await deleteAccount(man.id); assert.equal(await db.user.findUnique({ where: { id: man.id } }), null); assert.equal(await db.message.count({ where: { senderId: man.id } }), 0); assert.equal(await db.session.count({ where: { userId: man.id } }), 0); assert.equal((await db.paymentIntent.findFirstOrThrow({ where: { chargeId: 'test-charge-one' } })).userId, null); assert.ok(await db.outbox.count({ where: { kind: 'DELETE_PHOTO' } })); });
    }
    finally {
        await harness.close();
    }
});
