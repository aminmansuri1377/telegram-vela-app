import { test } from 'node:test';
import assert from 'node:assert/strict';
import { databaseHarness } from './database-harness';
import { publicProfile } from '../apps/api/src/profiles';
import { profileSchema } from '../packages/shared/validation';
import { readFileSync } from 'node:fs';
test('Preferences persist, default to hidden, can be shared and erased', async () => {
    const h = await databaseHarness();
    try {
        const u = await h.client.user.create({ data: { telegramId: '987654321', firstName: 'Adult' } });
        const input = { displayName: 'Adult', birthDate: '1995-01-01', gender: 'OTHER', interestedIn: ['OTHER'], bio: '', city: 'Berlin', country: 'Germany', languages: ['en'], interests: [], goal: 'CASUAL', visible: true, minAge: 18, maxAge: 60, maxDistance: 500, latitude: null, longitude: null, terms: true };
        const parsed = profileSchema.parse(input);
        assert.equal(parsed.showFetish, false);
        assert.equal(parsed.fetish, '');
        assert.equal(profileSchema.safeParse({ ...input, fetish: 'a'.repeat(301) }).success, false);
        const { terms: _terms, ...data } = parsed;
        let p = await h.client.profile.create({ data: { ...data, userId: u.id, birthDate: new Date(parsed.birthDate), fetish: 'Personal preference' } });
        assert.equal(Object.hasOwn((await publicProfile({ ...u, profile: p, photos: [] }))!, 'fetish'), false);
        p = await h.client.profile.update({ where: { userId: u.id }, data: { showFetish: true } });
        assert.equal((await publicProfile({ ...u, profile: p, photos: [] }))?.fetish, 'Personal preference');
        await h.client.user.delete({ where: { id: u.id } });
        assert.equal(await h.client.profile.count(), 0);
    } finally { await h.close(); }
});
test('Persian registration labels have the correct meaning', () => {
    const fa = JSON.parse(readFileSync('apps/web/src/locales/fa.json', 'utf8'));
    assert.equal(fa.login, 'ورود با تلگرام');
    assert.equal(fa.adult, 'ویژه افراد بالای ۱۸ سال');
    assert.equal(fa.CASUAL, 'رابطه بدون تعهد');
});
