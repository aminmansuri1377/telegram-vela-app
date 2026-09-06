# Security and privacy review

## Implemented controls

Telegram HMAC validation uses constant-time hash comparison, a 5-minute auth_date window and future-date bounds. Duplicate fields are rejected. First-use initData is bound to a random HttpOnly browser launch cookie, enabling logout/relogin on that same browser while rejecting reuse without the binding. Seven-day random sessions are stored hashed; there is no JWT in localStorage. API writes require exact Origin plus session CSRF. All parameters use Zod and Prisma's parameterized queries. User content is rendered as text, not HTML.

The discovery projection excludes Telegram identity, raw coordinates, date of birth and session data. Location is rounded to two decimal places on the client and server; public distance is rounded to 5 km. Like and match creation use ordered user locks and database uniqueness. Message creation and daily quota update are atomic. Every message/history action validates membership and blocks. Admin requires DB role and Telegram-ID allowlist, with audit entries on changes.

Upload limit 5 MB; sharp decodes content, checks format, rejects animation, bounds decoded pixels and re-encodes WebP stripping original metadata. Original bytes are never stored. New profile images require manual approval. Chat images are not pre-moderated and should be reported by recipients. Private Supabase Storage uses signed read URLs valid for five minutes. A recipient with a signed URL can share it until expiration; this is not DRM.

Stars settlement verifies payload, amount, currency, Telegram payer and unique charge. Duration/amount are snapshotted when invoice is created. Refund of a paid invoice for a deleted/banned account is queued; ordinary discretionary refunds require operator handling. Financial records lose the user foreign key on deletion but retain charge identifiers: these are **pseudonymized**, not guaranteed anonymous against Telegram records.

## Threats and residual risks

| Threat | Control | Remaining work |
|---|---|---|
| Forged Telegram user | HMAC, timestamp, replay binding | Test real mobile launch/relaunch |
| IDOR | Per-resource owner/member checks | Independent penetration test |
| XSS/CSRF | Text rendering, HttpOnly, Origin + CSRF | Review hosting CSP, dependency audit |
| Spam/multiple accounts | Redis per-user/IP rates, block/report | Telegram login is not identity/age verification |
| Minors | Birthdate validation, reporting, manual photos | Operator age assurance and jurisdiction review |
| Stolen location | Approximate coordinates, private projection | Prevent location inference from repeated queries |
| Duplicate purchase | Unique charge, locking, idempotency | Real Stars retries/refunds/reconciliation drill |
| Race conditions | Canonical row locks, transaction, uniqueness | Multi-connection PostgreSQL stress testing |
| Moderation abuse | Admin role + allowlist + audit | Human operations, appeal workflow |
| Data erasure | Cascades + durable media deletion queue | Operator backup and financial retention policy |

Redis is mandatory in production; development may use process-local rate limits. Single API replica only until Socket.IO Redis pub/sub is installed. HTTP rate limits must use correctly trusted reverse-proxy hops; never trust arbitrary forwarded IPs. Log entries omit bodies, secrets and database URLs. Monitor infrastructure logs independently.

## Launch gates

Do not publicly launch until legal/operator details, refunds, retention periods, moderation staffing, age checks, geographic restrictions, security review, backups and abuse escalation are approved. Gender-based entitlements and sensitive dating preferences require legal assessment in target markets. This document is an engineering checklist, not legal advice. No claims of GDPR certification, end-to-end encryption, screenshot prevention, fake-account elimination or identity verification are made.

AI features are intentionally disabled/not implemented in this MVP. Private messages are not forwarded to an AI provider. No API key placeholders imply otherwise.
