# Blotter rulings

### RL-1 — Inherited MSG-002 marketing consent (ct 20 Oct 21:21Z)

- Date: 2026-10-20
- Ruler: ct
- Governs: PORTAL-001

**Inherited MSG-002 marketing consent (ct 20 Oct 21:21Z):** Upload links never carry marketing.

### RL-2 — Receiving ERASURE-002 (ct 22 Oct 2026)

- Date: 2026-10-22
- Ruler: ct
- Governs: REVIEW-001

**Receiving ERASURE-002 (ct 22 Oct 2026):** Sign-offs stay immutable; ERASURE-002 retains signed-off work under its class and removes it only on confirmed expiry, keeping sign-off attribution.

### RL-3 — Inherited MSG-002 marketing consent (ct 20 Oct 21:21Z)

- Date: 2026-10-20
- Ruler: ct
- Governs: US-001

**Inherited MSG-002 marketing consent (ct 20 Oct 21:21Z):** The firm's US postal address appears on every marketing email, and a marketing send without it is refused.

### RL-4 — Implemented semantics (ct 19 Oct 12:58Z)

- Date: 2026-10-19
- Ruler: ct
- Governs: CRM-001, CRM-006

**Implemented semantics (ct 19 Oct 12:58Z):** an entity is an individual, business or trust; its responsible partner is an active reviewer or principal, its assigned team lists active staff, and services and a related owner/household client are recorded without granting job access.

### RL-5 — Inherited MSG-002 marketing consent (ct 20 Oct 21:21Z)

- Date: 2026-10-20
- Ruler: ct
- Governs: CRM-001, CRM-006

**Inherited MSG-002 marketing consent (ct 20 Oct 21:21Z):** Marketing grants are recorded per contact relationship, withdrawals apply to the address across the whole firm, and a marketing grant never restores email consent.

### RL-6 — Inherited MSG-002 marketing consent (ct 20 Oct 21:21Z)

- Date: 2026-10-20
- Ruler: ct
- Governs: CRM-003, CRM-007

**Inherited MSG-002 marketing consent (ct 20 Oct 21:21Z):** Bulk messages and their delivery, bounce, complaint and reply events file to each client's history under their class, engagement or marketing.

### RL-7 — Authority (ct 19 Oct 03:36Z)

- Date: 2026-10-19
- Ruler: ct
- Governs: CRM-004

**Authority (ct 19 Oct 03:36Z):** a merge of two clients with different non-empty EINs, or different non-empty contact emails, needs the principal's recorded authority reason (same entity; the surviving contact is authorized for both); reviewers merge only records whose EINs and contact emails agree or are blank; CRM-001 contacts and PORTAL-002 portal users add a per-contact check before they ship. Undo is available for 30 days while neither record has changed since the merge. 

### RL-8 — Inherited MSG-002 marketing consent (ct 20 Oct 21:21Z)

- Date: 2026-10-20
- Ruler: ct
- Governs: CRM-004

**Inherited MSG-002 marketing consent (ct 20 Oct 21:21Z):** Merging two contacts keeps the most restrictive marketing consent, and undo restores each side exactly. Implemented and asserted on MSG-002's doors (consent carriers journey, `tests/blotter/bulk-messages.test.mjs`); MSG-002 states the exact semantics.

### RL-9 — Public intake (CRM-005; ct 19 Oct 10:05Z)

- Date: 2026-10-19
- Ruler: ct
- Governs: CRM-005, CRM-008

**Public intake (CRM-005; ct 19 Oct 10:05Z):** `/intake` alone permits embedding (`frame-ancestors *`). A required consent line records that details go only to the practice to reply to this inquiry. Accepted forms create an Inquiry owned by the principal with lead source, requested services, free-text answers and an optional annual-budget band (not a quote), consent wording/time and up to three attachments of at most 1 MiB each. Spam checks are a honeypot, an installation-signed single-use form token valid from 3 seconds through 24 hours after issue, and at most five accepted submissions per connection in a rolling hour. Rejected submissions store no prospect, answers or uploads. Rate-limit IPs are kept only as installation-keyed digests with one-hour expiry, excluded from archives and cleared on accepted submissions and the hourly trigger; raw IPs are never stored. Turnstile runs only when the owner supplies both keys. Only the principal and reviewers read intake answers/uploads. Winning files the intake uploads on the client's onboarding work in the same batch without retaining a second copy of their bytes; the original intake links still resolve. Owner-confirmed attachment erasure follows ERASURE-001 and fences stale archives; intake prospects, answers, consent records and uploads inherit CRM target erasure and retention under ERASURE-002 before it ships. 

### RL-10 — Inherited before shipping (ct 19 Oct 10:28Z)

- Date: 2026-10-19
- Ruler: ct
- Governs: CRM-005, CRM-008

**Inherited before shipping (ct 19 Oct 10:28Z):** consult booking (INTEGRATE-005), proposal sending, accepted signed scope and signed documents (ENGAGE-001/INTEGRATE-004), and additional contacts (CRM-001) each connect to this idempotent win before shipping; no manual win claims a proposal was sent or signed. CRM-005 is done for the native pipeline and intake that exist today. 

### RL-11 — Inherited MSG-002 marketing consent (ct 20 Oct 21:21Z)

- Date: 2026-10-20
- Ruler: ct
- Governs: CRM-005, CRM-008

**Inherited MSG-002 marketing consent (ct 20 Oct 21:21Z):** The public intake form may offer only an optional, unticked marketing checkbox with its exact wording, separate from the reply consent; its grant follows the prospect's contact to the converted client. Implemented and asserted on MSG-002's doors (consent carriers journey, `tests/blotter/bulk-messages.test.mjs`); MSG-002 states the exact semantics.

### RL-12 — Inherited MSG-002 marketing consent (ct 20 Oct 21:21Z)

- Date: 2026-10-20
- Ruler: ct
- Governs: ENGAGE-001

**Inherited MSG-002 marketing consent (ct 20 Oct 21:21Z):** Marketing consent is never bundled into an engagement letter or signature, nor made a condition of service. 

### RL-13 — Receiving ERASURE-002 (ct 22 Oct 2026)

- Date: 2026-10-22
- Ruler: ct
- Governs: ENGAGE-001

**Receiving ERASURE-002 (ct 22 Oct 2026):** Before shipping, its signed letters and certificates join ERASURE-002's signed-engagement class with that clause's clock, holds, preview, receipt and fence, and its signing provider's copies are named outside copies; practitioner-recorded engagements keep their label (ct 22 Oct 2026).

### RL-14 — Receiving ERASURE-002 (ct 22 Oct 2026)

- Date: 2026-10-22
- Ruler: ct
- Governs: SIGN-001

**Receiving ERASURE-002 (ct 22 Oct 2026):** Its record is ERASURE-002's IRS e-file authorization class.

### RL-15 — Inherited MSG-002 marketing consent (ct 20 Oct 21:21Z)

- Date: 2026-10-20
- Ruler: ct
- Governs: SIGN-002

**Inherited MSG-002 marketing consent (ct 20 Oct 21:21Z):** Marketing consent is never bundled into a signature request, nor made a condition of service. 

### RL-16 — Receiving ERASURE-002 (ct 22 Oct 2026)

- Date: 2026-10-22
- Ruler: ct
- Governs: SIGN-002

**Receiving ERASURE-002 (ct 22 Oct 2026):** Before shipping, SIGN-002 adds its records and provider copies to ERASURE-002's classes, clocks, holds, preview, erasure, receipt and restore fence (ct 22 Oct 2026). 

