# Kisser update (base commit 743e0f0)

This patch changes displayed product branding only. Repository, Render services,
URLs, storage bucket, package identity, cookies and existing browser preferences
keep their original identifiers. Re-run bot:setup to update the bot menu label;
BotFather's own bot name is not changed.

The new optional fetish field is limited to 300 characters, hidden from other
users by default, editable/clearable by its owner, and deleted with the profile.
Enabling the checkbox publishes it to eligible authenticated profile viewers.
CASUAL means casual dating / رابطه بدون تعهد; it does not imply consent.
A non-destructive migration adds the two columns to existing profiles.
The patch also repairs the misaligned keys in the ten non-English dictionaries.

Apply from the directory containing package.json (keep your .env local):

```sh
git apply --check vela-update.patch
git apply vela-update.patch
npm run db:generate
npm run db:migrate
node --import tsx scripts/init-production.ts
npm run typecheck
npm test
npm run build
```

Use the existing Supabase Session Pooler connection on port 5432 in DATABASE_URL
and DIRECT_URL. The initialization script now resolves .env relative to its own
project directory and uses DIRECT_URL when present. Existing shell environment
variables still take precedence. The old generic message does not establish the
root cause. If initialization still fails, report its new error code, never the
password/connection string. It reports known Prisma errors without raw secrets.

Only after cloud migration and initialization succeed, commit the changed source
and push to the existing repository; Render auto-deploys. No need to enable
APPLY_MIGRATIONS when the migration has already succeeded from your computer.
Then run npm run bot:setup with the existing Telegram secrets and hosted URLs.
Do not commit .env or this downloaded patch file. No cloud settings, secrets,
production records or Telegram configuration were changed while making this patch.
