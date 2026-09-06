import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { locales } from '../packages/shared/validation';
test('All 11 locale files contain every UI key with nonempty translations', () => { const root = 'apps/web/src/locales/'; const en = JSON.parse(readFileSync(root + 'en.json', 'utf8')); assert.equal(readdirSync(root).filter(f => f.endsWith('.json')).length, 11); for (const locale of locales) {
    const pack = JSON.parse(readFileSync(root + locale + '.json', 'utf8'));
    assert.deepEqual(Object.keys(pack).sort(), Object.keys(en).sort(), locale);
    for (const [k, v] of Object.entries(pack))
        assert.ok(typeof v === 'string' && v.trim(), `${locale}:${k}`);
} });