### RL-17 — Native semantics (sx-blotter-c36/c37, 22 Oct; approved with change by ct, batch 11 H)

- Date: 2026-10-22
- Ruler: ct
- Governs: SIGN-002

**Native semantics (sx-blotter-c36/c37, 22 Oct; approved with change by ct, batch 11 H):** Staff with full job scope freeze the original valid unencrypted PDF, signer relationships, order and signature/initial/date/text field geometry, then explicitly send through existing entity/contact-bound portal links. Every contact signer must be active, authorized for the entity, a signer, portal-enabled and consented for requests/email; a staff representative signer is an active member or the principal who holds the client with working access. The portal exposes only that signer's fields and requires explicit document-specific ESIGN/UETA consent and intent, never marketing consent. Sequential signatures wait for every prior signer; parallel signatures can arrive in either order, with revision guards preventing lost updates. Decline records a reason; resending a declined or restored request starts a fresh attempt and preserves prior attempts. Voiding prevents further signatures. Completion flattens entered fields onto the original PDF and creates a separate downloadable certificate with order, name, contact/link id, consent wording/version, times and document hashes. It truthfully states typed electronic signatures and portal-possession authentication, not verified identity, KBA or a cryptographic digital signature. 

### RL-18 — Ruled (ct 22 Oct)

- Date: 2026-10-22
- Ruler: ct
- Governs: SIGN-002

**Ruled (ct 22 Oct):** at consent and at signing, Blotter records the connection IP and user agent. Both appear on the certificate and are retained and erased with the signed record. For a document marked Form 2848 or 8821, a signer's signature is accepted only after a staff member records a remote-authentication attestation: the method (photo ID by selfie or video plus a secondary document, or personal knowledge), the verifier, the date and the items checked. The certificate states the form is electronically signed and may be submitted only online at IRS.gov/Submit2848. Staff representatives can be signers through their own session. A PDF whose text names Form 8879, 8879-S/PE/C/F or 8878 is refused for SIGN-001. 

### RL-19 — Receiving ERASURE-002 (ct 22 Oct 2026)

- Date: 2026-10-22
- Ruler: ct
- Governs: MAIL-001

**Receiving ERASURE-002 (ct 22 Oct 2026):** Before shipping, MAIL-001 adds its records and provider copies to ERASURE-002's classes, clocks, holds, preview, erasure, receipt and restore fence (ct 22 Oct 2026).

### RL-20 — Receiving ERASURE-002 (ct 22 Oct 2026)

- Date: 2026-10-22
- Ruler: ct
- Governs: MAIL-002

**Receiving ERASURE-002 (ct 22 Oct 2026):** Before shipping, MAIL-002 adds its records and provider copies to ERASURE-002's classes, clocks, holds, preview, erasure, receipt and restore fence (ct 22 Oct 2026).

### RL-21 — Inherited MSG-002 marketing consent (ct 20 Oct 21:21Z)

- Date: 2026-10-20
- Ruler: ct
- Governs: MAIL-003

**Inherited MSG-002 marketing consent (ct 20 Oct 21:21Z):** Scheduled inbox sends are engagement class only, with MSG-002's send-time recheck. 

### RL-22 — Receiving ERASURE-002 (ct 22 Oct 2026)

- Date: 2026-10-22
- Ruler: ct
- Governs: MAIL-003

**Receiving ERASURE-002 (ct 22 Oct 2026):** Before shipping, MAIL-003 adds its records and provider copies to ERASURE-002's classes, clocks, holds, preview, erasure, receipt and restore fence (ct 22 Oct 2026).

### RL-23 — Inherited MSG-002 marketing consent (ct 20 Oct 21:21Z)

- Date: 2026-10-20
- Ruler: ct
- Governs: MSG-001

**Inherited MSG-002 marketing consent (ct 20 Oct 21:21Z):** Each template version carries an immutable engagement or marketing category that only the principal changes, and marketing templates refuse engagement placeholders.

### RL-24 — Marketing consent and message class (ct 20 Oct 21:21Z)

- Date: 2026-10-20
- Ruler: ct
- Governs: MSG-002

**Marketing consent and message class (ct 20 Oct 21:21Z):** this is Blotter product policy, stricter than CAN-SPAM's opt-out baseline, and not legal certification. *Opt-in (Q1):* marketing needs its own explicit, affirmative opt-in for each channel (email, portal), in addition to everything ordinary email needs; existing email consent never authorizes it. *Class (Q2):* every batch and every message carries one class, engagement or marketing, fixed at preview. Engagement covers only the recipient's current relationship: requests and organizers, deadlines and status of engaged work, terms or fee changes, invoices, statements and payments, account, portal and security notices, and changes affecting delivery. Marketing is any promotion, offer, event, newsletter, referral or review request, or firm news not tied to a current engagement; a mixed message is marketing. Refusals: (a) an engagement batch declares a reason and a basis for each recipient (an open job, an active recurring rule, signed scope, an unpaid invoice, or, for account notices only, a portal account), and a recipient without one is excluded and listed; (b) prospects and archived clients never receive engagement class; (c) each template version carries an immutable engagement or marketing category, an engagement batch refuses a marketing-category template, and only the principal changes a category; (d) marketing templates refuse engagement placeholders and request or organizer attachments; (e) class cannot change after preview, and moving content from marketing to engagement needs a new batch, the principal's recorded reason and linked audit records; (f) the principal reviews the engagement notices sent to people without a marketing opt-in and can mark one misclassified; (g) the subject and opening of an engagement notice are engagement content. The principal and reviewers send engagement batches; the principal approves every marketing batch. *Consent record (Q3):* an append-only log; each event records the contact relationship and address, purpose, channel (email or portal), grant, withdrawal or correction, source (intake checkbox, portal preference, staff-recorded with evidence, import, migration, unsubscribe link, one-click header, staff-recorded reply, provider complaint or owner correction), when the contact acted and when it was recorded (UTC), actor, exact wording and version, language and evidence. Consent is never pre-ticked, never bundled into an engagement letter or signature, never a condition of service and never inferred from other consents. *Scope (Q4):* grants are per contact relationship; withdrawals apply to the address across the whole firm. Marketing eligibility needs an active contact on an active, unmerged client, a valid address, email_consent=1, and a grant later than every withdrawal for that address. Marketing is sent once per address per batch, with only the firm, sender, first-name and client-name placeholders; engagement notices still go per client under the existing recipient rules. When two contacts merge, the most restrictive consent wins and undo is exact. Prospects get marketing only with their own opt-in. *Withdrawals (Q5):* every marketing email carries a visible link to a one-page unsubscribe needing no sign-in, fee or extra fields, whose token is stored hashed; it also carries the one-click unsubscribe headers and the firm's US postal address, and a marketing send without that address is refused. The page also accepts a typed address, so it keeps working well past the 30-day minimum. Withdrawal takes effect immediately (Blotter does not use the 10-business-day allowance) and stops marketing only, never engagement notices. A provider complaint withdraws marketing for the address and alerts the batch owner; a hard bounce marks the address invalid for both classes. Tracking is delivery, bounce, complaint and reply only, with no open or click tracking. *Scheduled and queued sends (Q6):* dispatch never adds recipients who were not in the preview. Immediately before each send, including each throttled chunk and every retry, Blotter rechecks the client, contact, address, email consent, the engagement basis or marketing grant, and principal approval; a recipient who fails is recorded as "held: not sent" and never automatically retried. Attempts are claimed before sending, and resubmission is idempotent. When staff leave, their batches move to the successor, and marketing batches need fresh approval. Restored batches come back paused, need a fresh preview and never replay. Automation, follow-up sequences, invoice reminders and scheduled inbox sends may send engagement class only. *Prior email withdrawal (Q7):* email_consent=0, an inactive contact or an archived client blocks all Blotter email, engagement and marketing alike; a marketing grant never restores email consent, which needs its own recorded act; the client's existing portal or link channel still works within its current grants. *Owner corrections (Q8):* only the principal records a correction, which references the original event and gives a reason. It can void a mistaken grant, or a withdrawal staff recorded against the wrong contact, but never a withdrawal the contact made themselves; only a later grant by the contact revives marketing. Sent messages are never altered, and everything is attributed in the audit trail. *Imports (Q9):* imports and incumbent migrations bring marketing in as not granted. A grant comes in only from an explicitly mapped opt-in column with a capture date, plus the owner's attestation at commit, and those rows are shown separately in the preview. Unsubscribed, bounced and complained states always come in as withdrawals; an incumbent "subscribed" status without evidence comes in as not granted. Bulk re-permission emails count as marketing and are refused. *Erasure and archive (Q10):* consent events and suppressions travel with archives; unsubscribe tokens do not. After any restore, marketing stays off until the principal confirms the consent log is current. Erasing a client or contact keeps only a hashed suppression record of a withdrawn address, as a named exception, and a newer erasure journal blocks stale restores. *Channels (Q11):* portal marketing needs its own portal grant on an identified portal account, so it waits for PORTAL-002; upload and progress links never carry marketing; marketing by text message is refused. *Tax-return information (Q12, a product guard only):* the marketing opt-in is not the written consent 26 CFR 301.7216-3 requires. Each marketing batch declares its topic, tax preparation services and tax education or other services; "other services" batches cannot filter on tax-derived criteria, and their preview shows a §7216 notice. This removes nothing from segments, scheduling, tracking or reply threading. *Replies:* an engagement reply threads to that client only; a marketing reply goes to the contact, and to the client when the address belongs to exactly one client, otherwise to triage. *Default until proof:* marketing is excluded and there is no new outreach authority; engagement email stays within its existing contact grants and email_consent. Firm-specific §7216 and state law are out of scope, and no runtime, provider or legal proof is claimed. *Inherited by (status unchanged):* CRM-001, CRM-003, CRM-004, CRM-005, IMPORT-001, MIGRATE-001–005, MSG-001, AUTOMATE-001, FOLLOWUP-001, BILL-004, MAIL-003, SMS-001, PORTAL-001, PORTAL-002, PORTAL-003, PORTAL-005, ENGAGE-001, SIGN-002, US-001, NOTIFY-001, ACCESS-006, ARCHIVE-002, ERASURE-002, AUDIT-001 and BASE-001 each carry their line.

