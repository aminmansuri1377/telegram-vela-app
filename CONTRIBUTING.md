# Development

Use Node 22+ and npm ci. Keep the lockfile. Run typecheck, lint, test and build before changes are accepted. Shared validation lives in packages/shared; authorization belongs in backend services, not only UI. Maintain every locale key in all 11 JSON files. Add a new SQL migration for schema changes; do not edit an already-applied migration. Never commit .env, session tokens, Telegram tokens or Supabase keys.

Tests use an isolated in-memory PostgreSQL/PGlite adapter. Test-database injection requires NODE_ENV=test. Real PostgreSQL multi-connection tests, browser E2E and real Telegram acceptance must run separately before production releases. Never point test scripts or seed at the production database.
