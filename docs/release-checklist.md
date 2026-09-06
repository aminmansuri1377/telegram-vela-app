# Vela 0.1.0 — verification report

Prepared 2026-09-05. This is a functional MVP source release, not a certification of production readiness or absence of every possible defect.

## Render staging update — 2026-09-06

Added same-origin static frontend serving by Nest, Telegram-compatible frame/CSP configuration, optional in-process outbox scheduling, explicit opt-in migration startup, and a free Render web + Key Value Blueprint. Typecheck, lint and **31 tests** passed (the 27 baseline tests plus four hosting checks). Render provider validation/deployment, Supabase connection and Telegram testing remain blocked on account connections and operator secrets. No external deployment or database migration was executed. Background work pauses while a free service sleeps; this setup is for staging, not reliable public billing.

## Executed successfully

| Check | Result |
|---|---|
| Dependency installation | npm install succeeded; package-lock.json included |
| Backend TypeScript compilation | Passed |
| Frontend TypeScript compilation and Vite production build | Passed |
| Typecheck including tests and scripts | Passed |
| ESLint | Passed, zero errors |
| Node test runner | **27 tests passed, 0 failed, 0 skipped** (includes integration suite parent) |
| Initial migration SQL | Executed by embedded PostgreSQL/PGlite |
| Repeatable seed | Executed twice, still exactly 20 women + 10 men |
| Nest application initialization | Passed without opening a listening port |
| OpenAPI export | Generated from initialized Nest routes |
| Locale files | 11 files, identical nonempty key sets (174 keys per locale) |

## Tested behavior

Valid/forged/expired/future/duplicate-key Telegram authentication; adult birthdate validation; UTC date boundaries; policy/expiry; distance helper; repeated seed; mutual likes without duplicate matches; denied free-male likes; three starts allowed and fourth denied; idempotent message retries; continued chat replies; membership enforcement; cursor pagination without overlap; block enforcement; discovery exclusions/private field projection; photo ownership; server profile validation; Stars amount/payer validation and idempotent duration grant; premium unlock; CSRF and logout revocation; same-browser Telegram relogin and cross-browser replay rejection; admin role enforcement; production dev-login lockout; female starts beyond three; account cascades, detached payment ledger and media deletion outbox.

## Not executed / not claimed

- Real Telegram login on Android/iOS/Desktop/Web and actual Stars checkout/refund.
- Actual Supabase network connection, private bucket upload/sign/delete, or prisma migrate deploy against a hosted DB.
- Docker image/Compose startup on a real VPS.
- Live HTTP/browser/Playwright or screenshot-based visual QA; this runtime restricted opening test listeners. App initialization and service tests are not browser E2E tests.
- Multi-connection PostgreSQL races/load tests, Redis integration, distributed Socket.IO replicas, worker restart/failure drills.
- Security penetration test, live dependency vulnerability audit, native-speaker review, legal/age-assurance compliance signoff.

The embedded PostgreSQL harness uses a serialized driver adapter; it exercises actual Prisma services and SQL, but cannot prove behavior under genuinely simultaneous database connections. Real external providers require operator credentials and tests after deployment. No user-provided live secret was used or included.

## Scope differences from the original broad brief

Delivered: primary dating flows, manual profile-photo moderation, subscriptions with Stars, basic admin and reporting, 11 UI languages. Compact schema combines likes with swipes, matches with conversations, receipts with read timestamps, and membership with the payment ledger. A single npm root replaces pnpm/Turbo. REST errors use Zod codes; Swagger DTO expansion is partial. Chat waits for server success and supports text retry with idempotency rather than a full optimistic message outbox.

Not implemented: optional AI bio/translation/fake scoring, documentary identity/age verification, automatic image moderation, Undo/rematching, configurable plan-specific feature matrices (all paid plans share benefits), discretionary refund UI, full translation-management UI and automatic recurring billing. Terms/privacy templates are English drafts; local-language legal content can be entered through the content API/admin after operator review. Profile photos and chat photo tests with real storage remain required.

## Required before public release

Rotate the exposed database password; configure secrets; use an isolated staging database; verify migrations/backups; test Telegram and Stars in staging; review translated UI and legal documents; appoint moderation/payment support; enforce local minimum-age/consent rules; review gender-based access policy; test deletion/retention and signed URL expiry; run dependency/security/load and mobile accessibility tests.