### RL-25 — Inherited MSG-002 marketing consent (ct 20 Oct 21:21Z)

- Date: 2026-10-20
- Ruler: ct
- Governs: SMS-001

**Inherited MSG-002 marketing consent (ct 20 Oct 21:21Z):** Marketing by text message is refused.

### RL-26 — Receiving ERASURE-002 (ct 22 Oct 2026)

- Date: 2026-10-22
- Ruler: ct
- Governs: SMS-001

**Receiving ERASURE-002 (ct 22 Oct 2026):** Before shipping, SMS-001 adds its records and provider copies to ERASURE-002's classes, clocks, holds, preview, erasure, receipt and restore fence (ct 22 Oct 2026).

### RL-27 — Native completion and inherited events (NOTIFY-001, ct 20 Oct 16:55Z)

- Date: 2026-10-20
- Ruler: ct
- Governs: NOTIFY-001, NOTIFY-002, NOTIFY-003

**Native completion and inherited events (NOTIFY-001, ct 20 Oct 16:55Z):** completion covers every shipped native event and email channel; MOBILE-001 supplies actual mobile push before it ships.

### RL-28 — Inherited MSG-002 marketing consent (ct 20 Oct 21:21Z)

- Date: 2026-10-20
- Ruler: ct
- Governs: NOTIFY-001, NOTIFY-002, NOTIFY-003

**Inherited MSG-002 marketing consent (ct 20 Oct 21:21Z):** A provider complaint alerts the batch owner.

### RL-29 — Inherited MSG-002 marketing consent (ct 20 Oct 21:21Z)

- Date: 2026-10-20
- Ruler: ct
- Governs: PORTAL-002, PORTAL-007, PORTAL-008, PORTAL-009

**Inherited MSG-002 marketing consent (ct 20 Oct 21:21Z):** Portal marketing needs its own portal grant on an identified portal account, and portal preferences offer unsubscribe.

### RL-30 — Implemented native slice (sx-blotter-c40, 23 Oct; defaults approved by ct 25 Oct 20:20Z)

- Date: 2026-10-23
- Ruler: ct
- Governs: PORTAL-002, PORTAL-007, PORTAL-008, PORTAL-009

**Implemented native slice (sx-blotter-c40, 23 Oct; defaults approved by ct 25 Oct 20:20Z):** a portal account is one email address.

### RL-31 — Receiving ERASURE-002 (ct 22 Oct 2026)

- Date: 2026-10-22
- Ruler: ct
- Governs: PORTAL-002, PORTAL-007, PORTAL-008, PORTAL-009

**Receiving ERASURE-002 (ct 22 Oct 2026):** Before shipping, PORTAL-002 adds its records and provider copies to ERASURE-002's classes, clocks, holds, preview, erasure, receipt and restore fence (ct 22 Oct 2026).

### RL-32 — Inherited MSG-002 marketing consent (ct 20 Oct 21:21Z)

- Date: 2026-10-20
- Ruler: ct
- Governs: PORTAL-003, PORTAL-010

**Inherited MSG-002 marketing consent (ct 20 Oct 21:21Z):** Progress links never carry marketing.

### RL-33 — Semantics (ct 19 Oct18:50Z)

- Date: 2026-10-19
- Ruler: ct
- Governs: PORTAL-004, PORTAL-011, PORTAL-012

**Semantics (ct 19 Oct18:50Z):** the principal or reviewer publishes a named tax/bookkeeping organizer version on a work template.

### RL-34 — Receiving ERASURE-002 (ct 22 Oct 2026)

- Date: 2026-10-22
- Ruler: ct
- Governs: PORTAL-004, PORTAL-011, PORTAL-012

**Receiving ERASURE-002 (ct 22 Oct 2026):** Inside an ERASURE-002 hold its answer erasure is refused, naming the hold; in whole-client erasure, submitted originals a signed-off job consumed are ERASURE-002 signed-off work (proved under ERASURE-002).

### RL-35 — Inherited MSG-002 marketing consent (ct 20 Oct 21:21Z)

- Date: 2026-10-20
- Ruler: ct
- Governs: PORTAL-005

**Inherited MSG-002 marketing consent (ct 20 Oct 21:21Z):** The unsubscribe page and its wording appear in the contact's language.

### RL-36 — Receiving ERASURE-002 (ct 22 Oct 2026)

- Date: 2026-10-22
- Ruler: ct
- Governs: PORTAL-005

**Receiving ERASURE-002 (ct 22 Oct 2026):** Before shipping, PORTAL-005 adds its records and provider copies to ERASURE-002's classes, clocks, holds, preview, erasure, receipt and restore fence (ct 22 Oct 2026).

