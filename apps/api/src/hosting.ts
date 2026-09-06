import type { Request, Response, NextFunction } from 'express';
import express from 'express';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

export function configureHostedEnv(env: NodeJS.ProcessEnv = process.env) {
    if (env.SERVE_WEB !== 'true') return;
    const raw = env.FRONTEND_URL || env.RENDER_EXTERNAL_URL;
    if (!raw) throw new Error('FRONTEND_URL or RENDER_EXTERNAL_URL is required');
    const url = new URL(raw);
    if (env.NODE_ENV === 'production' && url.protocol !== 'https:') throw new Error('HTTPS required');
    env.FRONTEND_URL = url.origin;
    env.TELEGRAM_WEBAPP_URL ||= url.origin;
    env.PUBLIC_API_URL ||= url.origin;
}

export function isFrontendRequest(method: string, path: string) {
    return ['GET', 'HEAD'].includes(method) && !/^\/(api|socket\.io)(\/|$)/.test(path);
}

export function webMiddleware(root = resolve(process.cwd(), 'dist/web')) {
    if (!existsSync(resolve(root, 'index.html'))) throw new Error('Build the frontend before SERVE_WEB=true');
    const assets = express.static(root, { index: false, dotfiles: 'deny', fallthrough: true });
    return (req: Request, res: Response, next: NextFunction) => {
        if (!isFrontendRequest(req.method, req.path)) return next();
        assets(req, res, (error?: unknown) => {
            if (error) return next(error);
            // Missing assets must be 404, never an HTML response masquerading as JS/image.
            if (req.path.startsWith('/assets/') || /\.[a-z0-9]+$/i.test(req.path)) return next();
            res.sendFile(resolve(root, 'index.html'));
        });
    };
}

export const webCsp = {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", 'https://telegram.org'],
    styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
    fontSrc: ["'self'", 'https://fonts.gstatic.com'],
    imgSrc: ["'self'", 'https://*.supabase.co', 'data:', 'blob:'],
    connectSrc: ["'self'", 'wss:'],
    frameAncestors: ['https://web.telegram.org', 'https://*.telegram.org'],
    baseUri: ["'self'"],
    formAction: ["'self'"],
};
