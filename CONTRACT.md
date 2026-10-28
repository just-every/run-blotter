# Blotter target product contract

Blotter is the practice manager a US bookkeeping or accounting firm uses to complete client engagements from signed scope through recurring work, communications, document collection, review and payment. It replaces Karbon, TaxDome and Canopy and targets the connected-close and small-firm automation depth of Financial Cents and Double. USD and US practice norms are the default.

## Product target

| | |
| --- | --- |
| Category | Accounting practice management software |
| Incumbents a buyer switches from | Karbon, TaxDome, Canopy |
| Up-and-comers it must also beat | Financial Cents, Double |
| First buyer | A US principal or operations manager of a 1–15 staff bookkeeping or accounting firm, using USD and the firm’s US time zone |

The primary journey: Agree scope, onboard the client, schedule recurring work, collect evidence, resolve questions, obtain review, deliver the work and reconcile payment.

## How to read this contract

- This follows the RER contract standard.
- Core, Agent surface and Later are counted separately.
- Done means every acceptance outcome has recorded proof on the exact candidate.
- The Field proof register keeps real-world receipts visible without blocking repository completion.
- ACCEPTANCE.md, docs/CLAIMS.md and summary counts are generated from this contract.

## Door rules

- **D-1.** Activation on practice records. Each new practice door demonstrates its own current firm/contact scope, retained source custody and source-specific recovery before activation; shared access, audit, erasure and portability duties are cited in the receiving clause.

## Shared duties (Base)

| Base duty | Duty | Delta clauses | Base journey |
| --- | --- | --- | --- |
| BASE-ACCESS-001 | Sign-in | ACCESS-001, ACCESS-002, ACCESS-007, ACCESS-003, ACCESS-008, ACCESS-004, ACCESS-005, ACCESS-006, ACCESS-009 | not run |
| BASE-ACCESS-002 | Sessions | ACCESS-001, ACCESS-002, ACCESS-007, ACCESS-003, ACCESS-008, ACCESS-004, ACCESS-005, ACCESS-006, ACCESS-009 | not run |
| BASE-ACCESS-003 | Public endpoints | none | not run |
| BASE-ACCESS-004 | Server-side authorisation | ACCESS-001, ACCESS-002, ACCESS-007, ACCESS-003, ACCESS-008, ACCESS-004, ACCESS-005, ACCESS-006, ACCESS-009 | not run |
| BASE-INPUT-001 | Validation | API-001, API-002, API-003 | not run |
| BASE-INPUT-002 | HTML | MSG-001, MSG-002 | not run |
| BASE-INPUT-003 | Uploads | PORTAL-001, PORTAL-002, PORTAL-007, PORTAL-008, PORTAL-009, PORTAL-003, PORTAL-010, PORTAL-004, PORTAL-011, PORTAL-012, PORTAL-005, DOC-001, DOC-004, DOC-005, DOC-002, DOC-006, DOC-003, PORTAL-006 | not run |
| BASE-SECRET-001 | No leakage | SECURE-001, VAULT-001 | not run |
| BASE-SECRET-002 | Startup | none | not run |
| BASE-DATA-001 | Export and import | ENGAGE-001, SIGN-001, SIGN-002, AUTHZ-001, DUE-001, DUE-004, DUE-005, DUE-003, RESOLVE-001, MAIL-001, MAIL-002, MAIL-003, MSG-002, SMS-001, NOTIFY-001, NOTIFY-002, NOTIFY-003, PORTAL-002, PORTAL-007, PORTAL-008, PORTAL-009, PORTAL-004, PORTAL-011, PORTAL-012, PORTAL-005, MOBILE-001, DOC-001, DOC-004, DOC-005, DOC-002, DOC-006, DOC-003, FOLLOWUP-001, LEDGER-001, LEDGER-002, LEDGER-003, BILL-002, BILL-006, BILL-007, PAY-001, PAY-002, BILL-003, BILL-004, BILL-005, BILL-008, REPORT-001, REPORT-002, REPORT-003, INTEGRATE-001, INTEGRATE-002, INTEGRATE-003, INTEGRATE-004, INTEGRATE-005, INTEGRATE-006, INTEGRATE-007, INTEGRATE-008, API-002, API-003, AUTOMATE-001, MIGRATE-001, MIGRATE-002, MIGRATE-003, MIGRATE-004, MIGRATE-005, MIGRATE-006, MIGRATE-008, MIGRATE-007, ACCESS-002, ACCESS-007, ACCESS-003, ACCESS-008, ACCESS-005, SECURE-001, VAULT-001, ARCHIVE-001, ARCHIVE-002, ARCHIVE-003, ERASURE-002, COST-001, AI-001, AI-002, AI-003, READY-001, READY-002, RESCUE-001, LEARN-001, REVENUE-001, ONBOARD-001, ONBOARD-002, SWITCH-001, NOTICE-001, NOTICE-003 | not run |
| BASE-DATA-002 | Retention | none | not run |
| BASE-DATA-003 | Erasure | ENGAGE-001, SIGN-001, SIGN-002, AUTHZ-001, DUE-001, DUE-004, DUE-005, DUE-003, RESOLVE-001, MAIL-001, MAIL-002, MAIL-003, MSG-002, SMS-001, NOTIFY-001, NOTIFY-002, NOTIFY-003, PORTAL-002, PORTAL-007, PORTAL-008, PORTAL-009, PORTAL-004, PORTAL-011, PORTAL-012, PORTAL-005, MOBILE-001, DOC-001, DOC-004, DOC-005, DOC-002, DOC-006, DOC-003, FOLLOWUP-001, LEDGER-001, LEDGER-002, LEDGER-003, BILL-002, BILL-006, BILL-007, PAY-001, PAY-002, BILL-003, BILL-004, BILL-005, BILL-008, REPORT-001, REPORT-002, REPORT-003, INTEGRATE-001, INTEGRATE-002, INTEGRATE-003, INTEGRATE-004, INTEGRATE-005, INTEGRATE-006, INTEGRATE-007, INTEGRATE-008, API-002, API-003, AUTOMATE-001, MIGRATE-001, MIGRATE-002, MIGRATE-003, MIGRATE-004, MIGRATE-005, MIGRATE-006, MIGRATE-008, MIGRATE-007, ACCESS-002, ACCESS-007, ACCESS-003, ACCESS-008, ACCESS-005, SECURE-001, VAULT-001, ARCHIVE-002, ARCHIVE-003, ERASURE-001, ERASURE-002, COST-001, AI-001, AI-002, AI-003, READY-001, READY-002, RESCUE-001, LEARN-001, REVENUE-001, ONBOARD-001, ONBOARD-002, SWITCH-001, NOTICE-001, NOTICE-003 | not run |
| BASE-DATA-004 | Outbound flows | none | not run |
| BASE-DATA-005 | Independence | BASE-001 | not run |
| BASE-PUBLIC-001 | Privacy | PORTAL-001, PORTAL-002, PORTAL-007, PORTAL-008, PORTAL-009, PORTAL-003, PORTAL-010, PORTAL-004, PORTAL-011, PORTAL-012, PORTAL-005, PORTAL-006 | not run |
| BASE-PUBLIC-002 | Origins | none | not run |
| BASE-PUBLIC-003 | Accessibility | none | not run |
| BASE-OPS-001 | Health | none | not run |
| BASE-OPS-002 | Migrations | BASE-001 | not run |
| BASE-OPS-003 | Idempotency | API-001, API-002, API-003 | not run |
| BASE-OPS-004 | Failure is visible | none | not run |
| BASE-OPS-005 | Audit | AUDIT-001 | not run |
| BASE-ROLE-001 | Roles through every door | PORTAL-001, ENGAGE-001, SIGN-001, SIGN-002, AUTHZ-001, DUE-001, DUE-004, DUE-005, DUE-003, RESOLVE-001, MAIL-001, MAIL-002, MAIL-003, MSG-002, SMS-001, NOTIFY-001, NOTIFY-002, NOTIFY-003, PORTAL-002, PORTAL-007, PORTAL-008, PORTAL-009, PORTAL-003, PORTAL-010, PORTAL-004, PORTAL-011, PORTAL-012, PORTAL-005, MOBILE-001, DOC-001, DOC-004, DOC-005, FOLLOWUP-001, LEDGER-001, LEDGER-002, LEDGER-003, BILL-002, BILL-006, BILL-007, PAY-001, PAY-002, BILL-003, BILL-004, BILL-005, BILL-008, REPORT-001, REPORT-002, REPORT-003, INTEGRATE-001, INTEGRATE-002, INTEGRATE-003, INTEGRATE-004, INTEGRATE-005, INTEGRATE-006, INTEGRATE-007, INTEGRATE-008, API-001, API-002, API-003, AUTOMATE-001, MIGRATE-001, MIGRATE-002, MIGRATE-003, MIGRATE-004, MIGRATE-005, MIGRATE-006, MIGRATE-008, MIGRATE-007, ACCESS-001, ACCESS-002, ACCESS-007, ACCESS-003, ACCESS-008, ACCESS-004, ACCESS-005, ACCESS-006, ACCESS-009, SECURE-001, VAULT-001, ARCHIVE-002, ARCHIVE-003, ERASURE-002, COST-001, AI-001, AI-002, AI-003, PORTAL-006, READY-001, READY-002, RESCUE-001, LEARN-001, REVENUE-001, ONBOARD-001, ONBOARD-002, SWITCH-001, NOTICE-001, NOTICE-003 | not run |
| BASE-AUDIT-001 | Searchable, durable audit | ENGAGE-001, SIGN-001, SIGN-002, AUTHZ-001, DUE-001, DUE-004, DUE-005, DUE-003, RESOLVE-001, MAIL-001, MAIL-002, MAIL-003, MSG-002, SMS-001, NOTIFY-001, NOTIFY-002, NOTIFY-003, PORTAL-002, PORTAL-007, PORTAL-008, PORTAL-009, PORTAL-004, PORTAL-011, PORTAL-012, PORTAL-005, MOBILE-001, DOC-001, DOC-004, DOC-005, FOLLOWUP-001, LEDGER-001, LEDGER-002, LEDGER-003, BILL-002, BILL-006, BILL-007, PAY-001, PAY-002, BILL-003, BILL-004, BILL-005, BILL-008, REPORT-001, REPORT-002, REPORT-003, INTEGRATE-001, INTEGRATE-002, INTEGRATE-003, INTEGRATE-004, INTEGRATE-005, INTEGRATE-006, INTEGRATE-007, INTEGRATE-008, API-002, API-003, AUTOMATE-001, MIGRATE-001, MIGRATE-002, MIGRATE-003, MIGRATE-004, MIGRATE-005, MIGRATE-006, MIGRATE-008, MIGRATE-007, ACCESS-002, ACCESS-007, ACCESS-003, ACCESS-008, ACCESS-005, SECURE-001, VAULT-001, ARCHIVE-002, ARCHIVE-003, ERASURE-002, AUDIT-001, COST-001, AI-001, AI-002, AI-003, READY-001, READY-002, RESCUE-001, LEARN-001, REVENUE-001, ONBOARD-001, ONBOARD-002, SWITCH-001, NOTICE-001, NOTICE-003 | not run |
| BASE-BACKUP-001 | Independent backup, restore and rollback | ARCHIVE-001, ARCHIVE-002, ARCHIVE-003 | not run |
| BASE-DATA-006 | Erasure respects retention and legal hold | ERASURE-001, ERASURE-002 | not run |
| BASE-SIGNIN-001 | Standards-based SSO and lifecycle | ACCESS-001, ACCESS-002, ACCESS-007, ACCESS-003, ACCESS-008, ACCESS-004, ACCESS-005, ACCESS-006, ACCESS-009 | not run |
| BASE-SIGNIN-002 | Native multi-factor authentication | ACCESS-001, ACCESS-002, ACCESS-007, ACCESS-003, ACCESS-008, ACCESS-004, ACCESS-005, ACCESS-006, ACCESS-009, VAULT-001 | not run |
| BASE-INSTALL-001 | Free self-host and removal | BASE-001 | not run |
| BASE-MAIL-001 | Truthful mail outcomes | MAIL-001, MAIL-002, MAIL-003, MSG-001, MSG-002, SMS-001, NOTIFY-001, NOTIFY-002, NOTIFY-003, PAY-001, BILL-004 | not run |
| BASE-ACCESSIBILITY-001 | One accessibility bar | MOBILE-001 | not run |
| BASE-DOCS-001 | On-site docs from one contract | none | not run |
| BASE-AGENT-001 | One MCP door per seed | none | not run |
| BASE-AGENT-002 | The seed's jobs are tools, through the UI's own actions | SURFACE-001, SURFACE-009, SURFACE-010 | not run |
| BASE-AGENT-003 | Records are resources | SURFACE-002 | not run |
| BASE-AGENT-004 | Business identity and short-lived, audience-bound tokens | none | not run |
| BASE-AGENT-005 | An agent acts as a person in a role, never more | AGENT-001, SURFACE-006 | not run |
| BASE-AGENT-006 | Every action declares its risk class | SURFACE-001, SURFACE-003, SURFACE-004, SURFACE-005, SURFACE-006, SURFACE-007, SURFACE-008, SURFACE-009 | not run |
| BASE-AGENT-007 | The company's policy decides, at one chokepoint | AGENT-001, SURFACE-009, SURFACE-010, SURFACE-011, SURFACE-013 | not run |
| BASE-AGENT-008 | Truthful attribution | AGENT-001, SURFACE-004, SURFACE-005 | not run |
| BASE-AGENT-009 | Every agent action is audited with its class and decision | SURFACE-011 | not run |
| BASE-AGENT-010 | Agents can follow changes | SURFACE-002, SURFACE-010 | not run |
| BASE-AGENT-011 | Limits are policy, and Pause stops everything | SURFACE-011 | not run |
| BASE-AGENT-012 | Writes are idempotent and conflict-safe | AGENT-001 | not run |
| BASE-AGENT-013 | Manifest, docs and the conformance journey | SURFACE-012, SURFACE-013 | not run |

## Published clauses

- `WORK-002`: *Tier:* Core · *From:* WORK-002
- `WORK-010`: *Tier:* Core · *From:* WORK-002
- `PORTAL-001`: *Tier:* Core · *Cites:* BASE-INPUT-003, BASE-PUBLIC-001, BASE-ROLE-001 · *Register:* R-8
- `REVIEW-001`: *Tier:* Core

### WORK capabilities — published

#### WORK-002 — Automatic recurring work and roll forward

**Requirement.** Approved recurrence rules create the next period automatically with assigned staff, fresh requests, dependencies, budget and calculated due dates. Support monthly closes, quarterly payroll/sales tax, annual returns and custom schedules, including fiscal-year ends. Each rule has a creation lead time (how far ahead of a period's start its work is created, set by the firm, for example three months as in Karbon) and an end date. A rule may already hold future periods, whether it generated them or a migration imported and claimed them (MIGRATE-006); a period the rule already holds is never generated again, and the next generated period follows the last held one without a gap. Preview the schedule, pause/skip a period and catch up after downtime without duplicate client-period engagements; historical sign-offs remain immutable. [Capability rules](docs/contract/work-002.md) define its record and recovery details.

**Acceptance.**
1. Enable monthly and fiscal-year recurrence with a three-month lead time, let scheduled work become due and inspect exactly the periods inside the lead time, each once, with fresh requests.
2. Attach two existing future jobs to a monthly rule and advance the horizon; the rule creates only the following period.
3. Restart the scheduler, pause a client, skip a period and override a due date; no duplicate or silently altered prior job appears.
4. Periods start on the first period's day in the chosen months, which are the template's own monthly, quarterly or annual cadence or a subset of it (custom schedules); a fiscal year is an annual first period in its first month.
5. The end date is the last period's start, inclusive.
6. The lead time is whole months: a period's job is created once the run's UTC calendar date reaches its start less the lead time.
7. Its due date is the period's last day plus the rule's calendar days (a firm rule), or, when the rule names a client obligation, that obligation's calculated working due date for the period (DUE-001, DUE-003), shown in the rule's preview and stored with each job it creates.

#### WORK-010 — Recurring job custody and catch-up

**Requirement.** Automatic recurring work and roll forward includes capability journey on the same client, engagement and current source records. [Capability rules](docs/contract/work-002.md) define its record and recovery details.

**Acceptance.**
1. Budget is the rule's time budget in minutes, copied to each job; staff, fresh document requests and the template's task dependencies (WORK-003) come with each job.
2. The scheduler is an hourly Cron Trigger (minute 17, UTC; `rer dev` runs it; deploys register it) plus Run now; each run creates, in order, every period through the horizon not yet held (generated, claimed or skipped), so restarts repeat nothing and runs after downtime or a pause catch up.
3. A job that already exists for the client, template and period is claimed instead of duplicated; staff may also claim one, and imported future items (MIGRATE-006) must be claimed the same way before that clause ships.
4. Skipping needs a reason.
5. A rule whose people can no longer do the work is held and named in the run log, never reassigned.
6. Created jobs are never changed by a rule: a person overrides a due date on the job, and sign-offs stay immutable.

### PORTAL capabilities — published

#### PORTAL-001 — Private document requests and uploads

**Requirement.** Staff send outstanding document requests using a private expiring upload link. The client can upload files without an account; staff download, accept or return them with a precise note. Link rotation revokes its predecessor, job completion closes collection, raw link secrets are not retained and upload limits are explicit. Firm-defined request wording uses MSG-001 templates. [Capability rules](docs/contract/portal-001.md) define its record and recovery details.

**Acceptance.**
1. Send a request, rotate its link, refuse the old link and cross-origin upload, upload within the displayed limit and reject an oversized file.
2. Download and accept the files, sign off the job and verify collection closes.

### REVIEW capabilities — published

#### REVIEW-001 — Independent reviewer sign off

**Requirement.** The preparer completes all checklist and accepted-document gates, submits to the assigned reviewer and receives approval or a recorded request for change. Sign-off requires a note, rejects preparer self-review, records who and when, closes collection and prevents later checklist edits to signed-off evidence. [Capability rules](docs/contract/review-001.md) define its record and recovery details.

**Acceptance.**
1. Attempt premature submission, complete the evidence and submit.
2. Refuse preparer sign-off, approve as the assigned reviewer with a note, inspect identity/time and verify the closed portal and blocked signed-off checklist edits.

## Target clauses

### US capabilities

#### US-001 — US firm setup and currency

*Tier:* Core

**Requirement.** A US principal configures a firm in USD with US addresses, EIN/entity classifications, fiscal years, service lines, time zones and notification hours. Money uses integer cents and explicit currency; US 1099/W-2, federal/state tax and sales-tax engagements have appropriate terminology. Historical AUD records retain their currency and are never relabeled USD. [Capability rules](docs/contract/us-001.md) define its record and recovery details.

**Acceptance.**
1. Set up a US bookkeeping and tax practice, add an LLC and individual client, select USD and America/New_York, and create payroll, sales-tax and annual-tax work.
2. Inspect currency and dates across a daylight-saving change; imported AUD history remains AUD.
3. Existing money rows and historical export snapshots remain AUD, with no conversion or relabeling.
4. Jobs inherit their template currency, time requires a rate in that currency, mixed-currency exports are refused, and WIP, reimbursement and pipeline fee totals are grouped by currency.
5. New client EINs accept nine digits; eleven-digit ABNs remain legacy ABNs.
6. Native and CSV inputs retain that distinction, and search keeps SEARCH-001 role restrictions and last-four masking.
7. The demo uses US filings and America/New_York office instants, using each date’s daylight-saving offset.

### CRM capabilities

#### CRM-001 — Client entities and contacts

*Tier:* Core · *From:* CRM-001

**Requirement.** Manage individuals, businesses and trusts with multiple contacts, authorized signers, portal users, responsible partner, assigned team, service scope, lifecycle and consent preferences. Contacts carry roles (primary, billing, tax, bookkeeping) that route invoices, requests and signatures. A contact may represent several entities without sharing their private records; duplicates are merged under CRM-004. Search, edit, archive and reactivate clients without losing engagement history. [Capability rules](docs/contract/crm-001.md) define its record and recovery details.

**Acceptance.**
1. Create a business with two contacts and an individual linked to its owner; assign different staff and portal permissions, change a contact, archive/reactivate the business and inspect retained jobs.
2. A contact without entity authority cannot read its records.
3. Each contact relationship belongs to one entity; the same normalized email may represent several entities without pooling authority.
4. Staff explicitly record primary/billing/tax/bookkeeping roles, signer authority, portal permission and request/email consent, with a note.
5. Existing single contacts retain only their existing entity's collection authority.
6. Requests and deliverables choose an authorized, consented recipient explicitly or the unique primary contact; ambiguous primaries refuse a send.
7. A job link authenticates possession only and is bound to that entity/contact; contact edits revoke its old links, and every portal read/write rechecks active entity, authority and consent.
8. PORTAL-002 inherits identified portal accounts, recovery and MFA; BILL-002 and SIGN-001/SIGN-002/ENGAGE-001 inherit billing/tax/signer routing before those capabilities ship.

#### CRM-006 — Contact authority and lifecycle carriers

*Tier:* Core · *From:* CRM-001

**Requirement.** Client entities and contacts includes capability journey on the same client, engagement and current source records. [Capability rules](docs/contract/crm-001.md) define its record and recovery details.

**Acceptance.**
1. ACCESS-002 inherits configurable staff grants; assignments today never widen existing job visibility.
2. Archive blocks new work, recurrence generation and client sends while preserving engagements/history; reactivation allows fresh links but never revives revoked ones.
3. Phone normalization removes punctuation, adds +1 to ten-digit US numbers and otherwise requires a country code (8–15 digits); duplicate proposals use exact normalized phone.
4. Individuals store only four SSN digits, never a full SSN; matching/search is principal/reviewer-only and output is masked.
5. Contact merges need the principal's per-contact recorded authority whenever either side would gain records, preserve distinct relationships without combining consent, revoke old links, and support CRM-004's unchanged 30-day undo.
6. Prospect conversion copies all additional contacts once.
7. Offboarding previews and transfers partner/team responsibilities; archive restore preserves contact grants and lifecycle.

#### CRM-002 — Client groups and custom fields

*Tier:* Core

**Requirement.** Group related entities and households, capture typed firm-defined fields and tags, filter a segment and apply reviewed bulk updates or work creation. Required-field validation and permissions apply to imported and API-created records too.

**Acceptance.**
1. Group a parent, subsidiary and household; add a fiscal-year and service-tier field, filter the group and schedule its annual work.
2. Preview a bulk field change, reject one invalid value and confirm unrelated clients are unchanged.

#### CRM-003 — Engagement history and accountable ownership

*Tier:* Core · *From:* CRM-003

**Requirement.** Each client and engagement has a searchable chronological history of email, portal messages, documents, requests, assignments, reviews, deadlines, signed scope and billing outcomes. Every unresolved item has a responsible person, next action and due condition; closing a message alone does not complete the engagement. [Capability rules](docs/contract/crm-003.md) define its record and recovery details.

**Acceptance.**
1. Open a client after two periods of work and trace a request from email through upload, review and payment.
2. Filter unresolved items, change their owner and inspect authors, source links and timestamps; a preparer sees only authorized history.
3. Unresolved items are open requests (owner: the job's preparer), open tasks (their named or role owner), jobs in review (the reviewer), open discussions (their owner) and open notices (their assignee), each with its next action and due condition (the job's due date, a follow-up date or a response date), filterable by owner; resolving a discussion completes nothing else.
4. A reviewer or the principal hands an item to another person: a request's owner is its job's preparer and a review's its reviewer, so those reassign the job and nobody is made to review their own work; a task is assigned by name (WORK-009 read access); a discussion goes only to someone who can read it; every handover is audited.
5. A preparer sees only the jobs they may read (ACCESS-001), and client-wide records and exports only reach reviewers and the principal.

#### CRM-007 — Client-history integration carriers

*Tier:* Core · *From:* CRM-003

**Requirement.** Engagement history and accountable ownership includes capability journey on the same client, engagement and current source records. [Capability rules](docs/contract/crm-003.md) define its record and recovery details.

**Acceptance.**
1. Today's email is the document reminder; connected-mailbox email (MAIL-001), portal messages (PORTAL-003), signed scope (ENGAGE-001), invoices (BILL-002) and payments (PAY-001) write their events into this history, with author, time and source link and the same visibility, before they ship.

#### CRM-004 — Merge duplicate clients and contacts

*Tier:* Core

**Requirement.** Blotter proposes likely duplicate clients and contacts after an import, email auto-match, portal sign-up or connector sync, using matching email, phone, EIN, last four SSN digits and name similarity. Staff compare the records side by side, choose the surviving value for each field and merge. Work, tasks, email threads, documents, organizers, signatures, invoices, payments, portal users and history move to the survivor with an audit record. Source IDs from both records (Karbon, TaxDome, Canopy, QBO, Xero) stay attached so later imports and syncs match the survivor. A merge that would give one contact access to another entity's private records without authority is refused. [Capability rules](docs/contract/crm-004.md) define its record and recovery details.

**Acceptance.**
1. Import a Karbon client that duplicates a native client and accept the suggested match.
2. Choose field values, merge, and inspect the moved jobs, email, invoices and portal access on the survivor with exactly one QBO mapping.
3. Undo the merge before further edits and inspect the restored records; then repeat the merge, re-run the import and confirm it matches the survivor without creating a duplicate.
4. A merge joining two unrelated entities' contacts without authority is refused.
5. Phone and last-four SSN matches join when CRM-001 stores them, before CRM-001 ships.
6. A person may record, with a reason, that a proposed pair is two different clients; it is not proposed again.

#### CRM-005 — Prospects intake and onboarding pipeline

*Tier:* Core · *From:* CRM-005

**Requirement.** Track prospects through firm-defined stages (for example inquiry, consult booked, proposal sent, won, lost) with lead source, requested services, estimated annual fees and owner. An embeddable, spam-protected website intake form creates a prospect with its answers and uploads. A consult can be booked under INTEGRATE-005 and a proposal sent under ENGAGE-001 or INTEGRATE-004. Winning converts the prospect into exactly one client with contacts, signed scope and documents and starts onboarding work. Lost prospects keep a required reason. A pipeline report shows conversion, stage age and fee totals by source and owner. [Capability rules](docs/contract/crm-005.md) define its record and recovery details.

**Acceptance.**
1. Submit the embedded intake form and inspect the new prospect with source and answers; a spam submission is rejected.
2. Book a consult, send a proposal and accept it; confirm one client with contacts, signed scope and onboarding work, and repeat the acceptance event without a second client.
3. Mark another prospect lost with a reason and inspect the pipeline report's conversion, stage age and fee totals.
4. A prospect carries its name, contact, lead source, requested services, estimated annual fees (integer cents) and owner (an active member); every stage change is kept with who and when.
5. Moving to Lost needs a reason; Won is reached only by winning.
6. Winning converts the prospect, in one batch, into exactly one client (its name and contact, the firm's required client fields supplied) and starts its onboarding job from a chosen template (preparer, reviewer, period, due date and its source); a repeated win returns that client and job and creates nothing, and a won prospect cannot be moved or lost again.

#### CRM-008 — Prospect pipeline forecasts and stages

*Tier:* Core · *From:* CRM-005

**Requirement.** Prospects intake and onboarding pipeline includes capability journey on the same client, engagement and current source records. [Capability rules](docs/contract/crm-005.md) define its record and recovery details.

**Acceptance.**
1. The pipeline report, as of now in whole UTC days rounded down, gives per lead source and per owner the prospects, open, won and lost counts, conversion (won as a whole percentage of won plus lost; none until one closes) and open, won and lost fee totals grouped by stored currency, and per open stage the prospects in it with their average and oldest days in that stage.

### ENGAGE capabilities

#### ENGAGE-001 — Proposals engagement letters and signatures

*Tier:* Core · *Cites:* BASE-AUDIT-001, BASE-DATA-001, BASE-DATA-003, BASE-ROLE-001 · *Register:* R-5

**Requirement.** Build service proposals and versioned engagement letters with scope, exclusions, USD fees, retainer terms, renewal and amendment rules. Send to authorized signers, collect electronic signatures with signer authority, consent, timestamps and a downloadable certificate, then launch onboarding once. Preserve declined, expired, superseded and partially signed states. IRS e-file signature authorizations (Forms 8879, 8879-S, 8879-PE, 8879-C, 8879-F and 8878) are owned by SIGN-001, which states the signers, KBA, fallback, record and retention rules; other signed documents use SIGN-002. [Capability rules](docs/contract/engage-001.md) define its record and recovery details.

**Acceptance.**
1. Send a two-signer proposal, amend it before completion and verify the old version cannot bind the new terms.
2. Complete signatures, download the signed letter/certificate and inspect one onboarding job; decline another and inspect its retained declined state.
3. Collect a married-filing-jointly Form 8879 under SIGN-001's acceptance.
4. the signed letter appears in the client history with its signer and time.

### SIGN capabilities

#### SIGN-001 — IRS e-file signature authorizations with KBA

*Tier:* Core · *Cites:* BASE-AUDIT-001, BASE-DATA-001, BASE-DATA-003, BASE-ROLE-001 · *Register:* R-5

**Requirement.** Blotter collects IRS e-file signature authorizations: Forms 8879, 8879-S, 8879-PE, 8879-C, 8879-F and 8878. The practitioner attaches the final form produced by the tax software (INTEGRATE-002) to the client-year return engagement. Blotter sends it to every required signer: both spouses for married filing jointly, an officer for an 1120-S or 1120, and a partner or LLC member for a 1065. For remote signing, each signer passes knowledge-based authentication (KBA) through the identity provider, with their own credentials. A failed KBA attempt can be retried. After three failed attempts, electronic signing stops for that signer and Blotter creates a handwritten-signature task with the printable form, following the IRS e-signature rules for these forms. The record kept against the return engagement contains the signed PDF, the provider certificate and audit trail, and for each signer the name, timestamp, IP address, login ID and every KBA result. It also holds the document hash. The record is kept for at least three years from the return due date or the IRS received date, whichever is later, and ERASURE-002 cannot delete it sooner. Until every required signature is present, the work item cannot enter its ready-to-file status (WORK-007). Blotter never marks a return filed: transmitted, accepted and rejected states come only from INTEGRATE-008 evidence. FOLLOWUP-001 chases unsigned forms. [Capability rules](docs/contract/sign-001.md) define its record and recovery details.

**Acceptance.**
1. Attach a Form 8879 to a married-filing-jointly 1040 engagement and send it to both spouses through the KBA provider at its test edge.
2. Make one spouse fail KBA once and pass on retry.
3. Make the second spouse fail three times, and confirm electronic signing is refused for them and a handwritten-signature task with the printable form is created.
4. Before both signatures exist, moving the work to ready to file is refused.
5. After the wet signature is uploaded, the move is allowed.
6. Inspect the stored signed PDF, certificate, per-signer IP address, login ID and KBA attempts on the 1040 engagement, and confirm a retention date three years after the later of due date and received date.
7. Erasure before that date is refused.
8. The return stays unfiled until an INTEGRATE-008 acceptance arrives, and an unsigned form is chased under FOLLOWUP-001.

#### SIGN-002 — General document signature requests

*Tier:* Core · *Cites:* BASE-AUDIT-001, BASE-DATA-001, BASE-DATA-003, BASE-ROLE-001 · *Register:* R-5

**Requirement.** Staff request signatures on any firm document, for example a Form 2848 or 8821 (AUTHZ-001), a bank authorization, a management representation letter or a W-9. They place signature, initial, date and text fields on the PDF and choose one or more signers in sequential or parallel order. Signers give ESIGN Act and UETA consent, or pass KBA when the form requires it. Requests can be voided, declined with a reason and resent. FOLLOWUP-001 chases unsigned requests. The signed PDF and its certificate are filed to the client and work item with a timeline entry. [Capability rules](docs/contract/sign-002.md) define its record and recovery details.

**Acceptance.**
1. Place fields on a PDF and request sequential signatures from two contacts.
2. The first signer declines with a reason; resend the request, then complete both signatures.
3. Inspect the signed file, its certificate, the signing order and the timeline on the client and work item.
4. A voided request cannot be signed afterwards, and a contact who is not a signer cannot open it.
5. offboard a preparer with a pending signature request; it is listed, follows the successor, and no request is left owned by the deactivated member.

### AUTHZ capabilities

#### AUTHZ-001 — Taxpayer authorizations 2848 and 8821

*Tier:* Core · *Cites:* BASE-AUDIT-001, BASE-DATA-001, BASE-DATA-003, BASE-ROLE-001 · *Register:* R-5

**Requirement.** Track IRS Form 2848 powers of attorney, Form 8821 tax information authorizations and state equivalents for each client. Each record holds the representative and CAF number, the tax matters, forms and periods covered, the signature date, the submission method (IRS online submission, Tax Pro Account or fax) and the recorded, rejected or withdrawn status. Blotter prepares the form from client and representative data for signature under SIGN-002 and files the signed copy. Transcript requests (INTEGRATE-006) and agency contact on notices (DUE-002) are blocked outside the scope of a recorded authorization. An alert fires before the covered periods run out for continuing engagements. [Capability rules](docs/contract/authz-001.md) define its record and recovery details.

**Acceptance.**
1. Prepare a 2848 covering Form 1040 for 2022–2025, collect the client's and representative's signatures, and record its online submission and CAF-recorded status.
2. Request a 2021 transcript and confirm it is blocked as outside the authorization's scope, while a 2024 request proceeds.
3. Withdraw the authorization and confirm the dependent notice work is flagged and new transcript requests are refused.
4. A transcript request is recorded only inside a recorded 2848 or 8821 covering its form and year (retrieval is INTEGRATE-006).
5. Agency contact on a DUE-002 notice needs a recorded 2848 (federal) or the state agency's recorded authorization covering the year in the notice's tax period.
6. Withdrawal writes a flag into the timeline of each open notice it covered, ends its transcript requests and refuses new ones.
7. From October 1 of an authorization's last covered year, a client with an open job or active recurring rule raises one 'Authorization coverage ending' notification to the staff representative (or the principal), through the existing notification preferences, quiet hours and live authority.
8. Every step is in the client's history; the records are portable and join the signed_documents (authorizations, representative and CAF redacted on client erasure) and structure (transcript requests) classes.

### WORK capabilities

#### WORK-001 — Reusable engagement templates

*Tier:* Core

**Requirement.** A principal or reviewer creates reusable monthly, quarterly or annual templates containing a checklist, document request list and fixed fee. Starting an engagement copies the template into its own period work so staff have concrete tasks and requests. Work types and statuses are WORK-007; task-level owners and dates are WORK-009; the maintained US starter library is WORK-008.

**Acceptance.**
1. Through the app or authenticated HTTP doors, create a recurring template, start a client job and inspect copied checklist, requests, recurrence, fee, preparer and reviewer.
2. A preparer cannot create templates.

#### WORK-003 — Dependencies and conditional workflow

*Tier:* Core · *From:* WORK-003

**Requirement.** Templates define task dependencies, conditional branches, required evidence and preparer/reviewer gates across jobs. Completion events advance only eligible steps, with visible reasons for blocked work; a dependency cycle is rejected and an authorized exception requires a recorded reason. [Capability rules](docs/contract/work-003.md) define its record and recovery details.

**Acceptance.**
1. Create a close feeding a tax engagement, branch on an organizer answer and complete prerequisite tasks.
2. Inspect automatic advancement and blocked successors; reject a cycle and record an authorized exception without fabricating evidence.
3. A task may apply only when a job question has one of the chosen answers: unanswered, it waits; answered otherwise, it does not apply, is not needed for review, and counts as satisfied for tasks waiting on it.
4. Job staff can record workflow questions directly; confirmed PORTAL-004 submissions write their validated bound choices to those same questions, with contact attribution.
5. Drafts and unconfirmed carried values never choose a workflow branch; future answer sources inherit those rules before shipping.
6. Completion events (task done or reopened, document accepted, answer, job submitted, returned or signed off, exception) stamp each gated task that became ready and alert its owner, and clear the stamp when it is blocked again.
7. A cycle among a template's tasks is refused when it is saved; templates are saved as new versions that may wait only on templates that already exist, so cross-job waits cannot form a cycle.

#### WORK-011 — Dependency exceptions and client isolation

*Tier:* Core · *From:* WORK-003

**Requirement.** Dependencies and conditional workflow includes capability journey on the same client, engagement and current source records. [Capability rules](docs/contract/work-003.md) define its record and recovery details.

**Acceptance.**
1. The job's reviewer, its manager or the principal may record an exception with a required reason: the task can then be worked, but nothing it waited for is completed, its own required attachment is still required, review still needs every applicable task done and every document accepted, and an unanswered branch question is never waived.

#### WORK-004 — Bulk work scheduling and assignment

*Tier:* Core

**Requirement.** Preview and create or reschedule work for a selected client segment in bulk, resolving preparer/reviewer roles, staff eligibility and client-specific exceptions. Changes show impacted jobs and conflicts before approval and preserve existing work and independent review. Until CRM-002 client groups exist, the bulk segment is the clients selected in the batch, with include/exclude per client; once CRM-002 lands, choosing a group pre-selects its clients. Bulk start refuses any self-review assignment, including a principal as both preparer and reviewer. A solo principal starts such a job one at a time, where REVIEW-001’s acknowledged self-review applies.

**Acceptance.**
1. Preview quarterly jobs for the clients selected in a batch using per-client include/exclude; once CRM-002 client groups exist, verify choosing a group pre-selects its clients.
2. Override two assignees, exclude one client and commit.
3. Re-submit the same batch and inspect no duplicates, then bulk reassign work while refusing inactive or self-review assignments.
4. Verify bulk start refuses every self-review assignment, including a principal assigned as both preparer and reviewer; verify a solo principal can instead start such a job one at a time with REVIEW-001’s acknowledged self-review.

#### WORK-005 — Firm work queues

*Tier:* Core

**Requirement.** Staff see a due-date-ordered work queue with client, period, preparer, reviewer, status and outstanding checklist/document counts. Preparers see their assigned jobs; principals and reviewers see firm work and can open its detail.

**Acceptance.**
1. Create two jobs for different preparers, open the work queue as each role and inspect dates, assignees, status and outstanding counts.
2. Directly requesting another preparer's hidden job is refused.

#### WORK-006 — Personal plans boards and calendars

*Tier:* Core · *From:* WORK-006

**Requirement.** Provide a weekly personal action plan of the person's jobs and tasks (WORK-009), Kanban boards and firm/client calendars filtered by work type, primary status, sub-status, assignee, due date, blocked status and priority. Board columns are the firm's primary statuses, or the selected work type's sub-statuses (WORK-007). Moving a card sets that status on the underlying job, respects workflow and review gates and fires status automations; calendar changes show deadline and capacity consequences. [Capability rules](docs/contract/work-006.md) define its record and recovery details.

**Acceptance.**
1. Plan a preparer's week from the overdue queue, group a 1040 board by sub-status, move an eligible card and inspect the same job's new status in queue, calendar and client views.
2. A blocked review transition is refused and filters persist after refresh.
3. the moved card's change appears in the job's status history.
4. Each person plans their own week; until an admin role exists the principal opens and plans anyone's (pattern 2).
5. Boards, calendars and the queue share filters over the jobs a person may read: work type, stage, sub-status, client, assignee (the job's preparer, reviewer, manager or partner), due dates as an inclusive range, overdue (due before today in UTC and not completed), blocked (open with remaining tasks of which none is ready, each waiting on a WORK-003 dependency or answer, with those reasons shown) and priority (Low, Normal or High, Normal by default, set by the job's people until it is completed).
6. A board has a column per stage, or for one chosen work type a column per stage and each sub-status that type may use (plus In review – partner sign-off when a job is in it); a card move is WORK-007's move, so In review and Completed are reached only by submission and sign-off.

#### WORK-012 — Firm calendar and due-date changes

*Tier:* Core · *From:* WORK-006

**Requirement.** Personal plans boards and calendars includes capability journey on the same client, engagement and current source records. [Capability rules](docs/contract/work-006.md) define its record and recovery details.

**Acceptance.**
1. The firm calendar shows jobs and their open tasks on their due dates over at most 62 days; the client filter makes it one client's calendar.
2. Moving a job's due date on the calendar is WORK-004's reschedule (principal or reviewer): its preview lists the task dates that follow it, anything that would fall due before today, and each person's estimated demand against available hours (CAPACITY-001) in every week the job's estimated work leaves or enters, and it commits only with that preview's fingerprint.
3. Each person's last board filters (with the column grouping) and calendar filters are kept for them, so a refresh opens the same view.

#### WORK-007 — Firm work types and status model

*Tier:* Core · *From:* WORK-007

**Requirement.** The firm defines work types such as Monthly Bookkeeping, 1040, 1120-S, Payroll Quarterly, Sales Tax, Advisory and internal firm work. Each type has a default template, job roles (for example Manager, Preparer, Reviewer and Partner sign-off), default budget hours, a color and its permitted statuses. Every work item carries exactly one work type and one status. The status is one of six fixed primary stages (Planned, Ready to start, In progress, Waiting, In review, Completed) plus optional firm-defined sub-statuses under each stage, for example "Waiting – on client documents" or "In progress – ready to file". The firm limits each sub-status to selected work types. Statuses drive Kanban columns and personal plans (WORK-006), queue filters and saved views, automation triggers and actions (AUTOMATE-001), client-facing progress labels (PORTAL-003) and status reports (REPORT-001), including counts and time in each status. Entering In review or Completed still requires the REVIEW-001 gates, and no sub-status can bypass them. Every status change records who made it, when, and the old and new status. Renaming a sub-status keeps history. Deleting a sub-status that jobs still use is refused until a previewed bulk reassignment moves those jobs to another permitted status. [Capability rules](docs/contract/work-007.md) define its record and recovery details.

**Acceptance.**
1. Create a 1040 work type and two sub-statuses under Waiting: "on client documents" and "on 8879 signature".
2. Limit the second to 1040 and confirm it is not offered on a Monthly Bookkeeping job.
3. Move a 1040 job through both sub-statuses on the board.
4. An automation fires once on entering "on 8879 signature".
5. Filter the queue and a saved view by that sub-status, and read a time-in-status report.
6. Moving a job to Completed without review is refused.
7. Deleting a sub-status in use is refused until a previewed bulk reassignment moves its jobs; status history is retained.
8. Import a Karbon work item under MIGRATE-001 and confirm it keeps its work type and status.

#### WORK-013 — Work-type roles and dependent views

*Tier:* Core · *From:* WORK-007

**Requirement.** Firm work types and status model includes capability journey on the same client, engagement and current source records. [Capability rules](docs/contract/work-007.md) define its record and recovery details.

**Acceptance.**
1. filter the capacity week by the 1040 work type and see only 1040 demand.

#### WORK-008 — Starter US template library

*Tier:* Core · *From:* WORK-008

**Requirement.** Blotter maintains a versioned starter library of US templates that a firm can adopt and edit: monthly bookkeeping close, quarterly payroll (941, state withholding and unemployment), sales-tax filing, the 1040, 1120-S, 1065, 1120, 1041 and 990 returns, year-end 1099 and W-2, tax notice response, new-client onboarding and client offboarding. Each template carries a work type and statuses (WORK-007), tasks with relative dates and role assignments (WORK-009), request lists, an organizer (PORTAL-004), budget hours and message templates (MSG-001). Adopting a template copies that version into the firm. Library updates arrive as a previewed diff the firm accepts or ignores change by change, and they never overwrite firm edits or existing jobs. [Capability rules](docs/contract/work-008.md) define its record and recovery details.

**Acceptance.**
1. In a new US firm, browse the library and adopt the 1040 and monthly close templates.
2. Edit one task and start a job from each, then inspect the copied tasks, requests, relative dates, statuses and messages.
3. Publish a library update, preview its diff, accept one change and reject another.
4. The firm's edited task survives and existing jobs are unchanged.
5. Each adoption makes a firm template, its own WORK-007 work type with all six stages, WORK-009 role tasks and relative dates, requests, an integer-minute default budget and MSG-001 message copies.
6. Hours are minutes divided by 60, rounded to two decimals for display; planning offsets are whole days from the recorded period start or due date, not statutory calculations.
7. The principal adopts a chosen version, edits tasks, requests and budget, and edits messages through MSG-001.
8. A new job copies the then-current tasks, requests, budget and message text/version; later library changes never mutate those jobs.

#### WORK-014 — Immutable starter releases and three-way updates

*Tier:* Core · *From:* WORK-008

**Requirement.** Starter US template library includes capability journey on the same client, engagement and current source records. [Capability rules](docs/contract/work-008.md) define its record and recovery details.

**Acceptance.**
1. Authored releases are bundled with the app; a principal can import a reviewed newer release package with its source/change note and author recorded.
2. Imported releases are immutable, never claim agency verification and never change adoptions automatically.
3. An update preview compares the prior adopted release, current firm copy (including MSG-001 edits/deletions) and new release, one task, request, message, budget or description at a time.
4. Each change is accepted or ignored; a conflicting firm edit must be retained, and stale previews are refused.
5. Ignored changes remain firm choices and the reviewed release becomes the next comparison baseline.

#### WORK-009 — Task assignees due dates and instructions

*Tier:* Core

**Requirement.** Each task in a work item can have its own assignee (a named person or a job role), a start and due date relative to the work's start or due date, a time estimate, instructions with an SOP link, a required attachment and a client-facing flag (PORTAL-003). Completing a task records who completed it and when. Changing the person in a job role re-routes that role's open tasks, while completed tasks keep their completer. Personal plans (WORK-006) list the person's tasks as well as their jobs. Until WORK-007 adds firm job roles, a job's roles are Preparer, Reviewer and Manager, and the Manager is the job's reviewer unless someone is named when the job starts. The work's start date is its period start. Task start and due dates are whole days before or after the work's start or due date and are computed when read, so open tasks follow every change to the job's due date or people; completing a task records its completer and time and keeps the owner and dates it had then. A task may be assigned by name to any active practice member or the principal; that person can then read the job and act on their own tasks (ACCESS-001). A task that needs an attachment completes only with one. A client-facing task shows only its name, due date and done state on the client's link; PORTAL-003 inherits client-facing tasks before it ships. Until WORK-006 ships, a person's weekly plan for a Monday-to-Sunday week lists their open tasks due in or before that week or with no due date, and their open jobs as preparer, reviewer or manager due in or before it; WORK-006 inherits tasks before it ships.

**Acceptance.**
1. Create a template with three tasks due 10, 5 and 2 days before the work's due date, assigned to Preparer, Manager and a named person.
2. Start a job and inspect the computed task dates and owners.
3. Move the work's due date and see the open task dates follow.
4. Change the job's Preparer and confirm the open tasks move to the new person, while a completed task keeps its original completer and time.
5. Open a task's SOP link, and see the tasks in the new owner's weekly plan.

### DUE capabilities

#### DUE-001 — Sourced US obligations and extensions

*Tier:* Core · *From:* DUE-001 · *Cites:* BASE-AUDIT-001, BASE-DATA-001, BASE-DATA-003, BASE-ROLE-001

**Requirement.** Provide maintained federal and firm-selected state deadline templates for 1040, 1120-S, 1065, 941 and sales tax, with entity/period/fiscal-year applicability, weekend/holiday rules, state/local frequency and jurisdiction-specific extensions or disaster relief. Import IRS and state revenue calendar updates with source URL, effective date and rule version. A firm approves applicable rules and material changes, sees recalculated due dates and can override with reason; original, extended and internal dates remain distinct. Extension work stays open until the tax authority supplies filing evidence. [Capability rules](docs/contract/due-001.md) define its record and recovery details.

**Acceptance.**
1. Configure all five obligation types for clients in two states and different fiscal years.
2. Calculate a weekend/holiday case, import a source revision and preview affected jobs before approval.
3. Record an extension and override; verify separate original/extended/internal dates, preserved provenance and no claim of filing from a checklist.
4. Blotter does not fetch agency sites: a person imports each IRS or state revision.
5. Until an admin role exists the principal approves each catalog rule for the firm (approving a state's rule selects that state; pattern 2), and a principal or reviewer configures a client obligation: one approved rule with the client's two-letter state, fiscal-year-end month (calendar-year rules always December) and internal lead days (0–90); a rule applies only to its entity types (individual, business, trust) and a state rule only to its own state.

#### DUE-004 — Distinct statutory extended and internal dates

*Tier:* Core · *From:* DUE-001 · *Cites:* BASE-AUDIT-001, BASE-DATA-001, BASE-DATA-003, BASE-ROLE-001

**Requirement.** Sourced US obligations and extensions includes capability journey on the same client, engagement and current source records. [Capability rules](docs/contract/due-001.md) define its record and recovery details.

**Acceptance.**
1. A job started from an obligation, rolled forward from such a job, or created by a WORK-002 rule that names one takes its period from its template's cadence (starting on the first of a month; an annual period ends in the fiscal-year-end month, quarterly periods are the tax year's quarters) and keeps these dates apart: the statutory date; the original due date, which is the statutory date moved to the next business day past Saturdays, Sundays and federal legal holidays (5 U.S.C. 6103; a Saturday holiday is observed the Friday before, a Sunday one the Monday after) and, for federal rules, DC Emancipation Day (16 April, observed; 26 U.S.C. 7503), with the reason recorded; the extended due date (shifted the same way), which applies once a person on the job records the extension request, or at once for an automatic extension; a relief date from an approved disaster postponement whose jurisdiction, states, rules and inclusive window cover the original or extended date; the internal target (that external date less the obligation's lead days, moved earlier to a business day); and any override.

#### DUE-005 — Approved deadline revisions and filing evidence

*Tier:* Core · *From:* DUE-001 · *Cites:* BASE-AUDIT-001, BASE-DATA-001, BASE-DATA-003, BASE-ROLE-001

**Requirement.** Sourced US obligations and extensions includes capability journey on the same client, engagement and current source records. [Capability rules](docs/contract/due-001.md) define its record and recovery details.

**Acceptance.**
1. The job's working due date is the override, else the relief, extended or original date; an override needs a principal or reviewer and a reason and never changes a calculated date.
2. A source revision is a JSON document with version, effective date, https source and changed rules (keeping each rule's key and jurisdiction) or relief windows; only the principal previews and approves it.
3. The preview lists every job not yet signed off whose dates or rule version change, and approval commits only with that preview's fingerprint, approving the revision's rules and recalculating those jobs; a job whose working date was set by hand (an override, or a WORK-004/WORK-006 move) keeps it while its calculated dates update.
4. Filing is never inferred from a checklist, review, sign-off or status: only a recorded agency acknowledgment (submission ID, accepted date and an acknowledgment file on the job, labeled practitioner-recorded until INTEGRATE-008 supplies stack status) marks a return filed, and a job whose extension was recorded cannot be signed off until it exists (pattern 3).
5. Under the held company policy, agent keys cannot approve rules or revisions.
6. Rules, revisions, relief, obligations and job dates are carried by native archives and move with a merged client (CRM-004); the acknowledgment file follows file erasure and stale-archive fencing.

#### DUE-002 — Tax notices and resolution work

*Tier:* Core

**Requirement.** Capture a federal/state notice with its source file, agency, tax period, response date, assigned practitioner, authorization and resolution plan. Track research, client questions, agency contact, response submission and follow-up until an acknowledged resolution or documented exception; link transcripts and filing receipts without treating them as tax advice. A notice opens from a document already filed on a job, such as a client upload, and its response date is the one printed on the notice, recorded and then verified by a person; Blotter never computes it. Until AUTHZ-001 tracks Forms 2848 and 8821, the authorization is the reference staff record on the notice; until INTEGRATE-006 retrieves transcripts, a transcript is a file staff attach, and AUTHZ-001 and INTEGRATE-006 inherit these links before they ship. The timeline is append-only. A notice closes only as resolved, backed by an evidence file on an agency contact, transcript, receipt or accepted response and with no failed response after the last accepted one, or as a documented exception with its reason; the assigned practitioner, a reviewer or the principal closes it.

**Acceptance.**
1. Open a notice from a client upload, verify the response deadline, assign a practitioner, link an authorized transcript and response receipt, and schedule follow-up.
2. A failed response stays open; closing requires evidence and a recorded outcome.

#### DUE-003 — Wider US obligation catalog and firm defined deadlines

*Tier:* Core · *Cites:* BASE-AUDIT-001, BASE-DATA-001, BASE-DATA-003, BASE-ROLE-001 · *Register:* R-5

**Requirement.** Beyond DUE-001's five obligation types, Blotter maintains sourced deadline templates for Forms 1120, 1041, the 990 series, 940, W-2/W-3, 1099-NEC/1099-MISC, 1040-ES and 1120-W estimated payments, state withholding and unemployment returns, state annual reports and franchise taxes, and FinCEN 114 (FBAR) with its automatic extension. A firm can also define its own obligations: a fixed date, N days after period end, or the nth weekday of a month, each with a recorded source or a firm-defined label. The same approval, override, weekend/holiday and provenance rules as DUE-001 apply. [Capability rules](docs/contract/due-003.md) define its record and recovery details.

**Acceptance.**
1. Configure 1040-ES quarterly estimates including a weekend shift, the January 31 W-2 and 1099-NEC deadlines, an FBAR with its automatic October extension, and a firm rule of 15 days after month end.
2. Inspect the calculated dates and their sources.
3. Import a source revision and preview the affected jobs before approving it.
4. The firm rule shows as firm-defined rather than as an agency deadline.
5. Only the principal defines a firm rule (defining it approves it; pattern 2): a fixed month and day (the first such date after the period ends), a number of calendar days after the period ends, or the nth (1–5, or last) weekday of the month a chosen number of months after the period-end month.
6. It carries an optional source or label (default "Firm-defined") and shows as a firm-defined deadline, never as an agency deadline, with no source URL; DUE-001's holiday shift (federal legal holidays, without DC Emancipation Day), obligation, override, revision and provenance rules apply to it unchanged.

### RESOLVE capabilities

#### RESOLVE-001 — Transcript analysis and resolution cases

*Tier:* Core · *Cites:* BASE-AUDIT-001, BASE-DATA-001, BASE-DATA-003, BASE-ROLE-001 · *Register:* R-5

**Requirement.** From authorized IRS account and wage-and-income transcripts (INTEGRATE-006), Blotter builds a per-year view for each client. It shows the assessed balance and the accrued penalties and interest as of the transcript date, each transaction code with a plain explanation, unfiled years, the collection statute expiration date (CSED) for each assessment, refund statute dates, and hold, lien or levy indicators. Each figure links to its transcript line. When a new pull changes a year, the change is flagged and routed to the assigned practitioner as notice or resolution work (DUE-002). Financial information for Forms 433-A and 433-F is collected through a PORTAL-004 organizer. Derived figures are labeled with their transcript date and are never presented as advice; the practitioner chooses the resolution path. [Capability rules](docs/contract/resolve-001.md) define its record and recovery details.

**Acceptance.**
1. Load authorized account transcripts for four years, including one unfiled year.
2. Inspect each year's balance, codes, CSED and unfiled flag against the source lines.
3. Pull again with a new transaction code and see a change alert routed to the practitioner.
4. Collect 433-A data through an organizer and inspect it on the case.
5. No resolution recommendation is made without the practitioner's decision.

### MAIL capabilities

#### MAIL-001 — Gmail and Microsoft 365 shared inbox

*Tier:* Core · *Cites:* BASE-AUDIT-001, BASE-DATA-001, BASE-DATA-003, BASE-MAIL-001, BASE-ROLE-001

**Requirement.** Connect Gmail/Google Workspace and Microsoft 365/Exchange mailboxes with scoped OAuth, shared/delegated mailbox access and visible sync health. Triage threads into clients and engagements, assign email as work, comment internally, send/reply with the authorized identity using firm or personal templates (MSG-001) and file attachments against the correct job. Colleague visibility follows MAIL-002; snooze, scheduled send and no-reply follow-up are MAIL-003. Preserve message/thread identity, timestamps and authors, prevent duplicate sends/imports, and quarantine ambiguous client matches. Revocation stops access and surfaces unsynced work. [Capability rules](docs/contract/mail-001.md) define its record and recovery details.

**Acceptance.**
1. Connect a real authorized Google mailbox and Microsoft shared mailbox, receive and reply to client threads, delegate one as a job and file an attachment.
2. Send the same event twice, introduce an ambiguous sender and revoke access; inspect one copy, explicit triage and actionable sync failure.
3. with mail consent, a sent client reply suggests time on its job linking that message; without it, or after withdrawal, mail suggests nothing.
4. offboard a preparer with a connected mailbox; their grant is revoked, triaged threads follow the successor and sent mail keeps its author.
5. reply to a client thread with the "Month-end close request" template and inspect the rendered reply, its attachment and the stored text.
6. trace a request from the client's email through upload and review in the client history.

#### MAIL-002 — Mailbox privacy and sharing

*Tier:* Core · *Cites:* BASE-AUDIT-001, BASE-DATA-001, BASE-DATA-003, BASE-MAIL-001, BASE-ROLE-001

**Requirement.** Under the held company policy, when staff connect their own mailboxes, colleagues see only threads with matched client contacts and threads the mailbox owner explicitly shares. Personal, vendor and other non-client mail stays visible only to the mailbox owner. A user can mark any thread, sender or domain private, so it is never shared, triaged or summarized. A shared team mailbox such as info@ is visible to its assigned members. Firm administrators cannot read private threads through the app or API, and AI features (AI-001) and search (SEARCH-001) exclude them. Marking a client thread private later removes colleagues' access. Attachments already filed to a job stay filed, with the filing recorded. [Capability rules](docs/contract/mail-002.md) define its record and recovery details.

**Acceptance.**
1. Connect a preparer's mailbox containing a client thread, a personal thread and a vendor thread.
2. A colleague and the owner see only the client thread.
3. Mark the client thread private: colleagues lose access, while its filed attachment stays on the job with its filing record.
4. Add a private-domain rule and confirm a new email from that domain is not shared.
5. Under the held company policy, the API, search and AI summaries cannot read private threads.

#### MAIL-003 — Triage controls snooze and scheduled send

*Tier:* Core · *Cites:* BASE-AUDIT-001, BASE-DATA-001, BASE-DATA-003, BASE-MAIL-001, BASE-ROLE-001

**Requirement.** Each user and each shared mailbox has a triage list. From it a thread can be marked done, snoozed until a date and time (when it returns to triage), assigned to a colleague with a note, converted into a work item or task, or linked to existing work. Replies can be scheduled for a future time and canceled until sent. A no-reply follow-up reminder fires if the client has not answered by a date. Each client and work item has an email-in forwarding address. Triage counts by person show who has a backlog. [Capability rules](docs/contract/mail-003.md) define its record and recovery details.

**Acceptance.**
1. Snooze a thread until tomorrow at 9:00 and see it return.
2. Assign another thread to a colleague with a note.
3. Convert one thread into a 1040 work item and link another to existing work.
4. Schedule a reply for Monday at 8:00, cancel and reschedule it, and confirm exactly one send.
5. Set a three-day no-reply reminder: it fires when the client stays silent and is canceled when the client replies.
6. Forward an email to a client's address and see it filed.

### MSG capabilities

#### MSG-001 — Firm and personal message templates

*Tier:* Core · *Cites:* BASE-INPUT-002, BASE-MAIL-001

**Requirement.** Owners maintain firm-wide message templates and staff keep personal ones. They are used for inbox replies (MAIL-001), portal messages (PORTAL-003), document requests and organizers (PORTAL-001, PORTAL-004), reminder-sequence steps (FOLLOWUP-001), signature and invoice notices (SIGN-001, BILL-004), text messages (SMS-001) and bulk messages (MSG-002). A template holds a subject, body, optional attachments and placeholders. The placeholders cover firm name, sender, client, contact first name, work item, work type, period, due date, the outstanding-requests list, portal link, and invoice amount and due date. Composing applies a template, renders it for the exact recipient and shows a preview. Sending is refused while any placeholder is unresolved or empty, with the missing field named, until the sender fills it in or edits the text. Each sent message stores its rendered text. Templates are versioned with their author, so editing or deleting one never changes sent messages. Templates have categories and search, and only permitted roles can edit firm templates. Until a second editing role exists, only the principal creates, edits and deletes firm templates. The contact first name is the first word of the contact's recorded name until CRM-001 stores names in parts; the work type is the engagement template's name until WORK-007; the invoice amount and due date stay unresolved, so sending is refused, until BILL-002 issues invoices; the portal link is created only when the message is sent. [Capability rules](docs/contract/msg-001.md) define its record and recovery details.

**Acceptance.**
1. Create a "Month-end close request" firm template with client, period, due-date and outstanding-items placeholders.
2. Use it in an inbox reply and as step 2 of a reminder sequence, and inspect the rendered text for two clients with different periods and outstanding lists.
3. Remove one client's contact first name and confirm the send is refused naming that field.
4. Edit the template and confirm messages already sent are unchanged while the next reminder uses the new version.
5. A preparer cannot edit the firm template but can save a personal copy.
6. Every message made from a template is sent with that version's files, even when the sender edited its text, and the sent message records each file's name, type, size and SHA-256.

#### MSG-002 — Bulk client messages

*Tier:* Core · *Cites:* BASE-AUDIT-001, BASE-DATA-001, BASE-DATA-003, BASE-INPUT-002, BASE-MAIL-001, BASE-ROLE-001

**Requirement.** Send one templated email or portal message (MSG-001) to a filtered client or contact segment, for example every 1040 client for a tax-season kickoff, or every client with a tag. Each message is rendered for its recipient. Before sending, staff preview the recipient count and sample renderings. Contacts who opted out or have no valid address are excluded and listed. Sends can be scheduled and are throttled within provider limits. A request or organizer can be attached for each recipient. Delivery, bounce and reply are tracked per recipient and filed to each client's history, and replies thread back to the individual client. Marketing messages carry a CAN-SPAM unsubscribe; engagement notices are transactional. [Capability rules](docs/contract/msg-002.md) define its record and recovery details.

**Acceptance.**
1. Filter 40 individual clients by the 1040 work type.
2. Two opted-out clients and one without an email address are excluded and listed.
3. Preview three renderings and schedule the send.
4. After it runs, inspect per-recipient delivery and one bounce in each client's history.
5. A reply from one client threads to that client only.
6. Unsubscribing from a marketing message stops later marketing sends but not engagement notices, and resubmitting the batch sends no duplicate.

### SMS capabilities

#### SMS-001 — Two way client text messaging

*Tier:* Core · *Cites:* BASE-AUDIT-001, BASE-DATA-001, BASE-DATA-003, BASE-MAIL-001, BASE-ROLE-001

**Requirement.** Staff and clients exchange text messages from a firm Twilio number registered for US A2P 10DLC or toll-free verification. Conversations are threaded on the client record. Blotter captures opt-in consent, handles STOP and HELP, holds sends during quiet hours in the client's time zone and supports MSG-001 templates. MMS images are filed as documents. Text bodies never carry taxpayer identifiers or portal secrets, only links to authenticated pages. Texts from unknown numbers go to triage. [Capability rules](docs/contract/sms-001.md) define its record and recovery details.

**Acceptance.**
1. Capture a client's SMS consent and send a templated text.
2. The client replies with a photo, which appears in the client timeline and is filed to the work item.
3. A text from an unknown number lands in triage.
4. A send scheduled during quiet hours waits until the window opens.
5. After the client replies STOP, further texts are refused, and HELP returns the firm's help message.

### COLLAB capabilities

#### COLLAB-001 — Contextual discussions and review alerts

*Tier:* Core

**Requirement.** Staff discuss a client, task, document or review in internal threads with mentions, ownership, unread state and retained decisions. Submission notifies the assigned reviewer; replies and requests for changes return to the preparer with a due follow-up. Internal material never leaks to portal users. Assignment, due-soon, overdue and digest notifications and each person's settings are NOTIFY-001.

**Acceptance.**
1. Submit work, receive the assigned reviewer's notification, mention a colleague and request a correction.
2. Resolve it as the preparer, inspect the retained thread and verify that the client and unassigned staff cannot read private discussion.

### NOTIFY capabilities

#### NOTIFY-001 — Staff notifications digest and settings

*Tier:* Core · *From:* NOTIFY-001 · *Cites:* BASE-AUDIT-001, BASE-DATA-001, BASE-DATA-003, BASE-MAIL-001, BASE-ROLE-001

**Requirement.** Staff receive in-app, email and mobile push (MOBILE-001) notifications for: work or a task assigned to them, a review requested or returned, a mention, a client reply, an upload, an organizer submission or a completed signature, work due soon (with a configurable lead time), overdue work, status changes on work they own, failed deliveries or syncs, and payments received or failed. Each user chooses the channel per event and a daily digest time in their own time zone. The firm sets defaults and mandatory events. Notifications link to their item, collapse repeats, respect quiet hours and never put taxpayer identifiers in email or push subjects. A notification center tracks read and unread. [Capability rules](docs/contract/notify-001.md) define its record and recovery details.

**Acceptance.**
1. Assign a job and a task to a preparer.
2. Make one job due tomorrow and one overdue, mention the preparer and have a client upload a file.
3. Inspect the in-app notifications, the emails for the events the preparer chose, and a 7:00 local-time digest that lists due-soon and overdue items once.
4. Turn off email for mentions and confirm mentions then arrive in-app only.
5. A firm-mandatory event cannot be muted, and no SSN or EIN appears in any subject line.
6. ENGAGE-001/SIGN-001/SIGN-002 inherit completed-signature events, MAIL-001 and LEDGER-001/INTEGRATE-001–008 inherit connected replies/sync failures, and PAY-001/PAY-002 inherit received/failed payments.
7. Each carrier must assert its inherited notification behavior through a named public door before activation.
8. Existing review, discussion, client-question/to-do, task-ready, coverage and report email delivery remains enabled by default.

#### NOTIFY-002 — Notification choices and local-day digest

*Tier:* Core · *From:* NOTIFY-001 · *Cites:* BASE-AUDIT-001, BASE-DATA-001, BASE-DATA-003, BASE-MAIL-001, BASE-ROLE-001

**Requirement.** Staff notifications digest and settings includes capability journey on the same client, engagement and current source records. [Capability rules](docs/contract/notify-001.md) define its record and recovery details.

**Acceptance.**
1. Approved coverage receipts still reach their recorded active participants before first sign-in or after the job moves; the receipt grants no job access or fresh job data.
2. Newly introduced events start in-app only until the individual enables email or the principal explicitly configures that event as mandatory; defaults alone never silently opt users into new email kinds.
3. The principal alone sets defaults/mandatory email events, and personal choices cannot suppress mandatory delivery.
4. In-app notices always remain available.
5. Due-soon means an unfinished active-client job with its recorded due day between the user-local today and today plus the chosen whole calendar-day lead (0–365), inclusive; overdue means strictly before today.
6. Repeated scheduler runs collapse each job/recipient/due-day/kind.
7. The daily digest lists each currently eligible job once, at the first hourly trigger at or after the user-local time, once per local date including repeated DST hours.
8. Firm notification hours still apply; personal quiet start is inclusive and end exclusive, may span midnight, and equal times disable personal quiet hours.

#### NOTIFY-003 — Deferred notification custody and recovery

*Tier:* Core · *From:* NOTIFY-001 · *Cites:* BASE-AUDIT-001, BASE-DATA-001, BASE-DATA-003, BASE-MAIL-001, BASE-ROLE-001

**Requirement.** Staff notifications digest and settings includes capability journey on the same client, engagement and current source records. [Capability rules](docs/contract/notify-001.md) define its record and recovery details.

**Acceptance.**
1. Deferred deliveries wait for the next permitted trigger.
2. Every center read and dispatch rechecks current staff/item authority, including revoked named-task access; none broadens recipients.
3. Subjects redact nine-digit SSN/EIN formats; new event summaries contain no client content.
4. Attempts are claimed before transport and retained honestly, never blindly retried after failure or uncertainty.
5. Settings/read marks/consumption history are portable; unfinished notices remain held and digests restore disabled until deliberately enabled.
6. Native source erasure retains only safe notice metadata and stale-archive fencing.
7. ERASURE-002 inherits whole-client notice/settings retention and approved erasure before shipping.

### PORTAL capabilities

#### PORTAL-002 — Authenticated branded client portal

*Tier:* Core · *From:* PORTAL-002 · *Cites:* BASE-AUDIT-001, BASE-DATA-001, BASE-DATA-003, BASE-INPUT-003, BASE-PUBLIC-001, BASE-ROLE-001

**Requirement.** Each firm has a branded portal on the installation host with client login, invitations, recovery, two-factor authentication and entity-specific contact access. Clients switch among explicitly authorized entities, manage notification preferences and view approved documents, signatures and bills. Firm policy can require MFA; revoked contacts lose existing-session access server-side. Scoped upload links remain available as a separately controlled collection method. [Capability rules](docs/contract/portal-002.md) define its record and recovery details.

**Acceptance.**
1. Invite two contacts with different entity access, sign in with a second factor on the installation host and recover a lost factor.
2. Revoke one contact mid-session and attempt direct document and API access; inspect refusal without exposing another entity.
3. The principal or a reviewer (never a preparer) invites one active, authorized, portal-enabled contact with an email address and email consent; the emailed invitation (one use, 7 days) opens only that contact's entity, so a person who is a contact on several entities is invited on each and switches among the ones accepted.
4. Sign-in is an emailed one-use link (15 minutes, at most five an hour; the reply never says whether an address has access, and the mail goes after the reply) followed by a TOTP second factor, required unless the principal records otherwise (default: required).
5. Each factor comes with ten one-time recovery codes; a recovery code opens only the setup of a new factor, which replaces the lost one, issues new codes and ends the account's other sessions, and the principal can reset a factor with a recorded reason, ending every session.
6. Invitations revoke every existing account session, as do contact edits other than a language-only change.

#### PORTAL-007 — Portal account recovery and active scope

*Tier:* Core · *From:* PORTAL-002 · *Cites:* BASE-AUDIT-001, BASE-DATA-001, BASE-DATA-003, BASE-INPUT-003, BASE-PUBLIC-001, BASE-ROLE-001

**Requirement.** Authenticated branded client portal includes capability journey on the same client, engagement and current source records. [Capability rules](docs/contract/portal-002.md) define its record and recovery details.

**Acceptance.**
1. Invitation and reset acknowledgments are identical for existing and nonexistent accounts; staff eligibility and role checks still apply.
2. Five wrong codes in 15 minutes lock the account for 15 minutes.
3. Sessions are server-side rows behind an HttpOnly, Secure, SameSite=Strict cookie and last 8 hours; every request rechecks the session, the account and each entity's grant, contact (active, authorized, portal permission, the account's address) and entity, so a revoked grant, a changed contact or an archived entity refuses on the next request with the same "not found" as an entity the account never held, and nothing is shown before the second factor passes.
4. Signed in, a client sees per entity the work the firm already sent that contact (a link or a signature request) with its client-facing progress, the documents shared with that contact (deliverables keep BILL-005's payment gate), its signature requests (the signed PDF once completed) and the bills addressed to it (PDF), in the contact's language (PORTAL-005), and manages notification preferences: marketing email stops there at once (a `portal_preference` withdrawal, renewed only by a new recorded opt-in), while notices about the client's own work (requests, organizers, signatures, deliverables, bills) are not optional, so no engagement mail is suppressed by a portal switch (adopted default).

#### PORTAL-008 — Portal authority history and inactive restore

*Tier:* Core · *From:* PORTAL-002 · *Cites:* BASE-AUDIT-001, BASE-DATA-001, BASE-DATA-003, BASE-INPUT-003, BASE-PUBLIC-001, BASE-ROLE-001

**Requirement.** Authenticated branded client portal includes capability journey on the same client, engagement and current source records. [Capability rules](docs/contract/portal-002.md) define its record and recovery details.

**Acceptance.**
1. Staff actions, client sign-ins, factors, recoveries, refused codes and reads of signed PDFs and bills are audited; invitations and revocations appear in the client history.
2. Archives carry accounts and grants but never invitations, sign-in links, sessions, recovery codes or factors, so a restored account sets up a new factor.
3. Whole-client erasure revokes the entity's grants and deletes its invitations; an account that opens no other entity loses its address and factor, and its sessions, links, codes and failures are deleted.
4. A CRM-004 merge suspends the grants of the contacts it moves (invite them again on the surviving entity); its undo restores them.
5. The portal is served on the installation host; PORTAL-006 carries firm custom-domain sign-in.
6. Scoped upload links remain a separately controlled collection method.
7. The principal brands the portal with a PNG or JPEG logo (up to 256 KiB, recognised by its bytes; SVG is refused) and an accent colour, shown on every portal page including sign-in; the signed-in page and the invitation and sign-in emails carry the firm's name.
8. Custom-domain sign-in belongs to PORTAL-006.

#### PORTAL-009 — Client accounts and message-consent carriers

*Tier:* Core · *From:* PORTAL-002 · *Cites:* BASE-AUDIT-001, BASE-DATA-001, BASE-DATA-003, BASE-INPUT-003, BASE-PUBLIC-001, BASE-ROLE-001

**Requirement.** Authenticated branded client portal includes capability journey on the same client, engagement and current source records. [Capability rules](docs/contract/portal-002.md) define its record and recovery details.

**Acceptance.**
1. The portal marketing grant stays with MSG-002's portal channel, asserted on its doors before portal marketing ships.

#### PORTAL-003 — Client progress secure chat and to dos

*Tier:* Core · *From:* PORTAL-003 · *Cites:* BASE-INPUT-003, BASE-PUBLIC-001, BASE-ROLE-001

**Requirement.** Clients see engagement milestones, next action, outstanding requests and review/completion progress, and exchange secure messages or to-dos attached to the right engagement. Staff control what is client-visible; a client response updates the outstanding item and alerts its owner without marking unrelated work complete. [Capability rules](docs/contract/portal-003.md) define its record and recovery details.

**Acceptance.**
1. Open an engagement as a client, ask a secure question, complete one to-do and inspect the preparer's queue and progress view after review.
2. Confirm internal notes and another entity's tasks remain hidden.
3. a client's secure question appears in the client history and as an unresolved item with its owner.
4. The link shows the job's status as WORK-007 sets it (a sub-status's client label, else the stage name).
5. Progress is four milestones: Documents (received and accepted of requested), Preparation (applicable steps done; done once the job leaves open), Review (in review, then reviewed at sign-off) and Completed (signed off), with a stage (collecting while any request is outstanding, preparing, in review, completed) and the client's next action: upload the outstanding documents and complete the open to-dos, or nothing needed.
6. Staff control what is client-visible: the link shows request labels, status and return notes, client-facing tasks (WORK-009), progress counts, and the messages and to-dos staff put on the link; internal discussions (COLLAB-001), internal tasks and their instructions, staff emails, time and every other job (another client's or another entity's) never reach it; CRM-001 entity relationships inherit this one-job scope before they ship.

#### PORTAL-010 — Owned client questions and task completion

*Tier:* Core · *From:* PORTAL-003 · *Cites:* BASE-INPUT-003, BASE-PUBLIC-001, BASE-ROLE-001

**Requirement.** Client progress secure chat and to dos includes capability journey on the same client, engagement and current source records. [Capability rules](docs/contract/portal-003.md) define its record and recovery details.

**Acceptance.**
1. A client question is owned by the job's preparer when it is asked, alerts them (in-app and by mail), counts in the job queue as an open client question and stays open until a staff member who can write to the job answers it on the link; answering closes only that question.
2. Staff set to-dos for the client (with an optional due date) and own them; the client completes one with an optional reply, which alerts its owner and completes no request, task or other to-do.
3. Staff messages appear on the link only: no email is sent for them.
4. A client may hold at most 20 unanswered questions per job; the client's writes are same-origin only and refused once the link is replaced, expired or the job is signed off.
5. Questions and to-dos are CRM-003 unresolved items that change hands like any other and move with ACCESS-006 offboarding; every question, answer, message, to-do and completion is in the client history.

#### PORTAL-004 — Conditional organizers

*Tier:* Core · *From:* PORTAL-004 · *Cites:* BASE-AUDIT-001, BASE-DATA-001, BASE-DATA-003, BASE-INPUT-003, BASE-PUBLIC-001, BASE-ROLE-001

**Requirement.** Create versioned tax and bookkeeping organizers with conditional questions, required fields, prior-period carry-forward clearly marked for confirmation, supporting uploads and multi-contact responsibility. Clients save and resume, and staff review changed answers and completeness without losing the submitted original. [Capability rules](docs/contract/portal-004.md) define its record and recovery details.

**Acceptance.**
1. Send an organizer, answer an ownership question that reveals a dependent section, save/resume on a phone and attach evidence.
2. Submit, correct one answer and inspect both versions and the resulting request list; unconfirmed carried answers stay unresolved.
3. Definitions contain ordered text or choice questions, required flags, conditions on earlier choice answers, supporting document requests and optional WORK-003 workflow-question bindings.
4. A job snapshots its definition at creation; edits and newer releases change future jobs only.
5. Every question has one explicitly assigned active, authorized, consented CRM-001 contact on that entity; several contacts can divide one organizer.
6. Assigned full-scope staff preview and send MSG-001 invitations per contact, refusing unresolved placeholders and keeping exact rendered text, version attachments and honest provider-acceptance outcomes.
7. Each contact's new link rotates only that job/contact's prior links; current authority, consent, expiry and job state are rechecked on every call.
8. A contact receives only their assigned question details and server-computed branch applicability, never another contact's answers or staff review notes.

#### PORTAL-011 — Organizer draft submission and correction

*Tier:* Core · *From:* PORTAL-004 · *Cites:* BASE-AUDIT-001, BASE-DATA-001, BASE-DATA-003, BASE-INPUT-003, BASE-PUBLIC-001, BASE-ROLE-001

**Requirement.** Conditional organizers includes capability journey on the same client, engagement and current source records. [Capability rules](docs/contract/portal-004.md) define its record and recovery details.

**Acceptance.**
1. Draft answers save/resume on the same link; current confirmation reveals dependent questions and supporting requests, while only a submitted confirmed answer drives WORK-003 workflow.
2. Each contact submits their currently applicable set, required answers must be confirmed, and later corrections create another immutable submitted original.
3. Staff inspect completeness by responsible contact, changed values, authors/times, review findings and every submission version.
4. A request that no longer applies leaves the active request/reminder/review gate while its previously uploaded originals remain in DOC-001/002 custody.
5. Prior-period carry uses the same client's/template's latest submitted confirmed answers, shows its provenance only to the original responsible contact, and remains unconfirmed until that contact explicitly confirms current evidence; unconfirmed carry cannot complete an organizer or choose a workflow branch.
6. WORK-008 library releases/adoptions carry organizer definitions and individual question changes, preserve firm edits, and snapshot jobs; optional workflow bindings must match the template's choice questions.
7. Owner-only typed-name/reason erasure removes answer payloads, source-linked workflow values and still-derived carry copies, retains ids/authors/times/review attribution and a marker, leaves job sign-off and separately managed file custody intact, and uses Base's redaction journal to fence stale restores.
8. ERASURE-002 supplies actual future hold/signed-record retention before such records ship.

#### PORTAL-012 — Organizer provenance and recovery

*Tier:* Core · *From:* PORTAL-004 · *Cites:* BASE-AUDIT-001, BASE-DATA-001, BASE-DATA-003, BASE-INPUT-003, BASE-PUBLIC-001, BASE-ROLE-001

**Requirement.** Conditional organizers includes capability journey on the same client, engagement and current source records. [Capability rules](docs/contract/portal-004.md) define its record and recovery details.

**Acceptance.**
1. Organizer data follows job/contact relationships during CRM-004 merge/undo and native archive restore; portal tokens remain excluded.
2. RESOLVE-001 inherits its 433-A/F case questions, PORTAL-005 translations/accessibility and MOBILE-001 native/offline organizers before those capabilities ship.

#### PORTAL-005 — Client language and accessibility

*Tier:* Core · *Cites:* BASE-ACCESSIBILITY-001, BASE-AUDIT-001, BASE-DATA-001, BASE-DATA-003, BASE-INPUT-003, BASE-PUBLIC-001, BASE-ROLE-001· *Register:* R-1

**Requirement.** The client portal, emails, organizers and signature screens are available in English and Spanish. Each contact has a language preference, and firm templates (MSG-001) keep a version per language. Before a send, staff are warned when a template has no version in the contact's language. Client flows meet WCAG 2.2 AA. [Capability rules](docs/contract/portal-005.md) define its record and recovery details.

**Acceptance.**
1. Set a contact to Spanish and send a templated request that has a Spanish version.
2. Complete an organizer and a signature in Spanish.
3. For a template with no Spanish version, staff are warned before the send.
4. Run an automated accessibility check on the client flows, and complete an upload and a signature using only the keyboard.

### MOBILE capabilities

#### MOBILE-001 — Mobile client and practitioner work

*Tier:* Core · *Cites:* BASE-ACCESSIBILITY-001, BASE-AUDIT-001, BASE-DATA-001, BASE-DATA-003, BASE-ROLE-001· *Register:* R-1

**Requirement.** Responsive web and native iOS/Android apps let clients scan/crop multi-page documents, resume interrupted uploads, answer organizers, chat, sign and pay; staff triage, reassign and review work, and record time against client/job/task with manual entries and running timers (TIME-001) that continue across app restarts and sync once, with role-appropriate access. Push notifications use consent and reveal no tax details on a lock screen; offline drafts disclose sync state and revoked sessions cannot sync new work. Keyboard and assistive-technology access remain available on the web. [Capability rules](docs/contract/mobile-001.md) define its record and recovery details.

**Acceptance.**
1. At desktop and phone widths and on iOS/Android, capture a multi-page statement, interrupt/retry the upload, complete a client task and review it as staff.
2. As staff on a phone, start a timer, close and reopen the app, stop it and add a manual entry; both appear once in the job's time with the snapshotted rate and respect a locked period.
3. Inspect push privacy, offline-to-online conflict handling, keyboard navigation and revocation.
4. Reconnection never overwrites an original submission or lets unconfirmed carried/draft answers advance workflow.

### DOC capabilities

#### DOC-001 — Client files versions and annotations

*Tier:* Core · *From:* DOC-001 · *Cites:* BASE-AUDIT-001, BASE-DATA-001, BASE-DATA-003, BASE-INPUT-003, BASE-ROLE-001

**Requirement.** Store engagement documents in client/period folders with searchable names, source, author, timestamps, version relationships, annotations and review status. Preserve originals and prior versions; downloads and annotations respect permissions. Support normal multi-page accounting packets with published limits, resumable uploads and clear failure recovery instead of silently truncating files. [Capability rules](docs/contract/doc-001.md) define its record and recovery details.

**Acceptance.**
1. Upload a realistic multi-page packet, replace it with a corrected version, annotate a page and find both versions from the client and engagement.
2. Interrupt an upload and resume; compare downloaded originals and inspect limit/error handling.
3. A named notice assignee sees only notice evidence outside their normal job scope.
4. Purpose-specific custody, versioning and approval stay in their own workflows; the packet workspace adds versions and page annotations to requested files, while DOC-003 retains its deliverable version/approval flow.
5. Unknown historical author/page counts are labelled unknown; staff declare a missing page count before the first annotation.
6. New packet source, author and page count are staff-recorded, not provider-verified or inferred.
7. Staff with full job scope can upload 1 byte–20 MiB originals (20 × 1024 × 1024 bytes), with 1–2,000 declared pages, to an open request.
8. Transport uses 256 KiB chunks except the final chunk; each call rechecks current staff, job and client scope, exact offset, chunk ID and SHA-256.

#### DOC-004 — Resumable packet originals and corrections

*Tier:* Core · *From:* DOC-001 · *Cites:* BASE-AUDIT-001, BASE-DATA-001, BASE-DATA-003, BASE-INPUT-003, BASE-ROLE-001

**Requirement.** Client files versions and annotations includes capability journey on the same client, engagement and current source records. [Capability rules](docs/contract/doc-001.md) define its record and recovery details.

**Acceptance.**
1. A repeated identical chunk is idempotent; gaps, differing bytes and incomplete/final-hash mismatches refuse without discarding confirmed bytes.
2. Pending uploads resume for seven days using the exact original and are then purged; cancellation removes staging.
3. Completion preserves the exact original behind the usual permission-checked file door and marks the request received for staff acceptance.
4. Corrections retain every prior original and the preceding exact DOC-002 contact grants, never its share tokens, and start unreviewed.
5. Notes name a page and exact version; review records status, author and time without altering original bytes.
6. Search covers names, sources, authors, period, annotations and review metadata; SEARCH-001 also indexes supported PDF text from the real bytes.
7. Final chunks, versions, annotations and grants are portable; pending chunks and bearer credentials are excluded.
8. Existing file erasure removes final chunks and pending copies under the stale-restore fence.

#### DOC-005 — Packet catalog recovery and connector custody

*Tier:* Core · *From:* DOC-001 · *Cites:* BASE-AUDIT-001, BASE-DATA-001, BASE-DATA-003, BASE-INPUT-003, BASE-ROLE-001

**Requirement.** Client files versions and annotations includes capability journey on the same client, engagement and current source records. [Capability rules](docs/contract/doc-001.md) define its record and recovery details.

**Acceptance.**
1. The owner JSON archive restore accepts up to 64,000,000 JSON characters; firm-scale streaming remains ARCHIVE-002.
2. INTEGRATE-003 and MIGRATE-001–005 inherit this catalog, original custody and exact grant preservation for their connector/imported kinds before shipping.

#### DOC-002 — Document sharing and internal only custody

*Tier:* Core · *From:* DOC-002 · *Cites:* BASE-DATA-001, BASE-DATA-003, BASE-INPUT-003

**Requirement.** Per-document visibility supports internal-only workpapers, selected client contacts and revocable/expiring approved shares. Preview recipients and access before sharing, audit downloads and preserve visibility on versions, connector copies and migration. External sharing never bypasses client or job permissions. [Capability rules](docs/contract/doc-002.md) define its record and recovery details.

**Acceptance.**
1. Keep a workpaper internal, share a final packet with one contact, rotate/revoke its share and attempt direct reads as another contact and preparer.
2. Inspect inherited version permissions and retained access history.
3. Filing defaults to internal.
4. A principal or reviewer previews and grants individual active, authorized portal contacts on the file's own active entity; staff retain the job's existing read scope.
5. Pre-conversion intake has no entity authority and remains internal.
6. Download shares are one-file, one-contact bearer credentials: 32 random bytes, only SHA-256 stored, shown once, never automatically mailed, and expire after an explicitly chosen time within 30 × 24 hours.
7. Possession is not verified personal identity; the UI says so.
8. Rotate invalidates the old copy; revoke, erasure, contact edits/revocation, entity archive and permission changes refuse it.

#### DOC-006 — Exact document grants and revoked links

*Tier:* Core · *From:* DOC-002 · *Cites:* BASE-DATA-001, BASE-DATA-003, BASE-INPUT-003

**Requirement.** Document sharing and internal only custody includes capability journey on the same client, engagement and current source records. [Capability rules](docs/contract/doc-002.md) define its record and recovery details.

**Acceptance.**
1. Every fetch rechecks the current file hash, entity, contact and grant, and records a download without the secret.
2. The contact-bound job portal lists/downloads only its explicit file grants; a different contact cannot fetch or approve another contact's deliverable.
3. The assigned preparer's existing explicit deliverable send grants that version only to its selected currently authorized/consented contact; later versions inherit the preceding version's exact visibility/grants and never its tokens.
4. A different recipient requires the principal/reviewer's explicit policy change first.
5. A changed task attachment hash becomes internal until explicitly approved again.
6. Grants and access/download history survive archives and authorized client merge/undo; bearer tokens do not survive archive restore and old links are revoked by a merge/undo.
7. DOC-001 inherits further version kinds, INTEGRATE-003 connector copies and MIGRATE-001–005 imported documents before shipping; none may broaden the source grant or bypass current client/job authority.

#### DOC-003 — Client approval of deliverables

*Tier:* Core · *Cites:* BASE-DATA-001, BASE-DATA-003, BASE-INPUT-003

**Requirement.** Staff send a deliverable such as a draft return copy, financial statements or a management report for client approval. The client approves, or requests changes with comments, on that exact version. An approval records the approver, the time and the document hash. Uploading a newer version resets approval, and approval can move the work item's status (WORK-007).

**Acceptance.**
1. Send version 1 of a set of financial statements.
2. The client requests a change with a comment.
3. Upload version 2 and have the client approve it.
4. Inspect the approval bound to version 2's hash, the retained comment on version 1 and the resulting status change.
5. Approving version 1 after version 2 exists is refused.

### SEARCH capabilities

#### SEARCH-001 — Firm wide search

*Tier:* Core · *From:* SEARCH-001

**Requirement.** One search covers clients, contacts, work items, tasks, emails, portal messages, notes, documents (by name and extracted text) and invoices. Results can be filtered by type, are ordered by relevance and recency, tolerate typos and open from the keyboard. They include only what the searcher may see under ACCESS-002 and MAIL-002. Searching by EIN or SSN works only for authorized roles, and results show the number masked. [Capability rules](docs/contract/search-001.md) define its record and recovery details.

**Acceptance.**
1. Search for a client's last name, an invoice number, a phrase inside an uploaded PDF and an email subject, and open each result.
2. A preparer without access to a client gets no result from that client, and a private thread never appears.
3. Searching the last four digits of an SSN works only for an authorized role and shows the number masked.
4. Extracted text is read from plain-text and CSV files and from the strings a PDF's content streams (uncompressed or FlateDecode) show; scanned images and other encodings yield none (nothing is guessed).
5. A document's text is extracted on the first search after upload and kept; erasing the file's bytes deletes it, and it is left out of archives.
6. Query and record text are split into words (case and accents ignored).
7. Every query word must match a word of the result exactly (3), as a prefix (2) or within one typo for words of 4 to 7 letters, two for 8 or more (1, insertions, deletions, substitutions and transpositions); a match in the result's own name counts double, and the whole query appearing as a phrase adds 5.

#### SEARCH-002 — Search ranking and private-result exclusions

*Tier:* Core · *From:* SEARCH-001

**Requirement.** Firm wide search includes capability journey on the same client, engagement and current source records. [Capability rules](docs/contract/search-001.md) define its record and recovery details.

**Acceptance.**
1. Results are ordered by that score, then most recent first (the record's latest activity: done, answered, uploaded, posted or created), at most 50, optionally filtered to one type, and each carries the door that opens it (the client's history, the job, the discussion, or the file download); in the app "/" focuses the box, arrow keys move and Enter opens the chosen result.
2. A client's tax id (the EIN column) matches a query of four or more digits (spaces and hyphens ignored) only for the principal or a reviewer, and every client result shows it masked to its last four digits for every role.

### FOLLOWUP capabilities

#### FOLLOWUP-001 — Automatic document chasing and escalation

*Tier:* Core · *Cites:* BASE-AUDIT-001, BASE-DATA-001, BASE-DATA-003, BASE-ROLE-001 · *Register:* R-5

**Requirement.** A firm-approved reminder sequence follows missing documents, organizer answers, signatures and unresolved questions through email, portal and opted-in US SMS via Twilio. Configure owner, business hours, cadence, maximum sends, pause and manager escalation. Each step's wording is a MSG-001 template rendered for the recipient at send time; a step whose placeholders cannot resolve is held and its owner is told, rather than sent. Re-evaluate outstanding items before each send, stop completed/declined items and record provider acceptance, delivery or failure separately. Respect SMS consent and STOP/HELP, firm sender registration and provider outages; an unanswered notification never resolves the blocker. [Capability rules](docs/contract/followup-001.md) define its record and recovery details.

**Acceptance.**
1. Approve a bounded reminder sequence, leave two items missing and complete one between sends.
2. Observe only the remaining item chased, with that step's template rendered for the client and listing only the outstanding item, a failed delivery surfaced to its owner and escalation at the configured condition.
3. Reply STOP to an actual consented US SMS and verify further SMS ceases; pause and resume without duplicate sends.
4. offboard a preparer with a scheduled reminder sequence; the next reminder goes from the successor and earlier reminders still show the preparer.
5. use the "Month-end close request" template as step 2 of a sequence for two clients with different periods and outstanding lists, inspect both rendered messages, edit the template and confirm the next step uses the new version while sent steps keep their text.

### LEDGER capabilities

#### LEDGER-001 — QuickBooks and Xero client ledger context

*Tier:* Core · *Cites:* BASE-AUDIT-001, BASE-DATA-001, BASE-DATA-003, BASE-ROLE-001 · *Register:* R-5

**Requirement.** Connect QuickBooks Online/QuickBooks Online Accountant and Xero organizations to the correct clients, showing read-only transaction, balance, reconciliation and period-close context with source links, last successful sync and explicit stale/partial state. Reconnect and multi-client permission changes preserve mappings. Reading client books grants no permission to write ledger entries or access the firm's billing ledger.

**Acceptance.**
1. Authorize QBO Accountant and Xero client organizations, map them to two engagements and inspect a transaction, balance and close context against each source.
2. Revoke one grant and change the period; stale context is labeled and never silently treated as current.

#### LEDGER-002 — Transaction questions and close evidence

*Tier:* Core · *Cites:* BASE-AUDIT-001, BASE-DATA-001, BASE-DATA-003, BASE-ROLE-001

**Requirement.** Ask clients precise questions against source-ledger transactions and period reconciliations, attach their answers/documents and carry unresolved issues into preparer/reviewer work. Compare current and prior periods, flag unusual movements and retain the source snapshot and staff disposition. A reply alone cannot book an adjustment or certify a close.

**Acceptance.**
1. Select an uncategorized transaction, request its business purpose, receive an answer and receipt, then return it for more evidence.
2. Inspect the source-linked thread in review, a prior-period variance and the recorded reviewer decision without any unapproved ledger write.

#### LEDGER-003 — Cross client books health dashboard

*Tier:* Core · *Cites:* BASE-AUDIT-001, BASE-DATA-001, BASE-DATA-003, BASE-ROLE-001

**Requirement.** For every connected QBO and Xero client, a firm dashboard shows uncategorized transaction count and amount, unreconciled accounts and their last reconciled date, bank-feed connection errors, the last close date and unusual AR/AP aging. It can be sorted by client, staff member and period, drills down to source links and shows each client's data freshness. One action sends a client's uncategorized transactions as LEDGER-002 questions.

**Acceptance.**
1. With two QBO clients and one Xero client connected, compare the dashboard counts with each source.
2. A broken bank feed is flagged.
3. Sort by staff member, and send one client's uncategorized transactions as questions.
4. Revoke a grant and see that client labeled stale.

### CAPACITY capabilities

#### CAPACITY-001 — Workload capacity and coverage

*Tier:* Core · *From:* CAPACITY-001

**Requirement.** Plan staff hours by week, skill, service, availability, leave and non-client commitments against estimated remaining work and review demand. Show overload, unscheduled work and deadline conflicts across the firm with drill-down to jobs; distinguish estimates from actual time. [Capability rules](docs/contract/capacity-001.md) define its record and recovery details.

**Acceptance.**
1. Load a tax-season week with preparer/reviewer budgets, scheduled leave and a client meeting.
2. Inspect available hours, overloaded staff and affected jobs; adjust an estimate and confirm totals and conflict explanations update.
3. Until an admin role exists the principal sets each person's weekly hours (in minutes; 40 hours when unset, shown as a default) and skills, and schedules leave (whole weekdays at a fifth of the weekly hours each), client meetings and internal commitments (minutes on each weekday from one date to another, a meeting optionally linked to its job); only weekdays Monday to Friday count.
4. Available = weekly hours less leave and commitments in the week, never below zero.
5. Demand is estimated remaining work: the estimates of open, applicable tasks a person owns (WORK-009 owner resolution) whose due date (the task's, else the job's) falls in the week, plus the review estimate of each job they review that is not signed off and falls due in the week.
6. Actual time is the person's recorded time in the week, and per job their total time on it, shown beside the estimates and never subtracted from them.
7. A person is overloaded when demand exceeds available.

#### CAPACITY-004 — Unscheduled work and capacity conflicts

*Tier:* Core · *From:* CAPACITY-001

**Requirement.** Workload capacity and coverage includes capability journey on the same client, engagement and current source records. [Capability rules](docs/contract/capacity-001.md) define its record and recovery details.

**Acceptance.**
1. Open tasks or reviews due in the week without an estimate are unscheduled; open tasks due before the week are listed as past due; neither counts toward demand.
2. A deadline conflict is a job due in the week that is not signed off, with one explanation for each of its people who is overloaded or on leave between the week's start and its due date, and for each unscheduled item on it.
3. The view filters by skill (people who have it) and service (the job's work type, WORK-007) and drills down to each job; reviewers and the principal see the whole firm, a preparer sees only themselves.
4. The job's people (or a reviewer or the principal) adjust an open task's estimate or the job's review estimate; every change is audited.
5. CAPACITY-002 and CAPACITY-003 build on this model.

#### CAPACITY-002 — Reassignment and dependency aware scheduling

*Tier:* Core · *From:* CAPACITY-002

**Requirement.** Reassign and reschedule work when staff are absent or overloaded, proposing eligible coverage with client authority, skills, remaining capacity, dependency order and independent reviewer constraints. Preview notifications and affected deadlines; a manager approves the plan and owns unresolved conflicts. [Capability rules](docs/contract/capacity-002.md) define its record and recovery details.

**Acceptance.**
1. Remove an assigned preparer for leave, preview alternate staffing and move a dependent job chain.
2. Approve the feasible changes, refuse an ineligible/self-review assignment and inspect new owners, notifications and unresolved deadline conflicts.
3. The plan takes the open jobs that person prepares, and the jobs not yet completed that they review, falling due from the first date through 14 days after the last, ordered so each job comes after the planned jobs it waits for (WORK-003) and otherwise by due date.
4. For each role the person holds it proposes an eligible colleague (preparer: an active preparer, reviewer or the principal; reviewer: an active reviewer or the principal) who is not the person, never reviews their own work, is not the job's partner as preparer, is not on CAPACITY-001 leave on the due date and still has the job's estimated minutes free that week (available less demand less the plan's earlier moves); the colleague covering a job's prerequisite comes first, then one with the job's work type among their skills, then the most free minutes, then email order.

#### CAPACITY-005 — Coverage-plan commitment and notifications

*Tier:* Core · *From:* CAPACITY-002

**Requirement.** Reassignment and dependency aware scheduling includes capability journey on the same client, engagement and current source records. [Capability rules](docs/contract/capacity-002.md) define its record and recovery details.

**Acceptance.**
1. A manager may name the preparer or reviewer, move a due date (with where it comes from) or leave a job out; a named person who is ineligible, would review their own work or lacks the capacity, or a prerequisite that would fall due after the job waiting for it, refuses the plan until changed.
2. The preview lists every line, the notifications and the unresolved conflicts (no eligible colleague free); approval needs the preview's fingerprint, applies every feasible line in one batch (role tasks follow, WORK-009), sends each notice in-app and by email with its delivery recorded, and records each conflict owned by the approving manager in the plan and among the client's unresolved items (CRM-003), where it can be handed on and is closed with a resolution note by its owner or the principal.

#### CAPACITY-003 — Capacity forecasts and hiring plans

*Tier:* Core · *From:* CAPACITY-003

**Requirement.** Forecast future workload from approved recurring engagements, historical completion/time, pipeline and seasonality, with visible assumptions and confidence ranges. Compare staffing, hiring or service-change scenarios without altering actual assignments or promised deadlines. [Capability rules](docs/contract/capacity-003.md) define its record and recovery details.

**Acceptance.**
1. Project the next tax season from recurring work and prior actuals, add a hypothetical hire and lost client, and compare demand/capacity by skill.
2. Inspect each week's forecast as a range with its stated confidence level, and confirm a client with no prior actuals widens the range and is named as the reason.
3. Trace estimates to sources and save a scenario without changing live work.
4. Demand is the periods of active, approved recurring rules (WORK-002) whose due date (the period's last day plus the rule's days) falls in a week, counted in that week; paused rules, skipped periods and periods whose job is already signed off are left out, and one-off jobs are not forecast.
5. A period's time traces to its source: the client's prior actuals for that template, which are the recorded time (TIME-001) on its signed-off jobs of earlier periods (a signed-off job with no recorded time is not one), using only periods starting in the same calendar month when there are any (seasonality); the estimate is their mean rounded to the minute, and the range runs from 90% of the smallest (rounded down) to 110% of the largest (rounded up).

#### CAPACITY-006 — Forecast estimates and editable scenarios

*Tier:* Core · *From:* CAPACITY-003

**Requirement.** Capacity forecasts and hiring plans includes capability journey on the same client, engagement and current source records. [Capability rules](docs/contract/capacity-003.md) define its record and recovery details.

**Acceptance.**
1. Without prior actuals the period uses the rule's time budget, else the work type's budget, else the sum of the template's task estimates, with a range from 50% to 150% of it (rounded to the minute), and the reason names the client; with none of these its estimate is zero and the reason says so.
2. Each week states its confidence: high when every period due in it rests on at least three prior actuals, medium when each rests on at least one, low when any rests on none (each such reason listed).
3. Capacity is each active person's weekly hours less leave and commitments on the week's weekdays (CAPACITY-001); by skill, a person counts in full under each of their skills, and demand counts under the skill named like its work type (lower case); a skill is short by its demand's high end less its capacity.
4. A scenario adds hypothetical hires (weekly minutes and skills from a start date), changes a person's weekly hours from a date (zero for a departure), drops lost clients' periods (listed as left out) and scales a work type's time to a percentage (0 drops the service); it is compared week by week and by skill with the baseline.

#### CAPACITY-007 — Forecast scenario custody and report handoffs

*Tier:* Core · *From:* CAPACITY-003

**Requirement.** Capacity forecasts and hiring plans includes capability journey on the same client, engagement and current source records. [Capability rules](docs/contract/capacity-003.md) define its record and recovery details.

**Acceptance.**
1. Forecasting computes from live records and stores nothing; saving a scenario stores only its name, window and changes (audited) and changes no job, rule, assignment, estimate, due date or capacity row; reopening it recomputes from current records.

### TIME capabilities

#### TIME-001 — Time budgets and activity suggestions

*Tier:* Core

**Requirement.** Record time against client/job/task with manual entry and timers, billable status and snapshotted rate; compare actual hours/cost with approved budgets. Suggest missing entries from consented work/email/calendar activity with source links, never silently creating billable time. Corrections retain authorship and respect locks. [Capability rules](docs/contract/time-001.md) define its record and recovery details.

**Acceptance.**
1. Record time, change the rate and inspect unchanged prior amounts and budget variance.
2. Stop/restart a timer, reject one activity suggestion and approve another; verify only approved minutes enter WIP and unauthorized edits are refused.
3. A job's budget is the minutes approved by the reviewer or principal who starts it, or by its recurrence rule (WORK-002); actual is every recorded entry in any review state plus adjustments, at their snapshotted amounts, and variance is actual minus budget.
4. A non-billable entry keeps its snapshotted rate and amount and counts in the job's actual time, cost and variance, but neither it nor any adjustment to it is ever ready to bill: it stays out of WIP, is refused in a billing export and stays out of the job's margin (TIME-004).

#### TIME-002 — Timesheet approval and period locks

*Tier:* Core

**Requirement.** Staff submit timesheets to managers, who approve or return entries with reasons. Closing a billing period locks approved time; corrections use an authorized adjustment that preserves the original. Invoice/export reservations prevent the same work being billed twice.

**Acceptance.**
1. Submit a weekly timesheet, return and correct one entry, approve it and close the period.
2. Attempt direct edits and duplicate billing, then post an authorized adjustment and inspect its history.

#### TIME-003 — Billing rates and rate cards

*Tier:* Core

**Requirement.** Billing rates are set by staff member, role and service or work type, with client-specific overrides and effective dates. The precedence is client and service, then client, then service, then staff member, then role. Role is the person's practice role (principal, reviewer or preparer). Service rates may target a WORK-007 work type or the engagement template the job was started from. Within either service scope (service or client and service), a matching work-type card takes precedence over template cards, then the latest effective date and creation order resolve cards for that target. Template cards continue to apply to jobs started from that template when no work-type card in that scope is in force; work types without a default template may have their own rates. Each time entry snapshots the rate it resolved and where that rate came from. A rate change takes effect from its date and never rewrites past entries.

**Acceptance.**
1. Set rates for a practice role, a staff member, a 1040 service, a client and that client plus service.
2. Record time with only the role matching, then with staff, service, client and client-plus-service rates also matching in turn; inspect each entry's resolved rate and source to prove every precedence level: client and service, client, service, staff member, role.
3. Verify role means principal, reviewer or preparer.
4. Start two jobs with distinct work types sharing a template and inspect their distinct service rates; a type without a default template also accepts its own rate.
5. Verify client overrides, work-type versus template specificity, effective dates and recorded snapshots through archive restore.
6. Change the staff rate effective next month and confirm past entries are unchanged.

#### TIME-004 — Expenses and disbursements

*Tier:* Core

**Requirement.** Record billable and non-billable expenses (filing fees, postage, mileage at the firm-set rate, software pass-throughs) against a client and work item. Each expense can carry a receipt, a markup and an approval, and approved billable expenses become BILL-002 invoice lines. Staff reimbursements are kept separate from client charges, and expenses count in WIP and profitability (BILL-003). Amounts are integer cents: a markup is a whole percent from 0 to 100 of cost, a billable expense charges its cost plus the markup rounded half up to the cent, and a non-billable expense charges nothing; mileage is miles to one decimal place at the firm's cents-per-mile rate in force on the expense date, rounded half up. A reviewer or the principal approves or rejects an expense, nobody but the principal approves their own, and an expense dated in a closed billing period (TIME-002) cannot be recorded. Staff-paid expenses are owed back to that person at cost, and the principal records each reimbursement. Until BILL-002 issues invoice documents, an expense's invoice line is its line in the reviewed billing export, reserved once; BILL-002 inherits approved billable expenses as invoice lines before it ships. Until BILL-003 ships, WIP is the value of everything ready to bill, and a job's profitability is its margin before staff cost: fixed fee, approved billable time (TIME-001) and its adjustments and approved billable expense charges, less the cost of every approved expense, billable or not; BILL-003 keeps expenses in its WIP and profitability.

**Acceptance.**
1. Record a state filing fee with a receipt and a 10% markup, approve it, invoice it and inspect the invoice line and WIP.
2. A non-billable expense stays off the invoice and appears in profitability.
3. An unapproved expense cannot be invoiced.

### BILL capabilities

#### BILL-001 — Reviewed immutable billing exports

*Tier:* Core

**Requirement.** Reviewers prepare time/fixed-fee CSV drafts with snapshotted sources. The principal approves once with a note; the approved bytes and digest remain unchanged and each source belongs to one live export. Draft voiding releases reservations; CSV cells neutralize spreadsheet formulas and preserve source currency. [Capability rules](docs/contract/bill-001.md) define its record and recovery details.

**Acceptance.**
1. Prepare a mixed time/fixed-fee export, reject source reuse and non-owner approval, approve as principal and download twice.
2. Verify identical CSV bytes, source locks, formula-safe cells and a voided draft's released sources.

#### BILL-002 — Invoices retainers and recurring fees

*Tier:* Core · *From:* BILL-002 · *Cites:* BASE-AUDIT-001, BASE-DATA-001, BASE-DATA-003, BASE-ROLE-001

**Requirement.** Create numbered USD invoices from approved time, fixed scope, milestones or recurring retainers; separate fee entitlement from job completion. Preview invoice lines, terms, authorized sales-tax treatment, credits and client recipients, then approve and deliver PDF/portal invoices. Retainer deposits, credits, price changes, cancellation and prorations remain traceable. Select exactly one invoice authority: Blotter, QuickBooks Online or Xero; schedule generation is idempotent. [Capability rules](docs/contract/bill-002.md) define its record and recovery details.

**Acceptance.**
1. Bill a fixed engagement and hourly extra, start a monthly retainer, apply a deposit and preview a fee amendment.
2. Approve/deliver invoices, repeat the schedule event and inspect one invoice per entitlement with USD totals and retained source links.
3. an issued invoice appears in the client history linked to its source time and fees.
4. Approved time, adjustments and expenses share source reservations with reviewed exports; a numbered document never releases its source links.
5. No taxability, bank settlement, charge or automatic proration is inferred.
6. Monthly rules approved by the principal or a financial-authority holder create one draft per rule/month; issue and send are separate person actions unless a holder's recorded automatic-issue consent covers the rule revision (below); price changes and cancellation apply from the reviewed future month while existing entitlement prices remain.
7. An explicit recorded credit allocation changes the current balance, never the issued PDF.
8. Invoice links are contact/revision-bound, expire after 30 days, expose only their invoice and recheck live billing/portal/email authority.

#### BILL-006 — Invoice delivery reconciliation and copy custody

*Tier:* Core · *From:* BILL-002 · *Cites:* BASE-AUDIT-001, BASE-DATA-001, BASE-DATA-003, BASE-ROLE-001

**Requirement.** Invoices retainers and recurring fees includes capability journey on the same client, engagement and current source records. [Capability rules](docs/contract/bill-002.md) define its record and recovery details.

**Acceptance.**
1. Unresolved sends are held for provider-evidence reconciliation without replay.
2. Restored rules are paused and old invoice links revoked.
3. Issued/sent/voided history links to its source job; open balances name an owner, next action and due date.
4. Native invoice search and merge/undo preserve immutable document bytes and sources.
5. Existing performance reports project the selected job cohort’s native invoices, retainers, supplied credits and open USD receivables from live sources, with job/document/source links, generation time and the same values in CSV/PDF; they never label supplied credit evidence as provider settlement.
6. Each report download records its client scope and named downloader for erasure receipts.
7. Invoices, credits, rules and deliveries join ERASURE-002 billing/link classes, holds, counts, receipt and journal fence; open invoice balances and unapplied deposits/credits refuse whole-client erasure and billing expiry.
8. Erased-client invoice identities are absent from normal billing lists and use opaque expiry labels; explicit retained detail/PDF reads require the principal and are audited.

#### BILL-007 — Invoice retention and restore authority

*Tier:* Core · *From:* BILL-002 · *Cites:* BASE-AUDIT-001, BASE-DATA-001, BASE-DATA-003, BASE-ROLE-001

**Requirement.** Invoices retainers and recurring fees includes capability journey on the same client, engagement and current source records. [Capability rules](docs/contract/bill-002.md) define its record and recovery details.

**Acceptance.**
1. Retention clocks use issue and later void/credit/allocation dates in the firm timezone; expiry requires principal confirmation and preserves amounts, number, attribution and SHA-256.
2. INTEGRATE-001 inherits QBO/Xero authority selection and reconciliation before those connectors ship; unavailable external authorities refuse.
3. PAY-001 inherits actual settlement evidence and balances before collections ship.
4. AUTOMATE-001 inherits invoice creation as an additional action before it is exposed; current invoice schedules create approved-rule drafts and, within a recorded consent, issue and send them.

### PAY capabilities

#### PAY-001 — Card ACH and authorized collections

*Tier:* Core · *Cites:* BASE-AUDIT-001, BASE-DATA-001, BASE-DATA-003, BASE-MAIL-001, BASE-ROLE-001

**Requirement.** Collect invoices by card and US ACH through Stripe, with saved-method mandates and explicit authorization for recurring or due-date automatic collection. Show fees in USD, payment terms and ACH pending/settled/returned states; distinguish provider acceptance from settlement. Verify webhook signatures, deduplicate events, reconcile partial payments, refunds, disputes and returns, and own failed-payment follow-up. Provider onboarding, US bank access and saved-method/auto-pay migration from Karbon Payments, TaxDome Payments, Canopy Payments and Financial Cents (MIGRATE-007) are engineering obligations; a method or authorization that cannot move becomes a tracked client reauthorization, and no client is charged automatically without a valid mandate. [Capability rules](docs/contract/pay-001.md) define its record and recovery details. Under RL-101, quick collect uses explicit current invoice-specific consent and its remaining cumulative cap, current financial authority and the current recipient revision; revocation or restore prevents another charge. Recurring and due-date mandates remain separate required work.

**Acceptance.**
1. Pay a real authorized low-value invoice by card and ACH, authorize a recurring mandate and inspect provider receipts and ledger reconciliation.
2. At the provider test edge exercise duplicate/out-of-order events, ACH return, partial payment, refund and failed collection; revoke the mandate and verify no later debit.
3. trace a request from email through upload and review to its payment in the client history.
4. Recurring collection and incumbent migration remain unbuilt and no automatic retry is authorized.
5. PAY-002, BILL-005, MIGRATE-007, NOTIFY-001 and ERASURE-002 retain their named obligations.

#### PAY-002 — Payment plans and client payment self service

*Tier:* Core · *Cites:* BASE-AUDIT-001, BASE-DATA-001, BASE-DATA-003, BASE-ROLE-001

**Requirement.** In the portal, clients see open invoices, statements and payment history. They can pay several invoices in one payment, save or remove payment methods, set up auto-pay, and accept a firm-offered installment plan with an amount, a schedule and a mandate. Scheduled charges run only under explicit authorization, with a reminder before each debit. A missed or returned installment creates owned follow-up instead of an unauthorized retry. [Capability rules](docs/contract/pay-002.md) define its record and recovery details.

**Acceptance.**
1. A client pays two invoices in one card payment, and the payment is allocated correctly.
2. The client accepts a three-installment ACH plan; the second installment is returned, which creates owned follow-up with no retry outside the authorized policy.
3. After the client removes a saved card, a later auto-pay is refused.

### BILL capabilities

#### BILL-003 — WIP receivables realization and profitability

*Tier:* Core · *Cites:* BASE-AUDIT-001, BASE-DATA-001, BASE-DATA-003, BASE-ROLE-001

**Requirement.** Report unbilled WIP, earned/deferred retainers, aged receivables, collection follow-up (reminders and statements under BILL-004), credits, write-ups/downs, billed-versus-recorded realization, utilization and client/job/service profitability using approved time, cost and invoice/payment sources. Drill into calculation inputs, exclude duplicate exports and keep uncollected, settled and written-off amounts distinct. Partners approve credits, write-offs and collection messages. [Capability rules](docs/contract/bill-003.md) define its record and recovery details.

**Acceptance.**
1. Run WIP, aging and profitability for a client with hourly work, fixed fees, a retainer, partial payment and credit.
2. Reconcile totals to approved sources and provider state, approve a write-off and inspect the changed period report without rewriting historical invoices.
3. The inclusive period-start cohort and existing client/service/assignee filters apply before grouping.
4. Totals sum approved billable time and adjustments, earned fixed fees, approved expense charges and costs, margin before staff cost, unreserved ready-to-bill WIP and approved export snapshots.
5. Draft reservations remove WIP but never count as approved exports; voiding restores that WIP.
6. Each group links to its source jobs and their calculation inputs.

#### BILL-004 — Invoice reminders statements and bulk resend

*Tier:* Core · *Cites:* BASE-AUDIT-001, BASE-DATA-001, BASE-DATA-003, BASE-MAIL-001, BASE-ROLE-001

**Requirement.** They stop when an invoice is paid, disputed or on a payment plan, and can be overridden per client. Staff can bulk resend selected invoices and generate monthly client statements of open invoices, credits and payments. Quick collect charges a saved method only within its PAY-001 authorization. Every reminder is recorded in the client's history. [Capability rules](docs/contract/bill-004.md) define its record and recovery details. Quick collect follows PAY-001 and RL-101; the 22 October reminder-consent and edit-to-pause rider remains in force.

**Acceptance.**
1. Issue three invoices with different due dates, let the reminders run and pay one between steps; only the unpaid invoices are reminded, on schedule.
2. Bulk resend two invoices.
3. Generate a statement and reconcile it to open balances.
4. Quick collect one invoice with an authorized saved card; a quick collect without authorization is refused.

#### BILL-005 — Payment gated delivery and credit hold

*Tier:* Core · *From:* BILL-005 · *Cites:* BASE-AUDIT-001, BASE-DATA-001, BASE-DATA-003, BASE-ROLE-001

**Requirement.** A firm can require payment before releasing selected work product in the portal, such as a final return copy. The client sees the file as locked until paid. A card payment unlocks it on provider confirmation. For ACH the firm chooses whether a pending payment unlocks it or settlement is required. Records the client supplied are never withheld, consistent with Circular 230 §10.28; only the firm's own work product can be gated. Clients past a firm balance threshold go on credit hold: staff see the hold, and creating new work warns. A partner can override a gate or hold, with a recorded reason. [Capability rules](docs/contract/bill-005.md) define its record and recovery details.

**Acceptance.**
1. Gate a final return copy on an invoice.
2. The client sees it locked, pays by card, and the file unlocks.
3. With a wait-for-settlement ACH policy, the file stays locked until settlement.
4. The client's own uploaded documents stay downloadable throughout.
5. A partner override is recorded with its reason, and new work for an overdue client shows the credit hold.
6. Every version of a gated deliverable is withheld from the client portal, the portal file door and any bearer share link (HTTP 402 naming the invoice) until the invoice's gross is covered by applied credits, recorded deposits and observed net provider payments under the ACH policy; staff downloads are never gated.
7. A write-off never releases a gate; only a partner (principal or financial-authority holder) override with a reason does, and it can be taken back.
8. A receipt records how it was paid (card, ACH or other): a card or other receipt counts when recorded, an ACH deposit may be recorded pending until the bank settles it, and the firm policy (principal only, default: settlement required) chooses whether a pending ACH deposit releases a gated file.

#### BILL-008 — Credit holds and settled-balance reconciliation

*Tier:* Core · *From:* BILL-005 · *Cites:* BASE-AUDIT-001, BASE-DATA-001, BASE-DATA-003, BASE-ROLE-001

**Requirement.** Payment gated delivery and credit hold includes capability journey on the same client, engagement and current source records. [Capability rules](docs/contract/bill-005.md) define its record and recovery details.

**Acceptance.**
1. The same principal-only policy sets the credit-hold threshold (default: off) and grace days (default: 0): a client is on credit hold when the open balance of its issued invoices past due, after the grace days, is at least the threshold.
2. Staff with client access see the hold on the client (amounts only if they may read billing); the job start, roll-forward and bulk schedule doors warn without blocking; a partner overrides or restores the hold with a reason, and any payment or write-off lowering the balance below the threshold ends the hold.
3. Gates, overrides and the policy are audited, appear in the client's billing history, are carried by archives and join ERASURE-002's link and firm classes (reasons redacted on client erasure).
4. PAY-001 supplies the client's own card payment in the portal, provider confirmation and ACH states; its payment, refund and return events inherit this gate and hold, and a returned ACH payment relocks the file; Every staff job screen rechecks and shows the live hold, including recurrence-generated and intake-onboarding work; no billing amounts are shown to staff without billing access.
5. A new intake conversion creates a new client without an inherited balance.

### REPORT capabilities

#### REPORT-001 — Firm performance and client reporting

*Tier:* Core · *From:* REPORT-001 · *Cites:* BASE-AUDIT-001, BASE-DATA-001, BASE-DATA-003, BASE-ROLE-001

**Requirement.** Principals report work status, overdue/blocked jobs, turnaround, client response delay, review rework, deadlines, staff utilization, capacity and profitability by client/service/team/period. Saved views, scheduled internal reports and permission-checked CSV/PDF exports link to source records and state data freshness. Client-facing reports contain only approved client-visible data. [Capability rules](docs/contract/report-001.md) define its record and recovery details.

**Acceptance.**
1. Complete and delay several engagements, filter a period/team and drill from turnaround and overdue totals to source jobs.
2. Schedule a partner report, export it and compare totals; a preparer/client cannot obtain the firm's private financial report.
3. read counts and time in each status for the 1040 work type.
4. Period filters select jobs whose period start is within the inclusive date range; client, service/work type and assigned team member further restrict the cohort.
5. A team member matches preparer, reviewer, manager or partner.
6. Turnaround is created-to-sign-off elapsed UTC minutes, floored; review rework counts recorded returns.
7. Client response delay is accepted-provider reminder to first retained portal upload of that requested document, or elapsed waiting time if unanswered; unsent reminders are not a response clock.
8. Overdue means unfinished and due before today in the firm zone.

#### REPORT-002 — Status throughput and recurring report delivery

*Tier:* Core · *From:* REPORT-001 · *Cites:* BASE-AUDIT-001, BASE-DATA-001, BASE-DATA-003, BASE-ROLE-001

**Requirement.** Firm performance and client reporting includes capability journey on the same client, engagement and current source records. [Capability rules](docs/contract/report-001.md) define its record and recovery details.

**Acceptance.**
1. Stage/sub-status visits, current counts and elapsed minutes come from WORK-007 history for that cohort.
2. Capacity is CAPACITY-001 whole Monday–Sunday weeks overlapping the chosen range; billable approved time in the range divided by available minutes is utilization, rounded to two percentage decimals (zero availability is undefined).
3. Money is grouped by stored currency: approved billable time and adjustments, signed-off fixed fees, approved expense charges/costs, unbilled sources and immutable approved export lines, counted once.
4. Margin is before staff cost; exports never claim invoicing, collection or settlement.
5. Reports expose calculation inputs and job/export links with generation time; they recompute from retained sources after erasure.
6. Under the held company policy, principal/reviewer financial access follows existing BILL-001 authority; preparers, agent keys and client links cannot read internal reports or exports.
7. Saved views store filters.
8. The principal schedules an active principal/reviewer a live permission-checked link on firm-local dates at a whole-day interval; notification hours apply, one durable notice per due date, downtime coalesces to one current link, revoked authority pauses delivery, and restored schedules remain paused without principal authority.

#### REPORT-003 — Client report scope and source erasure

*Tier:* Core · *From:* REPORT-001 · *Cites:* BASE-AUDIT-001, BASE-DATA-001, BASE-DATA-003, BASE-ROLE-001

**Requirement.** Firm performance and client reporting includes capability journey on the same client, engagement and current source records. [Capability rules](docs/contract/report-001.md) define its record and recovery details.

**Acceptance.**
1. Existing client progress reports remain limited to PORTAL-003/CRM-001 approved client-visible data.
2. Each future capability adds its complete reporting before shipping: MAIL-001/003, SMS-001 and FOLLOWUP-001 response/delivery history; BILL-002/003/004, PAY-001/002 and INTEGRATE-001 invoice, retainer, receivable, cost, collection and profitability sources; LEDGER-001/002 source freshness; PORTAL-002/005 and MOBILE-001 any client report/export doors.
3. These inherit permission checks, source drill-down, CSV/PDF parity, freshness and BASE-001 evidence, retaining their destinations/statuses.

### INTEGRATE capabilities

#### INTEGRATE-001 — Firm accounting invoice and payment exchange

*Tier:* Core · *Cites:* BASE-AUDIT-001, BASE-DATA-001, BASE-DATA-003, BASE-ROLE-001

**Requirement.** Connect the firm's QuickBooks Online or Xero billing organization separately from each client's ledger grant. Map customers, services, tax codes, invoice IDs, credits and payments to the chosen invoice authority; preview direction and conflicts before enabling writes. Reconcile provider and accounting events without duplicate invoices or silently overwriting closed periods; sync failures have an owner and repair action. [Capability rules](docs/contract/integrate-001.md) define its record and recovery details.

**Acceptance.**
1. Connect firm QBO and Xero organizations in separate runs, choose each as invoice authority, deliver an approved invoice and reconcile payment/credit.
2. Replay an event, change a closed-period invoice externally and inspect one source of truth and a visible conflict.

#### INTEGRATE-002 — US tax software document and status handoff

*Tier:* Core · *Cites:* BASE-AUDIT-001, BASE-DATA-001, BASE-DATA-003, BASE-ROLE-001

**Requirement.** Support Lacerte, ProSeries, Drake, UltraTax CS and CCH Axcess through authorized connectors and desktop print/upload bridges where needed. Map client/entity/year, deliver source documents and retrieve final packets, signature requests (SIGN-001) and filing status from the source INTEGRATE-008 names for each stack. Preview unsupported fields and require practitioner confirmation for ambiguous matches; no handoff implies a return was calculated or filed. [Capability rules](docs/contract/integrate-002.md) define its record and recovery details.

**Acceptance.**
1. For each named tax stack, send an approved client-year packet through its supported connector/desktop path, receive a final packet and that stack's INTEGRATE-008 filing-status evidence and inspect IDs/provenance.
2. Disconnect the bridge and verify blocked work remains owned and no false filed state appears.

#### INTEGRATE-003 — Connected document storage

*Tier:* Core · *Cites:* BASE-AUDIT-001, BASE-DATA-001, BASE-DATA-003, BASE-ROLE-001

**Requirement.** Connect Google Drive, OneDrive, SharePoint and Dropbox with explicit folder/client mapping, least-scope authority and clear original/copy/link custody. Sync approved versions and metadata, preserve internal-only rules, detect moved/deleted/changed files and surface permission conflicts; never grant a portal user access to an entire external folder by accident. [Capability rules](docs/contract/integrate-003.md) define its record and recovery details.

**Acceptance.**
1. Connect each service, map two client folders and import/link an approved packet.
2. Replace and move a source file, revoke a grant and attempt a cross-client share; inspect versions, freshness, custody and denied access.

#### INTEGRATE-004 — Ignition engagement onboarding

*Tier:* Core · *Cites:* BASE-AUDIT-001, BASE-DATA-001, BASE-DATA-003, BASE-ROLE-001

**Requirement.** An authorized Ignition accepted proposal creates or links the correct client, records accepted scope/fees and launches assigned onboarding with the signed-document reference. Changes, cancellations and duplicate events create reviewed amendments or stop future work rather than duplicating engagements or silently changing signed scope. [Capability rules](docs/contract/integrate-004.md) define its record and recovery details.

**Acceptance.**
1. Accept a real authorized Ignition proposal, observe client/team/onboarding creation and signed-scope linkage, replay the event and amend/cancel it.
2. Inspect exactly one engagement and a reviewed change with future work stopped when appropriate.

#### INTEGRATE-005 — Calendars and client appointment booking

*Tier:* Core · *Cites:* BASE-AUDIT-001, BASE-DATA-001, BASE-DATA-003, BASE-ROLE-001

**Requirement.** Connect Google Calendar and Outlook Calendar for staff commitments and job deadlines with configurable direction, time-zone/DST handling and private-event masking. Embed or link Calendly and Acuity Scheduling from the client portal, attach appointments to engagements and update capacity for cancellations/reschedules without duplicate events. [Capability rules](docs/contract/integrate-005.md) define its record and recovery details.

**Acceptance.**
1. Connect Google and Outlook staff calendars, book one Calendly and one Acuity appointment through a portal and reschedule across DST.
2. Inspect capacity and the client timeline, masked private events and removal of canceled commitments.
3. with calendar consent, a client meeting suggests time on its job linking the event; a private event or a withdrawn consent suggests nothing.

#### INTEGRATE-006 — Authorized IRS transcripts

*Tier:* Core · *Cites:* BASE-AUDIT-001, BASE-DATA-001, BASE-DATA-003, BASE-ROLE-001

**Requirement.** Retrieve IRS e-Services/TDS transcripts through the authorized practitioner account and specialist integration with required taxpayer authorization, identity verification and permitted data use. Track request, pending, received, unavailable and failed states, source period and freshness; reconcile transcript differences into notice/review work. Never bypass practitioner credentials, authority restrictions or agency access rules. [Capability rules](docs/contract/integrate-006.md) define its record and recovery details.

**Acceptance.**
1. Using an authorized practitioner/taxpayer pair, request a permitted transcript, receive it into the correct client-period and link a discrepancy to review.
2. Exercise absent authorization, expired practitioner access and pending/failure responses without a fabricated transcript.

#### INTEGRATE-007 — Gusto payroll engagement context

*Tier:* Core · *Cites:* BASE-AUDIT-001, BASE-DATA-001, BASE-DATA-003, BASE-ROLE-001

**Requirement.** Connect Gusto payroll clients with permission to read payroll work items, run status and due-date evidence, route unresolved payroll requests into practice work and link the authoritative payroll record. A completed practice checklist cannot mark payroll paid, taxes remitted or a 941 filed without source evidence. [Capability rules](docs/contract/integrate-007.md) define its record and recovery details.

**Acceptance.**
1. Connect an authorized Gusto client, observe a payroll work item and missing-information exception, follow its run status and inspect the linked source result.
2. Revoke access and verify stale status and owned follow-up without payroll money movement.

#### INTEGRATE-008 — Return filing status source per tax stack

*Tier:* Core · *Cites:* BASE-AUDIT-001, BASE-DATA-001, BASE-DATA-003, BASE-ROLE-001

**Requirement.** Each tax stack has a named source of filing-status evidence. For CCH Axcess and UltraTax CS, it is the stack's authorized e-file status API or status export. For Lacerte, ProSeries and Drake, it is the e-file status report export. The INTEGRATE-002 desktop bridge reads the desktop stacks' exports on the practitioner's machine. When a stack exposes no status for a return, the practitioner records the IRS or state acknowledgment (submission ID, accepted or rejected, date) with the acknowledgment file, and the status is labeled practitioner-recorded. Status values are not transmitted, transmitted, accepted, rejected (with its reject code) and paper-filed with proof, each with its source and time received. A rejection reopens the work item to the firm's rework status (WORK-007). A checklist, signature or work status never implies a filing. [Capability rules](docs/contract/integrate-008.md) define its record and recovery details.

**Acceptance.**
1. For each of the five stacks, ingest one return's status from that stack's named source (transmitted, then accepted) and one rejection with its reject code, each mapped to the right client-year.
2. For a return whose stack exposes no status, record a practitioner acknowledgment with its submission ID and file.
3. Confirm the labels distinguish each source, and that the rejection reopens the work item to rework.
4. Disconnect the bridge and confirm no status is invented.

### API capabilities

#### API-001 — Authenticated product HTTP doors

*Tier:* Core · *Cites:* BASE-INPUT-001, BASE-OPS-003, BASE-ROLE-001

**Requirement.** Under the held company policy, authenticated HTTP doors expose native clients, templates, work, checklist, time, billing exports and role-appropriate context. Direct route calls obey the same actor, job visibility and human-approval rules as the app; agent keys cannot invoke person-only doors. [Capability rules](docs/contract/api-001.md) define its record and recovery details.

**Acceptance.**
1. Under the held company policy, create/read work and time through the authenticated HTTP API, inspect billing as reviewer and refuse preparer/private-job reads, signed-out access and agent-key use on person-only routes.

#### API-002 — Documented API webhooks and Zapier

*Tier:* Core · *From:* API-002 · *Cites:* BASE-AUDIT-001, BASE-DATA-001, BASE-DATA-003, BASE-INPUT-001, BASE-OPS-003, BASE-ROLE-001 · *Register:* R-6

**Requirement.** Publish a versioned client/work/time/document/billing API with scoped revocable integration keys, pagination, filters, idempotent writes and explicit rate limits. Signed webhooks and Zapier triggers/actions support owner-configured cross-app workflows with field mapping, delivery history, replay control and conflict handling. External credentials never inherit broader owner authority. [Capability rules](docs/contract/api-002.md) define its record and recovery details.

**Acceptance.**
1. Connect Zapier to create a client and task from an approved event, read paginated work/time and receive a signed completion webhook.
2. Replay a write/event, revoke a key and inspect deduplication, bounded scopes and actionable delivery failure.
3. Limit defaults to 50 and accepts whole numbers 1–100.
4. Work filters retain native queue visibility, including named-task access, and sort ascending by due day, client name (JavaScript UTF-16 code-unit order) and id.
5. Time retains the existing principal/reviewer-all versus preparer-own-person scope, intersects an optional person filter and inclusive recorded-date from/to bounds, and sorts descending by date, creation instant and id; the paginated door has no total 500-row ceiling.
6. Cursors bind route, normalized filters, staff email/role and the last sort tuple, never grant authority, and every page recomputes current native scope.
7. Pages are a live view, not a frozen snapshot: concurrent changes to sort fields can move records across a consumed boundary; restart for a fresh traversal.
8. Work response pages currently materialize the authorized filtered queue in memory; time and clients use SQL keysets.

#### API-003 — Native client and billing API authority

*Tier:* Core · *From:* API-002 · *Cites:* BASE-AUDIT-001, BASE-DATA-001, BASE-DATA-003, BASE-INPUT-001, BASE-OPS-003, BASE-ROLE-001

**Requirement.** Documented API webhooks and Zapier includes capability journey on the same client, engagement and current source records. [Capability rules](docs/contract/api-002.md) define its record and recovery details.

**Acceptance.**
1. Client pages sort ascending by name in SQLite BINARY (UTF-8 byte) order then id, intersect an optional exact client id, and share the workspace’s fields, JSON string types and masked SSN last-four value.
2. Principals/reviewers see every unmerged client, including archived clients and clients without work; preparers need a currently readable job, including named-task access.
3. Client reads use the existing native session, current-member and MFA gates; agent bearer keys do not authenticate them.
4. Neither the cursor nor an old session preserves removed job/task authority.
5. These reads create no records or grants.
6. Existing app/queue/timesheet responses keep their behavior.
7. The broader native integration implementation and remaining gaps are stated below; this clause stays partial.
8. with the firm MFA policy on, a person-created API session without a second factor is refused before any data; after the factor it reads only that person's authorized records; an enrolled person's new API session is challenged even while the policy is off.

### AUTOMATE capabilities

#### AUTOMATE-001 — Durable firm automation

*Tier:* Core · *Cites:* BASE-AUDIT-001, BASE-DATA-001, BASE-DATA-003, BASE-ROLE-001

**Requirement.** Firm-reviewed schedules and events coordinate status changes (WORK-007), recurrence, conditional step advancement, email filing, review notifications, reminders, onboarding and due-date billing. Triggers include a work item entering a primary status or sub-status, all its tasks completing, a client request or organizer completing, a signature completing and a due time. Actions include setting a status, assigning a role, sending a templated message (MSG-001), requesting documents or a signature and creating an invoice. Each rule has an owner, client scope, budget, preview, pause/stop, durable attempt/outcome and visible next action. Recovery deduplicates accepted effects, rechecks authority and reconciles ambiguous provider outcomes before repeating external messages or charges. [Capability rules](docs/contract/automate-001.md) define its record and recovery details.

**Acceptance.**
1. Enable rules through the app, including "when all tasks complete, set status In review" and "on entering Waiting – on client documents, send the request template".
2. Trigger status, file/task/proposal and due-time events, interrupt processing after provider acceptance and restart.
3. Inspect one authorized effect, retained attempts, a visible ambiguous/failing item and no work after rule pause or authority revocation.
4. an automation on entering "Waiting – on 8879 signature" fires once when a 1040 job enters it.
5. moving a 1040 card on the board into "Waiting – on 8879 signature" fires that automation once.

### IMPORT capabilities

#### IMPORT-001 — Reviewed client list import

*Tier:* Core · *From:* IMPORT-001

**Requirement.** Preview CSV account/contact imports with flexible field mapping, validation, entity/contact matching, duplicate policy and source provenance. Commit exactly the reviewed file/mapping, resume safely and inspect the journal. Undo removes untouched imported records while preserving clients with native work or conflicting edits; source originals remain protected and portable. [Capability rules](docs/contract/import-001.md) define its record and recovery details.

**Acceptance.**
1. Map an exported client/contact CSV, preview errors and duplicates without writes, commit its reviewed fingerprint and resume.
2. Re-import without duplication, create a native job on one imported client and undo; inspect preserved native work and the source journal.
3. Repeated stable source client IDs group agreeing entity fields and entity-specific contacts; a contact matches only its stable source ID or exact normalized email within that entity.
4. Conflicting rows block the whole preview.
5. The mapped format imports individual/business/trust and native-validated contact roles, phone and explicit authority/consent flags, all default false.
6. Possible native duplicates require an explicit keep-separate or provenance-only match to an active entity of the same type; supplied contacts must agree exactly with its native relationships.
7. A match never changes native fields or grants.
8. CRM-004 remains the merge door.

#### IMPORT-002 — Stable source matches and import replay

*Tier:* Core · *From:* IMPORT-001

**Requirement.** Reviewed client list import includes capability journey on the same client, engagement and current source records. [Capability rules](docs/contract/import-001.md) define its record and recovery details.

**Acceptance.**
1. Stable source associations survive native merges and replay; changed source content is refused, never silently applied.
2. Resume uses the retained reviewed plan; undo removes untouched created contacts/entities, keeps any entity/contact edit or native dependent work, and never removes a matched native entity.
3. Owner-only journals and practice archives retain original UTF-8 bytes, mapping, decisions and source IDs.
4. Existing v1 jobs and their established single-contact permissions remain resumable and reversible.

### MIGRATE capabilities

#### MIGRATE-001 — Karbon migration

*Tier:* Core · *Cites:* BASE-AUDIT-001, BASE-DATA-001, BASE-DATA-003, BASE-ROLE-001

**Requirement.** Migrate Karbon using authorized API extraction and supported exports/assisted extraction for clients/contacts/groups/custom fields, work types, primary statuses and firm sub-statuses with their per-type limits, job roles, work templates, repeating work schedules with the future work items they have already created (MIGRATE-006), automators (imported paused), email templates, active tasks/dependencies and assignments, triage email/thread references, notes/files, time/budget/billing history and Karbon Payments auto-pay enrollments with their saved-method references (MIGRATE-007). Preview every supported mapping, row/file count, identity/permission match and unsupported or unavailable field; preserve originals, authors, timestamps and source IDs as labeled history. Reauthorize mail, ledger and signature grants; auto-pay mandates are migrated or reauthorized under MIGRATE-007. Stage active work with outgoing automation paused, reconcile counts and unresolved items, and approve cutover before activating follow-up; support idempotent resume and conflict-preserving batch undo. Missing source export surfaces require an owned extraction plan, never silent data loss. [Capability rules](docs/contract/migrate-001.md) define its record and recovery details.

**Acceptance.**
1. Import an authorized Karbon practice containing completed history and live work, confirm every active work item keeps its work type and primary/sub-status (WORK-007) and that an unmapped status is held for review, review mappings and source limitations, compare counts and representative files/messages/fees, interrupt/resume and repeat the import.
2. On the same practice, pass MIGRATE-006's repeating-schedule journey (monthly, quarterly and annual series with pre-created future items) and MIGRATE-007's auto-pay journey (three auto-pay clients).
3. Complete a migrated engagement through review/payment, verify historical permissions and no duplicate reminders/debits, then exercise cutover rollback without deleting native work.
4. an imported 1040 work item keeps its work type, sub-status and partner.

#### MIGRATE-002 — TaxDome migration

*Tier:* Core · *Cites:* BASE-AUDIT-001, BASE-DATA-001, BASE-DATA-003, BASE-ROLE-001

**Requirement.** Migrate TaxDome using authorized API extraction and supported exports/assisted extraction for accounts/contacts, pipelines and stages (mapped to WORK-007 work types and statuses), jobs/templates/automations, recurring jobs with their already-created future jobs (MIGRATE-006), message templates, organizers and answers, portal requests/chats, documents, proposals/signed letters, invoices/credits/payment history, TaxDome Payments saved methods and auto-pay (MIGRATE-007) and staff permissions. Preview every supported mapping, row/file count, identity/permission match and unsupported or unavailable field; preserve originals, authors, timestamps and source IDs as labeled history. Reauthorize mail, ledger and signature grants; saved payment methods and auto-pay are migrated or reauthorized under MIGRATE-007. Stage active work with outgoing automation paused, reconcile counts and unresolved items, and approve cutover before activating follow-up; support idempotent resume and conflict-preserving batch undo. Missing source export surfaces require an owned extraction plan, never silent data loss. [Capability rules](docs/contract/migrate-002.md) define its record and recovery details.

**Acceptance.**
1. Import an authorized TaxDome practice containing completed history and live work.
2. Confirm every active item keeps its mapped work type and pipeline stage (WORK-007) and that an unmapped pipeline stage is held for review with an owner.
3. Run MIGRATE-006's series check on a monthly and an annual recurring job that have already created future items: one recurrence rule each, the pre-created items claimed once, and the next period created exactly once after cutover.
4. Run MIGRATE-007's auto-pay journey with three TaxDome clients who pay automatically.
5. Review mappings and source limitations, compare counts and representative files/messages/fees, interrupt/resume and repeat the import.
6. Complete a migrated engagement through review/payment, verify historical permissions and no duplicate reminders/debits, then exercise cutover rollback without deleting native work.

#### MIGRATE-003 — Canopy migration

*Tier:* Core · *Cites:* BASE-AUDIT-001, BASE-DATA-001, BASE-DATA-003, BASE-ROLE-001

**Requirement.** Migrate Canopy using authorized API extraction and supported exports/assisted extraction for clients/contacts/custom fields, tasks/templates/dependencies, recurring tasks (MIGRATE-006) and task statuses (mapped to WORK-007), notices/transcript references, client files/versions, communications, time/WIP, invoices/credits/payments, Canopy Payments saved methods and scheduled payments (MIGRATE-007) and staff access. Preview every supported mapping, row/file count, identity/permission match and unsupported or unavailable field; preserve originals, authors, timestamps and source IDs as labeled history. Reauthorize mail, ledger and signature grants; saved payment methods and auto-pay are migrated or reauthorized under MIGRATE-007. Stage active work with outgoing automation paused, reconcile counts and unresolved items, and approve cutover before activating follow-up; support idempotent resume and conflict-preserving batch undo. Missing source export surfaces require an owned extraction plan, never silent data loss. [Capability rules](docs/contract/migrate-003.md) define its record and recovery details.

**Acceptance.**
1. Import an authorized Canopy practice containing completed history and live work.
2. Confirm every active item keeps its mapped work type and task status (WORK-007) and that an unmapped task status is held for review with an owner.
3. Run MIGRATE-006's series check on a monthly and an annual recurring task that have already created future items: one recurrence rule each, the pre-created items claimed once, and the next period created exactly once after cutover.
4. Run MIGRATE-007's auto-pay journey with three Canopy clients who pay automatically.
5. Review mappings and source limitations, compare counts and representative files/messages/fees, interrupt/resume and repeat the import.
6. Complete a migrated engagement through review/payment, verify historical permissions and no duplicate reminders/debits, then exercise cutover rollback without deleting native work.

#### MIGRATE-004 — Financial Cents migration

*Tier:* Core · *Cites:* BASE-AUDIT-001, BASE-DATA-001, BASE-DATA-003, BASE-ROLE-001

**Requirement.** Migrate Financial Cents using authorized API extraction and supported exports/assisted extraction for clients/contacts, recurring projects and their already-created future projects (MIGRATE-006) with their statuses (mapped to WORK-007), checklists/assignments, requests/portal documents, client communication, capacity/budgets, time, billing/payment history and saved payment methods with auto-pay (MIGRATE-007). Preview every supported mapping, row/file count, identity/permission match and unsupported or unavailable field; preserve originals, authors, timestamps and source IDs as labeled history. Reauthorize mail, ledger and signature grants; saved payment methods and auto-pay are migrated or reauthorized under MIGRATE-007. Stage active work with outgoing automation paused, reconcile counts and unresolved items, and approve cutover before activating follow-up; support idempotent resume and conflict-preserving batch undo. Missing source export surfaces require an owned extraction plan, never silent data loss. [Capability rules](docs/contract/migrate-004.md) define its record and recovery details.

**Acceptance.**
1. Import an authorized Financial Cents practice containing completed history and live work.
2. Confirm every active item keeps its mapped work type and project status (WORK-007) and that an unmapped project status is held for review with an owner.
3. Run MIGRATE-006's series check on a monthly and an annual recurring project that have already created future items: one recurrence rule each, the pre-created items claimed once, and the next period created exactly once after cutover.
4. Run MIGRATE-007's auto-pay journey with three Financial Cents clients who pay automatically.
5. Review mappings and source limitations, compare counts and representative files/messages/fees, interrupt/resume and repeat the import.
6. Complete a migrated engagement through review/payment, verify historical permissions and no duplicate reminders/debits, then exercise cutover rollback without deleting native work.

#### MIGRATE-005 — Double migration

*Tier:* Core · *Cites:* BASE-AUDIT-001, BASE-DATA-001, BASE-DATA-003, BASE-ROLE-001

**Requirement.** Migrate Double using authorized API extraction and supported exports/assisted extraction for clients/contacts, recurring close tasks (MIGRATE-006) with their statuses and review state (mapped to WORK-007), transaction questions/answers, ledger/source references, files, communication, assignments and retained time/billing records. Preview every supported mapping, row/file count, identity/permission match and unsupported or unavailable field; preserve originals, authors, timestamps and source IDs as labeled history. Reauthorize mail, ledger and signature grants. Double has no client auto-pay to migrate; client billing held by a connected partner such as Anchor is carried as labeled history. Stage active work with outgoing automation paused, reconcile counts and unresolved items, and approve cutover before activating follow-up; support idempotent resume and conflict-preserving batch undo. Missing source export surfaces require an owned extraction plan, never silent data loss. [Capability rules](docs/contract/migrate-005.md) define its record and recovery details.

**Acceptance.**
1. Import an authorized Double practice containing completed history and live work.
2. Confirm every active item keeps its mapped work type and close status (WORK-007) and that an unmapped close status is held for review with an owner.
3. Run MIGRATE-006's series check on a monthly and an annual recurring close task that have already created future items: one recurrence rule each, the pre-created items claimed once, and the next period created exactly once after cutover.
4. Review mappings and source limitations, compare counts and representative files/messages/fees, interrupt/resume and repeat the import.
5. Complete a migrated engagement through review/payment, verify historical permissions and no duplicate reminders/debits, then exercise cutover rollback without deleting native work.

#### MIGRATE-006 — Recurring schedules and future work carry over

*Tier:* Core · *From:* MIGRATE-006 · *Cites:* BASE-AUDIT-001, BASE-DATA-001, BASE-DATA-003, BASE-ROLE-001

**Requirement.** Every source's recurring definitions migrate as WORK-002 rules, never as loose jobs: Karbon repeating work schedules (period, frequency, end date and how far in advance work is created, three months by default), TaxDome recurring jobs, Canopy recurring tasks, Financial Cents recurring projects and Double recurring close tasks. Each source series becomes exactly one recurrence rule linked to its migrated template (WORK-001), with the same frequency, anchor period, fiscal-year end, end date, assignees and job roles, budget and creation lead time. Future items the source has already created are imported once, keep their period, status, assignees and edits, and are claimed by that rule as periods it already holds; information the source carries from the previous item in a series is carried the same way. After cutover the scheduler creates only periods the source had not created, each exactly once, and no period is duplicated or skipped across the cutover boundary. A series Blotter cannot express exactly (an unsupported frequency, a missing template, an assignee with no matched staff member) is held for review with a named owner and listed on the cutover report; cutover cannot be approved while such a series has no owner, and no series is silently dropped or flattened into single jobs. Re-running or resuming the import matches source series and item IDs, so it never creates a second rule or a second set of future items. [Capability rules](docs/contract/migrate-006.md) define its record and recovery details.

**Acceptance.**
1. Import an authorized Karbon practice with a monthly close series that has already created its next three periods, a quarterly 941 series and an annual 1120-S series.
2. Inspect one rule per series linked to its migrated template, with the source frequency, end date, assignees, budget and lead time, and the three pre-created monthly items attached to the monthly rule with their Karbon IDs.
3. Approve cutover and advance the scheduler's horizon by one month: it creates exactly the first monthly period Karbon had not created, nothing for periods already held, and no period between the last Karbon item and the first Blotter item is missing.
4. Add a series with a frequency Blotter cannot express and confirm it is held for review with its owner on the cutover report rather than dropped.
5. Repeat the import and confirm rule and future-item counts are unchanged.
6. The source cadence must equal the mapped template cadence; native first/end periods, selected months, whole-month lead time, integer-minute budget and due-day semantics follow WORK-002.
7. A held mapping retains its source note and named active review owner; unsupported cadence, missing mappings and a competing client/template rule never create loose jobs.
8. Source system/practice/series and item IDs bind once, exact replays reuse them, and changed mapped replays refuse.

#### MIGRATE-008 — Atomic recurrence carry-over and reviewed resume

*Tier:* Core · *From:* MIGRATE-006 · *Cites:* BASE-AUDIT-001, BASE-DATA-001, BASE-DATA-003, BASE-ROLE-001

**Requirement.** Recurring schedules and future work carry over includes capability journey on the same client, engagement and current source records. [Capability rules](docs/contract/migrate-006.md) define its record and recovery details.

**Acceptance.**
1. Commit rechecks the preview's native rows and active staff, creates the paused rule and every existing-job claim in one batch, and leaves job edits/status/assignments intact.
2. The existing exact schedule activation review is mandatory before generation, including after archive restore.
3. This operator door does not parse an incumbent export, attest its completeness, create imported future jobs or carry prior-item answers; those acceptance points remain open.

#### MIGRATE-007 — Auto pay enrollments carried over or reauthorized

*Tier:* Core · *Cites:* BASE-AUDIT-001, BASE-DATA-001, BASE-DATA-003, BASE-ROLE-001

**Requirement.** Migration imports each client's auto-pay enrollment and saved-method references (card or US bank account, brand and last four, authorization date and wording where available): from Karbon Payments, which runs on Stripe Connect, under MIGRATE-001, and from TaxDome Payments, Canopy Payments and Financial Cents under MIGRATE-002 to 004. Each enrollment ends in exactly one state. It becomes a valid PAY-001 mandate when the saved method is copied through Stripe's account-to-account payment-data migration (with the consent the source platform and Stripe require) and an authorization naming the firm covers Blotter's collection. Otherwise it becomes a tracked reauthorization request for that client: a MSG-001 template message with a portal link to authorize a new mandate (PAY-002), chased under FOLLOWUP-001 and owned until the client authorizes or declines. Until a client's mandate is migrated or reauthorized, Blotter never charges that client automatically; their invoices stay open with owned follow-up. A cutover report lists every auto-pay client as migrated, awaiting reauthorization or declined, with owner and last chase, and updates as clients act. Each invoice has exactly one collector: source auto-pay must be recorded off for a client before Blotter's first automatic charge, and an invoice still open in the source is either left to the source or imported open with source collection stopped, so no client is charged twice across the source and Blotter. [Capability rules](docs/contract/migrate-007.md) define its record and recovery details.

**Acceptance.**
1. Migrate three Karbon auto-pay clients, one whose saved card copies through Stripe's payment-data migration at the provider test edge and two whose methods cannot be copied.
2. Inspect the cutover report: one mandate migrated and two awaiting reauthorization, each with an owner and a sent template message.
3. Have one of the two reauthorize through the portal and watch the report update.
4. Issue the first post-cutover invoices: the migrated and reauthorized clients are collected automatically on the due date; the third client's invoice is not charged, stays open and carries owned reauthorization follow-up with a scheduled chase.
5. Confirm Karbon auto-pay was recorded off for each client before Blotter's first charge and that no invoice was charged in both systems.

### ACCESS capabilities

#### ACCESS-001 — Native roles and server authority

*Tier:* Core · *Cites:* BASE-ACCESS-001, BASE-ACCESS-002, BASE-ACCESS-004, BASE-ROLE-001, BASE-SIGNIN-001, BASE-SIGNIN-002

**Requirement.** Under the held company policy, the principal invites preparers/reviewers, manages rates and deactivates staff. Every private handler checks the native session/role and assigned-job visibility; writes recheck authority atomically. Same-origin mutations reject cross-site callers. Agent keys are hashed, revocable and separate from human sessions. The firm-enforced second factor is ACCESS-004, Google Workspace/Microsoft 365 sign-in is ACCESS-005 and ownership transfer at offboarding is ACCESS-006. The one named widening of assigned-job visibility: a person assigned a task by name (WORK-009) can read that job and act on their own tasks there, never on its other work; each grant is recorded in the audit log, and access ends when no task on the job is assigned to them. [Capability rules](docs/contract/access-001.md) define its record and recovery details.

**Acceptance.**
1. Invite and sign in staff, call privileged and hidden-job routes as preparer and reviewer, attempt cross-origin writes and deactivate a member.
2. Under the held company policy, inspect immediate denial, unchanged records and agent-key refusal on person-only routes.

#### ACCESS-002 — Client permissions and sensitive data policies

*Tier:* Core · *From:* ACCESS-002 · *Cites:* BASE-ACCESS-001, BASE-ACCESS-002, BASE-ACCESS-004, BASE-AUDIT-001, BASE-DATA-001, BASE-DATA-003, BASE-ROLE-001, BASE-SIGNIN-001, BASE-SIGNIN-002

**Requirement.** Configure least-privilege client/team/document access and separate partner financial authority, reviewer approval, preparer work, read-only staff and external-client identities. Taxpayer identifiers, transcripts, returns, exports and connector credentials have appropriate access, redaction and custody controls. Permission changes and revocation apply to APIs, background tasks, shares and cached sessions; in addition to ACCESS-004's second factor on every staff sign-in, require a fresh step-up for sensitive administration, credential reveals (VAULT-001) and exports. [Capability rules](docs/contract/access-002.md) define its record and recovery details.

**Acceptance.**
1. Give two teams overlapping client scopes, assign a read-only member and restrict a sensitive workpaper.
2. Attempt direct API/export/share reads and background work after revocation, then step up for an authorized export; inspect denied writes and redacted diagnostics.
3. a colleague without the client's grant is never proposed as cover and naming them refuses the plan.
4. First configuration scopes every current staff member; no grant means no client access, including prior sessions, named-task access, API pages and agent context.
5. New staff remain scoped.
6. Client grants intersect the existing preparer/reviewer job role; read-only is a separate restriction refusing writes.
7. Sensitive workpapers are internal to the principal and individually named staff with both client and job authority; restricting revokes contact grants and all existing shares.
8. Permission changes invalidate concurrent writes, and notification/report dispatch rechecks current grants.

#### ACCESS-007 — Sensitive practice administration and recovery

*Tier:* Core · *From:* ACCESS-002 · *Cites:* BASE-ACCESS-001, BASE-ACCESS-002, BASE-ACCESS-004, BASE-AUDIT-001, BASE-DATA-001, BASE-DATA-003, BASE-ROLE-001, BASE-SIGNIN-001, BASE-SIGNIN-002

**Requirement.** Client permissions and sensitive data policies includes capability journey on the same client, engagement and current source records. [Capability rules](docs/contract/access-002.md) define its record and recovery details.

**Acceptance.**
1. Sensitive administration (access settings, team, integration keys, firm settings, retention, credential archive mode, invoice authority and automatic-issue consent) and exports (backup and complete-archive exports, erasure journal, approved billing exports, report CSV/PDF, invoice PDFs, the MFA enrollment report) require a separate fresh second-factor confirmation valid five minutes in that session, from installation and whether or not scopes are configured; restores and imports are not exports.
2. Global financial/export/administration doors without a client-scoped query are principal-only for scoped staff, except for the two delegated permissions below.

#### ACCESS-003 — Enterprise identity lifecycle

*Tier:* Core · *From:* ACCESS-003 · *Cites:* BASE-ACCESS-001, BASE-ACCESS-002, BASE-ACCESS-004, BASE-AUDIT-001, BASE-DATA-001, BASE-DATA-003, BASE-ROLE-001, BASE-SIGNIN-001, BASE-SIGNIN-002 · *Register:* R-4

**Requirement.** Beyond ACCESS-005's Google Workspace and Microsoft 365 sign-in for every firm, optional Microsoft Entra ID SAML/OIDC SSO and SCIM map firm groups to roles/client teams, enforce the configured MFA policy and revoke active sessions on deprovisioning. Retain controlled owner recovery and standalone native access when SSO is not required; a failed provider connection never silently bypasses policy. [Capability rules](docs/contract/access-003.md) define its record and recovery details.

**Acceptance.**
1. Connect an authorized Entra tenant, map groups, sign in, change membership and deprovision a user.
2. Verify current-session/API denial and owner recovery, and refuse another tenant or missing required MFA assertion.
3. The grant rechecks its consenting principal’s live owner authority.
4. No person is created automatically and the principal is never managed by provisioning.
5. No mapped group means no staff access; conflicting role mappings choose preparer.
6. Existing direct client grants remain separate.
7. Every lifecycle change revokes managed sessions, credential versions and agent keys.
8. Native principal deactivation stays denied until the principal explicitly reactivates the member.

#### ACCESS-008 — Enterprise outage refusal and native recovery

*Tier:* Core · *From:* ACCESS-003 · *Cites:* BASE-ACCESS-001, BASE-ACCESS-002, BASE-ACCESS-004, BASE-AUDIT-001, BASE-DATA-001, BASE-DATA-003, BASE-ROLE-001, BASE-SIGNIN-001, BASE-SIGNIN-002

**Requirement.** Enterprise identity lifecycle includes capability journey on the same client, engagement and current source records. [Capability rules](docs/contract/access-003.md) define its record and recovery details.

**Acceptance.**
1. Required enterprise sign-in fails closed during outages and after disconnection; native owner recovery retains the existing second-factor policy.
2. A verified provider MFA assertion satisfies sign-in only, never sensitive-administration step-up.
3. Archives restore connections and identities inactive, omit provisioning credentials and session assurance, and retain reviewed mappings; explicit audited erasure removes associations and fences older restores.

#### ACCESS-004 — Enforced staff multi factor authentication

*Tier:* Core · *Cites:* BASE-ACCESS-001, BASE-ACCESS-002, BASE-ACCESS-004, BASE-ROLE-001, BASE-SIGNIN-001, BASE-SIGNIN-002

**Requirement.** Under the held company policy, the owner can set a firm policy requiring a second factor for every staff sign-in, whatever the method. When the provider does not assert MFA, Blotter requires its own factor. The policy covers web, mobile and person-created API sessions. Integration and agent keys are separately scoped credentials (API-002, AGENT-001) and cannot be used to bypass it. A staff member must enroll before seeing any client data. Recovery uses one-time recovery codes, or an owner reset that is audited and revokes all of that person's sessions. The owner's own factor is recovered with recovery codes or by a second owner. Session lifetime and idle timeout are configurable. An enrollment report gives evidence for the firm's WISP and the FTC Safeguards Rule (16 CFR 314.4(c)(5)); it records enrollment facts and never claims certification. Every session, whenever it began, must pass its own second-factor check before any practice data, and a person who has enrolled a factor is asked for it at every new session even while the policy is off. Until a second owner role exists, the principal recovers their own factor with a recovery code. Until ACCESS-005 or ACCESS-003 passes a provider's MFA assertion to Blotter, every federated session is treated as lacking one and is challenged for a Blotter factor. Today's sessions are browser sign-in sessions, whatever the method, and all pass the same check; MOBILE-001 apps and API-002 person-created sessions inherit it before they ship. Session lifetime (from sign-in) and idle timeout (since the session's last request) are whole minutes set by the principal; reaching either ends the session. [Capability rules](docs/contract/access-004.md) define its record and recovery details.

**Acceptance.**
1. Enable the firm MFA policy.
2. A preparer without a factor must enroll before seeing any client.
3. Sign in with TOTP and with a passkey.
4. A sign-in with the correct first factor and no second factor is refused, and a session created before the policy must step up before further access.
5. When the preparer loses their factor, the owner resets it; the preparer's sessions are revoked and the audit shows who reset it.
6. A federated sign-in whose token lacks an MFA assertion is challenged for a Blotter factor.
7. Export the enrollment report.

#### ACCESS-005 — Google Workspace and Microsoft 365 staff sign in

*Tier:* Core · *Cites:* BASE-ACCESS-001, BASE-ACCESS-002, BASE-ACCESS-004, BASE-AUDIT-001, BASE-DATA-001, BASE-DATA-003, BASE-ROLE-001, BASE-SIGNIN-001, BASE-SIGNIN-002

**Requirement.** Staff sign in with their firm Google Workspace or Microsoft 365 (Entra ID) account through OpenID Connect, so the firm's existing password, MFA and conditional-access policies apply to Blotter. The owner restricts sign-in to verified firm domains or tenant IDs, and each account maps to an invited Blotter member. Unknown accounts are refused and never created automatically. Blotter revalidates each federated identity at least hourly and on every API token refresh. A suspended or deleted account loses its Blotter session and API access at the next revalidation, or immediately when the provider sends a revocation signal (Google RISC, Microsoft continuous access evaluation). Native sign-in stays available for owner recovery, and the owner can disable it for staff. Signing in never grants mailbox access; that is a separate MAIL-001 grant.

**Acceptance.**
1. Sign in one preparer through Google Workspace and another through Microsoft 365.
2. A personal gmail.com account and an account from another tenant are refused.
3. Suspend the Google account in Google Admin and confirm the Blotter browser session and that member's API token are refused within the revalidation interval, or immediately when the provider signal arrives.
4. Disable the Microsoft user and confirm the same.
5. The owner can still recover through native sign-in.

#### ACCESS-006 — Staff offboarding and ownership transfer

*Tier:* Core · *From:* ACCESS-006 · *Cites:* BASE-ACCESS-001, BASE-ACCESS-002, BASE-ACCESS-004, BASE-ROLE-001, BASE-SIGNIN-001, BASE-SIGNIN-002

**Requirement.** Before deactivating a departing or long-absent staff member, the owner previews everything that person owns. That covers client ownership and team roles, open work and tasks, job roles, triaged email and their connected mailbox, scheduled reminders and automations, pending signature and document requests sent in their name, running timers and unapproved time. The owner transfers it to named successors in one reviewed batch. Messages already sent keep their original author. Future scheduled sends change sender only on approval. Deactivation revokes the person's sessions, API tokens and mailbox grants, and history keeps their attribution. [Capability rules](docs/contract/access-006.md) define its record and recovery details.

**Acceptance.**
1. Give a preparer clients, open work, a scheduled reminder sequence, a pending signature request and a connected mailbox.
2. Preview the transfer, reassign everything to two successors and deactivate the preparer.
3. No orphaned item remains.
4. The next reminder goes from the successor, past messages show the original author, and the deactivated member's sessions and tokens are refused.
5. Under the held company policy, the preview lists, for one member, active or already deactivated: open jobs where they are preparer, reviewer or manager (a client's ownership is its jobs and recurring rules until CRM-001 adds a client owner, which inherits this transfer before it ships); their open named tasks; recurring rules naming them; open tax notices assigned to them; open discussions they own; open client questions and client to-dos they own (PORTAL-003); agent proposals waiting for their decision; templates naming them as a task owner; their running timer; their time not yet approved; their live agent keys and sessions.
6. The principal names a work successor (preparation, tasks, notices, discussions, client questions and to-dos, template tasks) and a review successor (review and manager roles, proposals; the work successor unless named).

#### ACCESS-009 — Atomic staff successor transfer

*Tier:* Core · *From:* ACCESS-006 · *Cites:* BASE-ACCESS-001, BASE-ACCESS-002, BASE-ACCESS-004, BASE-ROLE-001, BASE-SIGNIN-001, BASE-SIGNIN-002

**Requirement.** Staff offboarding and ownership transfer includes capability journey on the same client, engagement and current source records. [Capability rules](docs/contract/access-006.md) define its record and recovery details.

**Acceptance.**
1. One batch, matching the preview exactly and refused while any job or rule would make someone review their own work, moves all of it, discards the running timer (nothing recorded; its start is kept in the audit), submits their unsubmitted time for approval on their behalf (returned entries never bill; the principal deletes them before closing their period), and deactivates them.
2. Document requests move with their jobs; sent messages, reminders, decisions and recorded time keep their authors.
3. AUTOMATE-001 versions remain principal-owned: the preview lists versions referencing the departing person and the batch checks those unchanged versions.
4. It never silently transfers standing approval; live checks refuse an inactive assignee until a new version is reviewed.
5. Deactivation, whether by offboarding or directly, revokes every session and agent key at once; reactivation needs a new sign-in and new keys, and a member deactivated urgently is offboarded the same way afterwards.
6. Connected mailboxes, mail triage and mailbox grants (MAIL-001, MAIL-003), scheduled reminder sends (FOLLOWUP-001) and signature requests (SIGN-001, SIGN-002) join the offboarding preview and successor batch; a scheduled send changes sender only through that batch.

### SECURE capabilities

#### SECURE-001 — Security program and attestation

*Tier:* Core · *Cites:* BASE-AUDIT-001, BASE-DATA-001, BASE-DATA-003, BASE-ROLE-001, BASE-SECRET-001 · *Register:* R-3

**Requirement.** Blotter publishes a security overview. Under NDA it provides firm owners with a current SOC 2 Type II report and bridge letter, a penetration-test summary, its subprocessor list, a data-flow description and a completed standard questionnaire (SIG Lite or CAIQ). It also provides a WISP template that maps Blotter's controls to IRS Publications 4557 and 5708. Owners can export access logs. [Capability rules](docs/contract/secure-001.md) define its record and recovery details.

**Acceptance.**
1. As the owner, request and download the attestation package from settings, and check that the report period is current and the subprocessor list matches the enabled integrations.
2. Export an access log for a date range.
3. A preparer cannot download the package.

### VAULT capabilities

#### VAULT-001 — Client credential vault

*Tier:* Core · *Cites:* BASE-AUDIT-001, BASE-DATA-001, BASE-DATA-003, BASE-ROLE-001, BASE-SECRET-001, BASE-SIGNIN-002

**Requirement.** Under the held company policy, clients and staff store client-provided logins, such as bank, payroll, state tax and sales-tax portal credentials, encrypted under per-firm keys. Each credential is visible only to staff permitted on that client. Every reveal requires the staff member's MFA step-up (ACCESS-004) and is logged. Clients add and update credentials through the portal. Credentials never appear in AI context, emails, search or plain exports; archives either encrypt or exclude them, at the owner's choice. Rotation reminders are optional. Staff permitted on a client are the principal, reviewers and a preparer holding a job on that client (ACCESS-001 job scope; ACCESS-002 inherits configurable client grants before it ships); others get not found, and lists show names, portal addresses, authors, times and rotation dates only; usernames, passwords and notes stay sealed. Every reveal and every refused reveal by permitted staff is logged with person, credential, time and outcome, and shows in the client's history. Clients add and replace credentials through their contact-scoped link (CRM-001 authority) and never read one back. Rotation dates show as due on the staff list; no reminder is sent. Archives carry the ciphertext (default), readable only where the same VAULT_KEY is configured, or leave it out; either way a restored credential that cannot be opened says so. The principal erases a credential by typing its name with a reason: the ciphertext goes, its name, authors, times and log stay, and older archives are fenced. A merged client's credentials follow its survivor. ERASURE-002 inherits client-wide credential erasure and holds, and MOBILE-001 inherits the native reveal, before they ship. [Capability rules](docs/contract/vault-001.md) define its record and recovery details.

**Acceptance.**
1. A client adds a state sales-tax portal login through the portal.
2. An assigned preparer reveals it after step-up, and the reveal is logged.
3. An unassigned preparer cannot reveal it.
4. The credential is absent from search, AI summaries and plain exports.
5. Revoke the preparer's access and confirm their next reveal is refused.

### AGENT capabilities

#### AGENT-001 — Agent preparations and company policy

*Tier:* Core · *Cites:* BASE-AGENT-005, BASE-AGENT-007, BASE-AGENT-008, BASE-AGENT-012

**Requirement.** Calls for this workflow carry standard, external and money as their facts require; the company’s policy decides their disposition. Under the held company policy, a separately keyed agent reads role-scoped context and prepares roll-forward, reminder or billing-export proposals for its named human. The company’s policy decides whether each step runs or is held; a person’s decision is recorded only from that person’s session. Accepted effects and decisions retain attribution/result identity; repeated decisions are refused and revoked keys cease working. Agent narrative cannot change a call’s class or stand in for a person’s recorded decision.

**Acceptance.**
1. Under the held company policy, create a key, prepare all three proposal kinds, attempt approval with the key, approve as its human and decline another with a reason.
2. Inspect decision/result history, refusal of a second decision and immediate key revocation.

### ARCHIVE capabilities

#### ARCHIVE-001 — Whole practice portability and restore

*Tier:* Core · *Cites:* BASE-BACKUP-001, BASE-DATA-001

**Requirement.** Under the held company policy, the principal downloads an integrity-checked native archive containing product records, original small files, import provenance, review history and immutable approved CSVs, then restores into an empty installation. Identity/sessions, outboxes, agent keys, upload-link authority and private configuration stay installation-local and excluded. Damaged archives and nonempty destinations are refused; imported history does not reauthorize external actions. Base portability is the data transport, with Blotter's explicit exclusions.

**Acceptance.**
1. Export via the owner HTTP door, reject a damaged archive and a nonempty restore, restore the intact archive into an empty installation and export again.
2. Compare all archived rows, kept file bytes and approved CSV bytes; inspect excluded local authority.

#### ARCHIVE-002 — Complete target data portability

*Tier:* Core · *From:* ARCHIVE-002 · *Cites:* BASE-AUDIT-001, BASE-BACKUP-001, BASE-DATA-001, BASE-DATA-003, BASE-ROLE-001

**Requirement.** Under the held company policy, extend owner archives and selective machine-readable exports to every new target record: messages, organizer/signature evidence, versions, deadlines, ledger snapshots, capacity, invoices/payments, automation/agent history and source-labeled migrations. Publish limits and resumable export/restore progress for a working firm; restore historical external references inactive, reauthorize connectors and preview scheduled follow-up before activation. [Capability rules](docs/contract/archive-002.md) define its record and recovery details.

**Acceptance.**
1. Export a multi-year firm with connected history, interrupt/resume the operation and restore to an empty destination.
2. Reconcile record/file counts, relationships, permissions and financial totals, then activate only reviewed connections/rules without replaying past messages or payments.
3. Owner-only durable export/restore doors confirm one part per request (at most 16 MiB of part JSON, with a 24,000,000-character request bound); progress survives page/process interruption and identical part replay, while changed parts fail verification.
4. The legacy single-request restore retains its 64,000,000-character bound; the part door has no whole-file string limit.
5. An archive holds a consistent source snapshot and selected included tables can also be downloaded as NDJSON for analysis, labelled non-restorable.
6. Restored recurring rules start paused with a fresh review requirement; their exact held periods and catch-up plan must be previewed and approved before resuming.
7. Original source rules remain unchanged.
8. Previously unsent staff alerts are retained as held history and never replayed; confirmed historic messages keep their outcomes.

#### ARCHIVE-003 — Inactive restore and retained consent history

*Tier:* Core · *From:* ARCHIVE-002 · *Cites:* BASE-AUDIT-001, BASE-BACKUP-001, BASE-DATA-001, BASE-DATA-003, BASE-ROLE-001

**Requirement.** Complete target data portability includes capability journey on the same client, engagement and current source records. [Capability rules](docs/contract/archive-002.md) define its record and recovery details.

**Acceptance.**
1. Restored external references remain history, with configuration and provider credentials re-entered separately.
2. Erasure invalidates staged transfer copies and a newer erasure journal refuses a stale restore.
3. Full completion for shipped kinds is asserted by the named ARCHIVE-002/BASE-001 public-door journeys.
4. Under the held company policy, each future capability adds its records, permission/financial reconciliation, exclusions, safe inactive restoration and reviewed reauthorization before shipping: MAIL-001–003, PORTAL-002/004, SIGN-001/002, ENGAGE-001, DUE-001/003, LEDGER-001–003, BILL-002–005, PAY-001/002, INTEGRATE-001–008, AUTOMATE-001, API-002, MIGRATE-001–007, VAULT-001, ERASURE-002, AI-001–003 and READY-001/RESCUE-001/LEARN-001/REVENUE-001/ONBOARD-001/SWITCH-001/NOTICE-001.
5. Those clauses retain their destinations and statuses; their unbuilt kinds do not make current-native portability incomplete.

### ERASURE capabilities

#### ERASURE-001 — File erasure and stale archive fencing

*Tier:* Core · *Cites:* BASE-DATA-003, BASE-DATA-006

**Requirement.** An owner confirms a file name and reason to erase its bytes, invalidate in-progress transfers and retain a minimal erasure/history record. New archives omit the bytes; an older archive is refused when the later erasure journal establishes its invalidity. The journal must travel with a stale copy for cross-installation fencing; offline copies cannot be recalled remotely. [Capability rules](docs/contract/erasure-001.md) define its record and recovery details.

**Acceptance.**
1. Export, erase a file through the owner door, refuse later downloads and inspect a new archive without the bytes.
2. Restore the old archive with the later journal and require refusal; restore the latest archive and retain kept files and erasure history.

#### ERASURE-002 — Retention legal hold and target erasure

*Tier:* Core · *Cites:* BASE-AUDIT-001, BASE-DATA-001, BASE-DATA-003, BASE-DATA-006, BASE-ROLE-001

**Requirement.** Under the held company policy, firm policies govern client/engagement retention, legal holds, deletion requests, connector copies, messages, derived AI data and archives. Preview affected records and exceptions, require owner approval, record counts and propagate erasure/tombstones to applicable stores without silently deleting retained signed/billing evidence. Export the latest erasure journal and explain held, provider-retained or buyer-controlled copies and their owners. [Capability rules](docs/contract/erasure-002.md) define its record and recovery details.

**Acceptance.**
1. Request client erasure with a held signed engagement and an external document copy.
2. Preview scope, approve eligible deletion, inspect counts and named retained exceptions, verify derived data is removed and test stale restore with the newer journal.
3. Apply this clause’s held/signed-record rules, retain named exceptions and attribution/markers, preserve job sign-off, and fence stale restoration before shipping.

### AUDIT capabilities

#### AUDIT-001 — Durable action attribution

*Tier:* Core · *Cites:* BASE-AUDIT-001, BASE-OPS-005

**Requirement.** Product mutations retain actor, action, object and timestamp, including reviewer notes, human proposal decisions, billing approvals and erasure reasons. The principal can inspect the action history; archive round trips preserve it. Portal actions are labeled as upload-link actions rather than falsely attributed to a verified named client. [Capability rules](docs/contract/audit-001.md) define its record and recovery details.

**Acceptance.**
1. Create and review work, approve a proposal/export and erase a file through public doors.
2. Read the owner action history, compare attribution with the actors and inspect retained audit rows after an archive round trip.

### BASE capabilities

#### BASE-001 — Maintained Base foundations and product replacements

*Tier:* Core · *Cites:* BASE-DATA-005, BASE-INSTALL-001, BASE-OPS-002

**Requirement.** Under the held company policy, retain Base native operator authentication, mail transport, import-kit preview/journal/undo and portability/erasure integrity. Blotter owns practice roles, guarded writes, request-upload links, independent review, snapshotted time, approved billing exports and human-agent decisions as explicit product extensions. Completion is judged against shipped capabilities. Native sign-in and MFA, staff/contact authority, mail-backed upload links, legacy and mapped imports, document sharing, intake files, human decisions and native archives retain these foundations. every new identity, provider grant, storage path or scheduled/event action preserves current authority, revocation, attribution, erasure and portability guarantees. Replacing a foundation carries the same gate. Future carriers are ENGAGE-001, SIGN-001, SIGN-002, AUTHZ-001, DUE-001, DUE-003, RESOLVE-001, MAIL-001, MAIL-002, MAIL-003, MSG-002, SMS-001, NOTIFY-001, PORTAL-002, PORTAL-004, PORTAL-005, MOBILE-001, DOC-001, FOLLOWUP-001, LEDGER-001, LEDGER-002, LEDGER-003, BILL-002, PAY-001, PAY-002, BILL-003, BILL-004, BILL-005, REPORT-001, INTEGRATE-001, INTEGRATE-002, INTEGRATE-003, INTEGRATE-004, INTEGRATE-005, INTEGRATE-006, INTEGRATE-007, INTEGRATE-008, API-002, AUTOMATE-001, MIGRATE-001, MIGRATE-002, MIGRATE-003, MIGRATE-004, MIGRATE-005, MIGRATE-006, MIGRATE-007, ACCESS-002, ACCESS-003, ACCESS-005, SECURE-001, VAULT-001, ARCHIVE-002, ERASURE-002, COST-001, AI-001, AI-002, AI-003, READY-001, RESCUE-001, LEARN-001, REVENUE-001, ONBOARD-001, SWITCH-001, NOTICE-001. [Capability rules](docs/contract/base-001.md) define its record and recovery details.

**Acceptance.**
1. Use native sign-in, import a client list, collect a file, review work, approve a billing export and archive/erase/restore through public doors.
2. Inspect staff/key and contact/share revocation, attributed decisions, retained file/import bytes and approved CSVs, denied stale restores and excluded document-share tokens.
3. Future carriers repeat the inherited activation gate on their own paths before shipping; their unbuilt capabilities remain open under their own clauses.

### COST capabilities

#### COST-001 — Predictable USD service and usage costs

*Tier:* Core · *Cites:* BASE-AUDIT-001, BASE-DATA-001, BASE-DATA-003, BASE-ROLE-001

**Requirement.** Under the held company policy, show USD subscription, seats, storage, AI usage, signature/KBA, payment and SMS costs with included quantities and provider charges before enabling paid functions. Firm budgets and approval thresholds limit optional activity; hitting a limit creates an owned exception and never hides a deadline, loses evidence or silently drops a chase. Usage history reconciles to actions and offers an explicit upgrade/export path.

**Acceptance.**
1. Estimate a tax-season workspace with signatures, scanning/AI, messages and ACH/card payments, enable it and reconcile metered usage with displayed USD costs.
2. Hit an optional-action budget, inspect the blocked action/owner notice and approve an increase without duplicate effects.

### AI capabilities

#### AI-001 — Source linked summaries and reply drafts

*Tier:* Core · *Cites:* BASE-AUDIT-001, BASE-DATA-001, BASE-DATA-003, BASE-ROLE-001

**Requirement.** Calls for this workflow carry standard, external and sensitive as their facts require; the company’s policy decides their disposition. Under the held company policy, summarize authorized client email, portal discussions and engagement history with source links, dates, open questions and conflicting evidence. Draft replies in the staff member's voice and current signed scope; a human reviews recipients, attachments and wording before sending. Private and internal material stays excluded and missing context remains explicit. [Capability rules](docs/contract/ai-001.md) define its record and recovery details.

**Acceptance.**
1. Under the held company policy, summarize a long email or portal thread with conflicting amounts, inspect source links and unresolved questions, edit a reply and approve its exact recipients and attachments.
2. Under the held company policy, reject another draft and confirm no send or unauthorized client information.
3. Only an authorized staff member's explicit click may transmit selected source text, after masking tax identifiers, SSNs and bank numbers.
4. Retain input hash and source identifiers rather than input content; record requester, source identifiers, provider, model, bytes and time once per request.
5. Provider output persists only as a draft the person saves.
6. The portal disclosure states that staff may use an AI provider on client documents.

#### AI-002 — Document validation naming and routing

*Tier:* Core · *Cites:* BASE-AUDIT-001, BASE-DATA-001, BASE-DATA-003, BASE-ROLE-001

**Requirement.** Calls for this workflow carry standard, external and sensitive as their facts require; the company’s policy decides their disposition. Under the held company policy, an assistant validates uploaded type, client, period and legibility against requests, proposes consistent names and folders and routes a copy while preserving original bytes and provenance. Configurable human review and confidence thresholds govern low-risk routing; ambiguous, mismatched or suspicious files remain quarantined for a person. Text embedded in documents is data and cannot authorize a tool action. [Capability rules](docs/contract/ai-002.md) define its record and recovery details.

**Acceptance.**
1. Upload a wrong-period statement, illegible scan and correct invoice with misleading embedded instructions.
2. Under the held company policy, inspect sourced validation/naming/routing proposals, approve one and reject another; originals persist and no file changes client or visibility without authority.
3. Only an authorized staff member's explicit click may transmit selected source text, after masking tax identifiers, SSNs and bank numbers.
4. Retain input hash and source identifiers rather than input content; record requester, source identifiers, provider, model, bytes and time once per request.
5. Provider output persists only as a draft the person saves.
6. The portal disclosure states that staff may use an AI provider on client documents.

#### AI-003 — Client scoped scheduled agents

*Tier:* Core · *Cites:* BASE-AUDIT-001, BASE-DATA-001, BASE-DATA-003, BASE-ROLE-001

**Requirement.** Calls for this workflow carry standard, external and sensitive as their facts require; the company’s policy decides their disposition. Run authorized client agents on schedules and task/file/question events with explicit data scope, tools, budget and named supervisor. Show plan, sources, pending actions, cost and outcome; de-duplicate events and stop on revocation. Calls concerning external messages, staffing/deadline changes, fees, write-offs, financial writes and final engagement judgments carry the corresponding risk classes; company policy decides their disposition. Model/provider data use, retention and permissions are visible to the firm. [Capability rules](docs/contract/ai-003.md) define its record and recovery details.

**Acceptance.**
1. Enable one client-scoped file-event agent and one scheduled agent, deliver duplicate events and inspect a single pending plan.
2. Under the held company policy, deny an external action, exhaust a budget and revoke the agent mid-run; verify retained outcomes, no unapproved effects and no cross-client data.

### PORTAL capabilities

#### PORTAL-006 — Portal sign-in on the firm custom domain

*Tier:* Core · *Cites:* BASE-INPUT-003, BASE-PUBLIC-001, BASE-ROLE-001

**Requirement.** Live sign-in on the firm's own custom domain uses host-bound cookies and a certificate. This account-blocked split from PORTAL-002 does not block installation-host authentication.

**Acceptance.**
1. Live sign-in on a deployed firm custom domain.

### NOTICE capabilities

#### NOTICE-002 — Notice response drafting through the mail and e-file path

*Tier:* Core

**Requirement.** Calls for this workflow carry standard, external, sensitive and commitment as their facts require; the company’s policy decides their disposition. Notice response drafting through the mail and e-file path remains separate from uploaded-notice reading.

**Acceptance.**
1. Notice response drafting through the mail and e-file path remains separate from uploaded-notice reading.

### Agent surface

**Specialist: practice coordinator.** It carries client engagements from signed scope through recurring work, source-linked collection, review, invoicing and owned exceptions.

Inherits BASE-AGENT-001 to BASE-AGENT-013. The company’s policy decides every call; this surface presets no dispositions.

**How Blotter computes each class.**

- **standard:** Editing a reversible internal checklist, draft, task or client note; facts name the items.

- **external:** Sending a client request, sharing a document or exposing work outside the firm; facts name recipients and whether each counterparty is known, new or public.

- **money:** Charging, refunding, applying a credit, changing a fee or writing off a balance; facts name the invoice, amount, currency and counterparty.

- **commitment:** Signing scope, recording a relied-on review or releasing a signed deliverable; facts name the exact revision, value and counterparty.

- **accounts:** Creating a sending, signature, payment or connector account at a provider; facts name that provider.

- **gated:** A provider requiring its own hosted consent, payment entry, identity verification or acceptance in a person’s name; facts name the provider and step.

- **access:** Changing firm membership, client grants, portal contacts, devices or integration/agent authority; facts name the affected people and whether authority widens or narrows.

- **security:** Changing MFA, vault, sign-in, backup or protective settings or handling a credential; facts name the setting.

- **destructive:** Irreversible erasure, purge, financial void or removal without product Undo; facts name the items.

- **sensitive:** Reading taxpayer identifiers, authorization details, bank data or credentials; facts name the records and data kind.

- **live:** Changing an enabled recurring schedule, reminder, automation, webhook or running connector; facts name the service and affected running work.

| Tool | Does | Core clauses | Risk class | Today |
| --- | --- | --- | --- | --- |
| `blotter.work.002.manage` | Automatic recurring work and roll forward | WORK-002, WORK-010 | standard or live | Not yet conformant |
| `blotter.portal.001.manage` | Private document requests and uploads | PORTAL-001 | standard or external | Not yet conformant |
| `blotter.review.001.manage` | Independent reviewer sign off | REVIEW-001 | standard or commitment | Not yet conformant |
| `blotter.us.001.manage` | US firm setup and currency | US-001 | standard | Not yet conformant |
| `blotter.crm.001.manage` | Client entities and contacts | CRM-001, CRM-006 | standard or access or sensitive | Not yet conformant |
| `blotter.crm.002.manage` | Client groups and custom fields | CRM-002 | standard or access or sensitive | Not yet conformant |
| `blotter.crm.003.manage` | Engagement history and accountable ownership | CRM-003, CRM-007 | standard or access or sensitive | Not yet conformant |
| `blotter.crm.004.manage` | Merge duplicate clients and contacts | CRM-004 | standard or access or sensitive | Not yet conformant |
| `blotter.crm.005.manage` | Prospects intake and onboarding pipeline | CRM-005, CRM-008 | standard or access or sensitive | Not yet conformant |
| `blotter.engage.001.manage` | Proposals engagement letters and signatures | ENGAGE-001 | standard or external or commitment | Not yet conformant |
| `blotter.sign.001.manage` | IRS e-file signature authorizations with KBA | SIGN-001 | standard or external or commitment or sensitive | Not yet conformant |
| `blotter.sign.002.manage` | General document signature requests | SIGN-002 | standard or external or commitment or sensitive | Not yet conformant |
| `blotter.authz.001.manage` | Taxpayer authorizations 2848 and 8821 | AUTHZ-001 | standard or commitment or sensitive | Not yet conformant |
| `blotter.work.001.manage` | Reusable engagement templates | WORK-001 | standard or live | Not yet conformant |
| `blotter.work.003.manage` | Dependencies and conditional workflow | WORK-003, WORK-011 | standard or live | Not yet conformant |
| `blotter.work.004.manage` | Bulk work scheduling and assignment | WORK-004 | standard or live | Not yet conformant |
| `blotter.work.005.manage` | Firm work queues | WORK-005 | standard or live | Not yet conformant |
| `blotter.work.006.manage` | Personal plans boards and calendars | WORK-006, WORK-012 | standard or live | Not yet conformant |
| `blotter.work.007.manage` | Firm work types and status model | WORK-007, WORK-013 | standard or live | Not yet conformant |
| `blotter.work.008.manage` | Starter US template library | WORK-008, WORK-014 | standard or live | Not yet conformant |
| `blotter.work.009.manage` | Task assignees due dates and instructions | WORK-009 | standard or live | Not yet conformant |
| `blotter.due.001.manage` | Sourced US obligations and extensions | DUE-001, DUE-004, DUE-005 | standard | Not yet conformant |
| `blotter.due.002.manage` | Tax notices and resolution work | DUE-002 | standard | Not yet conformant |
| `blotter.due.003.manage` | Wider US obligation catalog and firm defined deadlines | DUE-003 | standard | Not yet conformant |
| `blotter.resolve.001.manage` | Transcript analysis and resolution cases | RESOLVE-001 | standard or sensitive | Not yet conformant |
| `blotter.mail.001.manage` | Gmail and Microsoft 365 shared inbox | MAIL-001 | standard or external | Not yet conformant |
| `blotter.mail.002.manage` | Mailbox privacy and sharing | MAIL-002 | standard or external | Not yet conformant |
| `blotter.mail.003.manage` | Triage controls snooze and scheduled send | MAIL-003 | standard or external | Not yet conformant |
| `blotter.msg.001.manage` | Firm and personal message templates | MSG-001 | standard or external | Not yet conformant |
| `blotter.msg.002.manage` | Bulk client messages | MSG-002 | standard or external | Not yet conformant |
| `blotter.sms.001.manage` | Two way client text messaging | SMS-001 | standard or external | Not yet conformant |
| `blotter.collab.001.manage` | Contextual discussions and review alerts | COLLAB-001 | standard | Not yet conformant |
| `blotter.notify.001.manage` | Staff notifications digest and settings | NOTIFY-001, NOTIFY-002, NOTIFY-003 | standard or live | Not yet conformant |
| `blotter.portal.002.manage` | Authenticated branded client portal | PORTAL-002, PORTAL-007, PORTAL-008, PORTAL-009 | standard or external | Not yet conformant |
| `blotter.portal.003.manage` | Client progress secure chat and to dos | PORTAL-003, PORTAL-010 | standard or external | Not yet conformant |
| `blotter.portal.004.manage` | Conditional organizers | PORTAL-004, PORTAL-011, PORTAL-012 | standard or external | Not yet conformant |
| `blotter.portal.005.manage` | Client language and accessibility | PORTAL-005 | standard or external | Not yet conformant |
| `blotter.doc.001.manage` | Client files versions and annotations | DOC-001, DOC-004, DOC-005 | standard or external or commitment | Not yet conformant |
| `blotter.doc.002.manage` | Document sharing and internal only custody | DOC-002, DOC-006 | standard or external or commitment | Not yet conformant |
| `blotter.doc.003.manage` | Client approval of deliverables | DOC-003 | standard or external or commitment | Not yet conformant |
| `blotter.search.001.manage` | Firm wide search | SEARCH-001, SEARCH-002 | standard | Not yet conformant |
| `blotter.followup.001.manage` | Automatic document chasing and escalation | FOLLOWUP-001 | standard or external or live | Not yet conformant |
| `blotter.ledger.001.manage` | QuickBooks and Xero client ledger context | LEDGER-001 | standard or sensitive | Not yet conformant |
| `blotter.ledger.002.manage` | Transaction questions and close evidence | LEDGER-002 | standard or sensitive | Not yet conformant |
| `blotter.ledger.003.manage` | Cross client books health dashboard | LEDGER-003 | standard or sensitive | Not yet conformant |
| `blotter.capacity.001.manage` | Workload capacity and coverage | CAPACITY-001, CAPACITY-004 | standard | Not yet conformant |
| `blotter.capacity.002.manage` | Reassignment and dependency aware scheduling | CAPACITY-002, CAPACITY-005 | standard | Not yet conformant |
| `blotter.capacity.003.manage` | Capacity forecasts and hiring plans | CAPACITY-003, CAPACITY-006, CAPACITY-007 | standard | Not yet conformant |
| `blotter.time.001.manage` | Time budgets and activity suggestions | TIME-001 | standard or money | Not yet conformant |
| `blotter.time.002.manage` | Timesheet approval and period locks | TIME-002 | standard or money | Not yet conformant |
| `blotter.time.003.manage` | Billing rates and rate cards | TIME-003 | standard or money | Not yet conformant |
| `blotter.time.004.manage` | Expenses and disbursements | TIME-004 | standard or money | Not yet conformant |
| `blotter.bill.001.manage` | Reviewed immutable billing exports | BILL-001 | standard or money or destructive | Not yet conformant |
| `blotter.bill.002.manage` | Invoices retainers and recurring fees | BILL-002, BILL-006, BILL-007 | standard or money or destructive | Not yet conformant |
| `blotter.pay.001.manage` | Card ACH and authorized collections | PAY-001 | standard or money or destructive | Not yet conformant |
| `blotter.pay.002.manage` | Payment plans and client payment self service | PAY-002 | standard or money or destructive | Not yet conformant |
| `blotter.bill.003.manage` | WIP receivables realization and profitability | BILL-003 | standard or money or destructive | Not yet conformant |
| `blotter.bill.004.manage` | Invoice reminders statements and bulk resend | BILL-004 | standard or money or destructive | Not yet conformant |
| `blotter.bill.005.manage` | Payment gated delivery and credit hold | BILL-005, BILL-008 | standard or money or destructive | Not yet conformant |
| `blotter.report.001.manage` | Firm performance and client reporting | REPORT-001, REPORT-002, REPORT-003 | standard | Not yet conformant |
| `blotter.integrate.001.manage` | Firm accounting invoice and payment exchange | INTEGRATE-001 | standard or external or accounts or gated or live | Not yet conformant |
| `blotter.integrate.002.manage` | US tax software document and status handoff | INTEGRATE-002 | standard or external or accounts or gated or live | Not yet conformant |
| `blotter.integrate.003.manage` | Connected document storage | INTEGRATE-003 | standard or external or accounts or gated or live | Not yet conformant |
| `blotter.integrate.004.manage` | Ignition engagement onboarding | INTEGRATE-004 | standard or external or accounts or gated or live | Not yet conformant |
| `blotter.integrate.005.manage` | Calendars and client appointment booking | INTEGRATE-005 | standard or external or accounts or gated or live | Not yet conformant |
| `blotter.integrate.006.manage` | Authorized IRS transcripts | INTEGRATE-006 | standard or external or accounts or gated or live | Not yet conformant |
| `blotter.integrate.007.manage` | Gusto payroll engagement context | INTEGRATE-007 | standard or external or accounts or gated or live | Not yet conformant |
| `blotter.integrate.008.manage` | Return filing status source per tax stack | INTEGRATE-008 | standard or external or accounts or gated or live | Not yet conformant |
| `blotter.api.001.manage` | Authenticated product HTTP doors | API-001 | standard or access or live | Not yet conformant |
| `blotter.api.002.manage` | Documented API webhooks and Zapier | API-002, API-003 | standard or access or live | Not yet conformant |
| `blotter.automate.001.manage` | Durable firm automation | AUTOMATE-001 | standard or live | Not yet conformant |
| `blotter.access.001.manage` | Native roles and server authority | ACCESS-001 | standard or access or security | Not yet conformant |
| `blotter.access.002.manage` | Client permissions and sensitive data policies | ACCESS-002, ACCESS-007 | standard or access or security | Not yet conformant |
| `blotter.access.003.manage` | Enterprise identity lifecycle | ACCESS-003, ACCESS-008 | standard or access or security | Not yet conformant |
| `blotter.access.004.manage` | Enforced staff multi factor authentication | ACCESS-004 | standard or access or security | Not yet conformant |
| `blotter.access.005.manage` | Google Workspace and Microsoft 365 staff sign in | ACCESS-005 | standard or access or security | Not yet conformant |
| `blotter.access.006.manage` | Staff offboarding and ownership transfer | ACCESS-006, ACCESS-009 | standard or access or security | Not yet conformant |
| `blotter.secure.001.manage` | Security program and attestation | SECURE-001 | standard or security | Not yet conformant |
| `blotter.vault.001.manage` | Client credential vault | VAULT-001 | standard or security or sensitive | Not yet conformant |
| `blotter.agent.001.manage` | Agent preparations and company policy | AGENT-001 | standard or access | Not yet conformant |
| `blotter.archive.001.manage` | Whole practice portability and restore | ARCHIVE-001 | standard or security or destructive | Not yet conformant |
| `blotter.archive.002.manage` | Complete target data portability | ARCHIVE-002, ARCHIVE-003 | standard or security or destructive | Not yet conformant |
| `blotter.erasure.001.manage` | File erasure and stale archive fencing | ERASURE-001 | standard or destructive | Not yet conformant |
| `blotter.erasure.002.manage` | Retention legal hold and target erasure | ERASURE-002 | standard or destructive | Not yet conformant |
| `blotter.audit.001.manage` | Durable action attribution | AUDIT-001 | standard | Not yet conformant |
| `blotter.cost.001.manage` | Predictable USD service and usage costs | COST-001 | standard | Not yet conformant |
| `blotter.ai.001.manage` | Source linked summaries and reply drafts | AI-001 | standard or sensitive or live | Not yet conformant |
| `blotter.ai.002.manage` | Document validation naming and routing | AI-002 | standard or sensitive or live | Not yet conformant |
| `blotter.ai.003.manage` | Client scoped scheduled agents | AI-003 | standard or sensitive or live | Not yet conformant |
| `blotter.notice.002.manage` | Notice response drafting through the mail and e-file path | NOTICE-002 | standard or sensitive | Not yet conformant |
| `blotter.ready.001.manage` | Maintain engagement evidence and readiness | READY-001, READY-002 | standard or commitment or sensitive | Not yet conformant |
| `blotter.rescue.001.manage` | Coordinate a deadline rescue | RESCUE-001 | standard | Not yet conformant |
| `blotter.learn.001.manage` | Improve recurring work from review findings | LEARN-001 | standard | Not yet conformant |
| `blotter.revenue.001.manage` | Close billing leakage and reconciliation exceptions | REVENUE-001 | standard or money | Not yet conformant |
| `blotter.onboard.001.manage` | Run new client onboarding to readiness | ONBOARD-001, ONBOARD-002 | standard or external | Not yet conformant |
| `blotter.switch.001.manage` | Plan and reconcile the switch from an incumbent | SWITCH-001 | standard | Not yet conformant |
| `blotter.notice.001.manage` | Read notices and propose the response plan | NOTICE-001, NOTICE-003 | standard or sensitive | Not yet conformant |

**Resources.** `blotter://clients/{id}`, `blotter://engagements/{id}`, `blotter://documents/{id}`, `blotter://notices/{id}`, `blotter://authorizations/{id}`, `blotter://invoices/{id}`, `blotter://payments/{id}`, `blotter://imports/{id}` and `blotter://runs/{id}`.

**Events.** Client changes, task changes, document arrivals, question answers, review decisions, invoice changes, payment outcomes, deadline changes, import progress and class/policy decisions.

**Prompts.** Prepare an engagement week (WORK-002, READY-001); rescue a deadline (RESCUE-001); reconcile billing exceptions (REVENUE-001); onboard a client (ONBOARD-001); plan an incumbent switch (SWITCH-001).

**Not tools, and why.**

- MOBILE-001: device capture and native-client interaction; server-side requests and time remain represented by the portal and time tools.

- IMPORT-001, IMPORT-002: the reviewed import door; mapping previews are exposed by the switch specialist.

- MIGRATE-001: the reviewed import door; mapping previews are exposed by the switch specialist.

- MIGRATE-002: the reviewed import door; mapping previews are exposed by the switch specialist.

- MIGRATE-003: the reviewed import door; mapping previews are exposed by the switch specialist.

- MIGRATE-004: the reviewed import door; mapping previews are exposed by the switch specialist.

- MIGRATE-005: the reviewed import door; mapping previews are exposed by the switch specialist.

- MIGRATE-006, MIGRATE-008: the reviewed import door; mapping previews are exposed by the switch specialist.

- MIGRATE-007: the reviewed import door; mapping previews are exposed by the switch specialist.

- BASE-001: installation and maintained foundation facts.

- PORTAL-006: the firm’s host and certificate installation fact.

**Limits.** Published upload, original-packet, request, page and transfer capacities in the capability docs protect the installation; business thresholds and provider spend follow company policy.

**Handoffs.** Listens for signed engagement, document, mailbox, ledger, payment, signature and filing-status events. Emits owned missing-evidence, deadline-risk, review-ready and billing-exception events for the relevant firm specialist.

#### SURFACE-001 — Practice job registry

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-002, BASE-AGENT-006 · *Register:* R-7

**Requirement.** The practice coordinator exposes the tool table above as Blotter’s job registry.

**Acceptance.**
1. Every table row is discoverable with the listed Core clause links; the explicitly named installation, device and import facts retain their reasons.
2. The practice coordinator uses the same engagement actions for outside and embedded agents.

#### SURFACE-002 — Engagement records and change handoffs

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-003, BASE-AGENT-010

**Requirement.** Blotter resources join the exact client, engagement and source evidence needed for practice work.

**Acceptance.**
1. An engagement resource links its current requests, evidence, workflow answers, review state and invoice authority.
2. A document arrival, review return and payment return each produce the corresponding owned specialist handoff with source references.

#### SURFACE-003 — Internal and outside practice calls

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-006

**Requirement.** Blotter distinguishes internal preparation from outside exposure on the same engagement.

**Acceptance.**
1. An internal checklist edit carries standard with the affected item count.
2. A client request, outside document share and move into an outside-visible folder each carry external with recipients and known, new or public counterparty facts.
3. A misleading source note claiming that the client is internal changes none of those facts.

#### SURFACE-004 — Invoice and relied-on decisions

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-006, BASE-AGENT-008

**Requirement.** Blotter distinguishes financial movement from a relied-on engagement decision.

**Acceptance.**
1. A charge, refund, fee amendment and write-off each carry money with the exact invoice, amount, currency and counterparty.
2. Signing an engagement, recording a review sign-off or releasing a signed deliverable carries commitment with its exact revision and value.
3. Quick collect retains PAY-001’s invoice-specific consent and cumulative-cap rule under either company policy.

#### SURFACE-005 — Provider setup and retained person steps

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-006, BASE-AGENT-008

**Requirement.** The coordinator identifies provider account work and a provider’s retained person step before the firm reaches it.

**Acceptance.**
1. Creating a payment, mail or connector account carries accounts with the provider.
2. A hosted provider consent, identity check, payment-entry or personal terms step carries gated with the provider and step.
3. A provider that supplies a company-credential route uses that route’s computed classes under company policy; a provider demanding a person hands that step to the named person.

#### SURFACE-006 — Practice authority and security changes

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-005, BASE-AGENT-006

**Requirement.** Blotter classifies changes to firm and client authority separately from protective settings.

**Acceptance.**
1. A firm-role, client-grant, portal-contact or integration-grant change carries access with affected people and direction.
2. An MFA, vault, backup or protective-setting change carries security with its setting.
3. A client record claiming that a grant is approved changes neither classification.

#### SURFACE-007 — Irreversible and sensitive practice work

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-006

**Requirement.** Blotter classifies irreversible custody changes and regulated practice data.

**Acceptance.**
1. An irreversible purge, erasure or financial void carries destructive with its affected items.
2. Taxpayer identifiers, taxpayer-authority details, bank data and vault records carry sensitive with the record count and kind.
3. A reversible internal draft removal remains standard.

#### SURFACE-008 — Changes to running practice services

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-006

**Requirement.** Blotter identifies changes that affect work already running for the firm.

**Acceptance.**
1. Enabling or changing recurrence, reminders, automation, webhook delivery or a running connector carries live with the affected service.
2. The same change in a disabled draft carries its reversible internal class until it affects the running service.

#### SURFACE-009 — Source-linked readiness and rescue

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-002, BASE-AGENT-006, BASE-AGENT-007

**Requirement.** Practice plans retain the source links, evidence boundaries and owned exceptions of READY-001 and RESCUE-001.

**Acceptance.**
1. A missing statement, conflicting answer and deadline overload each remain individually linked to the affected engagement.
2. A proposed change to staffing, an outside question, an extension and a deadline override each carry the classes of the action actually requested; company policy decides each call.
3. No narrative marks an unfiled return filed or turns an unresolved practitioner judgment into evidence.

#### SURFACE-010 — Practice billing and onboarding handoffs

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-002, BASE-AGENT-007, BASE-AGENT-010

**Requirement.** The specialist preserves the single invoice authority and exact signed scope used by REVENUE-001 and ONBOARD-001.

**Acceptance.**
1. A leakage correction points to its signed scope, approved source and current financial record.
2. An onboarding invitation points to its exact selected scope item and current contact.
3. A returned ACH payment remains an owned exception rather than a settled receipt.

#### SURFACE-011 — Practice policy questions and capacity

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-007, BASE-AGENT-009, BASE-AGENT-011

**Requirement.** Blotter presents its class examples and provider capacities on the firm’s agent settings and usage surfaces.

**Acceptance.**
1. The firm sees all eleven class examples above before its first coordinator call.
2. A change introducing a new provider-costing action shows the estimate and the firm’s chosen cap or no-cap answer.
3. The coordinator’s usage links charges, recipients and running services back to their engagements.

#### SURFACE-012 — Practice agent documentation

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-013

**Requirement.** Blotter’s on-site agent documentation describes this specialist and its contract deltas.

**Acceptance.**
1. The docs link each practice job, resource and event to the listed clause and current implementation state.
2. Every computed Blotter class example above names the fixture that adds it.
3. The specialist prompts expose the engagement week, rescue, billing, onboarding and switch jobs.

#### SURFACE-013 — A seeded practice week under two policies

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-007, BASE-AGENT-013

**Requirement.** A stranger agent given only the installation URL completes one seeded practice week through MCP.

**Acceptance.**
1. The agent creates the recurring work, requests a missing statement, follows an answer, prepares review and identifies an invoice exception with exact source links.
2. Under the all-autonomous company policy every declared class runs without a policy wait or refusal.
3. Under the held company policy standard calls enter review and the other declared classes wait for the named person; their completed outcomes match the same seeded week.
4. The signed-in test person performs only the person steps returned by that held policy, and the final engagement, invoice and exception counts reconcile.

## Push further

### READY capabilities — push further

#### READY-001 — Maintain engagement evidence and readiness

*Tier:* Core · *From:* READY-001 · *Cites:* BASE-AUDIT-001, BASE-DATA-001, BASE-DATA-003, BASE-ROLE-001

**Requirement.** Calls for this workflow carry standard, external and commitment as their facts require; the company’s policy decides their disposition. Under the held company policy, an engagement agent joins signed scope, current-period checklist/requests, QBO/Xero context, source documents, client answers and prior-period work. It identifies absent/conflicting evidence, unusual period-over-period changes and precise source-linked follow-up questions, then tracks approved questions until evidence arrives or a reviewer resolves an exception. Readiness distinguishes collected, validated and judgment-required evidence; only the reviewer approves material judgments and closure. It cannot invent source records or mark tax filings complete. [Capability rules](docs/contract/ready-001.md) define its record and recovery details.

**Acceptance.**
1. Create a close with a missing statement, contradictory client answer and unusual ledger movement.
2. Under the held company policy, inspect the cited readiness map and precise question drafts, approve one, receive evidence and compare before/after.
3. Under the held company policy, reject another inference; the unresolved judgment stays open and review cannot be replaced by an agent verdict.
4. No cached evidence payload is stored.
5. A request is missing when it has no unerased files, collected when files exist without staff acceptance, and validated only in the sense of recorded staff request acceptance; this never claims independent content validation.
6. Answer differences are shown with both source jobs, not inferred contradictions.
7. Deterministic question drafts cite one current request or workflow answer.
8. Under the held company policy, existing agent keys may prepare; a native person approves the exact draft as one link-only PORTAL-003 to-do or declines it with a reason.

#### READY-002 — Readiness source revisions and owned judgments

*Tier:* Core · *From:* READY-001 · *Cites:* BASE-AUDIT-001, BASE-DATA-001, BASE-DATA-003, BASE-ROLE-001

**Requirement.** Calls for this workflow carry standard, external and commitment as their facts require; the company’s policy decides their disposition. Maintain engagement evidence and readiness includes capability journey on the same client, engagement and current source records. [Capability rules](docs/contract/ready-001.md) define its record and recovery details.

**Acceptance.**
1. Under the held company policy, source changes refuse stale approval; replay of the same source fingerprint returns the same preparation.
2. Under the held company policy, client responses remain judgment-required until the assigned reviewer or principal records a resolution; approved unresolved questions block job sign-off, including after restore.
3. Declining a draft changes no source evidence.
4. Question records retain source references/fingerprints and decisions, never source document bytes or copied answer values; maps re-read current authority and erased-file state.
5. No native model, ledger comparison, signed scope or tax filing is claimed.
6. ERASURE-002 inherits whole-client question/response retention and erasure; LEDGER-001 and ENGAGE-001 retain their full destinations and statuses.

### RESCUE capabilities — push further

#### RESCUE-001 — Coordinate a deadline rescue

*Tier:* Core · *Cites:* BASE-AUDIT-001, BASE-DATA-001, BASE-DATA-003, BASE-ROLE-001

**Requirement.** Calls for this workflow carry standard, external, access and live as their facts require; the company’s policy decides their disposition. Under the held company policy, an agent combines sourced US obligations/extensions, remaining dependencies, ledger/document readiness, client response history, staff skills/leave and capacity to propose the smallest feasible rescue plan. Show deadlines at risk, reassignment/request options, costs and unresolved decisions. The partner approves staffing changes, messages, extensions and deadline overrides; the agent follows approved actions and escalates specific blockers until resolved, never inferring filing or moving statutory dates on its own.

**Acceptance.**
1. Put a multi-client week at risk with absent staff and missing documents.
2. Under the held company policy, inspect feasible source-linked plans, approve a reassignment and client question, decline an extension and follow outcomes.
3. Under the held company policy, miss a response and verify escalation of that exact blocker with no unapproved deadline change or false filing.

### LEARN capabilities — push further

#### LEARN-001 — Improve recurring work from review findings

*Tier:* Core · *Cites:* BASE-AUDIT-001, BASE-DATA-001, BASE-DATA-003, BASE-ROLE-001

**Requirement.** Calls for this workflow carry standard and live as their facts require; the company’s policy decides their disposition. Under the held company policy, an agent examines authorized reviewer corrections, repeated client questions, missing-document patterns and next-period outcomes to propose versioned checklist/request/organizer improvements. Explain supporting examples, exceptions and expected benefit; the owner approves new template versions and client deviations. Measure the next period against the original assumptions without changing historical evidence or broadening another client's data access. [Capability rules](docs/contract/learn-001.md) define its record and recovery details.

**Acceptance.**
1. Under the held company policy, complete two periods with a repeated reviewer correction, inspect a proposed template/request change with source examples and approve it for selected clients.
2. Roll forward, compare exception outcomes and verify rejected changes and signed-off history remain unchanged.
3. Under the held company policy, the principal approves an immutable numbered checklist/request/organizer snapshot for selected observed clients.
4. Under the held company policy, all new-job doors apply that client version while retaining source template identity, fees/currency and existing job snapshots; a declined preparation changes nothing.
5. Under the held company policy, source/template/client-version changes fence stale approval.
6. Under the held company policy, comparison uses the exact next period, per client, against the baseline per-period mean of reviewer-return events, client questions, and document-return events plus currently outstanding active requests.
7. Missing periods stay pending and unfinished work provisional; negative deltas mean fewer exceptions and do not prove causation.
8. Supporting private content stays at its current authorized source, with references in learning; versions and references are portable and source erasure retains the archive fence.

### REVENUE capabilities — push further

#### REVENUE-001 — Close billing leakage and reconciliation exceptions

*Tier:* Core · *Cites:* BASE-AUDIT-001, BASE-DATA-001, BASE-DATA-003, BASE-ROLE-001

**Requirement.** Calls for this workflow carry standard, money and commitment as their facts require; the company’s policy decides their disposition. Under the held company policy, an agent compares accepted scope/amendments, time/budgets/WIP, retainer schedules, invoices, credits and provider/accounting events to detect missed charges, duplicate invoices and unreconciled collections. Draft evidence-backed fee amendments or corrections, then verify approved collections reconcile under the single invoice authority. Partners approve fees, amendments, messages, charges outside an existing mandate and write-offs; no narrative can turn pending ACH into settlement.

**Acceptance.**
1. Introduce unbilled out-of-scope work, a duplicate invoice and an ACH return.
2. Under the held company policy, inspect cited exceptions and an amendment draft, approve one correction and decline another; reconcile confirmed provider events and leave the returned payment owned/open without duplicate charging or a silent write-off.

### ONBOARD capabilities — push further

#### ONBOARD-001 — Run new client onboarding to readiness

*Tier:* Core · *From:* ONBOARD-001 · *Cites:* BASE-AUDIT-001, BASE-DATA-001, BASE-DATA-003, BASE-ROLE-001

**Requirement.** Calls for this workflow carry standard, external, access, accounts and gated as their facts require; the company’s policy decides their disposition. Under the held company policy, an onboarding agent reads a signed engagement (ENGAGE-001, CRM-005) and proposes the complete setup. The plan covers clients and contacts per the scope, a work schedule from templates, requests for prior-year returns and opening balances, QBO and Xero and bank connection invitations, a 2848 or 8821 (AUTHZ-001) and portal invitations. Every item is linked to the scope it came from. Once a partner approves the plan, the agent sends only the approved invitations and requests, tracks responses and drafts targeted chases for missing setup items, and escalates a specific blocker to its owner. It cannot sign for anyone, connect accounts on a client's behalf, change fees or start billing. [Capability rules](docs/contract/onboard-001.md) define its record and recovery details.

**Acceptance.**
1. Sign a new 1120-S and monthly bookkeeping engagement and inspect the proposed onboarding plan with its scope links.
2. Approve it with one item removed.
3. Under the held company policy, the agent sends only the approved invitations, tracks responses, and escalates a missing QBO connection to its owner.
4. Under the held company policy, nothing outside the approved plan is sent, and no fee or signature changes.
5. Under the held company policy, deterministic setup previews link every item to that source and its digest; they do not infer scope completeness.
6. Review records selected and removed items once per signed source, with current source, contact and template checks.
7. Observations retain earlier observations immutably and name the principal, evidence or blocker, next action and due condition; a received observation is never provider verification.
8. This subset has no agent or model door and no execution or send authority.

#### ONBOARD-002 — Reviewed onboarding custody and held recovery

*Tier:* Core · *From:* ONBOARD-001 · *Cites:* BASE-AUDIT-001, BASE-DATA-001, BASE-DATA-003, BASE-ROLE-001

**Requirement.** Calls for this workflow carry standard, external, access, accounts and gated as their facts require; the company’s policy decides their disposition. Run new client onboarding to readiness includes capability journey on the same client, engagement and current source records. [Capability rules](docs/contract/onboard-001.md) define its record and recovery details.

**Acceptance.**
1. Under the held company policy, restored reviews are held, and derived reviews join ERASURE-002 with its holds; removed or erased sources are refused. ct approved this principal-only review and observation subset on 25 October 2026 at 17:55Z: owner custody, audited review of signed scope, attributed immutable practitioner observations, no outbound execution and inactive held restoration.
2. The complete partner and agent workflow remains an unbuilt obligation.

### SWITCH capabilities — push further

#### SWITCH-001 — Plan and reconcile the switch from an incumbent

*Tier:* Core · *Cites:* BASE-AUDIT-001, BASE-DATA-001, BASE-DATA-003, BASE-ROLE-001

**Requirement.** Calls for this workflow carry standard, access and live as their facts require; the company’s policy decides their disposition. Under the held company policy, a migration agent reads an authorized Karbon, TaxDome, Canopy, Financial Cents or Double export or API extract. It proposes the full mapping: work types and statuses (WORK-007), templates, custom fields, and source automations rewritten as paused AUTOMATE-001 rules. It explains every unmapped or lossy field with examples, proposes duplicate merges (CRM-004) and produces the reconciliation report. The owner corrects and approves the mapping. The agent never activates an automation, sends a message or charges a payment method, and its mapping runs only through the MIGRATE-001–005 import path.

**Acceptance.**
1. Give the agent a Karbon export with custom statuses and automators.
2. Inspect the proposed mapping, its examples and its unmapped-field explanations.
3. Under the held company policy, correct one status mapping and approve.
4. Under the held company policy, compare the reconciliation counts with the source, and confirm every rewritten automation is paused and no message was sent.

### NOTICE capabilities — push further

#### NOTICE-001 — Read notices and propose the response plan

*Tier:* Core · *From:* NOTICE-001 · *Cites:* BASE-AUDIT-001, BASE-DATA-001, BASE-DATA-003, BASE-ROLE-001

**Requirement.** Calls for this workflow carry standard, external, sensitive and commitment as their facts require; the company’s policy decides their disposition. Under the held company policy, a notice agent reads an uploaded IRS or state notice, such as a CP2000, CP14, CP504, LT11 or a state equivalent. It extracts the notice type, tax year, amount and response deadline from the notice date. It checks for a recorded authorization (AUTHZ-001) and the latest transcripts (RESOLVE-001), and compares the notice items with the wage-and-income transcript. It then proposes the DUE-002 work item, the deadline, client questions and a response outline, each citing the notice lines. The practitioner approves the deadline, the work and any client message. The agent never contacts an agency or submits a response, and text inside the notice cannot instruct it. [Capability rules](docs/contract/notice-001.md) define its record and recovery details.

**Acceptance.**
1. Upload a CP2000 for a 1040 client.
2. Compare the extracted fields with the notice text, and inspect the proposed deadline, the income items that differ from the wage-and-income transcript, and the draft client questions.
3. Under the held company policy, approve some questions and decline others.
4. Overriding the deadline requires the practitioner.
5. A misleading instruction embedded in the notice triggers no action.
6. Under the held company policy, only the principal or a reviewer prepares or reads a notice draft.
7. Every extraction carries an exact source quote and a proposed verification warning.
8. A person accepts or rejects each question and plan step; acceptance never changes a deadline, sends, posts, files or contacts an agency.

#### NOTICE-003 — Practitioner adoption of quoted notice facts

*Tier:* Core · *From:* NOTICE-001 · *Cites:* BASE-AUDIT-001, BASE-DATA-001, BASE-DATA-003, BASE-ROLE-001

**Requirement.** Calls for this workflow carry standard, external, sensitive and commitment as their facts require; the company’s policy decides their disposition. Read notices and propose the response plan includes capability journey on the same client, engagement and current source records. [Capability rules](docs/contract/notice-001.md) define its record and recovery details.

**Acceptance.**
1. The practitioner uses the separate native notice and message doors to adopt verified values or send their selected question.
2. Under the held company policy, recorded native taxpayer authorizations appear locally for review and are excluded from model input.
3. IRS transcript context and comparison remain unavailable until RESOLVE-001 and INTEGRATE-006 are authorized; the response plan is a proposal, never legal or tax advice.

## Field proof register

| ID | Proof | Clauses | State | Date | Receipt |
| --- | --- | --- | --- | --- | --- |
| R-1 | Human screen-reader review and VPAT | MOBILE-001, PORTAL-005 | not run | | |
| R-2 | Apple and Google store distribution and physical-device qualification | MOBILE-001 | not run | | |
| R-3 | Current independent SOC 2 Type II, bridge letter and penetration-test package | SECURE-001 | not run | | |
| R-4 | Entra or Okta vendor-tenant certification | ACCESS-003 | not run | | |
| R-5 | Authorized production vendor connections and licensed provider qualification | INTEGRATE-001, INTEGRATE-002, INTEGRATE-003, INTEGRATE-004, INTEGRATE-005, INTEGRATE-006, INTEGRATE-007, INTEGRATE-008 | not run | | |
| R-6 | Authorized Zapier workspace qualification | API-002 | not run | | |
| R-7 | Claude, ChatGPT, Codex and Copilot client receipts | SURFACE-001 | not run | | |
| R-8 | Firm-owned domain and certificate deployed sign-in receipt | PORTAL-006 | not run | | |

## Boundaries

- Blotter owns practice CRM, engagement scope, workflow, inbox, portal, document/request custody, review, capacity, time/WIP, invoices, collections and follow-up. It remains its own product. General firm file storage connects to [Chest](https://github.com/just-every/run-chest), Google Drive, OneDrive/SharePoint or Dropbox under INTEGRATE-003; client workpapers and request evidence stay part of Blotter. It does not absorb an unowned neighboring category.

- Tax-return calculation, tax advice and federal/state e-filing stay with the qualified practitioner and Lacerte, ProSeries, Drake, UltraTax CS or CCH Axcess. DUE-001 owns calculated obligation deadlines and extension workflow, INTEGRATE-002 owns the packet/status bridge, and INTEGRATE-006 owns authorized IRS transcripts. Completed work is never evidence of a filed or accepted return.

- QuickBooks Online and Xero remain authoritative books. LEDGER-001/002 bring client close context into practice work; INTEGRATE-001 separately connects firm revenue accounting. Gusto remains the payroll calculation, payroll payment and remittance authority; Blotter owns the related practice work and status evidence, not a second payroll engine. Payroll: [Envelope](https://github.com/just-every/run-envelope).

- Stripe supplies card/ACH processing, regulated onboarding and bank settlement. Blotter owns invoices, mandates, payment-state reconciliation and exceptions under PAY-001. Karbon Payments, TaxDome Payments, Canopy Payments and Financial Cents payment history is migrated, and saved methods move to valid mandates or become tracked client reauthorizations under MIGRATE-007. Signature/KBA providers supply specialist identity verification; Blotter owns the engagement-letter journey and signed evidence. Required commercial/provider agreements and US sender registration are implementation clauses, never exclusions.

- Google and Microsoft supply email/calendar transport; Twilio supplies US SMS transport; booking providers supply appointment booking. Blotter retains consent, authority, delivery distinctions and owned failure follow-up. AI and agent actions carry server-computed classes decided by company policy. USD fees and US buyers come first; additional jurisdictions require explicit sourced templates and acceptance.

## Homepage claims

| # | Claim | Clauses |
| --- | --- | --- |
| 1 | Recurring work against federal and state deadlines | WORK-002, WORK-010, DUE-001, DUE-004, DUE-005, DUE-003 |
| 2 | Documents and signatures chased through review and collection | FOLLOWUP-001, SIGN-002, REVIEW-001, PAY-001 |
| 3 | 100% free, open source alternative to Karbon, TaxDome and Canopy | BASE-001 |
| 4 | Federal and North Carolina due dates with weekends and extensions | DUE-001, DUE-004, DUE-005, DUE-003 |
| 5 | Work created ahead with assigned staff | WORK-002, WORK-010 |
| 6 | Every deadline retains its source and effective date | DUE-001, DUE-004, DUE-005 |
| 7 | One queue for client work, review and overdue requests | WORK-005, NOTIFY-001, NOTIFY-002, NOTIFY-003 |
| 8 | Exact questions against uncategorized QuickBooks transactions | LEDGER-001, LEDGER-002, READY-001, READY-002 |
| 9 | Source-linked agent questions and practitioner judgment under company policy | READY-001, READY-002, SURFACE-009 |
| 10 | Client document collection and secure original custody | PORTAL-001, DOC-001, DOC-004, DOC-005 |
| 11 | Conditional organizers and client-specific required answers | PORTAL-004, PORTAL-011, PORTAL-012 |
| 12 | Signature requests, named signers and retained signed evidence | SIGN-002 |
| 13 | IRS e-file signature authorizations and KBA | SIGN-001 |
| 14 | Capacity balancing with skills, leave and independent review | CAPACITY-001, CAPACITY-004, CAPACITY-002, CAPACITY-005, RESCUE-001 |
| 15 | Invoice collection with card and ACH states | BILL-002, BILL-006, BILL-007, PAY-001 |
| 16 | Recurring fees, saved methods and payment plans | BILL-002, BILL-006, BILL-007, PAY-002 |
| 17 | Traceable filing status and rejected-return rework from the tax stack | INTEGRATE-008, DUE-002 |
| 18 | One connected close with client answers and review | LEDGER-002, REVIEW-001 |
| 19 | Migration from Karbon, TaxDome, Canopy, Financial Cents and Double | MIGRATE-001, MIGRATE-002, MIGRATE-003, MIGRATE-004, MIGRATE-005 |
| 20 | Recurrence and future work survive cutover without duplication | MIGRATE-006, MIGRATE-008 |
| 21 | Staff can run Blotter, try the demo and read the docs | BASE-001 |

## Status

Judged from the code and tests at commit `288174d52e6669fd343d2a249f440cb2a44f2a88` (27 October 2026).

| Clauses | Done | Partial | Missing | Total |
| --- | ---: | ---: | ---: | ---: |
| Published | 0 | 4 | 0 | 4 |
| Target and push further | 3 | 113 | 42 | 158 |
| All | 3 | 117 | 42 | 162 |

| Clause | Title | Kind | Status | Evidence | Gap |
| --- | --- | --- | --- | --- | --- |
| `WORK-002` | Automatic recurring work and roll forward | published | partial | `src/blotter/recurrence.ts`; `src/blotter/jobs.ts`; `src/server.ts`; `wrangler.jsonc`; `migrations/core/0028_recurrence.sql`; `src/ui/recurrence.tsx`; `tests/blotter/flows.test.mjs` | Old evidence exercises this workflow; complete proof of Enable monthly and fiscal-year recurrence with a three-month lead time, let scheduled work become due and inspect exactly the periods inside the lead time, each once, with fresh requests is not traced for every listed outcome in docs/contract/DONE-AUDIT.md. |
| `WORK-010` | Recurring job custody and catch-up | published | partial | `src/blotter/recurrence.ts`; `src/blotter/jobs.ts`; `src/server.ts`; `wrangler.jsonc`; `migrations/core/0028_recurrence.sql`; `src/ui/recurrence.tsx`; `tests/blotter/flows.test.mjs` | Old evidence exercises this workflow; complete proof of Budget is the rule's time budget in minutes, copied to each job; staff, fresh document requests and the template's task dependencies (WORK-003) come with each job is not traced for every listed outcome in docs/contract/DONE-AUDIT.md. |
| `PORTAL-001` | Private document requests and uploads | published | partial | `src/blotter/documents.ts`; `src/ui/portal.tsx`; `tests/blotter/flows.test.mjs` | Old evidence asserts the native subset listed as asserted in DONE-AUDIT.md; it does not assert the upload limit is displayed to the client. |
| `REVIEW-001` | Independent reviewer sign off | published | partial | `src/blotter/jobs.ts`; `src/blotter/documents.ts`; `tests/blotter/flows.test.mjs` | Old evidence asserts the native subset listed as asserted in DONE-AUDIT.md; it does not assert the persisted sign-off note and nonempty sign-off time are read back after approval. |
| `US-001` | US firm setup and currency | target | partial | `src/blotter/firm.ts`; `src/blotter/clients.ts`; `src/blotter/billing.ts`; `src/blotter/notifications.ts`; `src/ui/firm.tsx`; `src/ui/common.tsx`; `migrations/core/0047_firm_settings.sql`; `tests/blotter/us.test.mjs`; `tests/blotter/demo.test.mjs` | Old evidence exercises this workflow; complete proof of Set up a US bookkeeping and tax practice, add an LLC and individual client, select USD and America/New_York, and create payroll, sales-tax and annual-tax work is not traced for every listed outcome in docs/contract/DONE-AUDIT.md. |
| `CRM-001` | Client entities and contacts | target | partial | `src/blotter/client-contacts.ts`; `src/blotter/client-lifecycle.ts`; `src/blotter/client-recipients.ts`; `src/blotter/clients.ts`; `src/blotter/merges.ts`; `src/blotter/search.ts`; `src/blotter/documents.ts`; `src/ui/client-details.tsx`; `migrations/core/0049_client_contacts.sql`; `tests/blotter/contacts.test.mjs`; `tests/blotter/flows.test.mjs` | Old evidence exercises this workflow; complete proof of Create a business with two contacts and an individual linked to its owner; assign different staff and portal permissions, change a contact, archive/reactivate the business and inspect retained jobs is not traced for every listed outcome in docs/contract/DONE-AUDIT.md. |
| `CRM-006` | Contact authority and lifecycle carriers | target | partial | `src/blotter/client-contacts.ts`; `src/blotter/client-lifecycle.ts`; `src/blotter/client-recipients.ts`; `src/blotter/clients.ts`; `src/blotter/merges.ts`; `src/blotter/search.ts`; `src/blotter/documents.ts`; `src/ui/client-details.tsx`; `migrations/core/0049_client_contacts.sql`; `tests/blotter/contacts.test.mjs`; `tests/blotter/flows.test.mjs` | Old evidence exercises this workflow; complete proof of ACCESS-002 inherits configurable staff grants; assignments today never widen existing job visibility is not traced for every listed outcome in docs/contract/DONE-AUDIT.md. |
| `CRM-002` | Client groups and custom fields | target | done | `src/blotter/profiles.ts`; `src/blotter/clients.ts`; `src/blotter/imports/client-list.ts`; `migrations/core/0021_client_profiles.sql`; `src/ui/profiles.tsx`; `tests/blotter/flows.test.mjs` |  |
| `CRM-003` | Engagement history and accountable ownership | target | partial | `src/blotter/history.ts`; `src/ui/history.tsx`; `tests/blotter/flows.test.mjs` | Old evidence exercises this workflow; complete proof of Open a client after two periods of work and trace a request from email through upload, review and payment is not traced for every listed outcome in docs/contract/DONE-AUDIT.md. |
| `CRM-007` | Client-history integration carriers | target | partial | `src/blotter/history.ts`; `src/ui/history.tsx`; `tests/blotter/flows.test.mjs` | Old evidence exercises this workflow; complete proof of Today's email is the document reminder; connected-mailbox email (MAIL-001), portal messages (PORTAL-003), signed scope (ENGAGE-001), invoices (BILL-002) and payments (PAY-001) write their events into this history, with author, time and source link and the same visibility, before they ship is not traced for every listed outcome in docs/contract/DONE-AUDIT.md. |
| `CRM-004` | Merge duplicate clients and contacts | target | partial | `src/blotter/duplicates.ts`; `src/blotter/merges.ts`; `src/blotter/imports/target.ts`; `migrations/core/0029_duplicates.sql`; `migrations/core/0030_client_merges.sql`; `src/ui/duplicates.tsx`; `tests/blotter/flows.test.mjs` | Old evidence exercises this workflow; complete proof of Import a Karbon client that duplicates a native client and accept the suggested match is not traced for every listed outcome in docs/contract/DONE-AUDIT.md. |
| `CRM-005` | Prospects intake and onboarding pipeline | target | partial | `src/blotter/prospects.ts`; `src/blotter/intake.ts`; `src/blotter/intake-page.ts`; `migrations/core/0047_intake.sql`; `src/ui/pipeline.tsx`; `tests/blotter/flows.test.mjs`; `tests/blotter/intake.test.mjs`; `tests/blotter/pipeline-forecast.test.mjs` | Old evidence exercises this workflow; complete proof of Submit the embedded intake form and inspect the new prospect with source and answers; a spam submission is rejected is not traced for every listed outcome in docs/contract/DONE-AUDIT.md. |
| `CRM-008` | Prospect pipeline forecasts and stages | target | partial | `src/blotter/prospects.ts`; `src/blotter/intake.ts`; `src/blotter/intake-page.ts`; `migrations/core/0047_intake.sql`; `src/ui/pipeline.tsx`; `tests/blotter/flows.test.mjs`; `tests/blotter/intake.test.mjs`; `tests/blotter/pipeline-forecast.test.mjs` | Old evidence exercises this workflow; complete proof of The pipeline report, as of now in whole UTC days rounded down, gives per lead source and per owner the prospects, open, won and lost counts, conversion (won as a whole percentage of won plus lost; none until one closes) and open, won and lost fee totals grouped by stored currency, and per open stage the prospects in it with their average and oldest days in that stage is not traced for every listed outcome in docs/contract/DONE-AUDIT.md. |
| `ENGAGE-001` | Proposals engagement letters and signatures | target | missing |  | No proposal, engagement-letter, signature or signer-authority workflow exists. |
| `SIGN-001` | IRS e-file signature authorizations with KBA | target | missing |  | No IRS e-file authorization signing, KBA provider, three-attempt fallback, signer record or ready-to-file gate exists. |
| `SIGN-002` | General document signature requests | target | partial | `src/blotter/signatures.ts`; `src/blotter/signatures-portal.ts`; `src/blotter/signatures-staff.ts`; `src/blotter/signatures-forms.ts`; `src/blotter/signatures-pdf.ts`; `src/blotter/signatures-retention.ts`; `src/ui/signatures.tsx`; `migrations/core/0087_signatures.sql`; `migrations/core/0090_signature_evidence.sql`; `tests/blotter/signatures.test.mjs` (“SIGN-002 / BASE-001 / NOTIFY-001: real PDF fields, consent, authorized sequential and parallel signers, decline/resend, void, filed certificate/timeline, notification preferences and atomic offboarding”: fields/two sequential signers, decline/resend/completion, parallel order, ESIGN consent, connection IP and user agent on the signer record and certificate, signed file/certificate/order/client timeline, void/non-signer denials, offboarding, notification/automation, portable held restore; “SIGN-002 / ERASURE-002: record/class/job holds, clocks, pending refusal, preview counts, retained signatures, named outside copies, approved expiry receipt and stale restore fence”: registry/clocks/holds/erasure/receipt/expiry/fence, connection evidence retained then erased with the signed record; “SIGN-002: Form 2848 needs a staff remote-authentication attestation, the representative signs in their own session, connection evidence is certified, and IRS e-file forms are refused by their PDF text”: 8879/8879-S/8878 refused by PDF text under a neutral title and file name, 2848 refused before the attestation, client and staff representative complete it, certificate Submit2848 statement, attestation and both connections, void and non-signer denials); `tests/blotter/signatures-ui.mjs` (signatureAppJourney: staff fields, signer decline/resend/consent, signed file/certificate and timeline; signatureOwnerJourney: client signature folders, signature automation preview and pending-request offboarding; signatureAuthorityJourney: client waiting for the attestation, staff attestation form, representative signing in session and the completed 2848, 1440/390). | Old evidence exercises this workflow; complete proof of Place fields on a PDF and request sequential signatures from two contacts is not traced for every listed outcome in docs/contract/DONE-AUDIT.md. |
| `AUTHZ-001` | Taxpayer authorizations 2848 and 8821 | target | partial | `src/blotter/authorizations.ts`; `src/blotter/authorization-prepare.ts`; `src/blotter/authorization-pdf.ts`; `src/ui/authorizations.tsx`; `src/ui/authorization-prepare.tsx`; `migrations/core/0092_authorizations.sql`; `tests/blotter/signatures.test.mjs` (“AUTHZ-001 / SIGN-002 / DUE-002: prepare official IRS forms, sign and attest a 2848, record online submission and CAF status, scope transcripts and agency contact, alert once and withdraw”: official 2848 for Form 1040 2022-2025 and official 8821 populated from client/representative data; reviewed draft sends nothing; taxpayer attestation/signature and staff representative signature; signed copy, online-only submission, CAF-recorded status; state equivalent signed, fax submission recorded and agency rejection preserved with its reason; 2021 transcript refused, 2024 requested; wrong form and uncovered notice-year range refused; withdrawal flags dependent notices and refuses new requests; one coverage-ending alert; every lifecycle step audited without the TIN; every new door refuses absent/agent/cross-origin sessions; restored records and signed PDF, live client-grant revocation, registry/preview/approved erasure/receipt redaction, retained owner-only signed evidence and stale-restore fence); `tests/blotter/signatures-ui.mjs` (authorizationJourney: client authorization/history, creation, official 2848 and 8821 preparation, prepared PDF download, signature draft, agency-contact tax-form input; authorizationLifecycleJourney: submission, agency answer and withdrawal, 1440/390). | Old evidence exercises this workflow; complete proof of Prepare a 2848 covering Form 1040 for 2022–2025, collect the client's and representative's signatures, and record its online submission and CAF-recorded status is not traced for every listed outcome in docs/contract/DONE-AUDIT.md. |
| `WORK-001` | Reusable engagement templates | target | partial | `src/blotter/clients.ts`; `src/blotter/jobs.ts`; `tests/blotter/flows.test.mjs` | Old evidence asserts the native subset listed as asserted in DONE-AUDIT.md; it does not assert all copied recurrence and preparer/reviewer fields are asserted together. |
| `WORK-003` | Dependencies and conditional workflow | target | partial | `src/blotter/flow.ts`; `src/blotter/tasks.ts`; `src/blotter/jobs.ts`; `migrations/core/0027_task_flow.sql`; `src/ui/flow.tsx`; `tests/blotter/flows.test.mjs` | Old evidence exercises this workflow; complete proof of Create a close feeding a tax engagement, branch on an organizer answer and complete prerequisite tasks is not traced for every listed outcome in docs/contract/DONE-AUDIT.md. |
| `WORK-011` | Dependency exceptions and client isolation | target | partial | `src/blotter/flow.ts`; `src/blotter/tasks.ts`; `src/blotter/jobs.ts`; `migrations/core/0027_task_flow.sql`; `src/ui/flow.tsx`; `tests/blotter/flows.test.mjs` | Old evidence exercises this workflow; complete proof of The job's reviewer, its manager or the principal may record an exception with a required reason: the task can then be worked, but nothing it waited for is completed, its own required attachment is still required, review still needs every applicable task done and every document accepted, and an unanswered branch question is never waived is not traced for every listed outcome in docs/contract/DONE-AUDIT.md. |
| `WORK-004` | Bulk work scheduling and assignment | target | partial | `src/blotter/bulk.ts`; `src/ui/bulk.tsx`; `src/ui/clients.tsx`; `tests/blotter/flows.test.mjs`; `tests/blotter/work-bulk.test.mjs`; `tests/blotter/work-bulk-ui.mjs` (named WORK-004 public-door journeys) | Old evidence exercises this workflow; complete proof of Preview quarterly jobs for the clients selected in a batch using per-client include/exclude; once CRM-002 client groups exist, verify choosing a group pre-selects its clients is not traced for every listed outcome in docs/contract/DONE-AUDIT.md. |
| `WORK-005` | Firm work queues | target | partial | `src/blotter/clients.ts`; `src/ui/jobs.tsx`; `tests/blotter/flows.test.mjs` | Old evidence asserts the native subset listed as asserted in DONE-AUDIT.md; it does not assert every role’s queue dates assignees status and outstanding counts are asserted together. |
| `WORK-006` | Personal plans boards and calendars | target | partial | `src/blotter/planner.ts`; `src/blotter/filters.ts`; `src/blotter/statuses.ts`; `migrations/core/0041_plans_boards.sql`; `src/ui/plan.tsx`; `src/ui/calendar.tsx`; `src/ui/statuses.tsx`; `tests/blotter/flows.test.mjs` | Old evidence exercises this workflow; complete proof of Plan a preparer's week from the overdue queue, group a 1040 board by sub-status, move an eligible card and inspect the same job's new status in queue, calendar and client views is not traced for every listed outcome in docs/contract/DONE-AUDIT.md. |
| `WORK-012` | Firm calendar and due-date changes | target | partial | `src/blotter/planner.ts`; `src/blotter/filters.ts`; `src/blotter/statuses.ts`; `migrations/core/0041_plans_boards.sql`; `src/ui/plan.tsx`; `src/ui/calendar.tsx`; `src/ui/statuses.tsx`; `tests/blotter/flows.test.mjs` | Old evidence exercises this workflow; complete proof of The firm calendar shows jobs and their open tasks on their due dates over at most 62 days; the client filter makes it one client's calendar is not traced for every listed outcome in docs/contract/DONE-AUDIT.md. |
| `WORK-007` | Firm work types and status model | target | partial | `src/blotter/statuses.ts`; `src/blotter/jobs.ts`; `src/ui/statuses.tsx`; `migrations/core/0038_work_types_statuses.sql`; `migrations/core/0039_saved_views.sql`; `migrations/core/0040_job_roles.sql`; `tests/blotter/flows.test.mjs` | Old evidence exercises this workflow; complete proof of Create a 1040 work type and two sub-statuses under Waiting: "on client documents" and "on 8879 signature" is not traced for every listed outcome in docs/contract/DONE-AUDIT.md. |
| `WORK-013` | Work-type roles and dependent views | target | partial | `src/blotter/statuses.ts`; `src/blotter/jobs.ts`; `src/ui/statuses.tsx`; `migrations/core/0038_work_types_statuses.sql`; `migrations/core/0039_saved_views.sql`; `migrations/core/0040_job_roles.sql`; `tests/blotter/flows.test.mjs` | Old evidence exercises this workflow; complete proof of filter the capacity week by the 1040 work type and see only 1040 demand is not traced for every listed outcome in docs/contract/DONE-AUDIT.md. |
| `WORK-008` | Starter US template library | target | partial | `src/blotter/starter-content.ts`; `src/blotter/starter-library.ts`; `src/blotter/starter-diff.ts`; `src/blotter/starter-releases.ts`; `src/blotter/jobs.ts`; `src/ui/starter-library.tsx`; `migrations/core/0048_starter_library.sql`; `tests/blotter/library.test.mjs` | Old evidence exercises this workflow; complete proof of In a new US firm, browse the library and adopt the 1040 and monthly close templates is not traced for every listed outcome in docs/contract/DONE-AUDIT.md. |
| `WORK-014` | Immutable starter releases and three-way updates | target | partial | `src/blotter/starter-content.ts`; `src/blotter/starter-library.ts`; `src/blotter/starter-diff.ts`; `src/blotter/starter-releases.ts`; `src/blotter/jobs.ts`; `src/ui/starter-library.tsx`; `migrations/core/0048_starter_library.sql`; `tests/blotter/library.test.mjs` | Old evidence exercises this workflow; complete proof of Authored releases are bundled with the app; a principal can import a reviewed newer release package with its source/change note and author recorded is not traced for every listed outcome in docs/contract/DONE-AUDIT.md. |
| `WORK-009` | Task assignees due dates and instructions | target | partial | `src/blotter/tasks.ts`; `src/blotter/jobs.ts`; `migrations/core/0023_tasks.sql`; `src/ui/tasks.tsx`; `tests/blotter/flows.test.mjs` | Old evidence exercises this workflow; complete proof of Create a template with three tasks due 10, 5 and 2 days before the work's due date, assigned to Preparer, Manager and a named person is not traced for every listed outcome in docs/contract/DONE-AUDIT.md. |
| `DUE-001` | Sourced US obligations and extensions | target | partial | `src/blotter/deadlines.ts`; `src/blotter/deadline-calendar.ts`; `src/blotter/deadline-catalog.ts`; `src/blotter/jobs.ts`; `src/blotter/recurrence.ts`; `src/ui/deadlines.tsx`; `migrations/core/0068_deadlines.sql`; `tests/blotter/deadlines.test.mjs` | Old evidence exercises this workflow; complete proof of Configure all five obligation types for clients in two states and different fiscal years is not traced for every listed outcome in docs/contract/DONE-AUDIT.md. |
| `DUE-004` | Distinct statutory extended and internal dates | target | partial | `src/blotter/deadlines.ts`; `src/blotter/deadline-calendar.ts`; `src/blotter/deadline-catalog.ts`; `src/blotter/jobs.ts`; `src/blotter/recurrence.ts`; `src/ui/deadlines.tsx`; `migrations/core/0068_deadlines.sql`; `tests/blotter/deadlines.test.mjs` | Old evidence exercises this workflow; complete proof of A job started from an obligation, rolled forward from such a job, or created by a WORK-002 rule that names one takes its period from its template's cadence (starting on the first of a month; an annual period ends in the fiscal-year-end month, quarterly periods are the tax year's quarters) and keeps these dates apart: the statutory date; the original due date, which is the statutory date moved to the next business day past Saturdays, Sundays and federal legal holidays (5 U.S.C. 6103; a Saturday holiday is observed the Friday before, a Sunday one the Monday after) and, for federal rules, DC Emancipation Day (16 April, observed; 26 U.S.C. 7503), with the reason recorded; the extended due date (shifted the same way), which applies once a person on the job records the extension request, or at once for an automatic extension; a relief date from an approved disaster postponement whose jurisdiction, states, rules and inclusive window cover the original or extended date; the internal target (that external date less the obligation's lead days, moved earlier to a business day); and any override is not traced for every listed outcome in docs/contract/DONE-AUDIT.md. |
| `DUE-005` | Approved deadline revisions and filing evidence | target | partial | `src/blotter/deadlines.ts`; `src/blotter/deadline-calendar.ts`; `src/blotter/deadline-catalog.ts`; `src/blotter/jobs.ts`; `src/blotter/recurrence.ts`; `src/ui/deadlines.tsx`; `migrations/core/0068_deadlines.sql`; `tests/blotter/deadlines.test.mjs` | Old evidence exercises this workflow; complete proof of The job's working due date is the override, else the relief, extended or original date; an override needs a principal or reviewer and a reason and never changes a calculated date is not traced for every listed outcome in docs/contract/DONE-AUDIT.md. |
| `DUE-002` | Tax notices and resolution work | target | partial | `src/blotter/notices.ts`; `migrations/core/0026_notices.sql`; `src/ui/notices.tsx`; `tests/blotter/flows.test.mjs` | Old evidence exercises this workflow; complete proof of Open a notice from a client upload, verify the response deadline, assign a practitioner, link an authorized transcript and response receipt, and schedule follow-up is not traced for every listed outcome in docs/contract/DONE-AUDIT.md. |
| `DUE-003` | Wider US obligation catalog and firm defined deadlines | target | partial | `src/blotter/deadline-catalog.ts`; `src/blotter/deadline-calendar.ts`; `src/blotter/deadlines.ts`; `src/blotter/recurrence.ts`; `src/ui/deadlines.tsx`; `migrations/core/0068_deadlines.sql`; `tests/blotter/deadlines.test.mjs` | Old evidence exercises this workflow; complete proof of Configure 1040-ES quarterly estimates including a weekend shift, the January 31 W-2 and 1099-NEC deadlines, an FBAR with its automatic October extension, and a firm rule of 15 days after month end is not traced for every listed outcome in docs/contract/DONE-AUDIT.md. |
| `RESOLVE-001` | Transcript analysis and resolution cases | target | missing |  | No transcript parsing, per-year account analysis, CSED or change routing exists. |
| `MAIL-001` | Gmail and Microsoft 365 shared inbox | target | missing |  | No connected email, shared inbox, email-to-task or attachment-sync adapter exists. |
| `MAIL-002` | Mailbox privacy and sharing | target | missing |  | No connected mailbox exists, so no client-only sharing, private-thread rules or private-mail exclusions exist. |
| `MAIL-003` | Triage controls snooze and scheduled send | target | missing |  | No mailbox triage list, snooze, assignment, scheduled send, no-reply reminder or email-in address exists. |
| `MSG-001` | Firm and personal message templates | target | partial | `src/blotter/messages.ts`; `src/blotter/documents.ts`; `migrations/core/0025_messages.sql`; `migrations/core/0035_template_attachments.sql`; `migrations/core/0081_template_files_sent.sql`; `src/ui/messages.tsx`; `src/ui/client-portal.tsx`; `tests/blotter/flows.test.mjs` ("MSG-001 message templates", including portal messages); `src/blotter/portal-items.ts`; `src/blotter/bulk-messages.ts`; `tests/blotter/bulk-messages.test.mjs` (bulk files and unresolved-field exclusion) | Old evidence exercises this workflow; complete proof of Create a "Month-end close request" firm template with client, period, due-date and outstanding-items placeholders is not traced for every listed outcome in docs/contract/DONE-AUDIT.md. |
| `MSG-002` | Bulk client messages | target | partial | `src/blotter/bulk-messages.ts`; `src/blotter/bulk-organizers.ts`; `migrations/core/0078_bulk_organizers.sql`; `tests/blotter/bulk-organizers.test.mjs`; `src/blotter/bulk-events.ts`; `src/blotter/marketing-consent.ts`; `src/blotter/unsubscribe-page.ts`; `src/blotter/messages.ts`; `src/blotter/intake.ts`; `src/blotter/intake-page.ts`; `src/blotter/prospects.ts`; `src/blotter/merges.ts`; `src/blotter/offboarding.ts`; `migrations/core/0075_bulk_messages.sql`; `migrations/core/0076_marketing_merge_holds.sql`; `API.md`; `tests/blotter/bulk-messages.test.mjs` (named MSG-002 / BASE-001 and MSG-002 consent carriers journeys); `src/blotter/imports/marketing.ts`; `src/ui/move-in.tsx`; `migrations/core/0079_import_marketing.sql`; `tests/blotter/import-mapping.test.mjs`; `tests/blotter/import-marketing-ui.mjs`; `src/blotter/marketing-suppression.ts`; `tests/blotter/import-mapping.test.mjs` ("an erasure between import chunks") | Native email batches, class/consent refusals, rechecked throttled dispatch, unsubscribe, signed provider events, per-recipient request links and assigned-organizer invitations, the intake checkbox grant, contact-merge consent and offboarding batch transfer exist; real-provider proof, reply threading, the portal channel, incumbent migration consent mapping, contact-only erasure suppression and a bulk-message workspace screen are missing. Whole-client hashed withdrawal suppression now fences resumed import chunks atomically. Native CSV consent mapping with separately reviewed opt-ins and principal attestation exists. Template-version file attachments are implemented and asserted in `tests/blotter/bulk-messages.test.mjs` ("MSG-002 / NOTIFY-001 / BASE-001 bulk engagement and marketing messages"). |
| `SMS-001` | Two way client text messaging | target | missing |  | No SMS provider, two-way thread, consent capture or MMS filing exists. |
| `COLLAB-001` | Contextual discussions and review alerts | target | partial | `src/blotter/threads.ts`; `src/blotter/notifications.ts`; `src/blotter/jobs.ts`; `migrations/core/0020_threads.sql`; `src/ui/discussions.tsx`; `tests/blotter/flows.test.mjs` | Old evidence exercises this workflow; complete proof of Submit work, receive the assigned reviewer's notification, mention a colleague and request a correction is not traced for every listed outcome in docs/contract/DONE-AUDIT.md. |
| `NOTIFY-001` | Staff notifications digest and settings | target | partial | `src/blotter/notifications.ts`; `src/blotter/notification-events.ts`; `src/blotter/notification-settings.ts`; `src/blotter/notification-digest.ts`; `src/blotter/notification-authority.ts`; `src/ui/notifications.tsx`; `migrations/core/0072_notification_events.sql`; `migrations/core/0073_notification_preferences.sql`; `tests/blotter/notifications.test.mjs`; `tests/blotter/notifications-ui.mjs`; `tests/blotter/flows.test.mjs`; `tests/blotter/organizers.test.mjs` (named NOTIFY-001 / BASE-001 journeys); `src/blotter/bulk-messages.ts`; `src/blotter/bulk-events.ts`; `tests/blotter/bulk-messages.test.mjs`; `tests/blotter/bulk-failure-ui.mjs` (NOTIFY-001 bulk provider-refusal and hard-bounce journey) | Old evidence exercises this workflow; complete proof of Assign a job and a task to a preparer is not traced for every listed outcome in docs/contract/DONE-AUDIT.md. |
| `NOTIFY-002` | Notification choices and local-day digest | target | partial | `src/blotter/notifications.ts`; `src/blotter/notification-events.ts`; `src/blotter/notification-settings.ts`; `src/blotter/notification-digest.ts`; `src/blotter/notification-authority.ts`; `src/ui/notifications.tsx`; `migrations/core/0072_notification_events.sql`; `migrations/core/0073_notification_preferences.sql`; `tests/blotter/notifications.test.mjs`; `tests/blotter/notifications-ui.mjs`; `tests/blotter/flows.test.mjs`; `tests/blotter/organizers.test.mjs` (named NOTIFY-001 / BASE-001 journeys); `src/blotter/bulk-messages.ts`; `src/blotter/bulk-events.ts`; `tests/blotter/bulk-messages.test.mjs`; `tests/blotter/bulk-failure-ui.mjs` (NOTIFY-001 bulk provider-refusal and hard-bounce journey) | Old evidence exercises this workflow; complete proof of Approved coverage receipts still reach their recorded active participants before first sign-in or after the job moves; the receipt grants no job access or fresh job data is not traced for every listed outcome in docs/contract/DONE-AUDIT.md. |
| `NOTIFY-003` | Deferred notification custody and recovery | target | partial | `src/blotter/notifications.ts`; `src/blotter/notification-events.ts`; `src/blotter/notification-settings.ts`; `src/blotter/notification-digest.ts`; `src/blotter/notification-authority.ts`; `src/ui/notifications.tsx`; `migrations/core/0072_notification_events.sql`; `migrations/core/0073_notification_preferences.sql`; `tests/blotter/notifications.test.mjs`; `tests/blotter/notifications-ui.mjs`; `tests/blotter/flows.test.mjs`; `tests/blotter/organizers.test.mjs` (named NOTIFY-001 / BASE-001 journeys); `src/blotter/bulk-messages.ts`; `src/blotter/bulk-events.ts`; `tests/blotter/bulk-messages.test.mjs`; `tests/blotter/bulk-failure-ui.mjs` (NOTIFY-001 bulk provider-refusal and hard-bounce journey) | Old evidence exercises this workflow; complete proof of Deferred deliveries wait for the next permitted trigger is not traced for every listed outcome in docs/contract/DONE-AUDIT.md. |
| `PORTAL-002` | Authenticated branded client portal | target | partial | `src/blotter/portal-accounts.ts`; `src/blotter/portal-session.ts`; `src/blotter/client-contacts.ts`; `src/blotter/portal-home.ts`; `src/blotter/portal-account-routes.ts`; `src/ui/client-account.tsx`; `src/ui/client-details.tsx`; `migrations/core/0097_portal_accounts.sql`; `tests/blotter/portal-accounts.test.mjs` ("PORTAL-002 / BASE-001 / ERASURE-002": seven-day one-use invitation and expired-link refusal; invitation, factor replacement, reset and contact-disable session revocation; linked-entity success beside cross-entity and direct-file refusal; identical known and unknown sign-in, invitation and reset acknowledgments; five-code lockout and recovery; eight-hour session lifetime and expiry; audited reads, inactive archive authority and erasure); `tests/blotter/portal-accounts-ui.mjs` (portalAccountJourney: invitation acceptance, first sign-in, recovery-code use, reset, expiry and revocation at 1440 and 390; spanishAccountEnrollment: TOTP first sign-in and recovery codes at 1440 and 390; zero axe violations) | Old evidence exercises this workflow; complete proof of Invite two contacts with different entity access, sign in with a second factor on the installation host and recover a lost factor is not traced for every listed outcome in docs/contract/DONE-AUDIT.md. |
| `PORTAL-007` | Portal account recovery and active scope | target | partial | `src/blotter/portal-accounts.ts`; `src/blotter/portal-session.ts`; `src/blotter/client-contacts.ts`; `src/blotter/portal-home.ts`; `src/blotter/portal-account-routes.ts`; `src/ui/client-account.tsx`; `src/ui/client-details.tsx`; `migrations/core/0097_portal_accounts.sql`; `tests/blotter/portal-accounts.test.mjs` ("PORTAL-002 / BASE-001 / ERASURE-002": seven-day one-use invitation and expired-link refusal; invitation, factor replacement, reset and contact-disable session revocation; linked-entity success beside cross-entity and direct-file refusal; identical known and unknown sign-in, invitation and reset acknowledgments; five-code lockout and recovery; eight-hour session lifetime and expiry; audited reads, inactive archive authority and erasure); `tests/blotter/portal-accounts-ui.mjs` (portalAccountJourney: invitation acceptance, first sign-in, recovery-code use, reset, expiry and revocation at 1440 and 390; spanishAccountEnrollment: TOTP first sign-in and recovery codes at 1440 and 390; zero axe violations) | Old evidence exercises this workflow; complete proof of Invitation and reset acknowledgments are identical for existing and nonexistent accounts; staff eligibility and role checks still apply is not traced for every listed outcome in docs/contract/DONE-AUDIT.md. |
| `PORTAL-008` | Portal authority history and inactive restore | target | partial | `src/blotter/portal-accounts.ts`; `src/blotter/portal-session.ts`; `src/blotter/client-contacts.ts`; `src/blotter/portal-home.ts`; `src/blotter/portal-account-routes.ts`; `src/ui/client-account.tsx`; `src/ui/client-details.tsx`; `migrations/core/0097_portal_accounts.sql`; `tests/blotter/portal-accounts.test.mjs` ("PORTAL-002 / BASE-001 / ERASURE-002": seven-day one-use invitation and expired-link refusal; invitation, factor replacement, reset and contact-disable session revocation; linked-entity success beside cross-entity and direct-file refusal; identical known and unknown sign-in, invitation and reset acknowledgments; five-code lockout and recovery; eight-hour session lifetime and expiry; audited reads, inactive archive authority and erasure); `tests/blotter/portal-accounts-ui.mjs` (portalAccountJourney: invitation acceptance, first sign-in, recovery-code use, reset, expiry and revocation at 1440 and 390; spanishAccountEnrollment: TOTP first sign-in and recovery codes at 1440 and 390; zero axe violations) | Old evidence exercises this workflow; complete proof of Staff actions, client sign-ins, factors, recoveries, refused codes and reads of signed PDFs and bills are audited; invitations and revocations appear in the client history is not traced for every listed outcome in docs/contract/DONE-AUDIT.md. |
| `PORTAL-009` | Client accounts and message-consent carriers | target | partial | `src/blotter/portal-accounts.ts`; `src/blotter/portal-session.ts`; `src/blotter/client-contacts.ts`; `src/blotter/portal-home.ts`; `src/blotter/portal-account-routes.ts`; `src/ui/client-account.tsx`; `src/ui/client-details.tsx`; `migrations/core/0097_portal_accounts.sql`; `tests/blotter/portal-accounts.test.mjs` ("PORTAL-002 / BASE-001 / ERASURE-002": seven-day one-use invitation and expired-link refusal; invitation, factor replacement, reset and contact-disable session revocation; linked-entity success beside cross-entity and direct-file refusal; identical known and unknown sign-in, invitation and reset acknowledgments; five-code lockout and recovery; eight-hour session lifetime and expiry; audited reads, inactive archive authority and erasure); `tests/blotter/portal-accounts-ui.mjs` (portalAccountJourney: invitation acceptance, first sign-in, recovery-code use, reset, expiry and revocation at 1440 and 390; spanishAccountEnrollment: TOTP first sign-in and recovery codes at 1440 and 390; zero axe violations) | Old evidence exercises this workflow; complete proof of The portal marketing grant stays with MSG-002's portal channel, asserted on its doors before portal marketing ships is not traced for every listed outcome in docs/contract/DONE-AUDIT.md. |
| `PORTAL-003` | Client progress secure chat and to dos | target | partial | `src/blotter/portal-items.ts`; `src/blotter/documents.ts`; `src/ui/client-portal.tsx`; `src/ui/portal.tsx`; `migrations/core/0036_portal_items.sql`; `tests/blotter/flows.test.mjs` | Old evidence exercises this workflow; complete proof of Open an engagement as a client, ask a secure question, complete one to-do and inspect the preparer's queue and progress view after review is not traced for every listed outcome in docs/contract/DONE-AUDIT.md. |
| `PORTAL-010` | Owned client questions and task completion | target | partial | `src/blotter/portal-items.ts`; `src/blotter/documents.ts`; `src/ui/client-portal.tsx`; `src/ui/portal.tsx`; `migrations/core/0036_portal_items.sql`; `tests/blotter/flows.test.mjs` | Old evidence exercises this workflow; complete proof of A client question is owned by the job's preparer when it is asked, alerts them (in-app and by mail), counts in the job queue as an open client question and stays open until a staff member who can write to the job answers it on the link; answering closes only that question is not traced for every listed outcome in docs/contract/DONE-AUDIT.md. |
| `PORTAL-004` | Conditional organizers | target | partial | `src/blotter/organizers.ts`; `src/blotter/organizers-client.ts`; `src/blotter/organizers-store.ts`; `src/blotter/organizers-erasure.ts`; `src/ui/organizers.tsx`; `tests/blotter/organizers.test.mjs` (named PORTAL-004/BASE-001/WORK-008 journeys) | Old evidence exercises this workflow; complete proof of Send an organizer, answer an ownership question that reveals a dependent section, save/resume on a phone and attach evidence is not traced for every listed outcome in docs/contract/DONE-AUDIT.md. |
| `PORTAL-011` | Organizer draft submission and correction | target | partial | `src/blotter/organizers.ts`; `src/blotter/organizers-client.ts`; `src/blotter/organizers-store.ts`; `src/blotter/organizers-erasure.ts`; `src/ui/organizers.tsx`; `tests/blotter/organizers.test.mjs` (named PORTAL-004/BASE-001/WORK-008 journeys) | Old evidence exercises this workflow; complete proof of Draft answers save/resume on the same link; current confirmation reveals dependent questions and supporting requests, while only a submitted confirmed answer drives WORK-003 workflow is not traced for every listed outcome in docs/contract/DONE-AUDIT.md. |
| `PORTAL-012` | Organizer provenance and recovery | target | partial | `src/blotter/organizers.ts`; `src/blotter/organizers-client.ts`; `src/blotter/organizers-store.ts`; `src/blotter/organizers-erasure.ts`; `src/ui/organizers.tsx`; `tests/blotter/organizers.test.mjs` (named PORTAL-004/BASE-001/WORK-008 journeys) | Old evidence exercises this workflow; complete proof of Organizer data follows job/contact relationships during CRM-004 merge/undo and native archive restore; portal tokens remain excluded is not traced for every listed outcome in docs/contract/DONE-AUDIT.md. |
| `PORTAL-005` | Client language and accessibility | target | partial | `src/i18n/catalog.ts`; `src/blotter/client-contacts.ts`; `src/blotter/messages.ts`; `src/blotter/documents.ts`; `src/blotter/portal-items.ts`; `src/blotter/organizers-definition.ts`; `src/blotter/organizers-client.ts`; `src/blotter/organizers-send.ts`; `src/blotter/signatures-pdf.ts`; `src/blotter/signatures-portal.ts`; `src/blotter/unsubscribe-page.ts`; `src/blotter/deliverables.ts`; `src/blotter/invoices-delivery.ts`; `src/ui/i18n.tsx`; `src/ui/portal.tsx`; `src/ui/client-portal.tsx`; `src/ui/organizers.tsx`; `src/ui/signatures.tsx`; `src/ui/deliverables.tsx`; `src/ui/vault.tsx`; `src/ui/invoices.tsx`; `src/ui/messages.tsx`; `src/ui/client-details.tsx`; `migrations/core/0096_client_language.sql`; `migrations/core/0098_bulk_language_review.sql`; `migrations/core/0099_bulk_language_erasure.sql`; `tests/blotter/language.test.mjs` (“PORTAL-005 / MSG-001 / PORTAL-004 / SIGN-002 / MSG-002 / BASE-001: a Spanish-speaking contact gets Spanish requests, portal, organizer, signature, deliverable mail and unsubscribe page; templates warn when they lack a Spanish version; the English contact is unchanged”); `tests/blotter/language-ui.mjs` (languageJourney: axe-core WCAG 2.2 AA scans and a keyboard-only upload and signature, 1440/390); `tests/blotter/invoices.test.mjs` (“BILL-004 / MSG-002 / CRM-003: consented reminders run on schedule …”: Spanish invoice email and portal, the reminder schedule's missing-version warning, Spanish reminders); `tests/blotter/erasure-policy.test.mjs` (“ERASURE-002 / BASE-001 / policy journey …”: the language preference erased with the contact); `tests/blotter/portal-accounts.test.mjs` and `tests/blotter/portal-accounts-ui.mjs` (Spanish account entry, enrollment/error, recovery codes, entity, verification/recovery; WCAG 2.2 AA at 1440/390) | Old evidence exercises this workflow; complete proof of Set a contact to Spanish and send a templated request that has a Spanish version is not traced for every listed outcome in docs/contract/DONE-AUDIT.md. |
| `MOBILE-001` | Mobile client and practitioner work | target | partial | `src/ui/portal.tsx`; `src/ui/workspace.tsx`; `src/ui/job.tsx`; `src/ui/timer.tsx`; `src/blotter/timers.ts`; `tests/blotter/flows.test.mjs` (TIME-001 timers and budgets; PORTAL-003 client progress, secure questions and to-dos); `tests/blotter/mobile-ui.mjs` (mobileTimeJourney; mobileTaskJourney); `tests/blotter/mobile-upload.test.mjs` (MOBILE-001 browser recovery and portal authority journeys; invokes `tests/blotter/mobile-ui.mjs` mobileUploadJourney in push Verify); `tests/blotter/erasure-policy.test.mjs` (policy journey with portal packet original: holds, signed-work clocks, preview, receipt and restore fence); `tests/blotter/organizers.test.mjs` (conditional organizers: contact-specific packet authority and inactive-request refusal) | Browser timer and manual-time, client to-do and staff review, keyboard navigation, automated accessibility, tooltip and revoked-authority journeys are proven. Browser interrupted uploads of a selected multi-page original now retain confirmed progress, require explicit retry and exact-original reselection after reload, complete once, preserve contact attribution, exclude staging from archives and retain existing completed-file custody and erasure fencing. Camera scanning and cropping and capture qualification, native iOS and Android apps and distribution, physical-device client and staff journeys, consented private push with NOTIFY-001, offline draft state and organizer conflict reconciliation with current-confirmation rules, and native assistive-technology qualification remain missing. Those capabilities require real devices and Apple and Google developer accounts with signing and push credentials. Remaining native records and provider copies still owe the inherited BASE-001 and ERASURE-002 activation gates. |
| `DOC-001` | Client files versions and annotations | target | partial | `src/blotter/document-packets.ts`; `src/blotter/document-catalog.ts`; `src/blotter/document-related.ts`; `src/blotter/document-downloads.ts`; `src/ui/document-packets.tsx`; `migrations/core/0053_document_packets.sql`; `tests/blotter/document-packets.test.mjs`; `tests/blotter/document-sharing.test.mjs` | Old evidence exercises this workflow; complete proof of Upload a realistic multi-page packet, replace it with a corrected version, annotate a page and find both versions from the client and engagement is not traced for every listed outcome in docs/contract/DONE-AUDIT.md. |
| `DOC-004` | Resumable packet originals and corrections | target | partial | `src/blotter/document-packets.ts`; `src/blotter/document-catalog.ts`; `src/blotter/document-related.ts`; `src/blotter/document-downloads.ts`; `src/ui/document-packets.tsx`; `migrations/core/0053_document_packets.sql`; `tests/blotter/document-packets.test.mjs`; `tests/blotter/document-sharing.test.mjs` | Old evidence exercises this workflow; complete proof of A repeated identical chunk is idempotent; gaps, differing bytes and incomplete/final-hash mismatches refuse without discarding confirmed bytes is not traced for every listed outcome in docs/contract/DONE-AUDIT.md. |
| `DOC-005` | Packet catalog recovery and connector custody | target | partial | `src/blotter/document-packets.ts`; `src/blotter/document-catalog.ts`; `src/blotter/document-related.ts`; `src/blotter/document-downloads.ts`; `src/ui/document-packets.tsx`; `migrations/core/0053_document_packets.sql`; `tests/blotter/document-packets.test.mjs`; `tests/blotter/document-sharing.test.mjs` | Old evidence exercises this workflow; complete proof of The owner JSON archive restore accepts up to 64,000,000 JSON characters; firm-scale streaming remains ARCHIVE-002 is not traced for every listed outcome in docs/contract/DONE-AUDIT.md. |
| `DOC-002` | Document sharing and internal only custody | target | partial | `src/blotter/document-shares.ts`; `src/blotter/documents.ts`; `src/blotter/deliverables.ts`; `src/ui/document-access.tsx`; `src/ui/portal.tsx`; `migrations/core/0050_document_shares.sql`; `tests/blotter/document-sharing.test.mjs`; `tests/blotter/intake.test.mjs`; `tests/blotter/flows.test.mjs` | Old evidence exercises this workflow; complete proof of Keep a workpaper internal, share a final packet with one contact, rotate/revoke its share and attempt direct reads as another contact and preparer is not traced for every listed outcome in docs/contract/DONE-AUDIT.md. |
| `DOC-006` | Exact document grants and revoked links | target | partial | `src/blotter/document-shares.ts`; `src/blotter/documents.ts`; `src/blotter/deliverables.ts`; `src/ui/document-access.tsx`; `src/ui/portal.tsx`; `migrations/core/0050_document_shares.sql`; `tests/blotter/document-sharing.test.mjs`; `tests/blotter/intake.test.mjs`; `tests/blotter/flows.test.mjs` | Old evidence exercises this workflow; complete proof of Every fetch rechecks the current file hash, entity, contact and grant, and records a download without the secret is not traced for every listed outcome in docs/contract/DONE-AUDIT.md. |
| `DOC-003` | Client approval of deliverables | target | done | `src/blotter/deliverables.ts`; `src/blotter/documents.ts`; `migrations/core/0019_deliverables.sql`; `src/ui/deliverables.tsx`; `tests/blotter/flows.test.mjs` |  |
| `SEARCH-001` | Firm wide search | target | partial | `src/blotter/search.ts`; `src/blotter/pdf-text.ts`; `migrations/core/0044_search.sql`; `src/ui/search.tsx`; `tests/blotter/flows.test.mjs` | Old evidence exercises this workflow; complete proof of Search for a client's last name, an invoice number, a phrase inside an uploaded PDF and an email subject, and open each result is not traced for every listed outcome in docs/contract/DONE-AUDIT.md. |
| `SEARCH-002` | Search ranking and private-result exclusions | target | partial | `src/blotter/search.ts`; `src/blotter/pdf-text.ts`; `migrations/core/0044_search.sql`; `src/ui/search.tsx`; `tests/blotter/flows.test.mjs` | Old evidence exercises this workflow; complete proof of Results are ordered by that score, then most recent first (the record's latest activity: done, answered, uploaded, posted or created), at most 50, optionally filtered to one type, and each carries the door that opens it (the client's history, the job, the discussion, or the file download); in the app "/" focuses the box, arrow keys move and Enter opens the chosen result is not traced for every listed outcome in docs/contract/DONE-AUDIT.md. |
| `FOLLOWUP-001` | Automatic document chasing and escalation | target | partial | `src/blotter/documents.ts`; `src/blotter/proposals.ts`; `tests/blotter/flows.test.mjs`; `src/blotter/automation.ts`; `src/blotter/automation-runner.ts`; `tests/blotter/automation.test.mjs` | Manual/human-approved reminders and approved bounded native event/due-time automation exist. Multistep reminder sequences, latest-template-per-step behavior, response-based stopping, escalation, successor-owned sequences, Twilio and carrier outcomes remain missing. |
| `LEDGER-001` | QuickBooks and Xero client ledger context | target | missing |  | No client-ledger connector exists. The held QBO and Xero app credentials do not include company consent: the injector reports QBO_REFRESH_TOKEN and XERO_REFRESH_TOKEN missing. Authorized company grants, organization identifiers and a registered Blotter callback are required for sandbox proof; neither source-comparison nor revocation and period-change acceptance has passing evidence. Ledger-path authority, audit, erasure, portability and sync-failure notification are also unproved. |
| `LEDGER-002` | Transaction questions and close evidence | target | missing |  | No ledger-linked transaction questions, close comparisons or source snapshots exist. |
| `LEDGER-003` | Cross client books health dashboard | target | missing |  | No ledger connection exists, so no cross-client books dashboard exists. |
| `CAPACITY-001` | Workload capacity and coverage | target | partial | `src/blotter/capacity.ts`; `src/ui/capacity.tsx`; `migrations/core/0037_capacity.sql`; `tests/blotter/flows.test.mjs` | Old evidence asserts the native subset listed as asserted in DONE-AUDIT.md; it does not assert the seeded setup’s complete preparation and review budget is read back; unset hours and weekday-only leave rules are asserted for their boundary cases; availability clamps at zero after leave and commitments exceed the weekly hours; every demand source including the task-to-job due-date fallback is independently reconciled. |
| `CAPACITY-004` | Unscheduled work and capacity conflicts | target | partial | `src/blotter/capacity.ts`; `src/ui/capacity.tsx`; `migrations/core/0037_capacity.sql`; `tests/blotter/flows.test.mjs` | Old evidence exercises this workflow; complete proof of Open tasks or reviews due in the week without an estimate are unscheduled; open tasks due before the week are listed as past due; neither counts toward demand is not traced for every listed outcome in docs/contract/DONE-AUDIT.md. |
| `CAPACITY-002` | Reassignment and dependency aware scheduling | target | partial | `src/blotter/coverage.ts`; `src/blotter/history.ts`; `migrations/core/0042_coverage.sql`; `src/ui/coverage.tsx`; `tests/blotter/flows.test.mjs` | Old evidence exercises this workflow; complete proof of Remove an assigned preparer for leave, preview alternate staffing and move a dependent job chain is not traced for every listed outcome in docs/contract/DONE-AUDIT.md. |
| `CAPACITY-005` | Coverage-plan commitment and notifications | target | partial | `src/blotter/coverage.ts`; `src/blotter/history.ts`; `migrations/core/0042_coverage.sql`; `src/ui/coverage.tsx`; `tests/blotter/flows.test.mjs` | Old evidence exercises this workflow; complete proof of A manager may name the preparer or reviewer, move a due date (with where it comes from) or leave a job out; a named person who is ineligible, would review their own work or lacks the capacity, or a prerequisite that would fall due after the job waiting for it, refuses the plan until changed is not traced for every listed outcome in docs/contract/DONE-AUDIT.md. |
| `CAPACITY-003` | Capacity forecasts and hiring plans | target | partial | `src/blotter/forecast.ts`; `src/blotter/capacity.ts`; `migrations/core/0043_capacity_scenarios.sql`; `src/ui/forecast.tsx`; `tests/blotter/flows.test.mjs`; `tests/blotter/pipeline-forecast.test.mjs` | Old evidence exercises this workflow; complete proof of Project the next tax season from recurring work and prior actuals, add a hypothetical hire and lost client, and compare demand/capacity by skill is not traced for every listed outcome in docs/contract/DONE-AUDIT.md. |
| `CAPACITY-006` | Forecast estimates and editable scenarios | target | partial | `src/blotter/forecast.ts`; `src/blotter/capacity.ts`; `migrations/core/0043_capacity_scenarios.sql`; `src/ui/forecast.tsx`; `tests/blotter/flows.test.mjs`; `tests/blotter/pipeline-forecast.test.mjs` | Old evidence exercises this workflow; complete proof of Without prior actuals the period uses the rule's time budget, else the work type's budget, else the sum of the template's task estimates, with a range from 50% to 150% of it (rounded to the minute), and the reason names the client; with none of these its estimate is zero and the reason says so is not traced for every listed outcome in docs/contract/DONE-AUDIT.md. |
| `CAPACITY-007` | Forecast scenario custody and report handoffs | target | partial | `src/blotter/forecast.ts`; `src/blotter/capacity.ts`; `migrations/core/0043_capacity_scenarios.sql`; `src/ui/forecast.tsx`; `tests/blotter/flows.test.mjs`; `tests/blotter/pipeline-forecast.test.mjs` | Old evidence exercises this workflow; complete proof of Forecasting computes from live records and stores nothing; saving a scenario stores only its name, window and changes (audited) and changes no job, rule, assignment, estimate, due date or capacity row; reopening it recomputes from current records is not traced for every listed outcome in docs/contract/DONE-AUDIT.md. |
| `TIME-001` | Time budgets and activity suggestions | target | partial | `src/blotter/billing.ts`; `src/blotter/timers.ts`; `src/blotter/suggestions.ts`; `src/blotter/timesheets.ts`; `migrations/core/0031_timers.sql`; `migrations/core/0032_billable_time.sql`; `migrations/core/0033_activity_suggestions.sql`; `migrations/core/0034_time_tasks.sql`; `src/ui/timer.tsx`; `src/ui/suggestions.tsx`; `tests/blotter/flows.test.mjs` | Old evidence exercises this workflow; complete proof of Record time, change the rate and inspect unchanged prior amounts and budget variance is not traced for every listed outcome in docs/contract/DONE-AUDIT.md. |
| `TIME-002` | Timesheet approval and period locks | target | done | `src/blotter/timesheets.ts`; `src/blotter/billing.ts`; `migrations/core/0018_timesheets.sql`; `src/ui/timesheet.tsx`; `tests/blotter/flows.test.mjs` |  |
| `TIME-003` | Billing rates and rate cards | target | partial | `src/blotter/rates.ts`; `src/blotter/billing.ts`; `src/ui/team.tsx`; `migrations/core/0080_work_type_rates.sql`; `tests/blotter/flows.test.mjs`; `tests/blotter/rate-worktypes.test.mjs`; `tests/blotter/rate-worktypes-ui.mjs` (named TIME-003 / BASE-001 public-door journeys) | Old evidence exercises this workflow; complete proof of Set rates for a practice role, a staff member, a 1040 service, a client and that client plus service is not traced for every listed outcome in docs/contract/DONE-AUDIT.md. |
| `TIME-004` | Expenses and disbursements | target | partial | `src/blotter/expenses.ts`; `src/blotter/billing.ts`; `migrations/core/0022_expenses.sql`; `src/ui/expenses.tsx`; `tests/blotter/flows.test.mjs` | Old evidence exercises this workflow; complete proof of Record a state filing fee with a receipt and a 10% markup, approve it, invoice it and inspect the invoice line and WIP is not traced for every listed outcome in docs/contract/DONE-AUDIT.md. |
| `BILL-001` | Reviewed immutable billing exports | target | partial | `src/blotter/billing.ts`; `tests/blotter/flows.test.mjs` | Old evidence exercises this workflow; complete proof of Prepare a mixed time/fixed-fee export, reject source reuse and non-owner approval, approve as principal and download twice is not traced for every listed outcome in docs/contract/DONE-AUDIT.md. |
| `BILL-002` | Invoices retainers and recurring fees | target | partial | `src/blotter/invoices.ts`; `src/blotter/invoices-sources.ts`; `src/blotter/invoices-retainers.ts`; `src/blotter/invoices-delivery.ts`; `src/blotter/invoices-credits.ts`; `src/blotter/invoices-pdf.ts`; `src/blotter/invoice-routes.ts`; `src/blotter/report-invoices.ts`; `src/ui/invoices.tsx`; `migrations/core/0086_invoices.sql`; `migrations/core/0089_invoice_auto.sql`; `tests/blotter/invoices.test.mjs` (“BILL-002 / TIME-002 / TIME-004 / CRM-001 / CRM-003: independent scope and approved extras, supplied tax, deposit, numbered immutable PDF, explicit portal delivery and source locks”: fixed/hourly/expense sources, tax/terms/recipient/deposit preview, approval/delivery/PDF, history/source links, search and merge/undo; “BILL-002 / BASE-001: monthly events generate one draft per entitlement and, without a recorded consent, only drafts; price and cancellation previews, explicit prorations and portable paused rules”: retainer/replay/amendment/cancellation/proration/restore; “BILL-002 / ACCESS-002: a financial-authority holder bills and sends by email alone; a consented rule revision auto-issues and sends within its cap once per month, otherwise leaves a draft with a named exception, and a restore returns it without consent”: delegated billing, email-only delivery to a contact without portal, bounded auto-issue/send once per period across a restart, over-cap, changed-revision and demoted-consenter drafts with named exceptions, restore without consent; “BILL-002 / ERASURE-002 / BASE-001: unpaid balances and unapplied deposits refuse erasure; retained invoice holds, preview, receipt, expiry and newer-journal restore fence”: open-balance refusal, retained identity exclusions and audited principal reads, retention/erasure/expiry/fence); `tests/blotter/invoices-ui.mjs` (invoiceJourney: native invoice, deposit, retainer with automatic-issue consent, delivery, portal, search/download and reporting screens, 1440/390); `tests/blotter/invoice-report-proof.mjs` (assertInvoiceReport: live invoice/retainer/credit sources, receivables, CSV/PDF parity, source links, denied preparer and named report outside copies). | Old evidence exercises this workflow; complete proof of Bill a fixed engagement and hourly extra, start a monthly retainer, apply a deposit and preview a fee amendment is not traced for every listed outcome in docs/contract/DONE-AUDIT.md. |
| `BILL-006` | Invoice delivery reconciliation and copy custody | target | partial | `src/blotter/invoices.ts`; `src/blotter/invoices-sources.ts`; `src/blotter/invoices-retainers.ts`; `src/blotter/invoices-delivery.ts`; `src/blotter/invoices-credits.ts`; `src/blotter/invoices-pdf.ts`; `src/blotter/invoice-routes.ts`; `src/blotter/report-invoices.ts`; `src/ui/invoices.tsx`; `migrations/core/0086_invoices.sql`; `migrations/core/0089_invoice_auto.sql`; `tests/blotter/invoices.test.mjs` (“BILL-002 / TIME-002 / TIME-004 / CRM-001 / CRM-003: independent scope and approved extras, supplied tax, deposit, numbered immutable PDF, explicit portal delivery and source locks”: fixed/hourly/expense sources, tax/terms/recipient/deposit preview, approval/delivery/PDF, history/source links, search and merge/undo; “BILL-002 / BASE-001: monthly events generate one draft per entitlement and, without a recorded consent, only drafts; price and cancellation previews, explicit prorations and portable paused rules”: retainer/replay/amendment/cancellation/proration/restore; “BILL-002 / ACCESS-002: a financial-authority holder bills and sends by email alone; a consented rule revision auto-issues and sends within its cap once per month, otherwise leaves a draft with a named exception, and a restore returns it without consent”: delegated billing, email-only delivery to a contact without portal, bounded auto-issue/send once per period across a restart, over-cap, changed-revision and demoted-consenter drafts with named exceptions, restore without consent; “BILL-002 / ERASURE-002 / BASE-001: unpaid balances and unapplied deposits refuse erasure; retained invoice holds, preview, receipt, expiry and newer-journal restore fence”: open-balance refusal, retained identity exclusions and audited principal reads, retention/erasure/expiry/fence); `tests/blotter/invoices-ui.mjs` (invoiceJourney: native invoice, deposit, retainer with automatic-issue consent, delivery, portal, search/download and reporting screens, 1440/390); `tests/blotter/invoice-report-proof.mjs` (assertInvoiceReport: live invoice/retainer/credit sources, receivables, CSV/PDF parity, source links, denied preparer and named report outside copies). | Old evidence exercises this workflow; complete proof of Unresolved sends are held for provider-evidence reconciliation without replay is not traced for every listed outcome in docs/contract/DONE-AUDIT.md. |
| `BILL-007` | Invoice retention and restore authority | target | partial | `src/blotter/invoices.ts`; `src/blotter/invoices-sources.ts`; `src/blotter/invoices-retainers.ts`; `src/blotter/invoices-delivery.ts`; `src/blotter/invoices-credits.ts`; `src/blotter/invoices-pdf.ts`; `src/blotter/invoice-routes.ts`; `src/blotter/report-invoices.ts`; `src/ui/invoices.tsx`; `migrations/core/0086_invoices.sql`; `migrations/core/0089_invoice_auto.sql`; `tests/blotter/invoices.test.mjs` (“BILL-002 / TIME-002 / TIME-004 / CRM-001 / CRM-003: independent scope and approved extras, supplied tax, deposit, numbered immutable PDF, explicit portal delivery and source locks”: fixed/hourly/expense sources, tax/terms/recipient/deposit preview, approval/delivery/PDF, history/source links, search and merge/undo; “BILL-002 / BASE-001: monthly events generate one draft per entitlement and, without a recorded consent, only drafts; price and cancellation previews, explicit prorations and portable paused rules”: retainer/replay/amendment/cancellation/proration/restore; “BILL-002 / ACCESS-002: a financial-authority holder bills and sends by email alone; a consented rule revision auto-issues and sends within its cap once per month, otherwise leaves a draft with a named exception, and a restore returns it without consent”: delegated billing, email-only delivery to a contact without portal, bounded auto-issue/send once per period across a restart, over-cap, changed-revision and demoted-consenter drafts with named exceptions, restore without consent; “BILL-002 / ERASURE-002 / BASE-001: unpaid balances and unapplied deposits refuse erasure; retained invoice holds, preview, receipt, expiry and newer-journal restore fence”: open-balance refusal, retained identity exclusions and audited principal reads, retention/erasure/expiry/fence); `tests/blotter/invoices-ui.mjs` (invoiceJourney: native invoice, deposit, retainer with automatic-issue consent, delivery, portal, search/download and reporting screens, 1440/390); `tests/blotter/invoice-report-proof.mjs` (assertInvoiceReport: live invoice/retainer/credit sources, receivables, CSV/PDF parity, source links, denied preparer and named report outside copies). | Old evidence exercises this workflow; complete proof of Retention clocks use issue and later void/credit/allocation dates in the firm timezone; expiry requires principal confirmation and preserves amounts, number, attribution and SHA-256 is not traced for every listed outcome in docs/contract/DONE-AUDIT.md. |
| `PAY-001` | Card ACH and authorized collections | target | partial | `tests/blotter/payments.test.mjs`: “Authorized saved-card collection reconciles partial payment and refund into balances, statements and attributed client history” (partial card receipt, authorized quick collect, replayed collection, refund, statement, attributed email request through portal upload and reviewer sign-off to payment history, default in-app payment notices and privacy); “Signed duplicate and out-of-order notifications cannot undo refunds; invalid signatures cannot change money” (signature refusal, duplicate and stale events, refund and dispute balances, opted-in payment email held through personal quiet hours, current recipient grant, source link and restart deduplication); “Failed card and returned ACH create owned follow-up, pending acceptance is unsettled, and revoked mandates never debit again” (failure, pending versus settled, return, file relock, revocation and safe once-only owned failure and return notices); “Payment archives retain accounting and restore without charging authority; erasure lists Stripe copies and honors holds” (archive accounting, inactive authority, observed copies and retained classes). `tests/blotter/payment-ui.mjs` / paymentJourney and `tests/blotter/payments-live.mjs` (held-key sandbox PASS 26 October 2026 at 11:38Z: partial card receipt req_DZr8os8HOMCY1m, saved-card collection req_ZC2FDoONLORIrA, final client card confirmation req_hoIenVmiwq79XN; full gate release, refund relock, duplicate refusal and revocation). ; `tests/blotter/payments-ach-live.mjs` (pending, settled and returned: held-key sandbox PASS 26 October 2026 at 11:36Z, actual provider states, fee and event receipts, file gate and own-record access) | Card and bank Checkout, invoice-bounded saved-method consent, manual quick collect, signed current-state reconciliation, partial receipts, refunds, disputes, owned failures and inactive restore are implemented. Remaining: recurring and due-date collection mandates; incumbent method migration and tracked reauthorization; full provider-record erasure and expiry activation proof.  The held US account accepted bank Checkout on 26 October 2026. |
| `PAY-002` | Payment plans and client payment self service | target | missing |  | No client payment portal, multi-invoice payment, installment plan or auto-pay exists. |
| `BILL-003` | WIP receivables realization and profitability | target | partial | `src/blotter/billing.ts`; `src/blotter/reports.ts`; `src/blotter/report-financials.ts`; `src/blotter/report-invoices.ts`; `src/blotter/report-receivables.ts`; `src/blotter/invoice-aging.ts`; `src/blotter/invoices-writeoffs.ts`; `src/blotter/staff-costs.ts`; `src/blotter/invoices-collections.ts`; `src/blotter/invoices-erasure.ts`; `src/ui/report-financials.tsx`; `src/ui/report-receivables.tsx`; `src/ui/invoices.tsx`; `migrations/core/0093_invoice_writeoffs.sql`; `migrations/core/0094_staff_costs.sql`; `tests/blotter/invoices.test.mjs` (“BILL-003 / BASE-001: WIP, aging, realization and profitability reconcile to approved sources and recorded receipts; a partner-approved write-off changes the period report and statement while the issued invoice stays byte-identical”: hourly, adjustment, fixed-fee, expense and retainer invoices with a recorded receipt and a credit memo, WIP/aging/earned-deferred/realization/profit reconciled to sources, balances and the statement, denied roles, over-balance and zero refusals, write-off approval leaving the numbered PDF identical, changed period report/statement/history/CSV, staff-cost rates and their visibility, a financial-authority holder's attributed write-off and its revocation, restore; “BILL-002 / ERASURE-002 / BASE-001 …”: a written-off invoice stops blocking erasure, expiry redacts the write-off reason, newer-journal restore fence); `tests/blotter/billing-analysis.test.mjs`; `tests/blotter/reports.test.mjs`; `tests/blotter/invoices-ui.mjs` (receivablesJourney, 1440/390) | Old evidence exercises this workflow; complete proof of Run WIP, aging and profitability for a client with hourly work, fixed fees, a retainer, partial payment and credit is not traced for every listed outcome in docs/contract/DONE-AUDIT.md. |
| `BILL-004` | Invoice reminders statements and bulk resend | target | partial | `src/blotter/invoices-collections.ts`; `src/ui/invoice-collections.tsx`; `migrations/core/0091_invoice_collections.sql`; `tests/blotter/invoices.test.mjs` (“BILL-004 / MSG-002 / CRM-003: consented reminders run on schedule only for unpaid, undisputed, deliverable invoices; clients opt out; two invoices resend in bulk; the statement reconciles to open balances; quick collect refuses without saved-method authorization; a restore pauses the schedule”: three invoices with different due dates reminded on schedule, one paid between steps and one disputed never reminded, an opted-out client and a withdrawn-consent contact held, no duplicate across a restart, reminders in client history, marketing template refused, two-invoice bulk resend from one preview, statement totals equal open balances, quick collect refused, restore paused without consent); `tests/blotter/invoices-ui.mjs` (collectionsJourney: reminder schedule, client statement and resend preview, 1440/390). `tests/blotter/payments.test.mjs`: “Authorized saved-card collection reconciles partial payment and refund into balances, statements and attributed client history” (partial card receipt, authorized quick collect, replayed collection, refund, statement, attributed email request through portal upload and reviewer sign-off to payment history, default in-app payment notices and privacy); “Signed duplicate and out-of-order notifications cannot undo refunds; invalid signatures cannot change money” (signature refusal, duplicate and stale events, refund and dispute balances, opted-in payment email held through personal quiet hours, current recipient grant, source link and restart deduplication); “Failed card and returned ACH create owned follow-up, pending acceptance is unsettled, and revoked mandates never debit again” (failure, pending versus settled, return, file relock, revocation and safe once-only owned failure and return notices); “Payment archives retain accounting and restore without charging authority; erasure lists Stripe copies and honors holds” (archive accounting, inactive authority, observed copies and retained classes). `tests/blotter/payment-ui.mjs` / paymentJourney and `tests/blotter/payments-live.mjs` (held-key sandbox PASS 26 October 2026 at 11:38Z: partial card receipt req_DZr8os8HOMCY1m, saved-card collection req_ZC2FDoONLORIrA, final client card confirmation req_hoIenVmiwq79XN; full gate release, refund relock, duplicate refusal and revocation). | Quick collect now records provider payments and a provider-confirmed payment between reminder steps stops reminders. The complete reminder and quick-collect journey under RL-101 still requires a fresh exact-candidate proof; this rewrite does not promote the row. The reminder-consent default was approved by ct on 22 October 2026 with edit-to-pause riders, now asserted. |
| `BILL-005` | Payment gated delivery and credit hold | target | partial | `src/blotter/payment-gates.ts`; `src/blotter/payment-policy.ts`; `src/blotter/document-downloads.ts`; `src/blotter/deliverables.ts`; `src/blotter/invoices-credits.ts`; `src/blotter/invoices-erasure.ts`; `src/blotter/jobs.ts`; `src/blotter/bulk.ts`; `src/blotter/client-lifecycle.ts`; `src/blotter/history.ts`; `src/ui/deliverables.tsx`; `src/ui/client-details.tsx`; `src/ui/invoices.tsx`; `migrations/core/0095_payment_gates.sql`; `tests/blotter/invoices.test.mjs` (“BILL-005 / ERASURE-002 / BASE-001: a gated final copy stays locked until its invoice is paid (a card receipt at once, ACH by the firm policy), the client's own records stay open, partner overrides are recorded and an overdue client shows the credit hold”: locked listing and file and bearer-share refusals, revoked shares and removed file grants returning 404 without invoice details, partial card and pending ACH receipts keeping it locked, the ACH policy and settlement releasing it, a full card receipt releasing a second file, a partner override with its reason, attribution and revocation, the credit hold on the client, job and bulk warnings, override and paydown, live job-screen warnings including recurrence-generated work without billing amounts for a preparer, restore; “BILL-002 / ERASURE-002 / BASE-001 …”: gate and override records in the erasure receipt); `tests/blotter/portal-accounts.test.mjs` and `tests/blotter/portal-accounts-ui.mjs` (authenticated account unpaid-file refusal, listing, override, relock, revoked-grant 404 without gate details, locked screen at 1440/390); `tests/blotter/invoices-ui.mjs` (gateJourney and holdJourney: loaded policy values, principal grace change and reload, locked file and hold controls at 1440 and 390); `tests/blotter/payments-live.mjs` (clientCardUnlock: provider-confirmed card releases the final file, client records remain downloadable; held-key PASS 26 October 2026 at 11:38Z, req_hoIenVmiwq79XN) ; `tests/blotter/payments-ach-live.mjs` (pending, settled and returned: held-key PASS 26 October 2026 at 11:36Z; actual Stripe events evt_3UUmB2Dg8BoejKxo0GrGqZnU, evt_3UUmBPDg8BoejKxo1WThQ25w and evt_3UUmC4Dg8BoejKxo0eu0v2tn; settlement release, explicit pending policy, actual return relock, client-supplied records always open, portal screens at 1440 and 390) | Old evidence exercises this workflow; complete proof of Gate a final return copy on an invoice is not traced for every listed outcome in docs/contract/DONE-AUDIT.md. |
| `BILL-008` | Credit holds and settled-balance reconciliation | target | partial | `src/blotter/payment-gates.ts`; `src/blotter/payment-policy.ts`; `src/blotter/document-downloads.ts`; `src/blotter/deliverables.ts`; `src/blotter/invoices-credits.ts`; `src/blotter/invoices-erasure.ts`; `src/blotter/jobs.ts`; `src/blotter/bulk.ts`; `src/blotter/client-lifecycle.ts`; `src/blotter/history.ts`; `src/ui/deliverables.tsx`; `src/ui/client-details.tsx`; `src/ui/invoices.tsx`; `migrations/core/0095_payment_gates.sql`; `tests/blotter/invoices.test.mjs` (“BILL-005 / ERASURE-002 / BASE-001: a gated final copy stays locked until its invoice is paid (a card receipt at once, ACH by the firm policy), the client's own records stay open, partner overrides are recorded and an overdue client shows the credit hold”: locked listing and file and bearer-share refusals, revoked shares and removed file grants returning 404 without invoice details, partial card and pending ACH receipts keeping it locked, the ACH policy and settlement releasing it, a full card receipt releasing a second file, a partner override with its reason, attribution and revocation, the credit hold on the client, job and bulk warnings, override and paydown, live job-screen warnings including recurrence-generated work without billing amounts for a preparer, restore; “BILL-002 / ERASURE-002 / BASE-001 …”: gate and override records in the erasure receipt); `tests/blotter/portal-accounts.test.mjs` and `tests/blotter/portal-accounts-ui.mjs` (authenticated account unpaid-file refusal, listing, override, relock, revoked-grant 404 without gate details, locked screen at 1440/390); `tests/blotter/invoices-ui.mjs` (gateJourney and holdJourney: loaded policy values, principal grace change and reload, locked file and hold controls at 1440 and 390); `tests/blotter/payments-live.mjs` (clientCardUnlock: provider-confirmed card releases the final file, client records remain downloadable; held-key PASS 26 October 2026 at 11:38Z, req_hoIenVmiwq79XN) ; `tests/blotter/payments-ach-live.mjs` (pending, settled and returned: held-key PASS 26 October 2026 at 11:36Z; actual Stripe events evt_3UUmB2Dg8BoejKxo0GrGqZnU, evt_3UUmBPDg8BoejKxo1WThQ25w and evt_3UUmC4Dg8BoejKxo0eu0v2tn; settlement release, explicit pending policy, actual return relock, client-supplied records always open, portal screens at 1440 and 390) | Old evidence exercises this workflow; complete proof of The same principal-only policy sets the credit-hold threshold (default: off) and grace days (default: 0): a client is on credit hold when the open balance of its issued invoices past due, after the grace days, is at least the threshold is not traced for every listed outcome in docs/contract/DONE-AUDIT.md. |
| `REPORT-001` | Firm performance and client reporting | target | partial | `src/blotter/reports.ts`; `src/blotter/report-schedules.ts`; `src/blotter/report-exports.ts`; `src/ui/reports.tsx`; `tests/blotter/reports.test.mjs`; `tests/blotter/reports-ui.mjs` | Old evidence exercises this workflow; complete proof of Complete and delay several engagements, filter a period/team and drill from turnaround and overdue totals to source jobs is not traced for every listed outcome in docs/contract/DONE-AUDIT.md. |
| `REPORT-002` | Status throughput and recurring report delivery | target | partial | `src/blotter/reports.ts`; `src/blotter/report-schedules.ts`; `src/blotter/report-exports.ts`; `src/ui/reports.tsx`; `tests/blotter/reports.test.mjs`; `tests/blotter/reports-ui.mjs` | Old evidence exercises this workflow; complete proof of Stage/sub-status visits, current counts and elapsed minutes come from WORK-007 history for that cohort is not traced for every listed outcome in docs/contract/DONE-AUDIT.md. |
| `REPORT-003` | Client report scope and source erasure | target | partial | `src/blotter/reports.ts`; `src/blotter/report-schedules.ts`; `src/blotter/report-exports.ts`; `src/ui/reports.tsx`; `tests/blotter/reports.test.mjs`; `tests/blotter/reports-ui.mjs` | Old evidence exercises this workflow; complete proof of Existing client progress reports remain limited to PORTAL-003/CRM-001 approved client-visible data is not traced for every listed outcome in docs/contract/DONE-AUDIT.md. |
| `INTEGRATE-001` | Firm accounting invoice and payment exchange | target | missing |  | No firm-ledger customer/invoice/payment adapter or authority mapping exists. |
| `INTEGRATE-002` | US tax software document and status handoff | target | missing |  | No tax-software adapter, desktop bridge or tax-status import exists. |
| `INTEGRATE-003` | Connected document storage | target | missing |  | No external document-storage connectors or custody mapping exist. |
| `INTEGRATE-004` | Ignition engagement onboarding | target | missing |  | No Ignition connector or accepted-proposal onboarding trigger exists. |
| `INTEGRATE-005` | Calendars and client appointment booking | target | missing |  | No Google/Outlook calendar or Calendly/Acuity booking integration exists. |
| `INTEGRATE-006` | Authorized IRS transcripts | target | missing |  | No IRS e-Services/TDS connector, authorization tracking or transcript workflow exists. |
| `INTEGRATE-007` | Gusto payroll engagement context | target | missing |  | No Gusto payroll-work/status connector exists. |
| `INTEGRATE-008` | Return filing status source per tax stack | target | missing |  | Native obligation/extension acknowledgment files exist. Return/stack-specific filing-status sources and mappings, transmission/acceptance/rejection states and codes, rejection-triggered reopening and the five-stack connector journey remain missing. |
| `API-001` | Authenticated product HTTP doors | target | partial | `src/blotter/api.ts`; `src/blotter/session.ts`; `tests/blotter/flows.test.mjs` | Old evidence exercises this workflow; complete proof of Under the held company policy, create/read work and time through the authenticated HTTP API, inspect billing as reviewer and refuse preparer/private-job reads, signed-out access and agent-key use on person-only routes is not traced for every listed outcome in docs/contract/DONE-AUDIT.md. |
| `API-002` | Documented API webhooks and Zapier | target | partial | `src/blotter/api.ts`; `src/blotter/proposals.ts`; `src/blotter/read-pages.ts`; `src/blotter/client-read.ts`; `src/blotter/clients.ts`; `src/blotter/timesheets.ts`; `API.md`; `tests/blotter/flows.test.mjs`; `tests/blotter/api-pages.test.mjs`; `src/blotter/client-writes.ts`; `src/blotter/billing-read.ts`; `tests/blotter/api-billing.test.mjs`; `migrations/core/0077_api_client_writes.sql`; `tests/blotter/api-writes.test.mjs` (named API-002 / BASE-001 native journeys); `tests/blotter/integration-keys.test.mjs` ("API-002 / BASE-001 integration lifecycle", "API-002 integration task events", "API-002 integration requests", "API-002 / ERASURE-002 key scopes", "API-002 scoped document and billing metadata"); `tests/blotter/integration-webhooks.test.mjs` ("API-002 / BASE-001 thin signed completion webhooks"); `tests/blotter/integration-ui.mjs` (integrationTaskJourney, existing job screen at 1440 and 390) | Native v1 staff pages and client-write replay remain. Principal-reviewed non-person keys now have explicit client and action grants, live identity and MFA checks, atomic effects, per-key replay, rolling 60-request limits, entity and task creation, document and invoice metadata pages, thin signed completion webhooks with retained outcomes and human reconciliation, inactive restore and client erasure. Broader work mutations, time recording and document-byte integration doors remain unbuilt; billing integration is metadata-only with no financial execution. An authorized Zapier workspace and the complete mapped live integration journey remain unavailable. Future person-created API tokens still inherit ACCESS-004 before shipping. Status remains partial. |
| `API-003` | Native client and billing API authority | target | partial | `src/blotter/api.ts`; `src/blotter/proposals.ts`; `src/blotter/read-pages.ts`; `src/blotter/client-read.ts`; `src/blotter/clients.ts`; `src/blotter/timesheets.ts`; `API.md`; `tests/blotter/flows.test.mjs`; `tests/blotter/api-pages.test.mjs`; `src/blotter/client-writes.ts`; `src/blotter/billing-read.ts`; `tests/blotter/api-billing.test.mjs`; `migrations/core/0077_api_client_writes.sql`; `tests/blotter/api-writes.test.mjs` (named API-002 / BASE-001 native journeys); `tests/blotter/integration-keys.test.mjs` ("API-002 / BASE-001 integration lifecycle", "API-002 integration task events", "API-002 integration requests", "API-002 / ERASURE-002 key scopes", "API-002 scoped document and billing metadata"); `tests/blotter/integration-webhooks.test.mjs` ("API-002 / BASE-001 thin signed completion webhooks"); `tests/blotter/integration-ui.mjs` (integrationTaskJourney, existing job screen at 1440 and 390) | Native v1 staff pages and client-write replay remain. Principal-reviewed non-person keys now have explicit client and action grants, live identity and MFA checks, atomic effects, per-key replay, rolling 60-request limits, entity and task creation, document and invoice metadata pages, thin signed completion webhooks with retained outcomes and human reconciliation, inactive restore and client erasure. Broader work mutations, time recording and document-byte integration doors remain unbuilt; billing integration is metadata-only with no financial execution. An authorized Zapier workspace and the complete mapped live integration journey remain unavailable. Future person-created API tokens still inherit ACCESS-004 before shipping. Status remains partial. |
| `AUTOMATE-001` | Durable firm automation | target | partial | `src/blotter/automation.ts`; `src/blotter/automation-runner.ts`; `src/blotter/model.ts`; `src/blotter/archive-policy.mjs`; `src/ui/automation.tsx`; `migrations/core/0070_automation.sql`; `tests/blotter/automation.test.mjs`; `tests/blotter/automation-ui.mjs` (named AUTOMATE-001 / WORK-006 / WORK-007 / BASE-001 journeys) | Old evidence exercises this workflow; complete proof of Enable rules through the app, including "when all tasks complete, set status In review" and "on entering Waiting – on client documents, send the request template" is not traced for every listed outcome in docs/contract/DONE-AUDIT.md. |
| `IMPORT-001` | Reviewed client list import | target | partial | `src/blotter/imports.ts`; `src/blotter/imports/mapped-source.ts`; `src/blotter/imports/mapped-matching.ts`; `src/blotter/imports/mapped-target.ts`; `src/ui/move-in.tsx`; `migrations/core/0051_mapped_imports.sql`; `tests/blotter/import-mapping.test.mjs`; `tests/blotter/flows.test.mjs`; `IMPORTING.md` | Old evidence exercises this workflow; complete proof of Map an exported client/contact CSV, preview errors and duplicates without writes, commit its reviewed fingerprint and resume is not traced for every listed outcome in docs/contract/DONE-AUDIT.md. |
| `IMPORT-002` | Stable source matches and import replay | target | partial | `src/blotter/imports.ts`; `src/blotter/imports/mapped-source.ts`; `src/blotter/imports/mapped-matching.ts`; `src/blotter/imports/mapped-target.ts`; `src/ui/move-in.tsx`; `migrations/core/0051_mapped_imports.sql`; `tests/blotter/import-mapping.test.mjs`; `tests/blotter/flows.test.mjs`; `IMPORTING.md` | Old evidence exercises this workflow; complete proof of Stable source associations survive native merges and replay; changed source content is refused, never silently applied is not traced for every listed outcome in docs/contract/DONE-AUDIT.md. |
| `MIGRATE-001` | Karbon migration | target | missing |  | No Karbon-specific extractor, full-work/history mapping or reconciled cutover exists; the generic client CSV is not a complete migration. |
| `MIGRATE-002` | TaxDome migration | target | missing |  | No TaxDome-specific extractor, full-work/history mapping or reconciled cutover exists; the generic client CSV is not a complete migration. |
| `MIGRATE-003` | Canopy migration | target | missing |  | No Canopy-specific extractor, full-work/history mapping or reconciled cutover exists; the generic client CSV is not a complete migration. |
| `MIGRATE-004` | Financial Cents migration | target | missing |  | No Financial Cents-specific extractor, full-work/history mapping or reconciled cutover exists; the generic client CSV is not a complete migration. |
| `MIGRATE-005` | Double migration | target | missing |  | No Double-specific extractor, full-work/history mapping or reconciled cutover exists; the generic client CSV is not a complete migration. |
| `MIGRATE-006` | Recurring schedules and future work carry over | target | partial | `src/blotter/recurrence-imports.ts`; `src/blotter/recurrence.ts`; `migrations/core/0082_recurrence_imports.sql`; `tests/blotter/recurrence-imports.test.mjs`; `tests/blotter/recurrence-imports-ui.mjs` (named MIGRATE-006 / BASE-001 journeys) | Reviewed native source-series mappings and source-ID claims of existing future jobs now create paused rules with owned holds, replay protection and activation review. Authorized incumbent extraction, creation of imported future items, prior-item content carry-over, complete source reconciliation and the real Karbon cutover journey remain missing. |
| `MIGRATE-008` | Atomic recurrence carry-over and reviewed resume | target | partial | `src/blotter/recurrence-imports.ts`; `src/blotter/recurrence.ts`; `migrations/core/0082_recurrence_imports.sql`; `tests/blotter/recurrence-imports.test.mjs`; `tests/blotter/recurrence-imports-ui.mjs` (named MIGRATE-006 / BASE-001 journeys) | Reviewed native source-series mappings and source-ID claims of existing future jobs now create paused rules with owned holds, replay protection and activation review. Authorized incumbent extraction, creation of imported future items, prior-item content carry-over, complete source reconciliation and the real Karbon cutover journey remain missing. |
| `MIGRATE-007` | Auto pay enrollments carried over or reauthorized | target | missing |  | No payment provider, auto-pay enrollment import, Stripe payment-data migration, reauthorization request tracking, cutover payment report or single-collector check exists. |
| `ACCESS-001` | Native roles and server authority | target | partial | `src/blotter/session.ts`; `src/blotter/model.ts`; `src/blotter/team.ts`; `tests/blotter/flows.test.mjs` | Old evidence exercises this workflow; complete proof of Invite and sign in staff, call privileged and hidden-job routes as preparer and reviewer, attempt cross-origin writes and deactivate a member is not traced for every listed outcome in docs/contract/DONE-AUDIT.md. |
| `ACCESS-002` | Client permissions and sensitive data policies | target | partial | `src/blotter/permissions.ts`; `src/blotter/access-gate.ts`; `src/blotter/access-sql.ts`; `src/ui/permissions.tsx`; `migrations/core/0085_access_policy.sql`; `migrations/core/0088_access_delegations.sql`; `tests/blotter/permissions.test.mjs` (“Client teams overlap; read-only and sensitive workpaper authority, revocation, exports, background delivery and coverage use live grants”: overlapping team scopes, read-only write denials, sensitive workpaper, direct API/export/share reads and background work after revocation, step-up then authorized export, denied writes, redacted diagnostics, CAPACITY-002 coverage exclusion and refused named plan, BASE-001 portable grants, erasure registry and restore fence; “Delegated manage-access and financial-authority grants are bounded and live, and export step-up applies from installation”: export and sensitive administration refused with the step-up refusal on an unconfigured install then allowed, financial authority reads the firm report for held clients only, ungranted reviewer refused, manage-access holder bounded away from itself, the principal, unheld clients and delegations, revocation on the next request); `tests/blotter/permissions-ui.mjs` (permissionsJourney: permission controls, delegated permissions and read-only workspace, 1440/390); `tests/blotter/vault.test.mjs` (VAULT-001 credential vault journey: credential reveal step-up). | Old evidence exercises this workflow; complete proof of Give two teams overlapping client scopes, assign a read-only member and restrict a sensitive workpaper is not traced for every listed outcome in docs/contract/DONE-AUDIT.md. |
| `ACCESS-007` | Sensitive practice administration and recovery | target | partial | `src/blotter/permissions.ts`; `src/blotter/access-gate.ts`; `src/blotter/access-sql.ts`; `src/ui/permissions.tsx`; `migrations/core/0085_access_policy.sql`; `migrations/core/0088_access_delegations.sql`; `tests/blotter/permissions.test.mjs` (“Client teams overlap; read-only and sensitive workpaper authority, revocation, exports, background delivery and coverage use live grants”: overlapping team scopes, read-only write denials, sensitive workpaper, direct API/export/share reads and background work after revocation, step-up then authorized export, denied writes, redacted diagnostics, CAPACITY-002 coverage exclusion and refused named plan, BASE-001 portable grants, erasure registry and restore fence; “Delegated manage-access and financial-authority grants are bounded and live, and export step-up applies from installation”: export and sensitive administration refused with the step-up refusal on an unconfigured install then allowed, financial authority reads the firm report for held clients only, ungranted reviewer refused, manage-access holder bounded away from itself, the principal, unheld clients and delegations, revocation on the next request); `tests/blotter/permissions-ui.mjs` (permissionsJourney: permission controls, delegated permissions and read-only workspace, 1440/390); `tests/blotter/vault.test.mjs` (VAULT-001 credential vault journey: credential reveal step-up). | Old evidence exercises this workflow; complete proof of Sensitive administration (access settings, team, integration keys, firm settings, retention, credential archive mode, invoice authority and automatic-issue consent) and exports (backup and complete-archive exports, erasure journal, approved billing exports, report CSV/PDF, invoice PDFs, the MFA enrollment report) require a separate fresh second-factor confirmation valid five minutes in that session, from installation and whether or not scopes are configured; restores and imports are not exports is not traced for every listed outcome in docs/contract/DONE-AUDIT.md. |
| `ACCESS-003` | Enterprise identity lifecycle | target | partial | `tests/blotter/enterprise.test.mjs` — “Enterprise lifecycle maps invited staff, enforces tenant and MFA, revokes live access and restores inactive” (public connection and principal-step-up refusal; explicit invited-user association; mapped roles and client teams; signed OIDC sign-in, wrong tenant, absent MFA, unknown subject and replay refusal; membership changes and deprovisioning deny current browser and API calls and prior agent keys; native owner recovery; attributed provisioning and sign-in; inactive portable mappings, excluded token and digest; erasure and stale-restore refusal). `tests/blotter/enterprise-ui.mjs` — enterpriseJourney (map, disconnect and erase through the built page, sign-in entry and desktop and phone end states; invoked unconditionally by the integration journey in push Verify). `tests/blotter/enterprise-live.mjs` (separately invoked held-key client-credential connection, live organization read, provisioning-token revocation, native owner recovery and erasure; interactive user sign-in and provider-driven provisioning are explicitly excluded). `docs/enterprise-identity.md` (configuration, documented provider shapes and authority exclusions). | Live interactive Entra user sign-in and Entra-driven group membership and deprovisioning are unproved: an authorized interactive sandbox user and configured provider provisioning administration are required. The held tenant has no assigned licenses or groups, and the app-only provisioning-jobs read returns 401; no mailbox or SharePoint site is needed by this clause. Approval of the adopted authority default by ct is pending. No DONE credit is claimed from documented provider shapes. |
| `ACCESS-008` | Enterprise outage refusal and native recovery | target | partial | `tests/blotter/enterprise.test.mjs` — “Enterprise lifecycle maps invited staff, enforces tenant and MFA, revokes live access and restores inactive” (public connection and principal-step-up refusal; explicit invited-user association; mapped roles and client teams; signed OIDC sign-in, wrong tenant, absent MFA, unknown subject and replay refusal; membership changes and deprovisioning deny current browser and API calls and prior agent keys; native owner recovery; attributed provisioning and sign-in; inactive portable mappings, excluded token and digest; erasure and stale-restore refusal). `tests/blotter/enterprise-ui.mjs` — enterpriseJourney (map, disconnect and erase through the built page, sign-in entry and desktop and phone end states; invoked unconditionally by the integration journey in push Verify). `tests/blotter/enterprise-live.mjs` (separately invoked held-key client-credential connection, live organization read, provisioning-token revocation, native owner recovery and erasure; interactive user sign-in and provider-driven provisioning are explicitly excluded). `docs/enterprise-identity.md` (configuration, documented provider shapes and authority exclusions). | Live interactive Entra user sign-in and Entra-driven group membership and deprovisioning are unproved: an authorized interactive sandbox user and configured provider provisioning administration are required. The held tenant has no assigned licenses or groups, and the app-only provisioning-jobs read returns 401; no mailbox or SharePoint site is needed by this clause. Approval of the adopted authority default by ct is pending. No DONE credit is claimed from documented provider shapes. |
| `ACCESS-004` | Enforced staff multi factor authentication | target | partial | `src/blotter/mfa.ts`; `src/blotter/webauthn.ts`; `src/blotter/session.ts`; `migrations/core/0024_mfa.sql`; `src/ui/security.tsx`; `tests/blotter/flows.test.mjs` | Old evidence exercises this workflow; complete proof of Enable the firm MFA policy is not traced for every listed outcome in docs/contract/DONE-AUDIT.md. |
| `ACCESS-005` | Google Workspace and Microsoft 365 staff sign in | target | missing |  | No Google or Microsoft staff sign-in, domain/tenant restriction or identity revalidation exists. |
| `ACCESS-006` | Staff offboarding and ownership transfer | target | partial | `src/blotter/offboarding.ts`; `src/blotter/team.ts`; `src/ui/offboarding.tsx`; `tests/blotter/flows.test.mjs` | Old evidence exercises this workflow; complete proof of Give a preparer clients, open work, a scheduled reminder sequence, a pending signature request and a connected mailbox is not traced for every listed outcome in docs/contract/DONE-AUDIT.md. |
| `ACCESS-009` | Atomic staff successor transfer | target | partial | `src/blotter/offboarding.ts`; `src/blotter/team.ts`; `src/ui/offboarding.tsx`; `tests/blotter/flows.test.mjs` | Old evidence exercises this workflow; complete proof of One batch, matching the preview exactly and refused while any job or rule would make someone review their own work, moves all of it, discards the running timer (nothing recorded; its start is kept in the audit), submits their unsubmitted time for approval on their behalf (returned entries never bill; the principal deletes them before closing their period), and deactivates them is not traced for every listed outcome in docs/contract/DONE-AUDIT.md. |
| `SECURE-001` | Security program and attestation | target | partial | `src/blotter/security-logs.ts`; `src/ui/security.tsx`; `API.md`; `tests/blotter/security-logs.test.mjs` — “Recorded access-log export selects exact UTC instants across DST” (actual staff, contact-portal and bearer HTTP downloads, exact UTC selection and exclusion, safe fields, spreadsheet escaping, unchanged sources and attributed export); “Access-log export requires the live principal” (role, delegated authority, agent, deactivated, MFA and per-session step-up refusals); “Current access logs remain portable” (safe projection, snapshotted CSV membership through empty export, later download and second export, unchanged copy inventory after restore, archive equality, excluded live authority and stale-restore fencing); `tests/blotter/security-logs-ui.mjs` / securityLogsJourney (Sign-in security CSV download, date boundaries, coverage and unverified identity disclosure, existing icon tooltips, 1440 and 390 screens). | Native recorded document-download log export only: successful staff, contact-portal and bearer events, principal-only with fresh step-up; bearer identity remains unverified and coverage is explicitly incomplete. Missing: security overview; authorized auditor or attestation-provider account or NDA report access supplying a genuine current SOC 2 Type II report, bridge letter and penetration-test summary; attestation-package request and download with current-period verification; enabled-integration subprocessor list; data-flow description; SIG Lite or CAIQ questionnaire; documented WISP and FTC controls covering encryption, US residency, access logging, tested backups and restores, vulnerability management and incident response with 72-hour customer notification; WISP template mapped to IRS Publications 4557 and 5708. No certification or provider evidence is claimed. |
| `VAULT-001` | Client credential vault | target | partial | `src/blotter/vault.ts`; `src/blotter/mfa.ts`; `src/blotter/archive-policy.mjs`; `migrations/core/0067_vault.sql`; `src/ui/vault.tsx`; `tests/blotter/vault.test.mjs` | Old evidence exercises this workflow; complete proof of A client adds a state sales-tax portal login through the portal is not traced for every listed outcome in docs/contract/DONE-AUDIT.md. |
| `AGENT-001` | Agent preparations and company policy | target | partial | `src/blotter/proposals.ts`; `src/blotter/team.ts`; `tests/blotter/flows.test.mjs` | Old evidence asserts reversible proposal decisions and result attribution; it does not assert the declined proposal’s reason is read back. |
| `ARCHIVE-001` | Whole practice portability and restore | target | partial | `src/blotter/archive.ts`; `src/blotter/archive-policy.mjs`; `tests/blotter/flows.test.mjs` | Old evidence exercises this workflow; complete proof of Export via the owner HTTP door, reject a damaged archive and a nonempty restore, restore the intact archive into an empty installation and export again is not traced for every listed outcome in docs/contract/DONE-AUDIT.md. |
| `ARCHIVE-002` | Complete target data portability | target | partial | `src/blotter/archive-transfers.ts`; `src/blotter/archive-policy.mjs`; `src/blotter/recurrence.ts`; `src/ui/archive-transfers.tsx`; `tests/blotter/archive-transfers.test.mjs` (named ARCHIVE-002/BASE-001 journeys) | Old evidence exercises this workflow; complete proof of Export a multi-year firm with connected history, interrupt/resume the operation and restore to an empty destination is not traced for every listed outcome in docs/contract/DONE-AUDIT.md. |
| `ARCHIVE-003` | Inactive restore and retained consent history | target | partial | `src/blotter/archive-transfers.ts`; `src/blotter/archive-policy.mjs`; `src/blotter/recurrence.ts`; `src/ui/archive-transfers.tsx`; `tests/blotter/archive-transfers.test.mjs` (named ARCHIVE-002/BASE-001 journeys) | Old evidence exercises this workflow; complete proof of Restored external references remain history, with configuration and provider credentials re-entered separately is not traced for every listed outcome in docs/contract/DONE-AUDIT.md. |
| `ERASURE-001` | File erasure and stale archive fencing | target | partial | `src/blotter/archive.ts`; `tests/blotter/flows.test.mjs` | Old evidence exercises this workflow; complete proof of Export, erase a file through the owner door, refuse later downloads and inspect a new archive without the bytes is not traced for every listed outcome in docs/contract/DONE-AUDIT.md. |
| `ERASURE-002` | Retention legal hold and target erasure | target | partial | `src/blotter/erasure-registry.ts`; `src/blotter/retention-clock.ts`; `src/blotter/client-retention.ts`; `src/blotter/erasure-plan.ts`; `src/blotter/erasure-scope.ts`; `src/blotter/client-erasure.ts`; `src/blotter/erasure-expiry.ts`; `src/blotter/erasure-copies.ts`; `src/blotter/erasure-restore.ts`; `src/blotter/engagements.ts`; `src/blotter/retained-records.ts`; `src/ui/retention.tsx`; `src/ui/client-retention.tsx`; `src/ui/client-erasure.tsx`; `migrations/core/0083_client_erasure.sql`; `migrations/core/0084_erasure_policy.sql`; `tests/blotter/erasure-policy.test.mjs`; `tests/blotter/erasure-ui.mjs`; `tests/blotter/erasure-fixture.mjs`; `tests/blotter/archive-transfers.test.mjs`; `src/blotter/marketing-suppression.ts`; `tests/blotter/import-mapping.test.mjs` ("an erasure between import chunks": atomic resumed-grant refusal, latest repeated-erasure cutoff and portable suppression); `tests/blotter/integration-keys.test.mjs` ("API-002 / ERASURE-002 key scopes"); `tests/blotter/integration-webhooks.test.mjs` ("API-002 / BASE-001 thin signed completion webhooks": scope removal, final-client suspension, cancelled notices and stale-restore refusal) | Landed (sx-blotter-c34 and c35): principal-only doors; typed class registry failing closed; per-class clocks over whole-year periods in the firm's timezone with the warning and SIGN-001 floor; extend-only retain-until; scoped holds with owner and review date refusing ERASURE-001, PORTAL-004 and VAULT-001; open-work refusals; digest-bound preview of every class, approval and one atomic erasure with marker redaction, derived data deleted, signed-off work, engagements and snapshotted billing kept; random labels and the sealed remainder behind the audited retained-records door; Ready to erase confirmation and changed-period recompute; observed and principal-recorded outside copies; hashed withdrawn-address suppression honoured by the mapped import; merged clients; practitioner-recorded signed engagement; deletion-request record; journal export, stale restore refused with the newer journal and the fresh-destination acknowledgment. Not yet to ct's 22 Oct ruling: redaction of the subject's rows in retained import originals through Base's import erasure, with their undo refused; contact-only and prospect-only subjects (only a whole client is erased); the registry is read by preview and erasure but not yet by export and restore; open-balance refusal (BILL-002); IRS e-file authorizations and signed documents have no records until SIGN-001 and SIGN-002 ship; the sign-off note on a signed-off job stays after expiry because sign-off is immutable. |
| `AUDIT-001` | Durable action attribution | target | partial | `src/blotter/model.ts`; `src/blotter/team.ts`; `src/blotter/archive.ts`; `tests/blotter/flows.test.mjs` | Old evidence exercises this workflow; complete proof of Create and review work, approve a proposal/export and erase a file through public doors is not traced for every listed outcome in docs/contract/DONE-AUDIT.md. |
| `BASE-001` | Maintained Base foundations and product replacements | target | partial | `src/auth.server.ts`; `src/blotter/model.ts`; `src/blotter/imports.ts`; `src/blotter/archive.ts`; `tests/blotter/flows.test.mjs`; `tests/blotter/import-mapping.test.mjs`; `tests/blotter/contacts.test.mjs`; `tests/blotter/document-sharing.test.mjs`; `tests/blotter/intake.test.mjs` (named BASE-001 journeys) | Old evidence exercises this workflow; complete proof of Use native sign-in, import a client list, collect a file, review work, approve a billing export and archive/erase/restore through public doors is not traced for every listed outcome in docs/contract/DONE-AUDIT.md. |
| `COST-001` | Predictable USD service and usage costs | target | partial | `src/blotter/costs.ts`; `src/ui/service-costs.tsx`; `tests/blotter/service-agents.test.mjs` — "sourced USD seasonal estimates" (every listed service, included quantities, payment rounding and missing-price refusal); "budget exception notifies its owner" (block, notice, approved increase, once-only usage/plan and reconciliation); "archives retain plans and costs" (inactive restore and erasure fence); "operator estimates and supervised-agent screens" (1440/390, tooltips) | Sourced USD estimates, quote history, principal-approved lifetime/per-action budgets, owned exceptions, native-plan reservations, explicit reconciliation and usage export exist. Full enabled-service/provider reconciliation remains unproved: SIGN-001 KBA, SMS-001 sender and PAY-001 ACH/card capabilities are unavailable; AI inference is not activated. No provider charges are fabricated. |
| `AI-001` | Source linked summaries and reply drafts | target | partial | `tests/blotter/ai.test.mjs`: “AI assistance requires owner enablement, an authorized explicit click and masked selected source, retaining metadata and only human-saved output” (source-linked summary, conflicts, questions, edited or rejected reply, selected-source exclusions, refusal, masking and audit); “Revoking firm enablement during a provider request discards its result and retains one attributed failed attempt without retry” (revocation); “AI drafts travel with attributed history, restore disabled, honor holds and erasure, and fence stale restores” (BASE-001 and ERASURE-002); “Staff AI settings, selected-source proposals, saved decisions and portal disclosure work at desktop and phone widths” (1440 and 390, disclosure and tooltips).  `tests/blotter/ai-live.mjs`, summary slice (26 Oct 2026, request req_a8246a1ac5b547d0b244f7dba20a60ac): masked explicit-click request, disabled and missing-click refusals, both conflicting amounts, one audit row, no saved output and no send passed. | MAIL-001 real Google and Microsoft mailbox grants and ENGAGE-001 signed-scope links remain unavailable. Acceptance records review and never sends a message. |
| `AI-002` | Document validation naming and routing | target | partial | `tests/blotter/ai.test.mjs`: “Document proposals require individual review, retain the source, copy only to an authorized same-job request and name unreadable sources” (wrong period, unreadable scan, correct invoice with embedded instructions, sourced extraction, thresholds, independent decisions, original bytes and authorized copies); “AI assistance requires owner enablement, an authorized explicit click and masked selected source, retaining metadata and only human-saved output” (shared processing boundary); “Revoking firm enablement during a provider request discards its result and retains one attributed failed attempt without retry”; “AI drafts travel with attributed history, restore disabled, honor holds and erasure, and fence stale restores” (inherited gates); “Staff AI settings, selected-source proposals, saved decisions and portal disclosure work at desktop and phone widths” (1440 and 390, original and copy download, disclosure and tooltips).  `tests/blotter/ai-live.mjs`, document slice (26 Oct 2026, request req_e34668161da74f0fb582f132281b90da): real OpenAI response passed native source-quote validation, validation and filename proposals, and literal client and period extraction assertions; masked payload and disabled or missing-click refusals captured. This slice passed before the separate notice assertion failed; it does not claim a passing three-task run. | Old evidence exercises this workflow; complete proof of Upload a wrong-period statement, illegible scan and correct invoice with misleading embedded instructions is not traced for every listed outcome in docs/contract/DONE-AUDIT.md. |
| `AI-003` | Client scoped scheduled agents | target | partial | `src/blotter/scheduled-agents.ts`; `src/blotter/scheduled-agent-gate.ts`; `src/blotter/clients.ts`; `src/ui/proposals.tsx`; `tests/blotter/service-agents.test.mjs` — “scoped file and scheduled plans” (principal-only grants, own key, client scope, configured six-hour slots across skipped intervals, granted roll-forward, legacy preparation and learning denial matrix with unchanged budgets and effects, plan budget, key revocation and retained attribution); “question and completed-task events” (both event doors, human-only effects, grant revocation and decision attribution); “budget exception notifies its owner” (service budget, owned refusal, once-only recovery and costs); “keyed external plans enforce client, tool, immutable replay, live revocation and human decisions” (positively readable document, discussion, vault and financial fixtures excluded beside allowed metadata, complete unverified provider declaration, later key and rule and plan reads without key disclosure, immutable external preparation, human refusal, grant and revocation audit actor and action and object and time); “archives retain plans and costs” (excluded keys, source-equal rules and runs and decisions and cost references with documented inactive transformations only, erased-source refusal and stale-restore fence); “client erasure revokes scheduled grants” (held-client scheduled grant revocation, derived-data redaction and attributed retained references); “Cron plans stop when MFA is required” (live supervisor factor); `tests/blotter/service-agents-ui.mjs` / serviceAgentsJourney (operator grant and human decision disclosures, creation-only key display across navigation and reload, source plans, costs, outcomes and icon tooltips at 1440 and 390) | Old evidence exercises this workflow; complete proof of Enable one client-scoped file-event agent and one scheduled agent, deliver duplicate events and inspect a single pending plan is not traced for every listed outcome in docs/contract/DONE-AUDIT.md. |
| `PORTAL-006` | Portal sign-in on the firm custom domain | target | missing |  | Owner firm domain and certificate required for live sign-in. |
| `NOTICE-002` | Notice response drafting through the mail and e-file path | target | missing |  | Mail and e-file response drafting path is unbuilt. |
| `READY-001` | Maintain engagement evidence and readiness | push-further | partial | `src/blotter/readiness.ts`; `src/blotter/jobs.ts`; `migrations/core/0074_readiness.sql`; `tests/blotter/readiness.test.mjs`; `tests/blotter/readiness-ui.mjs` (named READY-001 / BASE-001 journeys) | Native current/prior-period request/checklist-answer maps and source-linked human-approved question tracking exist. Signed-scope joining, QBO/Xero context, semantic conflict detection, ledger variance analysis and the full engagement-agent journey remain missing. |
| `READY-002` | Readiness source revisions and owned judgments | push-further | partial | `src/blotter/readiness.ts`; `src/blotter/jobs.ts`; `migrations/core/0074_readiness.sql`; `tests/blotter/readiness.test.mjs`; `tests/blotter/readiness-ui.mjs` (named READY-001 / BASE-001 journeys) | Native current/prior-period request/checklist-answer maps and source-linked human-approved question tracking exist. Signed-scope joining, QBO/Xero context, semantic conflict detection, ledger variance analysis and the full engagement-agent journey remain missing. |
| `RESCUE-001` | Coordinate a deadline rescue | push-further | partial | `src/blotter/jobs.ts`; `src/blotter/proposals.ts`; `tests/blotter/flows.test.mjs` | Human-entered sourced dates and approved roll-forward/reminder proposals exist; LEDGER-001 ledger readiness and US obligation/capacity/rescue-plan coordination are missing. Practitioner-linked readiness evidence is context only (ct 20 Oct 09:58Z). |
| `LEARN-001` | Improve recurring work from review findings | push-further | partial | `src/blotter/learning.ts`; `src/blotter/learning-evidence.ts`; `tests/blotter/learning.test.mjs` (named LEARN-001 / BASE-001 public-door journey) | Old evidence exercises this workflow; complete proof of Complete two periods with a repeated reviewer correction, inspect a proposed template/request change with source examples and approve it for selected clients is not traced for every listed outcome in docs/contract/DONE-AUDIT.md. |
| `REVENUE-001` | Close billing leakage and reconciliation exceptions | push-further | partial | `tests/blotter/billing-analysis.test.mjs` (“REVENUE-001 / BASE-001: cited scope leakage and duplicate correction, declined amendment and confirmed ACH return retain owned open balances without charging or write-off”): `tests/blotter/revenue-proof.mjs` / assertRevenueFlow proves exact signed-scope quotes and source links, unbilled out-of-scope time and cited suspected duplicate, amendment amount and wording, principal-only preparation, once-only approved draft correction with source rebilling refused and declined amendment, confirmed pending then settled then returned ACH, duplicate signed-event replay, unchanged charge count, exact open balance, credits and write-offs, invoice owner and due condition; `tests/blotter/revenue-custody.mjs` / assertRevenueCustody proves inert approved amendment review, stale approval refusal, exact portable decisions, held restore, attribution, retention hold and removed-source refusal; assertRevenueErasure proves preview, actual derived-draft erasure and stale-restore fencing; `tests/blotter/revenue-ui.mjs` / revenueJourney runs in that same push journey and proves the revenue screen, reconciliation, approved and declined end states, no overflow and keyboard and delayed-hover tooltips at 1440 and 390. `tests/blotter/revenue-proof.mjs` / assertRevenueFlow additionally asserts changed accepted scope removes the outside-scope finding; generated retainer drafts remove only their period discrepancy; effective accepted price amendments change the compared amount; equal-gross duplicates with different subtotal, tax and applied-credit splits are found while a different gross is excluded; recorded firm-accounting gross, net receipts, applied credits and write-offs disagree and reconcile under one native invoice authority; uncertain collections retain owner, due condition and safe next action. `tests/blotter/revenue-custody.mjs` / assertRevenueCustody additionally asserts unchanged signed-source bytes and all fee-entitlement records, each decision audit row bound to its expected actor, action, client, proposal, reason and bounded timestamp, live principal revocation on reads, preparation and both decisions, and exact accounting archive history. Its assertRevenueErasure asserts billing holds preserve accounting evidence and actual erasure redacts source references while retaining financial facts and attribution, with the newer-journal fence. `tests/blotter/revenue-ui.mjs` / revenueJourney asserts the displayed source digest independently from the original signed bytes. Taxable retainer gross before generation, removal after generation and restoration after voiding; a settled collection with independently asserted recorded and native receipts of 10,000 cents and no differences; attributed once-only preparation and accounting audit events, including actor, action, client, exact detail and bounded time, with replay adding none, are asserted by `tests/blotter/revenue-proof.mjs` / assertRevenueFlow and assertRevenueAudit and `tests/blotter/revenue-custody.mjs` / assertRevenueCustody and assertRevenueErasure. The same journey preserves closed approved source time, refuses correction of an issued duplicate, matches nonzero applied credits and write-offs, and refuses both accounting doors after principal revocation. Archived clients refuse both new accounting observations and exact replay; amendment decisions preserve invoice authority and provider charge counts. | Old evidence exercises this workflow; complete proof of Introduce unbilled out-of-scope work, a duplicate invoice and an ACH return is not traced for every listed outcome in docs/contract/DONE-AUDIT.md. |
| `ONBOARD-001` | Run new client onboarding to readiness | push-further | partial | `src/blotter/onboarding.ts`; `src/ui/onboarding.tsx`; `migrations/core/0100_onboarding_plans.sql`; `tests/blotter/onboarding-ui.mjs` (onboardingJourney and onboardingAccessJourney: scope links, item removal, retained review and observation history, principal-only access, erased-source refusal and inactive held restore; invoked by the intake journey in push Verify); `tests/blotter/intake.test.mjs` (“ONBOARD-001 native signed-scope setup preview: exact source links, no effects, principal authority and unavailable-source refusal”: signed-source quotes and links, template cadence, selected-item removal and replay; principal review succeeds beside non-principal review denial; observations retain actor and time and immutable superseded history; review leaves mail, work, fees and signatures unchanged; a held-client restore returns the review held and refuses progress or review replay; each review decision has exactly one attributed audit entry; derived-plan erasure) | Native principal-only signed-text scope mapping, template setup preview, once-only item selection and practitioner-recorded owned observations are available from the client details screen. Missing: ENGAGE-001 proposal and signed-scope lifecycle, agent preparation under explicit grants and budgets, partner review beyond the principal, approved invitation and request dispatch, client and provider response ingestion, automatic targeted chases and blocker escalation, and complete setup execution. QBO and Xero connections require LEDGER-001; outbound mail requires MAIL-001. Adopted conservative default: principal-only review and observations, no outbound or account action; ct approved this subset on 25 October 2026 at 17:55Z. Restored reviews stay held; merged-client review migration is not implemented. |
| `ONBOARD-002` | Reviewed onboarding custody and held recovery | push-further | partial | `src/blotter/onboarding.ts`; `src/ui/onboarding.tsx`; `migrations/core/0100_onboarding_plans.sql`; `tests/blotter/onboarding-ui.mjs` (onboardingJourney and onboardingAccessJourney: scope links, item removal, retained review and observation history, principal-only access, erased-source refusal and inactive held restore; invoked by the intake journey in push Verify); `tests/blotter/intake.test.mjs` (“ONBOARD-001 native signed-scope setup preview: exact source links, no effects, principal authority and unavailable-source refusal”: signed-source quotes and links, template cadence, selected-item removal and replay; principal review succeeds beside non-principal review denial; observations retain actor and time and immutable superseded history; review leaves mail, work, fees and signatures unchanged; a held-client restore returns the review held and refuses progress or review replay; each review decision has exactly one attributed audit entry; derived-plan erasure) | Native principal-only signed-text scope mapping, template setup preview, once-only item selection and practitioner-recorded owned observations are available from the client details screen. Missing: ENGAGE-001 proposal and signed-scope lifecycle, agent preparation under explicit grants and budgets, partner review beyond the principal, approved invitation and request dispatch, client and provider response ingestion, automatic targeted chases and blocker escalation, and complete setup execution. QBO and Xero connections require LEDGER-001; outbound mail requires MAIL-001. Adopted conservative default: principal-only review and observations, no outbound or account action; ct approved this subset on 25 October 2026 at 17:55Z. Restored reviews stay held; merged-client review migration is not implemented. |
| `SWITCH-001` | Plan and reconcile the switch from an incumbent | push-further | missing |  | No migration-mapping agent, automation rewrite or reconciliation report exists. |
| `NOTICE-001` | Read notices and propose the response plan | push-further | partial | `tests/blotter/ai.test.mjs`: “Notice reading is practitioner-only, quotes each extracted value, records question choices and never changes deadlines or sends” (CP2000 extraction and source quotes, draft authority excluded from context, independent question and plan decisions, person-only deadline override with attributed practitioner adoption, no model action); “AI assistance requires owner enablement, an authorized explicit click and masked selected source, retaining metadata and only human-saved output”; “Revoking firm enablement during a provider request discards its result and retains one attributed failed attempt without retry”; “AI drafts travel with attributed history, restore disabled, honor holds and erasure, and fence stale restores” (shared and inherited gates); “Staff AI settings, selected-source proposals, saved decisions and portal disclosure work at desktop and phone widths” (1440 and 390, proposed warnings, accepted and rejected questions, disclosure and tooltips); `tests/blotter/ai-live.mjs` (notice-only provider journey, 26 October 2026, HTTP 200 req_dbfe06db62f84d0aae6e9bb21fa0fdde: exact CP2000, period, amount and deadline with literal source quotes, masked payload, disabled and missing-click refusal, one attributed attempt, no saved output or send). | IRS transcript context and wage-and-income comparison require authorized RESOLVE-001 and INTEGRATE-006. NOTICE-002 retains the separate mail and e-file response path. |
| `NOTICE-003` | Practitioner adoption of quoted notice facts | push-further | partial | `tests/blotter/ai.test.mjs`: “Notice reading is practitioner-only, quotes each extracted value, records question choices and never changes deadlines or sends” (CP2000 extraction and source quotes, draft authority excluded from context, independent question and plan decisions, person-only deadline override with attributed practitioner adoption, no model action); “AI assistance requires owner enablement, an authorized explicit click and masked selected source, retaining metadata and only human-saved output”; “Revoking firm enablement during a provider request discards its result and retains one attributed failed attempt without retry”; “AI drafts travel with attributed history, restore disabled, honor holds and erasure, and fence stale restores” (shared and inherited gates); “Staff AI settings, selected-source proposals, saved decisions and portal disclosure work at desktop and phone widths” (1440 and 390, proposed warnings, accepted and rejected questions, disclosure and tooltips); `tests/blotter/ai-live.mjs` (notice-only provider journey, 26 October 2026, HTTP 200 req_dbfe06db62f84d0aae6e9bb21fa0fdde: exact CP2000, period, amount and deadline with literal source quotes, masked payload, disabled and missing-click refusal, one attributed attempt, no saved output or send). | IRS transcript context and wage-and-income comparison require authorized RESOLVE-001 and INTEGRATE-006. NOTICE-002 retains the separate mail and e-file response path. |
| `SURFACE-001` | Practice job registry | target | missing |  | No Base-conformant Blotter MCP registry and policy-matrix journey proves this delta. |
| `SURFACE-002` | Engagement records and change handoffs | target | missing |  | No Base-conformant Blotter MCP registry and policy-matrix journey proves this delta. |
| `SURFACE-003` | Internal and outside practice calls | target | missing |  | No Base-conformant Blotter MCP registry and policy-matrix journey proves this delta. |
| `SURFACE-004` | Invoice and relied-on decisions | target | missing |  | No Base-conformant Blotter MCP registry and policy-matrix journey proves this delta. |
| `SURFACE-005` | Provider setup and retained person steps | target | missing |  | No Base-conformant Blotter MCP registry and policy-matrix journey proves this delta. |
| `SURFACE-006` | Practice authority and security changes | target | missing |  | No Base-conformant Blotter MCP registry and policy-matrix journey proves this delta. |
| `SURFACE-007` | Irreversible and sensitive practice work | target | missing |  | No Base-conformant Blotter MCP registry and policy-matrix journey proves this delta. |
| `SURFACE-008` | Changes to running practice services | target | missing |  | No Base-conformant Blotter MCP registry and policy-matrix journey proves this delta. |
| `SURFACE-009` | Source-linked readiness and rescue | target | missing |  | No Base-conformant Blotter MCP registry and policy-matrix journey proves this delta. |
| `SURFACE-010` | Practice billing and onboarding handoffs | target | missing |  | No Base-conformant Blotter MCP registry and policy-matrix journey proves this delta. |
| `SURFACE-011` | Practice policy questions and capacity | target | missing |  | No Base-conformant Blotter MCP registry and policy-matrix journey proves this delta. |
| `SURFACE-012` | Practice agent documentation | target | missing |  | No Base-conformant Blotter MCP registry and policy-matrix journey proves this delta. |
| `SURFACE-013` | A seeded practice week under two policies | target | missing |  | No Base-conformant Blotter MCP registry and policy-matrix journey proves this delta. |