### RL-37 — Receiving ERASURE-002 (ct 22 Oct 2026)

- Date: 2026-10-22
- Ruler: ct
- Governs: MOBILE-001

**Receiving ERASURE-002 (ct 22 Oct 2026):** Before shipping, MOBILE-001 adds its records and provider copies to ERASURE-002's classes, clocks, holds, preview, erasure, receipt and restore fence (ct 22 Oct 2026).

### RL-38 — Semantics (ct 19 Oct 16:47Z and 17:09Z)

- Date: 2026-10-19
- Ruler: ct
- Governs: DOC-001, DOC-004, DOC-005

**Semantics (ct 19 Oct 16:47Z and 17:09Z):** the client/period/engagement catalog lists every requested file (including historical and converted-intake originals), task-completion attachment, expense receipt, notice-timeline attachment and DOC-003 deliverable version under its existing staff download authority, with a link to its source workflow.

### RL-39 — Semantics (ct 19 Oct 12:58Z and 13:17Z)

- Date: 2026-10-19
- Ruler: ct
- Governs: DOC-002, DOC-006

**Semantics (ct 19 Oct 12:58Z and 13:17Z):** all current byte stores are covered: requested-job uploads (including converted intake and notice source files), deliverable versions, task attachments, expense receipts, notice timeline attachments and pre-conversion intake uploads.

### RL-40 — Inherited MSG-002 marketing consent (ct 20 Oct 21:21Z)

- Date: 2026-10-20
- Ruler: ct
- Governs: FOLLOWUP-001

**Inherited MSG-002 marketing consent (ct 20 Oct 21:21Z):** Follow-up sequences send engagement class only, with MSG-002's send-time recheck.

### RL-41 — Receiving ERASURE-002 (ct 22 Oct 2026)

- Date: 2026-10-22
- Ruler: ct
- Governs: BILL-001

**Receiving ERASURE-002 (ct 22 Oct 2026):** Approved exports stay immutable; only ERASURE-002's confirmed expiry removes their bytes, keeping number, totals, revision and SHA-256.

### RL-42 — Receiving ERASURE-002 (ct 22 Oct 2026)

- Date: 2026-10-22
- Ruler: ct
- Governs: BILL-002, BILL-006, BILL-007

**Receiving ERASURE-002 (ct 22 Oct 2026):** Before shipping, BILL-002 adds its records and provider copies to ERASURE-002's classes, clocks, holds, preview, erasure, receipt and restore fence (ct 22 Oct 2026).

### RL-43 — Native semantics (sx-blotter-c36/c37, 22 Oct; approved with change by ct, batch 11 H)

- Date: 2026-10-22
- Ruler: ct
- Governs: BILL-002, BILL-006, BILL-007

**Native semantics (sx-blotter-c36/c37, 22 Oct; approved with change by ct, batch 11 H):** The principal selects the sole invoice authority; the principal or an ACCESS-002 financial-authority holder (for the clients the holder holds) authorizes independent fixed/milestone/explicit-proration entitlements, records supplied deposit/credit evidence and tax treatment, approves numbered USD PDF snapshots and delivers them to an authorized billing contact.

### RL-44 — Ruled (ct 22 Oct)

- Date: 2026-10-22
- Ruler: ct
- Governs: BILL-002, BILL-006, BILL-007

**Ruled (ct 22 Oct):** the principal or an ACCESS-002 financial-authority holder prepares, issues, sends and voids. Selecting the invoice authority and confirming retention expiry stay principal-only. A holder may enable automatic issue and send for one rule revision. The consent records a per-invoice USD cap, the recipient and a reason, and it is audited. Each run rechecks the consenter's live authority, the rule's terms and the recipient's billing role and email or portal consent. A run issues and sends only within the cap and with no exception. Otherwise it leaves a draft with a named exception. The invoice states 'auto-issued under rule revision N'. Delivery may be by email PDF to a billing contact without portal access. A restore brings rules back paused and without consent. 

### RL-45 — Receiving ERASURE-002 (ct 22 Oct 2026)

- Date: 2026-10-22
- Ruler: ct
- Governs: PAY-001

**Receiving ERASURE-002 (ct 22 Oct 2026):** Before shipping, PAY-001 adds its records and provider copies to ERASURE-002's classes, clocks, holds, preview, erasure, receipt and restore fence (ct 22 Oct 2026).

### RL-46 — Receiving ERASURE-002 (ct 22 Oct 2026)

- Date: 2026-10-22
- Ruler: ct
- Governs: PAY-002

**Receiving ERASURE-002 (ct 22 Oct 2026):** Before shipping, PAY-002 adds its records and provider copies to ERASURE-002's classes, clocks, holds, preview, erasure, receipt and restore fence (ct 22 Oct 2026).

### RL-47 — Receiving ERASURE-002 (ct 22 Oct 2026)

- Date: 2026-10-22
- Ruler: ct
- Governs: BILL-003

**Receiving ERASURE-002 (ct 22 Oct 2026):** Before shipping, BILL-003 adds its records and provider copies to ERASURE-002's classes, clocks, holds, preview, erasure, receipt and restore fence (ct 22 Oct 2026).

### RL-48 — Inherited MSG-002 marketing consent (ct 20 Oct 21:21Z)

- Date: 2026-10-20
- Ruler: ct
- Governs: BILL-004

**Inherited MSG-002 marketing consent (ct 20 Oct 21:21Z):** Invoice reminders send engagement class only, with MSG-002's send-time recheck.

### RL-49 — Receiving ERASURE-002 (ct 22 Oct 2026)

- Date: 2026-10-22
- Ruler: ct
- Governs: BILL-004

**Receiving ERASURE-002 (ct 22 Oct 2026):** Before shipping, BILL-004 adds its records and provider copies to ERASURE-002's classes, clocks, holds, preview, erasure, receipt and restore fence (ct 22 Oct 2026).

### RL-50 — Implemented native slice (sx-blotter-c37, 22 Oct; reminder-consent default approved by ct 22 Oct 23:45Z)

- Date: 2026-10-22
- Ruler: ct
- Governs: BILL-004

**Implemented native slice (sx-blotter-c37, 22 Oct; reminder-consent default approved by ct 22 Oct 23:45Z):** reminders are automatic outbound mail, so the firm schedule runs only under a recorded consent of the principal or a financial-authority holder without client scopes: the steps in days from the due date (negative before it), one firm engagement-class MSG-001 template version and a reason, audited and step-up confirmed; pausing ends it. Each hourly run rechecks the consenter's live authority and the template version (otherwise the schedule pauses with a named reason), and for each issued invoice with an open balance, no dispute or payment-plan hold and a client not opted out, sends the latest passed step once (earlier passed steps are recorded as skipped, never sent late) to the invoice's billing contact with the numbered PDF, after MSG-002's engagement send-time recheck (active, authorized billing contact with email consent and no hard bounce); a refused recheck or placeholder holds that step, named, and is never replayed. A client follows the firm schedule, opts out or has its own steps; every reminder, hold and override is in the client's history. Paid means the invoice balance is zero after recorded receipts, deposits, credits or approved write-offs (BILL-003) and observed net settled provider payments. Bulk resend sends one reviewed preview of up to 50 issued invoices (their billing recipients, documents and one reason) through BILL-002's delivery. A client statement as of a date lists open issued invoices with aging, recorded credits and their applications, observed provider payment states and net amounts, and totals equal to the open balances; its CSV is an export. Quick collect requires PAY-001’s current invoice-bounded saved-method authorization and fresh-confirmed financial authority; its provider receipts update the same open balance. Any edit to reminder steps or the consented template version pauses the schedule and ends its consent. Reminder tables join the link and firm classes, erasure steps, expiry effects and observed provider/recipient copies; a restore returns the schedule paused and without consent, and claimed reminders held.

