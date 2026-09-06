import { test } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { databaseHarness } from './database-harness';
import { useTestDatabase } from '../apps/api/src/db';
import { upload, saveFilters, storage } from '../apps/api/src/profiles';
import { storageFailure } from '../apps/api/src/storage-errors';
import { filterSchema } from '../packages/shared/validation';

test('Upload transforms a real image and saves private metadata; filters preserve profile fields', async () => {
    process.env.NODE_ENV = 'test';
    const h = await databaseHarness(); useTestDatabase(h.client);
    const original = global.fetch;
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'server-test-key';
    process.env.SUPABASE_STORAGE_BUCKET = 'dating-app-photos';
    const requests: string[] = [];
    global.fetch = async (input) => { requests.push(String(input)); return new Response(JSON.stringify({ Key: 'ok' }), { status: 200, headers: { 'Content-Type': 'application/json' } }); };
    try {
        const u = await h.client.user.create({ data: { telegramId: '333', firstName: 'Adult' } });
        const filters = { interestedIn: ['OTHER'], minAge: 18, maxAge: 60, maxDistance: 100, latitude: null, longitude: null, filterLanguages: [], filterInterests: [], filterGoal: null };
        await h.client.profile.create({ data: { userId: u.id, displayName: 'Adult', birthDate: new Date('1990-01-01'), gender: 'OTHER', city: 'City', country: 'Country', languages: ['en'], interests: ['Music'], fetish: 'Private', ...filters } });
        const buffer = await sharp({ create: { width: 2200, height: 1100, channels: 3, background: '#4488aa' } }).jpeg().toBuffer();
        const photo = await upload(u.id, { buffer, size: buffer.length } as Express.Multer.File, 'PROFILE');
        assert.equal(photo.status, 'PENDING'); assert.equal(photo.userId, u.id);
        assert.ok(photo.path.endsWith('.webp'));
        assert.ok(requests[0].includes('/storage/v1/object/dating-app-photos/'));
        await assert.rejects(() => upload(u.id, { buffer: Buffer.from('not a photo'), size: 11 } as Express.Multer.File, 'PROFILE'));
        await saveFilters(u.id, { ...filters, minAge: 25, filterGoal: 'CASUAL' });
        const p = await h.client.profile.findUniqueOrThrow({ where: { userId: u.id } });
        assert.equal(p.minAge, 25); assert.equal(p.filterGoal, 'CASUAL');
        assert.equal(p.displayName, 'Adult'); assert.equal(p.fetish, 'Private'); assert.deepEqual(p.interests, ['Music']);
        assert.equal(filterSchema.safeParse({ ...filters, displayName: 'Overwrite' }).success, false);
        assert.equal(filterSchema.safeParse({ ...filters, minAge: 50, maxAge: 20 }).success, false);
        global.fetch = async () => new Response(JSON.stringify({ statusCode: '403', message: 'Unauthorized', error: 'Forbidden' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
        await assert.rejects(() => upload(u.id, { buffer, size: buffer.length } as Express.Multer.File, 'PROFILE'), (error: any) => error.getResponse().code === 'STORAGE_ACCESS_DENIED');
        assert.equal(await h.client.photo.count(), 1);
    } finally { global.fetch = original; await h.close(); }
});
test('Storage configuration and bucket errors are actionable without raw secrets', () => {
    process.env.SUPABASE_URL = 'postgresql://private:secret@host/db';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test';
    assert.throws(() => storage(), (e: any) => e.getResponse().code === 'STORAGE_CONFIG_INVALID');
    assert.throws(() => storageFailure({ statusCode: '404', message: 'Bucket not found' }), (e: any) => e.getResponse().code === 'STORAGE_BUCKET_MISSING');
});
