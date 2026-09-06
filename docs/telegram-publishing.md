# انتشار Telegram Mini App

1. در تلگرام ربات رسمی **@BotFather** را باز کنید و `/newbot` را بزنید. نام و username بدهید و Token را فقط در `TELEGRAM_BOT_TOKEN` بک‌اند نگه دارید.
2. فرانت‌اند و بک‌اند را با HTTPS طبق `deployment.md` بالا بیاورید. لینک localhost برای انتشار عمومی کافی نیست.
3. یک مقدار تصادفی قوی برای `TELEGRAM_WEBHOOK_SECRET` بسازید؛ فقط حروف، عدد، `_` و `-`، دست‌کم 32 کاراکتر. مثال دستور تولید: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. خروجی را در `.env` قرار دهید و منتشر نکنید.
4. `TELEGRAM_WEBAPP_URL`، `PUBLIC_API_URL` و `SUPPORT_URL` را تنظیم کنید. URL API بدون `/api/v1` است؛ اسکریپت آن را اضافه می‌کند.
5. `npm run bot:setup` را اجرا کنید. این دستور **تنظیمات ربات واقعی شما را تغییر می‌دهد**: Webhook، منوی Open Vela و فرمان‌های start/terms/privacy/support/paysupport. در این تحویل اجرا نشده است.
6. در BotFather از `/mybots`، ربات را انتخاب کنید و در **Bot Settings → Configure Mini App → Enable Mini App** آدرس HTTPS برنامه را ثبت کنید. نام منوها ممکن است با نسخه تلگرام تغییر کند. برای ساخت لینک نام‌دار Mini App می‌توانید جریان `/newapp` را نیز دنبال کنید. برای Menu Button از تنظیمات Menu Button یا `/setmenubutton` استفاده کنید؛ اسکریپت بالا این بخش را تنظیم می‌کند.
7. برای Mini App معمولی، `/setdomain` مربوط به Telegram Login Widget را جایگزین ثبت Web App URL نکنید. این پروژه از initData مینی‌اپ استفاده می‌کند، نه Login Widget.
8. ربات را باز کنید، `/start` بفرستید و Open Vela را بزنید. بعد از ورود، تاریخ تولد، رضایت، مشخصات و عکس را ثبت کنید. عکس واقعی را با حساب Admin تأیید کنید.
9. اعلان Telegram به رضایت کاربر و مجوز پیام‌دادن ربات وابسته است. بلاک‌کردن Bot توسط کاربر ارسال اعلان را متوقف می‌کند.

## تست ضروری روی تلگرام

- Android، iOS، Desktop و Telegram Web؛ فونت/RTL، کیبورد، Safe Area، ارسال تصویر.
- ورود، خروج، ورود مجدد همان حساب؛ تغییر حساب فعال باید در خود Telegram انجام شود.
- داده ورود کهنه باید باعث درخواست بازکردن مجدد Mini App شود.
- دو حساب واقعیِ رضایت‌داده‌شده برای تست Like/Match/Chat/Block.
- سه شروع گفتگو و درخواست چهارم؛ پاسخ در گفتگوی موجود.
- خرید Stars در محیط تست، لغو و webhook تکراری؛ سپس یک خرید کم‌مقدار واقعی بعد از تأیید مالک.
- `/paysupport` باید به پشتیبانی واقعی اپراتور برسد؛ این فرمان صرفاً آدرس تنظیم‌شده پشتیبانی را نمایش می‌دهد.

## Stars

اشتراک درون تلگرام کالای دیجیتال است؛ `XTR` استفاده می‌شود. پلن‌های ۷، ۳۰ و ۹۰روزه این نسخه **خرید یک‌باره** هستند؛ پارامتر اشتراک دوره‌ای Telegram ارسال نمی‌شود. بازگشت openInvoice با وضعیت paid برای فعال‌سازی کافی نیست؛ تنها successful_payment معتبر از Webhook این کار را می‌کند.

تست Bot API با `TELEGRAM_TEST_ENV=true` باید همراه Bot token و حساب‌های **محیط آزمایشی Telegram** باشد؛ این متغیر به‌تنهایی توکن Production را به توکن تست تبدیل نمی‌کند. محیط‌های تست و اصلی را جدا نگه دارید.

منابع رسمی، بررسی‌شده هنگام تهیه این پروژه:

- https://core.telegram.org/bots/webapps
- https://core.telegram.org/bots/payments-stars
- https://core.telegram.org/bots/features#botfather

هیچ ربات، دامنه یا پرداختی از طرف شما در این گفتگو ثبت یا اجرا نشده است.