### RL-51 — Implemented semantics (ct approved with riders 22 Oct 23:45Z)

- Date: 2026-10-22
- Ruler: ct
- Governs: BILL-005, BILL-008

**Implemented semantics (ct approved with riders 22 Oct 23:45Z):** only a deliverable (the firm's own work product) can be gated, never a record the client supplied or any other file; the principal or a financial-authority holder gates a deliverable on one issued invoice of the same client, with a reason.

### RL-52 — Receiving ERASURE-002 (ct 22 Oct 2026)

- Date: 2026-10-22
- Ruler: ct
- Governs: BILL-005, BILL-008

**Receiving ERASURE-002 (ct 22 Oct 2026):** Before shipping, BILL-005 adds its records and provider copies to ERASURE-002's classes, clocks, holds, preview, erasure, receipt and restore fence (ct 22 Oct 2026).

### RL-53 — Receiving ERASURE-002 (ct 22 Oct 2026)

- Date: 2026-10-22
- Ruler: ct
- Governs: INTEGRATE-001

**Receiving ERASURE-002 (ct 22 Oct 2026):** Before shipping, INTEGRATE-001 adds its records and provider copies to ERASURE-002's classes, clocks, holds, preview, erasure, receipt and restore fence (ct 22 Oct 2026).

### RL-54 — Receiving ERASURE-002 (ct 22 Oct 2026)

- Date: 2026-10-22
- Ruler: ct
- Governs: INTEGRATE-002

**Receiving ERASURE-002 (ct 22 Oct 2026):** Before shipping, INTEGRATE-002 adds its records and provider copies to ERASURE-002's classes, clocks, holds, preview, erasure, receipt and restore fence (ct 22 Oct 2026).

### RL-55 — Receiving ERASURE-002 (ct 22 Oct 2026)

- Date: 2026-10-22
- Ruler: ct
- Governs: INTEGRATE-003

**Receiving ERASURE-002 (ct 22 Oct 2026):** Before shipping, connected-storage originals, copies and links appear in ERASURE-002's preview and receipt as named outside copies owned by the connected account; disconnecting never deletes them silently (ct 22 Oct 2026).

### RL-56 — Receiving ERASURE-002 (ct 22 Oct 2026)

- Date: 2026-10-22
- Ruler: ct
- Governs: INTEGRATE-004

**Receiving ERASURE-002 (ct 22 Oct 2026):** Before shipping, INTEGRATE-004 adds its records and provider copies to ERASURE-002's classes, clocks, holds, preview, erasure, receipt and restore fence (ct 22 Oct 2026).

### RL-57 — Receiving ERASURE-002 (ct 22 Oct 2026)

- Date: 2026-10-22
- Ruler: ct
- Governs: INTEGRATE-005

**Receiving ERASURE-002 (ct 22 Oct 2026):** Before shipping, INTEGRATE-005 adds its records and provider copies to ERASURE-002's classes, clocks, holds, preview, erasure, receipt and restore fence (ct 22 Oct 2026).

### RL-58 — Receiving ERASURE-002 (ct 22 Oct 2026)

- Date: 2026-10-22
- Ruler: ct
- Governs: INTEGRATE-006

**Receiving ERASURE-002 (ct 22 Oct 2026):** Before shipping, INTEGRATE-006 adds its records and provider copies to ERASURE-002's classes, clocks, holds, preview, erasure, receipt and restore fence (ct 22 Oct 2026).

### RL-59 — Receiving ERASURE-002 (ct 22 Oct 2026)

- Date: 2026-10-22
- Ruler: ct
- Governs: INTEGRATE-007

**Receiving ERASURE-002 (ct 22 Oct 2026):** Before shipping, INTEGRATE-007 adds its records and provider copies to ERASURE-002's classes, clocks, holds, preview, erasure, receipt and restore fence (ct 22 Oct 2026).

### RL-60 — Receiving ERASURE-002 (ct 22 Oct 2026)

- Date: 2026-10-22
- Ruler: ct
- Governs: INTEGRATE-008

**Receiving ERASURE-002 (ct 22 Oct 2026):** Before shipping, INTEGRATE-008 adds its records and provider copies to ERASURE-002's classes, clocks, holds, preview, erasure, receipt and restore fence (ct 22 Oct 2026).

### RL-61 — Implemented integration boundary (API-002, ct 21 Oct key authority)

- Date: 2026-10-21
- Ruler: ct
- Governs: API-002, API-003

**Implemented integration boundary (API-002, ct 21 Oct key authority):** Principal-only second-factor step-up mints non-person credentials with explicit client and action grants. Credentials intersect their creator's live principal identity and confirmed factor, recheck actions and client scope atomically, suspend on observed loss and have separate replay spaces. Admission uses a durable rolling 60-request window over 60 seconds. Entity creation accepts only native entity fields and adds only the new client to that key; contacts, relationships and grants remain human-reviewed. Task creation adds only a label to an active client's open job, with no completion or assignment. Document and billing integration reads expose metadata only; billing grants execute no financial action. Thin signed completion notices contain only event, client and work references and time. Registration is principal-approved and excludes earlier completions. Durable claims, live dispatch checks, stable event ids, retained outcomes and explicit reconciliation prevent blind retries. Restoration removes bearer authority, endpoint secrets and destinations and holds unfinished deliveries; fresh registrations do not backfill history. Erasure removes client grants and replay receipts, suspends a final-client key, cancels unfinished notices as record_erased and names external copies. Named public-door proof: `tests/blotter/integration-keys.test.mjs` (lifecycle, task events, rolling limit, erasure and metadata journeys), `tests/blotter/integration-webhooks.test.mjs` (thin signed completion webhook journey) and `tests/blotter/integration-ui.mjs` (`integrationTaskJourney`, 1440 and 390). The complete Zapier journey needs an authorized workspace; broader work mutations, time recording and document-byte integration doors remain open. Existing staff-session billing exports retain their native snapshot response and are not integration billing grants. 

### RL-62 — Inherited ACCESS-004 (ct audit36, 20 Oct 21:31Z)

- Date: 2026-10-20
- Ruler: ct
- Governs: API-002, API-003

**Inherited ACCESS-004 (ct audit36, 20 Oct 21:31Z):** before any person-created API session or token ships, it passes ACCESS-004's own per-session second-factor check before any practice data, whatever the sign-in method, and integration or agent keys never bypass the firm policy. 

### RL-63 — Receiving ERASURE-002 (ct 22 Oct 2026)

- Date: 2026-10-22
- Ruler: ct
- Governs: API-002, API-003

**Receiving ERASURE-002 (ct 22 Oct 2026):** Client erasure removes the client from key scopes, suspends a key scoped to it alone, and cancels its pending deliveries as `record_erased` (ERASURE-002).

### RL-64 — Inherited MSG-002 marketing consent (ct 20 Oct 21:21Z)

- Date: 2026-10-20
- Ruler: ct
- Governs: AUTOMATE-001

**Inherited MSG-002 marketing consent (ct 20 Oct 21:21Z):** Automation sends engagement class only, with MSG-002's send-time recheck.

### RL-65 — Semantics (ct 19 Oct 16:47Z)

- Date: 2026-10-19
- Ruler: ct
- Governs: IMPORT-001, IMPORT-002

**Semantics (ct 19 Oct 16:47Z):** the owner maps source headers explicitly; the reviewed fingerprint binds original bytes, mapping and duplicate decisions.

### RL-66 — Inherited MSG-002 marketing consent (ct 20 Oct 21:21Z)

- Date: 2026-10-20
- Ruler: ct
- Governs: IMPORT-001, IMPORT-002

**Inherited MSG-002 marketing consent (ct 20 Oct 21:21Z):** Imports bring marketing in as not granted; a grant comes in only from an explicitly mapped opt-in column with a capture date and the owner's attestation at commit, shown separately in the preview; unsubscribed, bounced and complained states always import as withdrawals.

### RL-67 — Inherited MSG-002 marketing consent (ct 20 Oct 21:21Z)

- Date: 2026-10-20
- Ruler: ct
- Governs: MIGRATE-001

**Inherited MSG-002 marketing consent (ct 20 Oct 21:21Z):** Migration brings marketing in as not granted; unsubscribed, bounced and complained states always import as withdrawals, and an incumbent "subscribed" status without evidence imports as not granted.

### RL-68 — Receiving ERASURE-002 (ct 22 Oct 2026)

- Date: 2026-10-22
- Ruler: ct
- Governs: MIGRATE-001

**Receiving ERASURE-002 (ct 22 Oct 2026):** Before shipping, MIGRATE-001 adds its records and provider copies to ERASURE-002's classes, clocks, holds, preview, erasure, receipt and restore fence (ct 22 Oct 2026).

### RL-69 — Inherited MSG-002 marketing consent (ct 20 Oct 21:21Z)

- Date: 2026-10-20
- Ruler: ct
- Governs: MIGRATE-002

**Inherited MSG-002 marketing consent (ct 20 Oct 21:21Z):** Migration brings marketing in as not granted; unsubscribed, bounced and complained states always import as withdrawals, and an incumbent "subscribed" status without evidence imports as not granted. 

### RL-70 — Receiving ERASURE-002 (ct 22 Oct 2026)

- Date: 2026-10-22
- Ruler: ct
- Governs: MIGRATE-002

**Receiving ERASURE-002 (ct 22 Oct 2026):** Before shipping, MIGRATE-002 adds its records and provider copies to ERASURE-002's classes, clocks, holds, preview, erasure, receipt and restore fence (ct 22 Oct 2026).

### RL-71 — Inherited MSG-002 marketing consent (ct 20 Oct 21:21Z)

- Date: 2026-10-20
- Ruler: ct
- Governs: MIGRATE-003

**Inherited MSG-002 marketing consent (ct 20 Oct 21:21Z):** Migration brings marketing in as not granted; unsubscribed, bounced and complained states always import as withdrawals, and an incumbent "subscribed" status without evidence imports as not granted. 

### RL-72 — Receiving ERASURE-002 (ct 22 Oct 2026)

- Date: 2026-10-22
- Ruler: ct
- Governs: MIGRATE-003

**Receiving ERASURE-002 (ct 22 Oct 2026):** Before shipping, MIGRATE-003 adds its records and provider copies to ERASURE-002's classes, clocks, holds, preview, erasure, receipt and restore fence (ct 22 Oct 2026).

### RL-73 — Inherited MSG-002 marketing consent (ct 20 Oct 21:21Z)

- Date: 2026-10-20
- Ruler: ct
- Governs: MIGRATE-004

**Inherited MSG-002 marketing consent (ct 20 Oct 21:21Z):** Migration brings marketing in as not granted; unsubscribed, bounced and complained states always import as withdrawals, and an incumbent "subscribed" status without evidence imports as not granted. 

### RL-74 — Receiving ERASURE-002 (ct 22 Oct 2026)

- Date: 2026-10-22
- Ruler: ct
- Governs: MIGRATE-004

**Receiving ERASURE-002 (ct 22 Oct 2026):** Before shipping, MIGRATE-004 adds its records and provider copies to ERASURE-002's classes, clocks, holds, preview, erasure, receipt and restore fence (ct 22 Oct 2026).

### RL-75 — Inherited MSG-002 marketing consent (ct 20 Oct 21:21Z)

- Date: 2026-10-20
- Ruler: ct
- Governs: MIGRATE-005

**Inherited MSG-002 marketing consent (ct 20 Oct 21:21Z):** Migration brings marketing in as not granted; unsubscribed, bounced and complained states always import as withdrawals, and an incumbent "subscribed" status without evidence imports as not granted.

### RL-76 — Receiving ERASURE-002 (ct 22 Oct 2026)

- Date: 2026-10-22
- Ruler: ct
- Governs: MIGRATE-005

**Receiving ERASURE-002 (ct 22 Oct 2026):** Before shipping, MIGRATE-005 adds its records and provider copies to ERASURE-002's classes, clocks, holds, preview, erasure, receipt and restore fence (ct 22 Oct 2026).

### RL-77 — Receiving ERASURE-002 (ct 22 Oct 2026)

- Date: 2026-10-22
- Ruler: ct
- Governs: MIGRATE-006, MIGRATE-008

**Receiving ERASURE-002 (ct 22 Oct 2026):** Before shipping, MIGRATE-006 adds its records and provider copies to ERASURE-002's classes, clocks, holds, preview, erasure, receipt and restore fence (ct 22 Oct 2026).

### RL-78 — Receiving ERASURE-002 (ct 22 Oct 2026)

- Date: 2026-10-22
- Ruler: ct
- Governs: MIGRATE-007

**Receiving ERASURE-002 (ct 22 Oct 2026):** Before shipping, MIGRATE-007 adds its records and provider copies to ERASURE-002's classes, clocks, holds, preview, erasure, receipt and restore fence (ct 22 Oct 2026).

### RL-79 — Implemented native policy (sx-blotter-c36/c37, 22 Oct; approved with change by ct, batch 11 H)

- Date: 2026-10-22
- Ruler: ct
- Governs: ACCESS-002, ACCESS-007

**Implemented native policy (sx-blotter-c36/c37, 22 Oct; approved with change by ct, batch 11 H):** The principal configures overlapping teams and explicit direct client grants.

### RL-80 — Ruled (ct 22 Oct)

- Date: 2026-10-22
- Ruler: ct
- Governs: ACCESS-002, ACCESS-007

**Ruled (ct 22 Oct):** the principal may grant named members two published permissions: 'manage access' and 'financial authority'. Each grant is audited and needs step-up. A holder can never grant itself, widen its own client scope or revoke the principal. Firm-wide financial reports open to financial-authority holders for the clients they hold. Export, sensitive-administration and credential-reveal step-up applies from installation, whether or not scopes are configured. 

### RL-81 — Inherited MSG-002 marketing consent (ct 20 Oct 21:21Z)

- Date: 2026-10-20
- Ruler: ct
- Governs: ACCESS-006, ACCESS-009

**Inherited MSG-002 marketing consent (ct 20 Oct 21:21Z):** A departing member's bulk-message batches move to the successor, and marketing batches need fresh principal approval. Implemented and asserted on MSG-002's doors (consent carriers journey, `tests/blotter/bulk-messages.test.mjs`); MSG-002 states the exact semantics.

### RL-82 — Receiving ERASURE-002 (ct 22 Oct 2026)

- Date: 2026-10-22
- Ruler: ct
- Governs: VAULT-001

**Receiving ERASURE-002 (ct 22 Oct 2026):** Its owner erasure is refused inside an ERASURE-002 hold; whole-client erasure removes ciphertext, usernames and notes and keeps the reveal log under opaque labels (ERASURE-002).

### RL-83 — Inherited MSG-002 marketing consent (ct 20 Oct 21:21Z)

- Date: 2026-10-20
- Ruler: ct
- Governs: ARCHIVE-002, ARCHIVE-003

**Inherited MSG-002 marketing consent (ct 20 Oct 21:21Z):** Consent events and suppressions travel with archives, unsubscribe tokens are excluded, and marketing stays off after a restore until the principal confirms the consent log is current.

### RL-84 — Receiving ERASURE-002 (ct 22 Oct 2026)

- Date: 2026-10-22
- Ruler: ct
- Governs: ERASURE-001

**Receiving ERASURE-002 (ct 22 Oct 2026):** Inside an ERASURE-002 hold this door is refused, naming the hold (proved under ERASURE-002).

### RL-85 — Inherited MSG-002 marketing consent (ct 20 Oct 21:21Z)

- Date: 2026-10-20
- Ruler: ct
- Governs: ERASURE-002

**Inherited MSG-002 marketing consent (ct 20 Oct 21:21Z):** Erasing a client or contact keeps only a hashed suppression record of a withdrawn address, as a named exception. 

### RL-86 — Semantic implemented (sx-blotter-c35, 22 Oct 2026, to ct's ruling above)

- Date: 2026-10-22
- Ruler: ct
- Governs: ERASURE-002

**Semantic implemented (sx-blotter-c35, 22 Oct 2026, to ct's ruling above):** only the principal, as a person, sets periods, places and releases holds, records requests, approves erasure and confirms expiry; a reviewer, a preparer and an agent key are refused every door and no clock or purge runs by itself. The registry is typed (`erasure-registry.ts`): every table belongs to one class and a table or byte column without one stops the preview. Retained classes (signed-off work, signed engagements, billing evidence; IRS e-file authorizations and signed documents have no records until SIGN-001 and SIGN-002 ship) carry periods in whole years (default 7, minimum 1, e-file floor 3, with the §6107(b) and Publication 583 warning below 7) and clocks computed from each record's own dates as calendar dates in the firm's time zone; a record past its date appears in Ready to erase and is erased only when the principal confirms, keeping the record, revision, sign-off attribution and SHA-256. Holds name scope (client, job, file, signed engagement, approved export, or a record class for one client or the whole firm), reason, owner (the principal or a named reviewer) and review date; retain-until dates can only extend a record's clock. ERASURE-001 (files and engagement letters), PORTAL-004 organizer erasure and VAULT-001 credential erasure are refused inside a hold, naming it. Erasure is refused, naming the records, while the client has an open job, an active recurring rule, a queued message, an open upload, an unanswered organizer request or a pending agent run, and needs an archived client, the preview digest, a reason and the client's name. It keeps signed-off work (accepted documents, organizer originals submitted before sign-off, consumed readiness decisions, approved deliverables), signed engagements and the entries approved billing exports snapshotted; replaces other payloads with the marker; deletes derived data (extracted text, agent plans and outputs, undecided readiness preparations; there is no stored summary or search index: search reads live rows); keeps the reveal log under random labels; gives the client and its contacts random `Erased client` and `Erased contact` labels; seals the legal name, taxpayer identifier and address under the vault key behind the audited retained-records door; keeps only a one-way digest of an address that withdrew consent (a bounced address is dropped); and erases merged records with their survivor, refusing their unmerge. The receipt names principal-recorded copies and the copies Blotter observes (relay mail, share-link and portal downloads, staff downloads, billing CSVs, owner archives, agent-key reads) with their owners. An older archive restored with the newer journal is refused 409 naming the erasure; a destination without the journal restores only after the principal acknowledges "erasure history unverified: supply your latest erasure journal", recorded in the import report. The mapped marketing import refuses a grant for an address that withdrew before an erasure. A practitioner-recorded signed engagement is filed with its signers, signed date and SHA-256 and labelled "practitioner-recorded, not signed through Blotter". ENGAGE-001, SIGN-001, SIGN-002 and INTEGRATE-001 to INTEGRATE-008 inherit the class, clock, hold, preview, receipt and fence obligations stated in the receiving lines (ct patterns 1, 2 and 4). **Retention, hold and erasure policy (ct, 22 Oct 2026).** Only the principal, in a native session, sets retention periods, places and releases holds, records deletion requests, approves erasure and confirms expiry; reviewers, preparers, contacts, agent keys and integration keys cannot, and there is no self-service door: a client's or contact's request reaches the principal, who records requester, channel, received date, verification note and reason. Subjects are a client with all its contacts, one contact, or a CRM-005 prospect. Every stored record belongs to one class in a typed registry shared by preview, erasure, export and restore; a table, byte store or derived store holding client data without a class blocks the preview. Retained classes and their clocks, as calendar dates in the firm's timezone: *signed-off work* (the job, status history, checklist outcomes, accepted documents, reviewer and partner notes, sign-off records, recorded agency acknowledgments, and the submitted organizer originals and readiness decisions the job consumed) from the latest of sign-off, the job's due date (extended when an extension is recorded) and the recorded acceptance date; *signed engagements* (practitioner-recorded signed letters now; ENGAGE-001 letters and certificates when shipped) from the later of the signed date and the latest sign-off of the client's jobs dated on or after it; *IRS e-file authorizations* (SIGN-001) from the later of the return due date and the IRS received date; *signed documents* (SIGN-002, when shipped) from completion or the later sign-off of the job they are filed to; *billing evidence* (approved BILL-001 exports and the entries they snapshotted; BILL-002–005 and PAY-001/002 records when shipped) from the latest financial event they support, corrections included. Each retained class has a period in whole years (default 7, minimum 1; SIGN-001 minimum 3, as that clause states); below 7 the setting shows IRC §6107(b)'s three years after the close of the return period for preparer return copies and lists, and IRS Publication 583's periods. The principal may set a later retain-until date with a reason on a client, job or record, never an earlier one. A changed period recomputes every unerased record from its own clock and never revives an erased one. Nothing expires or is purged automatically: records past their date appear in a Ready to erase list and are erased only on the principal's confirmation. Every other class (contact personal fields no retained record needs; portal, contact, upload and share links; message and chat bodies; notifications; organizer drafts and unconsumed submissions; CRM-005 prospect answers, consent records and uploads; readiness preparations and client responses no signed-off job consumed; derived AI data; vault credentials; unbilled time descriptions) has no period and is erased on approval. A hold names its scope (a client, a job, or a record class for one client or the whole firm), reason, hold owner (the principal or a named reviewer) and review date, which shows as due on the retention page; no reminder is sent. Everything in scope is preserved: erasure leaves it as a held exception naming the hold, Ready to erase skips it, and ERASURE-001 file erasure, PORTAL-004 answer erasure and VAULT-001 credential erasure inside the scope are refused naming the hold; only access revocation runs under a hold. Release is an attributed principal action; released records then follow their own clocks. Client erasure is refused, naming the records, while the subject has an open (not signed-off or cancelled) job, an active recurring rule, a queued or scheduled message, an open upload or organizer request, a pending client agent run, or (when BILL-002 ships) an open balance. A dry-run preview lists every class with its action (removed; payload replaced by the erasure marker; retained with class, clock and expiry; held with the hold; or outside copy with its owner) and its count. Execution needs the preview digest, a reason and the client's name typed; a changed preview is refused as stale; it runs in one atomic batch with Base's redaction journal and returns the receipt and one audit event. It revokes portal, contact, upload and share links and removes the client from every API-002 key's client scope (a key scoped to that client alone is suspended); removes contact emails, phones and addresses, keeping only MSG-002's hashed suppression record of a withdrawn address; removes vault ciphertext, usernames and notes, keeping the reveal log under opaque labels; replaces message, chat, notification, organizer, prospect, readiness-response and unbilled-time text and unaccepted attachments with the marker while keeping ids, threads, authors, times, revisions, review attribution and delivery outcomes; deletes derived AI data (readiness preparations, agent plans, outputs and source excerpts, summaries and search entries), keeping run and decision ids, actors, times and outcomes; redacts the subject's rows in retained import originals through Base's import erasure and refuses their undo, naming the erasure; and leaves every retained or held record unchanged, including job sign-off and approved billing bytes. On ordinary surfaces the client and its contacts become `Erased client <8 hex>` and `Erased contact <8 hex>` (random, not derived from any id); the legal name, taxpayer identifier and address a retained record needs stay only on that record, which the principal reads and exports through an audited retained-records door, absent from lists, search, reports, notifications, portal, API, agent context and plain exports. When the principal confirms a Ready to erase item, its bytes and personal fields are removed, keeping record, kind, number, totals, revision, sign-off attribution and SHA-256. AUDIT-001 rows are never removed: only this workflow replaces the subject's declared personal values in snapshots and free text with the marker, keeping actor, action, object, time and erasure reasons; Activity shows "values removed by erasure <id> on <date>", and nothing rebuilds them. The receipt and the journal hold no erased value. The receipt gives per-class counts of rows removed, fields replaced, audit values replaced, links revoked, keys rescoped or suspended, items retained (with expiry) and items held (with hold id), and names every outside copy and its owner: mail delivered through the platform relay (provider-retained) and recipients' mailboxes (recipient-controlled); files downloaded through share links or the portal (recipient-controlled); billing CSVs and archives downloaded by staff (the named downloader); owner archives handed to a successor or buyer of the practice (buyer-controlled, recipient named by the principal); data read by API-002 keys (key label and creator); and external copies the principal records with location, owner and note (labelled principal-recorded). Blotter never claims their deletion. The principal exports the latest erasure journal. Restoring an archive made before an erasure is refused, naming the erasure, when the destination knows it or the newer journal is supplied (ERASURE-001's fence); a fresh destination without it restores only after the principal acknowledges "erasure history unverified: supply your latest erasure journal", recorded in the import report. A signed engagement may be practitioner-recorded today: the principal files a signed letter to the client with its signers and signed date, labelled "practitioner-recorded, not signed through Blotter", with its SHA-256. ENGAGE-001, SIGN-001, SIGN-002 and INTEGRATE-001–008 add their own records and provider copies to these classes before they ship. No legal adequacy of any period or of anonymization is asserted.

### RL-87 — Inherited MSG-002 marketing consent (ct 20 Oct 21:21Z)

- Date: 2026-10-20
- Ruler: ct
- Governs: AUDIT-001

**Inherited MSG-002 marketing consent (ct 20 Oct 21:21Z):** Consent events and owner corrections are attributed with their actor and time.

### RL-88 — Receiving ERASURE-002 (ct 22 Oct 2026)

- Date: 2026-10-22
- Ruler: ct
- Governs: AUDIT-001

**Receiving ERASURE-002 (ct 22 Oct 2026):** The one exception to unchanged history is ERASURE-002's marker replacement of an erased subject's declared personal values; every row's actor, action, object, time and reason stay.

### RL-89 — Inherited MSG-002 marketing consent (ct 20 Oct 21:21Z)

- Date: 2026-10-20
- Ruler: ct
- Governs: BASE-001

**Inherited MSG-002 marketing consent (ct 20 Oct 21:21Z):** The activation gate stays on MSG-002.

### RL-90 — Receiving ERASURE-002 (ct 22 Oct 2026)

- Date: 2026-10-22
- Ruler: ct
- Governs: AI-001

**Receiving ERASURE-002 (ct 22 Oct 2026):** Before shipping, AI-001 adds its records and provider copies to ERASURE-002's classes, clocks, holds, preview, erasure, receipt and restore fence (ct 22 Oct 2026).

### RL-91 — Approved processing boundary (ct 25 Oct 20:20Z)

- Date: 2026-10-25
- Ruler: ct
- Governs: AI-001

**Approved processing boundary (ct 25 Oct 20:20Z):** Firm-owner enablement is off by default and requires a recorded provider no-training and no-retention attestation reference.

### RL-92 — Receiving ERASURE-002 (ct 22 Oct 2026)

- Date: 2026-10-22
- Ruler: ct
- Governs: AI-002

**Receiving ERASURE-002 (ct 22 Oct 2026):** Before shipping, AI-002 adds its records and provider copies to ERASURE-002's classes, clocks, holds, preview, erasure, receipt and restore fence (ct 22 Oct 2026).

### RL-93 — Approved processing boundary (ct 25 Oct 20:20Z)

- Date: 2026-10-25
- Ruler: ct
- Governs: AI-002

**Approved processing boundary (ct 25 Oct 20:20Z):** Firm-owner enablement is off by default and requires a recorded provider no-training and no-retention attestation reference.

### RL-94 — Approved native boundary (ct 25 Oct 20:20Z)

- Date: 2026-10-25
- Ruler: ct
- Governs: NOTICE-001, NOTICE-003

**Approved native boundary (ct 25 Oct 20:20Z):** The same owner enablement, attestation, masking, audit, saved-draft and explicit-click rules as AI-001 apply.

### RL-101 — Invoice-specific saved-method authority

- Date: 2026-10-28
- Ruler: ct
- Governs: PAY-001, BILL-004
- Outcome: **adopt with rider** — Permit quick collect only against explicit current invoice-specific consent and its remaining cumulative cap, after current financial authority and recipient revision checks; revocation and restore prevent another charge, while recurring/due-date mandates remain separate required work.

**Question:** May the current invoice-link consent authorize staff quick collection without a recurring mandate?

**Adopted/proposed default:** Separate invoice-link consent; cumulative invoice cap; current billing-contact revision; fresh financial-authority initiation; no scheduled debit; immediate revocation; restored authority held.

**Incumbent behavior and why:** Karbon supports saved-method automatic collection and explicit cessation/re-enablement after method removal. Stripe requires consent for the specific future use. No common norm was established for an invoice-only cap or revision-binding mechanism; this is the safer narrow authorization, not a claim that all Karbon mandates are invoice-bound. The 22 October reminder-consent and edit-to-pause ruling in BILL-004 remains in force.

**Single placement:** State the authority rule once in PAY-001; BILL-004 cites PAY-001 for quick collect and retains its existing reminder-consent rider.

**Engineering/proof boundary:** No policy approval can prove recurring mandates, method migration, provider-record erasure or expiry. Preserve every current Gap; neither row is promoted.

**Sources:**
- [Clients pay through the portal; saved details can autodraft due invoices.](https://karbonhq.com/feature/billing-and-payments)
- [Removing a saved method stops autopay; resumption requires manual re-enablement.](https://help.karbonhq.com/en/articles/10292631-remove-and-update-payment-details-in-karbon-billing)
- [Saved methods require explicit consent for the disclosed future use.](https://docs.stripe.com/payments/save-during-payment)
