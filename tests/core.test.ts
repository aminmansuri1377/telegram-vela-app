import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { validateTelegram } from '../apps/api/src/security';
import { ageAt, orderedPair, utcDay, entitlement, profileSchema, distanceKm } from '../packages/shared/validation';
const token = 'test-bot-token';
const now = 1800000000;
function signed(date = now) { const p = new URLSearchParams({ auth_date: String(date), user: JSON.stringify({ id: 12345, first_name: 'Test' }) }); const secret = createHmac('sha256', 'WebAppData').update(token).digest(); p.set('hash', createHmac('sha256', secret).update([...p.entries()].sort().map(([k, v]) => `${k}=${v}`).join('\n')).digest('hex')); return p.toString(); }
test('Telegram accepts a valid signature', () => assert.equal(validateTelegram(signed(), token, now).user.id, 12345));
test('Telegram rejects tampering', () => assert.throws(() => validateTelegram(signed().replace('12345', '12346'), token, now)));
test('Telegram rejects expired and future authentication', () => { assert.throws(() => validateTelegram(signed(now - 301), token, now)); assert.throws(() => validateTelegram(signed(now + 31), token, now)); });
test('Telegram rejects duplicate keys and missing signature', () => { assert.throws(() => validateTelegram(signed() + '&auth_date=1', token, now)); assert.throws(() => validateTelegram('user=1', token, now)); });
test('Age uses birthdays', () => { assert.equal(ageAt(new Date('2008-09-06'), new Date('2026-09-05')), 17); assert.equal(ageAt(new Date('2008-09-05'), new Date('2026-09-05')), 18); });
test('UTC day and canonical pair', () => { assert.equal(utcDay(new Date('2026-09-05T23:30:00-02:00')), '2026-09-06'); assert.deepEqual(orderedPair('b', 'a'), ['a', 'b']); });
test('Policy grants unlimited swipes and respects expiry', () => { assert.equal(entitlement('MALE', null, { dailyStarts: 3, seeLikes: false }).dailyStarts, 3); assert.equal(entitlement('FEMALE', null, { dailyStarts: -1, seeLikes: true }).dailyStarts, -1); assert.equal(entitlement('MALE', new Date(Date.now() + 100000), { dailyStarts: 3, seeLikes: false }).seeLikes, true); assert.equal(entitlement('MALE', new Date(0), { dailyStarts: 3, seeLikes: false }).seeLikes, false); assert.equal(entitlement('MALE', null, { dailyStarts: 3, seeLikes: false }).unlimitedSwipes, true); });
test('Distance handles missing consent', () => { assert.equal(distanceKm({ latitude: null, longitude: null }, { latitude: 1, longitude: 2 }), null); assert.equal(distanceKm({ latitude: 1, longitude: 2 }, { latitude: 1, longitude: 2 }), 0); });
test('Profile rejects minors and reversed range', () => { const p = { displayName: 'Test', birthDate: '2015-01-01', gender: 'MALE', interestedIn: ['FEMALE'], bio: '', city: 'Berlin', country: 'Germany', languages: ['en'], interests: [], goal: 'DATING', visible: true, minAge: 18, maxAge: 60, maxDistance: 500, latitude: null, longitude: null, terms: true }; assert.equal(profileSchema.safeParse(p).success, false); assert.equal(profileSchema.safeParse({ ...p, birthDate: '1995-01-01' }).success, true); assert.equal(profileSchema.safeParse({ ...p, birthDate: '1995-01-01', minAge: 40, maxAge: 20 }).success, false); });
