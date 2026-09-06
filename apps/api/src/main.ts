import 'reflect-metadata';
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { Module, Controller, Get, Post, Put, Delete, Body, Param, Query, Req, Res, Headers, UseInterceptors, UploadedFile, HttpException, Catch, ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule, ApiTags, ApiOperation } from '@nestjs/swagger';
import type { Request, Response, NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { Server } from 'socket.io';
import Redis from 'ioredis';
import { z, ZodError } from 'zod';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { db } from './db';
import * as auth from './auth';
import * as profiles from './profiles';
import * as social from './social';
import * as payments from './payments';
import * as admin from './admin';
import { fail } from './security';
import { uuid } from '../../../packages/shared/validation';
import { configureHostedEnv, webMiddleware, webCsp } from './hosting';
import { tick } from './worker';
let redis: Redis | undefined;
const localRates = new Map<string, {
    n: number;
    expires: number;
}>();
export async function rate(key: string, limit: number, seconds: number) { if (redis) {
    const n = await redis.eval("local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; return n", 1, `vela:${key}`, seconds) as number;
    if (n > limit)
        fail('RATE_LIMIT', 429);
}
else {
    const now = Date.now();
    for (const [k, v] of localRates)
        if (v.expires < now)
            localRates.delete(k);
    let v = localRates.get(key);
    if (!v) {
        v = { n: 0, expires: now + seconds * 1000 };
        localRates.set(key, v);
    }
    if (++v.n > limit)
        fail('RATE_LIMIT', 429);
} }
async function session(req: Request, write = false) { const s = await auth.requireSession(req, write); await rate(`user:${s.userId}`, 180, 60); return s; }
@Catch()
class Errors implements ExceptionFilter {
    catch(error: unknown, host: ArgumentsHost) { const res = host.switchToHttp().getResponse<Response>(); const req = host.switchToHttp().getRequest<Request>(); const status = error instanceof ZodError ? 400 : error instanceof HttpException ? error.getStatus() : 500; const response = error instanceof HttpException ? error.getResponse() : null; const code = error instanceof ZodError ? 'VALIDATION_ERROR' : typeof response === 'object' && response && 'code' in response ? response.code : 'SERVER_ERROR'; if (status >= 500)
        process.stderr.write(JSON.stringify({ event: 'request_failed', requestId: req.headers['x-request-id'], path: req.path, status }) + '\n'); res.status(status).json({ code, requestId: req.headers['x-request-id'], ...(error instanceof ZodError ? { fields: error.issues.map(x => ({ path: x.path.join('.'), code: x.code })) } : {}) }); }
}
@ApiTags('Vela')
@Controller('api/v1')
class Api {
    @Get('health')
    health() { return { ok: true }; }
    @Get('ready')
    async ready() { await db.$queryRaw `SELECT 1`; if (redis)
        await redis.ping(); return { ok: true }; }
    @Post('auth/telegram')
    @ApiOperation({ summary: 'Validate Telegram initData and create a cookie session' })
    login(
    @Body()
    body: unknown, 
    @Req()
    req: Request, 
    @Res({ passthrough: true })
    res: Response) { return auth.login(body, req, res); }
    @Post('auth/dev')
    dev(
    @Body()
    body: unknown, 
    @Req()
    req: Request, 
    @Res({ passthrough: true })
    res: Response) { return auth.devLogin(body, req, res); }
    @Get('auth/dev-users')
    async devUsers() { if (!auth.devEnabled())
        fail('NOT_FOUND', 404); return db.user.findMany({ where: { isTest: true, banned: false }, select: { telegramId: true, firstName: true, role: true }, orderBy: { telegramId: 'asc' } }); }
    @Post('auth/logout')
    logout(
    @Req()
    req: Request, 
    @Res({ passthrough: true })
    res: Response) { return auth.logout(req, res); }
    @Get('auth/me')
    async me(
    @Req()
    req: Request) { const s = await session(req); return { ...await profiles.me(s.userId), csrf: s.csrf }; }
    @Put('profile')
    async profile(
    @Req()
    req: Request, 
    @Body()
    b: unknown) { return profiles.saveProfile((await session(req, true)).userId, b); }
    @Put('settings')
    async settings(
    @Req()
    req: Request, 
    @Body()
    b: unknown) { return profiles.settings((await session(req, true)).userId, b); }
    @Delete('users/me')
    async deleteMe(
    @Req()
    req: Request, 
    @Body()
    b: unknown, 
    @Res({ passthrough: true })
    res: Response) { const s = await session(req, true); z.object({ confirm: z.literal('DELETE') }).parse(b); await profiles.deleteAccount(s.userId); res.clearCookie(auth.cookieName, { path: '/' }); return { ok: true }; }
    @Post('photos')
    @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 1 } }))
    async upload(
    @Req()
    req: Request, 
    @UploadedFile()
    file: Express.Multer.File, 
    @Body('purpose')
    purpose: string) { const s = await session(req, true); await rate(`upload:${s.userId}`, 20, 3600); return profiles.upload(s.userId, file, purpose || 'PROFILE'); }
    @Put('photos/order')
    async order(
    @Req()
    req: Request, 
    @Body()
    b: unknown) { return profiles.orderPhotos((await session(req, true)).userId, b); }
    @Delete('photos/:id')
    async removePhoto(
    @Req()
    req: Request, 
    @Param('id')
    id: string) { return profiles.removePhoto((await session(req, true)).userId, uuid.parse(id)); }
    @Get('discovery')
    async discover(
    @Req()
    req: Request, 
    @Query('cursor')
    cursor?: string) { return profiles.discovery((await session(req)).userId, cursor ? uuid.parse(cursor) : undefined); }
    @Post('swipes')
    async swipe(
    @Req()
    req: Request, 
    @Body()
    b: unknown) { return social.swipe((await session(req, true)).userId, b); }
    @Get('likes')
    async likes(
    @Req()
    req: Request) { return social.likes((await session(req)).userId); }
    @Get('conversations')
    async chats(
    @Req()
    req: Request) { return social.conversations((await session(req)).userId); }
    @Get('conversations/:id/messages')
    async messages(
    @Req()
    req: Request, 
    @Param('id')
    id: string, 
    @Query('cursor')
    cursor?: string) { return social.history((await session(req)).userId, uuid.parse(id), cursor ? uuid.parse(cursor) : undefined); }
    @Post('conversations/:id/messages')
    async send(
    @Req()
    req: Request, 
    @Param('id')
    id: string, 
    @Body()
    b: unknown) { const s = await session(req, true); await rate(`message:${s.userId}`, 40, 60); return social.sendMessage(s.userId, uuid.parse(id), b); }
    @Post('conversations/:id/read')
    async read(
    @Req()
    req: Request, 
    @Param('id')
    id: string) { return social.markRead((await session(req, true)).userId, uuid.parse(id)); }
    @Delete('conversations/:id')
    async unmatch(
    @Req()
    req: Request, 
    @Param('id')
    id: string) { return social.unmatch((await session(req, true)).userId, uuid.parse(id)); }
    @Post('blocks/:id')
    async block(
    @Req()
    req: Request, 
    @Param('id')
    id: string) { return social.block((await session(req, true)).userId, uuid.parse(id)); }
    @Delete('blocks/:id')
    async unblock(
    @Req()
    req: Request, 
    @Param('id')
    id: string) { await db.block.deleteMany({ where: { fromId: (await session(req, true)).userId, toId: uuid.parse(id) } }); return { ok: true }; }
    @Get('blocks')
    async blocks(
    @Req()
    req: Request) { return db.block.findMany({ where: { fromId: (await session(req)).userId }, select: { toId: true, to: { select: { firstName: true } } }, take: 100 }); }
    @Post('reports')
    async report(
    @Req()
    req: Request, 
    @Body()
    b: unknown) { return social.report((await session(req, true)).userId, b); }
    @Get('plans')
    plans() { return db.plan.findMany({ where: { active: true }, orderBy: { days: 'asc' } }); }
    @Post('payments/invoice')
    async invoice(
    @Req()
    req: Request, 
    @Body()
    b: unknown) { const s = await session(req, true); await rate(`invoice:${s.userId}`, 5, 60); return payments.invoice(s.userId, b); }
    @Get('payments')
    async paymentHistory(
    @Req()
    req: Request) { return db.paymentIntent.findMany({ where: { userId: (await session(req)).userId }, select: { id: true, planId: true, stars: true, status: true, createdAt: true, paidAt: true }, orderBy: { createdAt: 'desc' }, take: 50 }); }
    @Post('telegram/webhook')
    webhook(
    @Headers('x-telegram-bot-api-secret-token')
    secret: string, 
    @Body()
    b: unknown) { const expected = process.env.TELEGRAM_WEBHOOK_SECRET || ''; if (!expected || typeof secret !== 'string' || secret.length !== expected.length || !timingSafeEqual(Buffer.from(secret), Buffer.from(expected)))
        fail('FORBIDDEN', 403); return payments.webhook(b); }
    @Get('content/:key')
    async content(
    @Param('key')
    key: string) { return db.content.findUnique({ where: { key: key.slice(0, 40) } }); }
    @Get('admin/overview')
    async overview(
    @Req()
    req: Request) { admin.requireAdmin((await session(req)).user); return admin.overview(); }
    @Get('admin/:kind')
    async adminList(
    @Req()
    req: Request, 
    @Param('kind')
    kind: string, 
    @Query('q')
    q = '', 
    @Query('cursor')
    cursor?: string) { admin.requireAdmin((await session(req)).user); return admin.adminList(kind, q.slice(0, 80), cursor); }
    @Get('admin/photo/:id')
    async adminPhoto(
    @Req()
    req: Request, 
    @Param('id')
    id: string) { admin.requireAdmin((await session(req)).user); const photo = await db.photo.findUnique({ where: { id: uuid.parse(id) } }); if (!photo)
        fail('NOT_FOUND', 404); return { url: await profiles.photoUrl(photo) }; }
    @Put('admin/:kind/:id')
    async adminChange(
    @Req()
    req: Request, 
    @Param('kind')
    kind: string, 
    @Param('id')
    id: string, 
    @Body()
    b: unknown) { const s = await session(req, true); admin.requireAdmin(s.user); return admin.adminChange(s.userId, kind, id, b); }
}
@Module({ controllers: [Api] })
class AppModule {
}
export async function createApp() {
    configureHostedEnv();
    if (process.env.NODE_ENV === 'production') {
        for (const key of ['DATABASE_URL', 'REDIS_URL', 'FRONTEND_URL', 'TELEGRAM_BOT_TOKEN', 'TELEGRAM_WEBHOOK_SECRET'])
            if (!process.env[key])
                throw new Error(`Missing ${key}`);
        if (process.env.DEV_LOGIN_ENABLED === 'true')
            throw new Error('Dev login must be disabled');
        if (!process.env.FRONTEND_URL!.startsWith('https://'))
            throw new Error('HTTPS required');
    }
    if (process.env.REDIS_URL) {
        redis = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 1, lazyConnect: true });
        redis.on('error', () => { });
        await redis.connect();
    }
    const app = await NestFactory.create(AppModule, { logger: ['error', 'warn'] });
    app.getHttpAdapter().getInstance().set('trust proxy', Number(process.env.TRUST_PROXY || 0));
    app.use(helmet(process.env.SERVE_WEB === 'true' ? {
        frameguard: false,
        contentSecurityPolicy: { directives: webCsp },
    } : undefined));
    app.use(cookieParser());
    app.enableCors({ origin: process.env.FRONTEND_URL, credentials: true, allowedHeaders: ['content-type', 'x-csrf-token'] });
    app.useGlobalFilters(new Errors());
    app.use((req: Request, res: Response, next: NextFunction) => { req.headers['x-request-id'] = randomUUID(); res.setHeader('x-request-id', String(req.headers['x-request-id'])); res.setHeader('cache-control', 'no-store'); rate(`ip:${req.ip}`, 300, 60).then(() => next()).catch(() => res.status(429).json({ code: 'RATE_LIMIT' })); });
    if (process.env.SERVE_WEB === 'true') app.use(webMiddleware());
    const doc = SwaggerModule.createDocument(app, new DocumentBuilder().setTitle('Vela API').setVersion('1.0').addCookieAuth(auth.cookieName).build());
    if (process.env.NODE_ENV !== 'production')
        SwaggerModule.setup('api/docs', app, doc);
    const io = new Server(app.getHttpServer(), { cors: { origin: process.env.FRONTEND_URL, credentials: true }, maxHttpBufferSize: 4096 });
    io.use(async (socket, next) => { try {
        const cookies = Object.fromEntries((socket.handshake.headers.cookie || '').split(';').filter(Boolean).map(x => { const i = x.indexOf('='); return [x.slice(0, i).trim(), decodeURIComponent(x.slice(i + 1))]; }));
        const request = { cookies, headers: { origin: socket.handshake.headers.origin, 'x-csrf-token': socket.handshake.auth.csrf } } as unknown as Request;
        const s = await auth.requireSession(request, true);
        socket.data.request = request;
        socket.data.userId = s.userId;
        socket.data.expiresAt = s.expiresAt;
        await socket.join(s.userId);
        next();
    }
    catch {
        next(new Error('AUTH_REQUIRED'));
    } });
    io.on('connection', socket => { const check = setInterval(() => { auth.requireSession(socket.data.request, true).catch(() => socket.disconnect(true)); }, 15000); socket.on('disconnect', () => clearInterval(check)); socket.on('typing', async (raw: unknown) => { try {
        const { conversationId } = z.object({ conversationId: uuid }).parse(raw);
        const s = await auth.requireSession(socket.data.request, true);
        await rate(`typing:${s.userId}`, 20, 10);
        const c = await social.member(db, s.userId, conversationId);
        socket.to(c.aId === s.userId ? c.bId : c.aId).emit('typing', { conversationId });
    }
    catch { /* No user or chat information is exposed on unauthorized events. */ } }); });
    social.events.emit = (ids, event, payload) => { for (const id of ids)
        io.to(id).emit(event, payload); };
    app.enableShutdownHooks();
    let workerBusy = false;
    const workerTimer = process.env.OUTBOX_IN_PROCESS === 'true' ? setInterval(async () => {
        if (workerBusy) return;
        workerBusy = true;
        try { await tick(); } catch { process.stderr.write('Outbox pass failed; will retry.\n'); }
        finally { workerBusy = false; }
    }, 5000) : undefined;
    workerTimer?.unref();
    return { app, doc, io, close: async () => { if (workerTimer) clearInterval(workerTimer); io.close(); if (redis)
            await redis.quit(); await app.close(); await db.$disconnect(); } };
}
if (require.main === module)
    createApp().then(({ app }) => app.listen(Number(process.env.PORT || 3001), '0.0.0.0')).catch(() => { process.stderr.write('Startup failed. Check server configuration and database/Redis availability.\n'); process.exitCode = 1; });
