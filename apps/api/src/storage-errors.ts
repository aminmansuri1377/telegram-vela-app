import { fail } from './security';
export function storageFailure(error: unknown): never {
    const e = error as { statusCode?: string | number; status?: number; message?: string; name?: string };
    const status = Number(e?.statusCode || e?.status || 0);
    const message = String(e?.message || '').toLowerCase();
    const code = message.includes('bucket') && (message.includes('not found') || message.includes('does not exist')) ? 'STORAGE_BUCKET_MISSING'
        : status === 401 || status === 403 || /jwt|signature|row.level|unauthorized|invalid.*key/.test(message) ? 'STORAGE_ACCESS_DENIED'
        : status === 413 || /maximum allowed size|too large/.test(message) ? 'IMAGE_TOO_LARGE'
        : /mime|content.type/.test(message) ? 'STORAGE_TYPE_REJECTED'
        : e?.name === 'TimeoutError' || e?.name === 'AbortError' || /fetch|network|timeout/.test(message) ? 'STORAGE_UNREACHABLE'
        : 'STORAGE_ERROR';
    // No raw messages, credentials, signed URLs or image contents in logs.
    console.error(JSON.stringify({ event: 'photo_storage_failed', code, status }));
    fail(code, code === 'IMAGE_TOO_LARGE' ? 413 : 503);
}
