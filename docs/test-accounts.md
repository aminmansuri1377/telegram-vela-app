# Development fixtures

Run `npm run db:seed` twice safely: it uses stable Telegram IDs and upserts. It never executes automatically in production and explicitly refuses NODE_ENV=production. Use a separate database for test users; the production Discovery query excludes isTest accounts and production dev login is disabled.

| Account | Role / scenario |
|---|---|
| test-man-01 / Adrian | Free male, 5 initial matches; 1 existing conversation, 4 not started |
| test-man-02 / Arman | Active premium for 30 days from first seed |
| test-man-03 / Leo | Expired subscription |
| test-man-10 / Wei | Development admin |
| test-woman-01 / Lina | Existing conversation with Adrian |
| test-woman-06 to 08 | Incoming likes for Adrian; like back to make a match |
| test-man-09 + test-woman-20 | Example block and fictional spam report |

All 20 women and 10 men can be selected in the development welcome screen. For two simultaneous users, use separate browser profiles/incognito sessions; one browser cookie jar has one active login. Logout retains the test account selection so the next test login defaults to the same account.

To test the quota, sign in as Adrian and message each of the four untouched matches. Three starts succeed; the fourth requires membership. Continue sending in an already-started conversation: no extra start is consumed. The seeded active-premium account is separate. No fake successful-payment endpoint is exposed.

Seed photos: six AI-generated fictional adult headshots reused across 30 records, shipped locally in one contact sheet. This is intentionally marked as test data, not a set of 30 real dating profiles. Seed bios are English user-generated-style text; changing app locale does not translate user messages or bios.
