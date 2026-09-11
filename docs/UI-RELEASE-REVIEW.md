# Kisser UI review — 2026-09-11

Base: 53ff9bfba90c0424725ff4e260e7f7ed3110a0fa.

Fixed: synthetic/fallback avatar stretching and minimum height in chat and inbox;
long-name overflow; chat viewport/composer layout; message flex shrinking;
vertical gestures causing swipes; nested controls triggering keyboard swipes;
empty-discovery filter button routing; failed portrait fallback; conversation-local
state leaking across chat changes; input edits being cleared by an in-flight send;
dialog labelling, attachment keyboard focus and reduced-motion support.

Verification: 36 existing automated tests pass (including PGlite database-backed
service tests, mocked storage with real image conversion, payment validation,
access control, demo restrictions and locale coverage). Typecheck, ESLint and
frontend/backend production builds pass. No database migration is needed.

This is not certification that the entire service is ready for public production.
Browser visual tests were blocked: the Playwright Chromium download failed.
The following require a release test inside Telegram on Android and iOS:

- Real photo, synthetic photo and missing photo: circular 44px chat avatar and
  60px inbox avatar, including long Persian/English display names.
- At 320/390px width, Persian/Arabic RTL and English LTR: no horizontal overflow;
  open/close keyboard, send a message, attach a photo, scroll history, close chat.
- Discovery: vertical scroll does not swipe; horizontal swipe does; empty-state
  filters open filters; nested photo controls do not trigger a keyboard swipe.
- Login/logout/relogin, profile save/upload/delete, match, two-account chat,
  block/report, account deletion and session expiry against the deployed backend.
- Test Stars invoice, pre-checkout response, successful payment, duplicate delivery,
  refund/support handling and subscription expiry with Telegram itself.

Before public launch: replace draft terms/privacy text, rotate previously shared
credentials, disable demo/dev access, verify moderation operations and database
restore, and run concurrency/load checks on the intended hosting tier. Check
webhook/worker latency after hosting inactivity; passing local tests does not
establish availability or Telegram payment responsiveness.

Apply from repository root:

    git apply --check vela-ui-release-fixes.patch
    git apply vela-ui-release-fixes.patch
    npm run typecheck
    npm run lint
    npm test
    npm run build

Commit and push the changed files, then verify Render deploys that commit.
Rollback before committing: git apply -R vela-ui-release-fixes.patch.
