import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { databaseHarness } from './database-harness';
import { useTestDatabase } from '../apps/api/src/db';
import { seed } from '../prisma/seed';
import { swipe, sendMessage, history } from '../apps/api/src/social';
import { demoAccess } from '../apps/api/src/demo';
test('Allowlisted Telegram tester can match and receive one demo reply per message; disabling gates access', async () => {
    process.env.NODE_ENV = 'test'; const h = await databaseHarness(); useTestDatabase(h.client);
    try {
        await seed(h.client);
        const owner = await h.client.user.update({ where: { telegramId: 'test-man-01' }, data: { telegramId: '98765', isTest: false } });
        const target = await h.client.user.findUniqueOrThrow({ where: { telegramId: 'test-woman-10' } });
        process.env.NODE_ENV = 'production'; process.env.DEMO_PROFILES_ENABLED = 'true'; process.env.DEMO_TELEGRAM_IDS = '98765';
        assert.equal(demoAccess(owner), true); assert.equal(demoAccess(target), false);
        const m = await swipe(owner.id, { toId: target.id, kind: 'LIKE' }); assert.ok(m.match);
        const body = { body: 'Hello test', clientId: randomUUID() };
        await sendMessage(owner.id, m.match!, body); await sendMessage(owner.id, m.match!, body);
        assert.equal(await h.client.message.count({ where: { conversationId: m.match! } }), 2);
        process.env.DEMO_PROFILES_ENABLED = 'false';
        await assert.rejects(() => history(owner.id, m.match!));
    } finally { process.env.NODE_ENV = 'test'; delete process.env.DEMO_PROFILES_ENABLED; delete process.env.DEMO_TELEGRAM_IDS; await h.close(); }
});
