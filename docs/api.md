# REST API contract

Base: `/api/v1`. Generated route inventory: `openapi.json`, Swagger `/api/docs` in development. Cookie `vela_session` authenticates requests. All authenticated mutations require `Origin` equal to FRONTEND_URL and `x-csrf-token` from auth/me. Authentication endpoints require Origin but no existing CSRF token. Telegram webhook uses its own secret header.

| Method | Path | Body / query |
|---|---|---|
| GET | health, ready | Liveness / DB and Redis readiness |
| POST | auth/telegram | `{initData:string}` |
| POST | auth/dev | `{telegramId:"test-man-01"}`; development only |
| GET | auth/dev-users | Test account selector; development only |
| GET | auth/me | Current user, own profile/photos, entitlements and csrf |
| POST | auth/logout | Revokes session |
| PUT | profile | Full `profileSchema` in packages/shared/validation.ts |
| PUT | settings | `{locale?,notifications?}` |
| DELETE | users/me | `{confirm:"DELETE"}` |
| POST | photos | multipart: file, purpose PROFILE or CHAT |
| PUT | photos/order | `{ids:uuid[]}`; exact owned profile-photo set |
| DELETE | photos/:id | Owned profile photo only |
| GET | discovery | `cursor?` UUID; items plus nextCursor |
| POST | swipes | `{toId:uuid,kind:"LIKE" or "PASS"}` |
| GET | likes | Requires applicable entitlement; first 100 |
| GET | conversations | First 100 active matches |
| GET | conversations/:id/messages | `cursor?`; 40 descending messages |
| POST | conversations/:id/messages | `{body:string,photoId?:uuid,clientId:uuid}` |
| POST | conversations/:id/read | Advances reader timestamp |
| DELETE | conversations/:id | Unmatch |
| POST / DELETE | blocks/:id | Block / unblock; unblock does not rematch |
| GET | blocks | First 100 owned blocks |
| POST | reports | `{toId,reason,note}`; also blocks |
| GET | plans | Active plan prices/duration |
| POST | payments/invoice | `{planId:"BASIC" or "PREMIUM" or "VIP"}` |
| GET | payments | Latest 50 own payment intents |
| POST | telegram/webhook | Telegram Update + X-Telegram-Bot-Api-Secret-Token |
| GET | content/:key | terms/privacy/safety, optional `.locale` suffix |
| GET | admin/overview | Aggregate counters |
| GET | admin/:kind | users/reports/photos/payments/plans/policies/content/audit; `q`, `cursor` |
| GET | admin/photo/:id | Signed moderation preview |
| PUT | admin/:kind/:id | Strict per-kind payload; see apps/api/src/admin.ts |

## Message example

```json
{"body":"Hello!","clientId":"5eb628b1-b1b5-4e38-93b7-13957069c9f9"}
```

The same sender/clientId reuses the same message, and a conflicting conversation returns 409. Empty text requires an owned CHAT photo. Errors return `{code,requestId,fields?}`; common codes include AUTH_REQUIRED, CSRF_INVALID, DAILY_LIMIT, PREMIUM_REQUIRED, VALIDATION_ERROR, CHAT_UNAVAILABLE and RATE_LIMIT.

## Realtime

Socket.IO uses the session cookie plus handshake `auth.csrf`. Server events message/match/read invalidate browser queries; they do not carry private message text. Client typing `{conversationId}` is authorized and rate-limited. HTTP is the authoritative persistence path, with periodic refresh fallback. Expired/revoked sockets are periodically disconnected. Keep one API replica in this release.

OpenAPI currently documents routes and parameter inventory; shared Zod schemas and this contract are authoritative for request bodies. Not every DTO is fully expanded in Swagger yet. Discovery scans 200 candidates per page before ranking; global ranking and unlimited historical list pagination are future scaling work.
