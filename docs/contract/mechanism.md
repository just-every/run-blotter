# Blotter contract mechanism

Details accompanying the product promises. Historical implementation descriptions are kept in CHANGELOG.md; these details specify the named mechanism.

## WORK-002 — Semantics (WORK-002)

The lead time is whole months: a period's job is created once the run's UTC calendar date reaches its start less the lead time.

## WORK-002 — Semantics (WORK-002)

The scheduler is an hourly Cron Trigger (minute 17, UTC; `rer dev` runs it; deploys register it) plus Run now; each run creates, in order, every period through the horizon not yet held (generated, claimed or skipped), so restarts repeat nothing and runs after downtime or a pause catch up.

## CRM-005 — Public intake (CRM-005; ct 19 Oct 10:05Z)

Spam checks are a honeypot, an installation-signed single-use form token valid from 3 seconds through 24 hours after issue, and at most five accepted submissions per connection in a rolling hour.

## CRM-005 — Public intake (CRM-005; ct 19 Oct 10:05Z)

Rate-limit IPs are kept only as installation-keyed digests with one-hour expiry, excluded from archives and cleared on accepted submissions and the hourly trigger; raw IPs are never stored.

## SIGN-002 — Semantic implemented (sx-blotter-c37)

A staff representative is named as a signer, receives no portal link, and signs with the same consent and intent at `/signatures/:id/staff-sign` in their own authenticated session (the session id stands in for the portal link on the certificate); they need no attestation.

## PORTAL-005 — Implemented native completion (sx-blotter-c40, 22 Oct)

One shared catalog (`src/i18n`) supplies every client-facing string, so the portal page and its progress, requests, shared files, messages, to-dos, tasks, organizers, signature requests, deliverables and shared logins, the invoice page, the request, organizer-invitation, deliverable, signature, invoice and invoice-reminder emails, the marketing footer and the marketing unsubscribe page read in the contact's language, with the page language attribute, dates and amounts following it.

## API-002 — Implemented native read slice (API-002)

authenticated staff can traverse versioned `/api/blotter/v1/work`, `/api/blotter/v1/time` and `/api/blotter/v1/clients` pages with `{items,nextCursor}` responses.

## API-002 — Native billing-export read slice (API-002)

GET `/api/blotter/v1/billing/exports` retains native principal/reviewer financial authority and MFA, returning the native export metadata and snapshot string plus explicit snapshot currency (historical currency-less snapshots remain AUD), never CSV bytes.

## API-002 — Native client write slice (API-002)

POST `/api/blotter/v1/clients` shares native client validation, contacts, required fields, current principal/reviewer authority and per-session MFA.

## API-002 — Implemented integration boundary (API-002, ct 21 Oct key authority)

Named public-door proof: `tests/blotter/integration-keys.test.mjs` (lifecycle, task events, rolling limit, erasure and metadata journeys), `tests/blotter/integration-webhooks.test.mjs` (thin signed completion webhook journey) and `tests/blotter/integration-ui.mjs` (`integrationTaskJourney`, 1440 and 390).

## VAULT-001 — Current semantics

credentials are AES-GCM ciphertext under the firm's vault key, derived from the installation's own VAULT_KEY secret (never the session secret) and the firm's random salt; one installation is one firm, and without VAULT_KEY the vault refuses to store or reveal.

## VAULT-001 — Current semantics

Archives carry the ciphertext (default), readable only where the same VAULT_KEY is configured, or leave it out; either way a restored credential that cannot be opened says so.

## ERASURE-002 — Semantic implemented (sx-blotter-c35, 22 Oct 2026, to ct's ruling above)

It keeps signed-off work (accepted documents, organizer originals submitted before sign-off, consumed readiness decisions, approved deliverables), signed engagements and the entries approved billing exports snapshotted; replaces other payloads with the marker; deletes derived data (extracted text, agent plans and outputs, undecided readiness preparations; there is no stored summary or search index: search reads live rows); keeps the reveal log under random labels; gives the client and its contacts random `Erased client` and `Erased contact` labels; seals the legal name, taxpayer identifier and address under the vault key behind the audited retained-records door; keeps only a one-way digest of an address that withdrew consent (a bounced address is dropped); and erases merged records with their survivor, refusing their unmerge.

