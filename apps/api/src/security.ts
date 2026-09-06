import { createHmac, createHash, timingSafeEqual, randomBytes } from 'node:crypto';
import { HttpException } from '@nestjs/common';
import { z } from 'zod';
export function fail(code: string, status = 400): never { throw new HttpException({ code }, status); }
export const digest = (s: string) => createHash('sha256').update(s).digest('hex');
export const randomToken = () => randomBytes(32).toString('hex');
export function validateTelegram(raw: string, token: string, now = Math.floor(Date.now() / 1000)) {
    if (!token)
        fail('TELEGRAM_NOT_CONFIGURED', 503);
    const params = new URLSearchParams(raw), hash = params.get('hash') || '';
    if ([...params.keys()].length !== new Set(params.keys()).size || !/^[a-f0-9]{64}$/i.test(hash))
        fail('AUTH_INVALID', 401);
    params.delete('hash');
    const check = [...params.entries()].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([k, v]) => `${k}=${v}`).join('\n');
    const secret = createHmac('sha256', 'WebAppData').update(token).digest();
    const expected = createHmac('sha256', secret).update(check).digest();
    if (!timingSafeEqual(expected, Buffer.from(hash, 'hex')))
        fail('AUTH_INVALID', 401);
    const date = Number(params.get('auth_date'));
    if (!Number.isInteger(date) || now - date > 300 || date - now > 30)
        fail('AUTH_EXPIRED', 401);
    let parsed: unknown;
    try {
        parsed = JSON.parse(params.get('user') || 'null');
    }
    catch {
        fail('AUTH_INVALID', 401);
    }
    const result = z.object({ id: z.number().int().positive().safe(), first_name: z.string().max(256), username: z.string().max(64).optional(), language_code: z.string().optional(), allows_write_to_pm: z.boolean().optional() }).safeParse(parsed);
    if (!result.success)
        fail('AUTH_INVALID', 401);
    return { user: result.data, replay: digest(raw) };
}
