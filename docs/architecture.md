# Vela architecture / معماری

Vela is an original 18+ dating Mini App, not a PURE clone. This release uses one npm workspace root (one reproducible lockfile), React/Vite, NestJS, Prisma/PostgreSQL, Redis, Socket.IO and private Supabase Storage. No hosted Site runtime is required: the deliverable is a portable source archive for a Node server, not a Cloudflare Worker. Native semantic components form the shared UI; no separate Turbo build layer is needed for two applications.

## Product decisions

- en, zh (Simplified), ru, hi, ur (Urdu), fa, ar, tr, es, de, it. Urdu, Persian and Arabic use RTL.
- Unlimited swipes. Free male users may initiate three previously untouched conversations per UTC day. Replies in an already-started conversation are free. Female and Other defaults are unlimited, editable through policy.
- Stars XTR one-time purchases grant 7, 30 or 90 days; these are not auto-renewing recurring Stars subscriptions. All plans grant the same benefits initially.
- Access to likes requires the applicable entitlement. Priority ordering never overrides safety exclusions.
- Private media, anonymous discovery responses, explicit approximate-location consent, 18+ birthdate check.
- Seed users are visibly fictional and exist only in development. No real identities or dating photos scraped from the internet.

## Boundaries

Browser → Nest REST /api/v1 → services → Prisma → Postgres. Socket.IO only delivers invalidation/typing/read hints; persistent messages always go through authenticated REST. Redis backs rate limits. A separate worker retries a durable PostgreSQL outbox for notifications and object deletion. Supabase service-role keys never reach the browser.

## Critical transactions

Canonical sorted user row locks serialize swipes, messages, blocking and deletion. Conversation creation has a unique ordered pair. Daily limits, first-message creation and idempotency are committed together. Payment intent snapshots amount/duration; a verified Telegram webhook atomically records a unique charge and extends entitlement. Cookie sessions are hashed in the database and revocable; mutation requests require exact allowed Origin and a session-bound CSRF token.

## Main flows

Welcome → language → Telegram validation → birthdate/terms/profile/photos → discovery → mutual like → chat. Settings allow profile edits, discovery pause, blocks, logout and two-stage deletion. Likes/Premium lead to a Stars invoice; only successful_payment activates access.

## Delivery scope

Real external flows require deployment credentials. Optional AI matching/translation and automated image moderation are not enabled; new real photos default to manual approval. See release-checklist.md for tested and untested capabilities before public launch.