## SIGN-001 — Detailed requirements

The record is kept for at least three years from the return due date or the IRS received date, whichever is later, and ERASURE-002 cannot delete it sooner. Until every required signature is present, the work item cannot enter its ready-to-file status (WORK-007). Blotter never marks a return filed: transmitted, accepted and rejected states come only from INTEGRATE-008 evidence. FOLLOWUP-001 chases unsigned forms.

## WORK-007 — Detailed requirements

Entering In review or Completed still requires the REVIEW-001 gates, and no sub-status can bypass them. Every status change records who made it, when, and the old and new status. Renaming a sub-status keeps history. Deleting a sub-status that jobs still use is refused until a previewed bulk reassignment moves those jobs to another permitted status.

## WORK-009 — Detailed requirements

Task start and due dates are whole days before or after the work's start or due date and are computed when read, so open tasks follow every change to the job's due date or people; completing a task records its completer and time and keeps the owner and dates it had then. A task may be assigned by name to any active practice member or the principal; that person can then read the job and act on their own tasks (ACCESS-001). A task that needs an attachment completes only with one. A client-facing task shows only its name, due date and done state on the client's link; PORTAL-003 inherits client-facing tasks before it ships. Until WORK-006 ships, a person's weekly plan for a Monday-to-Sunday week lists their open tasks due in or before that week or with no due date, and their open jobs as preparer, reviewer or manager due in or before it; WORK-006 inherits tasks before it ships.

## MSG-001 — Detailed requirements

Templates have categories and search, and only permitted roles can edit firm templates. Until a second editing role exists, only the principal creates, edits and deletes firm templates. The contact first name is the first word of the contact's recorded name until CRM-001 stores names in parts; the work type is the engagement template's name until WORK-007; the invoice amount and due date stay unresolved, so sending is refused, until BILL-002 issues invoices; the portal link is created only when the message is sent.

## TIME-004 — Detailed requirements

Staff-paid expenses are owed back to that person at cost, and the principal records each reimbursement. Until BILL-002 issues invoice documents, an expense's invoice line is its line in the reviewed billing export, reserved once; BILL-002 inherits approved billable expenses as invoice lines before it ships. Until BILL-003 ships, WIP is the value of everything ready to bill, and a job's profitability is its margin before staff cost: fixed fee, approved billable time (TIME-001) and its adjustments and approved billable expense charges, less the cost of every approved expense, billable or not; BILL-003 keeps expenses in its WIP and profitability.

## MIGRATE-006 — Detailed requirements

A series Blotter cannot express exactly (an unsupported frequency, a missing template, an assignee with no matched staff member) is held for review with a named owner and listed on the cutover report; cutover cannot be approved while such a series has no owner, and no series is silently dropped or flattened into single jobs. Re-running or resuming the import matches source series and item IDs, so it never creates a second rule or a second set of future items.

## MIGRATE-007 — Detailed requirements

A cutover report lists every auto-pay client as migrated, awaiting reauthorization or declined, with owner and last chase, and updates as clients act. Each invoice has exactly one collector: source auto-pay must be recorded off for a client before Blotter's first automatic charge, and an invoice still open in the source is either left to the source or imported open with source collection stopped, so no client is charged twice across the source and Blotter.

## ACCESS-004 — Detailed requirements

An enrollment report gives evidence for the firm's WISP and the FTC Safeguards Rule (16 CFR 314.4(c)(5)); it records enrollment facts and never claims certification. Every session, whenever it began, must pass its own second-factor check before any practice data, and a person who has enrolled a factor is asked for it at every new session even while the policy is off. Until a second owner role exists, the principal recovers their own factor with a recovery code. Until ACCESS-005 or ACCESS-003 passes a provider's MFA assertion to Blotter, every federated session is treated as lacking one and is challenged for a Blotter factor. Today's sessions are browser sign-in sessions, whatever the method, and all pass the same check; MOBILE-001 apps and API-002 person-created sessions inherit it before they ship. Session lifetime (from sign-in) and idle timeout (since the session's last request) are whole minutes set by the principal; reaching either ends the session. Five incorrect codes within 15 minutes pause verification for 15 minutes.
