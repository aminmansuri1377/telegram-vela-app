export const base = import.meta.env.VITE_API_URL || '';
let csrf = '';
export const setCsrf = (s: string) => { csrf = s; };
export const getCsrf = () => csrf;
export class ApiError extends Error {
    constructor(public code: string, public status: number) { super(code); }
}
export async function api<T = any>(path: string, method = 'GET', body?: unknown): Promise<T> { const form = body instanceof FormData; const r = await fetch(`${base}/api/v1/${path}`, { method, credentials: 'include', headers: { ...(!form ? { 'content-type': 'application/json' } : {}), ...(method !== 'GET' ? { 'x-csrf-token': csrf } : {}) }, ...(body !== undefined ? { body: form ? body : JSON.stringify(body) } : {}) }); let data: any; try {
    data = await r.json();
}
catch {
    throw new ApiError('SERVER_ERROR', r.status);
} if (!r.ok)
    throw new ApiError(data.code || 'SERVER_ERROR', r.status); return data; }
