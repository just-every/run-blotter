# Stripe invoice collections

Configure the merchant account's `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` as private Worker bindings. Register the merchant's event endpoint at `/api/blotter/stripe/events`. The connector pins Stripe API `2026-09-30.endive` and uses `allowed_payment_method_types`. Payment instruments are entered on Stripe's hosted Checkout, never stored in Blotter.

An issued invoice's payment panel creates a card or US bank payment link for a selected USD amount. The invoice portal requires an unticked payment confirmation. Saving a method requires a second, separate consent describing the exact invoice and total collection cap. The current billing contact and its revision must still authorize the invoice link. The invoice link does not verify personal identity.

The adopted conservative consent boundary is one invoice, a cumulative USD cap, explicit staff initiation by a principal or financial-authority holder with fresh confirmation, and no scheduled debit. Refunds do not replenish the authorization cap. Revoke from the invoice portal or the staff payment panel; revocation ends subsequent collection authority. Restored saved methods remain held without provider instrument references. This boundary remains subject to ct approval under PAY-001 and BILL-004.

Quick collect reserves the remaining invoice balance atomically, rechecks the mandate and the actor's live authority, and uses a stable provider idempotency key. Pending or unresolved attempts reserve their amount until reconciled. An uncertain provider result is held for investigation. It never creates an automatic retry.

Reconcile retrieves the current PaymentIntent and charge from Stripe. Signed event delivery verifies the exact request body and a five-minute signature timestamp. Event identifiers deduplicate replay; changing an existing event's body is refused. An older event cannot restore a pre-refund balance because the current authenticated provider object controls the projection. Concurrent observations compare the payment revision in the same transaction.

Only settled net receipts discharge balances. Partial refunds subtract from receipts; disputes and returned debits reopen balances. Pending ACH remains distinct from settlement and follows the firm's existing file-release policy. A return relocks a payment-gated deliverable. Statements use the latest observation at their firm-local day end. Payments, failures and refunds retain their actor, time and provider reference in the invoice's client history; failed collections stay with the invoice's owner and due condition.

Payment amounts and observations join retained billing evidence. Saved authorities and event references join link records. Erasure lists observed Stripe copies; provider retention is not claimed to have ended. Invoice retention clocks advance with payment observations. Restores retain accounting without reactivating payment authority or replaying provider writes.

Payment settlement, refund, failure and return events notify the current invoice owner in app by default. Personal email opt-in, quiet hours, current client access and stable event identity govern delivery; summaries expose no client content or provider identifiers. The payment journeys also trace request email, portal upload, reviewer acceptance and sign-off into the same attributed payment history.

The committed public-door flows are in `tests/blotter/payments.test.mjs`; the optional browser journey is `tests/blotter/payment-ui.mjs`. The explicitly invoked sandbox journey is `tests/blotter/payments-live.mjs`, run locally through the held-key injector and heavy slot. It accepts only a test key and keeps provider request identifiers in its output. It and `tests/blotter/payments-ach-live.mjs` are excluded from ordinary tests and Verify. The ACH journey uses Stripe’s published processing, successful and insufficient-funds test bank accounts through hosted Checkout, checks actual provider events and file access, and records truthful retained test objects.

Still unproved: settled live-sandbox ACH and ACH return, recurring and due-date collection authorization, incumbent method reauthorization tracking, complete provider-record erasure and expiry activation evidence. The held US test account accepted a USD bank Checkout session on 26 October 2026; a disabled ACH account is not the current blocker.

API semantics follow [Stripe's payment-method migration guidance](https://docs.stripe.com/payments/payment-methods/dynamic-payment-methods) and [Stripe's test methods](https://docs.stripe.com/testing).
