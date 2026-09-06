# استقرار فرانت‌اند و بک‌اند

## مسیر پیشنهادی: یک VPS + دامنه HTTPS + Supabase

یک دامنه مانند `dating.example.com` تهیه کنید و رکورد DNS آن را به VPS وصل کنید. پورت‌های عمومی فقط 80 و 443 باشند. پورت 3001، Redis و PostgreSQL را عمومی نکنید.

روی VPS، Node.js 22+ و Docker/Compose نصب کنید. سورس را منتقل کنید و `.env` را با دسترسی محدود ایجاد کنید. مقدارها:

```dotenv
NODE_ENV=production
DEV_LOGIN_ENABLED=false
VITE_DEV_LOGIN_ENABLED=false
APP_DOMAIN=dating.example.com
FRONTEND_URL=https://dating.example.com
TELEGRAM_WEBAPP_URL=https://dating.example.com
PUBLIC_API_URL=https://dating.example.com
VITE_API_URL=
```

مقادیر واقعی DATABASE_URL، DIRECT_URL، SUPABASE_URL، کلید Storage، Bot token، Webhook secret و SUPPORT_URL را فقط در همین فایل یا Secret Manager وارد کنید. `TELEGRAM_TEST_ENV=false` در انتشار اصلی. Admin Telegram IDها را با کامای انگلیسی جدا کنید.

```bash
npm ci
npm run db:generate
npm run typecheck
npm run lint
npm test
npm run build
npm run db:migrate
node --import tsx scripts/init-production.ts
docker compose -f docker-compose.production.yml up -d --build
```

`db:migrate` فقط پس از بکاپ، بررسی SQL و اطمینان از دیتابیس مقصد اجرا شود. `db:seed` را روی Production اجرا نکنید. Compose تولید از Supabase استفاده می‌کند و دیتابیس داخلی نمی‌سازد. Caddy فایل‌های `dist/web` را سرو می‌کند، HTTPS می‌گیرد و `/api/*` و `/socket.io/*` را به بک‌اند هدایت می‌کند. فایل‌های فرانت‌اند باید با `npm run build` روی میزبان تولید شده باشند؛ مسیر volume در Compose همین `dist/web` است.

بررسی کنید:

```bash
curl https://dating.example.com/api/v1/health
curl https://dating.example.com/api/v1/ready
```

ردیابی خطاها:

```bash
docker compose -f docker-compose.production.yml logs --tail=100 api worker
```

پس از اولین ورود مدیر با Telegram، دوباره `node --import tsx scripts/init-production.ts` را با `.env` تولید اجرا کنید تا حساب موجود در Allowlist به ADMIN ارتقا پیدا کند. مجوز Admin هم Role و هم Allowlist را بررسی می‌کند.

## میزبانی جداگانه

Backend نیاز به یک پردازه Node همیشه فعال و WebSocket دارد. آن را روی سرویس container/VPS قرار دهید؛ worker را پردازه جدا اجرا کنید. برای این نسخه یک Replica بک‌اند نگه دارید؛ انتشار Socket.IO بین چند Replica هنوز Redis adapter ندارد.

برای فرانت‌اند Vercel/Cloudflare Pages می‌توان `npm run db:generate && npm run build:web` و خروجی `dist/web` را تنظیم کرد. **دامنه‌های هم‌سایت** مثل `app.example.com` و `api.example.com` به کار ببرید و `VITE_API_URL=https://api.example.com` را قبل از Build تنظیم کنید. `FRONTEND_URL` در Backend باید دقیقاً آدرس فرانت‌اند بدون اسلش پایانی باشد. یا مسیرهای API و WebSocket را از یک دامنه پروکسی کنید. استفاده از دامنه‌های نامرتبط با Cookie `SameSite=Lax` پشتیبانی نمی‌شود؛ بی‌دلیل Cookie را ضعیف نکنید.

Vercel frontend جای میزبانی NestJS/worker دائمی نیست. برای CSP میزبانی جداگانه، آدرس API و WebSocket خود را به connect-src اضافه کنید. تصاویر به آدرس Supabase مشخص خودتان محدود شوند. تنظیم Caddy یک نقطه شروع است، نه سیاست جامع همه انواع هاست.

## عملیات و نگهداری

- از Database و Storage بکاپ مستقل داشته باشید؛ بازیابی را در محیط مجزا تمرین کنید.
- Worker باید همیشه اجرا شود؛ حذف عکس و اعلان‌ها از Outbox استفاده می‌کنند.
- retryهای Outbox را مانیتور کنید. اعلان ممکن است پس از شکست بین ارسال و ثبت نتیجه تکرار شود (at-least-once).
- Sessionها ۷ روز معتبرند؛ logout/revoke فوراً API را مسدود می‌کند. Socket بی‌اعتبار ظرف حداکثر ۱۵ ثانیه قطع می‌شود و محتوای پیام از Socket ارسال نمی‌شود.
- TLS، محدودیت فایل، ظرفیت دیتابیس، رشد Message، پاکسازی orphan uploadها، snapshotها و سیاست نگهداری مالی را پیش از لانچ بررسی کنید.
- بررسی امنیتی وابستگی‌ها و تست بار روی محیط واقعی لازم است؛ Docker در محیط تولیدکننده این فایل اجرا نشده است.
