# Stars settlement details

The approved currency is Telegram Stars (`XTR`), not TON. The frontend creates a PaymentIntent through Nest and opens a Bot API invoice. There are no TON keys, TON Connect widgets or direct-crypto subscription endpoints in this release.

1. A plan's stars and days are copied to a unique intent (30-minute checkout lifetime).
2. createInvoiceLink embeds that UUID as payload. A failed invoice request marks the intent failed.
3. pre_checkout_query verifies payer identity, currency, amount, pending state and expiry before approval.
4. successful_payment is accepted only through the secret-authenticated webhook. Under a user lock and intent lock, amount/payer/currency are checked, the unique charge is recorded and premiumUntil is extended from the later of now or current expiry.
5. Duplicate delivery of the same charge does not extend twice. Successful payment arriving after a pre-checkout timeout/intent expiry is still settled, because Telegram may have already accepted money.
6. If the account was deleted/banned before settlement, the charge is queued for refund rather than granting membership. Keep the worker running; test the refund workflow with real Telegram before launch.

Partial failures are not handled by trusting browser paid callbacks. The payment ledger shows pending/paid/expired/failed/refund states. Telegram retries unacknowledged webhook updates. For operator reconciliation after a prolonged outage, compare ledger charge IDs with Telegram getStarTransactions and investigate before making manual changes. Automated periodic import of the complete Telegram transaction history is not included.

Refund support is an operator responsibility. /paysupport directs users to SUPPORT_URL. General refunds and chargeback policy need an operator-run procedure; the admin UI does not issue arbitrary refunds in this MVP.

Official reference: https://core.telegram.org/bots/payments-stars
