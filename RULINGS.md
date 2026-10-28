# Blotter rulings

### RL-1 — SIGN-002 Ruled

- Date: 2026-10-22
- Ruler: ct
- Governs: SIGN-002, SIGN-004, SIGN-005, SIGN-006, SIGN-007, SIGN-008, SIGN-009, SIGN-010, SIGN-011, SIGN-012

at consent and at signing, Blotter records the connection IP and user agent. Both appear on the certificate and are retained and erased with the signed record. For a document marked Form 2848 or 8821, a signer's signature is accepted only after a staff member records a remote-authentication attestation: the method (photo ID by selfie or video plus a secondary document, or personal knowledge), the verifier, the date and the items checked. The certificate states the form is electronically signed and may be submitted only online at IRS.gov/Submit2848. Staff representatives can be signers through their own session. A PDF whose text names Form 8879, 8879-S/PE/C/F or 8878 is refused for SIGN-001.

### RL-2 — BILL-002 Ruled

- Date: 2026-10-22
- Ruler: ct
- Governs: BILL-002, BILL-007, BILL-008, BILL-009, BILL-010, BILL-011, BILL-012, BILL-013, BILL-014, BILL-015

the principal or an ACCESS-002 financial-authority holder prepares, issues, sends and voids. Selecting the invoice authority and confirming retention expiry stay principal-only. A holder may enable automatic issue and send for one rule revision. The consent records a per-invoice USD cap, the recipient and a reason, and it is audited. Each run rechecks the consenter's live authority, the rule's terms and the recipient's billing role and email or portal consent. A run issues and sends only within the cap and with no exception. Otherwise it leaves a draft with a named exception. The invoice states 'auto-issued under rule revision N'. Delivery may be by email PDF to a billing contact without portal access. A restore brings rules back paused and without consent.

### RL-3 — ACCESS-002 Ruled

- Date: 2026-10-22
- Ruler: ct
- Governs: ACCESS-002, ACCESS-007, ACCESS-008, ACCESS-009, ACCESS-010, ACCESS-011

the principal may grant named members two published permissions: 'manage access' and 'financial authority'. Each grant is audited and needs step-up. A holder can never grant itself, widen its own client scope or revoke the principal. Firm-wide financial reports open to financial-authority holders for the clients they hold. Export, sensitive-administration and credential-reveal step-up applies from installation, whether or not scopes are configured.

### RL-4 — AI-001 Approved processing boundary

- Date: 2026-10-25
- Ruler: ct
- Governs: AI-001, AI-004, AI-005, AI-006

Firm-owner enablement is off by default and requires a recorded provider no-training and no-retention attestation reference. Only an authorized staff member's explicit click may transmit selected source text, after masking tax identifiers, SSNs and bank numbers. Retain input hash and source identifiers rather than input content; record requester, source identifiers, provider, model, bytes and time once per request. Provider output persists only as a draft the person saves. The portal disclosure states that staff may use an AI provider on client documents.

### RL-5 — AI-002 Approved processing boundary

- Date: 2026-10-25
- Ruler: ct
- Governs: AI-002, AI-007, AI-008, AI-009, AI-010

Firm-owner enablement is off by default and requires a recorded provider no-training and no-retention attestation reference. Only an authorized staff member's explicit click may transmit selected source text, after masking tax identifiers, SSNs and bank numbers. Retain input hash and source identifiers rather than input content; record requester, source identifiers, provider, model, bytes and time once per request. Provider output persists only as a draft the person saves. The portal disclosure states that staff may use an AI provider on client documents.

### RL-6 — NOTICE-001 Approved native boundary

- Date: 2026-10-25
- Ruler: ct
- Governs: NOTICE-001, NOTICE-003, NOTICE-004

The same owner enablement, attestation, masking, audit, saved-draft and explicit-click rules as AI-001 apply. Only the principal or a reviewer prepares or reads a notice draft. Every extraction carries an exact source quote and a proposed verification warning. A person accepts or rejects each question and plan step; acceptance never changes a deadline, sends, posts, files or contacts an agency. The practitioner uses the separate native notice and message doors to adopt verified values or send their selected question. Recorded native taxpayer authorizations appear locally for review and are excluded from model input.

### RL-101 — Invoice specific saved method authority

- Date: 2026-10-28
- Ruler: ct
- Governs: PAY-001, BILL-004
- Outcome: **adopt with rider** — Permit quick collect only against explicit current invoice specific consent and its remaining cumulative cap, after current financial authority and recipient revision checks; revocation and restore prevent another charge, while recurring/due date mandates remain separate required work.

**Question:** May the current invoice link consent authorize staff quick collection without a recurring mandate?

**Adopted/proposed default:** Separate invoice link consent; cumulative invoice cap; current billing contact revision; fresh financial-authority initiation; no scheduled debit; immediate revocation; restored authority held.

**Incumbent behavior and why:** Karbon supports saved method automatic collection and explicit cessation/re enablement after method removal. Stripe requires consent for the specific future use. No common norm was established for an invoice only cap or revision binding mechanism; this is the safer narrow authorization, not a claim that all Karbon mandates are invoice bound. The 22 October reminder consent and edit to pause ruling in BILL-004 remains in force.

**Single placement:** State the authority rule once in PAY-001; BILL-004 cites PAY-001 for quick collect and retains its existing reminder consent rider.

**Engineering/proof boundary:** No policy approval can prove recurring mandates, method migration, provider record erasure or expiry. Preserve every current Gap; neither row is promoted.

**Sources:**
- [Clients pay through the portal; saved details can autodraft due invoices.](https://karbonhq.com/feature/billing-and-payments)
- [Removing a saved method stops autopay; resumption requires manual re enablement.](https://help.karbonhq.com/en/articles/10292631-remove-and-update-payment-details-in-karbon-billing)
- [Saved methods require explicit consent for the disclosed future use.](https://docs.stripe.com/payments/save-during-payment)
