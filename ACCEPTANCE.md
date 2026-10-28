<!-- Generated from CONTRACT.md by contract-docs. Edit CONTRACT.md, then regenerate. -->

# Accept a Blotter product installation

The primary journey: configure the firm, sign scope, schedule recurring work, collect evidence, review it, invoice and reconcile payment.

## Progress

| Tier | Done | Partial | Missing | Total |
| --- | ---: | ---: | ---: | ---: |
| Core | 1 | 311 | 76 | 388 |
| Agent surface | 0 | 0 | 6 | 6 |
| Later | 0 | 0 | 0 | 0 |
| Full target | 1 | 311 | 82 | 394 |

Judged from the code and tests at commit `288174d52e6669fd343d2a249f440cb2a44f2a88` (27 October 2026). Field proof register: 11 rows; 0 passed, 0 failed, 11 not run.

## Core

### Work deadlines and team delivery

#### WORK-002 — Automatic recurring work and roll forward

Core · published · **partial** · Cites BASE-AUDIT-001 · Rules D-1

**Requirement.** Approved recurrence rules create the next period automatically with assigned staff, fresh requests, dependencies, budget and calculated due dates. Support monthly closes, quarterly payroll/sales tax, annual returns and custom schedules, including fiscal-year ends. Each rule has a creation lead time (how far ahead of a period's start its work is created, set by the firm, for example three months as in Karbon) and an end date. A rule may already hold future periods, whether it generated them or a migration imported and claimed them (MIGRATE-006); a period the rule already holds is never generated again, and the next generated period follows the last held one without a gap. Preview the schedule, pause/skip a period and catch up after downtime without duplicate client-period engagements; historical sign-offs remain immutable. Mechanism: [details](docs/contract/mechanism.md).

**Acceptance.**
1. Enable monthly and fiscal-year recurrence with a three-month lead time, let scheduled work become due and inspect exactly the periods inside the lead time, each once, with fresh requests.
2. Attach two existing future jobs to a monthly rule and advance the horizon; the rule creates only the following period.
3. Restart the scheduler, pause a client, skip a period and override a due date; no duplicate or silently altered prior job appears.

**Evidence.** `src/blotter/recurrence.ts`; `src/blotter/jobs.ts`; `src/server.ts`; `wrangler.jsonc`; `migrations/core/0028_recurrence.sql`; `src/ui/recurrence.tsx`; `tests/blotter/flows.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Restart the scheduler; skip a period; override a due date; no duplicate or silently altered prior job appears.

#### WORK-010 — principal or reviewer approves one rule per

Core · published · **partial** · From WORK-002 · Rules D-1

**Requirement.** Provide a principal or reviewer approves one rule per. Mechanism: [details](docs/contract/mechanism.md).

**Acceptance.**
1. A principal or reviewer approves one rule per client and template; approving it is the approval.
2. Periods start on the first period's day in the chosen months, which are the template's own monthly, quarterly or annual cadence or a subset of it (custom schedules); a fiscal year is an annual first period in its first month.
3. The end date is the last period's start, inclusive.
4. Its due date is the period's last day plus the rule's calendar days (a firm rule), or, when the rule names a client obligation, that obligation's calculated working due date for the period (DUE-001, DUE-003), shown in the rule's preview and stored with each job it creates.
5. Budget is the rule's time budget in minutes, copied to each job; staff, fresh document requests and the template's task dependencies (WORK-003) come with each job.
6. A job that already exists for the client, template and period is claimed instead of duplicated; staff may also claim one, and imported future items (MIGRATE-006) must be claimed the same way before that clause ships.
7. Skipping needs a reason.

**Evidence.** `src/blotter/recurrence.ts`; `src/blotter/jobs.ts`; `src/server.ts`; `wrangler.jsonc`; `migrations/core/0028_recurrence.sql`; `src/ui/recurrence.tsx`; `tests/blotter/flows.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: A principal or reviewer approves one rule per client; template; approving it is the approval; Periods start on the first period's day in the chosen months; which are the template's own monthly; quarterly or annual cadence or a subset of it (custom schedules); a fiscal year is an annual first period in its first month; The end date is the last period's start; inclusive; Its due date is the period's last day plus the rule's calendar days (a firm rule); or; when the rule names a client obligation; that obligation's calculated working due date for the period (DUE-001; DUE-003); shown in the rule's preview; stored with each job it creates; Budget is the rule's time budget in minutes; copied to each job; staff; fresh document requests; the template's task dependencies (WORK-003) come with each job; A job that already exists for the client; period is claimed instead of duplicated; staff may also claim one; and imported future items (MIGRATE-006) must be claimed the same way before that clause ships; Skipping needs a reason.

#### WORK-011 — rule whose people can no longer do

Core · published · **partial** · From WORK-002 · Rules D-1

**Requirement.** Provide a rule whose people can no longer do. Mechanism: [details](docs/contract/mechanism.md).

**Acceptance.**
1. A rule whose people can no longer do the work is held and named in the run log, never reassigned.
2. Created jobs are never changed by a rule: a person overrides a due date on the job, and sign-offs stay immutable.

**Evidence.** `src/blotter/recurrence.ts`; `src/blotter/jobs.ts`; `src/server.ts`; `wrangler.jsonc`; `migrations/core/0028_recurrence.sql`; `src/ui/recurrence.tsx`; `tests/blotter/flows.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: A rule whose people can no longer do the work is held; named in the run log; never reassigned; Created jobs are never changed by a rule: a person overrides a due date on the job; and sign-offs stay immutable.

### Client communication portal and documents

#### PORTAL-001 — Private document requests and uploads

Core · published · **partial** · Cites BASE-INPUT-003, BASE-ROLE-001 · Rules D-1

**Requirement.** Staff send outstanding document requests using a private expiring upload link. The client can upload files without an account; staff download, accept or return them with a precise note. Link rotation revokes its predecessor, job completion closes collection, raw link secrets are not retained and upload limits are explicit. Firm-defined request wording uses MSG-001 templates.

**Acceptance.**
1. Send a request, rotate its link, refuse the old link and cross-origin upload, upload within the displayed limit and reject an oversized file.
2. Download and accept the files, sign off the job and verify collection closes.

**Evidence.** `src/blotter/documents.ts`; `src/ui/portal.tsx`; `tests/blotter/flows.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Send a request; rotate its link; cross-origin upload; upload within the displayed limit; Download; accept the files; sign off the job; verify collection closes.

#### PORTAL-007 — Msg-002 marketing consent

Core · published · **partial** · From PORTAL-001 · Cites BASE-INPUT-003 · Rules D-1

**Requirement.** Provide msg-002 marketing consent.

**Acceptance.**
1. Upload links never carry marketing.

**Evidence.** `src/blotter/documents.ts`; `src/ui/portal.tsx`; `tests/blotter/flows.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Upload links never carry marketing.

### Review ledger context and capacity

#### REVIEW-001 — Independent reviewer sign off

Core · published · **partial** · Cites BASE-ROLE-001 · Rules D-1

**Requirement.** The preparer completes all checklist and accepted-document gates, submits to the assigned reviewer and receives approval or a recorded request for change. Sign-off requires a note, rejects preparer self-review, records who and when, closes collection and prevents later checklist edits to signed-off evidence.

**Acceptance.**
1. Attempt premature submission, complete the evidence and submit.
2. Refuse preparer sign-off, approve as the assigned reviewer with a note, inspect identity/time and verify the closed portal and blocked signed-off checklist edits.

**Evidence.** `src/blotter/jobs.ts`; `src/blotter/documents.ts`; `tests/blotter/flows.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Attempt premature submission; complete the evidence; submit; Refuse preparer sign-off; approve as the assigned reviewer with a note; inspect identity/time; verify the closed portal; blocked signed-off checklist edits.

#### REVIEW-002 — Erasure-002

Core · published · **partial** · From REVIEW-001 · Cites BASE-AUDIT-001, BASE-DATA-006 · Rules D-1

**Requirement.** Provide erasure-002.

**Acceptance.**
1. Sign-offs stay immutable; ERASURE-002 retains signed-off work under its class and removes it only on confirmed expiry, keeping sign-off attribution.

**Evidence.** `src/blotter/jobs.ts`; `src/blotter/documents.ts`; `tests/blotter/flows.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Sign-offs stay immutable; ERASURE-002 retains signed-off work under its class; removes it only on confirmed expiry; keeping sign-off attribution.

### US practice and client engagements

#### US-001 — US firm setup and currency

Core · target · **partial** · Cites BASE-AUDIT-001, BASE-MAIL-001 · Rules D-1

**Requirement.** A US principal configures a firm in USD with US addresses, EIN/entity classifications, fiscal years, service lines, time zones and notification hours. Money uses integer cents and explicit currency; US 1099/W-2, federal/state tax and sales-tax engagements have appropriate terminology. Historical AUD records retain their currency and are never relabeled USD.

**Acceptance.**
1. Set up a US bookkeeping and tax practice, add an LLC and individual client, select USD and America/New_York, and create payroll, sales-tax and annual-tax work.
2. Inspect currency and dates across a daylight-saving change; imported AUD history remains AUD.

**Evidence.** `src/blotter/firm.ts`; `src/blotter/clients.ts`; `src/blotter/billing.ts`; `src/blotter/notifications.ts`; `src/ui/firm.tsx`; `src/ui/common.tsx`; `migrations/core/0047_firm_settings.sql`; `tests/blotter/us.test.mjs`; `tests/blotter/demo.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Set up a US bookkeeping; tax practice; add an LLC; individual client; select USD; America/New_York; and create payroll; sales-tax; annual-tax work; Inspect currency; dates across a daylight-saving change; imported AUD history remains AUD.

#### US-002 — Currency and identifiers

Core · target · **partial** · From US-001 · Cites BASE-AUDIT-001, BASE-DATA-001, BASE-ROLE-001 · Rules D-1

**Requirement.** Provide currency and identifiers.

**Acceptance.**
1. New templates, rates and native prospects default to USD; each stored fee, time entry and expense carries its currency.
2. Existing money rows and historical export snapshots remain AUD, with no conversion or relabeling.
3. Jobs inherit their template currency, time requires a rate in that currency, mixed-currency exports are refused, and WIP, reimbursement and pipeline fee totals are grouped by currency.
4. New client EINs accept nine digits; eleven-digit ABNs remain legacy ABNs.
5. Native and CSV inputs retain that distinction, and search keeps SEARCH-001 role restrictions and last-four masking.
6. The demo uses US filings and America/New_York office instants, using each date’s daylight-saving offset.

**Evidence.** `src/blotter/firm.ts`; `src/blotter/clients.ts`; `src/blotter/billing.ts`; `src/blotter/notifications.ts`; `src/ui/firm.tsx`; `src/ui/common.tsx`; `migrations/core/0047_firm_settings.sql`; `tests/blotter/us.test.mjs`; `tests/blotter/demo.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: New templates; rates; native prospects default to USD; each stored fee; time entry; expense carries its currency; Existing money rows; historical export snapshots remain AUD; with no conversion or relabeling; Jobs inherit their template currency; time requires a rate in that currency; mixed-currency exports are refused; and WIP; reimbursement; pipeline fee totals are grouped by currency; New client EINs accept nine digits; eleven-digit ABNs remain legacy ABNs; Native; CSV inputs retain that distinction; and search keeps SEARCH-001 role restrictions; last-four masking; The demo uses US filings; America/New_York office instants; using each date’s daylight-saving offset.

#### US-003 — Firm settings

Core · target · **partial** · From US-001 · Cites BASE-AUDIT-001, BASE-DATA-001, BASE-MAIL-001 · Rules D-1

**Requirement.** Provide firm settings.

**Acceptance.**
1. The principal records the firm name, US street/city/state/ZIP address, nine-digit EIN, entity classification, fiscal year-end month/day, service lines, default USD or AUD currency, IANA time zone and staff email notification hours.
2. New templates, hourly rates and native prospects use the firm default unless explicitly overridden; historical money and exports never change.
3. Workspace activity instants and today use the firm zone with its date-specific daylight-saving offset; date-only deadlines keep their recorded day.
4. A recorded filing calendar holds a name, jurisdiction, date and required source or firm-defined label: these are human-entered dates, not automatic agency calculations (DUE-001/003).
5. Notification start is inclusive and end exclusive in the firm zone; an earlier end spans midnight and equal times allow all day.
6. In-app alerts appear immediately; staff emails outside the window remain durably deferred until the hourly trigger runs inside it.
7. Completed attempts are not resent, and inactive recipients are not mailed.
8. Client sends and sign-in mail keep their current behavior.

**Evidence.** `src/blotter/firm.ts`; `src/blotter/clients.ts`; `src/blotter/billing.ts`; `src/blotter/notifications.ts`; `src/ui/firm.tsx`; `src/ui/common.tsx`; `migrations/core/0047_firm_settings.sql`; `tests/blotter/us.test.mjs`; `tests/blotter/demo.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: The principal records the firm name; US street/city/state/ZIP address; nine-digit EIN; entity classification; fiscal year-end month/day; service lines; default USD or AUD currency; IANA time zone; staff email notification hours; New templates; hourly rates; native prospects use the firm default unless explicitly overridden; historical money; exports never change; Workspace activity instants; today use the firm zone with its date-specific daylight-saving offset; date-only deadlines keep their recorded day; A recorded filing calendar holds a name; jurisdiction; date; required source or firm-defined label: these are human-entered dates; not automatic agency calculations (DUE-001/003); Notification start is inclusive; end exclusive in the firm zone; an earlier end spans midnight; equal times allow all day; In-app alerts appear immediately; staff emails outside the window remain durably deferred until the hourly trigger runs inside it; Completed attempts are not resent; and inactive recipients are not mailed; Client sends; sign-in mail keep their current behavior.

#### US-004 — Firm settings for US-004

Core · target · **partial** · From US-001 · Cites BASE-DATA-001, BASE-MAIL-001 · Rules D-1

**Requirement.** Provide firm settings for US-004.

**Acceptance.**
1. Settings and calendars survive practice archive restore.
2. Future notification channels (NOTIFY-001), connected-mail schedules (MAIL-003), automation (AUTOMATE-001), and deadline calculations (DUE-001/003) inherit the firm zone and applicable notification hours; CRM-001 carries client entity/contact structure and phone/SSN-digit matching for CRM-004 and SEARCH-001.

**Evidence.** `src/blotter/firm.ts`; `src/blotter/clients.ts`; `src/blotter/billing.ts`; `src/blotter/notifications.ts`; `src/ui/firm.tsx`; `src/ui/common.tsx`; `migrations/core/0047_firm_settings.sql`; `tests/blotter/us.test.mjs`; `tests/blotter/demo.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Settings; calendars survive practice archive restore; Future notification channels (NOTIFY-001); connected-mail schedules (MAIL-003); automation (AUTOMATE-001); and deadline calculations (DUE-001/003) inherit the firm zone; applicable notification hours; CRM-001 carries client entity/contact structure; phone/SSN-digit matching for CRM-004; SEARCH-001.

#### US-005 — Msg-002 marketing consent for US-005

Core · target · **partial** · From US-001 · Cites BASE-MAIL-001, BASE-ROLE-001 · Rules D-1

**Requirement.** Provide msg-002 marketing consent for US-005.

**Acceptance.**
1. The firm's US postal address appears on every marketing email, and a marketing send without it is refused.

**Evidence.** `src/blotter/firm.ts`; `src/blotter/clients.ts`; `src/blotter/billing.ts`; `src/blotter/notifications.ts`; `src/ui/firm.tsx`; `src/ui/common.tsx`; `migrations/core/0047_firm_settings.sql`; `tests/blotter/us.test.mjs`; `tests/blotter/demo.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: The firm's US postal address appears on every marketing email; and a marketing send without it is refused.

#### CRM-001 — Client entities and contacts

Core · target · **partial** · Cites BASE-AUDIT-001, BASE-DATA-001, BASE-ROLE-001 · Rules D-1

**Requirement.** Manage individuals, businesses and trusts with multiple contacts, authorized signers, portal users, responsible partner, assigned team, service scope, lifecycle and consent preferences. Contacts carry roles (primary, billing, tax, bookkeeping) that route invoices, requests and signatures. A contact may represent several entities without sharing their private records; duplicates are merged under CRM-004. Search, edit, archive and reactivate clients without losing engagement history.

**Acceptance.**
1. Create a business with two contacts and an individual linked to its owner; assign different staff and portal permissions, change a contact, archive/reactivate the business and inspect retained jobs.
2. A contact without entity authority cannot read its records.

**Evidence.** `src/blotter/client-contacts.ts`; `src/blotter/client-lifecycle.ts`; `src/blotter/client-recipients.ts`; `src/blotter/clients.ts`; `src/blotter/merges.ts`; `src/blotter/search.ts`; `src/blotter/documents.ts`; `src/ui/client-details.tsx`; `migrations/core/0049_client_contacts.sql`; `tests/blotter/contacts.test.mjs`; `tests/blotter/flows.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Create a business with two contacts; an individual linked to its owner; assign different staff; portal permissions; change a contact; archive/reactivate the business; inspect retained jobs; A contact without entity authority cannot read its records.

#### CRM-006 — Crm-005

Core · target · **partial** · From CRM-001 · Cites BASE-ROLE-001 · Rules D-1

**Requirement.** Provide crm-005.

**Acceptance.**
1. CRM-005 prospect contacts, including every additional authorized contact, move to the one converted client .

**Evidence.** `src/blotter/client-contacts.ts`; `src/blotter/client-lifecycle.ts`; `src/blotter/client-recipients.ts`; `src/blotter/clients.ts`; `src/blotter/merges.ts`; `src/blotter/search.ts`; `src/blotter/documents.ts`; `src/ui/client-details.tsx`; `migrations/core/0049_client_contacts.sql`; `tests/blotter/contacts.test.mjs`; `tests/blotter/flows.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: CRM-005 prospect contacts; including every additional authorized contact; move to the one converted client .

#### CRM-007 — An entity is an individual, business or trust

Core · target · **partial** · From CRM-001 · Cites BASE-MAIL-001, BASE-ROLE-001, BASE-SIGNIN-002 · Rules D-1

**Requirement.** Provide an entity is an individual, business or trust.

**Acceptance.**
1. An entity is an individual, business or trust; its responsible partner is an active reviewer or principal, its assigned team lists active staff, and services and a related owner/household client are recorded without granting job access.
2. Each contact relationship belongs to one entity; the same normalized email may represent several entities without pooling authority.
3. Staff explicitly record primary/billing/tax/bookkeeping roles, signer authority, portal permission and request/email consent, with a note.
4. Existing single contacts retain only their existing entity's collection authority.
5. Requests and deliverables choose an authorized, consented recipient explicitly or the unique primary contact; ambiguous primaries refuse a send.
6. A job link authenticates possession only and is bound to that entity/contact; contact edits revoke its old links, and every portal read/write rechecks active entity, authority and consent.
7. PORTAL-002 inherits identified portal accounts, recovery and MFA; BILL-002 and SIGN-001/SIGN-002/ENGAGE-001 inherit billing/tax/signer routing before those capabilities ship.
8. ACCESS-002 inherits configurable staff grants; assignments never widen existing job visibility.

**Evidence.** `src/blotter/client-contacts.ts`; `src/blotter/client-lifecycle.ts`; `src/blotter/client-recipients.ts`; `src/blotter/clients.ts`; `src/blotter/merges.ts`; `src/blotter/search.ts`; `src/blotter/documents.ts`; `src/ui/client-details.tsx`; `migrations/core/0049_client_contacts.sql`; `tests/blotter/contacts.test.mjs`; `tests/blotter/flows.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: An entity is an individual; business or trust; its responsible partner is an active reviewer or principal; its assigned team lists active staff; and services; a related owner/household client are recorded without granting job access; Each contact relationship belongs to one entity; the same normalized email may represent several entities without pooling authority; Staff explicitly record primary/billing/tax/bookkeeping roles; signer authority; portal permission; request/email consent; with a note; Existing single contacts retain only their existing entity's collection authority; Requests; deliverables choose an authorized; consented recipient explicitly or the unique primary contact; ambiguous primaries refuse a send; A job link authenticates possession only; is bound to that entity/contact; contact edits revoke its old links; and every portal read/write rechecks active entity; authority; consent; PORTAL-002 inherits identified portal accounts; recovery; MFA; BILL-002; SIGN-001/SIGN-002/ENGAGE-001 inherit billing/tax/signer routing before those capabilities ship; ACCESS-002 inherits configurable staff grants; assignments never widen existing job visibility.

#### CRM-008 — Archive blocks new work, recurrence generation and client

Core · target · **partial** · From CRM-001 · Cites BASE-AUDIT-001, BASE-DATA-001, BASE-ROLE-001 · Rules D-1

**Requirement.** Provide archive blocks new work, recurrence generation and client.

**Acceptance.**
1. Archive blocks new work, recurrence generation and client sends while preserving engagements/history; reactivation allows fresh links but never revives revoked ones.
2. Phone normalization removes punctuation, adds +1 to ten-digit US numbers and otherwise requires a country code (8–15 digits); duplicate proposals use exact normalized phone.
3. Individuals store only four SSN digits, never a full SSN; matching/search is principal/reviewer-only and output is masked.
4. Contact merges need the principal's per-contact recorded authority whenever either side would gain records, preserve distinct relationships without combining consent, revoke old links, and support CRM-004's unchanged 30-day undo.
5. Prospect conversion copies all additional contacts once.
6. Offboarding previews and transfers partner/team responsibilities; archive restore preserves contact grants and lifecycle.

**Evidence.** `src/blotter/client-contacts.ts`; `src/blotter/client-lifecycle.ts`; `src/blotter/client-recipients.ts`; `src/blotter/clients.ts`; `src/blotter/merges.ts`; `src/blotter/search.ts`; `src/blotter/documents.ts`; `src/ui/client-details.tsx`; `migrations/core/0049_client_contacts.sql`; `tests/blotter/contacts.test.mjs`; `tests/blotter/flows.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Archive blocks new work; recurrence generation; client sends while preserving engagements/history; reactivation allows fresh links but never revives revoked ones; Phone normalization removes punctuation; adds +1 to ten-digit US numbers; otherwise requires a country code (8–15 digits); duplicate proposals use exact normalized phone; Individuals store only four SSN digits; never a full SSN; matching/search is principal/reviewer-only; output is masked; Contact merges need the principal's per-contact recorded authority whenever either side would gain records; preserve distinct relationships without combining consent; revoke old links; and support CRM-004's unchanged 30-day undo; Prospect conversion copies all additional contacts once; Offboarding previews; transfers partner/team responsibilities; archive restore preserves contact grants; lifecycle.

#### CRM-009 — Msg-002 marketing consent for CRM-009

Core · target · **partial** · From CRM-001 · Cites BASE-DATA-001, BASE-MAIL-001 · Rules D-1

**Requirement.** Provide msg-002 marketing consent for CRM-009.

**Acceptance.**
1. Marketing grants are recorded per contact relationship, withdrawals apply to the address across the whole firm, and a marketing grant never restores email consent.

**Evidence.** `src/blotter/client-contacts.ts`; `src/blotter/client-lifecycle.ts`; `src/blotter/client-recipients.ts`; `src/blotter/clients.ts`; `src/blotter/merges.ts`; `src/blotter/search.ts`; `src/blotter/documents.ts`; `src/ui/client-details.tsx`; `migrations/core/0049_client_contacts.sql`; `tests/blotter/contacts.test.mjs`; `tests/blotter/flows.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Marketing grants are recorded per contact relationship; withdrawals apply to the address across the whole firm; and a marketing grant never restores email consent.

#### CRM-002 — Client groups and custom fields

Core · target · **done** · Cites BASE-ROLE-001 · Rules D-1

**Requirement.** Group related entities and households, capture typed firm-defined fields and tags, filter a segment and apply reviewed bulk updates or work creation. Required-field validation and permissions apply to imported and API-created records too.

**Acceptance.**
1. Group a parent, subsidiary and household; add a fiscal-year and service-tier field, filter the group and schedule its annual work.
2. Preview a bulk field change, reject one invalid value and confirm unrelated clients are unchanged.

**Evidence.** `src/blotter/profiles.ts`; `src/blotter/clients.ts`; `src/blotter/imports/client-list.ts`; `migrations/core/0021_client_profiles.sql`; `src/ui/profiles.tsx`; `tests/blotter/flows.test.mjs`
**Gap.** None.

#### CRM-003 — Engagement history and accountable ownership

Core · target · **partial** · Cites BASE-AUDIT-001, BASE-INPUT-003, BASE-MAIL-001, BASE-ROLE-001 · Rules D-1

**Requirement.** Each client and engagement has a searchable chronological history of email, portal messages, documents, requests, assignments, reviews, deadlines, signed scope and billing outcomes. Every unresolved item has a responsible person, next action and due condition; closing a message alone does not complete the engagement.

**Acceptance.**
1. Open a client after two periods of work and trace a request from email through upload, review and payment.
2. Filter unresolved items, change their owner and inspect authors, source links and timestamps; a preparer sees only authorized history.

**Evidence.** `src/blotter/history.ts`; `src/ui/history.tsx`; `tests/blotter/flows.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Open a client after two periods of work; trace a request from email through upload; review; payment; Filter unresolved items; change their owner; inspect authors; source links; timestamps; a preparer sees only authorized history.

#### CRM-010 — client's history is every audited action on

Core · target · **partial** · From CRM-003 · Cites BASE-AUDIT-001, BASE-DATA-001, BASE-ROLE-001 · Rules D-1

**Requirement.** Provide a client's history is every audited action on.

**Acceptance.**
1. A client's history is every audited action on the client, its jobs and their requests, files, discussions, notices, expenses, time and recurring rules, and the billing exports that include its work, newest first, each with its author, UTC time and the job it links to, searchable by text and filtered by kind (documents, assignments, reviews, deadlines, messages, billing).
2. Unresolved items are open requests (owner: the job's preparer), open tasks (their named or role owner), jobs in review (the reviewer), open discussions (their owner) and open notices (their assignee), each with its next action and due condition (the job's due date, a follow-up date or a response date), filterable by owner; resolving a discussion completes nothing else.
3. A reviewer or the principal hands an item to another person: a request's owner is its job's preparer and a review's its reviewer, so those reassign the job and nobody is made to review their own work; a task is assigned by name (WORK-009 read access); a discussion goes only to someone who can read it; every handover is audited.

**Evidence.** `src/blotter/history.ts`; `src/ui/history.tsx`; `tests/blotter/flows.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: A client's history is every audited action on the client; its jobs; their requests; files; discussions; notices; expenses; time; recurring rules; and the billing exports that include its work; newest first; each with its author; UTC time; the job it links to; searchable by text; filtered by kind (documents; assignments; reviews; deadlines; messages; billing); Unresolved items are open requests (owner: the job's preparer); open tasks (their named or role owner); jobs in review (the reviewer); open discussions (their owner); open notices (their assignee); each with its next action; due condition (the job's due date; a follow-up date or a response date); filterable by owner; resolving a discussion completes nothing else; A reviewer or the principal hands an item to another person: a request's owner is its job's preparer; a review's its reviewer; so those reassign the job; nobody is made to review their own work; a task is assigned by name (WORK-009 read access); a discussion goes only to someone who can read it; every handover is audited.

#### CRM-011 — preparer sees only the jobs they may

Core · target · **partial** · From CRM-003 · Cites BASE-AUDIT-001, BASE-DATA-001, BASE-MAIL-001, BASE-ROLE-001 · Rules D-1

**Requirement.** Provide a preparer sees only the jobs they may.

**Acceptance.**
1. Connected-mailbox email (MAIL-001), portal messages (PORTAL-003), signed scope (ENGAGE-001), invoices (BILL-002) and payments (PAY-001) write their events into this history, with author, time and source link and the same visibility.

**Evidence.** `src/blotter/history.ts`; `src/ui/history.tsx`; `tests/blotter/flows.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Connected-mailbox email (MAIL-001); portal messages (PORTAL-003); signed scope (ENGAGE-001); invoices (BILL-002); payments (PAY-001) write their events into this history; with author; time; source link; the same visibility.

#### CRM-012 — Msg-002 marketing consent for CRM-012

Core · target · **partial** · From CRM-003 · Cites BASE-AUDIT-001 · Rules D-1

**Requirement.** Provide msg-002 marketing consent for CRM-012.

**Acceptance.**
1. Bulk messages and their delivery, bounce, complaint and reply events file to each client's history under their class, engagement or marketing.

**Evidence.** `src/blotter/history.ts`; `src/ui/history.tsx`; `tests/blotter/flows.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Bulk messages; their delivery; bounce; complaint; reply events file to each client's history under their class; engagement or marketing.

#### CRM-004 — Merge duplicate clients and contacts

Core · target · **partial** · Cites BASE-AUDIT-001, BASE-DATA-001, BASE-MAIL-001, BASE-ROLE-001 · Rules D-1

**Requirement.** Blotter proposes likely duplicate clients and contacts after an import, email auto-match, portal sign-up or connector sync, using matching email, phone, EIN, last four SSN digits and name similarity. Staff compare the records side by side, choose the surviving value for each field and merge. Work, tasks, email threads, documents, organizers, signatures, invoices, payments, portal users and history move to the survivor with an audit record. Source IDs from both records (Karbon, TaxDome, Canopy, QBO, Xero) stay attached so later imports and syncs match the survivor. A merge that would give one contact access to another entity's private records without authority is refused. An unchanged merge can be undone for 30 days.

**Acceptance.**
1. Import a Karbon client that duplicates a native client and accept the suggested match.
2. Choose field values, merge, and inspect the moved jobs, email, invoices and portal access on the survivor with exactly one QBO mapping.
3. Undo the merge before further edits and inspect the restored records; then repeat the merge, re-run the import and confirm it matches the survivor without creating a duplicate.
4. A merge joining two unrelated entities' contacts without authority is refused.

**Evidence.** `src/blotter/duplicates.ts`; `src/blotter/merges.ts`; `src/blotter/imports/target.ts`; `migrations/core/0029_duplicates.sql`; `migrations/core/0030_client_merges.sql`; `src/ui/duplicates.tsx`; `tests/blotter/flows.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Import a Karbon client that duplicates a native client; accept the suggested match; Choose field values; merge; and inspect the moved jobs; email; invoices; portal access on the survivor with exactly one QBO mapping; Undo the merge before further edits; inspect the restored records; then repeat the merge; re-run the import; confirm it matches the survivor without creating a duplicate; A merge joining two unrelated entities' contacts without authority is refused.

#### CRM-013 — Matching

Core · target · **partial** · From CRM-004 · Cites BASE-MAIL-001 · Rules D-1

**Requirement.** Provide matching.

**Acceptance.**
1. Proposals are worked out from the clients as they are when read, whatever created them; a pair is proposed when it shares a contact email (case-insensitive), a non-empty EIN (the client's tax id), or a name that is equal, or similar (at least two words each and at least 75% of their distinct words shared), once lower-cased and with accents, punctuation, "&"/"and" and business suffixes set aside.
2. Phone and last-four SSN matches join when CRM-001 stores them, before CRM-001 ships (ct 19 Oct 11:47Z).
3. A person may record, with a reason, that a proposed pair is two different clients; it is not proposed again.

**Evidence.** `src/blotter/duplicates.ts`; `src/blotter/merges.ts`; `src/blotter/imports/target.ts`; `migrations/core/0029_duplicates.sql`; `migrations/core/0030_client_merges.sql`; `src/ui/duplicates.tsx`; `tests/blotter/flows.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Proposals are worked out from the clients as they are when read; whatever created them; a pair is proposed when it shares a contact email (case-insensitive); a non-empty EIN (the client's tax id); or a name that is equal; or similar (at least two words each; at least 75% of their distinct words shared); once lower-cased; with accents; punctuation; "&"/"and"; business suffixes set aside; Phone; last-four SSN matches join when CRM-001 stores them; before CRM-001 ships (ct 19 Oct 11:47Z); A person may record; with a reason; that a proposed pair is two different clients; it is not proposed again.

#### CRM-014 — Authority

Core · target · **partial** · From CRM-004 · Cites BASE-MAIL-001, BASE-ROLE-001 · Rules D-1

**Requirement.** Provide authority.

**Acceptance.**
1. A merge of two clients with different non-empty EINs, or different non-empty contact emails, needs the principal's recorded authority reason (same entity; the surviving contact is authorized for both); reviewers merge only records whose EINs and contact emails agree or are blank; CRM-001 contacts and PORTAL-002 portal users add a per-contact check .
2. Undo is available for 30 days while neither record has changed since the merge.

**Evidence.** `src/blotter/duplicates.ts`; `src/blotter/merges.ts`; `src/blotter/imports/target.ts`; `migrations/core/0029_duplicates.sql`; `migrations/core/0030_client_merges.sql`; `src/ui/duplicates.tsx`; `tests/blotter/flows.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: A merge of two clients with different non-empty EINs; or different non-empty contact emails; needs the principal's recorded authority reason (same entity; the surviving contact is authorized for both); reviewers merge only records whose EINs; contact emails agree or are blank; CRM-001 contacts; PORTAL-002 portal users add a per-contact check ; Undo is available for 30 days while neither record has changed since the merge.

#### CRM-015 — Merge and undo

Core · target · **partial** · From CRM-004 · Cites BASE-INPUT-003, BASE-MAIL-001, BASE-ROLE-001 · Rules D-1

**Requirement.** Provide merge and undo.

**Acceptance.**
1. The person picks which client keeps its id (the survivor) and, for every field where the two differ (name, EIN, contact name and email, tags and each firm field), which value survives; each client keeps its own "came from" source.
2. The other client stays as a read-only record pointing at the survivor and leaves every list and picker.
3. Its jobs (with their tasks, time, documents, organizer answers, deliverables and upload links), discussions, tax notices, expenses, recurring rules, rate cards and group memberships move to the survivor, including signed-off jobs, resolved discussions, closed notices and decided or reimbursed expenses, whose only permitted change is that move, between the two clients of a merge that is not undone.
4. A merge is refused while both clients have a job from the same template for the same period, or a recurring rule for the same template.
5. Moved rate cards join the survivor's under TIME-003 precedence.
6. Each import source row keeps the client it created; a re-import of that row still matches it, shows the survivor it now lives on and creates no client.

**Evidence.** `src/blotter/duplicates.ts`; `src/blotter/merges.ts`; `src/blotter/imports/target.ts`; `migrations/core/0029_duplicates.sql`; `migrations/core/0030_client_merges.sql`; `src/ui/duplicates.tsx`; `tests/blotter/flows.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: The person picks which client keeps its id (the survivor) and; for every field where the two differ (name; EIN; contact name; email; tags; each firm field); which value survives; each client keeps its own "came from" source; The other client stays as a read-only record pointing at the survivor; leaves every list; picker; Its jobs (with their tasks; time; documents; organizer answers; deliverables; upload links); discussions; tax notices; expenses; recurring rules; rate cards; group memberships move to the survivor; including signed-off jobs; resolved discussions; closed notices; decided or reimbursed expenses; whose only permitted change is that move; between the two clients of a merge that is not undone; A merge is refused while both clients have a job from the same template for the same period; or a recurring rule for the same template; Moved rate cards join the survivor's under TIME-003 precedence; Each import source row keeps the client it created; a re-import of that row still matches it; shows the survivor it now lives on; creates no client.

#### CRM-016 — Merge and undo for CRM-016

Core · target · **partial** · From CRM-004 · Cites BASE-DATA-001, BASE-ROLE-001 · Rules D-1

**Requirement.** Provide merge and undo for CRM-016.

**Acceptance.**
1. Undo restores the recorded records, memberships and the survivor's own values exactly; it is open until the merge time plus 30 × 24 hours while the survivor has not been edited, merged again, or gained or lost a linked record since, and changes made inside moved records travel back with them.
2. A merge made on the principal's authority is undone only by the principal.

**Evidence.** `src/blotter/duplicates.ts`; `src/blotter/merges.ts`; `src/blotter/imports/target.ts`; `migrations/core/0029_duplicates.sql`; `migrations/core/0030_client_merges.sql`; `src/ui/duplicates.tsx`; `tests/blotter/flows.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Undo restores the recorded records; memberships; the survivor's own values exactly; it is open until the merge time plus 30 × 24 hours while the survivor has not been edited; merged again; or gained or lost a linked record since; and changes made inside moved records travel back with them; A merge made on the principal's authority is undone only by the principal.

#### CRM-017 — Inherited

Core · target · **partial** · From CRM-004 · Cites BASE-MAIL-001 · Rules D-1

**Requirement.** Provide inherited.

**Acceptance.**
1. Each later capability moves with a merge and keeps its source IDs attached : CRM-001 contacts (including phone and SSN-digit matches), MAIL-001 email threads, BILL-002 invoices, PAY-001 payments, PORTAL-002 portal users, PORTAL-004 organizers, SIGN-001/SIGN-002 signatures, and the source IDs of MIGRATE-001–005 (Karbon, TaxDome, Canopy, Financial Cents, Double) and LEDGER-001/INTEGRATE-001 (QBO, Xero; exactly one ledger mapping per survivor).

**Evidence.** `src/blotter/duplicates.ts`; `src/blotter/merges.ts`; `src/blotter/imports/target.ts`; `migrations/core/0029_duplicates.sql`; `migrations/core/0030_client_merges.sql`; `src/ui/duplicates.tsx`; `tests/blotter/flows.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Each later capability moves with a merge; keeps its source IDs attached : CRM-001 contacts (including phone; SSN-digit matches); MAIL-001 email threads; BILL-002 invoices; PAY-001 payments; PORTAL-002 portal users; PORTAL-004 organizers; SIGN-001/SIGN-002 signatures; and the source IDs of MIGRATE-001–005 (Karbon; TaxDome; Canopy; Financial Cents; Double); LEDGER-001/INTEGRATE-001 (QBO; Xero; exactly one ledger mapping per survivor).

#### CRM-018 — Msg-002 marketing consent for CRM-018

Core · target · **partial** · From CRM-004 · Cites BASE-DATA-001 · Rules D-1

**Requirement.** Provide msg-002 marketing consent for CRM-018.

**Acceptance.**
1. Merging two contacts keeps the most restrictive marketing consent, and undo restores each side exactly.

**Evidence.** `src/blotter/duplicates.ts`; `src/blotter/merges.ts`; `src/blotter/imports/target.ts`; `migrations/core/0029_duplicates.sql`; `migrations/core/0030_client_merges.sql`; `src/ui/duplicates.tsx`; `tests/blotter/flows.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Merging two contacts keeps the most restrictive marketing consent; and undo restores each side exactly.

#### CRM-005 — Prospects intake and onboarding pipeline

Core · target · **partial** · Cites BASE-INPUT-003 · Rules D-1

**Requirement.** Track prospects through firm-defined stages (for example inquiry, consult booked, proposal sent, won, lost) with lead source, requested services, estimated annual fees and owner. An embeddable, spam-protected website intake form creates a prospect with its answers and uploads. A consult can be booked under INTEGRATE-005 and a proposal sent under ENGAGE-001 or INTEGRATE-004. Winning converts the prospect into exactly one client with contacts, signed scope and documents and starts onboarding work. Lost prospects keep a required reason. A pipeline report shows conversion, stage age and fee totals by source and owner. Mechanism: [details](docs/contract/mechanism.md).

**Acceptance.**
1. Submit the embedded intake form and inspect the new prospect with source and answers; a spam submission is rejected.
2. Book a consult, send a proposal and accept it; confirm one client with contacts, signed scope and onboarding work, and repeat the acceptance event without a second client.
3. Mark another prospect lost with a reason and inspect the pipeline report's conversion, stage age and fee totals.

**Evidence.** `src/blotter/prospects.ts`; `src/blotter/intake.ts`; `src/blotter/intake-page.ts`; `migrations/core/0047_intake.sql`; `src/ui/pipeline.tsx`; `tests/blotter/flows.test.mjs`; `tests/blotter/intake.test.mjs`; `tests/blotter/pipeline-forecast.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Submit the embedded intake form; inspect the new prospect with source; answers; a spam submission is rejected; Book a consult; send a proposal; accept it; confirm one client with contacts; signed scope; onboarding work; and repeat the acceptance event without a second client; Mark another prospect lost with a reason; inspect the pipeline report's conversion; stage age; fee totals.

#### CRM-019 — The principal and reviewers record and move prospects

Core · target · **partial** · From CRM-005 · Rules D-1

**Requirement.** Provide the principal and reviewers record and move prospects. Mechanism: [details](docs/contract/mechanism.md).

**Acceptance.**
1. The principal and reviewers record and move prospects (as they add clients); Inquiry, Consult booked, Proposal sent, Won and Lost are built in and the principal adds open stages between them by position.
2. A prospect carries its name, contact, lead source, requested services, estimated annual fees (integer cents) and owner (an active member); every stage change is kept with who and when.
3. Moving to Lost needs a reason; Won is reached only by winning.
4. Winning converts the prospect, in one batch, into exactly one client (its name and contact, the firm's required client fields supplied) and starts its onboarding job from a chosen template (preparer, reviewer, period, due date and its source); a repeated win returns that client and job and creates nothing, and a won prospect cannot be moved or lost again.

**Evidence.** `src/blotter/prospects.ts`; `src/blotter/intake.ts`; `src/blotter/intake-page.ts`; `migrations/core/0047_intake.sql`; `src/ui/pipeline.tsx`; `tests/blotter/flows.test.mjs`; `tests/blotter/intake.test.mjs`; `tests/blotter/pipeline-forecast.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: The principal; reviewers record; move prospects (as they add clients); Inquiry; Consult booked; Proposal sent; Won; Lost are built in; the principal adds open stages between them by position; A prospect carries its name; contact; lead source; requested services; estimated annual fees (integer cents); owner (an active member); every stage change is kept with who; when; Moving to Lost needs a reason; Won is reached only by winning; Winning converts the prospect; in one batch; into exactly one client (its name; the firm's required client fields supplied); starts its onboarding job from a chosen template (preparer; reviewer; period; due date; its source); a repeated win returns that client; job; creates nothing; and a won prospect cannot be moved or lost again.

#### CRM-020 — The pipeline report, as of now in whole

Core · target · **partial** · From CRM-005 · Rules D-1

**Requirement.** Provide the pipeline report, as of now in whole. Mechanism: [details](docs/contract/mechanism.md).

**Acceptance.**
1. The pipeline report, as of now in whole UTC days rounded down, gives per lead source and per owner the prospects, open, won and lost counts, conversion (won as a whole percentage of won plus lost; none until one closes) and open, won and lost fee totals grouped by stored currency, and per open stage the prospects in it with their average and oldest days in that stage.

**Evidence.** `src/blotter/prospects.ts`; `src/blotter/intake.ts`; `src/blotter/intake-page.ts`; `migrations/core/0047_intake.sql`; `src/ui/pipeline.tsx`; `tests/blotter/flows.test.mjs`; `tests/blotter/intake.test.mjs`; `tests/blotter/pipeline-forecast.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: The pipeline report; as of now in whole UTC days rounded down; gives per lead source; per owner the prospects; open; won; lost counts; conversion (won as a whole percentage of won plus lost; none until one closes); lost fee totals grouped by stored currency; and per open stage the prospects in it with their average; oldest days in that stage.

#### CRM-021 — Public intake

Core · target · **partial** · From CRM-005 · Cites BASE-DATA-001, BASE-DATA-006, BASE-INPUT-003 · Rules D-1

**Requirement.** Provide public intake. Mechanism: [details](docs/contract/mechanism.md).

**Acceptance.**
1. `/intake` alone permits embedding (`frame-ancestors *`).
2. A required consent line records that details go only to the practice to reply to this inquiry.
3. Accepted forms create an Inquiry owned by the principal with lead source, requested services, free-text answers and an optional annual-budget band (not a quote), consent wording/time and up to three attachments of at most 1 MiB each.
4. Rejected submissions store no prospect, answers or uploads.
5. Turnstile runs only when the owner supplies both keys.
6. Only the principal and reviewers read intake answers/uploads.
7. Winning files the intake uploads on the client's onboarding work in the same batch without retaining a second copy of their bytes; the original intake links still resolve.
8. Owner-confirmed attachment erasure follows ERASURE-001 and fences stale archives; intake prospects, answers, consent records and uploads inherit CRM target erasure and retention under ERASURE-002 .

**Evidence.** `src/blotter/prospects.ts`; `src/blotter/intake.ts`; `src/blotter/intake-page.ts`; `migrations/core/0047_intake.sql`; `src/ui/pipeline.tsx`; `tests/blotter/flows.test.mjs`; `tests/blotter/intake.test.mjs`; `tests/blotter/pipeline-forecast.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: `/intake` alone permits embedding (`frame-ancestors *`); A required consent line records that details go only to the practice to reply to this inquiry; Accepted forms create an Inquiry owned by the principal with lead source; requested services; free-text answers; an optional annual-budget band (not a quote); consent wording/time; up to three attachments of at most 1 MiB each; Rejected submissions store no prospect; answers or uploads; Turnstile runs only when the owner supplies both keys; Only the principal; reviewers read intake answers/uploads; Winning files the intake uploads on the client's onboarding work in the same batch without retaining a second copy of their bytes; the original intake links still resolve; Owner-confirmed attachment erasure follows ERASURE-001; fences stale archives; intake prospects; answers; consent records; uploads inherit CRM target erasure; retention under ERASURE-002 .

#### CRM-022 — Consult booking , proposal sending, accepted signed scope

Core · target · **partial** · From CRM-005 · Rules D-1

**Requirement.** Provide consult booking , proposal sending, accepted signed scope. Mechanism: [details](docs/contract/mechanism.md).

**Acceptance.**
1. Consult booking (INTEGRATE-005), proposal sending, accepted signed scope and signed documents (ENGAGE-001/INTEGRATE-004), and additional contacts (CRM-001) each connect to this idempotent win; no manual win claims a proposal was sent or signed.

**Evidence.** `src/blotter/prospects.ts`; `src/blotter/intake.ts`; `src/blotter/intake-page.ts`; `migrations/core/0047_intake.sql`; `src/ui/pipeline.tsx`; `tests/blotter/flows.test.mjs`; `tests/blotter/intake.test.mjs`; `tests/blotter/pipeline-forecast.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Consult booking (INTEGRATE-005); proposal sending; accepted signed scope; signed documents (ENGAGE-001/INTEGRATE-004); and additional contacts (CRM-001) each connect to this idempotent win; no manual win claims a proposal was sent or signed.

#### CRM-023 — Msg-002 marketing consent for CRM-023

Core · target · **partial** · From CRM-005 · Rules D-1

**Requirement.** Provide msg-002 marketing consent for CRM-023. Mechanism: [details](docs/contract/mechanism.md).

**Acceptance.**
1. The public intake form may offer only an optional, unticked marketing checkbox with its exact wording, separate from the reply consent; its grant follows the prospect's contact to the converted client.

**Evidence.** `src/blotter/prospects.ts`; `src/blotter/intake.ts`; `src/blotter/intake-page.ts`; `migrations/core/0047_intake.sql`; `src/ui/pipeline.tsx`; `tests/blotter/flows.test.mjs`; `tests/blotter/intake.test.mjs`; `tests/blotter/pipeline-forecast.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: The public intake form may offer only an optional; unticked marketing checkbox with its exact wording; separate from the reply consent; its grant follows the prospect's contact to the converted client.

#### ENGAGE-001 — Proposals engagement letters and signatures

Core · target · **missing** · Cites BASE-DATA-006, BASE-ROLE-001 · Rules D-1

**Requirement.** Build service proposals and versioned engagement letters with scope, exclusions, USD fees, retainer terms, renewal and amendment rules. Send to authorized signers, collect electronic signatures with signer authority, consent, timestamps and a downloadable certificate, then launch onboarding once. Preserve declined, expired, superseded and partially signed states. IRS e-file signature authorizations (Forms 8879, 8879-S, 8879-PE, 8879-C, 8879-F and 8878) are owned by SIGN-001, which states the signers, KBA, fallback, record and retention rules; other signed documents use SIGN-002.

**Acceptance.**
1. Send a two-signer proposal, amend it before completion and verify the old version cannot bind the new terms.
2. Complete signatures, download the signed letter/certificate and inspect one onboarding job; decline another and inspect its retained declined state.
3. Collect a married-filing-jointly Form 8879 under SIGN-001's acceptance.

**Evidence.** None.
**Gap.** No proposal, engagement-letter, signature or signer-authority workflow exists.

#### ENGAGE-002 — Engagement history

Core · target · **missing** · From ENGAGE-001 · Cites BASE-AUDIT-001 · Rules D-1

**Requirement.** Provide engagement history.

**Acceptance.**
1. Sent, amended, signed and declined scope appear in the client's history with author, time and source link, visible only to those who may read the job, and any unresolved item they create (an unsigned proposal) names an owner, next action and due condition.

**Evidence.** None.
**Gap.** No proposal, engagement-letter, signature or signer-authority workflow exists.

#### ENGAGE-003 — The signed letter appears in the client history

Core · target · **missing** · From ENGAGE-001 · Cites BASE-AUDIT-001 · Rules D-1

**Requirement.** Provide the signed letter appears in the client history.

**Acceptance.**
1. The signed letter appears in the client history with its signer and time.

**Evidence.** None.
**Gap.** No proposal, engagement-letter, signature or signer-authority workflow exists.

#### ENGAGE-004 — Crm-005 for ENGAGE-004

Core · target · **missing** · From ENGAGE-001 · Rules D-1

**Requirement.** Provide crm-005 for ENGAGE-004.

**Acceptance.**
1. CRM-005 proposal sending and acceptance attach the accepted signed scope/documents to its client and invoke its idempotent win exactly once .

**Evidence.** None.
**Gap.** No proposal, engagement-letter, signature or signer-authority workflow exists.

#### ENGAGE-005 — Msg-002 marketing consent for ENGAGE-005

Core · target · **missing** · From ENGAGE-001 · Rules D-1

**Requirement.** Provide msg-002 marketing consent for ENGAGE-005.

**Acceptance.**
1. Marketing consent is never bundled into an engagement letter or signature, nor made a condition of service.

**Evidence.** None.
**Gap.** No proposal, engagement-letter, signature or signer-authority workflow exists.

#### ENGAGE-006 — Erasure-002 for ENGAGE-006

Core · target · **missing** · From ENGAGE-001 · Cites BASE-DATA-006 · Rules D-1

**Requirement.** Provide erasure-002 for ENGAGE-006.

**Acceptance.**
1. , its signed letters and certificates join ERASURE-002's signed-engagement class with that clause's clock, holds, preview, receipt and fence, and its signing provider's copies are named outside copies; practitioner-recorded engagements keep their label.

**Evidence.** None.
**Gap.** No proposal, engagement-letter, signature or signer-authority workflow exists.

#### SIGN-001 — IRS e-file signature authorizations with KBA

Core · target · **missing** · Cites BASE-AUDIT-001, BASE-DATA-006, BASE-INPUT-003, BASE-ROLE-001 · Rules D-1 · Register R-9

**Requirement.** Blotter collects IRS e-file signature authorizations: Forms 8879, 8879-S, 8879-PE, 8879-C, 8879-F and 8878. The practitioner attaches the final form produced by the tax software (INTEGRATE-002) to the client-year return engagement. Blotter sends it to every required signer: both spouses for married filing jointly, an officer for an 1120-S or 1120, and a partner or LLC member for a 1065. For remote signing, each signer passes knowledge-based authentication (KBA) through the identity provider, with their own credentials. A failed KBA attempt can be retried. After three failed attempts, electronic signing stops for that signer and Blotter creates a handwritten-signature task with the printable form, following the IRS e-signature rules for these forms. The record kept against the return engagement contains the signed PDF, the provider certificate and audit trail, and for each signer the name, timestamp, IP address, login ID and every KBA result. It also holds the document hash. Mechanism: [details](docs/contract/mechanism.md).

**Acceptance.**
1. Attach a Form 8879 to a married-filing-jointly 1040 engagement and send it to both spouses through the KBA provider at its test edge.
2. Make one spouse fail KBA once and pass on retry.
3. Make the second spouse fail three times, and confirm electronic signing is refused for them and a handwritten-signature task with the printable form is created.
4. Before both signatures exist, moving the work to ready to file is refused.
5. After the wet signature is uploaded, the move is allowed.
6. Inspect the stored signed PDF, certificate, per-signer IP address, login ID and KBA attempts on the 1040 engagement, and confirm a retention date three years after the later of due date and received date.
7. Erasure before that date is refused.
8. The return stays unfiled until an INTEGRATE-008 acceptance arrives, and an unsigned form is chased under FOLLOWUP-001.

**Evidence.** None.
**Gap.** No IRS e-file authorization signing, KBA provider, three-attempt fallback, signer record or ready-to-file gate exists.

#### SIGN-003 — Erasure-002 for SIGN-003

Core · target · **missing** · From SIGN-001 · Cites BASE-DATA-006, BASE-ROLE-001 · Rules D-1 · Register R-9

**Requirement.** Provide erasure-002 for SIGN-003. Mechanism: [details](docs/contract/mechanism.md).

**Acceptance.**
1. Its record is ERASURE-002's IRS e-file authorization class.

**Evidence.** None.
**Gap.** No IRS e-file authorization signing, KBA provider, three-attempt fallback, signer record or ready-to-file gate exists.

#### SIGN-002 — General document signature requests

Core · target · **partial** · Cites BASE-ROLE-001 · Rules D-1

**Requirement.** Staff request signatures on any firm document, for example a Form 2848 or 8821 (AUTHZ-001), a bank authorization, a management representation letter or a W-9. They place signature, initial, date and text fields on the PDF and choose one or more signers in sequential or parallel order. Signers give ESIGN Act and UETA consent, or pass KBA when the form requires it. Requests can be voided, declined with a reason and resent. FOLLOWUP-001 chases unsigned requests. The signed PDF and its certificate are filed to the client and work item with a timeline entry. Mechanism: [details](docs/contract/mechanism.md).

**Acceptance.**
1. Place fields on a PDF and request sequential signatures from two contacts.
2. The first signer declines with a reason; resend the request, then complete both signatures.
3. Inspect the signed file, its certificate, the signing order and the timeline on the client and work item.
4. A voided request cannot be signed afterwards, and a contact who is not a signer cannot open it.

**Evidence.** `src/blotter/signatures.ts`; `src/blotter/signatures-portal.ts`; `src/blotter/signatures-staff.ts`; `src/blotter/signatures-forms.ts`; `src/blotter/signatures-pdf.ts`; `src/blotter/signatures-retention.ts`; `src/ui/signatures.tsx`; `migrations/core/0087_signatures.sql`; `migrations/core/0090_signature_evidence.sql`; `tests/blotter/signatures.test.mjs`; `tests/blotter/signatures-ui.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Place fields on a PDF; request sequential signatures from two contacts; The first signer declines with a reason; resend the request; then complete both signatures; Inspect the signed file; its certificate; the signing order; the timeline on the client; work item; A voided request cannot be signed afterwards; and a contact who is not a signer cannot open it.

#### SIGN-004 — Offboarding

Core · target · **partial** · From SIGN-002 · Rules D-1

**Requirement.** Provide offboarding. Mechanism: [details](docs/contract/mechanism.md).

**Acceptance.**
1. Pending signature requests sent in a departing staff member's name appear in the offboarding preview and move to the work successor in its approved batch; completed signatures keep their original requester.

**Evidence.** `src/blotter/signatures.ts`; `src/blotter/signatures-portal.ts`; `src/blotter/signatures-staff.ts`; `src/blotter/signatures-forms.ts`; `src/blotter/signatures-pdf.ts`; `src/blotter/signatures-retention.ts`; `src/ui/signatures.tsx`; `migrations/core/0087_signatures.sql`; `migrations/core/0090_signature_evidence.sql`; `tests/blotter/signatures.test.mjs`; `tests/blotter/signatures-ui.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Pending signature requests sent in a departing staff member's name appear in the offboarding preview; move to the work successor in its approved batch; completed signatures keep their original requester.

#### SIGN-005 — Offboard a preparer with a pending signature request

Core · target · **partial** · From SIGN-002 · Rules D-1

**Requirement.** Provide offboard a preparer with a pending signature request. Mechanism: [details](docs/contract/mechanism.md).

**Acceptance.**
1. Offboard a preparer with a pending signature request; it is listed, follows the successor, and no request is left owned by the deactivated member.

**Evidence.** `src/blotter/signatures.ts`; `src/blotter/signatures-portal.ts`; `src/blotter/signatures-staff.ts`; `src/blotter/signatures-forms.ts`; `src/blotter/signatures-pdf.ts`; `src/blotter/signatures-retention.ts`; `src/ui/signatures.tsx`; `migrations/core/0087_signatures.sql`; `migrations/core/0090_signature_evidence.sql`; `tests/blotter/signatures.test.mjs`; `tests/blotter/signatures-ui.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Offboard a preparer with a pending signature request; it is listed; follows the successor; and no request is left owned by the deactivated member.

#### SIGN-006 — Msg-002 marketing consent for SIGN-006

Core · target · **partial** · From SIGN-002 · Rules D-1

**Requirement.** Provide msg-002 marketing consent for SIGN-006. Mechanism: [details](docs/contract/mechanism.md).

**Acceptance.**
1. Marketing consent is never bundled into a signature request, nor made a condition of service.

**Evidence.** `src/blotter/signatures.ts`; `src/blotter/signatures-portal.ts`; `src/blotter/signatures-staff.ts`; `src/blotter/signatures-forms.ts`; `src/blotter/signatures-pdf.ts`; `src/blotter/signatures-retention.ts`; `src/ui/signatures.tsx`; `migrations/core/0087_signatures.sql`; `migrations/core/0090_signature_evidence.sql`; `tests/blotter/signatures.test.mjs`; `tests/blotter/signatures-ui.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Marketing consent is never bundled into a signature request; nor made a condition of service.

#### SIGN-007 — Erasure-002 for SIGN-007

Core · target · **partial** · From SIGN-002 · Cites BASE-DATA-001, BASE-DATA-006 · Rules D-1

**Requirement.** Provide erasure-002 for SIGN-007. Mechanism: [details](docs/contract/mechanism.md).

**Acceptance.**
1. , SIGN-002 adds its records and provider copies to ERASURE-002's classes, clocks, holds, preview, erasure, receipt and restore fence.

**Evidence.** `src/blotter/signatures.ts`; `src/blotter/signatures-portal.ts`; `src/blotter/signatures-staff.ts`; `src/blotter/signatures-forms.ts`; `src/blotter/signatures-pdf.ts`; `src/blotter/signatures-retention.ts`; `src/ui/signatures.tsx`; `migrations/core/0087_signatures.sql`; `migrations/core/0090_signature_evidence.sql`; `tests/blotter/signatures.test.mjs`; `tests/blotter/signatures-ui.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: SIGN-002 adds its records; provider copies to ERASURE-002's classes; clocks; holds; preview; erasure; receipt; restore fence.

#### SIGN-008 — Staff with full job scope freeze the original

Core · target · **partial** · From SIGN-002 · Cites BASE-DATA-001, BASE-MAIL-001, BASE-ROLE-001 · Rules D-1

**Requirement.** Provide staff with full job scope freeze the original. Mechanism: [details](docs/contract/mechanism.md).

**Acceptance.**
1. Staff with full job scope freeze the original valid unencrypted PDF, signer relationships, order and signature/initial/date/text field geometry, then explicitly send through existing entity/contact-bound portal links.
2. Every contact signer must be active, authorized for the entity, a signer, portal-enabled and consented for requests/email; a staff representative signer is an active member or the principal who holds the client with working access.
3. The portal exposes only that signer's fields and requires explicit document-specific ESIGN/UETA consent and intent, never marketing consent.
4. Sequential signatures wait for every prior signer; parallel signatures can arrive in either order, with revision guards preventing lost updates.
5. Decline records a reason; resending a declined or restored request starts a fresh attempt and preserves prior attempts.
6. Voiding prevents further signatures.
7. Completion flattens entered fields onto the original PDF and creates a separate downloadable certificate with order, name, contact/link id, consent wording/version, times and document hashes.
8. It truthfully states typed electronic signatures and portal-possession authentication, not verified identity, KBA or a cryptographic digital signature.

**Evidence.** `src/blotter/signatures.ts`; `src/blotter/signatures-portal.ts`; `src/blotter/signatures-staff.ts`; `src/blotter/signatures-forms.ts`; `src/blotter/signatures-pdf.ts`; `src/blotter/signatures-retention.ts`; `src/ui/signatures.tsx`; `migrations/core/0087_signatures.sql`; `migrations/core/0090_signature_evidence.sql`; `tests/blotter/signatures.test.mjs`; `tests/blotter/signatures-ui.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Staff with full job scope freeze the original valid unencrypted PDF; signer relationships; order; signature/initial/date/text field geometry; then explicitly send through existing entity/contact-bound portal links; Every contact signer must be active; authorized for the entity; a signer; portal-enabled; consented for requests/email; a staff representative signer is an active member or the principal who holds the client with working access; The portal exposes only that signer's fields; requires explicit document-specific ESIGN/UETA consent; intent; never marketing consent; Sequential signatures wait for every prior signer; parallel signatures can arrive in either order; with revision guards preventing lost updates; Decline records a reason; resending a declined or restored request starts a fresh attempt; preserves prior attempts; Voiding prevents further signatures; Completion flattens entered fields onto the original PDF; creates a separate downloadable certificate with order; name; contact/link id; consent wording/version; times; document hashes; It truthfully states typed electronic signatures; portal-possession authentication; not verified identity; KBA or a cryptographic digital signature.

#### SIGN-009 — Ruled

Core · target · **partial** · From SIGN-002 · Cites BASE-AGENT-007, BASE-DATA-006, BASE-ROLE-001 · Rules D-1

**Requirement.** Provide ruled. This part applies RL-1. Mechanism: [details](docs/contract/mechanism.md).

**Acceptance.**
1. At consent and at signing, Blotter records the connection IP and user agent.
2. Both appear on the certificate and are retained and erased with the signed record.
3. For a document marked Form 2848 or 8821, a signer's signature is accepted only after a staff member records a remote-authentication attestation: the method (photo ID by selfie or video plus a secondary document, or personal knowledge), the verifier, the date and the items checked.
4. The certificate states the form is electronically signed and may be submitted only online at IRS.gov/Submit2848.
5. Staff representatives can be signers through their own session.
6. A PDF whose text names Form 8879, 8879-S/PE/C/F or 8878 is refused for SIGN-001.

**Evidence.** `src/blotter/signatures.ts`; `src/blotter/signatures-portal.ts`; `src/blotter/signatures-staff.ts`; `src/blotter/signatures-forms.ts`; `src/blotter/signatures-pdf.ts`; `src/blotter/signatures-retention.ts`; `src/ui/signatures.tsx`; `migrations/core/0087_signatures.sql`; `migrations/core/0090_signature_evidence.sql`; `tests/blotter/signatures.test.mjs`; `tests/blotter/signatures-ui.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: At consent; at signing; Blotter records the connection IP; user agent; Both appear on the certificate; are retained; erased with the signed record; For a document marked Form 2848 or 8821; a signer's signature is accepted only after a staff member records a remote-authentication attestation: the method (photo ID by selfie or video plus a secondary document; or personal knowledge); the verifier; the date; the items checked; The certificate states the form is electronically signed; may be submitted only online at IRS.gov/Submit2848; Staff representatives can be signers through their own session; A PDF whose text names Form 8879; 8879-S/PE/C/F or 8878 is refused for SIGN-001.

#### SIGN-010 — Implemented

Core · target · **partial** · From SIGN-002 · Cites BASE-AGENT-007, BASE-AUDIT-001, BASE-DATA-006 · Rules D-1

**Requirement.** Provide implemented. Mechanism: [details](docs/contract/mechanism.md).

**Acceptance.**
1. Consent and signature are one explicit submission, so the connection IP (the edge's connecting address) and user agent are captured once at that moment for each signer, stored only on the signer record, printed on the certificate as the consent-and-signature connection, and redacted with the signer record when the signed record is erased; they never enter the audit log.
2. A document is a Form 2848 or 8821 when its form kind, title or the PDF's own text names it; the attestation is recorded per remote (contact) signer and signing attempt by a staff member with the job, with method photo ID by selfie or video (name, SSN or ITIN, address and date of birth checked against a named secondary document) or personal knowledge (with how it was established), the verifier's name and a date not in the future; it cannot be changed once recorded, and a resend needs a fresh attestation.
3. The 8879/8878 check reads the PDF text as well as the form kind, title and file name.
4. A deactivated staff signer can no longer sign; the request is voided and re-requested.

**Evidence.** `src/blotter/signatures.ts`; `src/blotter/signatures-portal.ts`; `src/blotter/signatures-staff.ts`; `src/blotter/signatures-forms.ts`; `src/blotter/signatures-pdf.ts`; `src/blotter/signatures-retention.ts`; `src/ui/signatures.tsx`; `migrations/core/0087_signatures.sql`; `migrations/core/0090_signature_evidence.sql`; `tests/blotter/signatures.test.mjs`; `tests/blotter/signatures-ui.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Consent; signature are one explicit submission; so the connection IP (the edge's connecting address); user agent are captured once at that moment for each signer; stored only on the signer record; printed on the certificate as the consent-and-signature connection; and redacted with the signer record when the signed record is erased; they never enter the audit log; A document is a Form 2848 or 8821 when its form kind; title or the PDF's own text names it; the attestation is recorded per remote (contact) signer; signing attempt by a staff member with the job; with method photo ID by selfie or video (name; SSN or ITIN; address; date of birth checked against a named secondary document) or personal knowledge (with how it was established); the verifier's name; a date not in the future; it cannot be changed once recorded; and a resend needs a fresh attestation; The 8879/8878 check reads the PDF text as well as the form kind; title; file name; A deactivated staff signer can no longer sign; the request is voided; re-requested.

#### SIGN-011 — Implemented for SIGN-011

Core · target · **partial** · From SIGN-002 · Cites BASE-AUDIT-001, BASE-DATA-001, BASE-DATA-006, BASE-MAIL-001, BASE-ROLE-001 · Rules D-1

**Requirement.** Provide implemented for SIGN-011. Mechanism: [details](docs/contract/mechanism.md).

**Acceptance.**
1. AUTHZ-001 inherits this attestation and the Submit2848 statement when it prepares 2848/8821 records.
2. Staff/client work views file the signed PDF, certificate and timeline on the source client/work.
3. Pending requests move atomically during offboarding; completed requester attribution stays.
4. Signature-complete events use existing notification preferences, quiet hours, live authority and deduplication, and the automation source is rechecked inside its once-only effect batch.
5. Signed documents join ERASURE-002 signed_documents clocks from completion or later job sign-off, class/job/record holds, preview, expiry, counts, receipt and stale-restore fence; unfinished requests block erasure until completed or voided.
6. Restored pending/declined requests stay held and old bearer links remain excluded.
7. Outside mail/download copies name their holders.
8. Erased-client signed records disappear from normal lists and use opaque expiry labels; explicit retained detail/PDF doors require the principal and attribute the read.

**Evidence.** `src/blotter/signatures.ts`; `src/blotter/signatures-portal.ts`; `src/blotter/signatures-staff.ts`; `src/blotter/signatures-forms.ts`; `src/blotter/signatures-pdf.ts`; `src/blotter/signatures-retention.ts`; `src/ui/signatures.tsx`; `migrations/core/0087_signatures.sql`; `migrations/core/0090_signature_evidence.sql`; `tests/blotter/signatures.test.mjs`; `tests/blotter/signatures-ui.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: AUTHZ-001 inherits this attestation; the Submit2848 statement when it prepares 2848/8821 records; Staff/client work views file the signed PDF; certificate; timeline on the source client/work; Pending requests move atomically during offboarding; completed requester attribution stays; Signature-complete events use existing notification preferences; quiet hours; live authority; deduplication; and the automation source is rechecked inside its once-only effect batch; Signed documents join ERASURE-002 signed_documents clocks from completion or later job sign-off; class/job/record holds; preview; expiry; counts; receipt; stale-restore fence; unfinished requests block erasure until completed or voided; Restored pending/declined requests stay held; old bearer links remain excluded; Outside mail/download copies name their holders; Erased-client signed records disappear from normal lists; use opaque expiry labels; explicit retained detail/PDF doors require the principal; attribute the read.

#### SIGN-012 — Implemented for SIGN-012

Core · target · **partial** · From SIGN-002 · Cites BASE-ROLE-001 · Rules D-1

**Requirement.** Provide implemented for SIGN-012. Mechanism: [details](docs/contract/mechanism.md).

**Acceptance.**
1. SIGN-001 retains its separate required KBA and IP/login/KBA-result evidence; general signing refuses IRS e-file authorization forms (by label or PDF text) or any form marked KBA-required until that provider path ships.
2. FOLLOWUP-001 inherits unsigned-request chasing before its schedule door ships.

**Evidence.** `src/blotter/signatures.ts`; `src/blotter/signatures-portal.ts`; `src/blotter/signatures-staff.ts`; `src/blotter/signatures-forms.ts`; `src/blotter/signatures-pdf.ts`; `src/blotter/signatures-retention.ts`; `src/ui/signatures.tsx`; `migrations/core/0087_signatures.sql`; `migrations/core/0090_signature_evidence.sql`; `tests/blotter/signatures.test.mjs`; `tests/blotter/signatures-ui.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: SIGN-001 retains its separate required KBA; IP/login/KBA-result evidence; general signing refuses IRS e-file authorization forms (by label or PDF text) or any form marked KBA-required until that provider path ships; FOLLOWUP-001 inherits unsigned-request chasing before its schedule door ships.

#### AUTHZ-001 — Taxpayer authorizations 2848 and 8821

Core · target · **partial** · Cites BASE-ROLE-001 · Rules D-1

**Requirement.** Track IRS Form 2848 powers of attorney, Form 8821 tax information authorizations and state equivalents for each client. Each record holds the representative and CAF number, the tax matters, forms and periods covered, the signature date, the submission method (IRS online submission, Tax Pro Account or fax) and the recorded, rejected or withdrawn status. Blotter prepares the form from client and representative data for signature under SIGN-002 and files the signed copy. Transcript requests (INTEGRATE-006) and agency contact on notices (DUE-002) are blocked outside the scope of a recorded authorization. An alert fires before the covered periods run out for continuing engagements.

**Acceptance.**
1. Prepare a 2848 covering Form 1040 for 2022–2025, collect the client's and representative's signatures, and record its online submission and CAF-recorded status.
2. Request a 2021 transcript and confirm it is blocked as outside the authorization's scope, while a 2024 request proceeds.
3. Withdraw the authorization and confirm the dependent notice work is flagged and new transcript requests are refused.

**Evidence.** `src/blotter/authorizations.ts`; `src/blotter/authorization-prepare.ts`; `src/blotter/authorization-pdf.ts`; `src/ui/authorizations.tsx`; `src/ui/authorization-prepare.tsx`; `migrations/core/0092_authorizations.sql`; `tests/blotter/signatures.test.mjs`; `tests/blotter/signatures-ui.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Prepare a 2848 covering Form 1040 for 2022–2025; collect the client's; representative's signatures; and record its online submission; CAF-recorded status; Request a 2021 transcript; confirm it is blocked as outside the authorization's scope; while a 2024 request proceeds; Withdraw the authorization; confirm the dependent notice work is flagged; new transcript requests are refused.

#### AUTHZ-002 — The principal or a reviewer records a client's

Core · target · **partial** · From AUTHZ-001 · Cites BASE-ROLE-001 · Rules D-1

**Requirement.** Provide the principal or a reviewer records a client's.

**Acceptance.**
1. The principal or a reviewer records a client's Form 2848, Form 8821 or state authorization (representative, optional staff representative and CAF number, and one to ten tax matters with form and first/last year) as a draft; files its signed copy by linking a completed SIGN-002 request (a 2848 or 8821 only through a request that carried the remote-authentication attestation); records the submission (an electronically signed 2848 or 8821 only as IRS online submission, per IRS.gov/Submit2848); and records the agency's answer (recorded with the CAF number, or rejected with its reason) or a withdrawal.
2. A transcript request is recorded only inside a recorded 2848 or 8821 covering its form and year (retrieval is INTEGRATE-006).
3. Agency contact on a DUE-002 notice needs a recorded 2848 (federal) or the state agency's recorded authorization covering the year in the notice's tax period.
4. Withdrawal writes a flag into the timeline of each open notice it covered, ends its transcript requests and refuses new ones.

**Evidence.** `src/blotter/authorizations.ts`; `src/blotter/authorization-prepare.ts`; `src/blotter/authorization-pdf.ts`; `src/ui/authorizations.tsx`; `src/ui/authorization-prepare.tsx`; `migrations/core/0092_authorizations.sql`; `tests/blotter/signatures.test.mjs`; `tests/blotter/signatures-ui.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: The principal or a reviewer records a client's Form 2848; Form 8821 or state authorization (representative; optional staff representative; CAF number; and one to ten tax matters with form; first/last year) as a draft; files its signed copy by linking a completed SIGN-002 request (a 2848 or 8821 only through a request that carried the remote-authentication attestation); records the submission (an electronically signed 2848 or 8821 only as IRS online submission; per IRS.gov/Submit2848); and records the agency's answer (recorded with the CAF number; or rejected with its reason) or a withdrawal; A transcript request is recorded only inside a recorded 2848 or 8821 covering its form; year (retrieval is INTEGRATE-006); Agency contact on a DUE-002 notice needs a recorded 2848 (federal) or the state agency's recorded authorization covering the year in the notice's tax period; Withdrawal writes a flag into the timeline of each open notice it covered; ends its transcript requests; refuses new ones.

#### AUTHZ-003 — From october 1 of an authorization's last covered

Core · target · **partial** · From AUTHZ-001 · Cites BASE-AUDIT-001, BASE-DATA-001, BASE-DATA-006, BASE-MAIL-001, BASE-ROLE-001 · Rules D-1

**Requirement.** Provide from october 1 of an authorization's last covered.

**Acceptance.**
1. From October 1 of an authorization's last covered year, a client with an open job or active recurring rule raises one 'Authorization coverage ending' notification to the staff representative (or the principal), through the existing notification preferences, quiet hours and live authority.
2. Every step is in the client's history; the records are portable and join the signed_documents (authorizations, representative and CAF redacted on client erasure) and structure (transcript requests) classes.

**Evidence.** `src/blotter/authorizations.ts`; `src/blotter/authorization-prepare.ts`; `src/blotter/authorization-pdf.ts`; `src/ui/authorizations.tsx`; `src/ui/authorization-prepare.tsx`; `migrations/core/0092_authorizations.sql`; `tests/blotter/signatures.test.mjs`; `tests/blotter/signatures-ui.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: From October 1 of an authorization's last covered year; a client with an open job or active recurring rule raises one 'Authorization coverage ending' notification to the staff representative (or the principal); through the existing notification preferences; quiet hours; live authority; Every step is in the client's history; the records are portable; join the signed_documents (authorizations; representative; CAF redacted on client erasure); structure (transcript requests) classes.

#### AUTHZ-004 — Form preparation

Core · target · **partial** · From AUTHZ-001 · Cites BASE-AUDIT-001, BASE-ROLE-001 · Rules D-1

**Requirement.** Provide form preparation.

**Acceptance.**
1. Staff review the recorded scope, signer authority, representative eligibility and replacement of prior authorizations, then prepare the official January 2021 IRS Form 2848 or 8821 from taxpayer and representative details.
2. Values are flattened before SIGN-002 places the taxpayer signature/date and, for a 2848, the named staff representative's declaration signature/date.
3. More than three matters use a line-3 continuation page.
4. The TIN is kept only in that document, not audit detail or a separate client field.
5. Preparation creates a reviewable signature draft and sends nothing.
6. Staff supply a state agency's own equivalent through SIGN-002.
7. A completed IRS request must match the authorization's form kind before it can be filed.
8. Agency-contact entries name their tax form, and every year in the notice period must be covered; transcript and agency-contact writes recheck the recorded authorization inside the write.

**Evidence.** `src/blotter/authorizations.ts`; `src/blotter/authorization-prepare.ts`; `src/blotter/authorization-pdf.ts`; `src/ui/authorizations.tsx`; `src/ui/authorization-prepare.tsx`; `migrations/core/0092_authorizations.sql`; `tests/blotter/signatures.test.mjs`; `tests/blotter/signatures-ui.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Staff review the recorded scope; signer authority; representative eligibility; replacement of prior authorizations; then prepare the official January 2021 IRS Form 2848 or 8821 from taxpayer; representative details; Values are flattened before SIGN-002 places the taxpayer signature/date and; for a 2848; the named staff representative's declaration signature/date; More than three matters use a line-3 continuation page; The TIN is kept only in that document; not audit detail or a separate client field; Preparation creates a reviewable signature draft; sends nothing; Staff supply a state agency's own equivalent through SIGN-002; A completed IRS request must match the authorization's form kind before it can be filed; Agency-contact entries name their tax form; and every year in the notice period must be covered; transcript; agency-contact writes recheck the recorded authorization inside the write.

#### AUTHZ-005 — Form preparation for AUTHZ-005

Core · target · **partial** · From AUTHZ-001 · Cites BASE-ROLE-001 · Rules D-1

**Requirement.** Provide form preparation for AUTHZ-005.

**Acceptance.**
1. A continuing recurrence without an open job alerts the principal.
2. INTEGRATE-006 inherits actual transcript retrieval and its recorded-authorization scope; DUE-002 and NOTICE-001 inherit this scope for future agency-contact doors.
3. IRS submission and CAF acceptance here are practitioner-recorded facts, never automatic transmissions or inferred acceptance.

**Evidence.** `src/blotter/authorizations.ts`; `src/blotter/authorization-prepare.ts`; `src/blotter/authorization-pdf.ts`; `src/ui/authorizations.tsx`; `src/ui/authorization-prepare.tsx`; `migrations/core/0092_authorizations.sql`; `tests/blotter/signatures.test.mjs`; `tests/blotter/signatures-ui.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: A continuing recurrence without an open job alerts the principal; INTEGRATE-006 inherits actual transcript retrieval; its recorded-authorization scope; DUE-002; NOTICE-001 inherit this scope for future agency-contact doors; IRS submission; CAF acceptance here are practitioner-recorded facts; never automatic transmissions or inferred acceptance.

### Work deadlines and team delivery (target clauses)

#### WORK-001 — Reusable engagement templates

Core · target · **partial** · Rules D-1

**Requirement.** A principal or reviewer creates reusable monthly, quarterly or annual templates containing a checklist, document request list and fixed fee. Starting an engagement copies the template into its own period work so staff have concrete tasks and requests. Work types and statuses are WORK-007; task-level owners and dates are WORK-009; the maintained US starter library is WORK-008.

**Acceptance.**
1. Through the app or authenticated HTTP doors, create a recurring template, start a client job and inspect copied checklist, requests, recurrence, fee, preparer and reviewer.
2. A preparer cannot create templates.

**Evidence.** `src/blotter/clients.ts`; `src/blotter/jobs.ts`; `tests/blotter/flows.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Through the app or authenticated HTTP doors; create a recurring template; start a client job; inspect copied checklist; requests; recurrence; fee; preparer; reviewer; A preparer cannot create templates.

#### WORK-003 — Dependencies and conditional workflow

Core · target · **partial** · Cites BASE-ROLE-001 · Rules D-1

**Requirement.** Templates define task dependencies, conditional branches, required evidence and preparer/reviewer gates across jobs. Completion events advance only eligible steps, with visible reasons for blocked work; a dependency cycle is rejected and an authorized exception requires a recorded reason.

**Acceptance.**
1. Create a close feeding a tax engagement, branch on an organizer answer and complete prerequisite tasks.
2. Inspect automatic advancement and blocked successors; reject a cycle and record an authorized exception without fabricating evidence.

**Evidence.** `src/blotter/flow.ts`; `src/blotter/tasks.ts`; `src/blotter/jobs.ts`; `migrations/core/0027_task_flow.sql`; `src/ui/flow.tsx`; `tests/blotter/flows.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Create a close feeding a tax engagement; branch on an organizer answer; complete prerequisite tasks; Inspect automatic advancement; blocked successors; reject a cycle; record an authorized exception without fabricating evidence.

#### WORK-012 — template task may wait for other tasks

Core · target · **partial** · From WORK-003 · Cites BASE-AUDIT-001 · Rules D-1

**Requirement.** Provide a template task may wait for other tasks.

**Acceptance.**
1. A template task may wait for other tasks of its job, for accepted client documents (its required evidence) and for the same client's prerequisite job from a named template, submitted for review (preparer gate) or signed off (reviewer gate); that prerequisite is the job whose period contains this job's last period day.
2. A task may apply only when a job question has one of the chosen answers: unanswered, it waits; answered otherwise, it does not apply, is not needed for review, and counts as satisfied for tasks waiting on it.
3. Job staff can record workflow questions directly; confirmed PORTAL-004 submissions write their validated bound choices to those same questions, with contact attribution.
4. Drafts and unconfirmed carried values never choose a workflow branch; future answer sources inherit those rules .
5. Completion events (task done or reopened, document accepted, answer, job submitted, returned or signed off, exception) stamp each gated task that became ready and alert its owner, and clear the stamp when it is blocked again.

**Evidence.** `src/blotter/flow.ts`; `src/blotter/tasks.ts`; `src/blotter/jobs.ts`; `migrations/core/0027_task_flow.sql`; `src/ui/flow.tsx`; `tests/blotter/flows.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: A template task may wait for other tasks of its job; for accepted client documents (its required evidence); for the same client's prerequisite job from a named template; submitted for review (preparer gate) or signed off (reviewer gate); that prerequisite is the job whose period contains this job's last period day; A task may apply only when a job question has one of the chosen answers: unanswered; it waits; answered otherwise; it does not apply; is not needed for review; and counts as satisfied for tasks waiting on it; Job staff can record workflow questions directly; confirmed PORTAL-004 submissions write their validated bound choices to those same questions; with contact attribution; Drafts; unconfirmed carried values never choose a workflow branch; future answer sources inherit those rules ; Completion events (task done or reopened; document accepted; answer; job submitted; returned or signed off; exception) stamp each gated task that became ready; alert its owner; and clear the stamp when it is blocked again.

#### WORK-013 — cycle among a template's tasks is refused

Core · target · **partial** · From WORK-003 · Cites BASE-ROLE-001 · Rules D-1

**Requirement.** Provide a cycle among a template's tasks is refused.

**Acceptance.**
1. A cycle among a template's tasks is refused when it is saved; templates are saved as new versions that may wait only on templates that already exist, so cross-job waits cannot form a cycle.
2. The job's reviewer, its manager or the principal may record an exception with a required reason: the task can then be worked, but nothing it waited for is completed, its own required attachment is still required, review still needs every applicable task done and every document accepted, and an unanswered branch question is never waived.

**Evidence.** `src/blotter/flow.ts`; `src/blotter/tasks.ts`; `src/blotter/jobs.ts`; `migrations/core/0027_task_flow.sql`; `src/ui/flow.tsx`; `tests/blotter/flows.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: A cycle among a template's tasks is refused when it is saved; templates are saved as new versions that may wait only on templates that already exist; so cross-job waits cannot form a cycle; The job's reviewer; its manager or the principal may record an exception with a required reason: the task can then be worked; but nothing it waited for is completed; its own required attachment is still required; review still needs every applicable task done; every document accepted; and an unanswered branch question is never waived.

#### WORK-004 — Bulk work scheduling and assignment

Core · target · **partial** · Cites BASE-ROLE-001 · Rules D-1

**Requirement.** Preview and create or reschedule work for a selected client segment in bulk, resolving preparer/reviewer roles, staff eligibility and client-specific exceptions. Changes show impacted jobs and conflicts before approval and preserve existing work and independent review. Until CRM-002 client groups exist, the bulk segment is the clients selected in the batch, with include/exclude per client; once CRM-002 lands, choosing a group pre-selects its clients. Bulk start refuses any self-review assignment, including a principal as both preparer and reviewer. A solo principal starts such a job one at a time, where REVIEW-001’s acknowledged self-review applies.

**Acceptance.**
1. Preview quarterly jobs for the clients selected in a batch using per-client include/exclude; once CRM-002 client groups exist, verify choosing a group pre-selects its clients.
2. Override two assignees, exclude one client and commit.
3. Re-submit the same batch and inspect no duplicates, then bulk reassign work while refusing inactive or self-review assignments.
4. Verify bulk start refuses every self-review assignment, including a principal assigned as both preparer and reviewer; verify a solo principal can instead start such a job one at a time with REVIEW-001’s acknowledged self-review.

**Evidence.** `src/blotter/bulk.ts`; `src/ui/bulk.tsx`; `src/ui/clients.tsx`; `tests/blotter/flows.test.mjs`; `tests/blotter/work-bulk.test.mjs`; `tests/blotter/work-bulk-ui.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Preview quarterly jobs for the clients selected in a batch using per-client include/exclude; once CRM-002 client groups exist; verify choosing a group pre-selects its clients; Override two assignees; exclude one client; commit; Re-submit the same batch; inspect no duplicates; then bulk reassign work while refusing inactive or self-review assignments; Verify bulk start refuses every self-review assignment; including a principal assigned as both preparer; reviewer; verify a solo principal can instead start such a job one at a time with REVIEW-001’s acknowledged self-review.

#### WORK-005 — Firm work queues

Core · target · **partial** · Cites BASE-ROLE-001 · Rules D-1

**Requirement.** Staff see a due-date-ordered work queue with client, period, preparer, reviewer, status and outstanding checklist/document counts. Preparers see their assigned jobs; principals and reviewers see firm work and can open its detail.

**Acceptance.**
1. Create two jobs for different preparers, open the work queue as each role and inspect dates, assignees, status and outstanding counts.
2. Directly requesting another preparer's hidden job is refused.

**Evidence.** `src/blotter/clients.ts`; `src/ui/jobs.tsx`; `tests/blotter/flows.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Create two jobs for different preparers; open the work queue as each role; inspect dates; assignees; status; outstanding counts; Directly requesting another preparer's hidden job is refused.

#### WORK-006 — Personal plans boards and calendars

Core · target · **partial** · Cites BASE-ROLE-001 · Rules D-1

**Requirement.** Provide a weekly personal action plan of the person's jobs and tasks (WORK-009), Kanban boards and firm/client calendars filtered by work type, primary status, sub-status, assignee, due date, blocked status and priority. Board columns are the firm's primary statuses, or the selected work type's sub-statuses (WORK-007). Moving a card sets that status on the underlying job, respects workflow and review gates and fires status automations; calendar changes show deadline and capacity consequences.

**Acceptance.**
1. Plan a preparer's week from the overdue queue, group a 1040 board by sub-status, move an eligible card and inspect the same job's new status in queue, calendar and client views.
2. A blocked review transition is refused and filters persist after refresh.

**Evidence.** `src/blotter/planner.ts`; `src/blotter/filters.ts`; `src/blotter/statuses.ts`; `migrations/core/0041_plans_boards.sql`; `src/ui/plan.tsx`; `src/ui/calendar.tsx`; `src/ui/statuses.tsx`; `tests/blotter/flows.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Plan a preparer's week from the overdue queue; group a 1040 board by sub-status; move an eligible card; inspect the same job's new status in queue; calendar; client views; A blocked review transition is refused; filters persist after refresh.

#### WORK-014 — Status model

Core · target · **partial** · From WORK-006 · Cites BASE-AUDIT-001 · Rules D-1

**Requirement.** Provide status model.

**Acceptance.**
1. Moving a card or planning a job uses WORK-007's moves, sub-status limits and review gates and is recorded in its status history.

**Evidence.** `src/blotter/planner.ts`; `src/blotter/filters.ts`; `src/blotter/statuses.ts`; `migrations/core/0041_plans_boards.sql`; `src/ui/plan.tsx`; `src/ui/calendar.tsx`; `src/ui/statuses.tsx`; `tests/blotter/flows.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Moving a card or planning a job uses WORK-007's moves; sub-status limits; review gates; is recorded in its status history.

#### WORK-015 — The moved card's change appears in the job's

Core · target · **partial** · From WORK-006 · Cites BASE-AUDIT-001 · Rules D-1

**Requirement.** Provide the moved card's change appears in the job's.

**Acceptance.**
1. The moved card's change appears in the job's status history.

**Evidence.** `src/blotter/planner.ts`; `src/blotter/filters.ts`; `src/blotter/statuses.ts`; `migrations/core/0041_plans_boards.sql`; `src/ui/plan.tsx`; `src/ui/calendar.tsx`; `src/ui/statuses.tsx`; `tests/blotter/flows.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: The moved card's change appears in the job's status history.

#### WORK-016 — person's plan is a monday-to-sunday week: the

Core · target · **partial** · From WORK-006 · Cites BASE-ROLE-001 · Rules D-1

**Requirement.** Provide a person's plan is a monday-to-sunday week: the.

**Acceptance.**
1. A person's plan is a Monday-to-Sunday week: the jobs (where they are preparer, reviewer, manager or partner) and their own open tasks they place on its days, each job shown with its status, flags and WORK-007 move control, plus WORK-009's open tasks due in or before the week (or undated) and open jobs due in or before it to plan from; placing work never changes its status.
2. Each person plans their own week; until an admin role exists the principal opens and plans anyone's (pattern 2).
3. Boards, calendars and the queue share filters over the jobs a person may read: work type, stage, sub-status, client, assignee (the job's preparer, reviewer, manager or partner), due dates as an inclusive range, overdue (due before today in UTC and not completed), blocked (open with remaining tasks of which none is ready, each waiting on a WORK-003 dependency or answer, with those reasons shown) and priority (Low, Normal or High, Normal by default, set by the job's people until it is completed).

**Evidence.** `src/blotter/planner.ts`; `src/blotter/filters.ts`; `src/blotter/statuses.ts`; `migrations/core/0041_plans_boards.sql`; `src/ui/plan.tsx`; `src/ui/calendar.tsx`; `src/ui/statuses.tsx`; `tests/blotter/flows.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: A person's plan is a Monday-to-Sunday week: the jobs (where they are preparer; reviewer; manager or partner); their own open tasks they place on its days; each job shown with its status; flags; WORK-007 move control; plus WORK-009's open tasks due in or before the week (or undated); open jobs due in or before it to plan from; placing work never changes its status; Each person plans their own week; until an admin role exists the principal opens; plans anyone's (pattern 2); Boards; calendars; the queue share filters over the jobs a person may read: work type; stage; sub-status; client; assignee (the job's preparer; due dates as an inclusive range; overdue (due before today in UTC; not completed); blocked (open with remaining tasks of which none is ready; each waiting on a WORK-003 dependency or answer; with those reasons shown); priority (Low; Normal or High; Normal by default; set by the job's people until it is completed).

#### WORK-017 — board has a column per stage, or

Core · target · **partial** · From WORK-006 · Rules D-1

**Requirement.** Provide a board has a column per stage, or.

**Acceptance.**
1. A board has a column per stage, or for one chosen work type a column per stage and each sub-status that type may use (plus In review – partner sign-off when a job is in it); a card move is WORK-007's move, so In review and Completed are reached only by submission and sign-off.
2. The firm calendar shows jobs and their open tasks on their due dates over at most 62 days; the client filter makes it one client's calendar.
3. Moving a job's due date on the calendar is WORK-004's reschedule (principal or reviewer): its preview lists the task dates that follow it, anything that would fall due before today, and each person's estimated demand against available hours (CAPACITY-001) in every week the job's estimated work leaves or enters, and it commits only with that preview's fingerprint.
4. Each person's last board filters (with the column grouping) and calendar filters are kept for them, so a refresh opens the same view.

**Evidence.** `src/blotter/planner.ts`; `src/blotter/filters.ts`; `src/blotter/statuses.ts`; `migrations/core/0041_plans_boards.sql`; `src/ui/plan.tsx`; `src/ui/calendar.tsx`; `src/ui/statuses.tsx`; `tests/blotter/flows.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: A board has a column per stage; or for one chosen work type a column per stage; each sub-status that type may use (plus In review – partner sign-off when a job is in it); a card move is WORK-007's move; so In review; Completed are reached only by submission; sign-off; The firm calendar shows jobs; their open tasks on their due dates over at most 62 days; the client filter makes it one client's calendar; Moving a job's due date on the calendar is WORK-004's reschedule (principal or reviewer): its preview lists the task dates that follow it; anything that would fall due before today; and each person's estimated demand against available hours (CAPACITY-001) in every week the job's estimated work leaves or enters; and it commits only with that preview's fingerprint; Each person's last board filters (with the column grouping); calendar filters are kept for them; so a refresh opens the same view.

#### WORK-007 — Firm work types and status model

Core · target · **partial** · Cites BASE-AUDIT-001, BASE-ROLE-001 · Rules D-1

**Requirement.** The firm defines work types such as Monthly Bookkeeping, 1040, 1120-S, Payroll Quarterly, Sales Tax, Advisory and internal firm work. Each type has a default template, job roles (for example Manager, Preparer, Reviewer and Partner sign-off), default budget hours, a color and its permitted statuses. Every work item carries exactly one work type and one status. The status is one of six fixed primary stages (Planned, Ready to start, In progress, Waiting, In review, Completed) plus optional firm-defined sub-statuses under each stage, for example "Waiting – on client documents" or "In progress – ready to file". The firm limits each sub-status to selected work types. Statuses drive Kanban columns and personal plans (WORK-006), queue filters and saved views, automation triggers and actions (AUTOMATE-001), client-facing progress labels (PORTAL-003) and status reports (REPORT-001), including counts and time in each status. Mechanism: [details](docs/contract/mechanism.md).

**Acceptance.**
1. Create a 1040 work type and two sub-statuses under Waiting: "on client documents" and "on 8879 signature".
2. Limit the second to 1040 and confirm it is not offered on a Monthly Bookkeeping job.
3. Move a 1040 job through both sub-statuses on the board.
4. An automation fires once on entering "on 8879 signature".
5. Filter the queue and a saved view by that sub-status, and read a time-in-status report.
6. Moving a job to Completed without review is refused.
7. Deleting a sub-status in use is refused until a previewed bulk reassignment moves its jobs; status history is retained.
8. Import a Karbon work item under MIGRATE-001 and confirm it keeps its work type and status.

**Evidence.** `src/blotter/statuses.ts`; `src/blotter/jobs.ts`; `src/ui/statuses.tsx`; `migrations/core/0038_work_types_statuses.sql`; `migrations/core/0039_saved_views.sql`; `migrations/core/0040_job_roles.sql`; `tests/blotter/flows.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Create a 1040 work type; two sub-statuses under Waiting: "on client documents"; "on 8879 signature"; Limit the second to 1040; confirm it is not offered on a Monthly Bookkeeping job; Move a 1040 job through both sub-statuses on the board; An automation fires once on entering "on 8879 signature"; Filter the queue; a saved view by that sub-status; and read a time-in-status report; Moving a job to Completed without review is refused; Deleting a sub-status in use is refused until a previewed bulk reassignment moves its jobs; status history is retained; Import a Karbon work item under MIGRATE-001; confirm it keeps its work type; status.

#### WORK-018 — Capacity

Core · target · **partial** · From WORK-007 · Rules D-1

**Requirement.** Provide capacity. Mechanism: [details](docs/contract/mechanism.md).

**Acceptance.**
1. The capacity view's service filter selects jobs by work type.

**Evidence.** `src/blotter/statuses.ts`; `src/blotter/jobs.ts`; `src/ui/statuses.tsx`; `migrations/core/0038_work_types_statuses.sql`; `migrations/core/0039_saved_views.sql`; `migrations/core/0040_job_roles.sql`; `tests/blotter/flows.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: The capacity view's service filter selects jobs by work type.

#### WORK-019 — Filter the capacity week by the 1040 work

Core · target · **partial** · From WORK-007 · Rules D-1

**Requirement.** Provide filter the capacity week by the 1040 work. Mechanism: [details](docs/contract/mechanism.md).

**Acceptance.**
1. Filter the capacity week by the 1040 work type and see only 1040 demand.

**Evidence.** `src/blotter/statuses.ts`; `src/blotter/jobs.ts`; `src/ui/statuses.tsx`; `migrations/core/0038_work_types_statuses.sql`; `migrations/core/0039_saved_views.sql`; `migrations/core/0040_job_roles.sql`; `tests/blotter/flows.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Filter the capacity week by the 1040 work type; see only 1040 demand.

#### WORK-020 — Until an admin role exists the principal defines

Core · target · **partial** · From WORK-007 · Cites BASE-AUDIT-001, BASE-ROLE-001 · Rules D-1

**Requirement.** Provide until an admin role exists the principal defines. Mechanism: [details](docs/contract/mechanism.md).

**Acceptance.**
1. Until an admin role exists the principal defines work types (name unique ignoring case, optional default template, default budget in minutes applied when a job is started without one, #rrggbb color) and sub-statuses (one stage each, unique by name within it, limited to selected work types or open to every type).
2. Saving a template also creates a work type of the template's name with it as default template; a job carries the work type chosen when it is started, otherwise its template's, and a rolled-forward job keeps its predecessor's.
3. A new job starts Planned; jobs that existed before the status model start In progress, with history beginning at their current stage as of their submission, sign-off or creation.

**Evidence.** `src/blotter/statuses.ts`; `src/blotter/jobs.ts`; `src/ui/statuses.tsx`; `migrations/core/0038_work_types_statuses.sql`; `migrations/core/0039_saved_views.sql`; `migrations/core/0040_job_roles.sql`; `tests/blotter/flows.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Until an admin role exists the principal defines work types (name unique ignoring case; optional default template; default budget in minutes applied when a job is started without one; #rrggbb color); sub-statuses (one stage each; unique by name within it; limited to selected work types or open to every type); Saving a template also creates a work type of the template's name with it as default template; a job carries the work type chosen when it is started; otherwise its template's; and a rolled-forward job keeps its predecessor's; A new job starts Planned; jobs that existed before the status model start In progress; with history beginning at their current stage as of their submission; sign-off or creation.

#### WORK-021 — Planned, ready to start, in progress and waiting

Core · target · **partial** · From WORK-007 · Cites BASE-AUDIT-001, BASE-ROLE-001 · Rules D-1

**Requirement.** Provide planned, ready to start, in progress and waiting. Mechanism: [details](docs/contract/mechanism.md).

**Acceptance.**
1. Planned, Ready to start, In progress and Waiting (and their sub-statuses) are set by the job's people while it is open; In review is reached only by submission (or a client's approval that submits, recorded as that approval) and Completed only by sign-off; a return goes to In progress; entering In review or Completed clears the sub-status, and the database refuses any sub-status outside the job's current stage.
2. Each history entry records the old and new stage and sub-status, who and when (UTC); a rename shows the new name throughout history; a deleted sub-status keeps its name in history.
3. Deleting a sub-status that jobs use requires a preview naming the jobs and their target stage (open stages only for an open-stage sub-status, the same stage otherwise) and commits only with that preview's fingerprint, moving the jobs and recording each move.
4. The queue filters by work type, stage and sub-status over the jobs a person may read; time in status runs from each entry to the next (or now), in whole minutes rounded down, with entries, jobs now in it, total and average.

**Evidence.** `src/blotter/statuses.ts`; `src/blotter/jobs.ts`; `src/ui/statuses.tsx`; `migrations/core/0038_work_types_statuses.sql`; `migrations/core/0039_saved_views.sql`; `migrations/core/0040_job_roles.sql`; `tests/blotter/flows.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Planned; Ready to start; In progress; Waiting (and their sub-statuses) are set by the job's people while it is open; In review is reached only by submission (or a client's approval that submits; recorded as that approval); Completed only by sign-off; a return goes to In progress; entering In review or Completed clears the sub-status; and the database refuses any sub-status outside the job's current stage; Each history entry records the old; new stage; sub-status; who; when (UTC); a rename shows the new name throughout history; a deleted sub-status keeps its name in history; Deleting a sub-status that jobs use requires a preview naming the jobs; their target stage (open stages only for an open-stage sub-status; the same stage otherwise); commits only with that preview's fingerprint; moving the jobs; recording each move; The queue filters by work type; stage; sub-status over the jobs a person may read; time in status runs from each entry to the next (or now); in whole minutes rounded down; with entries; jobs now in it; total; average.

#### WORK-022 — Each person keeps private saved views of the

Core · target · **partial** · From WORK-007 · Rules D-1

**Requirement.** Provide each person keeps private saved views of the. Mechanism: [details](docs/contract/mechanism.md).

**Acceptance.**
1. Each person keeps private saved views of the queue (work type, stage, sub-status by name).
2. A sub-status may carry a client label: the client link shows it while the job is in that sub-status, otherwise the stage's name (PORTAL-003).

**Evidence.** `src/blotter/statuses.ts`; `src/blotter/jobs.ts`; `src/ui/statuses.tsx`; `migrations/core/0038_work_types_statuses.sql`; `migrations/core/0039_saved_views.sql`; `migrations/core/0040_job_roles.sql`; `tests/blotter/flows.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Each person keeps private saved views of the queue (work type; stage; sub-status by name); A sub-status may carry a client label: the client link shows it while the job is in that sub-status; otherwise the stage's name (PORTAL-003).

#### WORK-023 — Job roles

Core · target · **partial** · From WORK-007 · Rules D-1

**Requirement.** Provide job roles. Mechanism: [details](docs/contract/mechanism.md).

**Acceptance.**
1. A work type may also need a Manager and a Partner; a job of that type names them when it starts (jobs from recurring rules and bulk scheduling use the template's own type, which needs neither).
2. The partner is an active reviewer or the principal and never the preparer (enforced on every reassignment, offboarding and handover); the reviewer's sign-off records the review and leaves the job In review – partner sign-off, and only the named partner or the principal completes or returns it; a return clears the recorded review.

**Evidence.** `src/blotter/statuses.ts`; `src/blotter/jobs.ts`; `src/ui/statuses.tsx`; `migrations/core/0038_work_types_statuses.sql`; `migrations/core/0039_saved_views.sql`; `migrations/core/0040_job_roles.sql`; `tests/blotter/flows.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: A work type may also need a Manager; a Partner; a job of that type names them when it starts (jobs from recurring rules; bulk scheduling use the template's own type; which needs neither); The partner is an active reviewer or the principal; never the preparer (enforced on every reassignment; offboarding; handover); the reviewer's sign-off records the review; leaves the job In review – partner sign-off; and only the named partner or the principal completes or returns it; a return clears the recorded review.

#### WORK-008 — Starter US template library

Core · target · **partial** · Cites BASE-ROLE-001 · Rules D-1

**Requirement.** Blotter maintains a versioned starter library of US templates that a firm can adopt and edit: monthly bookkeeping close, quarterly payroll (941, state withholding and unemployment), sales-tax filing, the 1040, 1120-S, 1065, 1120, 1041 and 990 returns, year-end 1099 and W-2, tax notice response, new-client onboarding and client offboarding. Each template carries a work type and statuses (WORK-007), tasks with relative dates and role assignments (WORK-009), request lists, an organizer (PORTAL-004), budget hours and message templates (MSG-001). Adopting a template copies that version into the firm. Library updates arrive as a previewed diff the firm accepts or ignores change by change, and they never overwrite firm edits or existing jobs.

**Acceptance.**
1. In a new US firm, browse the library and adopt the 1040 and monthly close templates.
2. Edit one task and start a job from each, then inspect the copied tasks, requests, relative dates, statuses and messages.
3. Publish a library update, preview its diff, accept one change and reject another.
4. The firm's edited task survives and existing jobs are unchanged.

**Evidence.** `src/blotter/starter-content.ts`; `src/blotter/starter-library.ts`; `src/blotter/starter-diff.ts`; `src/blotter/starter-releases.ts`; `src/blotter/jobs.ts`; `src/ui/starter-library.tsx`; `migrations/core/0048_starter_library.sql`; `tests/blotter/library.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: In a new US firm; browse the library; adopt the 1040; monthly close templates; Edit one task; start a job from each; then inspect the copied tasks; requests; relative dates; statuses; messages; Publish a library update; preview its diff; accept one change; reject another; The firm's edited task survives; existing jobs are unchanged.

#### WORK-024 — The maintained native library contains monthly close; quarterly

Core · target · **partial** · From WORK-008 · Cites BASE-ROLE-001 · Rules D-1

**Requirement.** Provide the maintained native library contains monthly close; quarterly.

**Acceptance.**
1. The maintained native library contains monthly close; quarterly 941, state withholding and unemployment; sales-tax filing; 1040, 1120-S, 1065, 1120, 1041 and 990 returns; year-end 1099 and W-2; notice response; onboarding and offboarding.
2. Each adoption makes a firm template, its own WORK-007 work type with all six stages, WORK-009 role tasks and relative dates, requests, an integer-minute default budget and MSG-001 message copies.
3. Hours are minutes divided by 60, rounded to two decimals for display; planning offsets are whole days from the recorded period start or due date, not statutory calculations.
4. The principal adopts a chosen version, edits tasks, requests and budget, and edits messages through MSG-001.
5. A new job copies the then-current tasks, requests, budget and message text/version; later library changes never mutate those jobs.
6. Authored releases are bundled with the app; a principal can import a reviewed newer release package with its source/change note and author recorded.
7. Imported releases are immutable, never claim agency verification and never change adoptions automatically.

**Evidence.** `src/blotter/starter-content.ts`; `src/blotter/starter-library.ts`; `src/blotter/starter-diff.ts`; `src/blotter/starter-releases.ts`; `src/blotter/jobs.ts`; `src/ui/starter-library.tsx`; `migrations/core/0048_starter_library.sql`; `tests/blotter/library.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: The maintained native library contains monthly close; quarterly 941; state withholding; unemployment; sales-tax filing; 1040; 1120-S; 1065; 1120; 1041; 990 returns; year-end 1099; W-2; notice response; onboarding; offboarding; Each adoption makes a firm template; its own WORK-007 work type with all six stages; WORK-009 role tasks; relative dates; requests; an integer-minute default budget; MSG-001 message copies; Hours are minutes divided by 60; rounded to two decimals for display; planning offsets are whole days from the recorded period start or due date; not statutory calculations; The principal adopts a chosen version; edits tasks; budget; and edits messages through MSG-001; A new job copies the then-current tasks; message text/version; later library changes never mutate those jobs; Authored releases are bundled with the app; a principal can import a reviewed newer release package with its source/change note; author recorded; Imported releases are immutable; never claim agency verification; never change adoptions automatically.

#### WORK-025 — An update preview compares the prior adopted release

Core · target · **partial** · From WORK-008 · Cites BASE-ROLE-001 · Rules D-1

**Requirement.** Provide an update preview compares the prior adopted release.

**Acceptance.**
1. An update preview compares the prior adopted release, current firm copy (including MSG-001 edits/deletions) and new release, one task, request, message, budget or description at a time.
2. Each change is accepted or ignored; a conflicting firm edit must be retained, and stale previews are refused.
3. Ignored changes remain firm choices and the reviewed release becomes the next comparison baseline.

**Evidence.** `src/blotter/starter-content.ts`; `src/blotter/starter-library.ts`; `src/blotter/starter-diff.ts`; `src/blotter/starter-releases.ts`; `src/blotter/jobs.ts`; `src/ui/starter-library.tsx`; `migrations/core/0048_starter_library.sql`; `tests/blotter/library.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: An update preview compares the prior adopted release; current firm copy (including MSG-001 edits/deletions); new release; one task; request; message; budget or description at a time; Each change is accepted or ignored; a conflicting firm edit must be retained; and stale previews are refused; Ignored changes remain firm choices; the reviewed release becomes the next comparison baseline.

#### WORK-026 — Portal-004 integration

Core · target · **partial** · From WORK-008 · Rules D-1

**Requirement.** Provide portal-004 integration.

**Acceptance.**
1. Every authored library workflow now carries a versioned organizer with conditions and supporting-request bindings; firm question edits and individual release choices follow the same three-way conflict rules, and existing job snapshots stay unchanged.
2. Published packages can bind confirmed organizer choices to WORK-003 workflow questions; those bindings are validated before publication/adoption.

**Evidence.** `src/blotter/starter-content.ts`; `src/blotter/starter-library.ts`; `src/blotter/starter-diff.ts`; `src/blotter/starter-releases.ts`; `src/blotter/jobs.ts`; `src/ui/starter-library.tsx`; `migrations/core/0048_starter_library.sql`; `tests/blotter/library.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Every authored library workflow now carries a versioned organizer with conditions; supporting-request bindings; firm question edits; individual release choices follow the same three-way conflict rules; and existing job snapshots stay unchanged; Published packages can bind confirmed organizer choices to WORK-003 workflow questions; those bindings are validated before publication/adoption.

#### WORK-009 — Task assignees due dates and instructions

Core · target · **partial** · Cites BASE-ROLE-001 · Rules D-1

**Requirement.** Each task in a work item can have its own assignee (a named person or a job role), a start and due date relative to the work's start or due date, a time estimate, instructions with an SOP link, a required attachment and a client-facing flag (PORTAL-003). Completing a task records who completed it and when. Changing the person in a job role re-routes that role's open tasks, while completed tasks keep their completer. Personal plans (WORK-006) list the person's tasks as well as their jobs. Until WORK-007 adds firm job roles, a job's roles are Preparer, Reviewer and Manager, and the Manager is the job's reviewer unless someone is named when the job starts. The work's start date is its period start. Mechanism: [details](docs/contract/mechanism.md).

**Acceptance.**
1. Create a template with three tasks due 10, 5 and 2 days before the work's due date, assigned to Preparer, Manager and a named person.
2. Start a job and inspect the computed task dates and owners.
3. Move the work's due date and see the open task dates follow.
4. Change the job's Preparer and confirm the open tasks move to the new person, while a completed task keeps its original completer and time.
5. Open a task's SOP link, and see the tasks in the new owner's weekly plan.

**Evidence.** `src/blotter/tasks.ts`; `src/blotter/jobs.ts`; `migrations/core/0023_tasks.sql`; `src/ui/tasks.tsx`; `tests/blotter/flows.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Create a template with three tasks due 10; 5; 2 days before the work's due date; assigned to Preparer; Manager; a named person; Start a job; inspect the computed task dates; owners; Move the work's due date; see the open task dates follow; Change the job's Preparer; confirm the open tasks move to the new person; while a completed task keeps its original completer; time; Open a task's SOP link; and see the tasks in the new owner's weekly plan.

#### DUE-001 — Sourced US obligations and extensions

Core · target · **partial** · Cites BASE-ROLE-001 · Rules D-1

**Requirement.** Provide maintained federal and firm-selected state deadline templates for 1040, 1120-S, 1065, 941 and sales tax, with entity/period/fiscal-year applicability, weekend/holiday rules, state/local frequency and jurisdiction-specific extensions or disaster relief. Import IRS and state revenue calendar updates with source URL, effective date and rule version. A firm approves applicable rules and material changes, sees recalculated due dates and can override with reason; original, extended and internal dates remain distinct. Extension work stays open until the tax authority supplies filing evidence.

**Acceptance.**
1. Configure all five obligation types for clients in two states and different fiscal years.
2. Calculate a weekend/holiday case, import a source revision and preview affected jobs before approval.
3. Record an extension and override; verify separate original/extended/internal dates, preserved provenance and no claim of filing from a checklist.

**Evidence.** `src/blotter/deadlines.ts`; `src/blotter/deadline-calendar.ts`; `src/blotter/deadline-catalog.ts`; `src/blotter/jobs.ts`; `src/blotter/recurrence.ts`; `src/ui/deadlines.tsx`; `migrations/core/0068_deadlines.sql`; `tests/blotter/deadlines.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Configure all five obligation types for clients in two states; different fiscal years; Calculate a weekend/holiday case; import a source revision; preview affected jobs before approval; Record an extension; override; verify separate original/extended/internal dates; preserved provenance; no claim of filing from a checklist.

#### DUE-004 — Blotter ships a maintained catalog of sourced rules

Core · target · **partial** · From DUE-001 · Cites BASE-ROLE-001 · Rules D-1

**Requirement.** Provide blotter ships a maintained catalog of sourced rules.

**Acceptance.**
1. Blotter ships a maintained catalog (release 2026.1, effective 1 January 2026) of sourced rules, each with its agency source URL, version and effective date: federal 1040 (15th day of the 4th month after the tax year; Form 4868 extension to the 15th day of the 10th), 1120-S and 1065 (15th day of the 3rd month; Form 7004 to the 15th day of the 9th), 941 (last day of the month after each calendar quarter) and state sales tax (California CDTFA quarterly: last day of the month after the quarter; Texas Comptroller monthly: the 20th of the month after).
2. Blotter does not fetch agency sites: a person imports each IRS or state revision.
3. Until an admin role exists the principal approves each catalog rule for the firm (approving a state's rule selects that state; pattern 2), and a principal or reviewer configures a client obligation: one approved rule with the client's two-letter state, fiscal-year-end month (calendar-year rules always December) and internal lead days (0–90); a rule applies only to its entity types (individual, business, trust) and a state rule only to its own state.

**Evidence.** `src/blotter/deadlines.ts`; `src/blotter/deadline-calendar.ts`; `src/blotter/deadline-catalog.ts`; `src/blotter/jobs.ts`; `src/blotter/recurrence.ts`; `src/ui/deadlines.tsx`; `migrations/core/0068_deadlines.sql`; `tests/blotter/deadlines.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Blotter ships a maintained catalog (release 2026.1; effective 1 January 2026) of sourced rules; each with its agency source URL; version; effective date: federal 1040 (15th day of the 4th month after the tax year; Form 4868 extension to the 15th day of the 10th); 1120-S; 1065 (15th day of the 3rd month; Form 7004 to the 15th day of the 9th); 941 (last day of the month after each calendar quarter); state sales tax (California CDTFA quarterly: last day of the month after the quarter; Texas Comptroller monthly: the 20th of the month after); Blotter does not fetch agency sites: a person imports each IRS or state revision; Until an admin role exists the principal approves each catalog rule for the firm (approving a state's rule selects that state; pattern 2); and a principal or reviewer configures a client obligation: one approved rule with the client's two-letter state; fiscal-year-end month (calendar-year rules always December); internal lead days (0–90); a rule applies only to its entity types (individual; business; trust); a state rule only to its own state.

#### DUE-005 — job started from an obligation, rolled forward

Core · target · **partial** · From DUE-001 · Rules D-1

**Requirement.** Provide a job started from an obligation, rolled forward.

**Acceptance.**
1. A job started from an obligation, rolled forward from such a job, or created by a WORK-002 rule that names one takes its period from its template's cadence (starting on the first of a month; an annual period ends in the fiscal-year-end month, quarterly periods are the tax year's quarters) and keeps these dates apart: the statutory date; the original due date, which is the statutory date moved to the next business day past Saturdays, Sundays and federal legal holidays (5 U.S.C. 6103; a Saturday holiday is observed the Friday before, a Sunday one the Monday after) and, for federal rules, DC Emancipation Day (16 April, observed; 26 U.S.C. 7503), with the reason recorded; the extended due date (shifted the same way), which applies once a person on the job records the extension request, or at once for an automatic extension; a relief date from an approved disaster postponement whose jurisdiction, states, rules and inclusive window cover the original or extended date; the internal target (that external date less the obligation's lead days, moved earlier to a business day); and any override.

**Evidence.** `src/blotter/deadlines.ts`; `src/blotter/deadline-calendar.ts`; `src/blotter/deadline-catalog.ts`; `src/blotter/jobs.ts`; `src/blotter/recurrence.ts`; `src/ui/deadlines.tsx`; `migrations/core/0068_deadlines.sql`; `tests/blotter/deadlines.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: A job started from an obligation; rolled forward from such a job; or created by a WORK-002 rule that names one takes its period from its template's cadence (starting on the first of a month; an annual period ends in the fiscal-year-end month; quarterly periods are the tax year's quarters); keeps these dates apart: the statutory date; the original due date; which is the statutory date moved to the next business day past Saturdays; Sundays; federal legal holidays (5 U.S.C. 6103; a Saturday holiday is observed the Friday before; a Sunday one the Monday after) and; for federal rules; DC Emancipation Day (16 April; observed; 26 U.S.C. 7503); with the reason recorded; the extended due date (shifted the same way); which applies once a person on the job records the extension request; or at once for an automatic extension; a relief date from an approved disaster postponement whose jurisdiction; states; rules; inclusive window cover the original or extended date; the internal target (that external date less the obligation's lead days; moved earlier to a business day); and any override.

#### DUE-006 — The job's working due date is the override

Core · target · **partial** · From DUE-001 · Cites BASE-AGENT-007 · Rules D-1

**Requirement.** Provide the job's working due date is the override.

**Acceptance.**
1. The job's working due date is the override, else the relief, extended or original date; an override needs a principal or reviewer and a reason and never changes a calculated date.
2. A source revision is a JSON document with version, effective date, https source and changed rules (keeping each rule's key and jurisdiction) or relief windows; only the principal previews and approves it.
3. The preview lists every job not yet signed off whose dates or rule version change, and approval commits only with that preview's fingerprint, approving the revision's rules and recalculating those jobs; a job whose working date was set by hand (an override, or a WORK-004/WORK-006 move) keeps it while its calculated dates update.
4. Filing is never inferred from a checklist, review, sign-off or status: only a recorded agency acknowledgment (submission ID, accepted date and an acknowledgment file on the job, labeled practitioner-recorded until INTEGRATE-008 supplies stack status) marks a return filed, and a job whose extension was recorded cannot be signed off until it exists (pattern 3).
5. An agent's rule or revision decision carries commitment and takes the company's policy decision.

**Evidence.** `src/blotter/deadlines.ts`; `src/blotter/deadline-calendar.ts`; `src/blotter/deadline-catalog.ts`; `src/blotter/jobs.ts`; `src/blotter/recurrence.ts`; `src/ui/deadlines.tsx`; `migrations/core/0068_deadlines.sql`; `tests/blotter/deadlines.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: The job's working due date is the override; else the relief; extended or original date; an override needs a principal or reviewer; a reason; never changes a calculated date; A source revision is a JSON document with version; effective date; https source; changed rules (keeping each rule's key; jurisdiction) or relief windows; only the principal previews; approves it; The preview lists every job not yet signed off whose dates or rule version change; and approval commits only with that preview's fingerprint; approving the revision's rules; recalculating those jobs; a job whose working date was set by hand (an override; or a WORK-004/WORK-006 move) keeps it while its calculated dates update; Filing is never inferred from a checklist; review; sign-off or status: only a recorded agency acknowledgment (submission ID; accepted date; an acknowledgment file on the job; labeled practitioner-recorded until INTEGRATE-008 supplies stack status) marks a return filed; and a job whose extension was recorded cannot be signed off until it exists (pattern 3); An agent's rule or revision decision carries commitment; takes the company's policy decision.

#### DUE-007 — Rules, revisions, relief, obligations and job dates are

Core · target · **partial** · From DUE-001 · Cites BASE-DATA-001, BASE-DATA-006 · Rules D-1

**Requirement.** Provide rules, revisions, relief, obligations and job dates are.

**Acceptance.**
1. Rules, revisions, relief, obligations and job dates are carried by native archives and move with a merged client (CRM-004); the acknowledgment file follows file erasure and stale-archive fencing.

**Evidence.** `src/blotter/deadlines.ts`; `src/blotter/deadline-calendar.ts`; `src/blotter/deadline-catalog.ts`; `src/blotter/jobs.ts`; `src/blotter/recurrence.ts`; `src/ui/deadlines.tsx`; `migrations/core/0068_deadlines.sql`; `tests/blotter/deadlines.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Rules; revisions; relief; obligations; job dates are carried by native archives; move with a merged client (CRM-004); the acknowledgment file follows file erasure; stale-archive fencing.

#### DUE-002 — Tax notices and resolution work

Core · target · **partial** · Cites BASE-INPUT-003, BASE-ROLE-001 · Rules D-1

**Requirement.** Capture a federal/state notice with its source file, agency, tax period, response date, assigned practitioner, authorization and resolution plan. Track research, client questions, agency contact, response submission and follow-up until an acknowledged resolution or documented exception; link transcripts and filing receipts without treating them as tax advice. A notice opens from a document already filed on a job, such as a client upload, and its response date is the one printed on the notice, recorded and then verified by a person; Blotter never computes it. Until AUTHZ-001 tracks Forms 2848 and 8821, the authorization is the reference staff record on the notice; until INTEGRATE-006 retrieves transcripts, a transcript is a file staff attach, and AUTHZ-001 and INTEGRATE-006 inherit these links. The timeline is append-only. A notice closes only as resolved, backed by an evidence file on an agency contact, transcript, receipt or accepted response and with no failed response after the last accepted one, or as a documented exception with its reason; the assigned practitioner, a reviewer or the principal closes it.

**Acceptance.**
1. Open a notice from a client upload, verify the response deadline, assign a practitioner, link an authorized transcript and response receipt, and schedule follow-up.
2. A failed response stays open; closing requires evidence and a recorded outcome.

**Evidence.** `src/blotter/notices.ts`; `migrations/core/0026_notices.sql`; `src/ui/notices.tsx`; `tests/blotter/flows.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Open a notice from a client upload; verify the response deadline; assign a practitioner; link an authorized transcript; response receipt; and schedule follow-up; A failed response stays open; closing requires evidence; a recorded outcome.

#### DUE-003 — Wider US obligation catalog and firm defined deadlines

Core · target · **partial** · Cites BASE-ACCESSIBILITY-001 · Rules D-1

**Requirement.** Beyond DUE-001's five obligation types, Blotter maintains sourced deadline templates for Forms 1120, 1041, the 990 series, 940, W-2/W-3, 1099-NEC/1099-MISC, 1040-ES and 1120-W estimated payments, state withholding and unemployment returns, state annual reports and franchise taxes, and FinCEN 114 (FBAR) with its automatic extension. A firm can also define its own obligations: a fixed date, N days after period end, or the nth weekday of a month, each with a recorded source or a firm-defined label. The same approval, override, weekend/holiday and provenance rules as DUE-001 apply.

**Acceptance.**
1. Configure 1040-ES quarterly estimates including a weekend shift, the January 31 W-2 and 1099-NEC deadlines, an FBAR with its automatic October extension, and a firm rule of 15 days after month end.
2. Inspect the calculated dates and their sources.
3. Import a source revision and preview the affected jobs before approving it.
4. The firm rule shows as firm-defined rather than as an agency deadline.

**Evidence.** `src/blotter/deadline-catalog.ts`; `src/blotter/deadline-calendar.ts`; `src/blotter/deadlines.ts`; `src/blotter/recurrence.ts`; `src/ui/deadlines.tsx`; `migrations/core/0068_deadlines.sql`; `tests/blotter/deadlines.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Configure 1040-ES quarterly estimates including a weekend shift; the January 31 W-2; 1099-NEC deadlines; an FBAR with its automatic October extension; and a firm rule of 15 days after month end; Inspect the calculated dates; their sources; Import a source revision; preview the affected jobs before approving it; The firm rule shows as firm-defined rather than as an agency deadline.

#### DUE-008 — The 2026.1 catalog adds 1120 , 1041

Core · target · **partial** · From DUE-003 · Cites BASE-ACCESSIBILITY-001 · Rules D-1

**Requirement.** Provide the 2026.1 catalog adds 1120 , 1041 .

**Acceptance.**
1. The 2026.1 catalog adds 1120 (15th day of the 4th month; Form 7004 to the 15th day of the 10th; a fiscal year ending 30 June that starts before 1 January 2026 uses the 15th day of the 3rd month, extended to the 15th day of the 10th), 1041 (15th day of the 4th; Form 7004 to the last day of the 9th), the 990 series (15th day of the 5th; Form 8868 to the 15th day of the 11th), 940, W-2/W-3 and 1099-NEC (31 January after the calendar year), 1099-MISC filed electronically (31 March), 1040-ES (15 April, 15 June, 15 September and 15 January: the 15th day of the tax year's 4th, 6th, 9th and 13th months, one per quarter period) and 1120-W (15th day of the 4th, 6th, 9th and 12th months), FinCEN 114 (15 April with the automatic extension to 15 October, labeled automatic), state withholding and unemployment returns (California EDD DE 9 and Texas TWC C-3: last day of the month after the quarter), and state franchise taxes and annual reports (Texas franchise report 15 May, extension to 15 August on request; Delaware corporation annual report and franchise tax 1 March).

**Evidence.** `src/blotter/deadline-catalog.ts`; `src/blotter/deadline-calendar.ts`; `src/blotter/deadlines.ts`; `src/blotter/recurrence.ts`; `src/ui/deadlines.tsx`; `migrations/core/0068_deadlines.sql`; `tests/blotter/deadlines.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: The 2026.1 catalog adds 1120 (15th day of the 4th month; Form 7004 to the 15th day of the 10th; a fiscal year ending 30 June that starts before 1 January 2026 uses the 15th day of the 3rd month; extended to the 15th day of the 10th); 1041 (15th day of the 4th; Form 7004 to the last day of the 9th); the 990 series (15th day of the 5th; Form 8868 to the 15th day of the 11th); 940; W-2/W-3; 1099-NEC (31 January after the calendar year); 1099-MISC filed electronically (31 March); 1040-ES (15 April; 15 June; 15 September; 15 January: the 15th day of the tax year's 4th; 6th; 9th; 13th months; one per quarter period); 1120-W (15th day of the 4th; 12th months); FinCEN 114 (15 April with the automatic extension to 15 October; labeled automatic); state withholding; unemployment returns (California EDD DE 9; Texas TWC C-3: last day of the month after the quarter); and state franchise taxes; annual reports (Texas franchise report 15 May; extension to 15 August on request; Delaware corporation annual report; franchise tax 1 March).

#### DUE-009 — Only the principal defines a firm rule

Core · target · **partial** · From DUE-003 · Rules D-1

**Requirement.** Provide only the principal defines a firm rule .

**Acceptance.**
1. Only the principal defines a firm rule (defining it approves it; pattern 2): a fixed month and day (the first such date after the period ends), a number of calendar days after the period ends, or the nth (1–5, or last) weekday of the month a chosen number of months after the period-end month.
2. It carries an optional source or label (default "Firm-defined") and shows as a firm-defined deadline, never as an agency deadline, with no source URL; DUE-001's holiday shift (federal legal holidays, without DC Emancipation Day), obligation, override, revision and provenance rules apply to it unchanged.

**Evidence.** `src/blotter/deadline-catalog.ts`; `src/blotter/deadline-calendar.ts`; `src/blotter/deadlines.ts`; `src/blotter/recurrence.ts`; `src/ui/deadlines.tsx`; `migrations/core/0068_deadlines.sql`; `tests/blotter/deadlines.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Only the principal defines a firm rule (defining it approves it; pattern 2): a fixed month; day (the first such date after the period ends); a number of calendar days after the period ends; or the nth (1–5; or last) weekday of the month a chosen number of months after the period-end month; It carries an optional source or label (default "Firm-defined"); shows as a firm-defined deadline; never as an agency deadline; with no source URL; DUE-001's holiday shift (federal legal holidays; without DC Emancipation Day); obligation; override; revision; provenance rules apply to it unchanged.

#### RESOLVE-001 — Transcript analysis and resolution cases

Core · target · **missing** · Cites BASE-ROLE-001 · Rules D-1

**Requirement.** From authorized IRS account and wage-and-income transcripts (INTEGRATE-006), Blotter builds a per-year view for each client. It shows the assessed balance and the accrued penalties and interest as of the transcript date, each transaction code with a plain explanation, unfiled years, the collection statute expiration date (CSED) for each assessment, refund statute dates, and hold, lien or levy indicators. Each figure links to its transcript line. When a new pull changes a year, the change is flagged and routed to the assigned practitioner as notice or resolution work (DUE-002). Financial information for Forms 433-A and 433-F is collected through a PORTAL-004 organizer. Derived figures are labeled with their transcript date and are never presented as advice; the practitioner chooses the resolution path.

**Acceptance.**
1. Load authorized account transcripts for four years, including one unfiled year.
2. Inspect each year's balance, codes, CSED and unfiled flag against the source lines.
3. Pull again with a new transaction code and see a change alert routed to the practitioner.
4. Collect 433-A data through an organizer and inspect it on the case.
5. No resolution recommendation is made without the practitioner's decision.

**Evidence.** None.
**Gap.** No transcript parsing, per-year account analysis, CSED or change routing exists.

#### RESOLVE-002 — Portal-004

Core · target · **missing** · From RESOLVE-001 · Cites BASE-INPUT-003, BASE-ROLE-001 · Rules D-1

**Requirement.** Provide portal-004.

**Acceptance.**
1. Before its 433-A/F case organizers ship, they retain versioned conditional/required questions, authorized per-question contact responsibility, supporting uploads, save/resume, explicitly confirmed prior-period carry, immutable submitted corrections and staff completeness/review; only submitted current confirmations drive case/workflow choices.

**Evidence.** None.
**Gap.** No transcript parsing, per-year account analysis, CSED or change routing exists.

### Client communication portal and documents (target clauses)

#### MAIL-001 — Gmail and Microsoft 365 shared inbox

Core · target · **missing** · Cites BASE-MAIL-001, BASE-ROLE-001 · Rules D-1 · Register R-6

**Requirement.** Connect Gmail/Google Workspace and Microsoft 365/Exchange mailboxes with scoped OAuth, shared/delegated mailbox access and visible sync health. Triage threads into clients and engagements, assign email as work, comment internally, send/reply with the authorized identity using firm or personal templates (MSG-001) and file attachments against the correct job. Colleague visibility follows MAIL-002; snooze, scheduled send and no-reply follow-up are MAIL-003. Preserve message/thread identity, timestamps and authors, prevent duplicate sends/imports, and quarantine ambiguous client matches. Revocation stops access and surfaces unsynced work.

**Acceptance.**
1. Connect a real authorized Google mailbox and Microsoft shared mailbox, receive and reply to client threads, delegate one as a job and file an attachment.
2. Send the same event twice, introduce an ambiguous sender and revoke access; inspect one copy, explicit triage and actionable sync failure.

**Evidence.** None.
**Gap.** No connected email, shared inbox, email-to-task or attachment-sync adapter exists.

#### MAIL-004 — Time suggestions

Core · target · **missing** · From MAIL-001 · Cites BASE-MAIL-001 · Rules D-1 · Register R-6

**Requirement.** Provide time suggestions.

**Acceptance.**
1. A person's connected-mailbox activity becomes a TIME-001 activity-suggestion source only with that person's separate consent for mail, given and withdrawn by them; each suggestion links the message it came from, and nothing is recorded until they approve it.

**Evidence.** None.
**Gap.** No connected email, shared inbox, email-to-task or attachment-sync adapter exists.

#### MAIL-005 — With mail consent, a sent client reply suggests

Core · target · **missing** · From MAIL-001 · Cites BASE-MAIL-001 · Rules D-1 · Register R-6

**Requirement.** Provide with mail consent, a sent client reply suggests.

**Acceptance.**
1. With mail consent, a sent client reply suggests time on its job linking that message; without it, or after withdrawal, mail suggests nothing.

**Evidence.** None.
**Gap.** No connected email, shared inbox, email-to-task or attachment-sync adapter exists.

#### MAIL-006 — Offboarding for MAIL-006

Core · target · **missing** · From MAIL-001 · Cites BASE-MAIL-001, BASE-ROLE-001 · Rules D-1 · Register R-6

**Requirement.** Provide offboarding for MAIL-006.

**Acceptance.**
1. A departing staff member's connected mailbox, triaged threads and mailbox grants appear in the offboarding preview; the batch moves triaged threads to the work successor and deactivation revokes the mailbox grants.

**Evidence.** None.
**Gap.** No connected email, shared inbox, email-to-task or attachment-sync adapter exists.

#### MAIL-007 — Offboard a preparer with a connected mailbox; their

Core · target · **missing** · From MAIL-001 · Cites BASE-MAIL-001, BASE-ROLE-001 · Rules D-1 · Register R-6

**Requirement.** Provide offboard a preparer with a connected mailbox; their.

**Acceptance.**
1. Offboard a preparer with a connected mailbox; their grant is revoked, triaged threads follow the successor and sent mail keeps its author.

**Evidence.** None.
**Gap.** No connected email, shared inbox, email-to-task or attachment-sync adapter exists.

#### MAIL-008 — Message templates

Core · target · **missing** · From MAIL-001 · Cites BASE-ROLE-001 · Rules D-1 · Register R-6

**Requirement.** Provide message templates.

**Acceptance.**
1. An inbox reply composes from a firm or personal template, previews it for the exact recipient, is refused while a placeholder is unresolved, sends the version's attachments and stores its rendered text.

**Evidence.** None.
**Gap.** No connected email, shared inbox, email-to-task or attachment-sync adapter exists.

#### MAIL-009 — Reply to a client thread with the "month-end

Core · target · **missing** · From MAIL-001 · Rules D-1 · Register R-6

**Requirement.** Provide reply to a client thread with the "month-end.

**Acceptance.**
1. Reply to a client thread with the "Month-end close request" template and inspect the rendered reply, its attachment and the stored text.

**Evidence.** None.
**Gap.** No connected email, shared inbox, email-to-task or attachment-sync adapter exists.

#### MAIL-010 — Engagement history for MAIL-010

Core · target · **missing** · From MAIL-001 · Cites BASE-AUDIT-001, BASE-MAIL-001 · Rules D-1 · Register R-6

**Requirement.** Provide engagement history for MAIL-010.

**Acceptance.**
1. Sent and received client emails appear in the client's history with author, time and source link, visible only to those who may read the job, and any unresolved item it creates (an unanswered client email) names an owner, next action and due condition.

**Evidence.** None.
**Gap.** No connected email, shared inbox, email-to-task or attachment-sync adapter exists.

#### MAIL-011 — Trace a request from the client's email through

Core · target · **missing** · From MAIL-001 · Cites BASE-AUDIT-001, BASE-INPUT-003, BASE-MAIL-001 · Rules D-1 · Register R-6

**Requirement.** Provide trace a request from the client's email through.

**Acceptance.**
1. Trace a request from the client's email through upload and review in the client history.

**Evidence.** None.
**Gap.** No connected email, shared inbox, email-to-task or attachment-sync adapter exists.

#### MAIL-012 — Erasure-002 for MAIL-012

Core · target · **missing** · From MAIL-001 · Cites BASE-DATA-001, BASE-DATA-006, BASE-MAIL-001 · Rules D-1 · Register R-6

**Requirement.** Provide erasure-002 for MAIL-012.

**Acceptance.**
1. , MAIL-001 adds its records and provider copies to ERASURE-002's classes, clocks, holds, preview, erasure, receipt and restore fence.

**Evidence.** None.
**Gap.** No connected email, shared inbox, email-to-task or attachment-sync adapter exists.

#### MAIL-002 — Mailbox privacy and sharing

Core · target · **missing** · Cites BASE-AGENT-007, BASE-MAIL-001, BASE-ROLE-001 · Rules D-1

**Requirement.** When staff connect their own mailboxes, colleagues see only threads with matched client contacts and threads the mailbox owner explicitly shares. Personal, vendor and other non-client mail stays visible only to the mailbox owner. A user can mark any thread, sender or domain private, so it is never shared, triaged or summarized. A shared team mailbox such as info@ is visible to its assigned members. Firm administrators cannot read private threads through the app or API, and AI features (AI-001) and search (SEARCH-001) exclude them. Marking a client thread private later removes colleagues' access. Attachments already filed to a job stay filed, with the filing recorded.

**Acceptance.**
1. Connect a preparer's mailbox containing a client thread, a personal thread and a vendor thread.
2. A colleague and the owner see only the client thread.
3. Mark the client thread private: colleagues lose access, while its filed attachment stays on the job with its filing record.
4. Add a private-domain rule and confirm a new email from that domain is not shared.

**Evidence.** None.
**Gap.** No connected mailbox exists, so no client-only sharing, private-thread rules or private-mail exclusions exist.

#### MAIL-013 — Erasure-002 for MAIL-013

Core · target · **missing** · From MAIL-002 · Cites BASE-DATA-001, BASE-DATA-006, BASE-MAIL-001 · Rules D-1

**Requirement.** Provide erasure-002 for MAIL-013.

**Acceptance.**
1. , MAIL-002 adds its records and provider copies to ERASURE-002's classes, clocks, holds, preview, erasure, receipt and restore fence.

**Evidence.** None.
**Gap.** No connected mailbox exists, so no client-only sharing, private-thread rules or private-mail exclusions exist.

#### MAIL-003 — Triage controls snooze and scheduled send

Core · target · **missing** · Cites BASE-MAIL-001 · Rules D-1

**Requirement.** Each user and each shared mailbox has a triage list. From it a thread can be marked done, snoozed until a date and time (when it returns to triage), assigned to a colleague with a note, converted into a work item or task, or linked to existing work. Replies can be scheduled for a future time and canceled until sent. A no-reply follow-up reminder fires if the client has not answered by a date. Each client and work item has an email-in forwarding address. Triage counts by person show who has a backlog.

**Acceptance.**
1. Snooze a thread until tomorrow at 9:00 and see it return.
2. Assign another thread to a colleague with a note.
3. Convert one thread into a 1040 work item and link another to existing work.
4. Schedule a reply for Monday at 8:00, cancel and reschedule it, and confirm exactly one send.
5. Set a three-day no-reply reminder: it fires when the client stays silent and is canceled when the client replies.
6. Forward an email to a client's address and see it filed.

**Evidence.** None.
**Gap.** No mailbox triage list, snooze, assignment, scheduled send, no-reply reminder or email-in address exists.

#### MAIL-014 — Msg-002 marketing consent for MAIL-014

Core · target · **missing** · From MAIL-003 · Rules D-1

**Requirement.** Provide msg-002 marketing consent for MAIL-014.

**Acceptance.**
1. Scheduled inbox sends are engagement class only, with MSG-002's send-time recheck.

**Evidence.** None.
**Gap.** No mailbox triage list, snooze, assignment, scheduled send, no-reply reminder or email-in address exists.

#### MAIL-015 — Erasure-002 for MAIL-015

Core · target · **missing** · From MAIL-003 · Cites BASE-DATA-001, BASE-DATA-006, BASE-MAIL-001 · Rules D-1

**Requirement.** Provide erasure-002 for MAIL-015.

**Acceptance.**
1. , MAIL-003 adds its records and provider copies to ERASURE-002's classes, clocks, holds, preview, erasure, receipt and restore fence.

**Evidence.** None.
**Gap.** No mailbox triage list, snooze, assignment, scheduled send, no-reply reminder or email-in address exists.

#### MSG-001 — Firm and personal message templates

Core · target · **partial** · Cites BASE-MAIL-001, BASE-ROLE-001 · Rules D-1

**Requirement.** Owners maintain firm-wide message templates and staff keep personal ones. They are used for inbox replies (MAIL-001), portal messages (PORTAL-003), document requests and organizers (PORTAL-001, PORTAL-004), reminder-sequence steps (FOLLOWUP-001), signature and invoice notices (SIGN-001, BILL-004), text messages (SMS-001) and bulk messages (MSG-002). A template holds a subject, body, optional attachments and placeholders. The placeholders cover firm name, sender, client, contact first name, work item, work type, period, due date, the outstanding-requests list, portal link, and invoice amount and due date. Composing applies a template, renders it for the exact recipient and shows a preview. Sending is refused while any placeholder is unresolved or empty, with the missing field named, until the sender fills it in or edits the text. Each sent message stores its rendered text. Templates are versioned with their author, so editing or deleting one never changes sent messages. Mechanism: [details](docs/contract/mechanism.md).

**Acceptance.**
1. Create a "Month-end close request" firm template with client, period, due-date and outstanding-items placeholders.
2. Use it in an inbox reply and as step 2 of a reminder sequence, and inspect the rendered text for two clients with different periods and outstanding lists.
3. Remove one client's contact first name and confirm the send is refused naming that field.
4. Edit the template and confirm messages already sent are unchanged while the next reminder uses the new version.
5. A preparer cannot edit the firm template but can save a personal copy.

**Evidence.** `src/blotter/messages.ts`; `src/blotter/documents.ts`; `migrations/core/0025_messages.sql`; `migrations/core/0035_template_attachments.sql`; `migrations/core/0081_template_files_sent.sql`; `src/ui/messages.tsx`; `src/ui/client-portal.tsx`; `tests/blotter/flows.test.mjs`; `src/blotter/portal-items.ts`; `src/blotter/bulk-messages.ts`; `tests/blotter/bulk-messages.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Create a "Month-end close request" firm template with client; period; due-date; outstanding-items placeholders; Use it in an inbox reply; as step 2 of a reminder sequence; and inspect the rendered text for two clients with different periods; outstanding lists; Remove one client's contact first name; confirm the send is refused naming that field; Edit the template; confirm messages already sent are unchanged while the next reminder uses the new version; A preparer cannot edit the firm template but can save a personal copy.

#### MSG-003 — template version carries up to five attachments

Core · target · **partial** · From MSG-001 · Rules D-1

**Requirement.** Provide a template version carries up to five attachments. Mechanism: [details](docs/contract/mechanism.md).

**Acceptance.**
1. A template version carries up to five attachments of up to 1 MiB each; an edit keeps the previous version's files unless it replaces them, and a version's files never change.
2. Every message made from a template is sent with that version's files, even when the sender edited its text, and the sent message records each file's name, type, size and SHA-256.

**Evidence.** `src/blotter/messages.ts`; `src/blotter/documents.ts`; `migrations/core/0025_messages.sql`; `migrations/core/0035_template_attachments.sql`; `migrations/core/0081_template_files_sent.sql`; `src/ui/messages.tsx`; `src/ui/client-portal.tsx`; `tests/blotter/flows.test.mjs`; `src/blotter/portal-items.ts`; `src/blotter/bulk-messages.ts`; `tests/blotter/bulk-messages.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: A template version carries up to five attachments of up to 1 MiB each; an edit keeps the previous version's files unless it replaces them; and a version's files never change; Every message made from a template is sent with that version's files; even when the sender edited its text; and the sent message records each file's name; type; size; SHA-256.

#### MSG-004 — Composition doors

Core · target · **partial** · From MSG-001 · Cites BASE-MAIL-001, BASE-ROLE-001 · Rules D-1

**Requirement.** Provide composition doors. Mechanism: [details](docs/contract/mechanism.md).

**Acceptance.**
1. Document reminders, PORTAL-004 organizer invitations, portal messages (PORTAL-003) and bulk messages (MSG-002) compose from these templates with the same preview, refusal, files and stored rendered text.
2. A portal message is rendered for one authorized contact of the job (the chosen one, else the only or primary one), appears on the client's link and carries the version's files for download there.
3. It holds at most 2,000 characters once rendered, and `{{portal_link}}` renders as "this secure page" because the client is already on their link and no new link is made.
4. A bulk message cannot be filled in per recipient: a recipient whose rendering leaves a placeholder unresolved is excluded at preview with the field named (or held, not sent, if it changes before dispatch).
5. Document reminders and PORTAL-004 organizer invitations compose from these templates.
6. Inbox replies (MAIL-001), portal messages (PORTAL-003), reminder-sequence steps (FOLLOWUP-001), signature and invoice notices (SIGN-001, BILL-004), text messages (SMS-001) and bulk messages (MSG-002) each compose from these templates, with the same preview, refusal, attachments and stored rendered text.

**Evidence.** `src/blotter/messages.ts`; `src/blotter/documents.ts`; `migrations/core/0025_messages.sql`; `migrations/core/0035_template_attachments.sql`; `migrations/core/0081_template_files_sent.sql`; `src/ui/messages.tsx`; `src/ui/client-portal.tsx`; `tests/blotter/flows.test.mjs`; `src/blotter/portal-items.ts`; `src/blotter/bulk-messages.ts`; `tests/blotter/bulk-messages.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Document reminders; PORTAL-004 organizer invitations; portal messages (PORTAL-003); bulk messages (MSG-002) compose from these templates with the same preview; refusal; files; stored rendered text; A portal message is rendered for one authorized contact of the job (the chosen one; else the only or primary one); appears on the client's link; carries the version's files for download there; It holds at most 2,000 characters once rendered; and `{{portal_link}}` renders as "this secure page" because the client is already on their link; no new link is made; A bulk message cannot be filled in per recipient: a recipient whose rendering leaves a placeholder unresolved is excluded at preview with the field named (or held; not sent; if it changes before dispatch); PORTAL-004 organizer invitations compose from these templates; Inbox replies (MAIL-001); reminder-sequence steps (FOLLOWUP-001); signature; invoice notices (SIGN-001; BILL-004); text messages (SMS-001); bulk messages (MSG-002) each compose from these templates; with the same preview; attachments.

#### MSG-005 — Msg-002 marketing consent for MSG-005

Core · target · **partial** · From MSG-001 · Cites BASE-ROLE-001 · Rules D-1

**Requirement.** Provide msg-002 marketing consent for MSG-005. Mechanism: [details](docs/contract/mechanism.md).

**Acceptance.**
1. Each template version carries an immutable engagement or marketing category that only the principal changes, and marketing templates refuse engagement placeholders.

**Evidence.** `src/blotter/messages.ts`; `src/blotter/documents.ts`; `migrations/core/0025_messages.sql`; `migrations/core/0035_template_attachments.sql`; `migrations/core/0081_template_files_sent.sql`; `src/ui/messages.tsx`; `src/ui/client-portal.tsx`; `tests/blotter/flows.test.mjs`; `src/blotter/portal-items.ts`; `src/blotter/bulk-messages.ts`; `tests/blotter/bulk-messages.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Each template version carries an immutable engagement or marketing category that only the principal changes; and marketing templates refuse engagement placeholders.

#### MSG-002 — Bulk client messages

Core · target · **partial** · Cites BASE-AUDIT-001, BASE-MAIL-001 · Rules D-1

**Requirement.** Send one templated email or portal message (MSG-001) to a filtered client or contact segment, for example every 1040 client for a tax-season kickoff, or every client with a tag. Each message is rendered for its recipient. Before sending, staff preview the recipient count and sample renderings. Contacts who opted out or have no valid address are excluded and listed. Sends can be scheduled and are throttled within provider limits. A request or organizer can be attached for each recipient. Delivery, bounce and reply are tracked per recipient and filed to each client's history, and replies thread back to the individual client. Marketing messages carry a CAN-SPAM unsubscribe; engagement notices are transactional.

**Acceptance.**
1. Filter 40 individual clients by the 1040 work type.
2. Two opted-out clients and one without an email address are excluded and listed.
3. Preview three renderings and schedule the send.
4. After it runs, inspect per-recipient delivery and one bounce in each client's history.
5. A reply from one client threads to that client only.
6. Unsubscribing from a marketing message stops later marketing sends but not engagement notices, and resubmitting the batch sends no duplicate.

**Evidence.** `src/blotter/bulk-messages.ts`; `src/blotter/bulk-organizers.ts`; `migrations/core/0078_bulk_organizers.sql`; `tests/blotter/bulk-organizers.test.mjs`; `src/blotter/bulk-events.ts`; `src/blotter/marketing-consent.ts`; `src/blotter/unsubscribe-page.ts`; `src/blotter/messages.ts`; `src/blotter/intake.ts`; `src/blotter/intake-page.ts`; `src/blotter/prospects.ts`; `src/blotter/merges.ts`; `src/blotter/offboarding.ts`; `migrations/core/0075_bulk_messages.sql`; `migrations/core/0076_marketing_merge_holds.sql`; `API.md`; `tests/blotter/bulk-messages.test.mjs`; `src/blotter/imports/marketing.ts`; `src/ui/move-in.tsx`; `migrations/core/0079_import_marketing.sql`; `tests/blotter/import-mapping.test.mjs`; `tests/blotter/import-marketing-ui.mjs`; `src/blotter/marketing-suppression.ts`
**Gap.** Native email batches, class/consent refusals, rechecked throttled dispatch, unsubscribe, signed provider events, per-recipient request links and assigned-organizer invitations, the intake checkbox grant, contact-merge consent and offboarding batch transfer exist; real-provider proof, reply threading, the portal channel, incumbent migration consent mapping, contact-only erasure suppression and a bulk-message workspace screen are missing. Whole-client hashed withdrawal suppression now fences resumed import chunks atomically. Native CSV consent mapping with separately reviewed opt-ins and principal attestation exists. Template-version file attachments are implemented and asserted in `tests/blotter/bulk-messages.test.mjs` ("MSG-002 / NOTIFY-001 / BASE-001 bulk engagement and marketing messages").

#### MSG-006 — Authenticated http doors preview, approve, schedule and send

Core · target · **partial** · From MSG-002 · Cites BASE-DATA-001, BASE-MAIL-001, BASE-ROLE-001 · Rules D-1

**Requirement.** Provide authenticated http doors preview, approve, schedule and send.

**Acceptance.**
1. Authenticated HTTP doors preview, approve, schedule and send email batches (API.md).
2. The segment is the clients with a job or recurring rule of a chosen work type, a tag and/or an entity type; archived clients are listed as excluded.
3. An engagement batch needs a reason, and its template's subject and first line each contain an engagement placeholder (work type, work item, period, due date or outstanding requests; refusal g).
4. A client's basis is its earliest-due job of that work type not signed off, else an active recurring rule of it; the notice goes to the client's one active, authorized contact holding the chosen role (primary by default) with email consent and a valid address.
5. A marketing batch declares its topic, needs the firm's US postal address and the principal's approval of the exact preview fingerprint, and goes once per address to active contacts with email consent whose own grant is later, by when the contact acted, than every withdrawal of that address not voided by a correction (a withdrawal at the same instant wins); its templates use only firm, sender, first-name and client-name placeholders.

**Evidence.** `src/blotter/bulk-messages.ts`; `src/blotter/bulk-organizers.ts`; `migrations/core/0078_bulk_organizers.sql`; `tests/blotter/bulk-organizers.test.mjs`; `src/blotter/bulk-events.ts`; `src/blotter/marketing-consent.ts`; `src/blotter/unsubscribe-page.ts`; `src/blotter/messages.ts`; `src/blotter/intake.ts`; `src/blotter/intake-page.ts`; `src/blotter/prospects.ts`; `src/blotter/merges.ts`; `src/blotter/offboarding.ts`; `migrations/core/0075_bulk_messages.sql`; `migrations/core/0076_marketing_merge_holds.sql`; `API.md`; `tests/blotter/bulk-messages.test.mjs`; `src/blotter/imports/marketing.ts`; `src/ui/move-in.tsx`; `migrations/core/0079_import_marketing.sql`; `tests/blotter/import-mapping.test.mjs`; `tests/blotter/import-marketing-ui.mjs`; `src/blotter/marketing-suppression.ts`
**Gap.** Native email batches, class/consent refusals, rechecked throttled dispatch, unsubscribe, signed provider events, per-recipient request links and assigned-organizer invitations, the intake checkbox grant, contact-merge consent and offboarding batch transfer exist; real-provider proof, reply threading, the portal channel, incumbent migration consent mapping, contact-only erasure suppression and a bulk-message workspace screen are missing. Whole-client hashed withdrawal suppression now fences resumed import chunks atomically. Native CSV consent mapping with separately reviewed opt-ins and principal attestation exists. Template-version file attachments are implemented and asserted in `tests/blotter/bulk-messages.test.mjs` ("MSG-002 / NOTIFY-001 / BASE-001 bulk engagement and marketing messages").

#### MSG-007 — Every exclusion is listed with its reason, including

Core · target · **partial** · From MSG-002 · Cites BASE-DATA-001, BASE-MAIL-001, BASE-ROLE-001 · Rules D-1

**Requirement.** Provide every exclusion is listed with its reason, including.

**Acceptance.**
1. Every exclusion is listed with its reason, including an unresolved placeholder.
2. A repeated idempotency key returns the same batch, and resubmitting a schedule changes nothing.
3. The hourly trigger, or the run door, sends one chunk (1–500 recipients, default 50) of each due batch: each recipient is claimed, then rechecked (client, contact and address, email consent, role and basis or grant, the approving principal still active, postal address and restore hold); a failed recheck is recorded "held: not sent" and never retried, a provider refusal is failed and a lost outcome uncertain, and neither is resent.
4. Marketing mail carries a visible unsubscribe link (a 32-byte token whose SHA-256 alone is stored and which is redacted from the stored text), the one-click List-Unsubscribe headers and the postal address.
5. The public `/unsubscribe` page takes the link or a typed address and records an immediate, firm-wide withdrawal of marketing only.

**Evidence.** `src/blotter/bulk-messages.ts`; `src/blotter/bulk-organizers.ts`; `migrations/core/0078_bulk_organizers.sql`; `tests/blotter/bulk-organizers.test.mjs`; `src/blotter/bulk-events.ts`; `src/blotter/marketing-consent.ts`; `src/blotter/unsubscribe-page.ts`; `src/blotter/messages.ts`; `src/blotter/intake.ts`; `src/blotter/intake-page.ts`; `src/blotter/prospects.ts`; `src/blotter/merges.ts`; `src/blotter/offboarding.ts`; `migrations/core/0075_bulk_messages.sql`; `migrations/core/0076_marketing_merge_holds.sql`; `API.md`; `tests/blotter/bulk-messages.test.mjs`; `src/blotter/imports/marketing.ts`; `src/ui/move-in.tsx`; `migrations/core/0079_import_marketing.sql`; `tests/blotter/import-mapping.test.mjs`; `tests/blotter/import-marketing-ui.mjs`; `src/blotter/marketing-suppression.ts`
**Gap.** Native email batches, class/consent refusals, rechecked throttled dispatch, unsubscribe, signed provider events, per-recipient request links and assigned-organizer invitations, the intake checkbox grant, contact-merge consent and offboarding batch transfer exist; real-provider proof, reply threading, the portal channel, incumbent migration consent mapping, contact-only erasure suppression and a bulk-message workspace screen are missing. Whole-client hashed withdrawal suppression now fences resumed import chunks atomically. Native CSV consent mapping with separately reviewed opt-ins and principal attestation exists. Template-version file attachments are implemented and asserted in `tests/blotter/bulk-messages.test.mjs` ("MSG-002 / NOTIFY-001 / BASE-001 bulk engagement and marketing messages").

#### MSG-008 — Resend delivery, bounce and complaint webhooks are verified

Core · target · **partial** · From MSG-002 · Cites BASE-AUDIT-001, BASE-DATA-001, BASE-MAIL-001, BASE-ROLE-001 · Rules D-1

**Requirement.** Provide resend delivery, bounce and complaint webhooks are verified.

**Acceptance.**
1. Resend delivery, bounce and complaint webhooks are verified with `MAIL_WEBHOOK_SECRET` (Svix signature) and applied once per event id; a bounce not marked transient makes the address invalid for both classes, and a complaint withdraws marketing for the address and alerts the batch owner in-app.
2. Every send, hold, failure and provider event files to the client's history (the basis job's, when there is one) under messages, with its class.
3. Staff-recorded grants and withdrawals need evidence, and grants also need the exact wording, its version, language and when the contact acted; only the principal corrects, voiding a grant or a staff-recorded withdrawal, never the contact's own.
4. The principal's review list shows engagement notices sent to addresses without a current opt-in and records a misclassification once.
5. Document reminders, organizer invitations and automation refuse marketing templates.
6. Consent events and suppressions travel with archives; unsubscribe tokens and the principal's confirmations do not.
7. Restored batches return paused and need a fresh preview, unsent recipients are held, and marketing stays off until the principal confirms the consent log.

**Evidence.** `src/blotter/bulk-messages.ts`; `src/blotter/bulk-organizers.ts`; `migrations/core/0078_bulk_organizers.sql`; `tests/blotter/bulk-organizers.test.mjs`; `src/blotter/bulk-events.ts`; `src/blotter/marketing-consent.ts`; `src/blotter/unsubscribe-page.ts`; `src/blotter/messages.ts`; `src/blotter/intake.ts`; `src/blotter/intake-page.ts`; `src/blotter/prospects.ts`; `src/blotter/merges.ts`; `src/blotter/offboarding.ts`; `migrations/core/0075_bulk_messages.sql`; `migrations/core/0076_marketing_merge_holds.sql`; `API.md`; `tests/blotter/bulk-messages.test.mjs`; `src/blotter/imports/marketing.ts`; `src/ui/move-in.tsx`; `migrations/core/0079_import_marketing.sql`; `tests/blotter/import-mapping.test.mjs`; `tests/blotter/import-marketing-ui.mjs`; `src/blotter/marketing-suppression.ts`
**Gap.** Native email batches, class/consent refusals, rechecked throttled dispatch, unsubscribe, signed provider events, per-recipient request links and assigned-organizer invitations, the intake checkbox grant, contact-merge consent and offboarding batch transfer exist; real-provider proof, reply threading, the portal channel, incumbent migration consent mapping, contact-only erasure suppression and a bulk-message workspace screen are missing. Whole-client hashed withdrawal suppression now fences resumed import chunks atomically. Native CSV consent mapping with separately reviewed opt-ins and principal attestation exists. Template-version file attachments are implemented and asserted in `tests/blotter/bulk-messages.test.mjs` ("MSG-002 / NOTIFY-001 / BASE-001 bulk engagement and marketing messages").

#### MSG-009 — Carriers

Core · target · **partial** · From MSG-002 · Cites BASE-DATA-001, BASE-MAIL-001 · Rules D-1

**Requirement.** Provide carriers.

**Acceptance.**
1. The public intake form (CRM-005) offers an optional, unticked marketing checkbox, separate from the required reply consent, with the exact wording "Optional: also email me newsletters, seminar invitations and offers from this practice.
2. I can unsubscribe at any time." (version intake-marketing-v1, English).
3. A ticked box is kept with the inquiry; when the prospect is won it becomes the converted primary contact's email grant (source intake checkbox, acted when the inquiry was submitted, recorded by the person who won it).
4. No prospect receives marketing before conversion.
5. When a client merge (CRM-004) folds a contact into an active surviving contact with the same address, the surviving contact keeps email consent only if both had it.
6. Its marketing grants acted at or before the merge stop counting unless the merged contact also held a current grant, and only a grant the contact gives after the merge revives marketing.
7. Undo restores the surviving contact's email consent and lifts the hold, and the merged contact returns unchanged.

**Evidence.** `src/blotter/bulk-messages.ts`; `src/blotter/bulk-organizers.ts`; `migrations/core/0078_bulk_organizers.sql`; `tests/blotter/bulk-organizers.test.mjs`; `src/blotter/bulk-events.ts`; `src/blotter/marketing-consent.ts`; `src/blotter/unsubscribe-page.ts`; `src/blotter/messages.ts`; `src/blotter/intake.ts`; `src/blotter/intake-page.ts`; `src/blotter/prospects.ts`; `src/blotter/merges.ts`; `src/blotter/offboarding.ts`; `migrations/core/0075_bulk_messages.sql`; `migrations/core/0076_marketing_merge_holds.sql`; `API.md`; `tests/blotter/bulk-messages.test.mjs`; `src/blotter/imports/marketing.ts`; `src/ui/move-in.tsx`; `migrations/core/0079_import_marketing.sql`; `tests/blotter/import-mapping.test.mjs`; `tests/blotter/import-marketing-ui.mjs`; `src/blotter/marketing-suppression.ts`
**Gap.** Native email batches, class/consent refusals, rechecked throttled dispatch, unsubscribe, signed provider events, per-recipient request links and assigned-organizer invitations, the intake checkbox grant, contact-merge consent and offboarding batch transfer exist; real-provider proof, reply threading, the portal channel, incumbent migration consent mapping, contact-only erasure suppression and a bulk-message workspace screen are missing. Whole-client hashed withdrawal suppression now fences resumed import chunks atomically. Native CSV consent mapping with separately reviewed opt-ins and principal attestation exists. Template-version file attachments are implemented and asserted in `tests/blotter/bulk-messages.test.mjs` ("MSG-002 / NOTIFY-001 / BASE-001 bulk engagement and marketing messages").

#### MSG-010 — Carriers for MSG-010

Core · target · **partial** · From MSG-002 · Rules D-1

**Requirement.** Provide carriers for MSG-010.

**Acceptance.**
1. Offboarding (ACCESS-006) moves a departing member's unsent batches (previewed, scheduled, sending or paused) to the review successor, because only the principal and reviewers send batches; sent batches keep their owner.
2. A moved engagement batch keeps its schedule and sends under the successor; a moved marketing batch loses its approval and returns to previewed until the principal approves the same preview again.

**Evidence.** `src/blotter/bulk-messages.ts`; `src/blotter/bulk-organizers.ts`; `migrations/core/0078_bulk_organizers.sql`; `tests/blotter/bulk-organizers.test.mjs`; `src/blotter/bulk-events.ts`; `src/blotter/marketing-consent.ts`; `src/blotter/unsubscribe-page.ts`; `src/blotter/messages.ts`; `src/blotter/intake.ts`; `src/blotter/intake-page.ts`; `src/blotter/prospects.ts`; `src/blotter/merges.ts`; `src/blotter/offboarding.ts`; `migrations/core/0075_bulk_messages.sql`; `migrations/core/0076_marketing_merge_holds.sql`; `API.md`; `tests/blotter/bulk-messages.test.mjs`; `src/blotter/imports/marketing.ts`; `src/ui/move-in.tsx`; `migrations/core/0079_import_marketing.sql`; `tests/blotter/import-mapping.test.mjs`; `tests/blotter/import-marketing-ui.mjs`; `src/blotter/marketing-suppression.ts`
**Gap.** Native email batches, class/consent refusals, rechecked throttled dispatch, unsubscribe, signed provider events, per-recipient request links and assigned-organizer invitations, the intake checkbox grant, contact-merge consent and offboarding batch transfer exist; real-provider proof, reply threading, the portal channel, incumbent migration consent mapping, contact-only erasure suppression and a bulk-message workspace screen are missing. Whole-client hashed withdrawal suppression now fences resumed import chunks atomically. Native CSV consent mapping with separately reviewed opt-ins and principal attestation exists. Template-version file attachments are implemented and asserted in `tests/blotter/bulk-messages.test.mjs` ("MSG-002 / NOTIFY-001 / BASE-001 bulk engagement and marketing messages").

#### MSG-011 — Request attached per recipient

Core · target · **partial** · From MSG-002 · Cites BASE-INPUT-003 · Rules D-1

**Requirement.** Provide request attached per recipient.

**Acceptance.**
1. An engagement template that uses the portal-link placeholder attaches the recipient's document request.
2. Each recipient gets its own secure upload link to its basis job's outstanding requests, valid for 30 days and issued only at send, after the recheck, replacing any earlier link that contact held for that job.
3. The preview shows a placeholder instead of a link and lists as excluded each recipient whose basis is only a recurring rule (no open job) or whose contact lacks portal and request consent.
4. Dispatch holds a recipient whose consent lapsed or whose job closed.
5. The stored text redacts the link, and a marketing template cannot use the placeholder.

**Evidence.** `src/blotter/bulk-messages.ts`; `src/blotter/bulk-organizers.ts`; `migrations/core/0078_bulk_organizers.sql`; `tests/blotter/bulk-organizers.test.mjs`; `src/blotter/bulk-events.ts`; `src/blotter/marketing-consent.ts`; `src/blotter/unsubscribe-page.ts`; `src/blotter/messages.ts`; `src/blotter/intake.ts`; `src/blotter/intake-page.ts`; `src/blotter/prospects.ts`; `src/blotter/merges.ts`; `src/blotter/offboarding.ts`; `migrations/core/0075_bulk_messages.sql`; `migrations/core/0076_marketing_merge_holds.sql`; `API.md`; `tests/blotter/bulk-messages.test.mjs`; `src/blotter/imports/marketing.ts`; `src/ui/move-in.tsx`; `migrations/core/0079_import_marketing.sql`; `tests/blotter/import-mapping.test.mjs`; `tests/blotter/import-marketing-ui.mjs`; `src/blotter/marketing-suppression.ts`
**Gap.** Native email batches, class/consent refusals, rechecked throttled dispatch, unsubscribe, signed provider events, per-recipient request links and assigned-organizer invitations, the intake checkbox grant, contact-merge consent and offboarding batch transfer exist; real-provider proof, reply threading, the portal channel, incumbent migration consent mapping, contact-only erasure suppression and a bulk-message workspace screen are missing. Whole-client hashed withdrawal suppression now fences resumed import chunks atomically. Native CSV consent mapping with separately reviewed opt-ins and principal attestation exists. Template-version file attachments are implemented and asserted in `tests/blotter/bulk-messages.test.mjs` ("MSG-002 / NOTIFY-001 / BASE-001 bulk engagement and marketing messages").

#### MSG-012 — Still open

Core · target · **partial** · From MSG-002 · Cites BASE-DATA-006, BASE-MAIL-001, BASE-ROLE-001 · Rules D-1

**Requirement.** Provide still open.

**Acceptance.**

**Evidence.** `src/blotter/bulk-messages.ts`; `src/blotter/bulk-organizers.ts`; `migrations/core/0078_bulk_organizers.sql`; `tests/blotter/bulk-organizers.test.mjs`; `src/blotter/bulk-events.ts`; `src/blotter/marketing-consent.ts`; `src/blotter/unsubscribe-page.ts`; `src/blotter/messages.ts`; `src/blotter/intake.ts`; `src/blotter/intake-page.ts`; `src/blotter/prospects.ts`; `src/blotter/merges.ts`; `src/blotter/offboarding.ts`; `migrations/core/0075_bulk_messages.sql`; `migrations/core/0076_marketing_merge_holds.sql`; `API.md`; `tests/blotter/bulk-messages.test.mjs`; `src/blotter/imports/marketing.ts`; `src/ui/move-in.tsx`; `migrations/core/0079_import_marketing.sql`; `tests/blotter/import-mapping.test.mjs`; `tests/blotter/import-marketing-ui.mjs`; `src/blotter/marketing-suppression.ts`
**Gap.** Native email batches, class/consent refusals, rechecked throttled dispatch, unsubscribe, signed provider events, per-recipient request links and assigned-organizer invitations, the intake checkbox grant, contact-merge consent and offboarding batch transfer exist; real-provider proof, reply threading, the portal channel, incumbent migration consent mapping, contact-only erasure suppression and a bulk-message workspace screen are missing. Whole-client hashed withdrawal suppression now fences resumed import chunks atomically. Native CSV consent mapping with separately reviewed opt-ins and principal attestation exists. Template-version file attachments are implemented and asserted in `tests/blotter/bulk-messages.test.mjs` ("MSG-002 / NOTIFY-001 / BASE-001 bulk engagement and marketing messages").

#### MSG-013 — Marketing consent and message class

Core · target · **partial** · From MSG-002 · Cites BASE-MAIL-001, BASE-ROLE-001 · Rules D-1

**Requirement.** Provide marketing consent and message class.

**Acceptance.**
1. This is Blotter product policy, stricter than CAN-SPAM's opt-out baseline, and not legal certification. *Opt-in (Q1):* marketing needs its own explicit, affirmative opt-in for each channel (email, portal), in addition to everything ordinary email needs; existing email consent never authorizes it. *Class (Q2):* every batch and every message carries one class, engagement or marketing, fixed at preview.
2. Engagement covers only the recipient's current relationship: requests and organizers, deadlines and status of engaged work, terms or fee changes, invoices, statements and payments, account, portal and security notices, and changes affecting delivery.
3. Marketing is any promotion, offer, event, newsletter, referral or review request, or firm news not tied to a current engagement; a mixed message is marketing.

**Evidence.** `src/blotter/bulk-messages.ts`; `src/blotter/bulk-organizers.ts`; `migrations/core/0078_bulk_organizers.sql`; `tests/blotter/bulk-organizers.test.mjs`; `src/blotter/bulk-events.ts`; `src/blotter/marketing-consent.ts`; `src/blotter/unsubscribe-page.ts`; `src/blotter/messages.ts`; `src/blotter/intake.ts`; `src/blotter/intake-page.ts`; `src/blotter/prospects.ts`; `src/blotter/merges.ts`; `src/blotter/offboarding.ts`; `migrations/core/0075_bulk_messages.sql`; `migrations/core/0076_marketing_merge_holds.sql`; `API.md`; `tests/blotter/bulk-messages.test.mjs`; `src/blotter/imports/marketing.ts`; `src/ui/move-in.tsx`; `migrations/core/0079_import_marketing.sql`; `tests/blotter/import-mapping.test.mjs`; `tests/blotter/import-marketing-ui.mjs`; `src/blotter/marketing-suppression.ts`
**Gap.** Native email batches, class/consent refusals, rechecked throttled dispatch, unsubscribe, signed provider events, per-recipient request links and assigned-organizer invitations, the intake checkbox grant, contact-merge consent and offboarding batch transfer exist; real-provider proof, reply threading, the portal channel, incumbent migration consent mapping, contact-only erasure suppression and a bulk-message workspace screen are missing. Whole-client hashed withdrawal suppression now fences resumed import chunks atomically. Native CSV consent mapping with separately reviewed opt-ins and principal attestation exists. Template-version file attachments are implemented and asserted in `tests/blotter/bulk-messages.test.mjs` ("MSG-002 / NOTIFY-001 / BASE-001 bulk engagement and marketing messages").

#### MSG-014 — Marketing consent and message class for MSG-014

Core · target · **partial** · From MSG-002 · Cites BASE-AUDIT-001, BASE-DATA-001, BASE-ROLE-001 · Rules D-1

**Requirement.** Provide marketing consent and message class for MSG-014.

**Acceptance.**
1. Refusals: (a) an engagement batch declares a reason and a basis for each recipient (an open job, an active recurring rule, signed scope, an unpaid invoice, or, for account notices only, a portal account), and a recipient without one is excluded and listed; (b) prospects and archived clients never receive engagement class; (c) each template version carries an immutable engagement or marketing category, an engagement batch refuses a marketing-category template, and only the principal changes a category; (d) marketing templates refuse engagement placeholders and request or organizer attachments; (e) class cannot change after preview, and moving content from marketing to engagement needs a new batch, the principal's recorded reason and linked audit records; (f) the principal reviews the engagement notices sent to people without a marketing opt-in and can mark one misclassified; (g) the subject and opening of an engagement notice are engagement content.

**Evidence.** `src/blotter/bulk-messages.ts`; `src/blotter/bulk-organizers.ts`; `migrations/core/0078_bulk_organizers.sql`; `tests/blotter/bulk-organizers.test.mjs`; `src/blotter/bulk-events.ts`; `src/blotter/marketing-consent.ts`; `src/blotter/unsubscribe-page.ts`; `src/blotter/messages.ts`; `src/blotter/intake.ts`; `src/blotter/intake-page.ts`; `src/blotter/prospects.ts`; `src/blotter/merges.ts`; `src/blotter/offboarding.ts`; `migrations/core/0075_bulk_messages.sql`; `migrations/core/0076_marketing_merge_holds.sql`; `API.md`; `tests/blotter/bulk-messages.test.mjs`; `src/blotter/imports/marketing.ts`; `src/ui/move-in.tsx`; `migrations/core/0079_import_marketing.sql`; `tests/blotter/import-mapping.test.mjs`; `tests/blotter/import-marketing-ui.mjs`; `src/blotter/marketing-suppression.ts`
**Gap.** Native email batches, class/consent refusals, rechecked throttled dispatch, unsubscribe, signed provider events, per-recipient request links and assigned-organizer invitations, the intake checkbox grant, contact-merge consent and offboarding batch transfer exist; real-provider proof, reply threading, the portal channel, incumbent migration consent mapping, contact-only erasure suppression and a bulk-message workspace screen are missing. Whole-client hashed withdrawal suppression now fences resumed import chunks atomically. Native CSV consent mapping with separately reviewed opt-ins and principal attestation exists. Template-version file attachments are implemented and asserted in `tests/blotter/bulk-messages.test.mjs` ("MSG-002 / NOTIFY-001 / BASE-001 bulk engagement and marketing messages").

#### MSG-015 — Marketing consent and message class for MSG-015

Core · target · **partial** · From MSG-002 · Cites BASE-MAIL-001 · Rules D-1

**Requirement.** Provide marketing consent and message class for MSG-015.

**Acceptance.**
1. The principal and reviewers send engagement batches; the principal approves every marketing batch. *Consent record (Q3):* an append-only log; each event records the contact relationship and address, purpose, channel (email or portal), grant, withdrawal or correction, source (intake checkbox, portal preference, staff-recorded with evidence, import, migration, unsubscribe link, one-click header, staff-recorded reply, provider complaint or owner correction), when the contact acted and when it was recorded (UTC), actor, exact wording and version, language and evidence.
2. Consent is never pre-ticked, never bundled into an engagement letter or signature, never a condition of service and never inferred from other consents. *Scope (Q4):* grants are per contact relationship; withdrawals apply to the address across the whole firm.
3. Marketing eligibility needs an active contact on an active, unmerged client, a valid address, email_consent=1, and a grant later than every withdrawal for that address.
4. Marketing is sent once per address per batch, with only the firm, sender, first-name and client-name placeholders; engagement notices still go per client under the existing recipient rules.
5. When two contacts merge, the most restrictive consent wins and undo is exact.

**Evidence.** `src/blotter/bulk-messages.ts`; `src/blotter/bulk-organizers.ts`; `migrations/core/0078_bulk_organizers.sql`; `tests/blotter/bulk-organizers.test.mjs`; `src/blotter/bulk-events.ts`; `src/blotter/marketing-consent.ts`; `src/blotter/unsubscribe-page.ts`; `src/blotter/messages.ts`; `src/blotter/intake.ts`; `src/blotter/intake-page.ts`; `src/blotter/prospects.ts`; `src/blotter/merges.ts`; `src/blotter/offboarding.ts`; `migrations/core/0075_bulk_messages.sql`; `migrations/core/0076_marketing_merge_holds.sql`; `API.md`; `tests/blotter/bulk-messages.test.mjs`; `src/blotter/imports/marketing.ts`; `src/ui/move-in.tsx`; `migrations/core/0079_import_marketing.sql`; `tests/blotter/import-mapping.test.mjs`; `tests/blotter/import-marketing-ui.mjs`; `src/blotter/marketing-suppression.ts`
**Gap.** Native email batches, class/consent refusals, rechecked throttled dispatch, unsubscribe, signed provider events, per-recipient request links and assigned-organizer invitations, the intake checkbox grant, contact-merge consent and offboarding batch transfer exist; real-provider proof, reply threading, the portal channel, incumbent migration consent mapping, contact-only erasure suppression and a bulk-message workspace screen are missing. Whole-client hashed withdrawal suppression now fences resumed import chunks atomically. Native CSV consent mapping with separately reviewed opt-ins and principal attestation exists. Template-version file attachments are implemented and asserted in `tests/blotter/bulk-messages.test.mjs` ("MSG-002 / NOTIFY-001 / BASE-001 bulk engagement and marketing messages").

#### MSG-016 — Marketing consent and message class for MSG-016

Core · target · **partial** · From MSG-002 · Cites BASE-MAIL-001, BASE-ROLE-001 · Rules D-1

**Requirement.** Provide marketing consent and message class for MSG-016.

**Acceptance.**
1. Prospects get marketing only with their own opt-in. *Withdrawals (Q5):* every marketing email carries a visible link to a one-page unsubscribe needing no sign-in, fee or extra fields, whose token is stored hashed; it also carries the one-click unsubscribe headers and the firm's US postal address, and a marketing send without that address is refused.
2. The page also accepts a typed address, so it keeps working well past the 30-day minimum.
3. Withdrawal takes effect immediately (Blotter does not use the 10-business-day allowance) and stops marketing only, never engagement notices.
4. A provider complaint withdraws marketing for the address and alerts the batch owner; a hard bounce marks the address invalid for both classes.
5. Tracking is delivery, bounce, complaint and reply only, with no open or click tracking. *Scheduled and queued sends (Q6):* dispatch never adds recipients who were not in the preview.
6. Immediately before each send, including each throttled chunk and every retry, Blotter rechecks the client, contact, address, email consent, the engagement basis or marketing grant, and principal approval; a recipient who fails is recorded as "held: not sent" and never automatically retried.

**Evidence.** `src/blotter/bulk-messages.ts`; `src/blotter/bulk-organizers.ts`; `migrations/core/0078_bulk_organizers.sql`; `tests/blotter/bulk-organizers.test.mjs`; `src/blotter/bulk-events.ts`; `src/blotter/marketing-consent.ts`; `src/blotter/unsubscribe-page.ts`; `src/blotter/messages.ts`; `src/blotter/intake.ts`; `src/blotter/intake-page.ts`; `src/blotter/prospects.ts`; `src/blotter/merges.ts`; `src/blotter/offboarding.ts`; `migrations/core/0075_bulk_messages.sql`; `migrations/core/0076_marketing_merge_holds.sql`; `API.md`; `tests/blotter/bulk-messages.test.mjs`; `src/blotter/imports/marketing.ts`; `src/ui/move-in.tsx`; `migrations/core/0079_import_marketing.sql`; `tests/blotter/import-mapping.test.mjs`; `tests/blotter/import-marketing-ui.mjs`; `src/blotter/marketing-suppression.ts`
**Gap.** Native email batches, class/consent refusals, rechecked throttled dispatch, unsubscribe, signed provider events, per-recipient request links and assigned-organizer invitations, the intake checkbox grant, contact-merge consent and offboarding batch transfer exist; real-provider proof, reply threading, the portal channel, incumbent migration consent mapping, contact-only erasure suppression and a bulk-message workspace screen are missing. Whole-client hashed withdrawal suppression now fences resumed import chunks atomically. Native CSV consent mapping with separately reviewed opt-ins and principal attestation exists. Template-version file attachments are implemented and asserted in `tests/blotter/bulk-messages.test.mjs` ("MSG-002 / NOTIFY-001 / BASE-001 bulk engagement and marketing messages").

#### MSG-017 — Marketing consent and message class for MSG-017

Core · target · **partial** · From MSG-002 · Cites BASE-AUDIT-001, BASE-DATA-001, BASE-MAIL-001 · Rules D-1

**Requirement.** Provide marketing consent and message class for MSG-017.

**Acceptance.**
1. Attempts are claimed before sending, and resubmission is idempotent.
2. When staff leave, their batches move to the successor, and marketing batches need fresh approval.
3. Restored batches come back paused, need a fresh preview and never replay.
4. Automation, follow-up sequences, invoice reminders and scheduled inbox sends may send engagement class only. *Prior email withdrawal (Q7):* email_consent=0, an inactive contact or an archived client blocks all Blotter email, engagement and marketing alike; a marketing grant never restores email consent, which needs its own recorded act; the client's existing portal or link channel still works within its current grants. *Owner corrections (Q8):* only the principal records a correction, which references the original event and gives a reason.
5. It can void a mistaken grant, or a withdrawal staff recorded against the wrong contact, but never a withdrawal the contact made themselves; only a later grant by the contact revives marketing.
6. Sent messages are never altered, and everything is attributed in the audit trail. *Imports (Q9):* imports and incumbent migrations bring marketing in as not granted.

**Evidence.** `src/blotter/bulk-messages.ts`; `src/blotter/bulk-organizers.ts`; `migrations/core/0078_bulk_organizers.sql`; `tests/blotter/bulk-organizers.test.mjs`; `src/blotter/bulk-events.ts`; `src/blotter/marketing-consent.ts`; `src/blotter/unsubscribe-page.ts`; `src/blotter/messages.ts`; `src/blotter/intake.ts`; `src/blotter/intake-page.ts`; `src/blotter/prospects.ts`; `src/blotter/merges.ts`; `src/blotter/offboarding.ts`; `migrations/core/0075_bulk_messages.sql`; `migrations/core/0076_marketing_merge_holds.sql`; `API.md`; `tests/blotter/bulk-messages.test.mjs`; `src/blotter/imports/marketing.ts`; `src/ui/move-in.tsx`; `migrations/core/0079_import_marketing.sql`; `tests/blotter/import-mapping.test.mjs`; `tests/blotter/import-marketing-ui.mjs`; `src/blotter/marketing-suppression.ts`
**Gap.** Native email batches, class/consent refusals, rechecked throttled dispatch, unsubscribe, signed provider events, per-recipient request links and assigned-organizer invitations, the intake checkbox grant, contact-merge consent and offboarding batch transfer exist; real-provider proof, reply threading, the portal channel, incumbent migration consent mapping, contact-only erasure suppression and a bulk-message workspace screen are missing. Whole-client hashed withdrawal suppression now fences resumed import chunks atomically. Native CSV consent mapping with separately reviewed opt-ins and principal attestation exists. Template-version file attachments are implemented and asserted in `tests/blotter/bulk-messages.test.mjs` ("MSG-002 / NOTIFY-001 / BASE-001 bulk engagement and marketing messages").

#### MSG-018 — Marketing consent and message class for MSG-018

Core · target · **partial** · From MSG-002 · Cites BASE-DATA-001, BASE-DATA-006, BASE-INPUT-003, BASE-MAIL-001, BASE-ROLE-001 · Rules D-1

**Requirement.** Provide marketing consent and message class for MSG-018.

**Acceptance.**
1. A grant comes in only from an explicitly mapped opt-in column with a capture date, plus the owner's attestation at commit, and those rows are shown separately in the preview.
2. Unsubscribed, bounced and complained states always come in as withdrawals; an incumbent "subscribed" status without evidence comes in as not granted.
3. Bulk re-permission emails count as marketing and are refused. *Erasure and archive (Q10):* consent events and suppressions travel with archives; unsubscribe tokens do not.
4. After any restore, marketing stays off until the principal confirms the consent log is current.
5. Erasing a client or contact keeps only a hashed suppression record of a withdrawn address, as a named exception, and a newer erasure journal blocks stale restores. *Channels (Q11):* portal marketing needs its own portal grant on an identified portal account, so it waits for PORTAL-002; upload and progress links never carry marketing; marketing by text message is refused. *Tax-return information (Q12, a product guard only):* the marketing opt-in is not the written consent 26 CFR 301.7216-3 requires.

**Evidence.** `src/blotter/bulk-messages.ts`; `src/blotter/bulk-organizers.ts`; `migrations/core/0078_bulk_organizers.sql`; `tests/blotter/bulk-organizers.test.mjs`; `src/blotter/bulk-events.ts`; `src/blotter/marketing-consent.ts`; `src/blotter/unsubscribe-page.ts`; `src/blotter/messages.ts`; `src/blotter/intake.ts`; `src/blotter/intake-page.ts`; `src/blotter/prospects.ts`; `src/blotter/merges.ts`; `src/blotter/offboarding.ts`; `migrations/core/0075_bulk_messages.sql`; `migrations/core/0076_marketing_merge_holds.sql`; `API.md`; `tests/blotter/bulk-messages.test.mjs`; `src/blotter/imports/marketing.ts`; `src/ui/move-in.tsx`; `migrations/core/0079_import_marketing.sql`; `tests/blotter/import-mapping.test.mjs`; `tests/blotter/import-marketing-ui.mjs`; `src/blotter/marketing-suppression.ts`
**Gap.** Native email batches, class/consent refusals, rechecked throttled dispatch, unsubscribe, signed provider events, per-recipient request links and assigned-organizer invitations, the intake checkbox grant, contact-merge consent and offboarding batch transfer exist; real-provider proof, reply threading, the portal channel, incumbent migration consent mapping, contact-only erasure suppression and a bulk-message workspace screen are missing. Whole-client hashed withdrawal suppression now fences resumed import chunks atomically. Native CSV consent mapping with separately reviewed opt-ins and principal attestation exists. Template-version file attachments are implemented and asserted in `tests/blotter/bulk-messages.test.mjs` ("MSG-002 / NOTIFY-001 / BASE-001 bulk engagement and marketing messages").

#### MSG-019 — Marketing consent and message class for MSG-019

Core · target · **partial** · From MSG-002 · Cites BASE-AUDIT-001, BASE-DATA-001, BASE-DATA-006, BASE-MAIL-001, BASE-ROLE-001 · Rules D-1

**Requirement.** Provide marketing consent and message class for MSG-019.

**Acceptance.**
1. Each marketing batch declares its topic, tax preparation services and tax education or other services; "other services" batches cannot filter on tax-derived criteria, and their preview shows a §7216 notice.
2. This removes nothing from segments, scheduling, tracking or reply threading. *Replies:* an engagement reply threads to that client only; a marketing reply goes to the contact, and to the client when the address belongs to exactly one client, otherwise to triage. *Default until proof:* marketing is excluded and there is no new outreach authority; engagement email stays within its existing contact grants and email_consent.
3. Firm-specific §7216 and state law are out of scope, and no runtime, provider or legal proof is claimed. *Inherited by (status unchanged):* CRM-001, CRM-003, CRM-004, CRM-005, IMPORT-001, MIGRATE-001–005, MSG-001, AUTOMATE-001, FOLLOWUP-001, BILL-004, MAIL-003, SMS-001, PORTAL-001, PORTAL-002, PORTAL-003, PORTAL-005, ENGAGE-001, SIGN-002, US-001, NOTIFY-001, ACCESS-006, ARCHIVE-002, ERASURE-002, AUDIT-001 and BASE-001 each carry their line.

**Evidence.** `src/blotter/bulk-messages.ts`; `src/blotter/bulk-organizers.ts`; `migrations/core/0078_bulk_organizers.sql`; `tests/blotter/bulk-organizers.test.mjs`; `src/blotter/bulk-events.ts`; `src/blotter/marketing-consent.ts`; `src/blotter/unsubscribe-page.ts`; `src/blotter/messages.ts`; `src/blotter/intake.ts`; `src/blotter/intake-page.ts`; `src/blotter/prospects.ts`; `src/blotter/merges.ts`; `src/blotter/offboarding.ts`; `migrations/core/0075_bulk_messages.sql`; `migrations/core/0076_marketing_merge_holds.sql`; `API.md`; `tests/blotter/bulk-messages.test.mjs`; `src/blotter/imports/marketing.ts`; `src/ui/move-in.tsx`; `migrations/core/0079_import_marketing.sql`; `tests/blotter/import-mapping.test.mjs`; `tests/blotter/import-marketing-ui.mjs`; `src/blotter/marketing-suppression.ts`
**Gap.** Native email batches, class/consent refusals, rechecked throttled dispatch, unsubscribe, signed provider events, per-recipient request links and assigned-organizer invitations, the intake checkbox grant, contact-merge consent and offboarding batch transfer exist; real-provider proof, reply threading, the portal channel, incumbent migration consent mapping, contact-only erasure suppression and a bulk-message workspace screen are missing. Whole-client hashed withdrawal suppression now fences resumed import chunks atomically. Native CSV consent mapping with separately reviewed opt-ins and principal attestation exists. Template-version file attachments are implemented and asserted in `tests/blotter/bulk-messages.test.mjs` ("MSG-002 / NOTIFY-001 / BASE-001 bulk engagement and marketing messages").

#### SMS-001 — Two way client text messaging

Core · target · **missing** · Cites BASE-ROLE-001 · Rules D-1

**Requirement.** Staff and clients exchange text messages from a firm Twilio number registered for US A2P 10DLC or toll-free verification. Conversations are threaded on the client record. Blotter captures opt-in consent, handles STOP and HELP, holds sends during quiet hours in the client's time zone and supports MSG-001 templates. MMS images are filed as documents. Text bodies never carry taxpayer identifiers or portal secrets, only links to authenticated pages. Texts from unknown numbers go to triage.

**Acceptance.**
1. Capture a client's SMS consent and send a templated text.
2. The client replies with a photo, which appears in the client timeline and is filed to the work item.
3. A text from an unknown number lands in triage.
4. A send scheduled during quiet hours waits until the window opens.
5. After the client replies STOP, further texts are refused, and HELP returns the firm's help message.

**Evidence.** None.
**Gap.** No SMS provider, two-way thread, consent capture or MMS filing exists.

#### SMS-002 — Msg-002 marketing consent for SMS-002

Core · target · **missing** · From SMS-001 · Cites BASE-ROLE-001 · Rules D-1

**Requirement.** Provide msg-002 marketing consent for SMS-002.

**Acceptance.**
1. Marketing by text message is refused.

**Evidence.** None.
**Gap.** No SMS provider, two-way thread, consent capture or MMS filing exists.

#### SMS-003 — Erasure-002 for SMS-003

Core · target · **missing** · From SMS-001 · Cites BASE-DATA-001, BASE-DATA-006 · Rules D-1

**Requirement.** Provide erasure-002 for SMS-003.

**Acceptance.**
1. , SMS-001 adds its records and provider copies to ERASURE-002's classes, clocks, holds, preview, erasure, receipt and restore fence.

**Evidence.** None.
**Gap.** No SMS provider, two-way thread, consent capture or MMS filing exists.

#### COLLAB-001 — Contextual discussions and review alerts

Core · target · **partial** · Cites BASE-MAIL-001 · Rules D-1

**Requirement.** Staff discuss a client, task, document or review in internal threads with mentions, ownership, unread state and retained decisions. Submission notifies the assigned reviewer; replies and requests for changes return to the preparer with a due follow-up. Internal material never leaks to portal users. Assignment, due-soon, overdue and digest notifications and each person's settings are NOTIFY-001.

**Acceptance.**
1. Submit work, receive the assigned reviewer's notification, mention a colleague and request a correction.
2. Resolve it as the preparer, inspect the retained thread and verify that the client and unassigned staff cannot read private discussion.

**Evidence.** `src/blotter/threads.ts`; `src/blotter/notifications.ts`; `src/blotter/jobs.ts`; `migrations/core/0020_threads.sql`; `src/ui/discussions.tsx`; `tests/blotter/flows.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Submit work; receive the assigned reviewer's notification; mention a colleague; request a correction; Resolve it as the preparer; inspect the retained thread; verify that the client; unassigned staff cannot read private discussion.

#### NOTIFY-001 — Staff notifications digest and settings

Core · target · **partial** · Cites BASE-INPUT-003, BASE-MAIL-001 · Rules D-1

**Requirement.** Staff receive in-app, email and mobile push (MOBILE-001) notifications for: work or a task assigned to them, a review requested or returned, a mention, a client reply, an upload, an organizer submission or a completed signature, work due soon (with a configurable lead time), overdue work, status changes on work they own, failed deliveries or syncs, and payments received or failed. Each user chooses the channel per event and a daily digest time in their own time zone. The firm sets defaults and mandatory events. Notifications link to their item, collapse repeats, respect quiet hours and never put taxpayer identifiers in email or push subjects. A notification center tracks read and unread.

**Acceptance.**
1. Assign a job and a task to a preparer.
2. Make one job due tomorrow and one overdue, mention the preparer and have a client upload a file.
3. Inspect the in-app notifications, the emails for the events the preparer chose, and a 7:00 local-time digest that lists due-soon and overdue items once.
4. Turn off email for mentions and confirm mentions then arrive in-app only.
5. A firm-mandatory event cannot be muted, and no SSN or EIN appears in any subject line.

**Evidence.** `src/blotter/notifications.ts`; `src/blotter/notification-events.ts`; `src/blotter/notification-settings.ts`; `src/blotter/notification-digest.ts`; `src/blotter/notification-authority.ts`; `src/ui/notifications.tsx`; `migrations/core/0072_notification_events.sql`; `migrations/core/0073_notification_preferences.sql`; `tests/blotter/notifications.test.mjs`; `tests/blotter/notifications-ui.mjs`; `tests/blotter/flows.test.mjs`; `tests/blotter/organizers.test.mjs`; `src/blotter/bulk-messages.ts`; `src/blotter/bulk-events.ts`; `tests/blotter/bulk-messages.test.mjs`; `tests/blotter/bulk-failure-ui.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Assign a job; a task to a preparer; Make one job due tomorrow; one overdue; mention the preparer; have a client upload a file; Inspect the in-app notifications; the emails for the events the preparer chose; and a 7:00 local-time digest that lists due-soon; overdue items once; Turn off email for mentions; confirm mentions then arrive in-app only; A firm-mandatory event cannot be muted; and no SSN or EIN appears in any subject line.

#### NOTIFY-002 — Completion and inherited events

Core · target · **partial** · From NOTIFY-001 · Cites BASE-MAIL-001 · Rules D-1

**Requirement.** Provide completion and inherited events.

**Acceptance.**
1. Completion covers every shipped native event and email channel; MOBILE-001 supplies actual mobile push .
2. ENGAGE-001/SIGN-001/SIGN-002 inherit completed-signature events, MAIL-001 and LEDGER-001/INTEGRATE-001–008 inherit connected replies/sync failures, and PAY-001/PAY-002 inherit received/failed payments.
3. Each carrier must assert its inherited notification behavior through a named public door before activation.
4. Existing review, discussion, client-question/to-do, task-ready, coverage and report email delivery remains enabled by default.
5. Approved coverage receipts still reach their recorded active participants before first sign-in or after the job moves; the receipt grants no job access or fresh job data.
6. Newly introduced events start in-app only until the individual enables email or the principal explicitly configures that event as mandatory; defaults alone never silently opt users into new email kinds.
7. The principal alone sets defaults/mandatory email events, and personal choices cannot suppress mandatory delivery.
8. In-app notices always remain available.

**Evidence.** `src/blotter/notifications.ts`; `src/blotter/notification-events.ts`; `src/blotter/notification-settings.ts`; `src/blotter/notification-digest.ts`; `src/blotter/notification-authority.ts`; `src/ui/notifications.tsx`; `migrations/core/0072_notification_events.sql`; `migrations/core/0073_notification_preferences.sql`; `tests/blotter/notifications.test.mjs`; `tests/blotter/notifications-ui.mjs`; `tests/blotter/flows.test.mjs`; `tests/blotter/organizers.test.mjs`; `src/blotter/bulk-messages.ts`; `src/blotter/bulk-events.ts`; `tests/blotter/bulk-messages.test.mjs`; `tests/blotter/bulk-failure-ui.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Completion covers every shipped native event; email channel; MOBILE-001 supplies actual mobile push ; ENGAGE-001/SIGN-001/SIGN-002 inherit completed-signature events; MAIL-001; LEDGER-001/INTEGRATE-001–008 inherit connected replies/sync failures; and PAY-001/PAY-002 inherit received/failed payments; Each carrier must assert its inherited notification behavior through a named public door before activation; Existing review; discussion; client-question/to-do; task-ready; coverage; report email delivery remains enabled by default; Approved coverage receipts still reach their recorded active participants before first sign-in or after the job moves; the receipt grants no job access or fresh job data; Newly introduced events start in-app only until the individual enables email or the principal explicitly configures that event as mandatory; defaults alone never silently opt users into new email kinds; The principal alone sets defaults/mandatory email events; and personal choices cannot suppress mandatory delivery; In-app notices always remain available.

#### NOTIFY-003 — Completion and inherited events for NOTIFY-003

Core · target · **partial** · From NOTIFY-001 · Cites BASE-MAIL-001, BASE-ROLE-001 · Rules D-1

**Requirement.** Provide completion and inherited events for NOTIFY-003.

**Acceptance.**
1. Due-soon means an unfinished active-client job with its recorded due day between the user-local today and today plus the chosen whole calendar-day lead (0–365), inclusive; overdue means strictly before today.
2. Repeated scheduler runs collapse each job/recipient/due-day/kind.
3. The daily digest lists each currently eligible job once, at the first hourly trigger at or after the user-local time, once per local date including repeated DST hours.
4. Firm notification hours still apply; personal quiet start is inclusive and end exclusive, may span midnight, and equal times disable personal quiet hours.
5. Deferred deliveries wait for the next permitted trigger.
6. Every center read and dispatch rechecks current staff/item authority, including revoked named-task access; none broadens recipients.
7. Subjects redact nine-digit SSN/EIN formats; new event summaries contain no client content.
8. Attempts are claimed before transport and retained honestly, never blindly retried after failure or uncertainty.

**Evidence.** `src/blotter/notifications.ts`; `src/blotter/notification-events.ts`; `src/blotter/notification-settings.ts`; `src/blotter/notification-digest.ts`; `src/blotter/notification-authority.ts`; `src/ui/notifications.tsx`; `migrations/core/0072_notification_events.sql`; `migrations/core/0073_notification_preferences.sql`; `tests/blotter/notifications.test.mjs`; `tests/blotter/notifications-ui.mjs`; `tests/blotter/flows.test.mjs`; `tests/blotter/organizers.test.mjs`; `src/blotter/bulk-messages.ts`; `src/blotter/bulk-events.ts`; `tests/blotter/bulk-messages.test.mjs`; `tests/blotter/bulk-failure-ui.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Due-soon means an unfinished active-client job with its recorded due day between the user-local today; today plus the chosen whole calendar-day lead (0–365); inclusive; overdue means strictly before today; Repeated scheduler runs collapse each job/recipient/due-day/kind; The daily digest lists each currently eligible job once; at the first hourly trigger at or after the user-local time; once per local date including repeated DST hours; Firm notification hours still apply; personal quiet start is inclusive; end exclusive; may span midnight; and equal times disable personal quiet hours; Deferred deliveries wait for the next permitted trigger; Every center read; dispatch rechecks current staff/item authority; including revoked named-task access; none broadens recipients; Subjects redact nine-digit SSN/EIN formats; new event summaries contain no client content; Attempts are claimed before transport; retained honestly; never blindly retried after failure or uncertainty.

#### NOTIFY-004 — Completion and inherited events for NOTIFY-004

Core · target · **partial** · From NOTIFY-001 · Cites BASE-AUDIT-001, BASE-DATA-001, BASE-DATA-006 · Rules D-1

**Requirement.** Provide completion and inherited events for NOTIFY-004.

**Acceptance.**
1. Settings/read marks/consumption history are portable; unfinished notices remain held and digests restore disabled until deliberately enabled.
2. Native source erasure retains only safe notice metadata and stale-archive fencing.
3. ERASURE-002 inherits whole-client notice/settings retention and approved erasure .

**Evidence.** `src/blotter/notifications.ts`; `src/blotter/notification-events.ts`; `src/blotter/notification-settings.ts`; `src/blotter/notification-digest.ts`; `src/blotter/notification-authority.ts`; `src/ui/notifications.tsx`; `migrations/core/0072_notification_events.sql`; `migrations/core/0073_notification_preferences.sql`; `tests/blotter/notifications.test.mjs`; `tests/blotter/notifications-ui.mjs`; `tests/blotter/flows.test.mjs`; `tests/blotter/organizers.test.mjs`; `src/blotter/bulk-messages.ts`; `src/blotter/bulk-events.ts`; `tests/blotter/bulk-messages.test.mjs`; `tests/blotter/bulk-failure-ui.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Settings/read marks/consumption history are portable; unfinished notices remain held; digests restore disabled until deliberately enabled; Native source erasure retains only safe notice metadata; stale-archive fencing; ERASURE-002 inherits whole-client notice/settings retention; approved erasure .

#### NOTIFY-005 — Msg-002 marketing consent for NOTIFY-005

Core · target · **partial** · From NOTIFY-001 · Rules D-1

**Requirement.** Provide msg-002 marketing consent for NOTIFY-005.

**Acceptance.**
1. A provider complaint alerts the batch owner.

**Evidence.** `src/blotter/notifications.ts`; `src/blotter/notification-events.ts`; `src/blotter/notification-settings.ts`; `src/blotter/notification-digest.ts`; `src/blotter/notification-authority.ts`; `src/ui/notifications.tsx`; `migrations/core/0072_notification_events.sql`; `migrations/core/0073_notification_preferences.sql`; `tests/blotter/notifications.test.mjs`; `tests/blotter/notifications-ui.mjs`; `tests/blotter/flows.test.mjs`; `tests/blotter/organizers.test.mjs`; `src/blotter/bulk-messages.ts`; `src/blotter/bulk-events.ts`; `tests/blotter/bulk-messages.test.mjs`; `tests/blotter/bulk-failure-ui.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: A provider complaint alerts the batch owner.

#### PORTAL-002 — Authenticated branded client portal

Core · target · **partial** · Cites BASE-INPUT-003, BASE-MAIL-001, BASE-ROLE-001, BASE-SIGNIN-002 · Rules D-1

**Requirement.** Each firm has a branded portal on the installation host with client login, invitations, recovery, two-factor authentication and entity-specific contact access. Clients switch among explicitly authorized entities, manage notification preferences and view approved documents, signatures and bills. Firm policy can require MFA; revoked contacts lose existing-session access server-side. Scoped upload links remain available as a separately controlled collection method.

**Acceptance.**
1. Invite two contacts with different entity access, sign in with a second factor on the installation host and recover a lost factor.
2. Revoke one contact mid-session and attempt direct document and API access; inspect refusal without exposing another entity.

**Evidence.** `src/blotter/portal-accounts.ts`; `src/blotter/portal-session.ts`; `src/blotter/client-contacts.ts`; `src/blotter/portal-home.ts`; `src/blotter/portal-account-routes.ts`; `src/ui/client-account.tsx`; `src/ui/client-details.tsx`; `migrations/core/0097_portal_accounts.sql`; `tests/blotter/portal-accounts.test.mjs`; `tests/blotter/portal-accounts-ui.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Invite two contacts with different entity access; sign in with a second factor on the installation host; recover a lost factor; Revoke one contact mid-session; attempt direct document; API access; inspect refusal without exposing another entity.

#### PORTAL-008 — Msg-002 marketing consent for PORTAL-008

Core · target · **partial** · From PORTAL-002 · Rules D-1

**Requirement.** Provide msg-002 marketing consent for PORTAL-008.

**Acceptance.**
1. Portal marketing needs its own portal grant on an identified portal account, and portal preferences offer unsubscribe.

**Evidence.** `src/blotter/portal-accounts.ts`; `src/blotter/portal-session.ts`; `src/blotter/client-contacts.ts`; `src/blotter/portal-home.ts`; `src/blotter/portal-account-routes.ts`; `src/ui/client-account.tsx`; `src/ui/client-details.tsx`; `migrations/core/0097_portal_accounts.sql`; `tests/blotter/portal-accounts.test.mjs`; `tests/blotter/portal-accounts-ui.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Portal marketing needs its own portal grant on an identified portal account; and portal preferences offer unsubscribe.

#### PORTAL-009 — portal account is one email address

Core · target · **partial** · From PORTAL-002 · Cites BASE-MAIL-001, BASE-ROLE-001, BASE-SIGNIN-002 · Rules D-1

**Requirement.** Provide a portal account is one email address.

**Acceptance.**
1. A portal account is one email address.
2. The principal or a reviewer (never a preparer) invites one active, authorized, portal-enabled contact with an email address and email consent; the emailed invitation (one use, 7 days) opens only that contact's entity, so a person who is a contact on several entities is invited on each and switches among the ones accepted.
3. Sign-in is an emailed one-use link (15 minutes, at most five an hour; the reply never says whether an address has access, and the mail goes after the reply) followed by a TOTP second factor, required unless the principal records otherwise (default: required).
4. Each factor comes with ten one-time recovery codes; a recovery code opens only the setup of a new factor, which replaces the lost one, issues new codes and ends the account's other sessions, and the principal can reset a factor with a recorded reason, ending every session.
5. Invitations revoke every existing account session, as do contact edits other than a language-only change.
6. Invitation and reset acknowledgments are identical for existing and nonexistent accounts; staff eligibility and role checks still apply.

**Evidence.** `src/blotter/portal-accounts.ts`; `src/blotter/portal-session.ts`; `src/blotter/client-contacts.ts`; `src/blotter/portal-home.ts`; `src/blotter/portal-account-routes.ts`; `src/ui/client-account.tsx`; `src/ui/client-details.tsx`; `migrations/core/0097_portal_accounts.sql`; `tests/blotter/portal-accounts.test.mjs`; `tests/blotter/portal-accounts-ui.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: A portal account is one email address; The principal or a reviewer (never a preparer) invites one active; authorized; portal-enabled contact with an email address; email consent; the emailed invitation (one use; 7 days) opens only that contact's entity; so a person who is a contact on several entities is invited on each; switches among the ones accepted; Sign-in is an emailed one-use link (15 minutes; at most five an hour; the reply never says whether an address has access; and the mail goes after the reply) followed by a TOTP second factor; required unless the principal records otherwise (default: required); Each factor comes with ten one-time recovery codes; a recovery code opens only the setup of a new factor; which replaces the lost one; issues new codes; ends the account's other sessions; and the principal can reset a factor with a recorded reason; ending every session; Invitations revoke every existing account session; as do contact edits other than a language-only change; Invitation; reset acknowledgments are identical for existing; nonexistent accounts; staff eligibility; role checks still apply.

#### PORTAL-010 — Five wrong codes in 15 minutes lock the

Core · target · **partial** · From PORTAL-002 · Cites BASE-DATA-001, BASE-ROLE-001, BASE-SIGNIN-002 · Rules D-1

**Requirement.** Provide five wrong codes in 15 minutes lock the.

**Acceptance.**
1. Five wrong codes in 15 minutes lock the account for 15 minutes.
2. Sessions are server-side rows behind an HttpOnly, Secure, SameSite=Strict cookie and last 8 hours; every request rechecks the session, the account and each entity's grant, contact (active, authorized, portal permission, the account's address) and entity, so a revoked grant, a changed contact or an archived entity refuses on the next request with the same "not found" as an entity the account never held, and nothing is shown before the second factor passes.

**Evidence.** `src/blotter/portal-accounts.ts`; `src/blotter/portal-session.ts`; `src/blotter/client-contacts.ts`; `src/blotter/portal-home.ts`; `src/blotter/portal-account-routes.ts`; `src/ui/client-account.tsx`; `src/ui/client-details.tsx`; `migrations/core/0097_portal_accounts.sql`; `tests/blotter/portal-accounts.test.mjs`; `tests/blotter/portal-accounts-ui.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Five wrong codes in 15 minutes lock the account for 15 minutes; Sessions are server-side rows behind an HttpOnly; Secure; SameSite=Strict cookie; last 8 hours; every request rechecks the session; the account; each entity's grant; contact (active; authorized; portal permission; the account's address); entity; so a revoked grant; a changed contact or an archived entity refuses on the next request with the same "not found" as an entity the account never held; and nothing is shown before the second factor passes.

#### PORTAL-011 — Signed in, a client sees per entity the

Core · target · **partial** · From PORTAL-002 · Cites BASE-AUDIT-001, BASE-DATA-001, BASE-DATA-006, BASE-MAIL-001, BASE-ROLE-001, BASE-SIGNIN-002 · Rules D-1

**Requirement.** Provide signed in, a client sees per entity the.

**Acceptance.**
1. Signed in, a client sees per entity the work the firm already sent that contact (a link or a signature request) with its client-facing progress, the documents shared with that contact (deliverables keep BILL-005's payment gate), its signature requests (the signed PDF once completed) and the bills addressed to it (PDF), in the contact's language (PORTAL-005), and manages notification preferences: marketing email stops there at once (a `portal_preference` withdrawal, renewed only by a new recorded opt-in), while notices about the client's own work (requests, organizers, signatures, deliverables, bills) are not optional, so no engagement mail is suppressed by a portal switch (adopted default).
2. Staff actions, client sign-ins, factors, recoveries, refused codes and reads of signed PDFs and bills are audited; invitations and revocations appear in the client history.
3. Archives carry accounts and grants but never invitations, sign-in links, sessions, recovery codes or factors, so a restored account sets up a new factor.
4. Whole-client erasure revokes the entity's grants and deletes its invitations; an account that opens no other entity loses its address and factor, and its sessions, links, codes and failures are deleted.

**Evidence.** `src/blotter/portal-accounts.ts`; `src/blotter/portal-session.ts`; `src/blotter/client-contacts.ts`; `src/blotter/portal-home.ts`; `src/blotter/portal-account-routes.ts`; `src/ui/client-account.tsx`; `src/ui/client-details.tsx`; `migrations/core/0097_portal_accounts.sql`; `tests/blotter/portal-accounts.test.mjs`; `tests/blotter/portal-accounts-ui.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Signed in; a client sees per entity the work the firm already sent that contact (a link or a signature request) with its client-facing progress; the documents shared with that contact (deliverables keep BILL-005's payment gate); its signature requests (the signed PDF once completed); the bills addressed to it (PDF); in the contact's language (PORTAL-005); and manages notification preferences: marketing email stops there at once (a `portal_preference` withdrawal; renewed only by a new recorded opt-in); while notices about the client's own work (requests; organizers; signatures; deliverables; bills) are not optional; so no engagement mail is suppressed by a portal switch (adopted default); Staff actions; client sign-ins; factors; recoveries; refused codes; reads of signed PDFs; bills are audited; invitations; revocations appear in the client history; Archives carry accounts; grants but never invitations; sign-in links; sessions; recovery codes or factors; so a restored account sets up a new factor; Whole-client erasure revokes the entity's grants; deletes its invitations; an account that opens no other entity loses its address; factor; and its sessions; links; codes; failures are deleted.

#### PORTAL-012 — crm-004 merge suspends the grants of the

Core · target · **partial** · From PORTAL-002 · Cites BASE-DATA-001, BASE-INPUT-003, BASE-MAIL-001, BASE-ROLE-001 · Rules D-1

**Requirement.** Provide a crm-004 merge suspends the grants of the.

**Acceptance.**
1. A CRM-004 merge suspends the grants of the contacts it moves (invite them again on the surviving entity); its undo restores them.
2. The portal is served on the installation host; PORTAL-006 carries firm custom-domain sign-in.
3. Scoped upload links remain a separately controlled collection method.
4. The principal brands the portal with a PNG or JPEG logo (up to 256 KiB, recognised by its bytes; SVG is refused) and an accent colour, shown on every portal page including sign-in; the signed-in page and the invitation and sign-in emails carry the firm's name.
5. Custom-domain sign-in belongs to PORTAL-006.
6. The portal marketing grant stays with MSG-002's portal channel, asserted on its doors before portal marketing ships.

**Evidence.** `src/blotter/portal-accounts.ts`; `src/blotter/portal-session.ts`; `src/blotter/client-contacts.ts`; `src/blotter/portal-home.ts`; `src/blotter/portal-account-routes.ts`; `src/ui/client-account.tsx`; `src/ui/client-details.tsx`; `migrations/core/0097_portal_accounts.sql`; `tests/blotter/portal-accounts.test.mjs`; `tests/blotter/portal-accounts-ui.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: A CRM-004 merge suspends the grants of the contacts it moves (invite them again on the surviving entity); its undo restores them; The portal is served on the installation host; PORTAL-006 carries firm custom-domain sign-in; Scoped upload links remain a separately controlled collection method; The principal brands the portal with a PNG or JPEG logo (up to 256 KiB; recognised by its bytes; SVG is refused); an accent colour; shown on every portal page including sign-in; the signed-in page; the invitation; sign-in emails carry the firm's name; Custom-domain sign-in belongs to PORTAL-006; The portal marketing grant stays with MSG-002's portal channel; asserted on its doors before portal marketing ships.

#### PORTAL-013 — Erasure-002 for PORTAL-013

Core · target · **partial** · From PORTAL-002 · Cites BASE-DATA-001, BASE-DATA-006 · Rules D-1

**Requirement.** Provide erasure-002 for PORTAL-013.

**Acceptance.**
1. , PORTAL-002 adds its records and provider copies to ERASURE-002's classes, clocks, holds, preview, erasure, receipt and restore fence.

**Evidence.** `src/blotter/portal-accounts.ts`; `src/blotter/portal-session.ts`; `src/blotter/client-contacts.ts`; `src/blotter/portal-home.ts`; `src/blotter/portal-account-routes.ts`; `src/ui/client-account.tsx`; `src/ui/client-details.tsx`; `migrations/core/0097_portal_accounts.sql`; `tests/blotter/portal-accounts.test.mjs`; `tests/blotter/portal-accounts-ui.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: PORTAL-002 adds its records; provider copies to ERASURE-002's classes; clocks; holds; preview; erasure; receipt; restore fence.

#### PORTAL-003 — Client progress secure chat and to dos

Core · target · **partial** · Rules D-1

**Requirement.** Clients see engagement milestones, next action, outstanding requests and review/completion progress, and exchange secure messages or to-dos attached to the right engagement. Staff control what is client-visible; a client response updates the outstanding item and alerts its owner without marking unrelated work complete.

**Acceptance.**
1. Open an engagement as a client, ask a secure question, complete one to-do and inspect the preparer's queue and progress view after review.
2. Confirm internal notes and another entity's tasks remain hidden.

**Evidence.** `src/blotter/portal-items.ts`; `src/blotter/documents.ts`; `src/ui/client-portal.tsx`; `src/ui/portal.tsx`; `migrations/core/0036_portal_items.sql`; `tests/blotter/flows.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Open an engagement as a client; ask a secure question; complete one to-do; inspect the preparer's queue; progress view after review; Confirm internal notes; another entity's tasks remain hidden.

#### PORTAL-014 — Engagement history for PORTAL-014

Core · target · **partial** · From PORTAL-003 · Cites BASE-AUDIT-001 · Rules D-1

**Requirement.** Provide engagement history for PORTAL-014.

**Acceptance.**
1. Portal messages and to-do responses appear in the client's history with author, time and source link, visible only to those who may read the job, and any unresolved item they create names an owner, next action and due condition.

**Evidence.** `src/blotter/portal-items.ts`; `src/blotter/documents.ts`; `src/ui/client-portal.tsx`; `src/ui/portal.tsx`; `migrations/core/0036_portal_items.sql`; `tests/blotter/flows.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Portal messages; to-do responses appear in the client's history with author; time; source link; visible only to those who may read the job; and any unresolved item they create names an owner; next action; due condition.

#### PORTAL-015 — client's secure question appears in the client

Core · target · **partial** · From PORTAL-003 · Cites BASE-AUDIT-001 · Rules D-1

**Requirement.** Provide a client's secure question appears in the client.

**Acceptance.**
1. A client's secure question appears in the client history and as an unresolved item with its owner.

**Evidence.** `src/blotter/portal-items.ts`; `src/blotter/documents.ts`; `src/ui/client-portal.tsx`; `src/ui/portal.tsx`; `migrations/core/0036_portal_items.sql`; `tests/blotter/flows.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: A client's secure question appears in the client history; as an unresolved item with its owner.

#### PORTAL-016 — The engagement is one job and its client

Core · target · **partial** · From PORTAL-003 · Cites BASE-INPUT-003, BASE-MAIL-001 · Rules D-1

**Requirement.** Provide the engagement is one job and its client.

**Acceptance.**
1. The engagement is one job and its client link (DOC-003); the link shows that job only, while it is open or in review.
2. The link shows the job's status as WORK-007 sets it (a sub-status's client label, else the stage name).
3. Progress is four milestones: Documents (received and accepted of requested), Preparation (applicable steps done; done once the job leaves open), Review (in review, then reviewed at sign-off) and Completed (signed off), with a stage (collecting while any request is outstanding, preparing, in review, completed) and the client's next action: upload the outstanding documents and complete the open to-dos, or nothing needed.
4. Staff control what is client-visible: the link shows request labels, status and return notes, client-facing tasks (WORK-009), progress counts, and the messages and to-dos staff put on the link; internal discussions (COLLAB-001), internal tasks and their instructions, staff emails, time and every other job (another client's or another entity's) never reach it; CRM-001 entity relationships inherit this one-job scope .

**Evidence.** `src/blotter/portal-items.ts`; `src/blotter/documents.ts`; `src/ui/client-portal.tsx`; `src/ui/portal.tsx`; `migrations/core/0036_portal_items.sql`; `tests/blotter/flows.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: The engagement is one job; its client link (DOC-003); the link shows that job only; while it is open or in review; The link shows the job's status as WORK-007 sets it (a sub-status's client label; else the stage name); Progress is four milestones: Documents (received; accepted of requested); Preparation (applicable steps done; done once the job leaves open); Review (in review; then reviewed at sign-off); Completed (signed off); with a stage (collecting while any request is outstanding; preparing; in review; completed); the client's next action: upload the outstanding documents; complete the open to-dos; or nothing needed; Staff control what is client-visible: the link shows request labels; status; return notes; client-facing tasks (WORK-009); progress counts; and the messages; to-dos staff put on the link; internal discussions (COLLAB-001); internal tasks; their instructions; staff emails; time; every other job (another client's or another entity's) never reach it; CRM-001 entity relationships inherit this one-job scope .

#### PORTAL-017 — client question is owned by the job's

Core · target · **partial** · From PORTAL-003 · Cites BASE-AUDIT-001, BASE-MAIL-001, BASE-ROLE-001 · Rules D-1

**Requirement.** Provide a client question is owned by the job's.

**Acceptance.**
1. A client question is owned by the job's preparer when it is asked, alerts them (in-app and by mail), counts in the job queue as an open client question and stays open until a staff member who can write to the job answers it on the link; answering closes only that question.
2. Staff set to-dos for the client (with an optional due date) and own them; the client completes one with an optional reply, which alerts its owner and completes no request, task or other to-do.
3. Staff messages appear on the link only: no email is sent for them.
4. A client may hold at most 20 unanswered questions per job; the client's writes are same-origin only and refused once the link is replaced, expired or the job is signed off.
5. Questions and to-dos are CRM-003 unresolved items that change hands like any other and move with ACCESS-006 offboarding; every question, answer, message, to-do and completion is in the client history.

**Evidence.** `src/blotter/portal-items.ts`; `src/blotter/documents.ts`; `src/ui/client-portal.tsx`; `src/ui/portal.tsx`; `migrations/core/0036_portal_items.sql`; `tests/blotter/flows.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: A client question is owned by the job's preparer when it is asked; alerts them (in-app; by mail); counts in the job queue as an open client question; stays open until a staff member who can write to the job answers it on the link; answering closes only that question; Staff set to-dos for the client (with an optional due date); own them; the client completes one with an optional reply; which alerts its owner; completes no request; task or other to-do; Staff messages appear on the link only: no email is sent for them; A client may hold at most 20 unanswered questions per job; the client's writes are same-origin only; refused once the link is replaced; expired or the job is signed off; Questions; to-dos are CRM-003 unresolved items that change hands like any other; move with ACCESS-006 offboarding; every question; answer; message; to-do; completion is in the client history.

#### PORTAL-018 — Msg-002 marketing consent for PORTAL-018

Core · target · **partial** · From PORTAL-003 · Rules D-1

**Requirement.** Provide msg-002 marketing consent for PORTAL-018.

**Acceptance.**
1. Progress links never carry marketing.

**Evidence.** `src/blotter/portal-items.ts`; `src/blotter/documents.ts`; `src/ui/client-portal.tsx`; `src/ui/portal.tsx`; `migrations/core/0036_portal_items.sql`; `tests/blotter/flows.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Progress links never carry marketing.

#### PORTAL-004 — Conditional organizers

Core · target · **partial** · Cites BASE-INPUT-003 · Rules D-1

**Requirement.** Create versioned tax and bookkeeping organizers with conditional questions, required fields, prior-period carry-forward clearly marked for confirmation, supporting uploads and multi-contact responsibility. Clients save and resume, and staff review changed answers and completeness without losing the submitted original.

**Acceptance.**
1. Send an organizer, answer an ownership question that reveals a dependent section, save/resume on a phone and attach evidence.
2. Submit, correct one answer and inspect both versions and the resulting request list; unconfirmed carried answers stay unresolved.

**Evidence.** `src/blotter/organizers.ts`; `src/blotter/organizers-client.ts`; `src/blotter/organizers-store.ts`; `src/blotter/organizers-erasure.ts`; `src/ui/organizers.tsx`; `tests/blotter/organizers.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Send an organizer; answer an ownership question that reveals a dependent section; save/resume on a phone; attach evidence; Submit; correct one answer; inspect both versions; the resulting request list; unconfirmed carried answers stay unresolved.

#### PORTAL-019 — The principal or reviewer publishes a named tax/bookkeeping

Core · target · **partial** · From PORTAL-004 · Cites BASE-ROLE-001 · Rules D-1

**Requirement.** Provide the principal or reviewer publishes a named tax/bookkeeping.

**Acceptance.**
1. The principal or reviewer publishes a named tax/bookkeeping organizer version on a work template.
2. Definitions contain ordered text or choice questions, required flags, conditions on earlier choice answers, supporting document requests and optional WORK-003 workflow-question bindings.
3. A job snapshots its definition at creation; edits and newer releases change future jobs only.
4. Every question has one explicitly assigned active, authorized, consented CRM-001 contact on that entity; several contacts can divide one organizer.
5. Assigned full-scope staff preview and send MSG-001 invitations per contact, refusing unresolved placeholders and keeping exact rendered text, version attachments and honest provider-acceptance outcomes.
6. Each contact's new link rotates only that job/contact's prior links; current authority, consent, expiry and job state are rechecked on every call.
7. A contact receives only their assigned question details and server-computed branch applicability, never another contact's answers or staff review notes.
8. Draft answers save/resume on the same link; current confirmation reveals dependent questions and supporting requests, while only a submitted confirmed answer drives WORK-003 workflow.

**Evidence.** `src/blotter/organizers.ts`; `src/blotter/organizers-client.ts`; `src/blotter/organizers-store.ts`; `src/blotter/organizers-erasure.ts`; `src/ui/organizers.tsx`; `tests/blotter/organizers.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: The principal or reviewer publishes a named tax/bookkeeping organizer version on a work template; Definitions contain ordered text or choice questions; required flags; conditions on earlier choice answers; supporting document requests; optional WORK-003 workflow-question bindings; A job snapshots its definition at creation; edits; newer releases change future jobs only; Every question has one explicitly assigned active; authorized; consented CRM-001 contact on that entity; several contacts can divide one organizer; Assigned full-scope staff preview; send MSG-001 invitations per contact; refusing unresolved placeholders; keeping exact rendered text; version attachments; honest provider-acceptance outcomes; Each contact's new link rotates only that job/contact's prior links; current authority; consent; expiry; job state are rechecked on every call; A contact receives only their assigned question details; server-computed branch applicability; never another contact's answers or staff review notes; Draft answers save/resume on the same link; current confirmation reveals dependent questions; supporting requests; while only a submitted confirmed answer drives WORK-003 workflow.

#### PORTAL-020 — Each contact submits their currently applicable set, required

Core · target · **partial** · From PORTAL-004 · Cites BASE-AUDIT-001, BASE-DATA-001, BASE-DATA-006, BASE-INPUT-003 · Rules D-1

**Requirement.** Provide each contact submits their currently applicable set, required.

**Acceptance.**
1. Each contact submits their currently applicable set, required answers must be confirmed, and later corrections create another immutable submitted original.
2. Staff inspect completeness by responsible contact, changed values, authors/times, review findings and every submission version.
3. A request that no longer applies leaves the active request/reminder/review gate while its previously uploaded originals remain in DOC-001/002 custody.
4. Prior-period carry uses the same client's/template's latest submitted confirmed answers, shows its provenance only to the original responsible contact, and remains unconfirmed until that contact explicitly confirms current evidence; unconfirmed carry cannot complete an organizer or choose a workflow branch.
5. WORK-008 library releases/adoptions carry organizer definitions and individual question changes, preserve firm edits, and snapshot jobs; optional workflow bindings must match the template's choice questions.
6. Owner-only typed-name/reason erasure removes answer payloads, source-linked workflow values and still-derived carry copies, retains ids/authors/times/review attribution and a marker, leaves job sign-off and separately managed file custody intact, and uses Base's redaction journal to fence stale restores.
7. ERASURE-002 supplies actual future hold/signed-record retention before such records ship.
8. Organizer data follows job/contact relationships during CRM-004 merge/undo and native archive restore; portal tokens remain excluded.

**Evidence.** `src/blotter/organizers.ts`; `src/blotter/organizers-client.ts`; `src/blotter/organizers-store.ts`; `src/blotter/organizers-erasure.ts`; `src/ui/organizers.tsx`; `tests/blotter/organizers.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Each contact submits their currently applicable set; required answers must be confirmed; and later corrections create another immutable submitted original; Staff inspect completeness by responsible contact; changed values; authors/times; review findings; every submission version; A request that no longer applies leaves the active request/reminder/review gate while its previously uploaded originals remain in DOC-001/002 custody; Prior-period carry uses the same client's/template's latest submitted confirmed answers; shows its provenance only to the original responsible contact; and remains unconfirmed until that contact explicitly confirms current evidence; unconfirmed carry cannot complete an organizer or choose a workflow branch; WORK-008 library releases/adoptions carry organizer definitions; individual question changes; preserve firm edits; and snapshot jobs; optional workflow bindings must match the template's choice questions; Owner-only typed-name/reason erasure removes answer payloads; source-linked workflow values; still-derived carry copies; retains ids/authors/times/review attribution; a marker; leaves job sign-off; separately managed file custody intact; and uses Base's redaction journal to fence stale restores; ERASURE-002 supplies actual future hold/signed-record retention before such records ship; Organizer data follows job/contact relationships during CRM-004 merge/undo; native archive restore; portal tokens remain excluded.

#### PORTAL-021 — Resolve-001 inherits its 433-a/f case questions, portal-005 translations/accessibility

Core · target · **partial** · From PORTAL-004 · Cites BASE-ACCESSIBILITY-001 · Rules D-1

**Requirement.** Provide resolve-001 inherits its 433-a/f case questions, portal-005 translations/accessibility.

**Acceptance.**
1. RESOLVE-001 inherits its 433-A/F case questions, PORTAL-005 translations/accessibility and MOBILE-001 native/offline organizers before those capabilities ship.

**Evidence.** `src/blotter/organizers.ts`; `src/blotter/organizers-client.ts`; `src/blotter/organizers-store.ts`; `src/blotter/organizers-erasure.ts`; `src/ui/organizers.tsx`; `tests/blotter/organizers.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: RESOLVE-001 inherits its 433-A/F case questions; PORTAL-005 translations/accessibility; MOBILE-001 native/offline organizers before those capabilities ship.

#### PORTAL-022 — Erasure-002 for PORTAL-022

Core · target · **partial** · From PORTAL-004 · Cites BASE-DATA-006, BASE-ROLE-001 · Rules D-1

**Requirement.** Provide erasure-002 for PORTAL-022.

**Acceptance.**
1. Inside an ERASURE-002 hold its answer erasure is refused, naming the hold; in whole-client erasure, submitted originals a signed-off job consumed are ERASURE-002 signed-off work (proved under ERASURE-002).

**Evidence.** `src/blotter/organizers.ts`; `src/blotter/organizers-client.ts`; `src/blotter/organizers-store.ts`; `src/blotter/organizers-erasure.ts`; `src/ui/organizers.tsx`; `tests/blotter/organizers.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Inside an ERASURE-002 hold its answer erasure is refused; naming the hold; in whole-client erasure; submitted originals a signed-off job consumed are ERASURE-002 signed-off work (proved under ERASURE-002).

#### PORTAL-005 — Client language and accessibility

Core · target · **partial** · Cites BASE-ACCESSIBILITY-001, BASE-INPUT-003, BASE-MAIL-001 · Rules D-1 · Register R-1, R-2

**Requirement.** The client portal, emails, organizers and signature screens are available in English and Spanish. Each contact has a language preference, and firm templates (MSG-001) keep a version per language. Before a send, staff are warned when a template has no version in the contact's language. Mechanism: [details](docs/contract/mechanism.md).

**Acceptance.**
1. Set a contact to Spanish and send a templated request that has a Spanish version.
2. Complete an organizer and a signature in Spanish.
3. For a template with no Spanish version, staff are warned before the send.
4. Run an automated accessibility check on the client flows, and complete an upload and a signature using only the keyboard.

**Evidence.** `src/i18n/catalog.ts`; `src/blotter/client-contacts.ts`; `src/blotter/messages.ts`; `src/blotter/documents.ts`; `src/blotter/portal-items.ts`; `src/blotter/organizers-definition.ts`; `src/blotter/organizers-client.ts`; `src/blotter/organizers-send.ts`; `src/blotter/signatures-pdf.ts`; `src/blotter/signatures-portal.ts`; `src/blotter/unsubscribe-page.ts`; `src/blotter/deliverables.ts`; `src/blotter/invoices-delivery.ts`; `src/ui/i18n.tsx`; `src/ui/portal.tsx`; `src/ui/client-portal.tsx`; `src/ui/organizers.tsx`; `src/ui/signatures.tsx`; `src/ui/deliverables.tsx`; `src/ui/vault.tsx`; `src/ui/invoices.tsx`; `src/ui/messages.tsx`; `src/ui/client-details.tsx`; `migrations/core/0096_client_language.sql`; `migrations/core/0098_bulk_language_review.sql`; `migrations/core/0099_bulk_language_erasure.sql`; `tests/blotter/language.test.mjs`; `tests/blotter/language-ui.mjs`; `tests/blotter/invoices.test.mjs`; `tests/blotter/erasure-policy.test.mjs`; `tests/blotter/portal-accounts.test.mjs`; `tests/blotter/portal-accounts-ui.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Set a contact to Spanish; send a templated request that has a Spanish version; Complete an organizer; a signature in Spanish; For a template with no Spanish version; staff are warned before the send; Run an automated accessibility check on the client flows; and complete an upload; a signature using only the keyboard.

#### PORTAL-023 — Portal-004 for PORTAL-023

Core · target · **partial** · From PORTAL-005 · Cites BASE-ACCESSIBILITY-001, BASE-INPUT-003 · Rules D-1 · Register R-1, R-2

**Requirement.** Provide portal-004 for PORTAL-023. Mechanism: [details](docs/contract/mechanism.md).

**Acceptance.**
1. Translated and accessible organizer doors retain the same per-contact scope, conditional/required questions, marked carry requiring current confirmation, supporting uploads, save/resume, immutable submitted corrections and staff completeness/review .

**Evidence.** `src/i18n/catalog.ts`; `src/blotter/client-contacts.ts`; `src/blotter/messages.ts`; `src/blotter/documents.ts`; `src/blotter/portal-items.ts`; `src/blotter/organizers-definition.ts`; `src/blotter/organizers-client.ts`; `src/blotter/organizers-send.ts`; `src/blotter/signatures-pdf.ts`; `src/blotter/signatures-portal.ts`; `src/blotter/unsubscribe-page.ts`; `src/blotter/deliverables.ts`; `src/blotter/invoices-delivery.ts`; `src/ui/i18n.tsx`; `src/ui/portal.tsx`; `src/ui/client-portal.tsx`; `src/ui/organizers.tsx`; `src/ui/signatures.tsx`; `src/ui/deliverables.tsx`; `src/ui/vault.tsx`; `src/ui/invoices.tsx`; `src/ui/messages.tsx`; `src/ui/client-details.tsx`; `migrations/core/0096_client_language.sql`; `migrations/core/0098_bulk_language_review.sql`; `migrations/core/0099_bulk_language_erasure.sql`; `tests/blotter/language.test.mjs`; `tests/blotter/language-ui.mjs`; `tests/blotter/invoices.test.mjs`; `tests/blotter/erasure-policy.test.mjs`; `tests/blotter/portal-accounts.test.mjs`; `tests/blotter/portal-accounts-ui.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Translated; accessible organizer doors retain the same per-contact scope; conditional/required questions; marked carry requiring current confirmation; supporting uploads; save/resume; immutable submitted corrections; staff completeness/review .

#### PORTAL-024 — Msg-002 marketing consent for PORTAL-024

Core · target · **partial** · From PORTAL-005 · Rules D-1 · Register R-1, R-2

**Requirement.** Provide msg-002 marketing consent for PORTAL-024. Mechanism: [details](docs/contract/mechanism.md).

**Acceptance.**
1. The unsubscribe page and its wording appear in the contact's language.

**Evidence.** `src/i18n/catalog.ts`; `src/blotter/client-contacts.ts`; `src/blotter/messages.ts`; `src/blotter/documents.ts`; `src/blotter/portal-items.ts`; `src/blotter/organizers-definition.ts`; `src/blotter/organizers-client.ts`; `src/blotter/organizers-send.ts`; `src/blotter/signatures-pdf.ts`; `src/blotter/signatures-portal.ts`; `src/blotter/unsubscribe-page.ts`; `src/blotter/deliverables.ts`; `src/blotter/invoices-delivery.ts`; `src/ui/i18n.tsx`; `src/ui/portal.tsx`; `src/ui/client-portal.tsx`; `src/ui/organizers.tsx`; `src/ui/signatures.tsx`; `src/ui/deliverables.tsx`; `src/ui/vault.tsx`; `src/ui/invoices.tsx`; `src/ui/messages.tsx`; `src/ui/client-details.tsx`; `migrations/core/0096_client_language.sql`; `migrations/core/0098_bulk_language_review.sql`; `migrations/core/0099_bulk_language_erasure.sql`; `tests/blotter/language.test.mjs`; `tests/blotter/language-ui.mjs`; `tests/blotter/invoices.test.mjs`; `tests/blotter/erasure-policy.test.mjs`; `tests/blotter/portal-accounts.test.mjs`; `tests/blotter/portal-accounts-ui.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: The unsubscribe page; its wording appear in the contact's language.

#### PORTAL-025 — contact's language is set by the principal

Core · target · **partial** · From PORTAL-005 · Rules D-1 · Register R-1, R-2

**Requirement.** Provide a contact's language is set by the principal. Mechanism: [details](docs/contract/mechanism.md).

**Acceptance.**
1. A contact's language (English or Spanish, default English) is set by the principal or a reviewer on the contact and never by the client; changing only the language keeps the contact's revision, issued links and pending signature requests, while any other edit fences them as before.
2. A Spanish recipient's marketing unsubscribe link carries `lang=es`; without it the page follows that link's own recipient (Spanish when an active contact with the address prefers Spanish), and the page's forms keep the page's language.
3. A typed address is never looked up to choose the language, so the reply never reveals whether an address belongs to a contact.
4. Each firm template (MSG-001) keeps its English text as the version and may carry one Spanish version per template version (the principal or the template's owner adds it; it is immutable, uses the same placeholders and class rules, and a new English version needs a new Spanish one).
5. Bulk preview fingerprints bind each recipient's language and template wording; changes hold dispatch for fresh review, and the existing engagement-opening guard applies to translated wording.

**Evidence.** `src/i18n/catalog.ts`; `src/blotter/client-contacts.ts`; `src/blotter/messages.ts`; `src/blotter/documents.ts`; `src/blotter/portal-items.ts`; `src/blotter/organizers-definition.ts`; `src/blotter/organizers-client.ts`; `src/blotter/organizers-send.ts`; `src/blotter/signatures-pdf.ts`; `src/blotter/signatures-portal.ts`; `src/blotter/unsubscribe-page.ts`; `src/blotter/deliverables.ts`; `src/blotter/invoices-delivery.ts`; `src/ui/i18n.tsx`; `src/ui/portal.tsx`; `src/ui/client-portal.tsx`; `src/ui/organizers.tsx`; `src/ui/signatures.tsx`; `src/ui/deliverables.tsx`; `src/ui/vault.tsx`; `src/ui/invoices.tsx`; `src/ui/messages.tsx`; `src/ui/client-details.tsx`; `migrations/core/0096_client_language.sql`; `migrations/core/0098_bulk_language_review.sql`; `migrations/core/0099_bulk_language_erasure.sql`; `tests/blotter/language.test.mjs`; `tests/blotter/language-ui.mjs`; `tests/blotter/invoices.test.mjs`; `tests/blotter/erasure-policy.test.mjs`; `tests/blotter/portal-accounts.test.mjs`; `tests/blotter/portal-accounts-ui.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: A contact's language (English or Spanish; default English) is set by the principal or a reviewer on the contact; never by the client; changing only the language keeps the contact's revision; issued links; pending signature requests; while any other edit fences them as before; A Spanish recipient's marketing unsubscribe link carries `lang=es`; without it the page follows that link's own recipient (Spanish when an active contact with the address prefers Spanish); and the page's forms keep the page's language; A typed address is never looked up to choose the language; so the reply never reveals whether an address belongs to a contact; Each firm template (MSG-001) keeps its English text as the version; may carry one Spanish version per template version (the principal or the template's owner adds it; it is immutable; uses the same placeholders; class rules; and a new English version needs a new Spanish one); Bulk preview fingerprints bind each recipient's language; template wording; changes hold dispatch for fresh review; and the existing engagement-opening guard applies to translated wording.

#### PORTAL-026 — Approved erasure-002 erasure clears recipient language-review metadata as

Core · target · **partial** · From PORTAL-005 · Cites BASE-AUDIT-001, BASE-DATA-006, BASE-ROLE-001 · Rules D-1 · Register R-1, R-2

**Requirement.** Provide approved erasure-002 erasure clears recipient language-review metadata as. Mechanism: [details](docs/contract/mechanism.md).

**Acceptance.**
1. Approved ERASURE-002 erasure clears recipient language-review metadata as well as the contact preference, while pending dispatch remains held.
2. Organizer translation metadata exposes only the contact's visible assigned questions and their own submitted originals, including historical labels after a branch hides.
3. Templated requests, portal messages, organizer invitations, bulk messages and invoice reminders use the Spanish version for a Spanish contact.
4. When the template has none, staff are warned before the send at each door: the request, portal-message and organizer-invitation previews warn per contact, a bulk preview lists the untranslated recipients, and the invoice reminder schedule names the template version and the number of Spanish-reading billing contacts on open invoices, at consent and while it runs; the English text is then sent, recorded with the language used.
5. An organizer definition may carry a Spanish question, Spanish choice labels in the same order and a Spanish document request; answers, conditions, workflow bindings and carry always use the recorded (English) choice values.
6. A Spanish signer reads and records the Spanish ESIGN/UETA consent under its own version id (`esign-ueta-v1-es`); the English consent version is refused for her.

**Evidence.** `src/i18n/catalog.ts`; `src/blotter/client-contacts.ts`; `src/blotter/messages.ts`; `src/blotter/documents.ts`; `src/blotter/portal-items.ts`; `src/blotter/organizers-definition.ts`; `src/blotter/organizers-client.ts`; `src/blotter/organizers-send.ts`; `src/blotter/signatures-pdf.ts`; `src/blotter/signatures-portal.ts`; `src/blotter/unsubscribe-page.ts`; `src/blotter/deliverables.ts`; `src/blotter/invoices-delivery.ts`; `src/ui/i18n.tsx`; `src/ui/portal.tsx`; `src/ui/client-portal.tsx`; `src/ui/organizers.tsx`; `src/ui/signatures.tsx`; `src/ui/deliverables.tsx`; `src/ui/vault.tsx`; `src/ui/invoices.tsx`; `src/ui/messages.tsx`; `src/ui/client-details.tsx`; `migrations/core/0096_client_language.sql`; `migrations/core/0098_bulk_language_review.sql`; `migrations/core/0099_bulk_language_erasure.sql`; `tests/blotter/language.test.mjs`; `tests/blotter/language-ui.mjs`; `tests/blotter/invoices.test.mjs`; `tests/blotter/erasure-policy.test.mjs`; `tests/blotter/portal-accounts.test.mjs`; `tests/blotter/portal-accounts-ui.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Approved ERASURE-002 erasure clears recipient language-review metadata as well as the contact preference; while pending dispatch remains held; Organizer translation metadata exposes only the contact's visible assigned questions; their own submitted originals; including historical labels after a branch hides; Templated requests; portal messages; organizer invitations; bulk messages; invoice reminders use the Spanish version for a Spanish contact; When the template has none; staff are warned before the send at each door: the request; portal-message; organizer-invitation previews warn per contact; a bulk preview lists the untranslated recipients; and the invoice reminder schedule names the template version; the number of Spanish-reading billing contacts on open invoices; at consent; while it runs; the English text is then sent; recorded with the language used; An organizer definition may carry a Spanish question; Spanish choice labels in the same order; a Spanish document request; answers; conditions; workflow bindings; carry always use the recorded (English) choice values; A Spanish signer reads; records the Spanish ESIGN/UETA consent under its own version id (`esign-ueta-v1-es`); the English consent version is refused for her.

#### PORTAL-027 — Text a firm writes , the invoice and

Core · target · **partial** · From PORTAL-005 · Cites BASE-ACCESSIBILITY-001, BASE-DATA-001, BASE-DATA-006, BASE-INPUT-003, BASE-MAIL-001, BASE-ROLE-001 · Rules D-1 · Register R-1, R-2

**Requirement.** Provide text a firm writes , the invoice and. Mechanism: [details](docs/contract/mechanism.md).

**Acceptance.**
1. Text a firm writes (job and template names, request labels, firm-written client status labels, signature field labels, organizer text without a Spanish rendering), the invoice and signature PDFs and certificates, and rare server refusals remain as written or in English.
2. Future client-facing doors (SIGN-001, PAY-001, ENGAGE-001, MAIL-001 to MAIL-003, MOBILE-001, NOTICE-001) inherit the catalog, the contact language and the same scan.
3. Whole-client erasure (ERASURE-002) resets each contact's language preference with the rest of the contact and removes a reminder's recorded language; Spanish template versions are firm records in the firm class, carried by archives under the same restore fence.

**Evidence.** `src/i18n/catalog.ts`; `src/blotter/client-contacts.ts`; `src/blotter/messages.ts`; `src/blotter/documents.ts`; `src/blotter/portal-items.ts`; `src/blotter/organizers-definition.ts`; `src/blotter/organizers-client.ts`; `src/blotter/organizers-send.ts`; `src/blotter/signatures-pdf.ts`; `src/blotter/signatures-portal.ts`; `src/blotter/unsubscribe-page.ts`; `src/blotter/deliverables.ts`; `src/blotter/invoices-delivery.ts`; `src/ui/i18n.tsx`; `src/ui/portal.tsx`; `src/ui/client-portal.tsx`; `src/ui/organizers.tsx`; `src/ui/signatures.tsx`; `src/ui/deliverables.tsx`; `src/ui/vault.tsx`; `src/ui/invoices.tsx`; `src/ui/messages.tsx`; `src/ui/client-details.tsx`; `migrations/core/0096_client_language.sql`; `migrations/core/0098_bulk_language_review.sql`; `migrations/core/0099_bulk_language_erasure.sql`; `tests/blotter/language.test.mjs`; `tests/blotter/language-ui.mjs`; `tests/blotter/invoices.test.mjs`; `tests/blotter/erasure-policy.test.mjs`; `tests/blotter/portal-accounts.test.mjs`; `tests/blotter/portal-accounts-ui.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Text a firm writes (job; template names; request labels; firm-written client status labels; signature field labels; organizer text without a Spanish rendering); the invoice; signature PDFs; certificates; and rare server refusals remain as written or in English; Future client-facing doors (SIGN-001; PAY-001; ENGAGE-001; MAIL-001 to MAIL-003; MOBILE-001; NOTICE-001) inherit the catalog; the contact language; the same scan; Whole-client erasure (ERASURE-002) resets each contact's language preference with the rest of the contact; removes a reminder's recorded language; Spanish template versions are firm records in the firm class; carried by archives under the same restore fence.

#### PORTAL-028 — Erasure-002 for PORTAL-028

Core · target · **partial** · From PORTAL-005 · Cites BASE-DATA-001, BASE-DATA-006 · Rules D-1 · Register R-1, R-2

**Requirement.** Provide erasure-002 for PORTAL-028. Mechanism: [details](docs/contract/mechanism.md).

**Acceptance.**
1. , PORTAL-005 adds its records and provider copies to ERASURE-002's classes, clocks, holds, preview, erasure, receipt and restore fence.

**Evidence.** `src/i18n/catalog.ts`; `src/blotter/client-contacts.ts`; `src/blotter/messages.ts`; `src/blotter/documents.ts`; `src/blotter/portal-items.ts`; `src/blotter/organizers-definition.ts`; `src/blotter/organizers-client.ts`; `src/blotter/organizers-send.ts`; `src/blotter/signatures-pdf.ts`; `src/blotter/signatures-portal.ts`; `src/blotter/unsubscribe-page.ts`; `src/blotter/deliverables.ts`; `src/blotter/invoices-delivery.ts`; `src/ui/i18n.tsx`; `src/ui/portal.tsx`; `src/ui/client-portal.tsx`; `src/ui/organizers.tsx`; `src/ui/signatures.tsx`; `src/ui/deliverables.tsx`; `src/ui/vault.tsx`; `src/ui/invoices.tsx`; `src/ui/messages.tsx`; `src/ui/client-details.tsx`; `migrations/core/0096_client_language.sql`; `migrations/core/0098_bulk_language_review.sql`; `migrations/core/0099_bulk_language_erasure.sql`; `tests/blotter/language.test.mjs`; `tests/blotter/language-ui.mjs`; `tests/blotter/invoices.test.mjs`; `tests/blotter/erasure-policy.test.mjs`; `tests/blotter/portal-accounts.test.mjs`; `tests/blotter/portal-accounts-ui.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: PORTAL-005 adds its records; provider copies to ERASURE-002's classes; clocks; holds; preview; erasure; receipt; restore fence.

#### MOBILE-001 — Mobile client and practitioner work

Core · target · **partial** · Cites BASE-ACCESSIBILITY-001, BASE-INPUT-003, BASE-MAIL-001, BASE-ROLE-001 · Rules D-1 · Register R-5

**Requirement.** Responsive web and native iOS/Android apps let clients scan/crop multi-page documents, resume interrupted uploads, answer organizers, chat, sign and pay; staff triage, reassign and review work, and record time against client/job/task with manual entries and running timers (TIME-001) that continue across app restarts and sync once, with role-appropriate access. Push notifications use consent and reveal no tax details on a lock screen; offline drafts disclose sync state and revoked sessions cannot sync new work. Keyboard and assistive-technology access remain available on the web.

**Acceptance.**
1. At desktop and phone widths and on iOS/Android, capture a multi-page statement, interrupt/retry the upload, complete a client task and review it as staff.
2. As staff on a phone, start a timer, close and reopen the app, stop it and add a manual entry; both appear once in the job's time with the snapshotted rate and respect a locked period.
3. Inspect push privacy, offline-to-online conflict handling, keyboard navigation and revocation.

**Evidence.** `src/ui/portal.tsx`; `src/ui/workspace.tsx`; `src/ui/job.tsx`; `src/ui/timer.tsx`; `src/blotter/timers.ts`; `tests/blotter/flows.test.mjs`; `tests/blotter/mobile-ui.mjs`; `tests/blotter/mobile-upload.test.mjs`; `tests/blotter/erasure-policy.test.mjs`; `tests/blotter/organizers.test.mjs`
**Gap.** Browser timer and manual-time, client to-do and staff review, keyboard navigation, automated accessibility, tooltip and revoked-authority journeys are proven. Browser interrupted uploads of a selected multi-page original now retain confirmed progress, require explicit retry and exact-original reselection after reload, complete once, preserve contact attribution, exclude staging from archives and retain existing completed-file custody and erasure fencing. Camera scanning and cropping and capture qualification, native iOS and Android apps and distribution, physical-device client and staff journeys, consented private push with NOTIFY-001, offline draft state and organizer conflict reconciliation with current-confirmation rules, and native assistive-technology qualification remain missing. Those capabilities require real devices and Apple and Google developer accounts with signing and push credentials. Remaining native records and provider copies still owe the inherited BASE-001 and ERASURE-002 activation gates.

#### MOBILE-002 — Portal-004 for MOBILE-002

Core · target · **partial** · From MOBILE-001 · Cites BASE-INPUT-003 · Rules D-1 · Register R-5

**Requirement.** Provide portal-004 for MOBILE-002.

**Acceptance.**
1. Native and offline organizer doors retain per-contact scope, conditional/required questions, supporting uploads, save/resume, marked carry requiring current confirmation, immutable submitted corrections and staff completeness/review .
2. Reconnection never overwrites an original submission or lets unconfirmed carried/draft answers advance workflow.

**Evidence.** `src/ui/portal.tsx`; `src/ui/workspace.tsx`; `src/ui/job.tsx`; `src/ui/timer.tsx`; `src/blotter/timers.ts`; `tests/blotter/flows.test.mjs`; `tests/blotter/mobile-ui.mjs`; `tests/blotter/mobile-upload.test.mjs`; `tests/blotter/erasure-policy.test.mjs`; `tests/blotter/organizers.test.mjs`
**Gap.** Browser timer and manual-time, client to-do and staff review, keyboard navigation, automated accessibility, tooltip and revoked-authority journeys are proven. Browser interrupted uploads of a selected multi-page original now retain confirmed progress, require explicit retry and exact-original reselection after reload, complete once, preserve contact attribution, exclude staging from archives and retain existing completed-file custody and erasure fencing. Camera scanning and cropping and capture qualification, native iOS and Android apps and distribution, physical-device client and staff journeys, consented private push with NOTIFY-001, offline draft state and organizer conflict reconciliation with current-confirmation rules, and native assistive-technology qualification remain missing. Those capabilities require real devices and Apple and Google developer accounts with signing and push credentials. Remaining native records and provider copies still owe the inherited BASE-001 and ERASURE-002 activation gates.

#### MOBILE-003 — Erasure-002 for MOBILE-003

Core · target · **partial** · From MOBILE-001 · Cites BASE-DATA-001, BASE-DATA-006 · Rules D-1 · Register R-5

**Requirement.** Provide erasure-002 for MOBILE-003.

**Acceptance.**
1. , MOBILE-001 adds its records and provider copies to ERASURE-002's classes, clocks, holds, preview, erasure, receipt and restore fence.

**Evidence.** `src/ui/portal.tsx`; `src/ui/workspace.tsx`; `src/ui/job.tsx`; `src/ui/timer.tsx`; `src/blotter/timers.ts`; `tests/blotter/flows.test.mjs`; `tests/blotter/mobile-ui.mjs`; `tests/blotter/mobile-upload.test.mjs`; `tests/blotter/erasure-policy.test.mjs`; `tests/blotter/organizers.test.mjs`
**Gap.** Browser timer and manual-time, client to-do and staff review, keyboard navigation, automated accessibility, tooltip and revoked-authority journeys are proven. Browser interrupted uploads of a selected multi-page original now retain confirmed progress, require explicit retry and exact-original reselection after reload, complete once, preserve contact attribution, exclude staging from archives and retain existing completed-file custody and erasure fencing. Camera scanning and cropping and capture qualification, native iOS and Android apps and distribution, physical-device client and staff journeys, consented private push with NOTIFY-001, offline draft state and organizer conflict reconciliation with current-confirmation rules, and native assistive-technology qualification remain missing. Those capabilities require real devices and Apple and Google developer accounts with signing and push credentials. Remaining native records and provider copies still owe the inherited BASE-001 and ERASURE-002 activation gates.

#### DOC-001 — Client files versions and annotations

Core · target · **partial** · Cites BASE-INPUT-003, BASE-ROLE-001 · Rules D-1

**Requirement.** Store engagement documents in client/period folders with searchable names, source, author, timestamps, version relationships, annotations and review status. Preserve originals and prior versions; downloads and annotations respect permissions. Support normal multi-page accounting packets with published limits, resumable uploads and clear failure recovery instead of silently truncating files.

**Acceptance.**
1. Upload a realistic multi-page packet, replace it with a corrected version, annotate a page and find both versions from the client and engagement.
2. Interrupt an upload and resume; compare downloaded originals and inspect limit/error handling.

**Evidence.** `src/blotter/document-packets.ts`; `src/blotter/document-catalog.ts`; `src/blotter/document-related.ts`; `src/blotter/document-downloads.ts`; `src/ui/document-packets.tsx`; `migrations/core/0053_document_packets.sql`; `tests/blotter/document-packets.test.mjs`; `tests/blotter/document-sharing.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Upload a realistic multi-page packet; replace it with a corrected version; annotate a page; find both versions from the client; engagement; Interrupt an upload; resume; compare downloaded originals; inspect limit/error handling.

#### DOC-004 — The client/period/engagement catalog lists every requested file

Core · target · **partial** · From DOC-001 · Cites BASE-AUDIT-001, BASE-INPUT-003, BASE-ROLE-001 · Rules D-1

**Requirement.** Provide the client/period/engagement catalog lists every requested file .

**Acceptance.**
1. The client/period/engagement catalog lists every requested file (including historical and converted-intake originals), task-completion attachment, expense receipt, notice-timeline attachment and DOC-003 deliverable version under its existing staff download authority, with a link to its source workflow.
2. A named notice assignee sees only notice evidence outside their normal job scope.
3. Purpose-specific custody, versioning and approval stay in their own workflows; the packet workspace adds versions and page annotations to requested files, while DOC-003 retains its deliverable version/approval flow.
4. Unknown historical author/page counts are labelled unknown; staff declare a missing page count before the first annotation.
5. New packet source, author and page count are staff-recorded, not provider-verified or inferred.
6. Staff with full job scope can upload 1 byte–20 MiB originals (20 × 1024 × 1024 bytes), with 1–2,000 declared pages, to an open request.
7. Transport uses 256 KiB chunks except the final chunk; each call rechecks current staff, job and client scope, exact offset, chunk ID and SHA-256.
8. A repeated identical chunk is idempotent; gaps, differing bytes and incomplete/final-hash mismatches refuse without discarding confirmed bytes.

**Evidence.** `src/blotter/document-packets.ts`; `src/blotter/document-catalog.ts`; `src/blotter/document-related.ts`; `src/blotter/document-downloads.ts`; `src/ui/document-packets.tsx`; `migrations/core/0053_document_packets.sql`; `tests/blotter/document-packets.test.mjs`; `tests/blotter/document-sharing.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: The client/period/engagement catalog lists every requested file (including historical; converted-intake originals); task-completion attachment; expense receipt; notice-timeline attachment; DOC-003 deliverable version under its existing staff download authority; with a link to its source workflow; A named notice assignee sees only notice evidence outside their normal job scope; Purpose-specific custody; versioning; approval stay in their own workflows; the packet workspace adds versions; page annotations to requested files; while DOC-003 retains its deliverable version/approval flow; Unknown historical author/page counts are labelled unknown; staff declare a missing page count before the first annotation; New packet source; author; page count are staff-recorded; not provider-verified or inferred; Staff with full job scope can upload 1 byte–20 MiB originals (20 × 1024 × 1024 bytes); with 1–2,000 declared pages; to an open request; Transport uses 256 KiB chunks except the final chunk; each call rechecks current staff; job; client scope; exact offset; chunk ID; SHA-256; A repeated identical chunk is idempotent; gaps; differing bytes; incomplete/final-hash mismatches refuse without discarding confirmed bytes.

#### DOC-005 — Pending uploads resume for seven days using the

Core · target · **partial** · From DOC-001 · Cites BASE-DATA-001, BASE-DATA-006, BASE-INPUT-003, BASE-ROLE-001 · Rules D-1

**Requirement.** Provide pending uploads resume for seven days using the.

**Acceptance.**
1. Pending uploads resume for seven days using the exact original and are then purged; cancellation removes staging.
2. Completion preserves the exact original behind the usual permission-checked file door and marks the request received for staff acceptance.
3. Corrections retain every prior original and the preceding exact DOC-002 contact grants, never its share tokens, and start unreviewed.
4. Notes name a page and exact version; review records status, author and time without altering original bytes.
5. Search covers names, sources, authors, period, annotations and review metadata; SEARCH-001 also indexes supported PDF text from the real bytes.
6. Final chunks, versions, annotations and grants are portable; pending chunks and bearer credentials are excluded.
7. Existing file erasure removes final chunks and pending copies under the stale-restore fence.
8. The owner JSON archive restore accepts up to 64,000,000 JSON characters; firm-scale streaming remains ARCHIVE-002.

**Evidence.** `src/blotter/document-packets.ts`; `src/blotter/document-catalog.ts`; `src/blotter/document-related.ts`; `src/blotter/document-downloads.ts`; `src/ui/document-packets.tsx`; `migrations/core/0053_document_packets.sql`; `tests/blotter/document-packets.test.mjs`; `tests/blotter/document-sharing.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Pending uploads resume for seven days using the exact original; are then purged; cancellation removes staging; Completion preserves the exact original behind the usual permission-checked file door; marks the request received for staff acceptance; Corrections retain every prior original; the preceding exact DOC-002 contact grants; never its share tokens; and start unreviewed; Notes name a page; exact version; review records status; author; time without altering original bytes; Search covers names; sources; authors; period; annotations; review metadata; SEARCH-001 also indexes supported PDF text from the real bytes; Final chunks; versions; grants are portable; pending chunks; bearer credentials are excluded; Existing file erasure removes final chunks; pending copies under the stale-restore fence; The owner JSON archive restore accepts up to 64,000,000 JSON characters; firm-scale streaming remains ARCHIVE-002.

#### DOC-006 — Integrate-003 and migrate-001–005 inherit this catalog, original custody

Core · target · **partial** · From DOC-001 · Rules D-1

**Requirement.** Provide integrate-003 and migrate-001–005 inherit this catalog, original custody.

**Acceptance.**
1. INTEGRATE-003 and MIGRATE-001–005 inherit this catalog, original custody and exact grant preservation for their connector/imported kinds .

**Evidence.** `src/blotter/document-packets.ts`; `src/blotter/document-catalog.ts`; `src/blotter/document-related.ts`; `src/blotter/document-downloads.ts`; `src/ui/document-packets.tsx`; `migrations/core/0053_document_packets.sql`; `tests/blotter/document-packets.test.mjs`; `tests/blotter/document-sharing.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: INTEGRATE-003; MIGRATE-001–005 inherit this catalog; original custody; exact grant preservation for their connector/imported kinds .

#### DOC-002 — Document sharing and internal only custody

Core · target · **partial** · Cites BASE-AUDIT-001, BASE-ROLE-001 · Rules D-1

**Requirement.** Per-document visibility supports internal-only workpapers, selected client contacts and revocable/expiring approved shares. Preview recipients and access before sharing, audit downloads and preserve visibility on versions, connector copies and migration. External sharing never bypasses client or job permissions.

**Acceptance.**
1. Keep a workpaper internal, share a final packet with one contact, rotate/revoke its share and attempt direct reads as another contact and preparer.
2. Inspect inherited version permissions and retained access history.

**Evidence.** `src/blotter/document-shares.ts`; `src/blotter/documents.ts`; `src/blotter/deliverables.ts`; `src/ui/document-access.tsx`; `src/ui/portal.tsx`; `migrations/core/0050_document_shares.sql`; `tests/blotter/document-sharing.test.mjs`; `tests/blotter/intake.test.mjs`; `tests/blotter/flows.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Keep a workpaper internal; share a final packet with one contact; rotate/revoke its share; attempt direct reads as another contact; preparer; Inspect inherited version permissions; retained access history.

#### DOC-007 — All current byte stores are covered: requested-job uploads

Core · target · **partial** · From DOC-002 · Cites BASE-DATA-001, BASE-DATA-006, BASE-INPUT-003, BASE-MAIL-001, BASE-ROLE-001 · Rules D-1

**Requirement.** Provide all current byte stores are covered: requested-job uploads.

**Acceptance.**
1. All current byte stores are covered: requested-job uploads (including converted intake and notice source files), deliverable versions, task attachments, expense receipts, notice timeline attachments and pre-conversion intake uploads.
2. Filing defaults to internal.
3. A principal or reviewer previews and grants individual active, authorized portal contacts on the file's own active entity; staff retain the job's existing read scope.
4. Pre-conversion intake has no entity authority and remains internal.
5. Download shares are one-file, one-contact bearer credentials: 32 random bytes, only SHA-256 stored, shown once, never automatically mailed, and expire after an explicitly chosen time within 30 × 24 hours.
6. Possession is not verified personal identity; the UI says so.
7. Rotate invalidates the old copy; revoke, erasure, contact edits/revocation, entity archive and permission changes refuse it.
8. Every fetch rechecks the current file hash, entity, contact and grant, and records a download without the secret.

**Evidence.** `src/blotter/document-shares.ts`; `src/blotter/documents.ts`; `src/blotter/deliverables.ts`; `src/ui/document-access.tsx`; `src/ui/portal.tsx`; `migrations/core/0050_document_shares.sql`; `tests/blotter/document-sharing.test.mjs`; `tests/blotter/intake.test.mjs`; `tests/blotter/flows.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: All current byte stores are covered: requested-job uploads (including converted intake; notice source files); deliverable versions; task attachments; expense receipts; notice timeline attachments; pre-conversion intake uploads; Filing defaults to internal; A principal or reviewer previews; grants individual active; authorized portal contacts on the file's own active entity; staff retain the job's existing read scope; Pre-conversion intake has no entity authority; remains internal; Download shares are one-file; one-contact bearer credentials: 32 random bytes; only SHA-256 stored; shown once; never automatically mailed; and expire after an explicitly chosen time within 30 × 24 hours; Possession is not verified personal identity; the UI says so; Rotate invalidates the old copy; revoke; erasure; contact edits/revocation; entity archive; permission changes refuse it; Every fetch rechecks the current file hash; entity; contact; grant; and records a download without the secret.

#### DOC-008 — The contact-bound job portal lists/downloads only its explicit

Core · target · **partial** · From DOC-002 · Cites BASE-AUDIT-001, BASE-DATA-001, BASE-ROLE-001 · Rules D-1

**Requirement.** Provide the contact-bound job portal lists/downloads only its explicit.

**Acceptance.**
1. The contact-bound job portal lists/downloads only its explicit file grants; a different contact cannot fetch or approve another contact's deliverable.
2. The assigned preparer's existing explicit deliverable send grants that version only to its selected currently authorized/consented contact; later versions inherit the preceding version's exact visibility/grants and never its tokens.
3. A different recipient requires the principal/reviewer's explicit policy change first.
4. A changed task attachment hash becomes internal until explicitly approved again.
5. Grants and access/download history survive archives and authorized client merge/undo; bearer tokens do not survive archive restore and old links are revoked by a merge/undo.
6. DOC-001 inherits further version kinds, INTEGRATE-003 connector copies and MIGRATE-001–005 imported documents; none may broaden the source grant or bypass current client/job authority.

**Evidence.** `src/blotter/document-shares.ts`; `src/blotter/documents.ts`; `src/blotter/deliverables.ts`; `src/ui/document-access.tsx`; `src/ui/portal.tsx`; `migrations/core/0050_document_shares.sql`; `tests/blotter/document-sharing.test.mjs`; `tests/blotter/intake.test.mjs`; `tests/blotter/flows.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: The contact-bound job portal lists/downloads only its explicit file grants; a different contact cannot fetch or approve another contact's deliverable; The assigned preparer's existing explicit deliverable send grants that version only to its selected currently authorized/consented contact; later versions inherit the preceding version's exact visibility/grants; never its tokens; A different recipient requires the principal/reviewer's explicit policy change first; A changed task attachment hash becomes internal until explicitly approved again; Grants; access/download history survive archives; authorized client merge/undo; bearer tokens do not survive archive restore; old links are revoked by a merge/undo; DOC-001 inherits further version kinds; INTEGRATE-003 connector copies; MIGRATE-001–005 imported documents; none may broaden the source grant or bypass current client/job authority.

#### DOC-003 — Client approval of deliverables

Core · target · **partial** · Cites BASE-INPUT-003, BASE-ROLE-001 · Rules D-1

**Requirement.** Staff send a deliverable such as a draft return copy, financial statements or a management report for client approval. The client approves, or requests changes with comments, on that exact version. An approval records the approver, the time and the document hash. Uploading a newer version resets approval, and approval can move the work item's status (WORK-007).

**Acceptance.**
1. Send version 1 of a set of financial statements.
2. The client requests a change with a comment.
3. Upload version 2 and have the client approve it.
4. Inspect the approval bound to version 2's hash, the retained comment on version 1 and the resulting status change.
5. Approving version 1 after version 2 exists is refused.

**Evidence.** `src/blotter/deliverables.ts`; `src/blotter/documents.ts`; `migrations/core/0019_deliverables.sql`; `src/ui/deliverables.tsx`; `tests/blotter/flows.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Send version 1 of a set of financial statements; The client requests a change with a comment; Upload version 2; have the client approve it; Inspect the approval bound to version 2's hash; the retained comment on version 1; the resulting status change; Approving version 1 after version 2 exists is refused.

#### SEARCH-001 — Firm wide search

Core · target · **partial** · Cites BASE-ACCESSIBILITY-001, BASE-INPUT-003, BASE-MAIL-001, BASE-ROLE-001 · Rules D-1

**Requirement.** One search covers clients, contacts, work items, tasks, emails, portal messages, notes, documents (by name and extracted text) and invoices. Results can be filtered by type, are ordered by relevance and recency, tolerate typos and open from the keyboard. They include only what the searcher may see under ACCESS-002 and MAIL-002. Searching by EIN or SSN works only for authorized roles, and results show the number masked.

**Acceptance.**
1. Search for a client's last name, an invoice number, a phrase inside an uploaded PDF and an email subject, and open each result.
2. A preparer without access to a client gets no result from that client, and a private thread never appears.
3. Searching the last four digits of an SSN works only for an authorized role and shows the number masked.

**Evidence.** `src/blotter/search.ts`; `src/blotter/pdf-text.ts`; `migrations/core/0044_search.sql`; `src/ui/search.tsx`; `tests/blotter/flows.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Search for a client's last name; an invoice number; a phrase inside an uploaded PDF; an email subject; and open each result; A preparer without access to a client gets no result from that client; and a private thread never appears; Searching the last four digits of an SSN works only for an authorized role; shows the number masked.

#### SEARCH-002 — One query covers the clients, contacts , jobs

Core · target · **partial** · From SEARCH-001 · Cites BASE-DATA-001, BASE-DATA-006, BASE-INPUT-003 · Rules D-1

**Requirement.** Provide one query covers the clients, contacts , jobs.

**Acceptance.**
1. One query (1 to 200 characters) covers the clients, contacts (each client's contact), jobs (work items), job tasks, client portal messages and to-dos (PORTAL-003), discussion notes (COLLAB-001 thread messages) and uploaded documents (by file name and by extracted text) the searcher may read: the principal and reviewers read the whole firm; anyone else reads the jobs they may read (ACCESS-001, WORK-009), the clients of those jobs, and the discussions the preparer of that work may read.
2. Extracted text is read from plain-text and CSV files and from the strings a PDF's content streams (uncompressed or FlateDecode) show; scanned images and other encodings yield none (nothing is guessed).
3. A document's text is extracted on the first search after upload and kept; erasing the file's bytes deletes it, and it is left out of archives.
4. Query and record text are split into words (case and accents ignored).

**Evidence.** `src/blotter/search.ts`; `src/blotter/pdf-text.ts`; `migrations/core/0044_search.sql`; `src/ui/search.tsx`; `tests/blotter/flows.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: One query (1 to 200 characters) covers the clients; contacts (each client's contact); jobs (work items); job tasks; client portal messages; to-dos (PORTAL-003); discussion notes (COLLAB-001 thread messages); uploaded documents (by file name; by extracted text) the searcher may read: the principal; reviewers read the whole firm; anyone else reads the jobs they may read (ACCESS-001; WORK-009); the clients of those jobs; and the discussions the preparer of that work may read; Extracted text is read from plain-text; CSV files; from the strings a PDF's content streams (uncompressed or FlateDecode) show; scanned images; other encodings yield none (nothing is guessed); A document's text is extracted on the first search after upload; kept; erasing the file's bytes deletes it; and it is left out of archives; Query; record text are split into words (case; accents ignored).

#### SEARCH-003 — Every query word must match a word of

Core · target · **partial** · From SEARCH-001 · Cites BASE-AUDIT-001, BASE-INPUT-003, BASE-ROLE-001 · Rules D-1

**Requirement.** Provide every query word must match a word of.

**Acceptance.**
1. Every query word must match a word of the result exactly (3), as a prefix (2) or within one typo for words of 4 to 7 letters, two for 8 or more (1, insertions, deletions, substitutions and transpositions); a match in the result's own name counts double, and the whole query appearing as a phrase adds 5.
2. Results are ordered by that score, then most recent first (the record's latest activity: done, answered, uploaded, posted or created), at most 50, optionally filtered to one type, and each carries the door that opens it (the client's history, the job, the discussion, or the file download); in the app "/" focuses the box, arrow keys move and Enter opens the chosen result.
3. A client's tax id (the EIN column) matches a query of four or more digits (spaces and hyphens ignored) only for the principal or a reviewer, and every client result shows it masked to its last four digits for every role.

**Evidence.** `src/blotter/search.ts`; `src/blotter/pdf-text.ts`; `migrations/core/0044_search.sql`; `src/ui/search.tsx`; `tests/blotter/flows.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Every query word must match a word of the result exactly (3); as a prefix (2) or within one typo for words of 4 to 7 letters; two for 8 or more (1; insertions; deletions; substitutions; transpositions); a match in the result's own name counts double; and the whole query appearing as a phrase adds 5; Results are ordered by that score; then most recent first (the record's latest activity: done; answered; uploaded; posted or created); at most 50; optionally filtered to one type; and each carries the door that opens it (the client's history; the job; the discussion; or the file download); in the app "/" focuses the box; arrow keys move; Enter opens the chosen result; A client's tax id (the EIN column) matches a query of four or more digits (spaces; hyphens ignored) only for the principal or a reviewer; and every client result shows it masked to its last four digits for every role.

#### SEARCH-004 — Emails and their subjects , private threads never

Core · target · **partial** · From SEARCH-001 · Cites BASE-MAIL-001 · Rules D-1

**Requirement.** Provide emails and their subjects , private threads never.

**Acceptance.**
1. Emails and their subjects (MAIL-001), private threads never appearing (MAIL-002), invoices and invoice numbers (BILL-002), individual SSNs (CRM-001, matched and masked like the EIN), and client and document grants narrowing results (ACCESS-002) each join this search under the same access rule .

**Evidence.** `src/blotter/search.ts`; `src/blotter/pdf-text.ts`; `migrations/core/0044_search.sql`; `src/ui/search.tsx`; `tests/blotter/flows.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Emails; their subjects (MAIL-001); private threads never appearing (MAIL-002); invoices; invoice numbers (BILL-002); individual SSNs (CRM-001; matched; masked like the EIN); and client; document grants narrowing results (ACCESS-002) each join this search under the same access rule .

#### FOLLOWUP-001 — Automatic document chasing and escalation

Core · target · **partial** · Cites BASE-MAIL-001 · Rules D-1

**Requirement.** A firm-approved reminder sequence follows missing documents, organizer answers, signatures and unresolved questions through email, portal and opted-in US SMS via Twilio. Configure owner, business hours, cadence, maximum sends, pause and manager escalation. Each step's wording is a MSG-001 template rendered for the recipient at send time; a step whose placeholders cannot resolve is held and its owner is told, rather than sent. Re-evaluate outstanding items before each send, stop completed/declined items and record provider acceptance, delivery or failure separately. Respect SMS consent and STOP/HELP, firm sender registration and provider outages; an unanswered notification never resolves the blocker.

**Acceptance.**
1. Approve a bounded reminder sequence, leave two items missing and complete one between sends.
2. Observe only the remaining item chased, with that step's template rendered for the client and listing only the outstanding item, a failed delivery surfaced to its owner and escalation at the configured condition.
3. Reply STOP to an actual consented US SMS and verify further SMS ceases; pause and resume without duplicate sends.

**Evidence.** `src/blotter/documents.ts`; `src/blotter/proposals.ts`; `tests/blotter/flows.test.mjs`; `src/blotter/automation.ts`; `src/blotter/automation-runner.ts`; `tests/blotter/automation.test.mjs`
**Gap.** Manual/human-approved reminders and approved bounded native event/due-time automation exist. Multistep reminder sequences, latest-template-per-step behavior, response-based stopping, escalation, successor-owned sequences, Twilio and carrier outcomes remain missing.

#### FOLLOWUP-002 — Offboarding for FOLLOWUP-002

Core · target · **partial** · From FOLLOWUP-001 · Rules D-1

**Requirement.** Provide offboarding for FOLLOWUP-002.

**Acceptance.**
1. A departing staff member's scheduled reminder sequences appear in the offboarding preview and move to the work successor in its approved batch; later sends go from the successor and past sends keep their sender.

**Evidence.** `src/blotter/documents.ts`; `src/blotter/proposals.ts`; `tests/blotter/flows.test.mjs`; `src/blotter/automation.ts`; `src/blotter/automation-runner.ts`; `tests/blotter/automation.test.mjs`
**Gap.** Manual/human-approved reminders and approved bounded native event/due-time automation exist. Multistep reminder sequences, latest-template-per-step behavior, response-based stopping, escalation, successor-owned sequences, Twilio and carrier outcomes remain missing.

#### FOLLOWUP-003 — Offboard a preparer with a scheduled reminder sequence

Core · target · **partial** · From FOLLOWUP-001 · Rules D-1

**Requirement.** Provide offboard a preparer with a scheduled reminder sequence.

**Acceptance.**
1. Offboard a preparer with a scheduled reminder sequence; the next reminder goes from the successor and earlier reminders still show the preparer.

**Evidence.** `src/blotter/documents.ts`; `src/blotter/proposals.ts`; `tests/blotter/flows.test.mjs`; `src/blotter/automation.ts`; `src/blotter/automation-runner.ts`; `tests/blotter/automation.test.mjs`
**Gap.** Manual/human-approved reminders and approved bounded native event/due-time automation exist. Multistep reminder sequences, latest-template-per-step behavior, response-based stopping, escalation, successor-owned sequences, Twilio and carrier outcomes remain missing.

#### FOLLOWUP-004 — Message templates for FOLLOWUP-004

Core · target · **partial** · From FOLLOWUP-001 · Cites BASE-ROLE-001 · Rules D-1

**Requirement.** Provide message templates for FOLLOWUP-004.

**Acceptance.**
1. Each reminder-sequence step may use a firm or personal template, rendered per recipient when it sends, with the same refusal and stored text; editing the template changes later steps only.

**Evidence.** `src/blotter/documents.ts`; `src/blotter/proposals.ts`; `tests/blotter/flows.test.mjs`; `src/blotter/automation.ts`; `src/blotter/automation-runner.ts`; `tests/blotter/automation.test.mjs`
**Gap.** Manual/human-approved reminders and approved bounded native event/due-time automation exist. Multistep reminder sequences, latest-template-per-step behavior, response-based stopping, escalation, successor-owned sequences, Twilio and carrier outcomes remain missing.

#### FOLLOWUP-005 — Use the "month-end close request" template as step

Core · target · **partial** · From FOLLOWUP-001 · Rules D-1

**Requirement.** Provide use the "month-end close request" template as step.

**Acceptance.**
1. Use the "Month-end close request" template as step 2 of a sequence for two clients with different periods and outstanding lists, inspect both rendered messages, edit the template and confirm the next step uses the new version while sent steps keep their text.

**Evidence.** `src/blotter/documents.ts`; `src/blotter/proposals.ts`; `tests/blotter/flows.test.mjs`; `src/blotter/automation.ts`; `src/blotter/automation-runner.ts`; `tests/blotter/automation.test.mjs`
**Gap.** Manual/human-approved reminders and approved bounded native event/due-time automation exist. Multistep reminder sequences, latest-template-per-step behavior, response-based stopping, escalation, successor-owned sequences, Twilio and carrier outcomes remain missing.

#### FOLLOWUP-006 — Msg-002 marketing consent for FOLLOWUP-006

Core · target · **partial** · From FOLLOWUP-001 · Rules D-1

**Requirement.** Provide msg-002 marketing consent for FOLLOWUP-006.

**Acceptance.**
1. Follow-up sequences send engagement class only, with MSG-002's send-time recheck.

**Evidence.** `src/blotter/documents.ts`; `src/blotter/proposals.ts`; `tests/blotter/flows.test.mjs`; `src/blotter/automation.ts`; `src/blotter/automation-runner.ts`; `tests/blotter/automation.test.mjs`
**Gap.** Manual/human-approved reminders and approved bounded native event/due-time automation exist. Multistep reminder sequences, latest-template-per-step behavior, response-based stopping, escalation, successor-owned sequences, Twilio and carrier outcomes remain missing.

### Review ledger context and capacity (target clauses)

#### LEDGER-001 — QuickBooks and Xero client ledger context

Core · target · **missing** · Cites BASE-ROLE-001 · Rules D-1

**Requirement.** Connect QuickBooks Online/QuickBooks Online Accountant and Xero organizations to the correct clients, showing read-only transaction, balance, reconciliation and period-close context with source links, last successful sync and explicit stale/partial state. Reconnect and multi-client permission changes preserve mappings. Reading client books grants no permission to write ledger entries or access the firm's billing ledger.

**Acceptance.**
1. Authorize QBO Accountant and Xero client organizations, map them to two engagements and inspect a transaction, balance and close context against each source.
2. Revoke one grant and change the period; stale context is labeled and never silently treated as current.

**Evidence.** None.
**Gap.** No client-ledger connector exists. The held QBO and Xero app credentials do not include company consent: the injector reports QBO_REFRESH_TOKEN and XERO_REFRESH_TOKEN missing. Authorized company grants, organization identifiers and a registered Blotter callback are required for sandbox proof; neither source-comparison nor revocation and period-change acceptance has passing evidence. Ledger-path authority, audit, erasure, portability and sync-failure notification are also unproved.

#### LEDGER-002 — Transaction questions and close evidence

Core · target · **missing** · Rules D-1

**Requirement.** Ask clients precise questions against source-ledger transactions and period reconciliations, attach their answers/documents and carry unresolved issues into preparer/reviewer work. Compare current and prior periods, flag unusual movements and retain the source snapshot and staff disposition. A reply alone cannot book an adjustment or certify a close.

**Acceptance.**
1. Select an uncategorized transaction, request its business purpose, receive an answer and receipt, then return it for more evidence.
2. Inspect the source-linked thread in review, a prior-period variance and the recorded reviewer decision without any unapproved ledger write.

**Evidence.** None.
**Gap.** No ledger-linked transaction questions, close comparisons or source snapshots exist.

#### LEDGER-003 — Cross client books health dashboard

Core · target · **missing** · Cites BASE-ROLE-001 · Rules D-1

**Requirement.** For every connected QBO and Xero client, a firm dashboard shows uncategorized transaction count and amount, unreconciled accounts and their last reconciled date, bank-feed connection errors, the last close date and unusual AR/AP aging. It can be sorted by client, staff member and period, drills down to source links and shows each client's data freshness. One action sends a client's uncategorized transactions as LEDGER-002 questions.

**Acceptance.**
1. With two QBO clients and one Xero client connected, compare the dashboard counts with each source.
2. A broken bank feed is flagged.
3. Sort by staff member, and send one client's uncategorized transactions as questions.
4. Revoke a grant and see that client labeled stale.

**Evidence.** None.
**Gap.** No ledger connection exists, so no cross-client books dashboard exists.

#### CAPACITY-001 — Workload capacity and coverage

Core · target · **partial** · Rules D-1

**Requirement.** Plan staff hours by week, skill, service, availability, leave and non-client commitments against estimated remaining work and review demand. Show overload, unscheduled work and deadline conflicts across the firm with drill-down to jobs; distinguish estimates from actual time.

**Acceptance.**
1. Load a tax-season week with preparer/reviewer budgets, scheduled leave and a client meeting.
2. Inspect available hours, overloaded staff and affected jobs; adjust an estimate and confirm totals and conflict explanations update.

**Evidence.** `src/blotter/capacity.ts`; `src/ui/capacity.tsx`; `migrations/core/0037_capacity.sql`; `tests/blotter/flows.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Load a tax-season week with preparer/reviewer budgets; scheduled leave; a client meeting; Inspect available hours; overloaded staff; affected jobs; adjust an estimate; confirm totals; conflict explanations update.

#### CAPACITY-004 — capacity week runs monday to sunday

Core · target · **partial** · From CAPACITY-001 · Cites BASE-ROLE-001 · Rules D-1

**Requirement.** Provide a capacity week runs monday to sunday .

**Acceptance.**
1. A capacity week runs Monday to Sunday (UTC dates).
2. Until an admin role exists the principal sets each person's weekly hours (in minutes; 40 hours when unset, shown as a default) and skills, and schedules leave (whole weekdays at a fifth of the weekly hours each), client meetings and internal commitments (minutes on each weekday from one date to another, a meeting optionally linked to its job); only weekdays Monday to Friday count.
3. Available = weekly hours less leave and commitments in the week, never below zero.
4. Demand is estimated remaining work: the estimates of open, applicable tasks a person owns (WORK-009 owner resolution) whose due date (the task's, else the job's) falls in the week, plus the review estimate of each job they review that is not signed off and falls due in the week.
5. Actual time is the person's recorded time in the week, and per job their total time on it, shown beside the estimates and never subtracted from them.
6. A person is overloaded when demand exceeds available.

**Evidence.** `src/blotter/capacity.ts`; `src/ui/capacity.tsx`; `migrations/core/0037_capacity.sql`; `tests/blotter/flows.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: A capacity week runs Monday to Sunday (UTC dates); Until an admin role exists the principal sets each person's weekly hours (in minutes; 40 hours when unset; shown as a default); skills; and schedules leave (whole weekdays at a fifth of the weekly hours each); client meetings; internal commitments (minutes on each weekday from one date to another; a meeting optionally linked to its job); only weekdays Monday to Friday count; Available = weekly hours less leave; commitments in the week; never below zero; Demand is estimated remaining work: the estimates of open; applicable tasks a person owns (WORK-009 owner resolution) whose due date (the task's; else the job's) falls in the week; plus the review estimate of each job they review that is not signed off; falls due in the week; Actual time is the person's recorded time in the week; and per job their total time on it; shown beside the estimates; never subtracted from them; A person is overloaded when demand exceeds available.

#### CAPACITY-005 — Open tasks or reviews due in the week

Core · target · **partial** · From CAPACITY-001 · Cites BASE-AUDIT-001 · Rules D-1

**Requirement.** Provide open tasks or reviews due in the week.

**Acceptance.**
1. Open tasks or reviews due in the week without an estimate are unscheduled; open tasks due before the week are listed as past due; neither counts toward demand.
2. A deadline conflict is a job due in the week that is not signed off, with one explanation for each of its people who is overloaded or on leave between the week's start and its due date, and for each unscheduled item on it.
3. The view filters by skill (people who have it) and service (the job's work type, WORK-007) and drills down to each job; reviewers and the principal see the whole firm, a preparer sees only themselves.
4. The job's people (or a reviewer or the principal) adjust an open task's estimate or the job's review estimate; every change is audited.
5. CAPACITY-002 and CAPACITY-003 build on this model.

**Evidence.** `src/blotter/capacity.ts`; `src/ui/capacity.tsx`; `migrations/core/0037_capacity.sql`; `tests/blotter/flows.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Open tasks or reviews due in the week without an estimate are unscheduled; open tasks due before the week are listed as past due; neither counts toward demand; A deadline conflict is a job due in the week that is not signed off; with one explanation for each of its people who is overloaded or on leave between the week's start; its due date; and for each unscheduled item on it; The view filters by skill (people who have it); service (the job's work type; WORK-007); drills down to each job; reviewers; the principal see the whole firm; a preparer sees only themselves; The job's people (or a reviewer or the principal) adjust an open task's estimate or the job's review estimate; every change is audited; CAPACITY-002; CAPACITY-003 build on this model.

#### CAPACITY-002 — Reassignment and dependency aware scheduling

Core · target · **partial** · Cites BASE-MAIL-001, BASE-ROLE-001 · Rules D-1

**Requirement.** Reassign and reschedule work when staff are absent or overloaded, proposing eligible coverage with client authority, skills, remaining capacity, dependency order and independent reviewer constraints. Preview notifications and affected deadlines; a manager approves the plan and owns unresolved conflicts.

**Acceptance.**
1. Remove an assigned preparer for leave, preview alternate staffing and move a dependent job chain.
2. Approve the feasible changes, refuse an ineligible/self-review assignment and inspect new owners, notifications and unresolved deadline conflicts.

**Evidence.** `src/blotter/coverage.ts`; `src/blotter/history.ts`; `migrations/core/0042_coverage.sql`; `src/ui/coverage.tsx`; `tests/blotter/flows.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Remove an assigned preparer for leave; preview alternate staffing; move a dependent job chain; Approve the feasible changes; refuse an ineligible/self-review assignment; inspect new owners; notifications; unresolved deadline conflicts.

#### CAPACITY-006 — manager is a reviewer or the principal

Core · target · **partial** · From CAPACITY-002 · Cites BASE-MAIL-001, BASE-ROLE-001 · Rules D-1

**Requirement.** Provide a manager is a reviewer or the principal.

**Acceptance.**
1. A manager is a reviewer or the principal (the people who reschedule under WORK-004); they plan cover for a person on leave or over capacity between two dates (at most 92 days apart).
2. The plan takes the open jobs that person prepares, and the jobs not yet completed that they review, falling due from the first date through 14 days after the last, ordered so each job comes after the planned jobs it waits for (WORK-003) and otherwise by due date.
3. For each role the person holds it proposes an eligible colleague (preparer: an active preparer, reviewer or the principal; reviewer: an active reviewer or the principal) who is not the person, never reviews their own work, is not the job's partner as preparer, is not on CAPACITY-001 leave on the due date and still has the job's estimated minutes free that week (available less demand less the plan's earlier moves); the colleague covering a job's prerequisite comes first, then one with the job's work type among their skills, then the most free minutes, then email order.

**Evidence.** `src/blotter/coverage.ts`; `src/blotter/history.ts`; `migrations/core/0042_coverage.sql`; `src/ui/coverage.tsx`; `tests/blotter/flows.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: A manager is a reviewer or the principal (the people who reschedule under WORK-004); they plan cover for a person on leave or over capacity between two dates (at most 92 days apart); The plan takes the open jobs that person prepares; and the jobs not yet completed that they review; falling due from the first date through 14 days after the last; ordered so each job comes after the planned jobs it waits for (WORK-003); otherwise by due date; For each role the person holds it proposes an eligible colleague (preparer: an active preparer; reviewer or the principal; reviewer: an active reviewer or the principal) who is not the person; never reviews their own work; is not the job's partner as preparer; is not on CAPACITY-001 leave on the due date; still has the job's estimated minutes free that week (available less demand less the plan's earlier moves); the colleague covering a job's prerequisite comes first; then one with the job's work type among their skills; then the most free minutes; then email order.

#### CAPACITY-007 — manager may name the preparer or reviewer

Core · target · **partial** · From CAPACITY-002 · Cites BASE-MAIL-001, BASE-ROLE-001 · Rules D-1

**Requirement.** Provide a manager may name the preparer or reviewer.

**Acceptance.**
1. A manager may name the preparer or reviewer, move a due date (with where it comes from) or leave a job out; a named person who is ineligible, would review their own work or lacks the capacity, or a prerequisite that would fall due after the job waiting for it, refuses the plan until changed.
2. The preview lists every line, the notifications and the unresolved conflicts (no eligible colleague free); approval needs the preview's fingerprint, applies every feasible line in one batch (role tasks follow, WORK-009), sends each notice in-app and by email with its delivery recorded, and records each conflict owned by the approving manager in the plan and among the client's unresolved items (CRM-003), where it can be handed on and is closed with a resolution note by its owner or the principal.

**Evidence.** `src/blotter/coverage.ts`; `src/blotter/history.ts`; `migrations/core/0042_coverage.sql`; `src/ui/coverage.tsx`; `tests/blotter/flows.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: A manager may name the preparer or reviewer; move a due date (with where it comes from) or leave a job out; a named person who is ineligible; would review their own work or lacks the capacity; or a prerequisite that would fall due after the job waiting for it; refuses the plan until changed; The preview lists every line; the notifications; the unresolved conflicts (no eligible colleague free); approval needs the preview's fingerprint; applies every feasible line in one batch (role tasks follow; WORK-009); sends each notice in-app; by email with its delivery recorded; and records each conflict owned by the approving manager in the plan; among the client's unresolved items (CRM-003); where it can be handed on; is closed with a resolution note by its owner or the principal.

#### CAPACITY-008 — Client authority

Core · target · **partial** · From CAPACITY-002 · Rules D-1

**Requirement.** Provide client authority.

**Acceptance.**
1. Until client grants exist every active member may work any client; when ACCESS-002 adds client and team grants, a proposed or named colleague must hold the client's grant.

**Evidence.** `src/blotter/coverage.ts`; `src/blotter/history.ts`; `migrations/core/0042_coverage.sql`; `src/ui/coverage.tsx`; `tests/blotter/flows.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Until client grants exist every active member may work any client; when ACCESS-002 adds client; team grants; a proposed or named colleague must hold the client's grant.

#### CAPACITY-003 — Capacity forecasts and hiring plans

Core · target · **partial** · Cites BASE-AUDIT-001 · Rules D-1

**Requirement.** Forecast future workload from approved recurring engagements, historical completion/time, pipeline and seasonality, with visible assumptions and confidence ranges. Compare staffing, hiring or service-change scenarios without altering actual assignments or promised deadlines.

**Acceptance.**
1. Project the next tax season from recurring work and prior actuals, add a hypothetical hire and lost client, and compare demand/capacity by skill.
2. Inspect each week's forecast as a range with its stated confidence level, and confirm a client with no prior actuals widens the range and is named as the reason.
3. Trace estimates to sources and save a scenario without changing live work.

**Evidence.** `src/blotter/forecast.ts`; `src/blotter/capacity.ts`; `migrations/core/0043_capacity_scenarios.sql`; `src/ui/forecast.tsx`; `tests/blotter/flows.test.mjs`; `tests/blotter/pipeline-forecast.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Project the next tax season from recurring work; prior actuals; add a hypothetical hire; lost client; and compare demand/capacity by skill; Inspect each week's forecast as a range with its stated confidence level; and confirm a client with no prior actuals widens the range; is named as the reason; Trace estimates to sources; save a scenario without changing live work.

#### CAPACITY-009 — manager forecasts 1 to 53 monday-to-sunday weeks

Core · target · **partial** · From CAPACITY-003 · Rules D-1

**Requirement.** Provide a manager forecasts 1 to 53 monday-to-sunday weeks.

**Acceptance.**
1. A manager (a reviewer or the principal, as in CAPACITY-002; a preparer sees only their own capacity under CAPACITY-001) forecasts 1 to 53 Monday-to-Sunday weeks (UTC dates) from a Monday.
2. Demand is the periods of active, approved recurring rules (WORK-002) whose due date (the period's last day plus the rule's days) falls in a week, counted in that week; paused rules, skipped periods and periods whose job is already signed off are left out, and one-off jobs are not forecast.
3. A period's time traces to its source: the client's prior actuals for that template, which are the recorded time (TIME-001) on its signed-off jobs of earlier periods (a signed-off job with no recorded time is not one), using only periods starting in the same calendar month when there are any (seasonality); the estimate is their mean rounded to the minute, and the range runs from 90% of the smallest (rounded down) to 110% of the largest (rounded up).

**Evidence.** `src/blotter/forecast.ts`; `src/blotter/capacity.ts`; `migrations/core/0043_capacity_scenarios.sql`; `src/ui/forecast.tsx`; `tests/blotter/flows.test.mjs`; `tests/blotter/pipeline-forecast.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: A manager (a reviewer or the principal; as in CAPACITY-002; a preparer sees only their own capacity under CAPACITY-001) forecasts 1 to 53 Monday-to-Sunday weeks (UTC dates) from a Monday; Demand is the periods of active; approved recurring rules (WORK-002) whose due date (the period's last day plus the rule's days) falls in a week; counted in that week; paused rules; skipped periods; periods whose job is already signed off are left out; and one-off jobs are not forecast; A period's time traces to its source: the client's prior actuals for that template; which are the recorded time (TIME-001) on its signed-off jobs of earlier periods (a signed-off job with no recorded time is not one); using only periods starting in the same calendar month when there are any (seasonality); the estimate is their mean rounded to the minute; and the range runs from 90% of the smallest (rounded down) to 110% of the largest (rounded up).

#### CAPACITY-010 — Without prior actuals the period uses the rule's

Core · target · **partial** · From CAPACITY-003 · Rules D-1

**Requirement.** Provide without prior actuals the period uses the rule's.

**Acceptance.**
1. Without prior actuals the period uses the rule's time budget, else the work type's budget, else the sum of the template's task estimates, with a range from 50% to 150% of it (rounded to the minute), and the reason names the client; with none of these its estimate is zero and the reason says so.
2. Each week states its confidence: high when every period due in it rests on at least three prior actuals, medium when each rests on at least one, low when any rests on none (each such reason listed).
3. Capacity is each active person's weekly hours less leave and commitments on the week's weekdays (CAPACITY-001); by skill, a person counts in full under each of their skills, and demand counts under the skill named like its work type (lower case); a skill is short by its demand's high end less its capacity.

**Evidence.** `src/blotter/forecast.ts`; `src/blotter/capacity.ts`; `migrations/core/0043_capacity_scenarios.sql`; `src/ui/forecast.tsx`; `tests/blotter/flows.test.mjs`; `tests/blotter/pipeline-forecast.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Without prior actuals the period uses the rule's time budget; else the work type's budget; else the sum of the template's task estimates; with a range from 50% to 150% of it (rounded to the minute); and the reason names the client; with none of these its estimate is zero; the reason says so; Each week states its confidence: high when every period due in it rests on at least three prior actuals; medium when each rests on at least one; low when any rests on none (each such reason listed); Capacity is each active person's weekly hours less leave; commitments on the week's weekdays (CAPACITY-001); by skill; a person counts in full under each of their skills; and demand counts under the skill named like its work type (lower case); a skill is short by its demand's high end less its capacity.

#### CAPACITY-011 — scenario adds hypothetical hires , changes a

Core · target · **partial** · From CAPACITY-003 · Cites BASE-AUDIT-001 · Rules D-1

**Requirement.** Provide a scenario adds hypothetical hires , changes a.

**Acceptance.**
1. A scenario adds hypothetical hires (weekly minutes and skills from a start date), changes a person's weekly hours from a date (zero for a departure), drops lost clients' periods (listed as left out) and scales a work type's time to a percentage (0 drops the service); it is compared week by week and by skill with the baseline.
2. Forecasting computes from live records and stores nothing; saving a scenario stores only its name, window and changes (audited) and changes no job, rule, assignment, estimate, due date or capacity row; reopening it recomputes from current records.

**Evidence.** `src/blotter/forecast.ts`; `src/blotter/capacity.ts`; `migrations/core/0043_capacity_scenarios.sql`; `src/ui/forecast.tsx`; `tests/blotter/flows.test.mjs`; `tests/blotter/pipeline-forecast.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: A scenario adds hypothetical hires (weekly minutes; skills from a start date); changes a person's weekly hours from a date (zero for a departure); drops lost clients' periods (listed as left out); scales a work type's time to a percentage (0 drops the service); it is compared week by week; by skill with the baseline; Forecasting computes from live records; stores nothing; saving a scenario stores only its name; window; changes (audited); changes no job; rule; assignment; estimate; due date or capacity row; reopening it recomputes from current records.

#### CAPACITY-012 — Pipeline

Core · target · **partial** · From CAPACITY-003 · Rules D-1

**Requirement.** Provide pipeline.

**Acceptance.**
1. Each open prospect’s requested service contributes its own visible unweighted assumption that the prospect wins, with current stage, source, owner and whole-prospect annual fee in its stored currency.
2. An exact case-insensitive service/work-type name match is the default; the manager may choose another work type or leave the service unestimated.
3. Its first assumed work target defaults to the forecast start or is selected per service; demand repeats at the selected template’s monthly/quarterly/annual cadence through the window, or occurs once without a template.
4. Each engagement uses the same no-actuals estimate chain as recurring work (work-type budget, else template task estimates), with a 50%–150% range rounded to the minute.
5. Missing matches or budgets contribute zero explicitly labeled unestimated, with a named low-confidence reason.
6. Pipeline demand counts in weekly and skill totals in baseline and scenarios; service percentage changes scale it too.
7. Fees never become hours.
8. Won and lost prospects are excluded.

**Evidence.** `src/blotter/forecast.ts`; `src/blotter/capacity.ts`; `migrations/core/0043_capacity_scenarios.sql`; `src/ui/forecast.tsx`; `tests/blotter/flows.test.mjs`; `tests/blotter/pipeline-forecast.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Each open prospect’s requested service contributes its own visible unweighted assumption that the prospect wins; with current stage; source; owner; whole-prospect annual fee in its stored currency; An exact case-insensitive service/work-type name match is the default; the manager may choose another work type or leave the service unestimated; Its first assumed work target defaults to the forecast start or is selected per service; demand repeats at the selected template’s monthly/quarterly/annual cadence through the window; or occurs once without a template; Each engagement uses the same no-actuals estimate chain as recurring work (work-type budget; else template task estimates); with a 50%–150% range rounded to the minute; Missing matches or budgets contribute zero explicitly labeled unestimated; with a named low-confidence reason; Pipeline demand counts in weekly; skill totals in baseline; scenarios; service percentage changes scale it too; Fees never become hours; Won; lost prospects are excluded.

#### CAPACITY-013 — Pipeline for CAPACITY-013

Core · target · **partial** · From CAPACITY-003 · Rules D-1

**Requirement.** Provide pipeline for CAPACITY-013.

**Acceptance.**
1. These assumptions create no assignments, signed scope or promised deadlines.
2. Saved scenarios retain the selected work type and first target and recompute from current records.

**Evidence.** `src/blotter/forecast.ts`; `src/blotter/capacity.ts`; `migrations/core/0043_capacity_scenarios.sql`; `src/ui/forecast.tsx`; `tests/blotter/flows.test.mjs`; `tests/blotter/pipeline-forecast.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: These assumptions create no assignments; signed scope or promised deadlines; Saved scenarios retain the selected work type; first target; recompute from current records.

### Time billing payments and reporting

#### TIME-001 — Time budgets and activity suggestions

Core · target · **partial** · Cites BASE-MAIL-001, BASE-ROLE-001 · Rules D-1

**Requirement.** Record time against client/job/task with manual entry and timers, billable status and snapshotted rate; compare actual hours/cost with approved budgets. Suggest missing entries from consented work/email/calendar activity with source links, never silently creating billable time. Corrections retain authorship and respect locks.

**Acceptance.**
1. Record time, change the rate and inspect unchanged prior amounts and budget variance.
2. Stop/restart a timer, reject one activity suggestion and approve another; verify only approved minutes enter WIP and unauthorized edits are refused.

**Evidence.** `src/blotter/billing.ts`; `src/blotter/timers.ts`; `src/blotter/suggestions.ts`; `src/blotter/timesheets.ts`; `migrations/core/0031_timers.sql`; `migrations/core/0032_billable_time.sql`; `migrations/core/0033_activity_suggestions.sql`; `migrations/core/0034_time_tasks.sql`; `src/ui/timer.tsx`; `src/ui/suggestions.tsx`; `tests/blotter/flows.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Record time; change the rate; inspect unchanged prior amounts; budget variance; Stop/restart a timer; reject one activity suggestion; approve another; verify only approved minutes enter WIP; unauthorized edits are refused.

#### TIME-005 — Timers and budgets

Core · target · **partial** · From TIME-001 · Cites BASE-ROLE-001 · Rules D-1

**Requirement.** Provide timers and budgets.

**Acceptance.**
1. A person runs at most one timer, kept by the server so it continues across restarts and devices; stopping it records one time entry through the manual-entry path (rate in force snapshotted, closed periods refused) for the elapsed time rounded up to the next whole minute (at least 1, at most 1440), dated the UTC day the timer started, and a discarded timer records nothing.
2. A job's budget is the minutes approved by the reviewer or principal who starts it, or by its recurrence rule (WORK-002); actual is every recorded entry in any review state plus adjustments, at their snapshotted amounts, and variance is actual minus budget.

**Evidence.** `src/blotter/billing.ts`; `src/blotter/timers.ts`; `src/blotter/suggestions.ts`; `src/blotter/timesheets.ts`; `migrations/core/0031_timers.sql`; `migrations/core/0032_billable_time.sql`; `migrations/core/0033_activity_suggestions.sql`; `migrations/core/0034_time_tasks.sql`; `src/ui/timer.tsx`; `src/ui/suggestions.tsx`; `tests/blotter/flows.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: A person runs at most one timer; kept by the server so it continues across restarts; devices; stopping it records one time entry through the manual-entry path (rate in force snapshotted; closed periods refused) for the elapsed time rounded up to the next whole minute (at least 1; at most 1440); dated the UTC day the timer started; and a discarded timer records nothing; A job's budget is the minutes approved by the reviewer or principal who starts it; or by its recurrence rule (WORK-002); actual is every recorded entry in any review state plus adjustments; at their snapshotted amounts; and variance is actual minus budget.

#### TIME-006 — Billable status

Core · target · **partial** · From TIME-001 · Cites BASE-DATA-001, BASE-ROLE-001 · Rules D-1

**Requirement.** Provide billable status.

**Acceptance.**
1. Each time entry is billable or not, chosen by the person when they record it by hand or start a timer (billable unless they choose otherwise), and a TIME-002 correction keeps the returned entry's status unless the person changes it.
2. A non-billable entry keeps its snapshotted rate and amount and counts in the job's actual time, cost and variance, but neither it nor any adjustment to it is ever ready to bill: it stays out of WIP, is refused in a billing export and stays out of the job's margin (TIME-004).

**Evidence.** `src/blotter/billing.ts`; `src/blotter/timers.ts`; `src/blotter/suggestions.ts`; `src/blotter/timesheets.ts`; `migrations/core/0031_timers.sql`; `migrations/core/0032_billable_time.sql`; `migrations/core/0033_activity_suggestions.sql`; `migrations/core/0034_time_tasks.sql`; `src/ui/timer.tsx`; `src/ui/suggestions.tsx`; `tests/blotter/flows.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Each time entry is billable or not; chosen by the person when they record it by hand or start a timer (billable unless they choose otherwise); and a TIME-002 correction keeps the returned entry's status unless the person changes it; A non-billable entry keeps its snapshotted rate; amount; counts in the job's actual time; cost; variance; but neither it nor any adjustment to it is ever ready to bill: it stays out of WIP; is refused in a billing export; stays out of the job's margin (TIME-004).

#### TIME-007 — time entry or timer names its job

Core · target · **partial** · From TIME-001 · Rules D-1

**Requirement.** Provide a time entry or timer names its job.

**Acceptance.**
1. A time entry or timer names its job, and so its client, and optionally one of that job's checklist tasks; a correction keeps the task unless the person changes it.

**Evidence.** `src/blotter/billing.ts`; `src/blotter/timers.ts`; `src/blotter/suggestions.ts`; `src/blotter/timesheets.ts`; `migrations/core/0031_timers.sql`; `migrations/core/0032_billable_time.sql`; `migrations/core/0033_activity_suggestions.sql`; `migrations/core/0034_time_tasks.sql`; `src/ui/timer.tsx`; `src/ui/suggestions.tsx`; `tests/blotter/flows.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: A time entry or timer names its job; and so its client; and optionally one of that job's checklist tasks; a correction keeps the task unless the person changes it.

#### TIME-008 — Activity suggestions

Core · target · **partial** · From TIME-001 · Cites BASE-AUDIT-001, BASE-ROLE-001 · Rules D-1

**Requirement.** Provide activity suggestions.

**Acceptance.**
1. Consent is per person, off by default, given and withdrawn only by that person on their Jobs screen.
2. While it is on, that person's own audited work actions on jobs they can record time on (completing a checklist task, accepting or returning a document, opening, replying to or requesting a correction in a discussion, any tax-notice timeline action, discarding a timer) taken at or after the moment of consent suggest one entry per job and UTC day on which they recorded no time of their own on that job; each suggestion lists and links its source actions.
3. Only that person sees, approves or rejects their suggestions: approval needs the minutes and an explicit billable choice and records the entry through the manual-entry path (rate in force on that day snapshotted, closed periods refused); rejection records nothing; each decision is kept once with its source action ids.
4. Approved suggestions are ordinary time, so they reach WIP only once approved on a timesheet (TIME-002) and only if billable.
5. Withdrawing consent removes every pending suggestion, and consenting again never uses earlier actions.

**Evidence.** `src/blotter/billing.ts`; `src/blotter/timers.ts`; `src/blotter/suggestions.ts`; `src/blotter/timesheets.ts`; `migrations/core/0031_timers.sql`; `migrations/core/0032_billable_time.sql`; `migrations/core/0033_activity_suggestions.sql`; `migrations/core/0034_time_tasks.sql`; `src/ui/timer.tsx`; `src/ui/suggestions.tsx`; `tests/blotter/flows.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Consent is per person; off by default; given; withdrawn only by that person on their Jobs screen; While it is on; that person's own audited work actions on jobs they can record time on (completing a checklist task; accepting or returning a document; opening; replying to or requesting a correction in a discussion; any tax-notice timeline action; discarding a timer) taken at or after the moment of consent suggest one entry per job; UTC day on which they recorded no time of their own on that job; each suggestion lists; links its source actions; Only that person sees; approves or rejects their suggestions: approval needs the minutes; an explicit billable choice; records the entry through the manual-entry path (rate in force on that day snapshotted; closed periods refused); rejection records nothing; each decision is kept once with its source action ids; Approved suggestions are ordinary time; so they reach WIP only once approved on a timesheet (TIME-002); only if billable; Withdrawing consent removes every pending suggestion; and consenting again never uses earlier actions.

#### TIME-009 — Activity suggestions for TIME-009

Core · target · **partial** · From TIME-001 · Cites BASE-MAIL-001 · Rules D-1

**Requirement.** Provide activity suggestions for TIME-009.

**Acceptance.**
1. Email and calendar activity are not sources until MAIL-001 and INTEGRATE-005 ship, each with its own per-source consent (written into those clauses).

**Evidence.** `src/blotter/billing.ts`; `src/blotter/timers.ts`; `src/blotter/suggestions.ts`; `src/blotter/timesheets.ts`; `migrations/core/0031_timers.sql`; `migrations/core/0032_billable_time.sql`; `migrations/core/0033_activity_suggestions.sql`; `migrations/core/0034_time_tasks.sql`; `src/ui/timer.tsx`; `src/ui/suggestions.tsx`; `tests/blotter/flows.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Email; calendar activity are not sources until MAIL-001; INTEGRATE-005 ship; each with its own per-source consent (written into those clauses).

#### TIME-002 — Timesheet approval and period locks

Core · target · **partial** · Cites BASE-AUDIT-001, BASE-DATA-001, BASE-ROLE-001 · Rules D-1

**Requirement.** Staff submit timesheets to managers, who approve or return entries with reasons. Closing a billing period locks approved time; corrections use an authorized adjustment that preserves the original. Invoice/export reservations prevent the same work being billed twice.

**Acceptance.**
1. Submit a weekly timesheet, return and correct one entry, approve it and close the period.
2. Attempt direct edits and duplicate billing, then post an authorized adjustment and inspect its history.

**Evidence.** `src/blotter/timesheets.ts`; `src/blotter/billing.ts`; `migrations/core/0018_timesheets.sql`; `src/ui/timesheet.tsx`; `tests/blotter/flows.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Submit a weekly timesheet; return; correct one entry; approve it; close the period; Attempt direct edits; duplicate billing; then post an authorized adjustment; inspect its history.

#### TIME-003 — Billing rates and rate cards

Core · target · **partial** · Cites BASE-DATA-001, BASE-ROLE-001 · Rules D-1

**Requirement.** Billing rates are set by staff member, role and service or work type, with client-specific overrides and effective dates. The precedence is client and service, then client, then service, then staff member, then role. Role is the person's practice role (principal, reviewer or preparer). Service rates may target a WORK-007 work type or the engagement template the job was started from. Within either service scope (service or client and service), a matching work-type card takes precedence over template cards, then the latest effective date and creation order resolve cards for that target. Template cards continue to apply to jobs started from that template when no work-type card in that scope is in force; work types without a default template may have their own rates. Each time entry snapshots the rate it resolved and where that rate came from. A rate change takes effect from its date and never rewrites past entries.

**Acceptance.**
1. Set rates for a practice role, a staff member, a 1040 service, a client and that client plus service.
2. Record time with only the role matching, then with staff, service, client and client-plus-service rates also matching in turn; inspect each entry's resolved rate and source to prove every precedence level: client and service, client, service, staff member, role.
3. Verify role means principal, reviewer or preparer.
4. Start two jobs with distinct work types sharing a template and inspect their distinct service rates; a type without a default template also accepts its own rate.
5. Verify client overrides, work-type versus template specificity, effective dates and recorded snapshots through archive restore.
6. Change the staff rate effective next month and confirm past entries are unchanged.

**Evidence.** `src/blotter/rates.ts`; `src/blotter/billing.ts`; `src/ui/team.tsx`; `migrations/core/0080_work_type_rates.sql`; `tests/blotter/flows.test.mjs`; `tests/blotter/rate-worktypes.test.mjs`; `tests/blotter/rate-worktypes-ui.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Set rates for a practice role; a staff member; a 1040 service; a client; that client plus service; Record time with only the role matching; then with staff; service; client; client-plus-service rates also matching in turn; inspect each entry's resolved rate; source to prove every precedence level: client; staff member; role; Verify role means principal; reviewer or preparer; Start two jobs with distinct work types sharing a template; inspect their distinct service rates; a type without a default template also accepts its own rate; Verify client overrides; work-type versus template specificity; effective dates; recorded snapshots through archive restore; Change the staff rate effective next month; confirm past entries are unchanged.

#### TIME-004 — Expenses and disbursements

Core · target · **partial** · Cites BASE-DATA-001 · Rules D-1

**Requirement.** Record billable and non-billable expenses (filing fees, postage, mileage at the firm-set rate, software pass-throughs) against a client and work item. Each expense can carry a receipt, a markup and an approval, and approved billable expenses become BILL-002 invoice lines. Staff reimbursements are kept separate from client charges, and expenses count in WIP and profitability (BILL-003). Amounts are integer cents: a markup is a whole percent from 0 to 100 of cost, a billable expense charges its cost plus the markup rounded half up to the cent, and a non-billable expense charges nothing; mileage is miles to one decimal place at the firm's cents-per-mile rate in force on the expense date, rounded half up. A reviewer or the principal approves or rejects an expense, nobody but the principal approves their own, and an expense dated in a closed billing period (TIME-002) cannot be recorded. Mechanism: [details](docs/contract/mechanism.md).

**Acceptance.**
1. Record a state filing fee with a receipt and a 10% markup, approve it, invoice it and inspect the invoice line and WIP.
2. A non-billable expense stays off the invoice and appears in profitability.
3. An unapproved expense cannot be invoiced.

**Evidence.** `src/blotter/expenses.ts`; `src/blotter/billing.ts`; `migrations/core/0022_expenses.sql`; `src/ui/expenses.tsx`; `tests/blotter/flows.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Record a state filing fee with a receipt; a 10% markup; approve it; invoice it; inspect the invoice line; WIP; A non-billable expense stays off the invoice; appears in profitability; An unapproved expense cannot be invoiced.

#### BILL-001 — Reviewed immutable billing exports

Core · target · **partial** · Cites BASE-DATA-001 · Rules D-1

**Requirement.** Reviewers prepare time/fixed-fee CSV drafts with snapshotted sources. The principal approves once with a note; the approved bytes and digest remain unchanged and each source belongs to one live export. Draft voiding releases reservations; CSV cells neutralize spreadsheet formulas and preserve source currency.

**Acceptance.**
1. Prepare a mixed time/fixed-fee export, reject source reuse and non-owner approval, approve as principal and download twice.
2. Verify identical CSV bytes, source locks, formula-safe cells and a voided draft's released sources.

**Evidence.** `src/blotter/billing.ts`; `tests/blotter/flows.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Prepare a mixed time/fixed-fee export; reject source reuse; non-owner approval; approve as principal; download twice; Verify identical CSV bytes; source locks; formula-safe cells; a voided draft's released sources.

#### BILL-006 — Erasure-002 for BILL-006

Core · target · **partial** · From BILL-001 · Cites BASE-DATA-001, BASE-DATA-006 · Rules D-1

**Requirement.** Provide erasure-002 for BILL-006.

**Acceptance.**
1. Approved exports stay immutable; only ERASURE-002's confirmed expiry removes their bytes, keeping number, totals, revision and SHA-256.

**Evidence.** `src/blotter/billing.ts`; `tests/blotter/flows.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Approved exports stay immutable; only ERASURE-002's confirmed expiry removes their bytes; keeping number; totals; revision; SHA-256.

#### BILL-002 — Invoices retainers and recurring fees

Core · target · **partial** · Cites BASE-ROLE-001 · Rules D-1

**Requirement.** Create numbered USD invoices from approved time, fixed scope, milestones or recurring retainers; separate fee entitlement from job completion. Preview invoice lines, terms, authorized sales-tax treatment, credits and client recipients, then approve and deliver PDF/portal invoices. Retainer deposits, credits, price changes, cancellation and prorations remain traceable. Select exactly one invoice authority: Blotter, QuickBooks Online or Xero; schedule generation is idempotent.

**Acceptance.**
1. Bill a fixed engagement and hourly extra, start a monthly retainer, apply a deposit and preview a fee amendment.
2. Approve/deliver invoices, repeat the schedule event and inspect one invoice per entitlement with USD totals and retained source links.

**Evidence.** `src/blotter/invoices.ts`; `src/blotter/invoices-sources.ts`; `src/blotter/invoices-retainers.ts`; `src/blotter/invoices-delivery.ts`; `src/blotter/invoices-credits.ts`; `src/blotter/invoices-pdf.ts`; `src/blotter/invoice-routes.ts`; `src/blotter/report-invoices.ts`; `src/ui/invoices.tsx`; `migrations/core/0086_invoices.sql`; `migrations/core/0089_invoice_auto.sql`; `tests/blotter/invoices.test.mjs`; `tests/blotter/invoices-ui.mjs`; `tests/blotter/invoice-report-proof.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Bill a fixed engagement; hourly extra; start a monthly retainer; apply a deposit; preview a fee amendment; Approve/deliver invoices; repeat the schedule event; inspect one invoice per entitlement with USD totals; retained source links.

#### BILL-007 — Engagement history for BILL-007

Core · target · **partial** · From BILL-002 · Cites BASE-AUDIT-001 · Rules D-1

**Requirement.** Provide engagement history for BILL-007.

**Acceptance.**
1. Issued, sent and voided invoices appear in the client's history with author, time and source link, visible only to those who may read the job, and any unresolved item they create names an owner, next action and due condition.

**Evidence.** `src/blotter/invoices.ts`; `src/blotter/invoices-sources.ts`; `src/blotter/invoices-retainers.ts`; `src/blotter/invoices-delivery.ts`; `src/blotter/invoices-credits.ts`; `src/blotter/invoices-pdf.ts`; `src/blotter/invoice-routes.ts`; `src/blotter/report-invoices.ts`; `src/ui/invoices.tsx`; `migrations/core/0086_invoices.sql`; `migrations/core/0089_invoice_auto.sql`; `tests/blotter/invoices.test.mjs`; `tests/blotter/invoices-ui.mjs`; `tests/blotter/invoice-report-proof.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Issued; sent; voided invoices appear in the client's history with author; time; source link; visible only to those who may read the job; and any unresolved item they create names an owner; next action; due condition.

#### BILL-008 — An issued invoice appears in the client history

Core · target · **partial** · From BILL-002 · Cites BASE-AUDIT-001 · Rules D-1

**Requirement.** Provide an issued invoice appears in the client history.

**Acceptance.**
1. An issued invoice appears in the client history linked to its source time and fees.

**Evidence.** `src/blotter/invoices.ts`; `src/blotter/invoices-sources.ts`; `src/blotter/invoices-retainers.ts`; `src/blotter/invoices-delivery.ts`; `src/blotter/invoices-credits.ts`; `src/blotter/invoices-pdf.ts`; `src/blotter/invoice-routes.ts`; `src/blotter/report-invoices.ts`; `src/ui/invoices.tsx`; `migrations/core/0086_invoices.sql`; `migrations/core/0089_invoice_auto.sql`; `tests/blotter/invoices.test.mjs`; `tests/blotter/invoices-ui.mjs`; `tests/blotter/invoice-report-proof.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: An issued invoice appears in the client history linked to its source time; fees.

#### BILL-009 — Erasure-002 for BILL-009

Core · target · **partial** · From BILL-002 · Cites BASE-DATA-001, BASE-DATA-006 · Rules D-1

**Requirement.** Provide erasure-002 for BILL-009.

**Acceptance.**
1. , BILL-002 adds its records and provider copies to ERASURE-002's classes, clocks, holds, preview, erasure, receipt and restore fence.

**Evidence.** `src/blotter/invoices.ts`; `src/blotter/invoices-sources.ts`; `src/blotter/invoices-retainers.ts`; `src/blotter/invoices-delivery.ts`; `src/blotter/invoices-credits.ts`; `src/blotter/invoices-pdf.ts`; `src/blotter/invoice-routes.ts`; `src/blotter/report-invoices.ts`; `src/ui/invoices.tsx`; `migrations/core/0086_invoices.sql`; `migrations/core/0089_invoice_auto.sql`; `tests/blotter/invoices.test.mjs`; `tests/blotter/invoices-ui.mjs`; `tests/blotter/invoice-report-proof.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: BILL-002 adds its records; provider copies to ERASURE-002's classes; clocks; holds; preview; erasure; receipt; restore fence.

#### BILL-010 — The principal selects the sole invoice authority; the

Core · target · **partial** · From BILL-002 · Cites BASE-DATA-001, BASE-MAIL-001, BASE-ROLE-001 · Rules D-1

**Requirement.** Provide the principal selects the sole invoice authority; the.

**Acceptance.**
1. The principal selects the sole invoice authority; the principal or an ACCESS-002 financial-authority holder (for the clients the holder holds) authorizes independent fixed/milestone/explicit-proration entitlements, records supplied deposit/credit evidence and tax treatment, approves numbered USD PDF snapshots and delivers them to an authorized billing contact.
2. Approved time, adjustments and expenses share source reservations with reviewed exports; a numbered document never releases its source links.
3. No taxability, bank settlement, charge or automatic proration is inferred.
4. Monthly rules approved by the principal or a financial-authority holder create one draft per rule/month; issue and send are separate person actions unless a holder's recorded automatic-issue consent covers the rule revision (below); price changes and cancellation apply from the reviewed future month while existing entitlement prices remain.
5. An explicit recorded credit allocation changes the current balance, never the issued PDF.
6. Invoice links are contact/revision-bound, expire after 30 days, expose only their invoice and recheck live billing/portal/email authority.
7. Unresolved sends are held for provider-evidence reconciliation without replay.
8. Restored rules are paused and old invoice links revoked.

**Evidence.** `src/blotter/invoices.ts`; `src/blotter/invoices-sources.ts`; `src/blotter/invoices-retainers.ts`; `src/blotter/invoices-delivery.ts`; `src/blotter/invoices-credits.ts`; `src/blotter/invoices-pdf.ts`; `src/blotter/invoice-routes.ts`; `src/blotter/report-invoices.ts`; `src/ui/invoices.tsx`; `migrations/core/0086_invoices.sql`; `migrations/core/0089_invoice_auto.sql`; `tests/blotter/invoices.test.mjs`; `tests/blotter/invoices-ui.mjs`; `tests/blotter/invoice-report-proof.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: The principal selects the sole invoice authority; the principal or an ACCESS-002 financial-authority holder (for the clients the holder holds) authorizes independent fixed/milestone/explicit-proration entitlements; records supplied deposit/credit evidence; tax treatment; approves numbered USD PDF snapshots; delivers them to an authorized billing contact; Approved time; adjustments; expenses share source reservations with reviewed exports; a numbered document never releases its source links; No taxability; bank settlement; charge or automatic proration is inferred; Monthly rules approved by the principal or a financial-authority holder create one draft per rule/month; issue; send are separate person actions unless a holder's recorded automatic-issue consent covers the rule revision (below); price changes; cancellation apply from the reviewed future month while existing entitlement prices remain; An explicit recorded credit allocation changes the current balance; never the issued PDF; Invoice links are contact/revision-bound; expire after 30 days; expose only their invoice; recheck live billing/portal/email authority; Unresolved sends are held for provider-evidence reconciliation without replay; Restored rules are paused; old invoice links revoked.

#### BILL-011 — Issued/sent/voided history links to its source job; open

Core · target · **partial** · From BILL-002 · Cites BASE-AUDIT-001, BASE-DATA-006, BASE-ROLE-001 · Rules D-1

**Requirement.** Provide issued/sent/voided history links to its source job; open.

**Acceptance.**
1. Issued/sent/voided history links to its source job; open balances name an owner, next action and due date.
2. Native invoice search and merge/undo preserve immutable document bytes and sources.
3. Existing performance reports project the selected job cohort’s native invoices, retainers, supplied credits and open USD receivables from live sources, with job/document/source links, generation time and the same values in CSV/PDF; they never label supplied credit evidence as provider settlement.
4. Each report download records its client scope and named downloader for erasure receipts.
5. Invoices, credits, rules and deliveries join ERASURE-002 billing/link classes, holds, counts, receipt and journal fence; open invoice balances and unapplied deposits/credits refuse whole-client erasure and billing expiry.
6. Erased-client invoice identities are absent from normal billing lists and use opaque expiry labels; explicit retained detail/PDF reads require the principal and are audited.
7. Retention clocks use issue and later void/credit/allocation dates in the firm timezone; expiry requires principal confirmation and preserves amounts, number, attribution and SHA-256.
8. INTEGRATE-001 inherits QBO/Xero authority selection and reconciliation before those connectors ship; unavailable external authorities refuse.

**Evidence.** `src/blotter/invoices.ts`; `src/blotter/invoices-sources.ts`; `src/blotter/invoices-retainers.ts`; `src/blotter/invoices-delivery.ts`; `src/blotter/invoices-credits.ts`; `src/blotter/invoices-pdf.ts`; `src/blotter/invoice-routes.ts`; `src/blotter/report-invoices.ts`; `src/ui/invoices.tsx`; `migrations/core/0086_invoices.sql`; `migrations/core/0089_invoice_auto.sql`; `tests/blotter/invoices.test.mjs`; `tests/blotter/invoices-ui.mjs`; `tests/blotter/invoice-report-proof.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Issued/sent/voided history links to its source job; open balances name an owner; next action; due date; Native invoice search; merge/undo preserve immutable document bytes; sources; Existing performance reports project the selected job cohort’s native invoices; retainers; supplied credits; open USD receivables from live sources; with job/document/source links; generation time; the same values in CSV/PDF; they never label supplied credit evidence as provider settlement; Each report download records its client scope; named downloader for erasure receipts; Invoices; credits; rules; deliveries join ERASURE-002 billing/link classes; holds; counts; receipt; journal fence; open invoice balances; unapplied deposits/credits refuse whole-client erasure; billing expiry; Erased-client invoice identities are absent from normal billing lists; use opaque expiry labels; explicit retained detail/PDF reads require the principal; are audited; Retention clocks use issue; later void/credit/allocation dates in the firm timezone; expiry requires principal confirmation; preserves amounts; number; attribution; SHA-256; INTEGRATE-001 inherits QBO/Xero authority selection; reconciliation before those connectors ship; unavailable external authorities refuse.

#### BILL-012 — Pay-001 inherits actual settlement evidence and balances before

Core · target · **partial** · From BILL-002 · Rules D-1

**Requirement.** Provide pay-001 inherits actual settlement evidence and balances before.

**Acceptance.**
1. PAY-001 inherits actual settlement evidence and balances before collections ship.
2. AUTOMATE-001 inherits invoice creation as an additional action before it is exposed; current invoice schedules create approved-rule drafts and, within a recorded consent, issue and send them.

**Evidence.** `src/blotter/invoices.ts`; `src/blotter/invoices-sources.ts`; `src/blotter/invoices-retainers.ts`; `src/blotter/invoices-delivery.ts`; `src/blotter/invoices-credits.ts`; `src/blotter/invoices-pdf.ts`; `src/blotter/invoice-routes.ts`; `src/blotter/report-invoices.ts`; `src/ui/invoices.tsx`; `migrations/core/0086_invoices.sql`; `migrations/core/0089_invoice_auto.sql`; `tests/blotter/invoices.test.mjs`; `tests/blotter/invoices-ui.mjs`; `tests/blotter/invoice-report-proof.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: PAY-001 inherits actual settlement evidence; balances before collections ship; AUTOMATE-001 inherits invoice creation as an additional action before it is exposed; current invoice schedules create approved-rule drafts and; within a recorded consent; issue; send them.

#### BILL-013 — Ruled for BILL-013

Core · target · **partial** · From BILL-002 · Cites BASE-AUDIT-001, BASE-DATA-006, BASE-MAIL-001, BASE-ROLE-001 · Rules D-1

**Requirement.** Provide ruled for BILL-013. This part applies RL-2.

**Acceptance.**
1. The principal or an ACCESS-002 financial-authority holder prepares, issues, sends and voids.
2. Selecting the invoice authority and confirming retention expiry stay principal-only.
3. A holder may enable automatic issue and send for one rule revision.
4. The consent records a per-invoice USD cap, the recipient and a reason, and it is audited.
5. Each run rechecks the consenter's live authority, the rule's terms and the recipient's billing role and email or portal consent.
6. A run issues and sends only within the cap and with no exception.
7. Otherwise it leaves a draft with a named exception.
8. The invoice states 'auto-issued under rule revision N'.

**Evidence.** `src/blotter/invoices.ts`; `src/blotter/invoices-sources.ts`; `src/blotter/invoices-retainers.ts`; `src/blotter/invoices-delivery.ts`; `src/blotter/invoices-credits.ts`; `src/blotter/invoices-pdf.ts`; `src/blotter/invoice-routes.ts`; `src/blotter/report-invoices.ts`; `src/ui/invoices.tsx`; `migrations/core/0086_invoices.sql`; `migrations/core/0089_invoice_auto.sql`; `tests/blotter/invoices.test.mjs`; `tests/blotter/invoices-ui.mjs`; `tests/blotter/invoice-report-proof.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: The principal or an ACCESS-002 financial-authority holder prepares; issues; sends; voids; Selecting the invoice authority; confirming retention expiry stay principal-only; A holder may enable automatic issue; send for one rule revision; The consent records a per-invoice USD cap; the recipient; a reason; and it is audited; Each run rechecks the consenter's live authority; the rule's terms; the recipient's billing role; email or portal consent; A run issues; sends only within the cap; with no exception; Otherwise it leaves a draft with a named exception; The invoice states 'auto-issued under rule revision N'.

#### BILL-014 — Ruled for BILL-014

Core · target · **partial** · From BILL-002 · Cites BASE-DATA-001, BASE-MAIL-001 · Rules D-1

**Requirement.** Provide ruled for BILL-014. This part applies RL-2.

**Acceptance.**
1. Delivery may be by email PDF to a billing contact without portal access.
2. A restore brings rules back paused and without consent.

**Evidence.** `src/blotter/invoices.ts`; `src/blotter/invoices-sources.ts`; `src/blotter/invoices-retainers.ts`; `src/blotter/invoices-delivery.ts`; `src/blotter/invoices-credits.ts`; `src/blotter/invoices-pdf.ts`; `src/blotter/invoice-routes.ts`; `src/blotter/report-invoices.ts`; `src/ui/invoices.tsx`; `migrations/core/0086_invoices.sql`; `migrations/core/0089_invoice_auto.sql`; `tests/blotter/invoices.test.mjs`; `tests/blotter/invoices-ui.mjs`; `tests/blotter/invoice-report-proof.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Delivery may be by email PDF to a billing contact without portal access; A restore brings rules back paused; without consent.

#### BILL-015 — Implemented for BILL-015

Core · target · **partial** · From BILL-002 · Cites BASE-AUDIT-001, BASE-DATA-001, BASE-MAIL-001, BASE-ROLE-001 · Rules D-1

**Requirement.** Provide implemented for BILL-015.

**Acceptance.**
1. The consent is one record on the rule: the rule revision the holder reviewed (any amendment, pause or reactivation is a new revision and ends it), the cap, one recipient contact and a reason; recording it is audited and needs step-up, and it never travels in an archive.
2. Each hourly run rechecks that the revision is unchanged, that the consenter is still the principal or a financial-authority holder holding the client, that the invoice recipient is the consented contact with a billing role and email consent (portal access is not needed), and that the invoice total is within the cap.
3. With no exception it issues the numbered PDF under the consenter's authority (the PDF reads 'This invoice was auto-issued under rule revision N') and sends it once; otherwise the invoice stays a draft carrying the named exception and nothing is sent, and a held send or exception is never retried by a later run.
4. A contact without portal access receives the PDF by email alone: no invoice link is mailed and the stored link is born revoked.
5. AUTOMATE-001 inherits automatic issue only through this consent.

**Evidence.** `src/blotter/invoices.ts`; `src/blotter/invoices-sources.ts`; `src/blotter/invoices-retainers.ts`; `src/blotter/invoices-delivery.ts`; `src/blotter/invoices-credits.ts`; `src/blotter/invoices-pdf.ts`; `src/blotter/invoice-routes.ts`; `src/blotter/report-invoices.ts`; `src/ui/invoices.tsx`; `migrations/core/0086_invoices.sql`; `migrations/core/0089_invoice_auto.sql`; `tests/blotter/invoices.test.mjs`; `tests/blotter/invoices-ui.mjs`; `tests/blotter/invoice-report-proof.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: The consent is one record on the rule: the rule revision the holder reviewed (any amendment; pause or reactivation is a new revision; ends it); the cap; one recipient contact; a reason; recording it is audited; needs step-up; and it never travels in an archive; Each hourly run rechecks that the revision is unchanged; that the consenter is still the principal or a financial-authority holder holding the client; that the invoice recipient is the consented contact with a billing role; email consent (portal access is not needed); and that the invoice total is within the cap; With no exception it issues the numbered PDF under the consenter's authority (the PDF reads 'This invoice was auto-issued under rule revision N'); sends it once; otherwise the invoice stays a draft carrying the named exception; nothing is sent; and a held send or exception is never retried by a later run; A contact without portal access receives the PDF by email alone: no invoice link is mailed; the stored link is born revoked; AUTOMATE-001 inherits automatic issue only through this consent.

#### PAY-001 — Card ACH and authorized collections

Core · target · **partial** · Cites BASE-ROLE-001 · Rules D-1 · Register R-10

**Requirement.** Collect invoices by card and US ACH through Stripe, with saved-method mandates and explicit authorization for recurring or due-date automatic collection. Show fees in USD, payment terms and ACH pending/settled/returned states; distinguish provider acceptance from settlement. Verify webhook signatures, deduplicate events, reconcile partial payments, refunds, disputes and returns, and own failed-payment follow-up. Provider onboarding, US bank access and saved-method/auto-pay migration from Karbon Payments, TaxDome Payments, Canopy Payments and Financial Cents (MIGRATE-007) are engineering obligations; a method or authorization that cannot move becomes a tracked client reauthorization, and no client is charged automatically without a valid mandate. Under RL-101, staff quick collect needs explicit current invoice-specific consent and its remaining cumulative cap, after current financial authority and billing-recipient revision checks. Revocation and restored authority prevent another charge; recurring and due-date mandates remain separate work.

**Acceptance.**
1. Pay a real authorized low-value invoice by card and ACH, authorize a recurring mandate and inspect provider receipts and ledger reconciliation.
2. At the provider test edge exercise duplicate/out-of-order events, ACH return, partial payment, refund and failed collection; revoke the mandate and verify no later debit.

**Evidence.** `tests/blotter/payments.test.mjs`; `tests/blotter/payment-ui.mjs`; `tests/blotter/payments-live.mjs`; `tests/blotter/payments-ach-live.mjs`
**Gap.** Card and bank Checkout, invoice-bounded saved-method consent, manual quick collect, signed current-state reconciliation, partial receipts, refunds, disputes, owned failures and inactive restore are implemented. Remaining: recurring and due-date collection mandates; incumbent method migration and tracked reauthorization; full provider-record erasure and expiry activation proof. Adopted conservative default pending ct: separate explicit invoice-link consent, cumulative invoice cap, current billing-contact revision, fresh-confirmed principal or financial-authority staff initiation, no scheduled debit, immediate revocation and restored authority held. The held US account accepted bank Checkout on 26 October 2026.

#### PAY-003 — Engagement history for PAY-003

Core · target · **partial** · From PAY-001 · Cites BASE-AUDIT-001 · Rules D-1 · Register R-10

**Requirement.** Provide engagement history for PAY-003.

**Acceptance.**
1. Payments, failures and refunds appear in the client's history with author, time and source link, visible only to those who may read the job, and any unresolved item they create (a failed payment) names an owner, next action and due condition.

**Evidence.** `tests/blotter/payments.test.mjs`; `tests/blotter/payment-ui.mjs`; `tests/blotter/payments-live.mjs`; `tests/blotter/payments-ach-live.mjs`
**Gap.** Card and bank Checkout, invoice-bounded saved-method consent, manual quick collect, signed current-state reconciliation, partial receipts, refunds, disputes, owned failures and inactive restore are implemented. Remaining: recurring and due-date collection mandates; incumbent method migration and tracked reauthorization; full provider-record erasure and expiry activation proof. Adopted conservative default pending ct: separate explicit invoice-link consent, cumulative invoice cap, current billing-contact revision, fresh-confirmed principal or financial-authority staff initiation, no scheduled debit, immediate revocation and restored authority held. The held US account accepted bank Checkout on 26 October 2026.

#### PAY-004 — Trace a request from email through upload and

Core · target · **partial** · From PAY-001 · Cites BASE-AUDIT-001, BASE-INPUT-003, BASE-MAIL-001 · Rules D-1 · Register R-10

**Requirement.** Provide trace a request from email through upload and.

**Acceptance.**
1. Trace a request from email through upload and review to its payment in the client history.

**Evidence.** `tests/blotter/payments.test.mjs`; `tests/blotter/payment-ui.mjs`; `tests/blotter/payments-live.mjs`; `tests/blotter/payments-ach-live.mjs`
**Gap.** Card and bank Checkout, invoice-bounded saved-method consent, manual quick collect, signed current-state reconciliation, partial receipts, refunds, disputes, owned failures and inactive restore are implemented. Remaining: recurring and due-date collection mandates; incumbent method migration and tracked reauthorization; full provider-record erasure and expiry activation proof. Adopted conservative default pending ct: separate explicit invoice-link consent, cumulative invoice cap, current billing-contact revision, fresh-confirmed principal or financial-authority staff initiation, no scheduled debit, immediate revocation and restored authority held. The held US account accepted bank Checkout on 26 October 2026.

#### PAY-005 — Erasure-002 for PAY-005

Core · target · **partial** · From PAY-001 · Cites BASE-DATA-001, BASE-DATA-006 · Rules D-1 · Register R-10

**Requirement.** Provide erasure-002 for PAY-005.

**Acceptance.**
1. , PAY-001 adds its records and provider copies to ERASURE-002's classes, clocks, holds, preview, erasure, receipt and restore fence.

**Evidence.** `tests/blotter/payments.test.mjs`; `tests/blotter/payment-ui.mjs`; `tests/blotter/payments-live.mjs`; `tests/blotter/payments-ach-live.mjs`
**Gap.** Card and bank Checkout, invoice-bounded saved-method consent, manual quick collect, signed current-state reconciliation, partial receipts, refunds, disputes, owned failures and inactive restore are implemented. Remaining: recurring and due-date collection mandates; incumbent method migration and tracked reauthorization; full provider-record erasure and expiry activation proof. Adopted conservative default pending ct: separate explicit invoice-link consent, cumulative invoice cap, current billing-contact revision, fresh-confirmed principal or financial-authority staff initiation, no scheduled debit, immediate revocation and restored authority held. The held US account accepted bank Checkout on 26 October 2026.

#### PAY-006 — Pay-001 subset

Core · target · **partial** · From PAY-001 · Cites BASE-DATA-001, BASE-DATA-006, BASE-ROLE-001 · Rules D-1 · Register R-10

**Requirement.** Provide pay-001 subset.

**Acceptance.**
1. See `STRIPE.md` for the exact adopted invoice-bounded consent, provider reconciliation, retained records and inactive restore semantics.
2. Recurring and due-date collection mandates remain separate from invoice-specific consent; invoice-specific consent authorizes no scheduled debit or automatic retry.
3. PAY-002, BILL-005, MIGRATE-007, NOTIFY-001 and ERASURE-002 retain their named obligations.

**Evidence.** `tests/blotter/payments.test.mjs`; `tests/blotter/payment-ui.mjs`; `tests/blotter/payments-live.mjs`; `tests/blotter/payments-ach-live.mjs`
**Gap.** Card and bank Checkout, invoice-bounded saved-method consent, manual quick collect, signed current-state reconciliation, partial receipts, refunds, disputes, owned failures and inactive restore are implemented. Remaining: recurring and due-date collection mandates; incumbent method migration and tracked reauthorization; full provider-record erasure and expiry activation proof. Adopted conservative default pending ct: separate explicit invoice-link consent, cumulative invoice cap, current billing-contact revision, fresh-confirmed principal or financial-authority staff initiation, no scheduled debit, immediate revocation and restored authority held. The held US account accepted bank Checkout on 26 October 2026.

#### PAY-002 — Payment plans and client payment self service

Core · target · **missing** · Cites BASE-AUDIT-001, BASE-ROLE-001 · Rules D-1

**Requirement.** In the portal, clients see open invoices, statements and payment history. They can pay several invoices in one payment, save or remove payment methods, set up auto-pay, and accept a firm-offered installment plan with an amount, a schedule and a mandate. Scheduled charges run only under explicit authorization, with a reminder before each debit. A missed or returned installment creates owned follow-up instead of an unauthorized retry.

**Acceptance.**
1. A client pays two invoices in one card payment, and the payment is allocated correctly.
2. The client accepts a three-installment ACH plan; the second installment is returned, which creates owned follow-up with no retry outside the authorized policy.
3. After the client removes a saved card, a later auto-pay is refused.

**Evidence.** None.
**Gap.** No client payment portal, multi-invoice payment, installment plan or auto-pay exists.

#### PAY-007 — Erasure-002 for PAY-007

Core · target · **missing** · From PAY-002 · Cites BASE-DATA-001, BASE-DATA-006 · Rules D-1

**Requirement.** Provide erasure-002 for PAY-007.

**Acceptance.**
1. , PAY-002 adds its records and provider copies to ERASURE-002's classes, clocks, holds, preview, erasure, receipt and restore fence.

**Evidence.** None.
**Gap.** No client payment portal, multi-invoice payment, installment plan or auto-pay exists.

#### BILL-003 — WIP receivables realization and profitability

Core · target · **partial** · Cites BASE-AUDIT-001, BASE-DATA-001 · Rules D-1

**Requirement.** Report unbilled WIP, earned/deferred retainers, aged receivables, collection follow-up (reminders and statements under BILL-004), credits, write-ups/downs, billed-versus-recorded realization, utilization and client/job/service profitability using approved time, cost and invoice/payment sources. Drill into calculation inputs, exclude duplicate exports and keep uncollected, settled and written-off amounts distinct. Partners approve credits, write-offs and collection messages.

**Acceptance.**
1. Run WIP, aging and profitability for a client with hourly work, fixed fees, a retainer, partial payment and credit.
2. Reconcile totals to approved sources and provider state, approve a write-off and inspect the changed period report without rewriting historical invoices.

**Evidence.** `src/blotter/billing.ts`; `src/blotter/reports.ts`; `src/blotter/report-financials.ts`; `src/blotter/report-invoices.ts`; `src/blotter/report-receivables.ts`; `src/blotter/invoice-aging.ts`; `src/blotter/invoices-writeoffs.ts`; `src/blotter/staff-costs.ts`; `src/blotter/invoices-collections.ts`; `src/blotter/invoices-erasure.ts`; `src/ui/report-financials.tsx`; `src/ui/report-receivables.tsx`; `src/ui/invoices.tsx`; `migrations/core/0093_invoice_writeoffs.sql`; `migrations/core/0094_staff_costs.sql`; `tests/blotter/invoices.test.mjs`; `tests/blotter/billing-analysis.test.mjs`; `tests/blotter/reports.test.mjs`; `tests/blotter/invoices-ui.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Run WIP; aging; profitability for a client with hourly work; fixed fees; a retainer; partial payment; credit; Reconcile totals to approved sources; provider state; approve a write-off; inspect the changed period report without rewriting historical invoices.

#### BILL-016 — The performance report groups its selected jobs by

Core · target · **partial** · From BILL-003 · Cites BASE-DATA-001 · Rules D-1

**Requirement.** Provide the performance report groups its selected jobs by.

**Acceptance.**
1. The performance report groups its selected jobs by client and service/work type, separately for each stored currency.
2. The inclusive period-start cohort and existing client/service/assignee filters apply before grouping.
3. Totals sum approved billable time and adjustments, earned fixed fees, approved expense charges and costs, margin before staff cost, unreserved ready-to-bill WIP and approved export snapshots.
4. Draft reservations remove WIP but never count as approved exports; voiding restores that WIP.
5. Each group links to its source jobs and their calculation inputs.

**Evidence.** `src/blotter/billing.ts`; `src/blotter/reports.ts`; `src/blotter/report-financials.ts`; `src/blotter/report-invoices.ts`; `src/blotter/report-receivables.ts`; `src/blotter/invoice-aging.ts`; `src/blotter/invoices-writeoffs.ts`; `src/blotter/staff-costs.ts`; `src/blotter/invoices-collections.ts`; `src/blotter/invoices-erasure.ts`; `src/ui/report-financials.tsx`; `src/ui/report-receivables.tsx`; `src/ui/invoices.tsx`; `migrations/core/0093_invoice_writeoffs.sql`; `migrations/core/0094_staff_costs.sql`; `tests/blotter/invoices.test.mjs`; `tests/blotter/billing-analysis.test.mjs`; `tests/blotter/reports.test.mjs`; `tests/blotter/invoices-ui.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: The performance report groups its selected jobs by client; service/work type; separately for each stored currency; The inclusive period-start cohort; existing client/service/assignee filters apply before grouping; Totals sum approved billable time; adjustments; earned fixed fees; approved expense charges; costs; margin before staff cost; unreserved ready-to-bill WIP; approved export snapshots; Draft reservations remove WIP but never count as approved exports; voiding restores that WIP; Each group links to its source jobs; their calculation inputs.

#### BILL-017 — Ready-to-bill wip excludes every source a billing export

Core · target · **partial** · From BILL-003 · Cites BASE-DATA-001, BASE-DATA-006 · Rules D-1

**Requirement.** Provide ready-to-bill wip excludes every source a billing export.

**Acceptance.**
1. Ready-to-bill WIP excludes every source a billing export or an invoice (draft or issued) has reserved; voiding a draft restores it.
2. An issued non-void invoice's open balance is its gross less applied credits and approved write-offs; reminders, statements, the portal and erasure blockers read that one balance.
3. The report adds, for the same period-start cohort and filters, receivables aged by whole days past the due date at the report's firm-local date (current, 1-30, 31-60, 61-90, over 90); retainer invoices earned (billing month already begun) or deferred (billed for a later month); and per client, service and job: recorded value (approved time, fee and expense lines on issued invoices), write-ups and write-downs (the adjustment lines), billed, billed-against-recorded realization, collected (recorded deposits applied), credits applied, written off, uncollected, invoiced expense cost, staff cost and profit, with each client's unbilled WIP beside them; collected, credited, written-off and uncollected are never merged.

**Evidence.** `src/blotter/billing.ts`; `src/blotter/reports.ts`; `src/blotter/report-financials.ts`; `src/blotter/report-invoices.ts`; `src/blotter/report-receivables.ts`; `src/blotter/invoice-aging.ts`; `src/blotter/invoices-writeoffs.ts`; `src/blotter/staff-costs.ts`; `src/blotter/invoices-collections.ts`; `src/blotter/invoices-erasure.ts`; `src/ui/report-financials.tsx`; `src/ui/report-receivables.tsx`; `src/ui/invoices.tsx`; `migrations/core/0093_invoice_writeoffs.sql`; `migrations/core/0094_staff_costs.sql`; `tests/blotter/invoices.test.mjs`; `tests/blotter/billing-analysis.test.mjs`; `tests/blotter/reports.test.mjs`; `tests/blotter/invoices-ui.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Ready-to-bill WIP excludes every source a billing export or an invoice (draft or issued) has reserved; voiding a draft restores it; An issued non-void invoice's open balance is its gross less applied credits; approved write-offs; reminders; statements; the portal; erasure blockers read that one balance; The report adds; for the same period-start cohort; filters; receivables aged by whole days past the due date at the report's firm-local date (current; 1-30; 31-60; 61-90; over 90); retainer invoices earned (billing month already begun) or deferred (billed for a later month); and per client; service; job: recorded value (approved time; fee; expense lines on issued invoices); write-ups; write-downs (the adjustment lines); billed; billed-against-recorded realization; collected (recorded deposits applied); credits applied; written off; uncollected; invoiced expense cost; staff cost; profit; with each client's unbilled WIP beside them; collected; credited; written-off; uncollected are never merged.

#### BILL-018 — Under blotter as the invoice authority the provider

Core · target · **partial** · From BILL-003 · Cites BASE-AUDIT-001, BASE-ROLE-001 · Rules D-1

**Requirement.** Provide under blotter as the invoice authority the provider.

**Acceptance.**
1. Under Blotter as the invoice authority the provider state of money is the practitioner-recorded deposit receipt references and credits; PAY-001 and any QuickBooks or Xero authority inherit the obligation to add their provider payment, refund, return and dispute states to the same figures when they ship.
2. A write-off is approved by the principal or a financial-authority holder in a native person session (as for credits), for a stated USD amount of an issued invoice's open balance with a reason; it is audited, immutable, refused above the balance, and never rewrites the issued invoice, its PDF or its totals: only the balance, the reports and statements dated after it change.
3. Staff cost is the principal-recorded hourly cost rate in force on the entry date times the minutes of invoiced time and adjustments (minutes with no rate are counted, never guessed) and is shown only to the principal and financial-authority holders; profit is billed less write-offs, invoiced expense cost and staff cost.
4. Utilization stays on the report's capacity lines.

**Evidence.** `src/blotter/billing.ts`; `src/blotter/reports.ts`; `src/blotter/report-financials.ts`; `src/blotter/report-invoices.ts`; `src/blotter/report-receivables.ts`; `src/blotter/invoice-aging.ts`; `src/blotter/invoices-writeoffs.ts`; `src/blotter/staff-costs.ts`; `src/blotter/invoices-collections.ts`; `src/blotter/invoices-erasure.ts`; `src/ui/report-financials.tsx`; `src/ui/report-receivables.tsx`; `src/ui/invoices.tsx`; `migrations/core/0093_invoice_writeoffs.sql`; `migrations/core/0094_staff_costs.sql`; `tests/blotter/invoices.test.mjs`; `tests/blotter/billing-analysis.test.mjs`; `tests/blotter/reports.test.mjs`; `tests/blotter/invoices-ui.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Under Blotter as the invoice authority the provider state of money is the practitioner-recorded deposit receipt references; credits; PAY-001; any QuickBooks or Xero authority inherit the obligation to add their provider payment; refund; return; dispute states to the same figures when they ship; A write-off is approved by the principal or a financial-authority holder in a native person session (as for credits); for a stated USD amount of an issued invoice's open balance with a reason; it is audited; immutable; refused above the balance; and never rewrites the issued invoice; its PDF or its totals: only the balance; the reports; statements dated after it change; Staff cost is the principal-recorded hourly cost rate in force on the entry date times the minutes of invoiced time; adjustments (minutes with no rate are counted; never guessed); is shown only to the principal; financial-authority holders; profit is billed less write-offs; invoiced expense cost; staff cost; Utilization stays on the report's capacity lines.

#### BILL-019 — Write-off and staff-cost records join erasure-002's billing and

Core · target · **partial** · From BILL-003 · Cites BASE-DATA-001, BASE-DATA-006 · Rules D-1

**Requirement.** Provide write-off and staff-cost records join erasure-002's billing and.

**Acceptance.**
1. Write-off and staff-cost records join ERASURE-002's billing and staff classes, retained rows, expiry redaction of reasons, invoice clocks and restore fence.

**Evidence.** `src/blotter/billing.ts`; `src/blotter/reports.ts`; `src/blotter/report-financials.ts`; `src/blotter/report-invoices.ts`; `src/blotter/report-receivables.ts`; `src/blotter/invoice-aging.ts`; `src/blotter/invoices-writeoffs.ts`; `src/blotter/staff-costs.ts`; `src/blotter/invoices-collections.ts`; `src/blotter/invoices-erasure.ts`; `src/ui/report-financials.tsx`; `src/ui/report-receivables.tsx`; `src/ui/invoices.tsx`; `migrations/core/0093_invoice_writeoffs.sql`; `migrations/core/0094_staff_costs.sql`; `tests/blotter/invoices.test.mjs`; `tests/blotter/billing-analysis.test.mjs`; `tests/blotter/reports.test.mjs`; `tests/blotter/invoices-ui.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Write-off; staff-cost records join ERASURE-002's billing; staff classes; retained rows; expiry redaction of reasons; invoice clocks; restore fence.

#### BILL-020 — Erasure-002 for BILL-020

Core · target · **partial** · From BILL-003 · Cites BASE-DATA-001, BASE-DATA-006 · Rules D-1

**Requirement.** Provide erasure-002 for BILL-020.

**Acceptance.**
1. , BILL-003 adds its records and provider copies to ERASURE-002's classes, clocks, holds, preview, erasure, receipt and restore fence.

**Evidence.** `src/blotter/billing.ts`; `src/blotter/reports.ts`; `src/blotter/report-financials.ts`; `src/blotter/report-invoices.ts`; `src/blotter/report-receivables.ts`; `src/blotter/invoice-aging.ts`; `src/blotter/invoices-writeoffs.ts`; `src/blotter/staff-costs.ts`; `src/blotter/invoices-collections.ts`; `src/blotter/invoices-erasure.ts`; `src/ui/report-financials.tsx`; `src/ui/report-receivables.tsx`; `src/ui/invoices.tsx`; `migrations/core/0093_invoice_writeoffs.sql`; `migrations/core/0094_staff_costs.sql`; `tests/blotter/invoices.test.mjs`; `tests/blotter/billing-analysis.test.mjs`; `tests/blotter/reports.test.mjs`; `tests/blotter/invoices-ui.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: BILL-003 adds its records; provider copies to ERASURE-002's classes; clocks; holds; preview; erasure; receipt; restore fence.

#### BILL-004 — Invoice reminders statements and bulk resend

Core · target · **partial** · Cites BASE-AUDIT-001, BASE-ROLE-001 · Rules D-1

**Requirement.** Overdue-invoice reminders run on a firm schedule (for example 3 days before the due date, on it, and 7, 14 and 30 days after) using MSG-001 templates. They stop when an invoice is paid, disputed or on a payment plan, and can be overridden per client. Staff can bulk resend selected invoices and generate monthly client statements of open invoices, credits and payments. Quick collect charges a saved method only within its PAY-001 authorization. Every reminder is recorded in the client's history. Quick collect follows PAY-001 (RL-101); the existing reminder consent and edit-to-pause rider remains in force.

**Acceptance.**
1. Issue three invoices with different due dates, let the reminders run and pay one between steps; only the unpaid invoices are reminded, on schedule.
2. Bulk resend two invoices.
3. Generate a statement and reconcile it to open balances.
4. Quick collect one invoice with an authorized saved card; a quick collect without authorization is refused.

**Evidence.** `src/blotter/invoices-collections.ts`; `src/ui/invoice-collections.tsx`; `migrations/core/0091_invoice_collections.sql`; `tests/blotter/invoices.test.mjs`; `tests/blotter/invoices-ui.mjs`; `tests/blotter/payments.test.mjs`; `tests/blotter/payment-ui.mjs`; `tests/blotter/payments-live.mjs`
**Gap.** Quick collect now records provider payments and a provider-confirmed payment between reminder steps stops reminders. Remaining: ct approval of PAY-001’s adopted invoice-link consent boundary. The reminder-consent default was approved by ct on 22 October 2026 with edit-to-pause riders, now asserted.

#### BILL-021 — Msg-002 marketing consent for BILL-021

Core · target · **partial** · From BILL-004 · Rules D-1

**Requirement.** Provide msg-002 marketing consent for BILL-021.

**Acceptance.**
1. Invoice reminders send engagement class only, with MSG-002's send-time recheck.

**Evidence.** `src/blotter/invoices-collections.ts`; `src/ui/invoice-collections.tsx`; `migrations/core/0091_invoice_collections.sql`; `tests/blotter/invoices.test.mjs`; `tests/blotter/invoices-ui.mjs`; `tests/blotter/payments.test.mjs`; `tests/blotter/payment-ui.mjs`; `tests/blotter/payments-live.mjs`
**Gap.** Quick collect now records provider payments and a provider-confirmed payment between reminder steps stops reminders. Remaining: ct approval of PAY-001’s adopted invoice-link consent boundary. The reminder-consent default was approved by ct on 22 October 2026 with edit-to-pause riders, now asserted.

#### BILL-022 — Erasure-002 for BILL-022

Core · target · **partial** · From BILL-004 · Cites BASE-DATA-001, BASE-DATA-006 · Rules D-1

**Requirement.** Provide erasure-002 for BILL-022.

**Acceptance.**
1. , BILL-004 adds its records and provider copies to ERASURE-002's classes, clocks, holds, preview, erasure, receipt and restore fence.

**Evidence.** `src/blotter/invoices-collections.ts`; `src/ui/invoice-collections.tsx`; `migrations/core/0091_invoice_collections.sql`; `tests/blotter/invoices.test.mjs`; `tests/blotter/invoices-ui.mjs`; `tests/blotter/payments.test.mjs`; `tests/blotter/payment-ui.mjs`; `tests/blotter/payments-live.mjs`
**Gap.** Quick collect now records provider payments and a provider-confirmed payment between reminder steps stops reminders. Remaining: ct approval of PAY-001’s adopted invoice-link consent boundary. The reminder-consent default was approved by ct on 22 October 2026 with edit-to-pause riders, now asserted.

#### BILL-023 — Reminders are automatic outbound mail, so the firm

Core · target · **partial** · From BILL-004 · Cites BASE-AUDIT-001, BASE-MAIL-001, BASE-ROLE-001 · Rules D-1

**Requirement.** Provide reminders are automatic outbound mail, so the firm.

**Acceptance.**
1. Reminders are automatic outbound mail, so the firm schedule runs only under a recorded consent of the principal or a financial-authority holder without client scopes: the steps in days from the due date (negative before it), one firm engagement-class MSG-001 template version and a reason, audited and step-up confirmed; pausing ends it.
2. Each hourly run rechecks the consenter's live authority and the template version (otherwise the schedule pauses with a named reason), and for each issued invoice with an open balance, no dispute or payment-plan hold and a client not opted out, sends the latest passed step once (earlier passed steps are recorded as skipped, never sent late) to the invoice's billing contact with the numbered PDF, after MSG-002's engagement send-time recheck (active, authorized billing contact with email consent and no hard bounce); a refused recheck or placeholder holds that step, named, and is never replayed.
3. A client follows the firm schedule, opts out or has its own steps; every reminder, hold and override is in the client's history.

**Evidence.** `src/blotter/invoices-collections.ts`; `src/ui/invoice-collections.tsx`; `migrations/core/0091_invoice_collections.sql`; `tests/blotter/invoices.test.mjs`; `tests/blotter/invoices-ui.mjs`; `tests/blotter/payments.test.mjs`; `tests/blotter/payment-ui.mjs`; `tests/blotter/payments-live.mjs`
**Gap.** Quick collect now records provider payments and a provider-confirmed payment between reminder steps stops reminders. Remaining: ct approval of PAY-001’s adopted invoice-link consent boundary. The reminder-consent default was approved by ct on 22 October 2026 with edit-to-pause riders, now asserted.

#### BILL-024 — Paid means the invoice balance is zero after

Core · target · **partial** · From BILL-004 · Cites BASE-DATA-001, BASE-DATA-006, BASE-ROLE-001 · Rules D-1

**Requirement.** Provide paid means the invoice balance is zero after.

**Acceptance.**
1. Paid means the invoice balance is zero after recorded receipts, deposits, credits or approved write-offs (BILL-003) and observed net settled provider payments.
2. Bulk resend sends one reviewed preview of up to 50 issued invoices (their billing recipients, documents and one reason) through BILL-002's delivery.
3. A client statement as of a date lists open issued invoices with aging, recorded credits and their applications, observed provider payment states and net amounts, and totals equal to the open balances; its CSV is an export.
4. Quick collect requires PAY-001’s current invoice-bounded saved-method authorization and fresh-confirmed financial authority; its provider receipts update the same open balance.
5. Any edit to reminder steps or the consented template version pauses the schedule and ends its consent.
6. Reminder tables join the link and firm classes, erasure steps, expiry effects and observed provider/recipient copies; a restore returns the schedule paused and without consent, and claimed reminders held.

**Evidence.** `src/blotter/invoices-collections.ts`; `src/ui/invoice-collections.tsx`; `migrations/core/0091_invoice_collections.sql`; `tests/blotter/invoices.test.mjs`; `tests/blotter/invoices-ui.mjs`; `tests/blotter/payments.test.mjs`; `tests/blotter/payment-ui.mjs`; `tests/blotter/payments-live.mjs`
**Gap.** Quick collect now records provider payments and a provider-confirmed payment between reminder steps stops reminders. Remaining: ct approval of PAY-001’s adopted invoice-link consent boundary. The reminder-consent default was approved by ct on 22 October 2026 with edit-to-pause riders, now asserted.

#### BILL-005 — Payment gated delivery and credit hold

Core · target · **partial** · Cites BASE-INPUT-003 · Rules D-1

**Requirement.** A firm can require payment before releasing selected work product in the portal, such as a final return copy. The client sees the file as locked until paid. A card payment unlocks it on provider confirmation. For ACH the firm chooses whether a pending payment unlocks it or settlement is required. Records the client supplied are never withheld, consistent with Circular 230 §10.28; only the firm's own work product can be gated. Clients past a firm balance threshold go on credit hold: staff see the hold, and creating new work warns. A partner can override a gate or hold, with a recorded reason.

**Acceptance.**
1. Gate a final return copy on an invoice.
2. The client sees it locked, pays by card, and the file unlocks.
3. With a wait-for-settlement ACH policy, the file stays locked until settlement.
4. The client's own uploaded documents stay downloadable throughout.
5. A partner override is recorded with its reason, and new work for an overdue client shows the credit hold.

**Evidence.** `src/blotter/payment-gates.ts`; `src/blotter/payment-policy.ts`; `src/blotter/document-downloads.ts`; `src/blotter/deliverables.ts`; `src/blotter/invoices-credits.ts`; `src/blotter/invoices-erasure.ts`; `src/blotter/jobs.ts`; `src/blotter/bulk.ts`; `src/blotter/client-lifecycle.ts`; `src/blotter/history.ts`; `src/ui/deliverables.tsx`; `src/ui/client-details.tsx`; `src/ui/invoices.tsx`; `migrations/core/0095_payment_gates.sql`; `tests/blotter/invoices.test.mjs`; `tests/blotter/portal-accounts.test.mjs`; `tests/blotter/portal-accounts-ui.mjs`; `tests/blotter/invoices-ui.mjs`; `tests/blotter/payments-live.mjs`; `tests/blotter/payments-ach-live.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Gate a final return copy on an invoice; The client sees it locked; pays by card; and the file unlocks; With a wait-for-settlement ACH policy; the file stays locked until settlement; The client's own uploaded documents stay downloadable throughout; A partner override is recorded with its reason; and new work for an overdue client shows the credit hold.

#### BILL-025 — Only a deliverable can be gated, never a

Core · target · **partial** · From BILL-005 · Cites BASE-ROLE-001 · Rules D-1

**Requirement.** Provide only a deliverable can be gated, never a.

**Acceptance.**
1. Only a deliverable (the firm's own work product) can be gated, never a record the client supplied or any other file; the principal or a financial-authority holder gates a deliverable on one issued invoice of the same client, with a reason.
2. Every version of a gated deliverable is withheld from the client portal, the portal file door and any bearer share link (HTTP 402 naming the invoice) until the invoice's gross is covered by applied credits, recorded deposits and observed net provider payments under the ACH policy; staff downloads are never gated.
3. A write-off never releases a gate; only a partner (principal or financial-authority holder) override with a reason does, and it can be taken back.
4. A receipt records how it was paid (card, ACH or other): a card or other receipt counts when recorded, an ACH deposit may be recorded pending until the bank settles it, and the firm policy (principal only, default: settlement required) chooses whether a pending ACH deposit releases a gated file.

**Evidence.** `src/blotter/payment-gates.ts`; `src/blotter/payment-policy.ts`; `src/blotter/document-downloads.ts`; `src/blotter/deliverables.ts`; `src/blotter/invoices-credits.ts`; `src/blotter/invoices-erasure.ts`; `src/blotter/jobs.ts`; `src/blotter/bulk.ts`; `src/blotter/client-lifecycle.ts`; `src/blotter/history.ts`; `src/ui/deliverables.tsx`; `src/ui/client-details.tsx`; `src/ui/invoices.tsx`; `migrations/core/0095_payment_gates.sql`; `tests/blotter/invoices.test.mjs`; `tests/blotter/portal-accounts.test.mjs`; `tests/blotter/portal-accounts-ui.mjs`; `tests/blotter/invoices-ui.mjs`; `tests/blotter/payments-live.mjs`; `tests/blotter/payments-ach-live.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Only a deliverable (the firm's own work product) can be gated; never a record the client supplied or any other file; the principal or a financial-authority holder gates a deliverable on one issued invoice of the same client; with a reason; Every version of a gated deliverable is withheld from the client portal; the portal file door; any bearer share link (HTTP 402 naming the invoice) until the invoice's gross is covered by applied credits; recorded deposits; observed net provider payments under the ACH policy; staff downloads are never gated; A write-off never releases a gate; only a partner (principal or financial-authority holder) override with a reason does; and it can be taken back; A receipt records how it was paid (card; ACH or other): a card or other receipt counts when recorded; an ACH deposit may be recorded pending until the bank settles it; and the firm policy (principal only; default: settlement required) chooses whether a pending ACH deposit releases a gated file.

#### BILL-026 — The same principal-only policy sets the credit-hold threshold

Core · target · **partial** · From BILL-005 · Cites BASE-AUDIT-001, BASE-DATA-001, BASE-DATA-006 · Rules D-1

**Requirement.** Provide the same principal-only policy sets the credit-hold threshold.

**Acceptance.**
1. The same principal-only policy sets the credit-hold threshold (default: off) and grace days (default: 0): a client is on credit hold when the open balance of its issued invoices past due, after the grace days, is at least the threshold.
2. Staff with client access see the hold on the client (amounts only if they may read billing); the job start, roll-forward and bulk schedule doors warn without blocking; a partner overrides or restores the hold with a reason, and any payment or write-off lowering the balance below the threshold ends the hold.
3. Gates, overrides and the policy are audited, appear in the client's billing history, are carried by archives and join ERASURE-002's link and firm classes (reasons redacted on client erasure).
4. PAY-001 supplies the client's own card payment in the portal, provider confirmation and ACH states; its payment, refund and return events inherit this gate and hold, and a returned ACH payment relocks the file; Every staff job screen rechecks and shows the live hold, including recurrence-generated and intake-onboarding work; no billing amounts are shown to staff without billing access.

**Evidence.** `src/blotter/payment-gates.ts`; `src/blotter/payment-policy.ts`; `src/blotter/document-downloads.ts`; `src/blotter/deliverables.ts`; `src/blotter/invoices-credits.ts`; `src/blotter/invoices-erasure.ts`; `src/blotter/jobs.ts`; `src/blotter/bulk.ts`; `src/blotter/client-lifecycle.ts`; `src/blotter/history.ts`; `src/ui/deliverables.tsx`; `src/ui/client-details.tsx`; `src/ui/invoices.tsx`; `migrations/core/0095_payment_gates.sql`; `tests/blotter/invoices.test.mjs`; `tests/blotter/portal-accounts.test.mjs`; `tests/blotter/portal-accounts-ui.mjs`; `tests/blotter/invoices-ui.mjs`; `tests/blotter/payments-live.mjs`; `tests/blotter/payments-ach-live.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: The same principal-only policy sets the credit-hold threshold (default: off); grace days (default: 0): a client is on credit hold when the open balance of its issued invoices past due; after the grace days; is at least the threshold; Staff with client access see the hold on the client (amounts only if they may read billing); the job start; roll-forward; bulk schedule doors warn without blocking; a partner overrides or restores the hold with a reason; and any payment or write-off lowering the balance below the threshold ends the hold; Gates; overrides; the policy are audited; appear in the client's billing history; are carried by archives; join ERASURE-002's link; firm classes (reasons redacted on client erasure); PAY-001 supplies the client's own card payment in the portal; provider confirmation; ACH states; its payment; refund; return events inherit this gate; hold; and a returned ACH payment relocks the file; Every staff job screen rechecks; shows the live hold; including recurrence-generated; intake-onboarding work; no billing amounts are shown to staff without billing access.

#### BILL-027 — new intake conversion creates a new client

Core · target · **partial** · From BILL-005 · Rules D-1

**Requirement.** Provide a new intake conversion creates a new client.

**Acceptance.**
1. A new intake conversion creates a new client without an inherited balance.

**Evidence.** `src/blotter/payment-gates.ts`; `src/blotter/payment-policy.ts`; `src/blotter/document-downloads.ts`; `src/blotter/deliverables.ts`; `src/blotter/invoices-credits.ts`; `src/blotter/invoices-erasure.ts`; `src/blotter/jobs.ts`; `src/blotter/bulk.ts`; `src/blotter/client-lifecycle.ts`; `src/blotter/history.ts`; `src/ui/deliverables.tsx`; `src/ui/client-details.tsx`; `src/ui/invoices.tsx`; `migrations/core/0095_payment_gates.sql`; `tests/blotter/invoices.test.mjs`; `tests/blotter/portal-accounts.test.mjs`; `tests/blotter/portal-accounts-ui.mjs`; `tests/blotter/invoices-ui.mjs`; `tests/blotter/payments-live.mjs`; `tests/blotter/payments-ach-live.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: A new intake conversion creates a new client without an inherited balance.

#### BILL-028 — Erasure-002 for BILL-028

Core · target · **partial** · From BILL-005 · Cites BASE-DATA-001, BASE-DATA-006 · Rules D-1

**Requirement.** Provide erasure-002 for BILL-028.

**Acceptance.**
1. , BILL-005 adds its records and provider copies to ERASURE-002's classes, clocks, holds, preview, erasure, receipt and restore fence.

**Evidence.** `src/blotter/payment-gates.ts`; `src/blotter/payment-policy.ts`; `src/blotter/document-downloads.ts`; `src/blotter/deliverables.ts`; `src/blotter/invoices-credits.ts`; `src/blotter/invoices-erasure.ts`; `src/blotter/jobs.ts`; `src/blotter/bulk.ts`; `src/blotter/client-lifecycle.ts`; `src/blotter/history.ts`; `src/ui/deliverables.tsx`; `src/ui/client-details.tsx`; `src/ui/invoices.tsx`; `migrations/core/0095_payment_gates.sql`; `tests/blotter/invoices.test.mjs`; `tests/blotter/portal-accounts.test.mjs`; `tests/blotter/portal-accounts-ui.mjs`; `tests/blotter/invoices-ui.mjs`; `tests/blotter/payments-live.mjs`; `tests/blotter/payments-ach-live.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: BILL-005 adds its records; provider copies to ERASURE-002's classes; clocks; holds; preview; erasure; receipt; restore fence.

#### REPORT-001 — Firm performance and client reporting

Core · target · **partial** · Cites BASE-DATA-001, BASE-ROLE-001 · Rules D-1

**Requirement.** Principals report work status, overdue/blocked jobs, turnaround, client response delay, review rework, deadlines, staff utilization, capacity and profitability by client/service/team/period. Saved views, scheduled internal reports and permission-checked CSV/PDF exports link to source records and state data freshness. Client-facing reports contain only approved client-visible data.

**Acceptance.**
1. Complete and delay several engagements, filter a period/team and drill from turnaround and overdue totals to source jobs.
2. Schedule a partner report, export it and compare totals; a preparer/client cannot obtain the firm's private financial report.

**Evidence.** `src/blotter/reports.ts`; `src/blotter/report-schedules.ts`; `src/blotter/report-exports.ts`; `src/ui/reports.tsx`; `tests/blotter/reports.test.mjs`; `tests/blotter/reports-ui.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Complete; delay several engagements; filter a period/team; drill from turnaround; overdue totals to source jobs; Schedule a partner report; export it; compare totals; a preparer/client cannot obtain the firm's private financial report.

#### REPORT-002 — Status reports

Core · target · **partial** · From REPORT-001 · Cites BASE-AUDIT-001 · Rules D-1

**Requirement.** Provide status reports.

**Acceptance.**
1. Counts and time in each stage and sub-status come from WORK-007's status history, by work type.

**Evidence.** `src/blotter/reports.ts`; `src/blotter/report-schedules.ts`; `src/blotter/report-exports.ts`; `src/ui/reports.tsx`; `tests/blotter/reports.test.mjs`; `tests/blotter/reports-ui.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Counts; time in each stage; sub-status come from WORK-007's status history; by work type.

#### REPORT-003 — Read counts and time in each status for

Core · target · **partial** · From REPORT-001 · Rules D-1

**Requirement.** Provide read counts and time in each status for.

**Acceptance.**
1. Read counts and time in each status for the 1040 work type.

**Evidence.** `src/blotter/reports.ts`; `src/blotter/report-schedules.ts`; `src/blotter/report-exports.ts`; `src/ui/reports.tsx`; `tests/blotter/reports.test.mjs`; `tests/blotter/reports-ui.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Read counts; time in each status for the 1040 work type.

#### REPORT-004 — Reports cover every shipped native source

Core · target · **partial** · From REPORT-001 · Cites BASE-AUDIT-001, BASE-INPUT-003 · Rules D-1

**Requirement.** Provide reports cover every shipped native source.

**Acceptance.**
1. Reports cover every shipped native source.
2. Period filters select jobs whose period start is within the inclusive date range; client, service/work type and assigned team member further restrict the cohort.
3. A team member matches preparer, reviewer, manager or partner.
4. Turnaround is created-to-sign-off elapsed UTC minutes, floored; review rework counts recorded returns.
5. Client response delay is accepted-provider reminder to first retained portal upload of that requested document, or elapsed waiting time if unanswered; unsent reminders are not a response clock.
6. Overdue means unfinished and due before today in the firm zone.
7. Stage/sub-status visits, current counts and elapsed minutes come from WORK-007 history for that cohort.
8. Capacity is CAPACITY-001 whole Monday–Sunday weeks overlapping the chosen range; billable approved time in the range divided by available minutes is utilization, rounded to two percentage decimals (zero availability is undefined).

**Evidence.** `src/blotter/reports.ts`; `src/blotter/report-schedules.ts`; `src/blotter/report-exports.ts`; `src/ui/reports.tsx`; `tests/blotter/reports.test.mjs`; `tests/blotter/reports-ui.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Reports cover every shipped native source; Period filters select jobs whose period start is within the inclusive date range; client; service/work type; assigned team member further restrict the cohort; A team member matches preparer; reviewer; manager or partner; Turnaround is created-to-sign-off elapsed UTC minutes; floored; review rework counts recorded returns; Client response delay is accepted-provider reminder to first retained portal upload of that requested document; or elapsed waiting time if unanswered; unsent reminders are not a response clock; Overdue means unfinished; due before today in the firm zone; Stage/sub-status visits; current counts; elapsed minutes come from WORK-007 history for that cohort; Capacity is CAPACITY-001 whole Monday–Sunday weeks overlapping the chosen range; billable approved time in the range divided by available minutes is utilization; rounded to two percentage decimals (zero availability is undefined).

#### REPORT-005 — Money is grouped by stored currency: approved billable

Core · target · **partial** · From REPORT-001 · Cites BASE-AGENT-007, BASE-AUDIT-001, BASE-DATA-001, BASE-DATA-006, BASE-MAIL-001, BASE-ROLE-001 · Rules D-1

**Requirement.** Provide money is grouped by stored currency: approved billable.

**Acceptance.**
1. Money is grouped by stored currency: approved billable time and adjustments, signed-off fixed fees, approved expense charges/costs, unbilled sources and immutable approved export lines, counted once.
2. Margin is before staff cost; exports never claim invoicing, collection or settlement.
3. Reports expose calculation inputs and job/export links with generation time; they recompute from retained sources after erasure.
4. Internal report and export reads require BILL-001 financial authority; an agent reads with its sponsor's financial role and the company's policy for sensitive.
5. Saved views store filters.
6. The principal schedules an active principal/reviewer a live permission-checked link on firm-local dates at a whole-day interval; notification hours apply, one durable notice per due date, downtime coalesces to one current link, revoked authority pauses delivery, and restored schedules remain paused without principal authority.
7. Existing client progress reports remain limited to PORTAL-003/CRM-001 approved client-visible data.
8. Each future capability adds its complete reporting : MAIL-001/003, SMS-001 and FOLLOWUP-001 response/delivery history; BILL-002/003/004, PAY-001/002 and INTEGRATE-001 invoice, retainer, receivable, cost, collection and profitability sources; LEDGER-001/002 source freshness; PORTAL-002/005 and MOBILE-001 any client report/export doors.

**Evidence.** `src/blotter/reports.ts`; `src/blotter/report-schedules.ts`; `src/blotter/report-exports.ts`; `src/ui/reports.tsx`; `tests/blotter/reports.test.mjs`; `tests/blotter/reports-ui.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Money is grouped by stored currency: approved billable time; adjustments; signed-off fixed fees; approved expense charges/costs; unbilled sources; immutable approved export lines; counted once; Margin is before staff cost; exports never claim invoicing; collection or settlement; Reports expose calculation inputs; job/export links with generation time; they recompute from retained sources after erasure; Internal report; export reads require BILL-001 financial authority; an agent reads with its sponsor's financial role; the company's policy for sensitive; Saved views store filters; The principal schedules an active principal/reviewer a live permission-checked link on firm-local dates at a whole-day interval; notification hours apply; one durable notice per due date; downtime coalesces to one current link; revoked authority pauses delivery; and restored schedules remain paused without principal authority; Existing client progress reports remain limited to PORTAL-003/CRM-001 approved client-visible data; Each future capability adds its complete reporting : MAIL-001/003; SMS-001; FOLLOWUP-001 response/delivery history; BILL-002/003/004; PAY-001/002; INTEGRATE-001 invoice; retainer; receivable; cost; collection; profitability sources; LEDGER-001/002 source freshness; PORTAL-002/005; MOBILE-001 any client report/export doors.

#### REPORT-006 — These inherit permission checks, source drill-down, csv/pdf parity

Core · target · **partial** · From REPORT-001 · Cites BASE-ROLE-001 · Rules D-1

**Requirement.** Provide these inherit permission checks, source drill-down, csv/pdf parity.

**Acceptance.**
1. These inherit permission checks, source drill-down, CSV/PDF parity, freshness and BASE-001 evidence, retaining their destinations/statuses.

**Evidence.** `src/blotter/reports.ts`; `src/blotter/report-schedules.ts`; `src/blotter/report-exports.ts`; `src/ui/reports.tsx`; `tests/blotter/reports.test.mjs`; `tests/blotter/reports-ui.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: These inherit permission checks; source drill-down; CSV/PDF parity; freshness; BASE-001 evidence; retaining their destinations/statuses.

### Connections and extensibility

#### INTEGRATE-001 — Firm accounting invoice and payment exchange

Core · target · **missing** · Cites BASE-ROLE-001 · Rules D-1

**Requirement.** Connect the firm's QuickBooks Online or Xero billing organization separately from each client's ledger grant. Map customers, services, tax codes, invoice IDs, credits and payments to the chosen invoice authority; preview direction and conflicts before enabling writes. Reconcile provider and accounting events without duplicate invoices or silently overwriting closed periods; sync failures have an owner and repair action.

**Acceptance.**
1. Connect firm QBO and Xero organizations in separate runs, choose each as invoice authority, deliver an approved invoice and reconcile payment/credit.
2. Replay an event, change a closed-period invoice externally and inspect one source of truth and a visible conflict.

**Evidence.** None.
**Gap.** No firm-ledger customer/invoice/payment adapter or authority mapping exists.

#### INTEGRATE-009 — Erasure-002 for INTEGRATE-009

Core · target · **missing** · From INTEGRATE-001 · Cites BASE-DATA-001, BASE-DATA-006 · Rules D-1

**Requirement.** Provide erasure-002 for INTEGRATE-009.

**Acceptance.**
1. , INTEGRATE-001 adds its records and provider copies to ERASURE-002's classes, clocks, holds, preview, erasure, receipt and restore fence.

**Evidence.** None.
**Gap.** No firm-ledger customer/invoice/payment adapter or authority mapping exists.

#### INTEGRATE-002 — US tax software document and status handoff

Core · target · **missing** · Cites BASE-INPUT-003, BASE-ROLE-001 · Rules D-1

**Requirement.** Support Lacerte, ProSeries, Drake, UltraTax CS and CCH Axcess through authorized connectors and desktop print/upload bridges where needed. Map client/entity/year, deliver source documents and retrieve final packets, signature requests (SIGN-001) and filing status from the source INTEGRATE-008 names for each stack. Preview unsupported fields and require practitioner confirmation for ambiguous matches; no handoff implies a return was calculated or filed.

**Acceptance.**
1. For each named tax stack, send an approved client-year packet through its supported connector/desktop path, receive a final packet and that stack's INTEGRATE-008 filing-status evidence and inspect IDs/provenance.
2. Disconnect the bridge and verify blocked work remains owned and no false filed state appears.

**Evidence.** None.
**Gap.** No tax-software adapter, desktop bridge or tax-status import exists.

#### INTEGRATE-010 — Erasure-002 for INTEGRATE-010

Core · target · **missing** · From INTEGRATE-002 · Cites BASE-DATA-001, BASE-DATA-006 · Rules D-1

**Requirement.** Provide erasure-002 for INTEGRATE-010.

**Acceptance.**
1. , INTEGRATE-002 adds its records and provider copies to ERASURE-002's classes, clocks, holds, preview, erasure, receipt and restore fence.

**Evidence.** None.
**Gap.** No tax-software adapter, desktop bridge or tax-status import exists.

#### INTEGRATE-003 — Connected document storage

Core · target · **missing** · Cites BASE-ROLE-001 · Rules D-1

**Requirement.** Connect Google Drive, OneDrive, SharePoint and Dropbox with explicit folder/client mapping, least-scope authority and clear original/copy/link custody. Sync approved versions and metadata, preserve internal-only rules, detect moved/deleted/changed files and surface permission conflicts; never grant a portal user access to an entire external folder by accident.

**Acceptance.**
1. Connect each service, map two client folders and import/link an approved packet.
2. Replace and move a source file, revoke a grant and attempt a cross-client share; inspect versions, freshness, custody and denied access.

**Evidence.** None.
**Gap.** No external document-storage connectors or custody mapping exist.

#### INTEGRATE-011 — Erasure-002 for INTEGRATE-011

Core · target · **missing** · From INTEGRATE-003 · Cites BASE-DATA-006 · Rules D-1

**Requirement.** Provide erasure-002 for INTEGRATE-011.

**Acceptance.**
1. , connected-storage originals, copies and links appear in ERASURE-002's preview and receipt as named outside copies owned by the connected account; disconnecting never deletes them silently.

**Evidence.** None.
**Gap.** No external document-storage connectors or custody mapping exist.

#### INTEGRATE-004 — Ignition engagement onboarding

Core · target · **missing** · Cites BASE-ROLE-001 · Rules D-1

**Requirement.** An authorized Ignition accepted proposal creates or links the correct client, records accepted scope/fees and launches assigned onboarding with the signed-document reference. Changes, cancellations and duplicate events create reviewed amendments or stop future work rather than duplicating engagements or silently changing signed scope.

**Acceptance.**
1. Accept a real authorized Ignition proposal, observe client/team/onboarding creation and signed-scope linkage, replay the event and amend/cancel it.
2. Inspect exactly one engagement and a reviewed change with future work stopped when appropriate.

**Evidence.** None.
**Gap.** No Ignition connector or accepted-proposal onboarding trigger exists.

#### INTEGRATE-012 — Crm-005 for INTEGRATE-012

Core · target · **missing** · From INTEGRATE-004 · Rules D-1

**Requirement.** Provide crm-005 for INTEGRATE-012.

**Acceptance.**
1. CRM-005 accepted proposals attach signed scope/documents and invoke the native idempotent win exactly once .

**Evidence.** None.
**Gap.** No Ignition connector or accepted-proposal onboarding trigger exists.

#### INTEGRATE-013 — Erasure-002 for INTEGRATE-013

Core · target · **missing** · From INTEGRATE-004 · Cites BASE-DATA-001, BASE-DATA-006 · Rules D-1

**Requirement.** Provide erasure-002 for INTEGRATE-013.

**Acceptance.**
1. , INTEGRATE-004 adds its records and provider copies to ERASURE-002's classes, clocks, holds, preview, erasure, receipt and restore fence.

**Evidence.** None.
**Gap.** No Ignition connector or accepted-proposal onboarding trigger exists.

#### INTEGRATE-005 — Calendars and client appointment booking

Core · target · **missing** · Rules D-1

**Requirement.** Connect Google Calendar and Outlook Calendar for staff commitments and job deadlines with configurable direction, time-zone/DST handling and private-event masking. Embed or link Calendly and Acuity Scheduling from the client portal, attach appointments to engagements and update capacity for cancellations/reschedules without duplicate events.

**Acceptance.**
1. Connect Google and Outlook staff calendars, book one Calendly and one Acuity appointment through a portal and reschedule across DST.
2. Inspect capacity and the client timeline, masked private events and removal of canceled commitments.

**Evidence.** None.
**Gap.** No Google/Outlook calendar or Calendly/Acuity booking integration exists.

#### INTEGRATE-014 — Time suggestions for INTEGRATE-014

Core · target · **missing** · From INTEGRATE-005 · Rules D-1

**Requirement.** Provide time suggestions for INTEGRATE-014.

**Acceptance.**
1. A person's connected-calendar events become a TIME-001 activity-suggestion source only with that person's separate consent for calendar, given and withdrawn by them; each suggestion links the event, private events are never used, and nothing is recorded until they approve it.

**Evidence.** None.
**Gap.** No Google/Outlook calendar or Calendly/Acuity booking integration exists.

#### INTEGRATE-015 — With calendar consent, a client meeting suggests time

Core · target · **missing** · From INTEGRATE-005 · Rules D-1

**Requirement.** Provide with calendar consent, a client meeting suggests time.

**Acceptance.**
1. With calendar consent, a client meeting suggests time on its job linking the event; a private event or a withdrawn consent suggests nothing.

**Evidence.** None.
**Gap.** No Google/Outlook calendar or Calendly/Acuity booking integration exists.

#### INTEGRATE-016 — Crm-005 for INTEGRATE-016

Core · target · **missing** · From INTEGRATE-005 · Rules D-1

**Requirement.** Provide crm-005 for INTEGRATE-016.

**Acceptance.**
1. Consult booking for a CRM-005 prospect records its consultation and connects to the prospect’s idempotent client/onboarding win .

**Evidence.** None.
**Gap.** No Google/Outlook calendar or Calendly/Acuity booking integration exists.

#### INTEGRATE-017 — Erasure-002 for INTEGRATE-017

Core · target · **missing** · From INTEGRATE-005 · Cites BASE-DATA-001, BASE-DATA-006 · Rules D-1

**Requirement.** Provide erasure-002 for INTEGRATE-017.

**Acceptance.**
1. , INTEGRATE-005 adds its records and provider copies to ERASURE-002's classes, clocks, holds, preview, erasure, receipt and restore fence.

**Evidence.** None.
**Gap.** No Google/Outlook calendar or Calendly/Acuity booking integration exists.

#### INTEGRATE-006 — Authorized IRS transcripts

Core · target · **missing** · Cites BASE-ROLE-001 · Rules D-1 · Register R-8

**Requirement.** Retrieve IRS e-Services/TDS transcripts through the authorized practitioner account and specialist integration with required taxpayer authorization, identity verification and permitted data use. Track request, pending, received, unavailable and failed states, source period and freshness; reconcile transcript differences into notice/review work. Never bypass practitioner credentials, authority restrictions or agency access rules.

**Acceptance.**
1. Using an authorized practitioner/taxpayer pair, request a permitted transcript, receive it into the correct client-period and link a discrepancy to review.
2. Exercise absent authorization, expired practitioner access and pending/failure responses without a fabricated transcript.

**Evidence.** None.
**Gap.** No IRS e-Services/TDS connector, authorization tracking or transcript workflow exists.

#### INTEGRATE-018 — Erasure-002 for INTEGRATE-018

Core · target · **missing** · From INTEGRATE-006 · Cites BASE-DATA-001, BASE-DATA-006 · Rules D-1 · Register R-8

**Requirement.** Provide erasure-002 for INTEGRATE-018.

**Acceptance.**
1. , INTEGRATE-006 adds its records and provider copies to ERASURE-002's classes, clocks, holds, preview, erasure, receipt and restore fence.

**Evidence.** None.
**Gap.** No IRS e-Services/TDS connector, authorization tracking or transcript workflow exists.

#### INTEGRATE-007 — Gusto payroll engagement context

Core · target · **missing** · Cites BASE-ACCESSIBILITY-001, BASE-ROLE-001 · Rules D-1

**Requirement.** Connect Gusto payroll clients with permission to read payroll work items, run status and due-date evidence, route unresolved payroll requests into practice work and link the authoritative payroll record. A completed practice checklist cannot mark payroll paid, taxes remitted or a 941 filed without source evidence.

**Acceptance.**
1. Connect an authorized Gusto client, observe a payroll work item and missing-information exception, follow its run status and inspect the linked source result.
2. Revoke access and verify stale status and owned follow-up without payroll money movement.

**Evidence.** None.
**Gap.** No Gusto payroll-work/status connector exists.

#### INTEGRATE-019 — Erasure-002 for INTEGRATE-019

Core · target · **missing** · From INTEGRATE-007 · Cites BASE-DATA-001, BASE-DATA-006 · Rules D-1

**Requirement.** Provide erasure-002 for INTEGRATE-019.

**Acceptance.**
1. , INTEGRATE-007 adds its records and provider copies to ERASURE-002's classes, clocks, holds, preview, erasure, receipt and restore fence.

**Evidence.** None.
**Gap.** No Gusto payroll-work/status connector exists.

#### INTEGRATE-008 — Return filing status source per tax stack

Core · target · **missing** · Cites BASE-DATA-001, BASE-ROLE-001 · Rules D-1

**Requirement.** Each tax stack has a named source of filing-status evidence. For CCH Axcess and UltraTax CS, it is the stack's authorized e-file status API or status export. For Lacerte, ProSeries and Drake, it is the e-file status report export. The INTEGRATE-002 desktop bridge reads the desktop stacks' exports on the practitioner's machine. When a stack exposes no status for a return, the practitioner records the IRS or state acknowledgment (submission ID, accepted or rejected, date) with the acknowledgment file, and the status is labeled practitioner-recorded. Status values are not transmitted, transmitted, accepted, rejected (with its reject code) and paper-filed with proof, each with its source and time received. A rejection reopens the work item to the firm's rework status (WORK-007). A checklist, signature or work status never implies a filing.

**Acceptance.**
1. For each of the five stacks, ingest one return's status from that stack's named source (transmitted, then accepted) and one rejection with its reject code, each mapped to the right client-year.
2. For a return whose stack exposes no status, record a practitioner acknowledgment with its submission ID and file.
3. Confirm the labels distinguish each source, and that the rejection reopens the work item to rework.
4. Disconnect the bridge and confirm no status is invented.

**Evidence.** None.
**Gap.** Native obligation/extension acknowledgment files exist. Return/stack-specific filing-status sources and mappings, transmission/acceptance/rejection states and codes, rejection-triggered reopening and the five-stack connector journey remain missing.

#### INTEGRATE-020 — Erasure-002 for INTEGRATE-020

Core · target · **missing** · From INTEGRATE-008 · Cites BASE-DATA-001, BASE-DATA-006 · Rules D-1

**Requirement.** Provide erasure-002 for INTEGRATE-020.

**Acceptance.**
1. , INTEGRATE-008 adds its records and provider copies to ERASURE-002's classes, clocks, holds, preview, erasure, receipt and restore fence.

**Evidence.** None.
**Gap.** Native obligation/extension acknowledgment files exist. Return/stack-specific filing-status sources and mappings, transmission/acceptance/rejection states and codes, rejection-triggered reopening and the five-stack connector journey remain missing.

#### API-001 — Authenticated product HTTP doors

Core · target · **partial** · Cites BASE-AGENT-007, BASE-DATA-001, BASE-ROLE-001 · Rules D-1

**Requirement.** Authenticated HTTP doors expose native clients, templates, work, checklist, time, billing exports and role-appropriate context. Direct route calls obey the same actor, job visibility and human-approval rules as the app; an agent's equivalent job carries its computed classes under the company's policy.

**Acceptance.**
1. Create/read work and time through the authenticated HTTP API, inspect billing as reviewer and refuse preparer/private-job reads, signed-out access and an agent calling beyond its sponsor's authority.

**Evidence.** `src/blotter/api.ts`; `src/blotter/session.ts`; `tests/blotter/flows.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Create/read work; time through the authenticated HTTP API; inspect billing as reviewer; refuse preparer/private-job reads; signed-out access; an agent calling beyond its sponsor's authority.

#### API-002 — Documented API webhooks and Zapier

Core · target · **partial** · Cites BASE-AUDIT-001, BASE-ROLE-001 · Rules D-1

**Requirement.** Publish a versioned client/work/time/document/billing API with scoped revocable integration keys, pagination, filters, idempotent writes and explicit rate limits. Signed webhooks and Zapier triggers/actions support owner-configured cross-app workflows with field mapping, delivery history, replay control and conflict handling. External credentials never inherit broader owner authority. Mechanism: [details](docs/contract/mechanism.md).

**Acceptance.**
1. Connect Zapier to create a client and task from an approved event, read paginated work/time and receive a signed completion webhook.
2. Replay a write/event, revoke a key and inspect deduplication, bounded scopes and actionable delivery failure.

**Evidence.** `src/blotter/api.ts`; `src/blotter/proposals.ts`; `src/blotter/read-pages.ts`; `src/blotter/client-read.ts`; `src/blotter/clients.ts`; `src/blotter/timesheets.ts`; `API.md`; `tests/blotter/flows.test.mjs`; `tests/blotter/api-pages.test.mjs`; `src/blotter/client-writes.ts`; `src/blotter/billing-read.ts`; `tests/blotter/api-billing.test.mjs`; `migrations/core/0077_api_client_writes.sql`; `tests/blotter/api-writes.test.mjs`; `tests/blotter/integration-keys.test.mjs`; `tests/blotter/integration-webhooks.test.mjs`; `tests/blotter/integration-ui.mjs`
**Gap.** Native v1 staff pages and client-write replay remain. Principal-reviewed non-person keys now have explicit client and action grants, live identity and MFA checks, atomic effects, per-key replay, rolling 60-request limits, entity and task creation, document and invoice metadata pages, thin signed completion webhooks with retained outcomes and human reconciliation, inactive restore and client erasure. Broader work mutations, time recording and document-byte integration doors remain unbuilt; billing integration is metadata-only with no financial execution. An authorized Zapier workspace and the complete mapped live integration journey remain unavailable. Future person-created API tokens still inherit ACCESS-004 before shipping. Status remains partial.

#### API-003 — Read slice

Core · target · **partial** · From API-002 · Cites BASE-MAIL-001, BASE-ROLE-001 · Rules D-1

**Requirement.** Provide read slice. Mechanism: [details](docs/contract/mechanism.md).

**Acceptance.**
1. Limit defaults to 50 and accepts whole numbers 1–100.
2. Work filters retain native queue visibility, including named-task access, and sort ascending by due day, client name (JavaScript UTF-16 code-unit order) and id.
3. Time retains the existing principal/reviewer-all versus preparer-own-person scope, intersects an optional person filter and inclusive recorded-date from/to bounds, and sorts descending by date, creation instant and id; the paginated door has no total 500-row ceiling.
4. Cursors bind route, normalized filters, staff email/role and the last sort tuple, never grant authority, and every page recomputes current native scope.
5. Pages are a live view, not a frozen snapshot: concurrent changes to sort fields can move records across a consumed boundary; restart for a fresh traversal.
6. Work response pages currently materialize the authorized filtered queue in memory; time and clients use SQL keysets.
7. Client pages sort ascending by name in SQLite BINARY (UTF-8 byte) order then id, intersect an optional exact client id, and share the workspace’s fields, JSON string types and masked SSN last-four value.

**Evidence.** `src/blotter/api.ts`; `src/blotter/proposals.ts`; `src/blotter/read-pages.ts`; `src/blotter/client-read.ts`; `src/blotter/clients.ts`; `src/blotter/timesheets.ts`; `API.md`; `tests/blotter/flows.test.mjs`; `tests/blotter/api-pages.test.mjs`; `src/blotter/client-writes.ts`; `src/blotter/billing-read.ts`; `tests/blotter/api-billing.test.mjs`; `migrations/core/0077_api_client_writes.sql`; `tests/blotter/api-writes.test.mjs`; `tests/blotter/integration-keys.test.mjs`; `tests/blotter/integration-webhooks.test.mjs`; `tests/blotter/integration-ui.mjs`
**Gap.** Native v1 staff pages and client-write replay remain. Principal-reviewed non-person keys now have explicit client and action grants, live identity and MFA checks, atomic effects, per-key replay, rolling 60-request limits, entity and task creation, document and invoice metadata pages, thin signed completion webhooks with retained outcomes and human reconciliation, inactive restore and client erasure. Broader work mutations, time recording and document-byte integration doors remain unbuilt; billing integration is metadata-only with no financial execution. An authorized Zapier workspace and the complete mapped live integration journey remain unavailable. Future person-created API tokens still inherit ACCESS-004 before shipping. Status remains partial.

#### API-004 — Read slice for API-004

Core · target · **partial** · From API-002 · Cites BASE-AGENT-007, BASE-DATA-001, BASE-ROLE-001, BASE-SIGNIN-002 · Rules D-1

**Requirement.** Provide read slice for API-004. Mechanism: [details](docs/contract/mechanism.md).

**Acceptance.**
1. Principals/reviewers see every unmerged client, including archived clients and clients without work; preparers need a currently readable job, including named-task access.
2. Client reads use the existing native session, current-member and MFA gates; agent bearer keys do not authenticate them.
3. Neither the cursor nor an old session preserves removed job/task authority.
4. These reads create no records or grants.
5. Existing app/queue/timesheet responses keep their behavior.
6. The broader native integration implementation and remaining gaps are stated below; this clause stays partial.

**Evidence.** `src/blotter/api.ts`; `src/blotter/proposals.ts`; `src/blotter/read-pages.ts`; `src/blotter/client-read.ts`; `src/blotter/clients.ts`; `src/blotter/timesheets.ts`; `API.md`; `tests/blotter/flows.test.mjs`; `tests/blotter/api-pages.test.mjs`; `src/blotter/client-writes.ts`; `src/blotter/billing-read.ts`; `tests/blotter/api-billing.test.mjs`; `migrations/core/0077_api_client_writes.sql`; `tests/blotter/api-writes.test.mjs`; `tests/blotter/integration-keys.test.mjs`; `tests/blotter/integration-webhooks.test.mjs`; `tests/blotter/integration-ui.mjs`
**Gap.** Native v1 staff pages and client-write replay remain. Principal-reviewed non-person keys now have explicit client and action grants, live identity and MFA checks, atomic effects, per-key replay, rolling 60-request limits, entity and task creation, document and invoice metadata pages, thin signed completion webhooks with retained outcomes and human reconciliation, inactive restore and client erasure. Broader work mutations, time recording and document-byte integration doors remain unbuilt; billing integration is metadata-only with no financial execution. An authorized Zapier workspace and the complete mapped live integration journey remain unavailable. Future person-created API tokens still inherit ACCESS-004 before shipping. Status remains partial.

#### API-005 — Billing-export read slice

Core · target · **partial** · From API-002 · Cites BASE-AUDIT-001, BASE-DATA-001, BASE-ROLE-001 · Rules D-1

**Requirement.** Provide billing-export read slice. Mechanism: [details](docs/contract/mechanism.md).

**Acceptance.**
1. SQL keysets sort descending by preparation instant then id.
2. Optional status is draft, approved or void; from/to are inclusive UTC preparation days.
3. Limits and actor/role/filter-bound cursors follow the native read rules.
4. Reads mutate nothing and restore returns the same historical snapshots.

**Evidence.** `src/blotter/api.ts`; `src/blotter/proposals.ts`; `src/blotter/read-pages.ts`; `src/blotter/client-read.ts`; `src/blotter/clients.ts`; `src/blotter/timesheets.ts`; `API.md`; `tests/blotter/flows.test.mjs`; `tests/blotter/api-pages.test.mjs`; `src/blotter/client-writes.ts`; `src/blotter/billing-read.ts`; `tests/blotter/api-billing.test.mjs`; `migrations/core/0077_api_client_writes.sql`; `tests/blotter/api-writes.test.mjs`; `tests/blotter/integration-keys.test.mjs`; `tests/blotter/integration-webhooks.test.mjs`; `tests/blotter/integration-ui.mjs`
**Gap.** Native v1 staff pages and client-write replay remain. Principal-reviewed non-person keys now have explicit client and action grants, live identity and MFA checks, atomic effects, per-key replay, rolling 60-request limits, entity and task creation, document and invoice metadata pages, thin signed completion webhooks with retained outcomes and human reconciliation, inactive restore and client erasure. Broader work mutations, time recording and document-byte integration doors remain unbuilt; billing integration is metadata-only with no financial execution. An authorized Zapier workspace and the complete mapped live integration journey remain unavailable. Future person-created API tokens still inherit ACCESS-004 before shipping. Status remains partial.

#### API-006 — Client write slice

Core · target · **partial** · From API-002 · Cites BASE-AUDIT-001, BASE-MAIL-001, BASE-ROLE-001 · Rules D-1

**Requirement.** Provide client write slice. Mechanism: [details](docs/contract/mechanism.md).

**Acceptance.**
1. It requires an `Idempotency-Key` of 1–128 ASCII letters, digits, dots, underscores, colons or hyphens.
2. Each actor email has a separate key space; JSON object key order is immaterial, while array order and exact scalar values matter.
3. A successful write commits its client, contacts, audit and receipt in one transaction.
4. Repeating the same key and payload returns the referenced client as it exists now with `replayed:true`; concurrent repeats create one client and one creation audit.
5. A different payload on a consumed key returns 409; failed validation consumes nothing.
6. The response includes `clientId`, `replayed` and the native client detail fields.
7. If the referenced client has merged away, its normal not-found rule refuses the replay without creating another client.
8. Receipts store only actor email, key/request digests, client reference and time, never request text, credentials or a cached client response.

**Evidence.** `src/blotter/api.ts`; `src/blotter/proposals.ts`; `src/blotter/read-pages.ts`; `src/blotter/client-read.ts`; `src/blotter/clients.ts`; `src/blotter/timesheets.ts`; `API.md`; `tests/blotter/flows.test.mjs`; `tests/blotter/api-pages.test.mjs`; `src/blotter/client-writes.ts`; `src/blotter/billing-read.ts`; `tests/blotter/api-billing.test.mjs`; `migrations/core/0077_api_client_writes.sql`; `tests/blotter/api-writes.test.mjs`; `tests/blotter/integration-keys.test.mjs`; `tests/blotter/integration-webhooks.test.mjs`; `tests/blotter/integration-ui.mjs`
**Gap.** Native v1 staff pages and client-write replay remain. Principal-reviewed non-person keys now have explicit client and action grants, live identity and MFA checks, atomic effects, per-key replay, rolling 60-request limits, entity and task creation, document and invoice metadata pages, thin signed completion webhooks with retained outcomes and human reconciliation, inactive restore and client erasure. Broader work mutations, time recording and document-byte integration doors remain unbuilt; billing integration is metadata-only with no financial execution. An authorized Zapier workspace and the complete mapped live integration journey remain unavailable. Future person-created API tokens still inherit ACCESS-004 before shipping. Status remains partial.

#### API-007 — Client write slice for API-007

Core · target · **partial** · From API-002 · Cites BASE-AGENT-007, BASE-DATA-001, BASE-DATA-006 · Rules D-1

**Requirement.** Provide client write slice for API-007. Mechanism: [details](docs/contract/mechanism.md).

**Acceptance.**
1. They travel with native archives so restore does not duplicate creation; source sessions and agent keys remain excluded.
2. ERASURE-002 inherits whole-client receipt retention/erasure alongside native client records.
3. Existing native client creation keeps its behavior.

**Evidence.** `src/blotter/api.ts`; `src/blotter/proposals.ts`; `src/blotter/read-pages.ts`; `src/blotter/client-read.ts`; `src/blotter/clients.ts`; `src/blotter/timesheets.ts`; `API.md`; `tests/blotter/flows.test.mjs`; `tests/blotter/api-pages.test.mjs`; `src/blotter/client-writes.ts`; `src/blotter/billing-read.ts`; `tests/blotter/api-billing.test.mjs`; `migrations/core/0077_api_client_writes.sql`; `tests/blotter/api-writes.test.mjs`; `tests/blotter/integration-keys.test.mjs`; `tests/blotter/integration-webhooks.test.mjs`; `tests/blotter/integration-ui.mjs`
**Gap.** Native v1 staff pages and client-write replay remain. Principal-reviewed non-person keys now have explicit client and action grants, live identity and MFA checks, atomic effects, per-key replay, rolling 60-request limits, entity and task creation, document and invoice metadata pages, thin signed completion webhooks with retained outcomes and human reconciliation, inactive restore and client erasure. Broader work mutations, time recording and document-byte integration doors remain unbuilt; billing integration is metadata-only with no financial execution. An authorized Zapier workspace and the complete mapped live integration journey remain unavailable. Future person-created API tokens still inherit ACCESS-004 before shipping. Status remains partial.

#### API-008 — Integration boundary

Core · target · **partial** · From API-002 · Cites BASE-SIGNIN-002 · Rules D-1

**Requirement.** Provide integration boundary. Mechanism: [details](docs/contract/mechanism.md).

**Acceptance.**
1. Principal-only second-factor step-up mints non-person credentials with explicit client and action grants.
2. Credentials intersect their creator's live principal identity and confirmed factor, recheck actions and client scope atomically, suspend on observed loss and have separate replay spaces.
3. Admission uses a durable rolling 60-request window over 60 seconds.
4. Entity creation accepts only native entity fields and adds only the new client to that key; contacts, relationships and grants remain human-reviewed.
5. Task creation adds only a label to an active client's open job, with no completion or assignment.
6. Document and billing integration reads expose metadata only; billing grants execute no financial action.
7. Thin signed completion notices contain only event, client and work references and time.
8. Registration is principal-approved and excludes earlier completions.

**Evidence.** `src/blotter/api.ts`; `src/blotter/proposals.ts`; `src/blotter/read-pages.ts`; `src/blotter/client-read.ts`; `src/blotter/clients.ts`; `src/blotter/timesheets.ts`; `API.md`; `tests/blotter/flows.test.mjs`; `tests/blotter/api-pages.test.mjs`; `src/blotter/client-writes.ts`; `src/blotter/billing-read.ts`; `tests/blotter/api-billing.test.mjs`; `migrations/core/0077_api_client_writes.sql`; `tests/blotter/api-writes.test.mjs`; `tests/blotter/integration-keys.test.mjs`; `tests/blotter/integration-webhooks.test.mjs`; `tests/blotter/integration-ui.mjs`
**Gap.** Native v1 staff pages and client-write replay remain. Principal-reviewed non-person keys now have explicit client and action grants, live identity and MFA checks, atomic effects, per-key replay, rolling 60-request limits, entity and task creation, document and invoice metadata pages, thin signed completion webhooks with retained outcomes and human reconciliation, inactive restore and client erasure. Broader work mutations, time recording and document-byte integration doors remain unbuilt; billing integration is metadata-only with no financial execution. An authorized Zapier workspace and the complete mapped live integration journey remain unavailable. Future person-created API tokens still inherit ACCESS-004 before shipping. Status remains partial.

#### API-009 — Integration boundary for API-009

Core · target · **partial** · From API-002 · Cites BASE-AUDIT-001, BASE-DATA-001, BASE-DATA-006, BASE-ROLE-001 · Rules D-1

**Requirement.** Provide integration boundary for API-009. Mechanism: [details](docs/contract/mechanism.md).

**Acceptance.**
1. Durable claims, live dispatch checks, stable event ids, retained outcomes and explicit reconciliation prevent blind retries.
2. Restoration removes bearer authority, endpoint secrets and destinations and holds unfinished deliveries; fresh registrations do not backfill history.
3. Erasure removes client grants and replay receipts, suspends a final-client key, cancels unfinished notices as record_erased and names external copies.
4. The complete Zapier journey needs an authorized workspace; broader work mutations, time recording and document-byte integration doors remain open.
5. Existing staff-session billing exports retain their native snapshot response and are not integration billing grants.

**Evidence.** `src/blotter/api.ts`; `src/blotter/proposals.ts`; `src/blotter/read-pages.ts`; `src/blotter/client-read.ts`; `src/blotter/clients.ts`; `src/blotter/timesheets.ts`; `API.md`; `tests/blotter/flows.test.mjs`; `tests/blotter/api-pages.test.mjs`; `src/blotter/client-writes.ts`; `src/blotter/billing-read.ts`; `tests/blotter/api-billing.test.mjs`; `migrations/core/0077_api_client_writes.sql`; `tests/blotter/api-writes.test.mjs`; `tests/blotter/integration-keys.test.mjs`; `tests/blotter/integration-webhooks.test.mjs`; `tests/blotter/integration-ui.mjs`
**Gap.** Native v1 staff pages and client-write replay remain. Principal-reviewed non-person keys now have explicit client and action grants, live identity and MFA checks, atomic effects, per-key replay, rolling 60-request limits, entity and task creation, document and invoice metadata pages, thin signed completion webhooks with retained outcomes and human reconciliation, inactive restore and client erasure. Broader work mutations, time recording and document-byte integration doors remain unbuilt; billing integration is metadata-only with no financial execution. An authorized Zapier workspace and the complete mapped live integration journey remain unavailable. Future person-created API tokens still inherit ACCESS-004 before shipping. Status remains partial.

#### API-010 — Access-004

Core · target · **partial** · From API-002 · Cites BASE-AGENT-007, BASE-SIGNIN-002 · Rules D-1

**Requirement.** Provide access-004. Mechanism: [details](docs/contract/mechanism.md).

**Acceptance.**
1. Before any person-created API session or token ships, it passes ACCESS-004's own per-session second-factor check before any practice data, whatever the sign-in method, and integration or agent keys never bypass the firm policy.

**Evidence.** `src/blotter/api.ts`; `src/blotter/proposals.ts`; `src/blotter/read-pages.ts`; `src/blotter/client-read.ts`; `src/blotter/clients.ts`; `src/blotter/timesheets.ts`; `API.md`; `tests/blotter/flows.test.mjs`; `tests/blotter/api-pages.test.mjs`; `src/blotter/client-writes.ts`; `src/blotter/billing-read.ts`; `tests/blotter/api-billing.test.mjs`; `migrations/core/0077_api_client_writes.sql`; `tests/blotter/api-writes.test.mjs`; `tests/blotter/integration-keys.test.mjs`; `tests/blotter/integration-webhooks.test.mjs`; `tests/blotter/integration-ui.mjs`
**Gap.** Native v1 staff pages and client-write replay remain. Principal-reviewed non-person keys now have explicit client and action grants, live identity and MFA checks, atomic effects, per-key replay, rolling 60-request limits, entity and task creation, document and invoice metadata pages, thin signed completion webhooks with retained outcomes and human reconciliation, inactive restore and client erasure. Broader work mutations, time recording and document-byte integration doors remain unbuilt; billing integration is metadata-only with no financial execution. An authorized Zapier workspace and the complete mapped live integration journey remain unavailable. Future person-created API tokens still inherit ACCESS-004 before shipping. Status remains partial.

#### API-011 — With the firm mfa policy on, a person-created

Core · target · **partial** · From API-002 · Cites BASE-ROLE-001, BASE-SIGNIN-002 · Rules D-1

**Requirement.** Provide with the firm mfa policy on, a person-created. Mechanism: [details](docs/contract/mechanism.md).

**Acceptance.**
1. With the firm MFA policy on, a person-created API session without a second factor is refused before any data; after the factor it reads only that person's authorized records; an enrolled person's new API session is challenged even while the policy is off.

**Evidence.** `src/blotter/api.ts`; `src/blotter/proposals.ts`; `src/blotter/read-pages.ts`; `src/blotter/client-read.ts`; `src/blotter/clients.ts`; `src/blotter/timesheets.ts`; `API.md`; `tests/blotter/flows.test.mjs`; `tests/blotter/api-pages.test.mjs`; `src/blotter/client-writes.ts`; `src/blotter/billing-read.ts`; `tests/blotter/api-billing.test.mjs`; `migrations/core/0077_api_client_writes.sql`; `tests/blotter/api-writes.test.mjs`; `tests/blotter/integration-keys.test.mjs`; `tests/blotter/integration-webhooks.test.mjs`; `tests/blotter/integration-ui.mjs`
**Gap.** Native v1 staff pages and client-write replay remain. Principal-reviewed non-person keys now have explicit client and action grants, live identity and MFA checks, atomic effects, per-key replay, rolling 60-request limits, entity and task creation, document and invoice metadata pages, thin signed completion webhooks with retained outcomes and human reconciliation, inactive restore and client erasure. Broader work mutations, time recording and document-byte integration doors remain unbuilt; billing integration is metadata-only with no financial execution. An authorized Zapier workspace and the complete mapped live integration journey remain unavailable. Future person-created API tokens still inherit ACCESS-004 before shipping. Status remains partial.

#### API-012 — Erasure-002 for API-012

Core · target · **partial** · From API-002 · Cites BASE-DATA-006 · Rules D-1

**Requirement.** Provide erasure-002 for API-012. Mechanism: [details](docs/contract/mechanism.md).

**Acceptance.**
1. Client erasure removes the client from key scopes, suspends a key scoped to it alone, and cancels its pending deliveries as `record_erased` (ERASURE-002).

**Evidence.** `src/blotter/api.ts`; `src/blotter/proposals.ts`; `src/blotter/read-pages.ts`; `src/blotter/client-read.ts`; `src/blotter/clients.ts`; `src/blotter/timesheets.ts`; `API.md`; `tests/blotter/flows.test.mjs`; `tests/blotter/api-pages.test.mjs`; `src/blotter/client-writes.ts`; `src/blotter/billing-read.ts`; `tests/blotter/api-billing.test.mjs`; `migrations/core/0077_api_client_writes.sql`; `tests/blotter/api-writes.test.mjs`; `tests/blotter/integration-keys.test.mjs`; `tests/blotter/integration-webhooks.test.mjs`; `tests/blotter/integration-ui.mjs`
**Gap.** Native v1 staff pages and client-write replay remain. Principal-reviewed non-person keys now have explicit client and action grants, live identity and MFA checks, atomic effects, per-key replay, rolling 60-request limits, entity and task creation, document and invoice metadata pages, thin signed completion webhooks with retained outcomes and human reconciliation, inactive restore and client erasure. Broader work mutations, time recording and document-byte integration doors remain unbuilt; billing integration is metadata-only with no financial execution. An authorized Zapier workspace and the complete mapped live integration journey remain unavailable. Future person-created API tokens still inherit ACCESS-004 before shipping. Status remains partial.

#### AUTOMATE-001 — Durable firm automation

Core · target · **partial** · Cites BASE-MAIL-001, BASE-ROLE-001 · Rules D-1

**Requirement.** Firm-reviewed schedules and events coordinate status changes (WORK-007), recurrence, conditional step advancement, email filing, review notifications, reminders, onboarding and due-date billing. Triggers include a work item entering a primary status or sub-status, all its tasks completing, a client request or organizer completing, a signature completing and a due time. Actions include setting a status, assigning a role, sending a templated message (MSG-001), requesting documents or a signature and creating an invoice. Each rule has an owner, client scope, budget, preview, pause/stop, durable attempt/outcome and visible next action. Recovery deduplicates accepted effects, rechecks authority and reconciles ambiguous provider outcomes before repeating external messages or charges.

**Acceptance.**
1. Enable rules through the app, including "when all tasks complete, set status In review" and "on entering Waiting – on client documents, send the request template".
2. Trigger status, file/task/proposal and due-time events, interrupt processing after provider acceptance and restart.
3. Inspect one authorized effect, retained attempts, a visible ambiguous/failing item and no work after rule pause or authority revocation.

**Evidence.** `src/blotter/automation.ts`; `src/blotter/automation-runner.ts`; `src/blotter/model.ts`; `src/blotter/archive-policy.mjs`; `src/ui/automation.tsx`; `migrations/core/0070_automation.sql`; `tests/blotter/automation.test.mjs`; `tests/blotter/automation-ui.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Enable rules through the app; including "when all tasks complete; set status In review"; "on entering Waiting – on client documents; send the request template"; Trigger status; file/task/proposal; due-time events; interrupt processing after provider acceptance; restart; Inspect one authorized effect; retained attempts; a visible ambiguous/failing item; no work after rule pause or authority revocation.

#### AUTOMATE-002 — Status model for AUTOMATE-002

Core · target · **partial** · From AUTOMATE-001 · Cites BASE-AUDIT-001 · Rules D-1

**Requirement.** Provide status model for AUTOMATE-002.

**Acceptance.**
1. A trigger on entering a stage or sub-status fires once per entry in the job's status history, and a set-status action moves jobs only through WORK-007's moves, sub-status limits and review gates (including partner sign-off).

**Evidence.** `src/blotter/automation.ts`; `src/blotter/automation-runner.ts`; `src/blotter/model.ts`; `src/blotter/archive-policy.mjs`; `src/ui/automation.tsx`; `migrations/core/0070_automation.sql`; `tests/blotter/automation.test.mjs`; `tests/blotter/automation-ui.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: A trigger on entering a stage or sub-status fires once per entry in the job's status history; and a set-status action moves jobs only through WORK-007's moves; sub-status limits; review gates (including partner sign-off).

#### AUTOMATE-003 — An automation on entering "waiting – on 8879

Core · target · **partial** · From AUTOMATE-001 · Rules D-1

**Requirement.** Provide an automation on entering "waiting – on 8879.

**Acceptance.**
1. An automation on entering "Waiting – on 8879 signature" fires once when a 1040 job enters it.

**Evidence.** `src/blotter/automation.ts`; `src/blotter/automation-runner.ts`; `src/blotter/model.ts`; `src/blotter/archive-policy.mjs`; `src/ui/automation.tsx`; `migrations/core/0070_automation.sql`; `tests/blotter/automation.test.mjs`; `tests/blotter/automation-ui.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: An automation on entering "Waiting – on 8879 signature" fires once when a 1040 job enters it.

#### AUTOMATE-004 — Boards and plans

Core · target · **partial** · From AUTOMATE-001 · Rules D-1

**Requirement.** Provide boards and plans.

**Acceptance.**
1. A status trigger fires on a move made from a WORK-006 board card or personal plan exactly as on any other WORK-007 move.

**Evidence.** `src/blotter/automation.ts`; `src/blotter/automation-runner.ts`; `src/blotter/model.ts`; `src/blotter/archive-policy.mjs`; `src/ui/automation.tsx`; `migrations/core/0070_automation.sql`; `tests/blotter/automation.test.mjs`; `tests/blotter/automation-ui.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: A status trigger fires on a move made from a WORK-006 board card or personal plan exactly as on any other WORK-007 move.

#### AUTOMATE-005 — Moving a 1040 card on the board into

Core · target · **partial** · From AUTOMATE-001 · Rules D-1

**Requirement.** Provide moving a 1040 card on the board into.

**Acceptance.**
1. Moving a 1040 card on the board into "Waiting – on 8879 signature" fires that automation once.

**Evidence.** `src/blotter/automation.ts`; `src/blotter/automation-runner.ts`; `src/blotter/model.ts`; `src/blotter/archive-policy.mjs`; `src/ui/automation.tsx`; `migrations/core/0070_automation.sql`; `tests/blotter/automation.test.mjs`; `tests/blotter/automation-ui.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Moving a 1040 card on the board into "Waiting – on 8879 signature" fires that automation once.

#### AUTOMATE-006 — Msg-002 marketing consent for AUTOMATE-006

Core · target · **partial** · From AUTOMATE-001 · Rules D-1

**Requirement.** Provide msg-002 marketing consent for AUTOMATE-006.

**Acceptance.**
1. Automation sends engagement class only, with MSG-002's send-time recheck.

**Evidence.** `src/blotter/automation.ts`; `src/blotter/automation-runner.ts`; `src/blotter/model.ts`; `src/blotter/archive-policy.mjs`; `src/ui/automation.tsx`; `migrations/core/0070_automation.sql`; `tests/blotter/automation.test.mjs`; `tests/blotter/automation-ui.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Automation sends engagement class only; with MSG-002's send-time recheck.

### Migration security and durable custody

#### IMPORT-001 — Reviewed client list import

Core · target · **partial** · Cites BASE-DATA-001 · Rules D-1

**Requirement.** Preview CSV account/contact imports with flexible field mapping, validation, entity/contact matching, duplicate policy and source provenance. Commit exactly the reviewed file/mapping, resume safely and inspect the journal. Undo removes untouched imported records while preserving clients with native work or conflicting edits; source originals remain protected and portable.

**Acceptance.**
1. Map an exported client/contact CSV, preview errors and duplicates without writes, commit its reviewed fingerprint and resume.
2. Re-import without duplication, create a native job on one imported client and undo; inspect preserved native work and the source journal.

**Evidence.** `src/blotter/imports.ts`; `src/blotter/imports/mapped-source.ts`; `src/blotter/imports/mapped-matching.ts`; `src/blotter/imports/mapped-target.ts`; `src/ui/move-in.tsx`; `migrations/core/0051_mapped_imports.sql`; `tests/blotter/import-mapping.test.mjs`; `tests/blotter/flows.test.mjs`; `IMPORTING.md`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Map an exported client/contact CSV; preview errors; duplicates without writes; commit its reviewed fingerprint; resume; Re-import without duplication; create a native job on one imported client; undo; inspect preserved native work; the source journal.

#### IMPORT-002 — The owner maps source headers explicitly; the reviewed

Core · target · **partial** · From IMPORT-001 · Cites BASE-MAIL-001, BASE-ROLE-001 · Rules D-1

**Requirement.** Provide the owner maps source headers explicitly; the reviewed.

**Acceptance.**
1. The owner maps source headers explicitly; the reviewed fingerprint binds original bytes, mapping and duplicate decisions.
2. Repeated stable source client IDs group agreeing entity fields and entity-specific contacts; a contact matches only its stable source ID or exact normalized email within that entity.
3. Conflicting rows block the whole preview.
4. The mapped format imports individual/business/trust and native-validated contact roles, phone and explicit authority/consent flags, all default false.
5. Possible native duplicates require an explicit keep-separate or provenance-only match to an active entity of the same type; supplied contacts must agree exactly with its native relationships.
6. A match never changes native fields or grants.
7. CRM-004 remains the merge door.
8. Stable source associations survive native merges and replay; changed source content is refused, never silently applied.

**Evidence.** `src/blotter/imports.ts`; `src/blotter/imports/mapped-source.ts`; `src/blotter/imports/mapped-matching.ts`; `src/blotter/imports/mapped-target.ts`; `src/ui/move-in.tsx`; `migrations/core/0051_mapped_imports.sql`; `tests/blotter/import-mapping.test.mjs`; `tests/blotter/flows.test.mjs`; `IMPORTING.md`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: The owner maps source headers explicitly; the reviewed fingerprint binds original bytes; mapping; duplicate decisions; Repeated stable source client IDs group agreeing entity fields; entity-specific contacts; a contact matches only its stable source ID or exact normalized email within that entity; Conflicting rows block the whole preview; The mapped format imports individual/business/trust; native-validated contact roles; phone; explicit authority/consent flags; all default false; Possible native duplicates require an explicit keep-separate or provenance-only match to an active entity of the same type; supplied contacts must agree exactly with its native relationships; A match never changes native fields or grants; CRM-004 remains the merge door; Stable source associations survive native merges; replay; changed source content is refused; never silently applied.

#### IMPORT-003 — Resume uses the retained reviewed plan; undo removes

Core · target · **partial** · From IMPORT-001 · Cites BASE-DATA-001, BASE-ROLE-001 · Rules D-1

**Requirement.** Provide resume uses the retained reviewed plan; undo removes.

**Acceptance.**
1. Resume uses the retained reviewed plan; undo removes untouched created contacts/entities, keeps any entity/contact edit or native dependent work, and never removes a matched native entity.
2. Owner-only journals and practice archives retain original UTF-8 bytes, mapping, decisions and source IDs.
3. Existing v1 jobs and their established single-contact permissions remain resumable and reversible.

**Evidence.** `src/blotter/imports.ts`; `src/blotter/imports/mapped-source.ts`; `src/blotter/imports/mapped-matching.ts`; `src/blotter/imports/mapped-target.ts`; `src/ui/move-in.tsx`; `migrations/core/0051_mapped_imports.sql`; `tests/blotter/import-mapping.test.mjs`; `tests/blotter/flows.test.mjs`; `IMPORTING.md`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Resume uses the retained reviewed plan; undo removes untouched created contacts/entities; keeps any entity/contact edit or native dependent work; and never removes a matched native entity; Owner-only journals; practice archives retain original UTF-8 bytes; mapping; decisions; source IDs; Existing v1 jobs; their established single-contact permissions remain resumable; reversible.

#### IMPORT-004 — Msg-002 marketing consent for IMPORT-004

Core · target · **partial** · From IMPORT-001 · Rules D-1

**Requirement.** Provide msg-002 marketing consent for IMPORT-004.

**Acceptance.**
1. Imports bring marketing in as not granted; a grant comes in only from an explicitly mapped opt-in column with a capture date and the owner's attestation at commit, shown separately in the preview; unsubscribed, bounced and complained states always import as withdrawals.

**Evidence.** `src/blotter/imports.ts`; `src/blotter/imports/mapped-source.ts`; `src/blotter/imports/mapped-matching.ts`; `src/blotter/imports/mapped-target.ts`; `src/ui/move-in.tsx`; `migrations/core/0051_mapped_imports.sql`; `tests/blotter/import-mapping.test.mjs`; `tests/blotter/flows.test.mjs`; `IMPORTING.md`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Imports bring marketing in as not granted; a grant comes in only from an explicitly mapped opt-in column with a capture date; the owner's attestation at commit; shown separately in the preview; unsubscribed; bounced; complained states always import as withdrawals.

#### MIGRATE-001 — Karbon migration

Core · target · **missing** · Cites BASE-AUDIT-001, BASE-DATA-001, BASE-MAIL-001, BASE-ROLE-001 · Rules D-1

**Requirement.** Migrate Karbon using authorized API extraction and supported exports/assisted extraction for clients/contacts/groups/custom fields, work types, primary statuses and firm sub-statuses with their per-type limits, job roles, work templates, repeating work schedules with the future work items they have already created (MIGRATE-006), automators (imported paused), email templates, active tasks/dependencies and assignments, triage email/thread references, notes/files, time/budget/billing history and Karbon Payments auto-pay enrollments with their saved-method references (MIGRATE-007). Preview every supported mapping, row/file count, identity/permission match and unsupported or unavailable field; preserve originals, authors, timestamps and source IDs as labeled history. Reauthorize mail, ledger and signature grants; auto-pay mandates are migrated or reauthorized under MIGRATE-007. Stage active work with outgoing automation paused, reconcile counts and unresolved items, and approve cutover before activating follow-up; support idempotent resume and conflict-preserving batch undo. Missing source export surfaces require an owned extraction plan, never silent data loss.

**Acceptance.**
1. Import an authorized Karbon practice containing completed history and live work, confirm every active work item keeps its work type and primary/sub-status (WORK-007) and that an unmapped status is held for review, review mappings and source limitations, compare counts and representative files/messages/fees, interrupt/resume and repeat the import.
2. On the same practice, pass MIGRATE-006's repeating-schedule journey (monthly, quarterly and annual series with pre-created future items) and MIGRATE-007's auto-pay journey (three auto-pay clients).
3. Complete a migrated engagement through review/payment, verify historical permissions and no duplicate reminders/debits, then exercise cutover rollback without deleting native work.

**Evidence.** None.
**Gap.** No Karbon-specific extractor, full-work/history mapping or reconciled cutover exists; the generic client CSV is not a complete migration.

#### MIGRATE-008 — Status model for MIGRATE-008

Core · target · **missing** · From MIGRATE-001 · Cites BASE-ROLE-001 · Rules D-1

**Requirement.** Provide status model for MIGRATE-008.

**Acceptance.**
1. Imported work keeps its work type, stage, sub-status (with per-type limits) and job roles, including a partner sign-off.

**Evidence.** None.
**Gap.** No Karbon-specific extractor, full-work/history mapping or reconciled cutover exists; the generic client CSV is not a complete migration.

#### MIGRATE-009 — An imported 1040 work item keeps its work

Core · target · **missing** · From MIGRATE-001 · Rules D-1

**Requirement.** Provide an imported 1040 work item keeps its work.

**Acceptance.**
1. An imported 1040 work item keeps its work type, sub-status and partner.

**Evidence.** None.
**Gap.** No Karbon-specific extractor, full-work/history mapping or reconciled cutover exists; the generic client CSV is not a complete migration.

#### MIGRATE-010 — Msg-002 marketing consent for MIGRATE-010

Core · target · **missing** · From MIGRATE-001 · Rules D-1

**Requirement.** Provide msg-002 marketing consent for MIGRATE-010.

**Acceptance.**
1. Migration brings marketing in as not granted; unsubscribed, bounced and complained states always import as withdrawals, and an incumbent "subscribed" status without evidence imports as not granted.

**Evidence.** None.
**Gap.** No Karbon-specific extractor, full-work/history mapping or reconciled cutover exists; the generic client CSV is not a complete migration.

#### MIGRATE-011 — Erasure-002 for MIGRATE-011

Core · target · **missing** · From MIGRATE-001 · Cites BASE-DATA-001, BASE-DATA-006 · Rules D-1

**Requirement.** Provide erasure-002 for MIGRATE-011.

**Acceptance.**
1. , MIGRATE-001 adds its records and provider copies to ERASURE-002's classes, clocks, holds, preview, erasure, receipt and restore fence.

**Evidence.** None.
**Gap.** No Karbon-specific extractor, full-work/history mapping or reconciled cutover exists; the generic client CSV is not a complete migration.

#### MIGRATE-002 — TaxDome migration

Core · target · **missing** · Cites BASE-AUDIT-001, BASE-DATA-001, BASE-MAIL-001, BASE-ROLE-001 · Rules D-1

**Requirement.** Migrate TaxDome using authorized API extraction and supported exports/assisted extraction for accounts/contacts, pipelines and stages (mapped to WORK-007 work types and statuses), jobs/templates/automations, recurring jobs with their already-created future jobs (MIGRATE-006), message templates, organizers and answers, portal requests/chats, documents, proposals/signed letters, invoices/credits/payment history, TaxDome Payments saved methods and auto-pay (MIGRATE-007) and staff permissions. Preview every supported mapping, row/file count, identity/permission match and unsupported or unavailable field; preserve originals, authors, timestamps and source IDs as labeled history. Reauthorize mail, ledger and signature grants; saved payment methods and auto-pay are migrated or reauthorized under MIGRATE-007. Stage active work with outgoing automation paused, reconcile counts and unresolved items, and approve cutover before activating follow-up; support idempotent resume and conflict-preserving batch undo. Missing source export surfaces require an owned extraction plan, never silent data loss.

**Acceptance.**
1. Import an authorized TaxDome practice containing completed history and live work.
2. Confirm every active item keeps its mapped work type and pipeline stage (WORK-007) and that an unmapped pipeline stage is held for review with an owner.
3. Run MIGRATE-006's series check on a monthly and an annual recurring job that have already created future items: one recurrence rule each, the pre-created items claimed once, and the next period created exactly once after cutover.
4. Run MIGRATE-007's auto-pay journey with three TaxDome clients who pay automatically.
5. Review mappings and source limitations, compare counts and representative files/messages/fees, interrupt/resume and repeat the import.
6. Complete a migrated engagement through review/payment, verify historical permissions and no duplicate reminders/debits, then exercise cutover rollback without deleting native work.

**Evidence.** None.
**Gap.** No TaxDome-specific extractor, full-work/history mapping or reconciled cutover exists; the generic client CSV is not a complete migration.

#### MIGRATE-012 — Msg-002 marketing consent for MIGRATE-012

Core · target · **missing** · From MIGRATE-002 · Rules D-1

**Requirement.** Provide msg-002 marketing consent for MIGRATE-012.

**Acceptance.**
1. Migration brings marketing in as not granted; unsubscribed, bounced and complained states always import as withdrawals, and an incumbent "subscribed" status without evidence imports as not granted.

**Evidence.** None.
**Gap.** No TaxDome-specific extractor, full-work/history mapping or reconciled cutover exists; the generic client CSV is not a complete migration.

#### MIGRATE-013 — Erasure-002 for MIGRATE-013

Core · target · **missing** · From MIGRATE-002 · Cites BASE-DATA-001, BASE-DATA-006 · Rules D-1

**Requirement.** Provide erasure-002 for MIGRATE-013.

**Acceptance.**
1. , MIGRATE-002 adds its records and provider copies to ERASURE-002's classes, clocks, holds, preview, erasure, receipt and restore fence.

**Evidence.** None.
**Gap.** No TaxDome-specific extractor, full-work/history mapping or reconciled cutover exists; the generic client CSV is not a complete migration.

#### MIGRATE-003 — Canopy migration

Core · target · **missing** · Cites BASE-AUDIT-001, BASE-DATA-001, BASE-MAIL-001, BASE-ROLE-001 · Rules D-1

**Requirement.** Migrate Canopy using authorized API extraction and supported exports/assisted extraction for clients/contacts/custom fields, tasks/templates/dependencies, recurring tasks (MIGRATE-006) and task statuses (mapped to WORK-007), notices/transcript references, client files/versions, communications, time/WIP, invoices/credits/payments, Canopy Payments saved methods and scheduled payments (MIGRATE-007) and staff access. Preview every supported mapping, row/file count, identity/permission match and unsupported or unavailable field; preserve originals, authors, timestamps and source IDs as labeled history. Reauthorize mail, ledger and signature grants; saved payment methods and auto-pay are migrated or reauthorized under MIGRATE-007. Stage active work with outgoing automation paused, reconcile counts and unresolved items, and approve cutover before activating follow-up; support idempotent resume and conflict-preserving batch undo. Missing source export surfaces require an owned extraction plan, never silent data loss.

**Acceptance.**
1. Import an authorized Canopy practice containing completed history and live work.
2. Confirm every active item keeps its mapped work type and task status (WORK-007) and that an unmapped task status is held for review with an owner.
3. Run MIGRATE-006's series check on a monthly and an annual recurring task that have already created future items: one recurrence rule each, the pre-created items claimed once, and the next period created exactly once after cutover.
4. Run MIGRATE-007's auto-pay journey with three Canopy clients who pay automatically.
5. Review mappings and source limitations, compare counts and representative files/messages/fees, interrupt/resume and repeat the import.
6. Complete a migrated engagement through review/payment, verify historical permissions and no duplicate reminders/debits, then exercise cutover rollback without deleting native work.

**Evidence.** None.
**Gap.** No Canopy-specific extractor, full-work/history mapping or reconciled cutover exists; the generic client CSV is not a complete migration.

#### MIGRATE-014 — Msg-002 marketing consent for MIGRATE-014

Core · target · **missing** · From MIGRATE-003 · Rules D-1

**Requirement.** Provide msg-002 marketing consent for MIGRATE-014.

**Acceptance.**
1. Migration brings marketing in as not granted; unsubscribed, bounced and complained states always import as withdrawals, and an incumbent "subscribed" status without evidence imports as not granted.

**Evidence.** None.
**Gap.** No Canopy-specific extractor, full-work/history mapping or reconciled cutover exists; the generic client CSV is not a complete migration.

#### MIGRATE-015 — Erasure-002 for MIGRATE-015

Core · target · **missing** · From MIGRATE-003 · Cites BASE-DATA-001, BASE-DATA-006 · Rules D-1

**Requirement.** Provide erasure-002 for MIGRATE-015.

**Acceptance.**
1. , MIGRATE-003 adds its records and provider copies to ERASURE-002's classes, clocks, holds, preview, erasure, receipt and restore fence.

**Evidence.** None.
**Gap.** No Canopy-specific extractor, full-work/history mapping or reconciled cutover exists; the generic client CSV is not a complete migration.

#### MIGRATE-004 — Financial Cents migration

Core · target · **missing** · Cites BASE-AUDIT-001, BASE-DATA-001, BASE-MAIL-001, BASE-ROLE-001 · Rules D-1

**Requirement.** Migrate Financial Cents using authorized API extraction and supported exports/assisted extraction for clients/contacts, recurring projects and their already-created future projects (MIGRATE-006) with their statuses (mapped to WORK-007), checklists/assignments, requests/portal documents, client communication, capacity/budgets, time, billing/payment history and saved payment methods with auto-pay (MIGRATE-007). Preview every supported mapping, row/file count, identity/permission match and unsupported or unavailable field; preserve originals, authors, timestamps and source IDs as labeled history. Reauthorize mail, ledger and signature grants; saved payment methods and auto-pay are migrated or reauthorized under MIGRATE-007. Stage active work with outgoing automation paused, reconcile counts and unresolved items, and approve cutover before activating follow-up; support idempotent resume and conflict-preserving batch undo. Missing source export surfaces require an owned extraction plan, never silent data loss.

**Acceptance.**
1. Import an authorized Financial Cents practice containing completed history and live work.
2. Confirm every active item keeps its mapped work type and project status (WORK-007) and that an unmapped project status is held for review with an owner.
3. Run MIGRATE-006's series check on a monthly and an annual recurring project that have already created future items: one recurrence rule each, the pre-created items claimed once, and the next period created exactly once after cutover.
4. Run MIGRATE-007's auto-pay journey with three Financial Cents clients who pay automatically.
5. Review mappings and source limitations, compare counts and representative files/messages/fees, interrupt/resume and repeat the import.
6. Complete a migrated engagement through review/payment, verify historical permissions and no duplicate reminders/debits, then exercise cutover rollback without deleting native work.

**Evidence.** None.
**Gap.** No Financial Cents-specific extractor, full-work/history mapping or reconciled cutover exists; the generic client CSV is not a complete migration.

#### MIGRATE-016 — Msg-002 marketing consent for MIGRATE-016

Core · target · **missing** · From MIGRATE-004 · Rules D-1

**Requirement.** Provide msg-002 marketing consent for MIGRATE-016.

**Acceptance.**
1. Migration brings marketing in as not granted; unsubscribed, bounced and complained states always import as withdrawals, and an incumbent "subscribed" status without evidence imports as not granted.

**Evidence.** None.
**Gap.** No Financial Cents-specific extractor, full-work/history mapping or reconciled cutover exists; the generic client CSV is not a complete migration.

#### MIGRATE-017 — Erasure-002 for MIGRATE-017

Core · target · **missing** · From MIGRATE-004 · Cites BASE-DATA-001, BASE-DATA-006 · Rules D-1

**Requirement.** Provide erasure-002 for MIGRATE-017.

**Acceptance.**
1. , MIGRATE-004 adds its records and provider copies to ERASURE-002's classes, clocks, holds, preview, erasure, receipt and restore fence.

**Evidence.** None.
**Gap.** No Financial Cents-specific extractor, full-work/history mapping or reconciled cutover exists; the generic client CSV is not a complete migration.

#### MIGRATE-005 — Double migration

Core · target · **missing** · Cites BASE-AUDIT-001, BASE-DATA-001, BASE-MAIL-001, BASE-ROLE-001 · Rules D-1

**Requirement.** Migrate Double using authorized API extraction and supported exports/assisted extraction for clients/contacts, recurring close tasks (MIGRATE-006) with their statuses and review state (mapped to WORK-007), transaction questions/answers, ledger/source references, files, communication, assignments and retained time/billing records. Preview every supported mapping, row/file count, identity/permission match and unsupported or unavailable field; preserve originals, authors, timestamps and source IDs as labeled history. Reauthorize mail, ledger and signature grants. Double has no client auto-pay to migrate; client billing held by a connected partner such as Anchor is carried as labeled history. Stage active work with outgoing automation paused, reconcile counts and unresolved items, and approve cutover before activating follow-up; support idempotent resume and conflict-preserving batch undo. Missing source export surfaces require an owned extraction plan, never silent data loss.

**Acceptance.**
1. Import an authorized Double practice containing completed history and live work.
2. Confirm every active item keeps its mapped work type and close status (WORK-007) and that an unmapped close status is held for review with an owner.
3. Run MIGRATE-006's series check on a monthly and an annual recurring close task that have already created future items: one recurrence rule each, the pre-created items claimed once, and the next period created exactly once after cutover.
4. Review mappings and source limitations, compare counts and representative files/messages/fees, interrupt/resume and repeat the import.
5. Complete a migrated engagement through review/payment, verify historical permissions and no duplicate reminders/debits, then exercise cutover rollback without deleting native work.

**Evidence.** None.
**Gap.** No Double-specific extractor, full-work/history mapping or reconciled cutover exists; the generic client CSV is not a complete migration.

#### MIGRATE-018 — Msg-002 marketing consent for MIGRATE-018

Core · target · **missing** · From MIGRATE-005 · Rules D-1

**Requirement.** Provide msg-002 marketing consent for MIGRATE-018.

**Acceptance.**
1. Migration brings marketing in as not granted; unsubscribed, bounced and complained states always import as withdrawals, and an incumbent "subscribed" status without evidence imports as not granted.

**Evidence.** None.
**Gap.** No Double-specific extractor, full-work/history mapping or reconciled cutover exists; the generic client CSV is not a complete migration.

#### MIGRATE-019 — Erasure-002 for MIGRATE-019

Core · target · **missing** · From MIGRATE-005 · Cites BASE-DATA-001, BASE-DATA-006 · Rules D-1

**Requirement.** Provide erasure-002 for MIGRATE-019.

**Acceptance.**
1. , MIGRATE-005 adds its records and provider copies to ERASURE-002's classes, clocks, holds, preview, erasure, receipt and restore fence.

**Evidence.** None.
**Gap.** No Double-specific extractor, full-work/history mapping or reconciled cutover exists; the generic client CSV is not a complete migration.

#### MIGRATE-006 — Recurring schedules and future work carry over

Core · target · **partial** · Cites BASE-ROLE-001 · Rules D-1

**Requirement.** Every source's recurring definitions migrate as WORK-002 rules, never as loose jobs: Karbon repeating work schedules (period, frequency, end date and how far in advance work is created, three months by default), TaxDome recurring jobs, Canopy recurring tasks, Financial Cents recurring projects and Double recurring close tasks. Each source series becomes exactly one recurrence rule linked to its migrated template (WORK-001), with the same frequency, anchor period, fiscal-year end, end date, assignees and job roles, budget and creation lead time. Future items the source has already created are imported once, keep their period, status, assignees and edits, and are claimed by that rule as periods it already holds; information the source carries from the previous item in a series is carried the same way. After cutover the scheduler creates only periods the source had not created, each exactly once, and no period is duplicated or skipped across the cutover boundary. Mechanism: [details](docs/contract/mechanism.md).

**Acceptance.**
1. Import an authorized Karbon practice with a monthly close series that has already created its next three periods, a quarterly 941 series and an annual 1120-S series.
2. Inspect one rule per series linked to its migrated template, with the source frequency, end date, assignees, budget and lead time, and the three pre-created monthly items attached to the monthly rule with their Karbon IDs.
3. Approve cutover and advance the scheduler's horizon by one month: it creates exactly the first monthly period Karbon had not created, nothing for periods already held, and no period between the last Karbon item and the first Blotter item is missing.
4. Add a series with a frequency Blotter cannot express and confirm it is held for review with its owner on the cutover report rather than dropped.
5. Repeat the import and confirm rule and future-item counts are unchanged.

**Evidence.** `src/blotter/recurrence-imports.ts`; `src/blotter/recurrence.ts`; `migrations/core/0082_recurrence_imports.sql`; `tests/blotter/recurrence-imports.test.mjs`; `tests/blotter/recurrence-imports-ui.mjs`
**Gap.** Reviewed native source-series mappings and source-ID claims of existing future jobs now create paused rules with owned holds, replay protection and activation review. Authorized incumbent extraction, creation of imported future items, prior-item content carry-over, complete source reconciliation and the real Karbon cutover journey remain missing.

#### MIGRATE-020 — principal supplies an explicitly reviewed mapping from

Core · target · **partial** · From MIGRATE-006 · Cites BASE-DATA-001, BASE-ROLE-001 · Rules D-1

**Requirement.** Provide a principal supplies an explicitly reviewed mapping from. Mechanism: [details](docs/contract/mechanism.md).

**Acceptance.**
1. A principal supplies an explicitly reviewed mapping from a named source practice/series to existing clients, templates, staff and up to twelve existing future jobs.
2. The source cadence must equal the mapped template cadence; native first/end periods, selected months, whole-month lead time, integer-minute budget and due-day semantics follow WORK-002.
3. A held mapping retains its source note and named active review owner; unsupported cadence, missing mappings and a competing client/template rule never create loose jobs.
4. Source system/practice/series and item IDs bind once, exact replays reuse them, and changed mapped replays refuse.
5. Commit rechecks the preview's native rows and active staff, creates the paused rule and every existing-job claim in one batch, and leaves job edits/status/assignments intact.
6. The existing exact schedule activation review is mandatory before generation, including after archive restore.
7. This operator door does not parse an incumbent export, attest its completeness, create imported future jobs or carry prior-item answers; those acceptance points remain open.

**Evidence.** `src/blotter/recurrence-imports.ts`; `src/blotter/recurrence.ts`; `migrations/core/0082_recurrence_imports.sql`; `tests/blotter/recurrence-imports.test.mjs`; `tests/blotter/recurrence-imports-ui.mjs`
**Gap.** Reviewed native source-series mappings and source-ID claims of existing future jobs now create paused rules with owned holds, replay protection and activation review. Authorized incumbent extraction, creation of imported future items, prior-item content carry-over, complete source reconciliation and the real Karbon cutover journey remain missing.

#### MIGRATE-021 — Erasure-002 for MIGRATE-021

Core · target · **partial** · From MIGRATE-006 · Cites BASE-DATA-001, BASE-DATA-006 · Rules D-1

**Requirement.** Provide erasure-002 for MIGRATE-021. Mechanism: [details](docs/contract/mechanism.md).

**Acceptance.**
1. , MIGRATE-006 adds its records and provider copies to ERASURE-002's classes, clocks, holds, preview, erasure, receipt and restore fence.

**Evidence.** `src/blotter/recurrence-imports.ts`; `src/blotter/recurrence.ts`; `migrations/core/0082_recurrence_imports.sql`; `tests/blotter/recurrence-imports.test.mjs`; `tests/blotter/recurrence-imports-ui.mjs`
**Gap.** Reviewed native source-series mappings and source-ID claims of existing future jobs now create paused rules with owned holds, replay protection and activation review. Authorized incumbent extraction, creation of imported future items, prior-item content carry-over, complete source reconciliation and the real Karbon cutover journey remain missing.

#### MIGRATE-007 — Auto pay enrollments carried over or reauthorized

Core · target · **missing** · Cites BASE-ROLE-001 · Rules D-1

**Requirement.** Migration imports each client's auto-pay enrollment and saved-method references (card or US bank account, brand and last four, authorization date and wording where available): from Karbon Payments, which runs on Stripe Connect, under MIGRATE-001, and from TaxDome Payments, Canopy Payments and Financial Cents under MIGRATE-002 to 004. Each enrollment ends in exactly one state. It becomes a valid PAY-001 mandate when the saved method is copied through Stripe's account-to-account payment-data migration (with the consent the source platform and Stripe require) and an authorization naming the firm covers Blotter's collection. Otherwise it becomes a tracked reauthorization request for that client: a MSG-001 template message with a portal link to authorize a new mandate (PAY-002), chased under FOLLOWUP-001 and owned until the client authorizes or declines. Until a client's mandate is migrated or reauthorized, Blotter never charges that client automatically; their invoices stay open with owned follow-up. Mechanism: [details](docs/contract/mechanism.md).

**Acceptance.**
1. Migrate three Karbon auto-pay clients, one whose saved card copies through Stripe's payment-data migration at the provider test edge and two whose methods cannot be copied.
2. Inspect the cutover report: one mandate migrated and two awaiting reauthorization, each with an owner and a sent template message.
3. Have one of the two reauthorize through the portal and watch the report update.
4. Issue the first post-cutover invoices: the migrated and reauthorized clients are collected automatically on the due date; the third client's invoice is not charged, stays open and carries owned reauthorization follow-up with a scheduled chase.
5. Confirm Karbon auto-pay was recorded off for each client before Blotter's first charge and that no invoice was charged in both systems.

**Evidence.** None.
**Gap.** No payment provider, auto-pay enrollment import, Stripe payment-data migration, reauthorization request tracking, cutover payment report or single-collector check exists.

#### MIGRATE-022 — Erasure-002 for MIGRATE-022

Core · target · **missing** · From MIGRATE-007 · Cites BASE-DATA-001, BASE-DATA-006 · Rules D-1

**Requirement.** Provide erasure-002 for MIGRATE-022. Mechanism: [details](docs/contract/mechanism.md).

**Acceptance.**
1. , MIGRATE-007 adds its records and provider copies to ERASURE-002's classes, clocks, holds, preview, erasure, receipt and restore fence.

**Evidence.** None.
**Gap.** No payment provider, auto-pay enrollment import, Stripe payment-data migration, reauthorization request tracking, cutover payment report or single-collector check exists.

#### ACCESS-001 — Native roles and server authority

Core · target · **partial** · Cites BASE-AGENT-007, BASE-AUDIT-001, BASE-ROLE-001, BASE-SIGNIN-002 · Rules D-1

**Requirement.** The principal invites preparers/reviewers, manages rates and deactivates staff. Same-origin mutations reject cross-site callers. Agent keys are hashed, revocable and separate from human sessions. The firm-enforced second factor is ACCESS-004, Google Workspace/Microsoft 365 sign-in is ACCESS-005 and ownership transfer at offboarding is ACCESS-006. The one named widening of assigned-job visibility: a person assigned a task by name (WORK-009) can read that job and act on their own tasks there, never on its other work; each grant is recorded in the audit log, and access ends when no task on the job is assigned to them.

**Acceptance.**
1. Invite and sign in staff, call privileged and hidden-job routes as preparer and reviewer, attempt cross-origin writes and deactivate a member.
2. Inspect immediate denial and unchanged records for a caller without the required role; an agent's equivalent action carries access or security under the company's policy.

**Evidence.** `src/blotter/session.ts`; `src/blotter/model.ts`; `src/blotter/team.ts`; `tests/blotter/flows.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Invite; sign in staff; call privileged; hidden-job routes as preparer; reviewer; attempt cross-origin writes; deactivate a member; Inspect immediate denial; unchanged records for a caller without the required role; an agent's equivalent action carries access or security under the company's policy.

#### ACCESS-002 — Client permissions and sensitive data policies

Core · target · **partial** · Cites BASE-DATA-001, BASE-ROLE-001, BASE-SIGNIN-002 · Rules D-1

**Requirement.** Configure least-privilege client/team/document access and separate partner financial authority, reviewer approval, preparer work, read-only staff and external-client identities. Taxpayer identifiers, transcripts, returns, exports and connector credentials have appropriate access, redaction and custody controls. Permission changes and revocation apply to APIs, background tasks, shares and cached sessions; in addition to ACCESS-004's second factor on every staff sign-in, require a fresh step-up for sensitive administration, credential reveals (VAULT-001) and exports.

**Acceptance.**
1. Give two teams overlapping client scopes, assign a read-only member and restrict a sensitive workpaper.
2. Attempt direct API/export/share reads and background work after revocation, then step up for an authorized export; inspect denied writes and redacted diagnostics.

**Evidence.** `src/blotter/permissions.ts`; `src/blotter/access-gate.ts`; `src/blotter/access-sql.ts`; `src/ui/permissions.tsx`; `migrations/core/0085_access_policy.sql`; `migrations/core/0088_access_delegations.sql`; `tests/blotter/permissions.test.mjs`; `tests/blotter/permissions-ui.mjs`; `tests/blotter/vault.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Give two teams overlapping client scopes; assign a read-only member; restrict a sensitive workpaper; Attempt direct API/export/share reads; background work after revocation; then step up for an authorized export; inspect denied writes; redacted diagnostics.

#### ACCESS-007 — Coverage

Core · target · **partial** · From ACCESS-002 · Rules D-1

**Requirement.** Provide coverage.

**Acceptance.**
1. Coverage proposals and named cover only use colleagues who hold the client's grant.

**Evidence.** `src/blotter/permissions.ts`; `src/blotter/access-gate.ts`; `src/blotter/access-sql.ts`; `src/ui/permissions.tsx`; `migrations/core/0085_access_policy.sql`; `migrations/core/0088_access_delegations.sql`; `tests/blotter/permissions.test.mjs`; `tests/blotter/permissions-ui.mjs`; `tests/blotter/vault.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Coverage proposals; named cover only use colleagues who hold the client's grant.

#### ACCESS-008 — colleague without the client's grant is never

Core · target · **partial** · From ACCESS-002 · Cites BASE-ROLE-001 · Rules D-1

**Requirement.** Provide a colleague without the client's grant is never.

**Acceptance.**
1. A colleague without the client's grant is never proposed as cover and naming them refuses the plan.

**Evidence.** `src/blotter/permissions.ts`; `src/blotter/access-gate.ts`; `src/blotter/access-sql.ts`; `src/ui/permissions.tsx`; `migrations/core/0085_access_policy.sql`; `migrations/core/0088_access_delegations.sql`; `tests/blotter/permissions.test.mjs`; `tests/blotter/permissions-ui.mjs`; `tests/blotter/vault.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: A colleague without the client's grant is never proposed as cover; naming them refuses the plan.

#### ACCESS-009 — The principal configures overlapping teams and explicit direct

Core · target · **partial** · From ACCESS-002 · Cites BASE-AGENT-007, BASE-DATA-001, BASE-DATA-006, BASE-MAIL-001, BASE-ROLE-001, BASE-SIGNIN-002 · Rules D-1

**Requirement.** Provide the principal configures overlapping teams and explicit direct.

**Acceptance.**
1. The principal configures overlapping teams and explicit direct client grants.
2. First configuration scopes every current staff member; no grant means no client access, including prior sessions, named-task access, API pages and agent context.
3. New staff remain scoped.
4. Client grants intersect the existing preparer/reviewer job role; read-only is a separate restriction refusing writes.
5. Sensitive workpapers are internal to the principal and individually named staff with both client and job authority; restricting revokes contact grants and all existing shares.
6. Permission changes invalidate concurrent writes, and notification/report dispatch rechecks current grants.
7. Sensitive administration (access settings, team, integration keys, firm settings, retention, credential archive mode, invoice authority and automatic-issue consent) and exports (backup and complete-archive exports, erasure journal, approved billing exports, report CSV/PDF, invoice PDFs, the MFA enrollment report) require a separate fresh second-factor confirmation valid five minutes in that session, from installation and whether or not scopes are configured; restores and imports are not exports.
8. Global financial/export/administration doors without a client-scoped query are principal-only for scoped staff, except for the two delegated permissions below.

**Evidence.** `src/blotter/permissions.ts`; `src/blotter/access-gate.ts`; `src/blotter/access-sql.ts`; `src/ui/permissions.tsx`; `migrations/core/0085_access_policy.sql`; `migrations/core/0088_access_delegations.sql`; `tests/blotter/permissions.test.mjs`; `tests/blotter/permissions-ui.mjs`; `tests/blotter/vault.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: The principal configures overlapping teams; explicit direct client grants; First configuration scopes every current staff member; no grant means no client access; including prior sessions; named-task access; API pages; agent context; New staff remain scoped; Client grants intersect the existing preparer/reviewer job role; read-only is a separate restriction refusing writes; Sensitive workpapers are internal to the principal; individually named staff with both client; job authority; restricting revokes contact grants; all existing shares; Permission changes invalidate concurrent writes; and notification/report dispatch rechecks current grants; Sensitive administration (access settings; team; integration keys; firm settings; retention; credential archive mode; invoice authority; automatic-issue consent); exports (backup; complete-archive exports; erasure journal; approved billing exports; report CSV/PDF; invoice PDFs; the MFA enrollment report) require a separate fresh second-factor confirmation valid five minutes in that session; from installation; whether or not scopes are configured; restores; imports are not exports; Global financial/export/administration doors without a client-scoped query are principal-only for scoped staff; except for the two delegated permissions below.

#### ACCESS-010 — Ruled for ACCESS-010

Core · target · **partial** · From ACCESS-002 · Cites BASE-AUDIT-001, BASE-DATA-001, BASE-ROLE-001 · Rules D-1

**Requirement.** Provide ruled for ACCESS-010. This part applies RL-3.

**Acceptance.**
1. The principal may grant named members two published permissions: 'manage access' and 'financial authority'.
2. Each grant is audited and needs step-up.
3. A holder can never grant itself, widen its own client scope or revoke the principal.
4. Firm-wide financial reports open to financial-authority holders for the clients they hold.
5. Export, sensitive-administration and credential-reveal step-up applies from installation, whether or not scopes are configured.

**Evidence.** `src/blotter/permissions.ts`; `src/blotter/access-gate.ts`; `src/blotter/access-sql.ts`; `src/ui/permissions.tsx`; `migrations/core/0085_access_policy.sql`; `migrations/core/0088_access_delegations.sql`; `tests/blotter/permissions.test.mjs`; `tests/blotter/permissions-ui.mjs`; `tests/blotter/vault.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: The principal may grant named members two published permissions: 'manage access'; 'financial authority'; Each grant is audited; needs step-up; A holder can never grant itself; widen its own client scope or revoke the principal; Firm-wide financial reports open to financial-authority holders for the clients they hold; Export; sensitive-administration; credential-reveal step-up applies from installation; whether or not scopes are configured.

#### ACCESS-011 — Implemented for ACCESS-011

Core · target · **partial** · From ACCESS-002 · Cites BASE-AUDIT-001, BASE-DATA-001, BASE-DATA-006, BASE-ROLE-001 · Rules D-1

**Requirement.** Provide implemented for ACCESS-011.

**Acceptance.**
1. The principal grants, replaces or revokes a member's permissions at `/access/delegations` (a reason is recorded; each change is audited and bumps the access revision, so the holder's concurrent writes fail and the next request already lacks the permission).
2. A manage-access holder may change teams, individual grants and restricted documents only for clients it holds itself and only for teams and people whose existing scope lies inside its own holdings; it may not name itself, be a member of a team it changes, name the principal, or delegate.
3. A financial-authority holder prepares, issues, sends and voids invoices (BILL-002), and reads the firm financial report, billing lists and exports for held clients only; the principal alone selects the invoice authority and confirms retention expiry.
4. Delegations are portable with archives; step-ups and bearer shares are not.
5. Client erasure removes staff/team client grants and document grants, redacts restriction reasons, retains attribution and fences older restores; archives retain grants but exclude step-ups and bearer shares.
6. ACCESS-003/005 and API-002 inherit the same live scopes and sensitive step-up before new identities or integration authority ship.

**Evidence.** `src/blotter/permissions.ts`; `src/blotter/access-gate.ts`; `src/blotter/access-sql.ts`; `src/ui/permissions.tsx`; `migrations/core/0085_access_policy.sql`; `migrations/core/0088_access_delegations.sql`; `tests/blotter/permissions.test.mjs`; `tests/blotter/permissions-ui.mjs`; `tests/blotter/vault.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: The principal grants; replaces or revokes a member's permissions at `/access/delegations` (a reason is recorded; each change is audited; bumps the access revision; so the holder's concurrent writes fail; the next request already lacks the permission); A manage-access holder may change teams; individual grants; restricted documents only for clients it holds itself; only for teams; people whose existing scope lies inside its own holdings; it may not name itself; be a member of a team it changes; name the principal; or delegate; A financial-authority holder prepares; issues; sends; voids invoices (BILL-002); and reads the firm financial report; billing lists; exports for held clients only; the principal alone selects the invoice authority; confirms retention expiry; Delegations are portable with archives; step-ups; bearer shares are not; Client erasure removes staff/team client grants; document grants; redacts restriction reasons; retains attribution; fences older restores; archives retain grants but exclude step-ups; bearer shares; ACCESS-003/005; API-002 inherit the same live scopes; sensitive step-up before new identities or integration authority ship.

#### ACCESS-003 — Enterprise identity lifecycle

Core · target · **partial** · Cites BASE-ROLE-001, BASE-SIGNIN-001, BASE-SIGNIN-002 · Rules D-1 · Register R-7

**Requirement.** Beyond ACCESS-005's Google Workspace and Microsoft 365 sign-in for every firm, optional Microsoft Entra ID SAML/OIDC SSO and SCIM map firm groups to roles/client teams, enforce the configured MFA policy and revoke active sessions on deprovisioning. Retain controlled owner recovery and standalone native access when SSO is not required; a failed provider connection never silently bypasses policy.

**Acceptance.**
1. Connect an authorized Entra tenant, map groups, sign in, change membership and deprovision a user.
2. Verify current-session/API denial and owner recovery, and refuse another tenant or missing required MFA assertion.

**Evidence.** `tests/blotter/enterprise.test.mjs`; `tests/blotter/enterprise-ui.mjs`; `tests/blotter/enterprise-live.mjs`; `docs/enterprise-identity.md`
**Gap.** Live interactive Entra user sign-in and Entra-driven group membership and deprovisioning are unproved: an authorized interactive sandbox user and configured provider provisioning administration are required. The held tenant has no assigned licenses or groups, and the app-only provisioning-jobs read returns 401; no mailbox or SharePoint site is needed by this clause. Approval of the adopted authority default by ct is pending. No DONE credit is claimed from documented provider shapes.

#### ACCESS-012 — Adopted authority default

Core · target · **partial** · From ACCESS-003 · Cites BASE-AGENT-007, BASE-AUDIT-001, BASE-ROLE-001, BASE-SIGNIN-001, BASE-SIGNIN-002 · Rules D-1 · Register R-7

**Requirement.** Provide adopted authority default.

**Acceptance.**
1. Only the principal, after sensitive step-up and with an audited reason, connects the configured tenant, explicitly associates an invited existing member with its application-specific subject, maps groups and issues or revokes the hashed provisioning bearer.
2. The grant rechecks its consenting principal’s live owner authority.
3. No person is created automatically and the principal is never managed by provisioning.
4. No mapped group means no staff access; conflicting role mappings choose preparer.
5. Existing direct client grants remain separate.
6. Native principal deactivation stays denied until the principal explicitly reactivates the member.
7. Required enterprise sign-in fails closed during outages and after disconnection; native owner recovery retains the existing second-factor policy.

**Evidence.** `tests/blotter/enterprise.test.mjs`; `tests/blotter/enterprise-ui.mjs`; `tests/blotter/enterprise-live.mjs`; `docs/enterprise-identity.md`
**Gap.** Live interactive Entra user sign-in and Entra-driven group membership and deprovisioning are unproved: an authorized interactive sandbox user and configured provider provisioning administration are required. The held tenant has no assigned licenses or groups, and the app-only provisioning-jobs read returns 401; no mailbox or SharePoint site is needed by this clause. Approval of the adopted authority default by ct is pending. No DONE credit is claimed from documented provider shapes.

#### ACCESS-013 — Adopted authority default for ACCESS-013

Core · target · **partial** · From ACCESS-003 · Cites BASE-AUDIT-001, BASE-DATA-001, BASE-DATA-006, BASE-SIGNIN-002 · Rules D-1 · Register R-7

**Requirement.** Provide adopted authority default for ACCESS-013.

**Acceptance.**
1. A verified provider MFA assertion satisfies sign-in only, never sensitive-administration step-up.
2. Archives restore connections and identities inactive, omit provisioning credentials and session assurance, and retain reviewed mappings; explicit audited erasure removes associations and fences older restores.

**Evidence.** `tests/blotter/enterprise.test.mjs`; `tests/blotter/enterprise-ui.mjs`; `tests/blotter/enterprise-live.mjs`; `docs/enterprise-identity.md`
**Gap.** Live interactive Entra user sign-in and Entra-driven group membership and deprovisioning are unproved: an authorized interactive sandbox user and configured provider provisioning administration are required. The held tenant has no assigned licenses or groups, and the app-only provisioning-jobs read returns 401; no mailbox or SharePoint site is needed by this clause. Approval of the adopted authority default by ct is pending. No DONE credit is claimed from documented provider shapes.

#### ACCESS-004 — Enforced staff multi factor authentication

Core · target · **partial** · Cites BASE-AGENT-007, BASE-AUDIT-001, BASE-DATA-001, BASE-ROLE-001, BASE-SIGNIN-002 · Rules D-1

**Requirement.** The owner can set a firm policy requiring a second factor for every staff sign-in, whatever the method. Accepted factors are a TOTP authenticator app, a passkey or security key, or, under federated sign-in (ACCESS-005, ACCESS-003), an identity-provider assertion that MFA was performed. When the provider does not assert MFA, Blotter requires its own factor. The policy covers web, mobile and person-created API sessions. Integration and agent keys are separately scoped credentials (API-002, AGENT-001) and cannot be used to bypass it. A staff member must enroll before seeing any client data. Recovery uses one-time recovery codes, or an owner reset that is audited and revokes all of that person's sessions. The owner's own factor is recovered with recovery codes or by a second owner. Session lifetime and idle timeout are configurable. Mechanism: [details](docs/contract/mechanism.md).

**Acceptance.**
1. Enable the firm MFA policy.
2. A preparer without a factor must enroll before seeing any client.
3. Sign in with TOTP and with a passkey.
4. A sign-in with the correct first factor and no second factor is refused, and a session created before the policy must step up before further access.
5. When the preparer loses their factor, the owner resets it; the preparer's sessions are revoked and the audit shows who reset it.
6. A federated sign-in whose token lacks an MFA assertion is challenged for a Blotter factor.
7. Export the enrollment report.

**Evidence.** `src/blotter/mfa.ts`; `src/blotter/webauthn.ts`; `src/blotter/session.ts`; `migrations/core/0024_mfa.sql`; `src/ui/security.tsx`; `tests/blotter/flows.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Enable the firm MFA policy; A preparer without a factor must enroll before seeing any client; Sign in with TOTP; with a passkey; A sign-in with the correct first factor; no second factor is refused; and a session created before the policy must step up before further access; When the preparer loses their factor; the owner resets it; the preparer's sessions are revoked; the audit shows who reset it; A federated sign-in whose token lacks an MFA assertion is challenged for a Blotter factor; Export the enrollment report.

#### ACCESS-005 — Google Workspace and Microsoft 365 staff sign in

Core · target · **missing** · Cites BASE-MAIL-001, BASE-ROLE-001, BASE-SIGNIN-002 · Rules D-1

**Requirement.** Staff sign in with their firm Google Workspace or Microsoft 365 (Entra ID) account through OpenID Connect, so the firm's existing password, MFA and conditional-access policies apply to Blotter. The owner restricts sign-in to verified firm domains or tenant IDs, and each account maps to an invited Blotter member. Unknown accounts are refused and never created automatically. Blotter revalidates each federated identity at least hourly and on every API token refresh. A suspended or deleted account loses its Blotter session and API access at the next revalidation, or immediately when the provider sends a revocation signal (Google RISC, Microsoft continuous access evaluation). Native sign-in stays available for owner recovery, and the owner can disable it for staff. Signing in never grants mailbox access; that is a separate MAIL-001 grant.

**Acceptance.**
1. Sign in one preparer through Google Workspace and another through Microsoft 365.
2. A personal gmail.com account and an account from another tenant are refused.
3. Suspend the Google account in Google Admin and confirm the Blotter browser session and that member's API token are refused within the revalidation interval, or immediately when the provider signal arrives.
4. Disable the Microsoft user and confirm the same.
5. The owner can still recover through native sign-in.

**Evidence.** None.
**Gap.** No Google or Microsoft staff sign-in, domain/tenant restriction or identity revalidation exists.

#### ACCESS-006 — Staff offboarding and ownership transfer

Core · target · **partial** · Cites BASE-AUDIT-001, BASE-MAIL-001, BASE-ROLE-001 · Rules D-1

**Requirement.** Before deactivating a departing or long-absent staff member, the owner previews everything that person owns. That covers client ownership and team roles, open work and tasks, job roles, triaged email and their connected mailbox, scheduled reminders and automations, pending signature and document requests sent in their name, running timers and unapproved time. The owner transfers it to named successors in one reviewed batch. Messages already sent keep their original author. Future scheduled sends change sender only on approval. Deactivation revokes the person's sessions, API tokens and mailbox grants, and history keeps their attribution.

**Acceptance.**
1. Give a preparer clients, open work, a scheduled reminder sequence, a pending signature request and a connected mailbox.
2. Preview the transfer, reassign everything to two successors and deactivate the preparer.
3. No orphaned item remains.
4. The next reminder goes from the successor, past messages show the original author, and the deactivated member's sessions and tokens are refused.

**Evidence.** `src/blotter/offboarding.ts`; `src/blotter/team.ts`; `src/ui/offboarding.tsx`; `tests/blotter/flows.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Give a preparer clients; open work; a scheduled reminder sequence; a pending signature request; a connected mailbox; Preview the transfer; reassign everything to two successors; deactivate the preparer; No orphaned item remains; The next reminder goes from the successor; past messages show the original author; and the deactivated member's sessions; tokens are refused.

#### ACCESS-014 — The principal offboards

Core · target · **partial** · From ACCESS-006 · Cites BASE-AGENT-007, BASE-ROLE-001 · Rules D-1

**Requirement.** Provide the principal offboards .

**Acceptance.**
1. The principal offboards (until a second owner role exists).
2. The preview lists, for one member, active or already deactivated: open jobs where they are preparer, reviewer or manager (a client's ownership is its jobs and recurring rules until CRM-001 adds a client owner, which inherits this transfer ); their open named tasks; recurring rules naming them; open tax notices assigned to them; open discussions they own; open client questions and client to-dos they own (PORTAL-003); agent preparations awaiting the company's policy decision; templates naming them as a task owner; their running timer; their time not yet approved; their live agent keys and sessions.
3. The principal names a work successor (preparation, tasks, notices, discussions, client questions and to-dos, template tasks) and a review successor (review and manager roles, proposals; the work successor unless named).

**Evidence.** `src/blotter/offboarding.ts`; `src/blotter/team.ts`; `src/ui/offboarding.tsx`; `tests/blotter/flows.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: The principal offboards (until a second owner role exists); The preview lists; for one member; active or already deactivated: open jobs where they are preparer; reviewer or manager (a client's ownership is its jobs; recurring rules until CRM-001 adds a client owner; which inherits this transfer ); their open named tasks; recurring rules naming them; open tax notices assigned to them; open discussions they own; open client questions; client to-dos they own (PORTAL-003); agent preparations awaiting the company's policy decision; templates naming them as a task owner; their running timer; their time not yet approved; their live agent keys; sessions; The principal names a work successor (preparation; tasks; notices; discussions; client questions; to-dos; template tasks); a review successor (review; manager roles; proposals; the work successor unless named).

#### ACCESS-015 — One batch, matching the preview exactly and refused

Core · target · **partial** · From ACCESS-006 · Cites BASE-AGENT-007, BASE-AUDIT-001, BASE-ROLE-001 · Rules D-1

**Requirement.** Provide one batch, matching the preview exactly and refused.

**Acceptance.**
1. One batch, matching the preview exactly and refused while any job or rule would make someone review their own work, moves all of it, discards the running timer (nothing recorded; its start is kept in the audit), submits their unsubmitted time for approval on their behalf (returned entries never bill; the principal deletes them before closing their period), and deactivates them.
2. Document requests move with their jobs; sent messages, reminders, decisions and recorded time keep their authors.
3. AUTOMATE-001 versions remain principal-owned: the preview lists versions referencing the departing person and the batch checks those unchanged versions.
4. It never silently transfers standing approval; live checks refuse an inactive assignee until a new version is reviewed.
5. Deactivation, whether by offboarding or directly, revokes every session and agent key at once; reactivation needs a new sign-in and new keys, and a member deactivated urgently is offboarded the same way afterwards.

**Evidence.** `src/blotter/offboarding.ts`; `src/blotter/team.ts`; `src/ui/offboarding.tsx`; `tests/blotter/flows.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: One batch; matching the preview exactly; refused while any job or rule would make someone review their own work; moves all of it; discards the running timer (nothing recorded; its start is kept in the audit); submits their unsubmitted time for approval on their behalf (returned entries never bill; the principal deletes them before closing their period); and deactivates them; Document requests move with their jobs; sent messages; reminders; decisions; recorded time keep their authors; AUTOMATE-001 versions remain principal-owned: the preview lists versions referencing the departing person; the batch checks those unchanged versions; It never silently transfers standing approval; live checks refuse an inactive assignee until a new version is reviewed; Deactivation; whether by offboarding or directly; revokes every session; agent key at once; reactivation needs a new sign-in; new keys; and a member deactivated urgently is offboarded the same way afterwards.

#### ACCESS-016 — Connected mailboxes, mail triage and mailbox grants

Core · target · **partial** · From ACCESS-006 · Cites BASE-MAIL-001 · Rules D-1

**Requirement.** Provide connected mailboxes, mail triage and mailbox grants .

**Acceptance.**
1. Connected mailboxes, mail triage and mailbox grants (MAIL-001, MAIL-003), scheduled reminder sends (FOLLOWUP-001), signature requests (SIGN-001, SIGN-002) do not exist yet; each joins this preview and batch, and a scheduled send changes sender only through this approved batch.

**Evidence.** `src/blotter/offboarding.ts`; `src/blotter/team.ts`; `src/ui/offboarding.tsx`; `tests/blotter/flows.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Connected mailboxes; mail triage; mailbox grants (MAIL-001; MAIL-003); scheduled reminder sends (FOLLOWUP-001); signature requests (SIGN-001; SIGN-002) do not exist yet; each joins this preview; batch; and a scheduled send changes sender only through this approved batch.

#### ACCESS-017 — Msg-002 marketing consent for ACCESS-017

Core · target · **partial** · From ACCESS-006 · Rules D-1

**Requirement.** Provide msg-002 marketing consent for ACCESS-017.

**Acceptance.**
1. A departing member's bulk-message batches move to the successor, and marketing batches need fresh principal approval.

**Evidence.** `src/blotter/offboarding.ts`; `src/blotter/team.ts`; `src/ui/offboarding.tsx`; `tests/blotter/flows.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: A departing member's bulk-message batches move to the successor; and marketing batches need fresh principal approval.

#### SECURE-001 — Security program and attestation

Core · target · **partial** · Cites BASE-DATA-001, BASE-MAIL-001 · Rules D-1 · Register R-3, R-4

**Requirement.** Blotter publishes a security overview. Under NDA it provides firm owners with a current SOC 2 Type II report and bridge letter, a penetration-test summary, its subprocessor list, a data-flow description and a completed standard questionnaire (SIG Lite or CAIQ). It documents the controls a firm's WISP and the FTC Safeguards Rule rely on: encryption in transit and at rest, US data residency, access logging, tested backups and restores, vulnerability management, and incident response with customer notification within 72 hours of a confirmed incident affecting the firm's data. It also provides a WISP template that maps Blotter's controls to IRS Publications 4557 and 5708. Owners can export access logs.

**Acceptance.**
1. As the owner, request and download the attestation package from settings, and check that the report period is current and the subprocessor list matches the enabled integrations.
2. Export an access log for a date range.
3. A preparer cannot download the package.

**Evidence.** `src/blotter/security-logs.ts`; `src/ui/security.tsx`; `API.md`; `tests/blotter/security-logs.test.mjs`; `tests/blotter/security-logs-ui.mjs`
**Gap.** Native recorded document-download log export only: successful staff, contact-portal and bearer events, principal-only with fresh step-up; bearer identity remains unverified and coverage is explicitly incomplete. Missing: security overview; authorized auditor or attestation-provider account or NDA report access supplying a genuine current SOC 2 Type II report, bridge letter and penetration-test summary; attestation-package request and download with current-period verification; enabled-integration subprocessor list; data-flow description; SIG Lite or CAIQ questionnaire; documented WISP and FTC controls covering encryption, US residency, access logging, tested backups and restores, vulnerability management and incident response with 72-hour customer notification; WISP template mapped to IRS Publications 4557 and 5708. No certification or provider evidence is claimed.

#### VAULT-001 — Client credential vault

Core · target · **partial** · Cites BASE-AGENT-007, BASE-DATA-001, BASE-MAIL-001, BASE-ROLE-001, BASE-SIGNIN-002 · Rules D-1

**Requirement.** Clients and staff store client-provided logins, such as bank, payroll, state tax and sales-tax portal credentials, encrypted under per-firm keys. Each credential is visible only to staff permitted on that client. Every reveal requires the staff member's MFA step-up (ACCESS-004) and is logged. Clients add and update credentials through the portal. Credentials never appear in AI context, emails, search or plain exports; archives either encrypt or exclude them, at the owner's choice. Rotation reminders are optional. Mechanism: [details](docs/contract/mechanism.md).

**Acceptance.**
1. A client adds a state sales-tax portal login through the portal.
2. An assigned preparer reveals it after step-up, and the reveal is logged.
3. An unassigned preparer cannot reveal it.
4. The credential is absent from search, AI summaries and plain exports.
5. Revoke the preparer's access and confirm their next reveal is refused.

**Evidence.** `src/blotter/vault.ts`; `src/blotter/mfa.ts`; `src/blotter/archive-policy.mjs`; `migrations/core/0067_vault.sql`; `src/ui/vault.tsx`; `tests/blotter/vault.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: A client adds a state sales-tax portal login through the portal; An assigned preparer reveals it after step-up; and the reveal is logged; An unassigned preparer cannot reveal it; The credential is absent from search; AI summaries; plain exports; Revoke the preparer's access; confirm their next reveal is refused.

#### VAULT-002 — Erasure-002 for VAULT-002

Core · target · **partial** · From VAULT-001 · Cites BASE-DATA-006, BASE-ROLE-001 · Rules D-1

**Requirement.** Provide erasure-002 for VAULT-002. Mechanism: [details](docs/contract/mechanism.md).

**Acceptance.**
1. Its owner erasure is refused inside an ERASURE-002 hold; whole-client erasure removes ciphertext, usernames and notes and keeps the reveal log under opaque labels (ERASURE-002).

**Evidence.** `src/blotter/vault.ts`; `src/blotter/mfa.ts`; `src/blotter/archive-policy.mjs`; `migrations/core/0067_vault.sql`; `src/ui/vault.tsx`; `tests/blotter/vault.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Its owner erasure is refused inside an ERASURE-002 hold; whole-client erasure removes ciphertext; usernames; notes; keeps the reveal log under opaque labels (ERASURE-002).

#### VAULT-003 — Staff permitted on a client are the principal

Core · target · **partial** · From VAULT-001 · Cites BASE-AUDIT-001, BASE-DATA-001, BASE-DATA-006, BASE-ROLE-001, BASE-SIGNIN-002 · Rules D-1

**Requirement.** Provide staff permitted on a client are the principal. Mechanism: [details](docs/contract/mechanism.md).

**Acceptance.**
1. Staff permitted on a client are the principal, reviewers and a preparer holding a job on that client (ACCESS-001 job scope; ACCESS-002 inherits configurable client grants ); others get not found, and lists show names, portal addresses, authors, times and rotation dates only; usernames, passwords and notes stay sealed.
2. A reveal needs a step-up from that session in the last 5 minutes: a fresh TOTP, passkey or recovery-code answer, even when the session already passed its sign-in check; credential handling carries security and sensitive under the company's policy.
3. Every reveal and every refused reveal by permitted staff is logged with person, credential, time and outcome, and shows in the client's history.
4. Clients add and replace credentials through their contact-scoped link (CRM-001 authority) and never read one back.
5. Rotation dates show as due on the staff list; no reminder is sent.
6. The principal erases a credential by typing its name with a reason: the ciphertext goes, its name, authors, times and log stay, and older archives are fenced.
7. A merged client's credentials follow its survivor.

**Evidence.** `src/blotter/vault.ts`; `src/blotter/mfa.ts`; `src/blotter/archive-policy.mjs`; `migrations/core/0067_vault.sql`; `src/ui/vault.tsx`; `tests/blotter/vault.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Staff permitted on a client are the principal; reviewers; a preparer holding a job on that client (ACCESS-001 job scope; ACCESS-002 inherits configurable client grants ); others get not found; and lists show names; portal addresses; authors; times; rotation dates only; usernames; passwords; notes stay sealed; A reveal needs a step-up from that session in the last 5 minutes: a fresh TOTP; passkey or recovery-code answer; even when the session already passed its sign-in check; credential handling carries security; sensitive under the company's policy; Every reveal; every refused reveal by permitted staff is logged with person; credential; time; outcome; and shows in the client's history; Clients add; replace credentials through their contact-scoped link (CRM-001 authority); never read one back; Rotation dates show as due on the staff list; no reminder is sent; The principal erases a credential by typing its name with a reason: the ciphertext goes; its name; log stay; and older archives are fenced; A merged client's credentials follow its survivor.

#### VAULT-004 — Erasure-002 inherits client-wide credential erasure and holds, and

Core · target · **partial** · From VAULT-001 · Cites BASE-DATA-006 · Rules D-1

**Requirement.** Provide erasure-002 inherits client-wide credential erasure and holds, and. Mechanism: [details](docs/contract/mechanism.md).

**Acceptance.**
1. ERASURE-002 inherits client-wide credential erasure and holds, and MOBILE-001 inherits the native reveal.

**Evidence.** `src/blotter/vault.ts`; `src/blotter/mfa.ts`; `src/blotter/archive-policy.mjs`; `migrations/core/0067_vault.sql`; `src/ui/vault.tsx`; `tests/blotter/vault.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: ERASURE-002 inherits client-wide credential erasure; holds; and MOBILE-001 inherits the native reveal.

#### AGENT-001 — Agent preparation and policy-governed effects

Core · target · **partial** · Cites BASE-AGENT-007, BASE-AUDIT-001, BASE-DATA-001, BASE-ROLE-001 · Rules D-1 · Register R-11

**Requirement.** A separately keyed agent reads role-scoped context and prepares roll-forward, reminder or billing-export proposals for its named human. The company's policy decides roll-forward (standard), reminders (external) and billing-export decisions (commitment); a person's approval or decline is attributed only after that person acts. Accepted effects and decisions retain attribution/result identity; repeated decisions are refused and revoked keys cease working. Work sign-off and billing decisions carry commitment; the company's policy decides whether an agent's decision runs or waits.

**Acceptance.**
1. Under the held company policy, create a key, prepare all three proposal kinds, attempt approval with the key, approve as its human and decline another with a reason.
2. Inspect decision/result history, refusal of a second decision and immediate key revocation.

**Evidence.** `src/blotter/proposals.ts`; `src/blotter/team.ts`; `tests/blotter/flows.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Under the held company policy; create a key; prepare all three proposal kinds; attempt approval with the key; approve as its human; decline another with a reason; Inspect decision/result history; refusal of a second decision; immediate key revocation. Existing preparations use fixed person-only decisions; company-policy class computation and execution through the shared registry remain unproved.

#### ARCHIVE-001 — Whole practice portability and restore

Core · target · **partial** · Cites BASE-AGENT-007, BASE-AUDIT-001, BASE-DATA-001, BASE-INPUT-003, BASE-ROLE-001 · Rules D-1

**Requirement.** The principal downloads an integrity-checked native archive containing product records, original small files, import provenance, review history and immutable approved CSVs, then restores into an empty installation. Identity/sessions, outboxes, agent keys, upload-link authority and private configuration stay installation-local and excluded. Damaged archives and nonempty destinations are refused; imported history does not reauthorize external actions. Base portability is the data transport, with Blotter's explicit exclusions.

**Acceptance.**
1. Export via the owner HTTP door, reject a damaged archive and a nonempty restore, restore the intact archive into an empty installation and export again.
2. Compare all archived rows, kept file bytes and approved CSV bytes; inspect excluded local authority.

**Evidence.** `src/blotter/archive.ts`; `src/blotter/archive-policy.mjs`; `tests/blotter/flows.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Export via the owner HTTP door; reject a damaged archive; a nonempty restore; restore the intact archive into an empty installation; export again; Compare all archived rows; kept file bytes; approved CSV bytes; inspect excluded local authority.

#### ARCHIVE-002 — Complete target data portability

Core · target · **partial** · Cites BASE-AGENT-007, BASE-AUDIT-001, BASE-DATA-001, BASE-ROLE-001 · Rules D-1

**Requirement.** Extend owner archives and selective machine-readable exports to every new target record: messages, organizer/signature evidence, versions, deadlines, ledger snapshots, capacity, invoices/payments, automation/agent history and source-labeled migrations. Publish limits and resumable export/restore progress for a working firm; restore historical external references inactive, reauthorize connectors and preview scheduled follow-up before activation.

**Acceptance.**
1. Export a multi-year firm with connected history, interrupt/resume the operation and restore to an empty destination.
2. Reconcile record/file counts, relationships, permissions and financial totals, then activate only reviewed connections/rules without replaying past messages or payments.

**Evidence.** `src/blotter/archive-transfers.ts`; `src/blotter/archive-policy.mjs`; `src/blotter/recurrence.ts`; `src/ui/archive-transfers.tsx`; `tests/blotter/archive-transfers.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Export a multi-year firm with connected history; interrupt/resume the operation; restore to an empty destination; Reconcile record/file counts; relationships; permissions; financial totals; then activate only reviewed connections/rules without replaying past messages or payments.

#### ARCHIVE-003 — Current-native completion and inheritance

Core · target · **partial** · From ARCHIVE-002 · Cites BASE-AGENT-007, BASE-AUDIT-001, BASE-DATA-001, BASE-INPUT-003, BASE-SIGNIN-002 · Rules D-1

**Requirement.** Provide current-native completion and inheritance.

**Acceptance.**
1. Every product table and original file byte store is included by discovery, including source-labeled imports and approved billing CSVs; identity, sessions, MFA, agent keys, portal/share bearer links, unfinished uploads and transient anti-spam state are excluded.
2. Owner-only durable export/restore doors confirm one part per request (at most 16 MiB of part JSON, with a 24,000,000-character request bound); progress survives page/process interruption and identical part replay, while changed parts fail verification.
3. The legacy single-request restore retains its 64,000,000-character bound; the part door has no whole-file string limit.
4. An archive holds a consistent source snapshot and selected included tables can also be downloaded as NDJSON for analysis, labelled non-restorable.
5. Restored recurring rules start paused with a fresh review requirement; their exact held periods and catch-up plan must be previewed and approved before resuming.
6. Original source rules remain unchanged.
7. Previously unsent staff alerts are retained as held history and never replayed; confirmed historic messages keep their outcomes.
8. Restored external references remain history, with configuration and provider credentials re-entered separately.

**Evidence.** `src/blotter/archive-transfers.ts`; `src/blotter/archive-policy.mjs`; `src/blotter/recurrence.ts`; `src/ui/archive-transfers.tsx`; `tests/blotter/archive-transfers.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Every product table; original file byte store is included by discovery; including source-labeled imports; approved billing CSVs; identity; sessions; MFA; agent keys; portal/share bearer links; unfinished uploads; transient anti-spam state are excluded; Owner-only durable export/restore doors confirm one part per request (at most 16 MiB of part JSON; with a 24,000,000-character request bound); progress survives page/process interruption; identical part replay; while changed parts fail verification; The legacy single-request restore retains its 64,000,000-character bound; the part door has no whole-file string limit; An archive holds a consistent source snapshot; selected included tables can also be downloaded as NDJSON for analysis; labelled non-restorable; Restored recurring rules start paused with a fresh review requirement; their exact held periods; catch-up plan must be previewed; approved before resuming; Original source rules remain unchanged; Previously unsent staff alerts are retained as held history; never replayed; confirmed historic messages keep their outcomes; Restored external references remain history; with configuration; provider credentials re-entered separately.

#### ARCHIVE-004 — Current-native completion and inheritance for ARCHIVE-004

Core · target · **partial** · From ARCHIVE-002 · Cites BASE-AGENT-007, BASE-DATA-001, BASE-DATA-006, BASE-MAIL-001, BASE-ROLE-001 · Rules D-1

**Requirement.** Provide current-native completion and inheritance for ARCHIVE-004.

**Acceptance.**
1. Erasure invalidates staged transfer copies and a newer erasure journal refuses a stale restore.
2. Full completion for shipped kinds is asserted by the named ARCHIVE-002/BASE-001 public-door journeys.
3. Each future capability adds its records, permission/financial reconciliation, exclusions, safe inactive restoration and reviewed reauthorization : MAIL-001–003, PORTAL-002/004, SIGN-001/002, ENGAGE-001, DUE-001/003, LEDGER-001–003, BILL-002–005, PAY-001/002, INTEGRATE-001–008, AUTOMATE-001, API-002, MIGRATE-001–007, VAULT-001, ERASURE-002, AI-001–003 and READY-001/RESCUE-001/LEARN-001/REVENUE-001/ONBOARD-001/SWITCH-001/NOTICE-001.

**Evidence.** `src/blotter/archive-transfers.ts`; `src/blotter/archive-policy.mjs`; `src/blotter/recurrence.ts`; `src/ui/archive-transfers.tsx`; `tests/blotter/archive-transfers.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Erasure invalidates staged transfer copies; a newer erasure journal refuses a stale restore; Full completion for shipped kinds is asserted by the named ARCHIVE-002/BASE-001 public-door journeys; Each future capability adds its records; permission/financial reconciliation; exclusions; safe inactive restoration; reviewed reauthorization : MAIL-001–003; PORTAL-002/004; SIGN-001/002; ENGAGE-001; DUE-001/003; LEDGER-001–003; BILL-002–005; PAY-001/002; INTEGRATE-001–008; AUTOMATE-001; API-002; MIGRATE-001–007; VAULT-001; ERASURE-002; AI-001–003; READY-001/RESCUE-001/LEARN-001/REVENUE-001/ONBOARD-001/SWITCH-001/NOTICE-001.

#### ARCHIVE-005 — Msg-002 marketing consent for ARCHIVE-005

Core · target · **partial** · From ARCHIVE-002 · Cites BASE-DATA-001 · Rules D-1

**Requirement.** Provide msg-002 marketing consent for ARCHIVE-005.

**Acceptance.**
1. Consent events and suppressions travel with archives, unsubscribe tokens are excluded, and marketing stays off after a restore until the principal confirms the consent log is current.

**Evidence.** `src/blotter/archive-transfers.ts`; `src/blotter/archive-policy.mjs`; `src/blotter/recurrence.ts`; `src/ui/archive-transfers.tsx`; `tests/blotter/archive-transfers.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Consent events; suppressions travel with archives; unsubscribe tokens are excluded; and marketing stays off after a restore until the principal confirms the consent log is current.

#### ERASURE-001 — File erasure and stale archive fencing

Core · target · **partial** · Cites BASE-AUDIT-001, BASE-DATA-001, BASE-DATA-006, BASE-ROLE-001 · Rules D-1

**Requirement.** An owner confirms a file name and reason to erase its bytes, invalidate in-progress transfers and retain a minimal erasure/history record. New archives omit the bytes; an older archive is refused when the later erasure journal establishes its invalidity. The journal must travel with a stale copy for cross-installation fencing; offline copies cannot be recalled remotely.

**Acceptance.**
1. Export, erase a file through the owner door, refuse later downloads and inspect a new archive without the bytes.
2. Restore the old archive with the later journal and require refusal; restore the latest archive and retain kept files and erasure history.

**Evidence.** `src/blotter/archive.ts`; `tests/blotter/flows.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Export; erase a file through the owner door; refuse later downloads; inspect a new archive without the bytes; Restore the old archive with the later journal; require refusal; restore the latest archive; retain kept files; erasure history.

#### ERASURE-003 — Erasure-002 for ERASURE-003

Core · target · **partial** · From ERASURE-001 · Cites BASE-DATA-006, BASE-ROLE-001 · Rules D-1

**Requirement.** Provide erasure-002 for ERASURE-003.

**Acceptance.**
1. Inside an ERASURE-002 hold this door is refused, naming the hold (proved under ERASURE-002).

**Evidence.** `src/blotter/archive.ts`; `tests/blotter/flows.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Inside an ERASURE-002 hold this door is refused; naming the hold (proved under ERASURE-002).

#### ERASURE-002 — Retention legal hold and target erasure

Core · target · **partial** · Cites BASE-AGENT-007, BASE-DATA-001, BASE-DATA-006 · Rules D-1

**Requirement.** Firm policies govern client/engagement retention, legal holds, deletion requests, connector copies, messages, derived AI data and archives. Preview affected records and exceptions, require owner approval, record counts and propagate erasure/tombstones to applicable stores without silently deleting retained signed/billing evidence. Export the latest erasure journal and explain held, provider-retained or buyer-controlled copies and their owners. Mechanism: [details](docs/contract/mechanism.md).

**Acceptance.**
1. Request client erasure with a held signed engagement and an external document copy.
2. Preview scope, approve eligible deletion, inspect counts and named retained exceptions, verify derived data is removed and test stale restore with the newer journal.

**Evidence.** `src/blotter/erasure-registry.ts`; `src/blotter/retention-clock.ts`; `src/blotter/client-retention.ts`; `src/blotter/erasure-plan.ts`; `src/blotter/erasure-scope.ts`; `src/blotter/client-erasure.ts`; `src/blotter/erasure-expiry.ts`; `src/blotter/erasure-copies.ts`; `src/blotter/erasure-restore.ts`; `src/blotter/engagements.ts`; `src/blotter/retained-records.ts`; `src/ui/retention.tsx`; `src/ui/client-retention.tsx`; `src/ui/client-erasure.tsx`; `migrations/core/0083_client_erasure.sql`; `migrations/core/0084_erasure_policy.sql`; `tests/blotter/erasure-policy.test.mjs`; `tests/blotter/erasure-ui.mjs`; `tests/blotter/erasure-fixture.mjs`; `tests/blotter/archive-transfers.test.mjs`; `src/blotter/marketing-suppression.ts`; `tests/blotter/import-mapping.test.mjs`; `tests/blotter/integration-keys.test.mjs`; `tests/blotter/integration-webhooks.test.mjs`
**Gap.** Landed (sx-blotter-c34 and c35): principal-only doors; typed class registry failing closed; per-class clocks over whole-year periods in the firm's timezone with the warning and SIGN-001 floor; extend-only retain-until; scoped holds with owner and review date refusing ERASURE-001, PORTAL-004 and VAULT-001; open-work refusals; digest-bound preview of every class, approval and one atomic erasure with marker redaction, derived data deleted, signed-off work, engagements and snapshotted billing kept; random labels and the sealed remainder behind the audited retained-records door; Ready to erase confirmation and changed-period recompute; observed and principal-recorded outside copies; hashed withdrawn-address suppression honoured by the mapped import; merged clients; practitioner-recorded signed engagement; deletion-request record; journal export, stale restore refused with the newer journal and the fresh-destination acknowledgment. Not yet to ct's 22 Oct ruling: redaction of the subject's rows in retained import originals through Base's import erasure, with their undo refused; contact-only and prospect-only subjects (only a whole client is erased); the registry is read by preview and erasure but not yet by export and restore; open-balance refusal (BILL-002); IRS e-file authorizations and signed documents have no records until SIGN-001 and SIGN-002 ship; the sign-off note on a signed-off job stays after expiry because sign-off is immutable.

#### ERASURE-004 — Crm-005 for ERASURE-004

Core · target · **partial** · From ERASURE-002 · Cites BASE-DATA-001, BASE-DATA-006, BASE-INPUT-003 · Rules D-1

**Requirement.** Provide crm-005 for ERASURE-004. Mechanism: [details](docs/contract/mechanism.md).

**Acceptance.**
1. CRM-005 intake prospects, answers, consent records and uploads are included in target-erasure previews, retention/hold checks, eligible erasure and stale-archive fencing .

**Evidence.** `src/blotter/erasure-registry.ts`; `src/blotter/retention-clock.ts`; `src/blotter/client-retention.ts`; `src/blotter/erasure-plan.ts`; `src/blotter/erasure-scope.ts`; `src/blotter/client-erasure.ts`; `src/blotter/erasure-expiry.ts`; `src/blotter/erasure-copies.ts`; `src/blotter/erasure-restore.ts`; `src/blotter/engagements.ts`; `src/blotter/retained-records.ts`; `src/ui/retention.tsx`; `src/ui/client-retention.tsx`; `src/ui/client-erasure.tsx`; `migrations/core/0083_client_erasure.sql`; `migrations/core/0084_erasure_policy.sql`; `tests/blotter/erasure-policy.test.mjs`; `tests/blotter/erasure-ui.mjs`; `tests/blotter/erasure-fixture.mjs`; `tests/blotter/archive-transfers.test.mjs`; `src/blotter/marketing-suppression.ts`; `tests/blotter/import-mapping.test.mjs`; `tests/blotter/integration-keys.test.mjs`; `tests/blotter/integration-webhooks.test.mjs`
**Gap.** Landed (sx-blotter-c34 and c35): principal-only doors; typed class registry failing closed; per-class clocks over whole-year periods in the firm's timezone with the warning and SIGN-001 floor; extend-only retain-until; scoped holds with owner and review date refusing ERASURE-001, PORTAL-004 and VAULT-001; open-work refusals; digest-bound preview of every class, approval and one atomic erasure with marker redaction, derived data deleted, signed-off work, engagements and snapshotted billing kept; random labels and the sealed remainder behind the audited retained-records door; Ready to erase confirmation and changed-period recompute; observed and principal-recorded outside copies; hashed withdrawn-address suppression honoured by the mapped import; merged clients; practitioner-recorded signed engagement; deletion-request record; journal export, stale restore refused with the newer journal and the fresh-destination acknowledgment. Not yet to ct's 22 Oct ruling: redaction of the subject's rows in retained import originals through Base's import erasure, with their undo refused; contact-only and prospect-only subjects (only a whole client is erased); the registry is read by preview and erasure but not yet by export and restore; open-balance refusal (BILL-002); IRS e-file authorizations and signed documents have no records until SIGN-001 and SIGN-002 ship; the sign-off note on a signed-off job stays after expiry because sign-off is immutable.

#### ERASURE-005 — Portal-004 for ERASURE-005

Core · target · **partial** · From ERASURE-002 · Cites BASE-AUDIT-001, BASE-DATA-001, BASE-DATA-006 · Rules D-1

**Requirement.** Provide portal-004 for ERASURE-005. Mechanism: [details](docs/contract/mechanism.md).

**Acceptance.**
1. Organizer drafts, submitted originals, supporting request/file custody, source-linked workflow values and still-derived carry join the retention/hold preview and approved target erasure.
2. Apply this clause’s held/signed-record rules, retain named exceptions and attribution/markers, preserve job sign-off, and fence stale restoration .

**Evidence.** `src/blotter/erasure-registry.ts`; `src/blotter/retention-clock.ts`; `src/blotter/client-retention.ts`; `src/blotter/erasure-plan.ts`; `src/blotter/erasure-scope.ts`; `src/blotter/client-erasure.ts`; `src/blotter/erasure-expiry.ts`; `src/blotter/erasure-copies.ts`; `src/blotter/erasure-restore.ts`; `src/blotter/engagements.ts`; `src/blotter/retained-records.ts`; `src/ui/retention.tsx`; `src/ui/client-retention.tsx`; `src/ui/client-erasure.tsx`; `migrations/core/0083_client_erasure.sql`; `migrations/core/0084_erasure_policy.sql`; `tests/blotter/erasure-policy.test.mjs`; `tests/blotter/erasure-ui.mjs`; `tests/blotter/erasure-fixture.mjs`; `tests/blotter/archive-transfers.test.mjs`; `src/blotter/marketing-suppression.ts`; `tests/blotter/import-mapping.test.mjs`; `tests/blotter/integration-keys.test.mjs`; `tests/blotter/integration-webhooks.test.mjs`
**Gap.** Landed (sx-blotter-c34 and c35): principal-only doors; typed class registry failing closed; per-class clocks over whole-year periods in the firm's timezone with the warning and SIGN-001 floor; extend-only retain-until; scoped holds with owner and review date refusing ERASURE-001, PORTAL-004 and VAULT-001; open-work refusals; digest-bound preview of every class, approval and one atomic erasure with marker redaction, derived data deleted, signed-off work, engagements and snapshotted billing kept; random labels and the sealed remainder behind the audited retained-records door; Ready to erase confirmation and changed-period recompute; observed and principal-recorded outside copies; hashed withdrawn-address suppression honoured by the mapped import; merged clients; practitioner-recorded signed engagement; deletion-request record; journal export, stale restore refused with the newer journal and the fresh-destination acknowledgment. Not yet to ct's 22 Oct ruling: redaction of the subject's rows in retained import originals through Base's import erasure, with their undo refused; contact-only and prospect-only subjects (only a whole client is erased); the registry is read by preview and erasure but not yet by export and restore; open-balance refusal (BILL-002); IRS e-file authorizations and signed documents have no records until SIGN-001 and SIGN-002 ship; the sign-off note on a signed-off job stays after expiry because sign-off is immutable.

#### ERASURE-006 — Ready-001

Core · target · **partial** · From ERASURE-002 · Cites BASE-AUDIT-001, BASE-DATA-001, BASE-DATA-006 · Rules D-1

**Requirement.** Provide ready-001. Mechanism: [details](docs/contract/mechanism.md).

**Acceptance.**
1. Native source-linked readiness preparations, approval/decline/reviewer decisions and linked client to-do responses join whole-client retention/hold previews and approved erasure, preserving attribution and stale-restore fencing before this clause ships.

**Evidence.** `src/blotter/erasure-registry.ts`; `src/blotter/retention-clock.ts`; `src/blotter/client-retention.ts`; `src/blotter/erasure-plan.ts`; `src/blotter/erasure-scope.ts`; `src/blotter/client-erasure.ts`; `src/blotter/erasure-expiry.ts`; `src/blotter/erasure-copies.ts`; `src/blotter/erasure-restore.ts`; `src/blotter/engagements.ts`; `src/blotter/retained-records.ts`; `src/ui/retention.tsx`; `src/ui/client-retention.tsx`; `src/ui/client-erasure.tsx`; `migrations/core/0083_client_erasure.sql`; `migrations/core/0084_erasure_policy.sql`; `tests/blotter/erasure-policy.test.mjs`; `tests/blotter/erasure-ui.mjs`; `tests/blotter/erasure-fixture.mjs`; `tests/blotter/archive-transfers.test.mjs`; `src/blotter/marketing-suppression.ts`; `tests/blotter/import-mapping.test.mjs`; `tests/blotter/integration-keys.test.mjs`; `tests/blotter/integration-webhooks.test.mjs`
**Gap.** Landed (sx-blotter-c34 and c35): principal-only doors; typed class registry failing closed; per-class clocks over whole-year periods in the firm's timezone with the warning and SIGN-001 floor; extend-only retain-until; scoped holds with owner and review date refusing ERASURE-001, PORTAL-004 and VAULT-001; open-work refusals; digest-bound preview of every class, approval and one atomic erasure with marker redaction, derived data deleted, signed-off work, engagements and snapshotted billing kept; random labels and the sealed remainder behind the audited retained-records door; Ready to erase confirmation and changed-period recompute; observed and principal-recorded outside copies; hashed withdrawn-address suppression honoured by the mapped import; merged clients; practitioner-recorded signed engagement; deletion-request record; journal export, stale restore refused with the newer journal and the fresh-destination acknowledgment. Not yet to ct's 22 Oct ruling: redaction of the subject's rows in retained import originals through Base's import erasure, with their undo refused; contact-only and prospect-only subjects (only a whole client is erased); the registry is read by preview and erasure but not yet by export and restore; open-balance refusal (BILL-002); IRS e-file authorizations and signed documents have no records until SIGN-001 and SIGN-002 ship; the sign-off note on a signed-off job stays after expiry because sign-off is immutable.

#### ERASURE-007 — Msg-002 marketing consent for ERASURE-007

Core · target · **partial** · From ERASURE-002 · Cites BASE-DATA-006 · Rules D-1

**Requirement.** Provide msg-002 marketing consent for ERASURE-007. Mechanism: [details](docs/contract/mechanism.md).

**Acceptance.**
1. Erasing a client or contact keeps only a hashed suppression record of a withdrawn address, as a named exception.

**Evidence.** `src/blotter/erasure-registry.ts`; `src/blotter/retention-clock.ts`; `src/blotter/client-retention.ts`; `src/blotter/erasure-plan.ts`; `src/blotter/erasure-scope.ts`; `src/blotter/client-erasure.ts`; `src/blotter/erasure-expiry.ts`; `src/blotter/erasure-copies.ts`; `src/blotter/erasure-restore.ts`; `src/blotter/engagements.ts`; `src/blotter/retained-records.ts`; `src/ui/retention.tsx`; `src/ui/client-retention.tsx`; `src/ui/client-erasure.tsx`; `migrations/core/0083_client_erasure.sql`; `migrations/core/0084_erasure_policy.sql`; `tests/blotter/erasure-policy.test.mjs`; `tests/blotter/erasure-ui.mjs`; `tests/blotter/erasure-fixture.mjs`; `tests/blotter/archive-transfers.test.mjs`; `src/blotter/marketing-suppression.ts`; `tests/blotter/import-mapping.test.mjs`; `tests/blotter/integration-keys.test.mjs`; `tests/blotter/integration-webhooks.test.mjs`
**Gap.** Landed (sx-blotter-c34 and c35): principal-only doors; typed class registry failing closed; per-class clocks over whole-year periods in the firm's timezone with the warning and SIGN-001 floor; extend-only retain-until; scoped holds with owner and review date refusing ERASURE-001, PORTAL-004 and VAULT-001; open-work refusals; digest-bound preview of every class, approval and one atomic erasure with marker redaction, derived data deleted, signed-off work, engagements and snapshotted billing kept; random labels and the sealed remainder behind the audited retained-records door; Ready to erase confirmation and changed-period recompute; observed and principal-recorded outside copies; hashed withdrawn-address suppression honoured by the mapped import; merged clients; practitioner-recorded signed engagement; deletion-request record; journal export, stale restore refused with the newer journal and the fresh-destination acknowledgment. Not yet to ct's 22 Oct ruling: redaction of the subject's rows in retained import originals through Base's import erasure, with their undo refused; contact-only and prospect-only subjects (only a whole client is erased); the registry is read by preview and erasure but not yet by export and restore; open-balance refusal (BILL-002); IRS e-file authorizations and signed documents have no records until SIGN-001 and SIGN-002 ship; the sign-off note on a signed-off job stays after expiry because sign-off is immutable.

#### ERASURE-008 — Implemented for ERASURE-008

Core · target · **partial** · From ERASURE-002 · Cites BASE-AGENT-007, BASE-AUDIT-001, BASE-DATA-006, BASE-ROLE-001 · Rules D-1

**Requirement.** Provide implemented for ERASURE-008. Mechanism: [details](docs/contract/mechanism.md).

**Acceptance.**
1. The principal sets periods, places and releases holds, records requests, approves erasure and confirms expiry. An agent's equivalent data changes carry destructive and sensitive under the company's policy, within its sponsor's role; periods and holds remain business constraints on erasure.
2. The registry is typed (`erasure-registry.ts`): every table belongs to one class and a table or byte column without one stops the preview.
3. Retained classes (signed-off work, signed engagements, billing evidence; IRS e-file authorizations and signed documents have no records until SIGN-001 and SIGN-002 ship) carry periods in whole years (default 7, minimum 1, e-file floor 3, with the §6107(b) and Publication 583 warning below 7) and clocks computed from each record's own dates as calendar dates in the firm's time zone; a record past its date appears in Ready to erase and is erased only when the principal confirms, keeping the record, revision, sign-off attribution and SHA-256.

**Evidence.** `src/blotter/erasure-registry.ts`; `src/blotter/retention-clock.ts`; `src/blotter/client-retention.ts`; `src/blotter/erasure-plan.ts`; `src/blotter/erasure-scope.ts`; `src/blotter/client-erasure.ts`; `src/blotter/erasure-expiry.ts`; `src/blotter/erasure-copies.ts`; `src/blotter/erasure-restore.ts`; `src/blotter/engagements.ts`; `src/blotter/retained-records.ts`; `src/ui/retention.tsx`; `src/ui/client-retention.tsx`; `src/ui/client-erasure.tsx`; `migrations/core/0083_client_erasure.sql`; `migrations/core/0084_erasure_policy.sql`; `tests/blotter/erasure-policy.test.mjs`; `tests/blotter/erasure-ui.mjs`; `tests/blotter/erasure-fixture.mjs`; `tests/blotter/archive-transfers.test.mjs`; `src/blotter/marketing-suppression.ts`; `tests/blotter/import-mapping.test.mjs`; `tests/blotter/integration-keys.test.mjs`; `tests/blotter/integration-webhooks.test.mjs`
**Gap.** Landed (sx-blotter-c34 and c35): principal-only doors; typed class registry failing closed; per-class clocks over whole-year periods in the firm's timezone with the warning and SIGN-001 floor; extend-only retain-until; scoped holds with owner and review date refusing ERASURE-001, PORTAL-004 and VAULT-001; open-work refusals; digest-bound preview of every class, approval and one atomic erasure with marker redaction, derived data deleted, signed-off work, engagements and snapshotted billing kept; random labels and the sealed remainder behind the audited retained-records door; Ready to erase confirmation and changed-period recompute; observed and principal-recorded outside copies; hashed withdrawn-address suppression honoured by the mapped import; merged clients; practitioner-recorded signed engagement; deletion-request record; journal export, stale restore refused with the newer journal and the fresh-destination acknowledgment. Not yet to ct's 22 Oct ruling: redaction of the subject's rows in retained import originals through Base's import erasure, with their undo refused; contact-only and prospect-only subjects (only a whole client is erased); the registry is read by preview and erasure but not yet by export and restore; open-balance refusal (BILL-002); IRS e-file authorizations and signed documents have no records until SIGN-001 and SIGN-002 ship; the sign-off note on a signed-off job stays after expiry because sign-off is immutable.

#### ERASURE-009 — Implemented for ERASURE-009

Core · target · **partial** · From ERASURE-002 · Cites BASE-AGENT-007, BASE-AUDIT-001, BASE-DATA-001, BASE-DATA-006, BASE-INPUT-003, BASE-MAIL-001, BASE-ROLE-001 · Rules D-1

**Requirement.** Provide implemented for ERASURE-009. Mechanism: [details](docs/contract/mechanism.md).

**Acceptance.**
1. Holds name scope (client, job, file, signed engagement, approved export, or a record class for one client or the whole firm), reason, owner (the principal or a named reviewer) and review date; retain-until dates can only extend a record's clock.
2. ERASURE-001 (files and engagement letters), PORTAL-004 organizer erasure and VAULT-001 credential erasure are refused inside a hold, naming it.
3. Erasure is refused, naming the records, while the client has an open job, an active recurring rule, a queued message, an open upload, an unanswered organizer request or a pending agent run, and needs an archived client, the preview digest, a reason and the client's name.
4. The receipt names principal-recorded copies and the copies Blotter observes (relay mail, share-link and portal downloads, staff downloads, billing CSVs, owner archives, agent-key reads) with their owners.
5. An older archive restored with the newer journal is refused 409 naming the erasure; a destination without the journal restores only after the principal acknowledges "erasure history unverified: supply your latest erasure journal", recorded in the import report.
6. The mapped marketing import refuses a grant for an address that withdrew before an erasure.

**Evidence.** `src/blotter/erasure-registry.ts`; `src/blotter/retention-clock.ts`; `src/blotter/client-retention.ts`; `src/blotter/erasure-plan.ts`; `src/blotter/erasure-scope.ts`; `src/blotter/client-erasure.ts`; `src/blotter/erasure-expiry.ts`; `src/blotter/erasure-copies.ts`; `src/blotter/erasure-restore.ts`; `src/blotter/engagements.ts`; `src/blotter/retained-records.ts`; `src/ui/retention.tsx`; `src/ui/client-retention.tsx`; `src/ui/client-erasure.tsx`; `migrations/core/0083_client_erasure.sql`; `migrations/core/0084_erasure_policy.sql`; `tests/blotter/erasure-policy.test.mjs`; `tests/blotter/erasure-ui.mjs`; `tests/blotter/erasure-fixture.mjs`; `tests/blotter/archive-transfers.test.mjs`; `src/blotter/marketing-suppression.ts`; `tests/blotter/import-mapping.test.mjs`; `tests/blotter/integration-keys.test.mjs`; `tests/blotter/integration-webhooks.test.mjs`
**Gap.** Landed (sx-blotter-c34 and c35): principal-only doors; typed class registry failing closed; per-class clocks over whole-year periods in the firm's timezone with the warning and SIGN-001 floor; extend-only retain-until; scoped holds with owner and review date refusing ERASURE-001, PORTAL-004 and VAULT-001; open-work refusals; digest-bound preview of every class, approval and one atomic erasure with marker redaction, derived data deleted, signed-off work, engagements and snapshotted billing kept; random labels and the sealed remainder behind the audited retained-records door; Ready to erase confirmation and changed-period recompute; observed and principal-recorded outside copies; hashed withdrawn-address suppression honoured by the mapped import; merged clients; practitioner-recorded signed engagement; deletion-request record; journal export, stale restore refused with the newer journal and the fresh-destination acknowledgment. Not yet to ct's 22 Oct ruling: redaction of the subject's rows in retained import originals through Base's import erasure, with their undo refused; contact-only and prospect-only subjects (only a whole client is erased); the registry is read by preview and erasure but not yet by export and restore; open-balance refusal (BILL-002); IRS e-file authorizations and signed documents have no records until SIGN-001 and SIGN-002 ship; the sign-off note on a signed-off job stays after expiry because sign-off is immutable.

#### ERASURE-010 — Implemented for ERASURE-010

Core · target · **partial** · From ERASURE-002 · Cites BASE-AGENT-007, BASE-DATA-001, BASE-DATA-006 · Rules D-1

**Requirement.** Provide implemented for ERASURE-010. Mechanism: [details](docs/contract/mechanism.md).

**Acceptance.**
1. A practitioner-recorded signed engagement is filed with its signers, signed date and SHA-256 and labelled "practitioner-recorded, not signed through Blotter".
2. ENGAGE-001, SIGN-001, SIGN-002 and INTEGRATE-001 to INTEGRATE-008 inherit the class, clock, hold, preview, receipt and fence obligations stated in the receiving lines (ct patterns 1, 2 and 4).
3. Retention, hold, request, erasure and expiry actions use the principal's authority. An agent's equivalent actions carry destructive and sensitive under the company's policy; people set that policy. A client or contact request records requester, channel, received date, verification note and reason.
4. Subjects are a client with all its contacts, one contact, or a CRM-005 prospect.
5. Every stored record belongs to one class in a typed registry shared by preview, erasure, export and restore; a table, byte store or derived store holding client data without a class blocks the preview.

**Evidence.** `src/blotter/erasure-registry.ts`; `src/blotter/retention-clock.ts`; `src/blotter/client-retention.ts`; `src/blotter/erasure-plan.ts`; `src/blotter/erasure-scope.ts`; `src/blotter/client-erasure.ts`; `src/blotter/erasure-expiry.ts`; `src/blotter/erasure-copies.ts`; `src/blotter/erasure-restore.ts`; `src/blotter/engagements.ts`; `src/blotter/retained-records.ts`; `src/ui/retention.tsx`; `src/ui/client-retention.tsx`; `src/ui/client-erasure.tsx`; `migrations/core/0083_client_erasure.sql`; `migrations/core/0084_erasure_policy.sql`; `tests/blotter/erasure-policy.test.mjs`; `tests/blotter/erasure-ui.mjs`; `tests/blotter/erasure-fixture.mjs`; `tests/blotter/archive-transfers.test.mjs`; `src/blotter/marketing-suppression.ts`; `tests/blotter/import-mapping.test.mjs`; `tests/blotter/integration-keys.test.mjs`; `tests/blotter/integration-webhooks.test.mjs`
**Gap.** Landed (sx-blotter-c34 and c35): principal-only doors; typed class registry failing closed; per-class clocks over whole-year periods in the firm's timezone with the warning and SIGN-001 floor; extend-only retain-until; scoped holds with owner and review date refusing ERASURE-001, PORTAL-004 and VAULT-001; open-work refusals; digest-bound preview of every class, approval and one atomic erasure with marker redaction, derived data deleted, signed-off work, engagements and snapshotted billing kept; random labels and the sealed remainder behind the audited retained-records door; Ready to erase confirmation and changed-period recompute; observed and principal-recorded outside copies; hashed withdrawn-address suppression honoured by the mapped import; merged clients; practitioner-recorded signed engagement; deletion-request record; journal export, stale restore refused with the newer journal and the fresh-destination acknowledgment. Not yet to ct's 22 Oct ruling: redaction of the subject's rows in retained import originals through Base's import erasure, with their undo refused; contact-only and prospect-only subjects (only a whole client is erased); the registry is read by preview and erasure but not yet by export and restore; open-balance refusal (BILL-002); IRS e-file authorizations and signed documents have no records until SIGN-001 and SIGN-002 ship; the sign-off note on a signed-off job stays after expiry because sign-off is immutable.

#### ERASURE-011 — Implemented for ERASURE-011

Core · target · **partial** · From ERASURE-002 · Cites BASE-AUDIT-001, BASE-DATA-001, BASE-ROLE-001 · Rules D-1

**Requirement.** Provide implemented for ERASURE-011. Mechanism: [details](docs/contract/mechanism.md).

**Acceptance.**
1. Retained classes and their clocks, as calendar dates in the firm's timezone: *signed-off work* (the job, status history, checklist outcomes, accepted documents, reviewer and partner notes, sign-off records, recorded agency acknowledgments, and the submitted organizer originals and readiness decisions the job consumed) from the latest of sign-off, the job's due date (extended when an extension is recorded) and the recorded acceptance date; *signed engagements* (practitioner-recorded signed letters now; ENGAGE-001 letters and certificates when shipped) from the later of the signed date and the latest sign-off of the client's jobs dated on or after it; *IRS e-file authorizations* (SIGN-001) from the later of the return due date and the IRS received date; *signed documents* (SIGN-002, when shipped) from completion or the later sign-off of the job they are filed to; *billing evidence* (approved BILL-001 exports and the entries they snapshotted; BILL-002–005 and PAY-001/002 records when shipped) from the latest financial event they support, corrections included.

**Evidence.** `src/blotter/erasure-registry.ts`; `src/blotter/retention-clock.ts`; `src/blotter/client-retention.ts`; `src/blotter/erasure-plan.ts`; `src/blotter/erasure-scope.ts`; `src/blotter/client-erasure.ts`; `src/blotter/erasure-expiry.ts`; `src/blotter/erasure-copies.ts`; `src/blotter/erasure-restore.ts`; `src/blotter/engagements.ts`; `src/blotter/retained-records.ts`; `src/ui/retention.tsx`; `src/ui/client-retention.tsx`; `src/ui/client-erasure.tsx`; `migrations/core/0083_client_erasure.sql`; `migrations/core/0084_erasure_policy.sql`; `tests/blotter/erasure-policy.test.mjs`; `tests/blotter/erasure-ui.mjs`; `tests/blotter/erasure-fixture.mjs`; `tests/blotter/archive-transfers.test.mjs`; `src/blotter/marketing-suppression.ts`; `tests/blotter/import-mapping.test.mjs`; `tests/blotter/integration-keys.test.mjs`; `tests/blotter/integration-webhooks.test.mjs`
**Gap.** Landed (sx-blotter-c34 and c35): principal-only doors; typed class registry failing closed; per-class clocks over whole-year periods in the firm's timezone with the warning and SIGN-001 floor; extend-only retain-until; scoped holds with owner and review date refusing ERASURE-001, PORTAL-004 and VAULT-001; open-work refusals; digest-bound preview of every class, approval and one atomic erasure with marker redaction, derived data deleted, signed-off work, engagements and snapshotted billing kept; random labels and the sealed remainder behind the audited retained-records door; Ready to erase confirmation and changed-period recompute; observed and principal-recorded outside copies; hashed withdrawn-address suppression honoured by the mapped import; merged clients; practitioner-recorded signed engagement; deletion-request record; journal export, stale restore refused with the newer journal and the fresh-destination acknowledgment. Not yet to ct's 22 Oct ruling: redaction of the subject's rows in retained import originals through Base's import erasure, with their undo refused; contact-only and prospect-only subjects (only a whole client is erased); the registry is read by preview and erasure but not yet by export and restore; open-balance refusal (BILL-002); IRS e-file authorizations and signed documents have no records until SIGN-001 and SIGN-002 ship; the sign-off note on a signed-off job stays after expiry because sign-off is immutable.

#### ERASURE-012 — Implemented for ERASURE-012

Core · target · **partial** · From ERASURE-002 · Cites BASE-AGENT-007, BASE-DATA-006, BASE-INPUT-003, BASE-MAIL-001 · Rules D-1

**Requirement.** Provide implemented for ERASURE-012. Mechanism: [details](docs/contract/mechanism.md).

**Acceptance.**
1. Each retained class has a period in whole years (default 7, minimum 1; SIGN-001 minimum 3, as that clause states); below 7 the setting shows IRC §6107(b)'s three years after the close of the return period for preparer return copies and lists, and IRS Publication 583's periods.
2. The principal may set a later retain-until date with a reason on a client, job or record, never an earlier one.
3. A changed period recomputes every unerased record from its own clock and never revives an erased one.
4. Nothing expires or is purged automatically: records past their date appear in a Ready to erase list and are erased only on the principal's confirmation.
5. Every other class (contact personal fields no retained record needs; portal, contact, upload and share links; message and chat bodies; notifications; organizer drafts and unconsumed submissions; CRM-005 prospect answers, consent records and uploads; readiness preparations and client responses no signed-off job consumed; derived AI data; vault credentials; unbilled time descriptions) has no period and is erased on approval.

**Evidence.** `src/blotter/erasure-registry.ts`; `src/blotter/retention-clock.ts`; `src/blotter/client-retention.ts`; `src/blotter/erasure-plan.ts`; `src/blotter/erasure-scope.ts`; `src/blotter/client-erasure.ts`; `src/blotter/erasure-expiry.ts`; `src/blotter/erasure-copies.ts`; `src/blotter/erasure-restore.ts`; `src/blotter/engagements.ts`; `src/blotter/retained-records.ts`; `src/ui/retention.tsx`; `src/ui/client-retention.tsx`; `src/ui/client-erasure.tsx`; `migrations/core/0083_client_erasure.sql`; `migrations/core/0084_erasure_policy.sql`; `tests/blotter/erasure-policy.test.mjs`; `tests/blotter/erasure-ui.mjs`; `tests/blotter/erasure-fixture.mjs`; `tests/blotter/archive-transfers.test.mjs`; `src/blotter/marketing-suppression.ts`; `tests/blotter/import-mapping.test.mjs`; `tests/blotter/integration-keys.test.mjs`; `tests/blotter/integration-webhooks.test.mjs`
**Gap.** Landed (sx-blotter-c34 and c35): principal-only doors; typed class registry failing closed; per-class clocks over whole-year periods in the firm's timezone with the warning and SIGN-001 floor; extend-only retain-until; scoped holds with owner and review date refusing ERASURE-001, PORTAL-004 and VAULT-001; open-work refusals; digest-bound preview of every class, approval and one atomic erasure with marker redaction, derived data deleted, signed-off work, engagements and snapshotted billing kept; random labels and the sealed remainder behind the audited retained-records door; Ready to erase confirmation and changed-period recompute; observed and principal-recorded outside copies; hashed withdrawn-address suppression honoured by the mapped import; merged clients; practitioner-recorded signed engagement; deletion-request record; journal export, stale restore refused with the newer journal and the fresh-destination acknowledgment. Not yet to ct's 22 Oct ruling: redaction of the subject's rows in retained import originals through Base's import erasure, with their undo refused; contact-only and prospect-only subjects (only a whole client is erased); the registry is read by preview and erasure but not yet by export and restore; open-balance refusal (BILL-002); IRS e-file authorizations and signed documents have no records until SIGN-001 and SIGN-002 ship; the sign-off note on a signed-off job stays after expiry because sign-off is immutable.

#### ERASURE-013 — Implemented for ERASURE-013

Core · target · **partial** · From ERASURE-002 · Cites BASE-AGENT-007, BASE-AUDIT-001, BASE-DATA-006, BASE-INPUT-003, BASE-ROLE-001 · Rules D-1

**Requirement.** Provide implemented for ERASURE-013. Mechanism: [details](docs/contract/mechanism.md).

**Acceptance.**
1. A hold names its scope (a client, a job, or a record class for one client or the whole firm), reason, hold owner (the principal or a named reviewer) and review date, which shows as due on the retention page; no reminder is sent.
2. Everything in scope is preserved: erasure leaves it as a held exception naming the hold, Ready to erase skips it, and ERASURE-001 file erasure, PORTAL-004 answer erasure and VAULT-001 credential erasure inside the scope are refused naming the hold; only access revocation runs under a hold.
3. Release is an attributed principal action; released records then follow their own clocks.
4. Client erasure is refused, naming the records, while the subject has an open (not signed-off or cancelled) job, an active recurring rule, a queued or scheduled message, an open upload or organizer request, a pending client agent run, or (when BILL-002 ships) an open balance.
5. A dry-run preview lists every class with its action (removed; payload replaced by the erasure marker; retained with class, clock and expiry; held with the hold; or outside copy with its owner) and its count.

**Evidence.** `src/blotter/erasure-registry.ts`; `src/blotter/retention-clock.ts`; `src/blotter/client-retention.ts`; `src/blotter/erasure-plan.ts`; `src/blotter/erasure-scope.ts`; `src/blotter/client-erasure.ts`; `src/blotter/erasure-expiry.ts`; `src/blotter/erasure-copies.ts`; `src/blotter/erasure-restore.ts`; `src/blotter/engagements.ts`; `src/blotter/retained-records.ts`; `src/ui/retention.tsx`; `src/ui/client-retention.tsx`; `src/ui/client-erasure.tsx`; `migrations/core/0083_client_erasure.sql`; `migrations/core/0084_erasure_policy.sql`; `tests/blotter/erasure-policy.test.mjs`; `tests/blotter/erasure-ui.mjs`; `tests/blotter/erasure-fixture.mjs`; `tests/blotter/archive-transfers.test.mjs`; `src/blotter/marketing-suppression.ts`; `tests/blotter/import-mapping.test.mjs`; `tests/blotter/integration-keys.test.mjs`; `tests/blotter/integration-webhooks.test.mjs`
**Gap.** Landed (sx-blotter-c34 and c35): principal-only doors; typed class registry failing closed; per-class clocks over whole-year periods in the firm's timezone with the warning and SIGN-001 floor; extend-only retain-until; scoped holds with owner and review date refusing ERASURE-001, PORTAL-004 and VAULT-001; open-work refusals; digest-bound preview of every class, approval and one atomic erasure with marker redaction, derived data deleted, signed-off work, engagements and snapshotted billing kept; random labels and the sealed remainder behind the audited retained-records door; Ready to erase confirmation and changed-period recompute; observed and principal-recorded outside copies; hashed withdrawn-address suppression honoured by the mapped import; merged clients; practitioner-recorded signed engagement; deletion-request record; journal export, stale restore refused with the newer journal and the fresh-destination acknowledgment. Not yet to ct's 22 Oct ruling: redaction of the subject's rows in retained import originals through Base's import erasure, with their undo refused; contact-only and prospect-only subjects (only a whole client is erased); the registry is read by preview and erasure but not yet by export and restore; open-balance refusal (BILL-002); IRS e-file authorizations and signed documents have no records until SIGN-001 and SIGN-002 ship; the sign-off note on a signed-off job stays after expiry because sign-off is immutable.

#### ERASURE-014 — Implemented for ERASURE-014

Core · target · **partial** · From ERASURE-002 · Cites BASE-AGENT-007, BASE-AUDIT-001, BASE-DATA-006, BASE-INPUT-003, BASE-MAIL-001, BASE-ROLE-001 · Rules D-1

**Requirement.** Provide implemented for ERASURE-014. Mechanism: [details](docs/contract/mechanism.md).

**Acceptance.**
1. Execution needs the preview digest, a reason and the client's name typed; a changed preview is refused as stale; it runs in one atomic batch with Base's redaction journal and returns the receipt and one audit event.
2. It revokes portal, contact, upload and share links and removes the client from every API-002 key's client scope (a key scoped to that client alone is suspended); removes contact emails, phones and addresses, keeping only MSG-002's hashed suppression record of a withdrawn address; removes vault ciphertext, usernames and notes, keeping the reveal log under opaque labels; replaces message, chat, notification, organizer, prospect, readiness-response and unbilled-time text and unaccepted attachments with the marker while keeping ids, threads, authors, times, revisions, review attribution and delivery outcomes; deletes derived AI data (readiness preparations, agent plans, outputs and source excerpts, summaries and search entries), keeping run and decision ids, actors, times and outcomes; redacts the subject's rows in retained import originals through Base's import erasure and refuses their undo, naming the erasure; and leaves every retained or held record unchanged, including job sign-off and approved billing bytes.

**Evidence.** `src/blotter/erasure-registry.ts`; `src/blotter/retention-clock.ts`; `src/blotter/client-retention.ts`; `src/blotter/erasure-plan.ts`; `src/blotter/erasure-scope.ts`; `src/blotter/client-erasure.ts`; `src/blotter/erasure-expiry.ts`; `src/blotter/erasure-copies.ts`; `src/blotter/erasure-restore.ts`; `src/blotter/engagements.ts`; `src/blotter/retained-records.ts`; `src/ui/retention.tsx`; `src/ui/client-retention.tsx`; `src/ui/client-erasure.tsx`; `migrations/core/0083_client_erasure.sql`; `migrations/core/0084_erasure_policy.sql`; `tests/blotter/erasure-policy.test.mjs`; `tests/blotter/erasure-ui.mjs`; `tests/blotter/erasure-fixture.mjs`; `tests/blotter/archive-transfers.test.mjs`; `src/blotter/marketing-suppression.ts`; `tests/blotter/import-mapping.test.mjs`; `tests/blotter/integration-keys.test.mjs`; `tests/blotter/integration-webhooks.test.mjs`
**Gap.** Landed (sx-blotter-c34 and c35): principal-only doors; typed class registry failing closed; per-class clocks over whole-year periods in the firm's timezone with the warning and SIGN-001 floor; extend-only retain-until; scoped holds with owner and review date refusing ERASURE-001, PORTAL-004 and VAULT-001; open-work refusals; digest-bound preview of every class, approval and one atomic erasure with marker redaction, derived data deleted, signed-off work, engagements and snapshotted billing kept; random labels and the sealed remainder behind the audited retained-records door; Ready to erase confirmation and changed-period recompute; observed and principal-recorded outside copies; hashed withdrawn-address suppression honoured by the mapped import; merged clients; practitioner-recorded signed engagement; deletion-request record; journal export, stale restore refused with the newer journal and the fresh-destination acknowledgment. Not yet to ct's 22 Oct ruling: redaction of the subject's rows in retained import originals through Base's import erasure, with their undo refused; contact-only and prospect-only subjects (only a whole client is erased); the registry is read by preview and erasure but not yet by export and restore; open-balance refusal (BILL-002); IRS e-file authorizations and signed documents have no records until SIGN-001 and SIGN-002 ship; the sign-off note on a signed-off job stays after expiry because sign-off is immutable.

#### ERASURE-015 — Implemented for ERASURE-015

Core · target · **partial** · From ERASURE-002 · Cites BASE-AGENT-007, BASE-AUDIT-001, BASE-DATA-001, BASE-DATA-006, BASE-MAIL-001 · Rules D-1

**Requirement.** Provide implemented for ERASURE-015. Mechanism: [details](docs/contract/mechanism.md).

**Acceptance.**
1. On ordinary surfaces the client and its contacts become `Erased client <8 hex>` and `Erased contact <8 hex>` (random, not derived from any id); the legal name, taxpayer identifier and address a retained record needs stay only on that record, which the principal reads and exports through an audited retained-records door, absent from lists, search, reports, notifications, portal, API, agent context and plain exports.
2. When the principal confirms a Ready to erase item, its bytes and personal fields are removed, keeping record, kind, number, totals, revision, sign-off attribution and SHA-256.
3. AUDIT-001 rows are never removed: only this workflow replaces the subject's declared personal values in snapshots and free text with the marker, keeping actor, action, object, time and erasure reasons; Activity shows "values removed by erasure <id> on <date>", and nothing rebuilds them.
4. The receipt and the journal hold no erased value.

**Evidence.** `src/blotter/erasure-registry.ts`; `src/blotter/retention-clock.ts`; `src/blotter/client-retention.ts`; `src/blotter/erasure-plan.ts`; `src/blotter/erasure-scope.ts`; `src/blotter/client-erasure.ts`; `src/blotter/erasure-expiry.ts`; `src/blotter/erasure-copies.ts`; `src/blotter/erasure-restore.ts`; `src/blotter/engagements.ts`; `src/blotter/retained-records.ts`; `src/ui/retention.tsx`; `src/ui/client-retention.tsx`; `src/ui/client-erasure.tsx`; `migrations/core/0083_client_erasure.sql`; `migrations/core/0084_erasure_policy.sql`; `tests/blotter/erasure-policy.test.mjs`; `tests/blotter/erasure-ui.mjs`; `tests/blotter/erasure-fixture.mjs`; `tests/blotter/archive-transfers.test.mjs`; `src/blotter/marketing-suppression.ts`; `tests/blotter/import-mapping.test.mjs`; `tests/blotter/integration-keys.test.mjs`; `tests/blotter/integration-webhooks.test.mjs`
**Gap.** Landed (sx-blotter-c34 and c35): principal-only doors; typed class registry failing closed; per-class clocks over whole-year periods in the firm's timezone with the warning and SIGN-001 floor; extend-only retain-until; scoped holds with owner and review date refusing ERASURE-001, PORTAL-004 and VAULT-001; open-work refusals; digest-bound preview of every class, approval and one atomic erasure with marker redaction, derived data deleted, signed-off work, engagements and snapshotted billing kept; random labels and the sealed remainder behind the audited retained-records door; Ready to erase confirmation and changed-period recompute; observed and principal-recorded outside copies; hashed withdrawn-address suppression honoured by the mapped import; merged clients; practitioner-recorded signed engagement; deletion-request record; journal export, stale restore refused with the newer journal and the fresh-destination acknowledgment. Not yet to ct's 22 Oct ruling: redaction of the subject's rows in retained import originals through Base's import erasure, with their undo refused; contact-only and prospect-only subjects (only a whole client is erased); the registry is read by preview and erasure but not yet by export and restore; open-balance refusal (BILL-002); IRS e-file authorizations and signed documents have no records until SIGN-001 and SIGN-002 ship; the sign-off note on a signed-off job stays after expiry because sign-off is immutable.

#### ERASURE-016 — Implemented for ERASURE-016

Core · target · **partial** · From ERASURE-002 · Cites BASE-AUDIT-001, BASE-DATA-001, BASE-DATA-006, BASE-MAIL-001, BASE-ROLE-001 · Rules D-1

**Requirement.** Provide implemented for ERASURE-016. Mechanism: [details](docs/contract/mechanism.md).

**Acceptance.**
1. The receipt gives per-class counts of rows removed, fields replaced, audit values replaced, links revoked, keys rescoped or suspended, items retained (with expiry) and items held (with hold id), and names every outside copy and its owner: mail delivered through the platform relay (provider-retained) and recipients' mailboxes (recipient-controlled); files downloaded through share links or the portal (recipient-controlled); billing CSVs and archives downloaded by staff (the named downloader); owner archives handed to a successor or buyer of the practice (buyer-controlled, recipient named by the principal); data read by API-002 keys (key label and creator); and external copies the principal records with location, owner and note (labelled principal-recorded).
2. Blotter never claims their deletion.
3. The principal exports the latest erasure journal.
4. Restoring an archive made before an erasure is refused, naming the erasure, when the destination knows it or the newer journal is supplied (ERASURE-001's fence); a fresh destination without it restores only after the principal acknowledges "erasure history unverified: supply your latest erasure journal", recorded in the import report.

**Evidence.** `src/blotter/erasure-registry.ts`; `src/blotter/retention-clock.ts`; `src/blotter/client-retention.ts`; `src/blotter/erasure-plan.ts`; `src/blotter/erasure-scope.ts`; `src/blotter/client-erasure.ts`; `src/blotter/erasure-expiry.ts`; `src/blotter/erasure-copies.ts`; `src/blotter/erasure-restore.ts`; `src/blotter/engagements.ts`; `src/blotter/retained-records.ts`; `src/ui/retention.tsx`; `src/ui/client-retention.tsx`; `src/ui/client-erasure.tsx`; `migrations/core/0083_client_erasure.sql`; `migrations/core/0084_erasure_policy.sql`; `tests/blotter/erasure-policy.test.mjs`; `tests/blotter/erasure-ui.mjs`; `tests/blotter/erasure-fixture.mjs`; `tests/blotter/archive-transfers.test.mjs`; `src/blotter/marketing-suppression.ts`; `tests/blotter/import-mapping.test.mjs`; `tests/blotter/integration-keys.test.mjs`; `tests/blotter/integration-webhooks.test.mjs`
**Gap.** Landed (sx-blotter-c34 and c35): principal-only doors; typed class registry failing closed; per-class clocks over whole-year periods in the firm's timezone with the warning and SIGN-001 floor; extend-only retain-until; scoped holds with owner and review date refusing ERASURE-001, PORTAL-004 and VAULT-001; open-work refusals; digest-bound preview of every class, approval and one atomic erasure with marker redaction, derived data deleted, signed-off work, engagements and snapshotted billing kept; random labels and the sealed remainder behind the audited retained-records door; Ready to erase confirmation and changed-period recompute; observed and principal-recorded outside copies; hashed withdrawn-address suppression honoured by the mapped import; merged clients; practitioner-recorded signed engagement; deletion-request record; journal export, stale restore refused with the newer journal and the fresh-destination acknowledgment. Not yet to ct's 22 Oct ruling: redaction of the subject's rows in retained import originals through Base's import erasure, with their undo refused; contact-only and prospect-only subjects (only a whole client is erased); the registry is read by preview and erasure but not yet by export and restore; open-balance refusal (BILL-002); IRS e-file authorizations and signed documents have no records until SIGN-001 and SIGN-002 ship; the sign-off note on a signed-off job stays after expiry because sign-off is immutable.

#### ERASURE-017 — Implemented for ERASURE-017

Core · target · **partial** · From ERASURE-002 · Rules D-1

**Requirement.** Provide implemented for ERASURE-017. Mechanism: [details](docs/contract/mechanism.md).

**Acceptance.**
1. A signed engagement may be practitioner-recorded: the principal files a signed letter to the client with its signers and signed date, labelled "practitioner-recorded, not signed through Blotter", with its SHA-256.
2. ENGAGE-001, SIGN-001, SIGN-002 and INTEGRATE-001–008 add their own records and provider copies to these classes .
3. No legal adequacy of any period or of anonymization is asserted.

**Evidence.** `src/blotter/erasure-registry.ts`; `src/blotter/retention-clock.ts`; `src/blotter/client-retention.ts`; `src/blotter/erasure-plan.ts`; `src/blotter/erasure-scope.ts`; `src/blotter/client-erasure.ts`; `src/blotter/erasure-expiry.ts`; `src/blotter/erasure-copies.ts`; `src/blotter/erasure-restore.ts`; `src/blotter/engagements.ts`; `src/blotter/retained-records.ts`; `src/ui/retention.tsx`; `src/ui/client-retention.tsx`; `src/ui/client-erasure.tsx`; `migrations/core/0083_client_erasure.sql`; `migrations/core/0084_erasure_policy.sql`; `tests/blotter/erasure-policy.test.mjs`; `tests/blotter/erasure-ui.mjs`; `tests/blotter/erasure-fixture.mjs`; `tests/blotter/archive-transfers.test.mjs`; `src/blotter/marketing-suppression.ts`; `tests/blotter/import-mapping.test.mjs`; `tests/blotter/integration-keys.test.mjs`; `tests/blotter/integration-webhooks.test.mjs`
**Gap.** Landed (sx-blotter-c34 and c35): principal-only doors; typed class registry failing closed; per-class clocks over whole-year periods in the firm's timezone with the warning and SIGN-001 floor; extend-only retain-until; scoped holds with owner and review date refusing ERASURE-001, PORTAL-004 and VAULT-001; open-work refusals; digest-bound preview of every class, approval and one atomic erasure with marker redaction, derived data deleted, signed-off work, engagements and snapshotted billing kept; random labels and the sealed remainder behind the audited retained-records door; Ready to erase confirmation and changed-period recompute; observed and principal-recorded outside copies; hashed withdrawn-address suppression honoured by the mapped import; merged clients; practitioner-recorded signed engagement; deletion-request record; journal export, stale restore refused with the newer journal and the fresh-destination acknowledgment. Not yet to ct's 22 Oct ruling: redaction of the subject's rows in retained import originals through Base's import erasure, with their undo refused; contact-only and prospect-only subjects (only a whole client is erased); the registry is read by preview and erasure but not yet by export and restore; open-balance refusal (BILL-002); IRS e-file authorizations and signed documents have no records until SIGN-001 and SIGN-002 ship; the sign-off note on a signed-off job stays after expiry because sign-off is immutable.

#### AUDIT-001 — Durable action attribution

Core · target · **partial** · Cites BASE-AUDIT-001, BASE-DATA-001, BASE-DATA-006, BASE-INPUT-003 · Rules D-1

**Requirement.** Product mutations retain actor, action, object and timestamp, including reviewer notes, human proposal decisions, billing approvals and erasure reasons. The principal can inspect the action history; archive round trips preserve it. Portal actions are labeled as upload-link actions rather than falsely attributed to a verified named client.

**Acceptance.**
1. Create and review work, approve a proposal/export and erase a file through public doors.
2. Read the owner action history, compare attribution with the actors and inspect retained audit rows after an archive round trip.

**Evidence.** `src/blotter/model.ts`; `src/blotter/team.ts`; `src/blotter/archive.ts`; `tests/blotter/flows.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Create; review work; approve a proposal/export; erase a file through public doors; Read the owner action history; compare attribution with the actors; inspect retained audit rows after an archive round trip.

#### AUDIT-002 — Msg-002 marketing consent for AUDIT-002

Core · target · **partial** · From AUDIT-001 · Cites BASE-AUDIT-001 · Rules D-1

**Requirement.** Provide msg-002 marketing consent for AUDIT-002.

**Acceptance.**
1. Consent events and owner corrections are attributed with their actor and time.

**Evidence.** `src/blotter/model.ts`; `src/blotter/team.ts`; `src/blotter/archive.ts`; `tests/blotter/flows.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Consent events; owner corrections are attributed with their actor; time.

#### AUDIT-003 — Erasure-002 for AUDIT-003

Core · target · **partial** · From AUDIT-001 · Cites BASE-AUDIT-001, BASE-DATA-006 · Rules D-1

**Requirement.** Provide erasure-002 for AUDIT-003.

**Acceptance.**
1. The one exception to unchanged history is ERASURE-002's marker replacement of an erased subject's declared personal values; every row's actor, action, object, time and reason stay.

**Evidence.** `src/blotter/model.ts`; `src/blotter/team.ts`; `src/blotter/archive.ts`; `tests/blotter/flows.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: The one exception to unchanged history is ERASURE-002's marker replacement of an erased subject's declared personal values; every row's actor; action; object; time; reason stay.

#### BASE-001 — Maintained Base foundations and product replacements

Core · target · **partial** · Cites BASE-AGENT-007, BASE-AUDIT-001, BASE-DATA-001, BASE-DATA-006, BASE-INPUT-003, BASE-MAIL-001, BASE-ROLE-001, BASE-SIGNIN-002 · Rules D-1

**Requirement.** Blotter owns practice roles, guarded writes, request-upload links, independent review, snapshotted time, approved billing exports and human-agent decisions as explicit product extensions.  Native sign-in and MFA, staff/contact authority, mail-backed upload links, legacy and mapped imports, document sharing, intake files, human decisions and native archives retain these foundations.

**Acceptance.**
1. Use native sign-in, import a client list, collect a file, review work, approve a billing export and archive/erase/restore through public doors.
2. Inspect staff/key and contact/share revocation, attributed decisions, retained file/import bytes and approved CSVs, denied stale restores and excluded document-share tokens.
3. Future carriers repeat the inherited activation gate on their own paths; their full capabilities remain required under their own clauses.

**Evidence.** `src/auth.server.ts`; `src/blotter/model.ts`; `src/blotter/imports.ts`; `src/blotter/archive.ts`; `tests/blotter/flows.test.mjs`; `tests/blotter/import-mapping.test.mjs`; `tests/blotter/contacts.test.mjs`; `tests/blotter/document-sharing.test.mjs`; `tests/blotter/intake.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Use native sign-in; import a client list; collect a file; review work; approve a billing export; archive/erase/restore through public doors; Inspect staff/key; contact/share revocation; attributed decisions; retained file/import bytes; approved CSVs; denied stale restores; excluded document-share tokens; Future carriers repeat the inherited activation gate on their own paths; their full capabilities remain required under their own clauses.

#### BASE-002 — Msg-002 marketing consent for BASE-002

Core · target · **partial** · From BASE-001 · Rules D-1

**Requirement.** Provide msg-002 marketing consent for BASE-002.

**Acceptance.**
1. The activation gate stays on MSG-002.

**Evidence.** `src/auth.server.ts`; `src/blotter/model.ts`; `src/blotter/imports.ts`; `src/blotter/archive.ts`; `tests/blotter/flows.test.mjs`; `tests/blotter/import-mapping.test.mjs`; `tests/blotter/contacts.test.mjs`; `tests/blotter/document-sharing.test.mjs`; `tests/blotter/intake.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: The activation gate stays on MSG-002.

#### BASE-003 — Activation gate

Core · target · **partial** · From BASE-001 · Cites BASE-AGENT-007, BASE-AUDIT-001, BASE-DATA-001, BASE-DATA-006, BASE-MAIL-001, BASE-ROLE-001 · Rules D-1

**Requirement.** Provide activation gate.

**Acceptance.**
1. Every new identity, provider grant, storage path or scheduled/event action preserves current authority, revocation, attribution, erasure and portability guarantees.
2. Before activation its carrier clause supplies named public-door evidence for permission denial, revocation, audit attribution, archive/restore integrity and documented authority exclusions, plus erasure and stale-restore refusal for stored data.
3. Replacing a foundation carries the same gate.
4. Future carriers are ENGAGE-001, SIGN-001, SIGN-002, AUTHZ-001, DUE-001, DUE-003, RESOLVE-001, MAIL-001, MAIL-002, MAIL-003, MSG-002, SMS-001, NOTIFY-001, PORTAL-002, PORTAL-004, PORTAL-005, MOBILE-001, DOC-001, FOLLOWUP-001, LEDGER-001, LEDGER-002, LEDGER-003, BILL-002, PAY-001, PAY-002, BILL-003, BILL-004, BILL-005, REPORT-001, INTEGRATE-001, INTEGRATE-002, INTEGRATE-003, INTEGRATE-004, INTEGRATE-005, INTEGRATE-006, INTEGRATE-007, INTEGRATE-008, API-002, AUTOMATE-001, MIGRATE-001, MIGRATE-002, MIGRATE-003, MIGRATE-004, MIGRATE-005, MIGRATE-006, MIGRATE-007, ACCESS-002, ACCESS-003, ACCESS-005, SECURE-001, VAULT-001, ARCHIVE-002, ERASURE-002, COST-001, AI-001, AI-002, AI-003, READY-001, RESCUE-001, LEARN-001, REVENUE-001, ONBOARD-001, SWITCH-001, NOTICE-001.

**Evidence.** `src/auth.server.ts`; `src/blotter/model.ts`; `src/blotter/imports.ts`; `src/blotter/archive.ts`; `tests/blotter/flows.test.mjs`; `tests/blotter/import-mapping.test.mjs`; `tests/blotter/contacts.test.mjs`; `tests/blotter/document-sharing.test.mjs`; `tests/blotter/intake.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Every new identity; provider grant; storage path or scheduled/event action preserves current authority; revocation; attribution; erasure; portability guarantees; Before activation its carrier clause supplies named public-door evidence for permission denial; audit attribution; archive/restore integrity; documented authority exclusions; plus erasure; stale-restore refusal for stored data; Replacing a foundation carries the same gate; Future carriers are ENGAGE-001; SIGN-001; SIGN-002; AUTHZ-001; DUE-001; DUE-003; RESOLVE-001; MAIL-001; MAIL-002; MAIL-003; MSG-002; SMS-001; NOTIFY-001; PORTAL-002; PORTAL-004; PORTAL-005; MOBILE-001; DOC-001; FOLLOWUP-001; LEDGER-001; LEDGER-002; LEDGER-003; BILL-002; PAY-001; PAY-002; BILL-003; BILL-004; BILL-005; REPORT-001; INTEGRATE-001; INTEGRATE-002; INTEGRATE-003; INTEGRATE-004; INTEGRATE-005; INTEGRATE-006; INTEGRATE-007; INTEGRATE-008; API-002; AUTOMATE-001; MIGRATE-001; MIGRATE-002; MIGRATE-003; MIGRATE-004; MIGRATE-005; MIGRATE-006; MIGRATE-007; ACCESS-002; ACCESS-003; ACCESS-005; SECURE-001; VAULT-001; ARCHIVE-002; ERASURE-002; COST-001; AI-001; AI-002; AI-003; READY-001; RESCUE-001; LEARN-001; REVENUE-001; ONBOARD-001; SWITCH-001; NOTICE-001.

#### COST-001 — Predictable USD service and usage costs

Core · target · **partial** · Cites BASE-AGENT-007, BASE-AUDIT-001, BASE-DATA-001 · Rules D-1

**Requirement.** Show USD subscription, seats, storage, AI usage, signature/KBA, payment and SMS costs with included quantities and provider charges before enabling paid functions. The company's policy sets optional AI activity budgets and approval thresholds; hitting a limit creates an owned exception without hiding a deadline, losing evidence or dropping a chase. Usage history reconciles to actions and offers an explicit upgrade/export path.

**Acceptance.**
1. Estimate a tax-season workspace with signatures, scanning/AI, messages and ACH/card payments, enable it and reconcile metered usage with displayed USD costs.
2. Hit an optional-action budget, inspect the blocked action/owner notice and approve an increase without duplicate effects.

**Evidence.** `src/blotter/costs.ts`; `src/ui/service-costs.tsx`; `tests/blotter/service-agents.test.mjs`
**Gap.** Sourced USD estimates, quote history, principal-approved lifetime/per-action budgets, owned exceptions, native-plan reservations, explicit reconciliation and usage export exist. Full enabled-service/provider reconciliation remains unproved: SIGN-001 KBA, SMS-001 sender and PAY-001 ACH/card capabilities are unavailable; AI inference is not activated. No provider charges are fabricated.

### Assistance and governed automation

#### AI-001 — Source linked summaries and reply drafts

Core · target · **partial** · Cites BASE-AUDIT-001, BASE-MAIL-001, BASE-ROLE-001 · Rules D-1

**Requirement.** Summarize authorized client email, portal discussions and engagement history with source links, dates, open questions and conflicting evidence. Draft replies in the staff member's voice and current signed scope; the company's policy for external and sensitive decides whether a person reviews recipients, attachments and wording before sending. Private and internal material stays excluded and missing context remains explicit.

**Acceptance.**
1. Under the held company policy, summarize a long email or portal thread with conflicting amounts, inspect source links and unresolved questions, edit a reply and approve its exact recipients and attachments.
2. Under the held company policy, reject another draft and confirm no send or unauthorized client information.

**Evidence.** `tests/blotter/ai.test.mjs`; `tests/blotter/ai-live.mjs`
**Gap.** MAIL-001 real Google and Microsoft mailbox grants and ENGAGE-001 signed-scope links remain unavailable. Acceptance records review and never sends a message. Existing native preparations use fixed person-only decisions; company-policy class computation and execution through the shared registry remain unproved.

#### AI-004 — Erasure-002 for AI-004

Core · target · **partial** · From AI-001 · Cites BASE-AGENT-007, BASE-DATA-001, BASE-DATA-006 · Rules D-1

**Requirement.** Provide erasure-002 for AI-004.

**Acceptance.**
1. AI-001 adds its records and provider copies to ERASURE-002's classes, clocks, holds, preview, erasure, receipt and restore fence.

**Evidence.** `tests/blotter/ai.test.mjs`; `tests/blotter/ai-live.mjs`
**Gap.** MAIL-001 real Google and Microsoft mailbox grants and ENGAGE-001 signed-scope links remain unavailable. Acceptance records review and never sends a message. Existing native preparations use fixed person-only decisions; company-policy class computation and execution through the shared registry remain unproved.

#### AI-005 — Approved processing boundary

Core · target · **partial** · From AI-001 · Cites BASE-AGENT-007, BASE-DATA-006 · Rules D-1

**Requirement.** Provide approved processing boundary. This part applies RL-4.

**Acceptance.**
1. Firm-owner enablement is off by default and requires a recorded provider no-training and no-retention attestation reference.
2. Selected source text is masked for tax identifiers, SSNs and bank numbers; transmitting it carries external and sensitive, which the company's policy decides.
3. Retain input hash and source identifiers rather than input content; record requester, source identifiers, provider, model, bytes and time once per request.
4. Provider output persists only as a draft the person saves.
5. The portal disclosure states that staff may use an AI provider on client documents.

**Evidence.** `tests/blotter/ai.test.mjs`; `tests/blotter/ai-live.mjs`
**Gap.** MAIL-001 real Google and Microsoft mailbox grants and ENGAGE-001 signed-scope links remain unavailable. Acceptance records review and never sends a message. Existing native preparations use fixed person-only decisions; company-policy class computation and execution through the shared registry remain unproved.

#### AI-006 — Processing

Core · target · **partial** · From AI-001 · Cites BASE-AGENT-007, BASE-AUDIT-001, BASE-DATA-001, BASE-DATA-006, BASE-INPUT-003 · Rules D-1

**Requirement.** Provide processing.

**Acceptance.**
1. The principal records the provider attestation reference, request budget and document review threshold.
2. Each selected-source request reserves that budget before a single call through the existing provider module.
3. Only saved output persists; current staff and source access are checked again after processing and on every saved-draft decision.
4. Archives carry attributed history with enablement disabled; derived AI drafts obey retention holds, preview, erasure and stale restore fencing.
5. Provider processing is listed as an observed outside copy under the recorded agreement, never as verified provider deletion.
6. The native source is one selected portal conversation or uploaded document.
7. Questions and conflicts retain the selected source link.
8. The staff member can edit and accept or reject a saved reply; acceptance records review and sends nothing.

**Evidence.** `tests/blotter/ai.test.mjs`; `tests/blotter/ai-live.mjs`
**Gap.** MAIL-001 real Google and Microsoft mailbox grants and ENGAGE-001 signed-scope links remain unavailable. Acceptance records review and never sends a message. Existing native preparations use fixed person-only decisions; company-policy class computation and execution through the shared registry remain unproved.

#### AI-002 — Document validation naming and routing

Core · target · **partial** · Cites BASE-AGENT-007, BASE-INPUT-003, BASE-ROLE-001 · Rules D-1

**Requirement.** An assistant validates uploaded type, client, period and legibility against requests, proposes consistent names and folders and routes a copy while preserving original bytes and provenance. Readings carry evidence and confidence, including ambiguity, mismatch and suspicious content; the company's policy for standard, sensitive and external decides whether they fill fields, route a copy or wait for a person. Text embedded in documents is data and cannot authorize a tool action.

**Acceptance.**
1. Upload a wrong-period statement, illegible scan and correct invoice with misleading embedded instructions.
2. Under the held company policy, inspect sourced validation/naming/routing proposals, approve one and reject another; originals persist and no file changes client or visibility without authority.

**Evidence.** `tests/blotter/ai.test.mjs`; `tests/blotter/ai-live.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Upload a wrong-period statement; illegible scan; correct invoice with misleading embedded instructions; Under the held company policy; inspect sourced validation/naming/routing proposals; approve one; reject another; originals persist; no file changes client or visibility without authority. Existing preparations use fixed person-only decisions; company-policy class computation and execution through the shared registry remain unproved.

#### AI-007 — Erasure-002 for AI-007

Core · target · **partial** · From AI-002 · Cites BASE-AGENT-007, BASE-DATA-001, BASE-DATA-006 · Rules D-1

**Requirement.** Provide erasure-002 for AI-007.

**Acceptance.**
1. AI-002 adds its records and provider copies to ERASURE-002's classes, clocks, holds, preview, erasure, receipt and restore fence.

**Evidence.** `tests/blotter/ai.test.mjs`; `tests/blotter/ai-live.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: AI-002 adds its records; provider copies to ERASURE-002's classes; clocks; holds; preview; erasure; receipt; restore fence. Existing preparations use fixed person-only decisions; company-policy class computation and execution through the shared registry remain unproved.

#### AI-008 — Approved processing boundary for AI-008

Core · target · **partial** · From AI-002 · Cites BASE-AGENT-007, BASE-DATA-006 · Rules D-1

**Requirement.** Provide approved processing boundary for AI-008. This part applies RL-5.

**Acceptance.**
1. Firm-owner enablement is off by default and requires a recorded provider no-training and no-retention attestation reference.
2. Selected source text is masked for tax identifiers, SSNs and bank numbers; transmitting it carries external and sensitive, which the company's policy decides.
3. Retain input hash and source identifiers rather than input content; record requester, source identifiers, provider, model, bytes and time once per request.
4. Provider output persists only as a draft the person saves.
5. The portal disclosure states that staff may use an AI provider on client documents.

**Evidence.** `tests/blotter/ai.test.mjs`; `tests/blotter/ai-live.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Firm-owner enablement is off by default; requires a recorded provider no-training; no-retention attestation reference; Selected source text is masked for tax identifiers; SSNs; bank numbers; transmitting it carries external; sensitive; which the company's policy decides; Retain input hash; source identifiers rather than input content; record requester; source identifiers; provider; model; bytes; time once per request; Provider output persists only as a draft the person saves; The portal disclosure states that staff may use an AI provider on client documents. Existing preparations use fixed person-only decisions; company-policy class computation and execution through the shared registry remain unproved.

#### AI-009 — Processing for AI-009

Core · target · **partial** · From AI-002 · Cites BASE-AGENT-007, BASE-AUDIT-001, BASE-DATA-001, BASE-DATA-006 · Rules D-1

**Requirement.** Provide processing for AI-009.

**Acceptance.**
1. The principal records the provider attestation reference, request budget and document review threshold.
2. Each selected-source request reserves that budget before a single call through the existing provider module.
3. Only saved output persists; current staff and source access are checked again after processing and on every saved-draft decision.
4. Archives carry attributed history with enablement disabled; derived AI drafts obey retention holds, preview, erasure and stale restore fencing.
5. Provider processing is listed as an observed outside copy under the recorded agreement, never as verified provider deletion.
6. The original and current client, job period and request appear beside each proposal.
7. The configured threshold flags proposed reading confidence; the company's policy for standard and sensitive decides whether each score needs a person's acceptance.
8. Accepting a name records it for a copy; separately accepting routing creates an internal copy under an active request on the same job, retaining original bytes and provenance.

**Evidence.** `tests/blotter/ai.test.mjs`; `tests/blotter/ai-live.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: The principal records the provider attestation reference; request budget; document review threshold; Each selected-source request reserves that budget before a single call through the existing provider module; Only saved output persists; current staff; source access are checked again after processing; on every saved-draft decision; Archives carry attributed history with enablement disabled; derived AI drafts obey retention holds; preview; erasure; stale restore fencing; Provider processing is listed as an observed outside copy under the recorded agreement; never as verified provider deletion; The original; current client; job period; request appear beside each proposal; The configured threshold flags proposed reading confidence; the company's policy for standard; sensitive decides whether each score needs a person's acceptance; Accepting a name records it for a copy; separately accepting routing creates an internal copy under an active request on the same job; retaining original bytes; provenance. Existing preparations use fixed person-only decisions; company-policy class computation and execution through the shared registry remain unproved.

#### AI-010 — Processing for AI-010

Core · target · **partial** · From AI-002 · Cites BASE-ROLE-001 · Rules D-1

**Requirement.** Provide processing for AI-010.

**Acceptance.**
1. Client and period folders show both files.
2. Unsupported or unreadable files are refused by name, without a provider call.

**Evidence.** `tests/blotter/ai.test.mjs`; `tests/blotter/ai-live.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Client; period folders show both files; Unsupported or unreadable files are refused by name; without a provider call. Existing preparations use fixed person-only decisions; company-policy class computation and execution through the shared registry remain unproved.

#### AI-003 — Client scoped scheduled agents

Core · target · **partial** · Cites BASE-AGENT-007, BASE-DATA-006, BASE-ROLE-001 · Rules D-1

**Requirement.** Run authorized client agents on schedules and task/file/question events with explicit data scope, tools, budget and named supervisor. Show plan, sources, pending actions, cost and outcome; de-duplicate events and stop on revocation. The company's policy decides external messages (external), staffing and deadline changes (standard), fees, write-offs and financial writes (money), and final engagement judgments (commitment). Model/provider data use, retention and permissions are visible to the firm.

**Acceptance.**
1. Enable one client-scoped file-event agent and one scheduled agent, deliver duplicate events and inspect a single pending plan.
2. Under the held company policy, deny an external action, exhaust a budget and revoke the agent mid-run; verify retained outcomes, no unapproved effects and no cross-client data.

**Evidence.** `src/blotter/scheduled-agents.ts`; `src/blotter/scheduled-agent-gate.ts`; `src/blotter/clients.ts`; `src/ui/proposals.tsx`; `tests/blotter/service-agents.test.mjs`; `tests/blotter/service-agents-ui.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Enable one client-scoped file-event agent; one scheduled agent; deliver duplicate events; inspect a single pending plan; Under the held company policy; deny an external action; exhaust a budget; revoke the agent mid-run; verify retained outcomes; no unapproved effects; no cross-client data. Existing preparations use fixed person-only decisions; company-policy class computation and execution through the shared registry remain unproved.

### Approved scope coverage

#### PORTAL-006 — Portal sign-in on the firm custom domain

Core · target · **missing** · Rules D-1

**Requirement.** Live sign-in on the firm's own custom domain uses host-bound cookies and a certificate. This account-blocked split from PORTAL-002 does not block installation-host authentication (ct 25 Oct 20:20Z).

**Acceptance.**
1. Live sign-in on a deployed firm custom domain.

**Evidence.** None.
**Gap.** Owner firm domain and certificate required for live sign-in.

#### NOTICE-002 — Notice response drafting through the mail and e-file path

Core · target · **missing** · Cites BASE-INPUT-003, BASE-MAIL-001 · Rules D-1

**Requirement.** Notice response drafting through the mail and e-file path remains separate from uploaded-notice reading (ct 25 Oct 20:20Z).

**Acceptance.**
1. Draft a notice response through the mail and e-file path.

**Evidence.** None.
**Gap.** Mail and e-file response drafting path is unbuilt.

### Push further with agents

#### READY-001 — Maintain engagement evidence and readiness

Core · push-further · **partial** · Cites BASE-AGENT-007, BASE-ROLE-001 · Rules D-1

**Requirement.** An engagement agent joins signed scope, current-period checklist/requests, QBO/Xero context, source documents, client answers and prior-period work. It identifies absent/conflicting evidence, unusual period-over-period changes and precise source-linked follow-up questions, then tracks approved questions until evidence arrives or a reviewer resolves an exception. Readiness distinguishes collected, validated and judgment-required evidence; material judgments and closure carry commitment, which the company's policy decides for an agent acting with the reviewer's authority. It cannot invent source records or mark tax filings complete.

**Acceptance.**
1. Create a close with a missing statement, contradictory client answer and unusual ledger movement.
2. Under the held company policy, inspect the cited readiness map and precise question drafts, approve one, receive evidence and compare before/after.
3. Under the held company policy, reject another inference; the unresolved judgment stays open and an agent's material judgment carries commitment and takes the company's policy decision.

**Evidence.** `src/blotter/readiness.ts`; `src/blotter/jobs.ts`; `migrations/core/0074_readiness.sql`; `tests/blotter/readiness.test.mjs`; `tests/blotter/readiness-ui.mjs`
**Gap.** Native current/prior-period request/checklist-answer maps and source-linked human-approved question tracking exist. Signed-scope joining, QBO/Xero context, semantic conflict detection, ledger variance analysis and the full engagement-agent journey remain missing. Existing native preparations use fixed person-only decisions; company-policy class computation and execution through the shared registry remain unproved.

#### READY-002 — Authenticated http doors project active request/file custody, checklist

Core · push-further · **partial** · From READY-001 · Cites BASE-ACCESSIBILITY-001, BASE-AGENT-007, BASE-DATA-001, BASE-DATA-006, BASE-ROLE-001 · Rules D-1

**Requirement.** Provide authenticated http doors project active request/file custody, checklist.

**Acceptance.**
1. Authenticated HTTP doors project active request/file custody, checklist states, recorded workflow answers and the latest accessible prior job of the same client/template.
2. No cached evidence payload is stored.
3. A request is missing when it has no unerased files, collected when files exist without staff acceptance, and validated only in the sense of recorded staff request acceptance; this never claims independent content validation.
4. Answer differences are shown with both source jobs, not inferred contradictions.
5. Deterministic question drafts cite one current request or workflow answer.
6. Existing agent keys may prepare; creating the exact draft as one link-only PORTAL-003 to-do carries external under the company's policy; a person who declines it supplies a reason.
7. Source changes refuse stale approval; replay of the same source fingerprint returns the same preparation.
8. Client responses remain judgment-required until the assigned reviewer or principal records a resolution; approved unresolved questions block job sign-off, including after restore.

**Evidence.** `src/blotter/readiness.ts`; `src/blotter/jobs.ts`; `migrations/core/0074_readiness.sql`; `tests/blotter/readiness.test.mjs`; `tests/blotter/readiness-ui.mjs`
**Gap.** Native current/prior-period request/checklist-answer maps and source-linked human-approved question tracking exist. Signed-scope joining, QBO/Xero context, semantic conflict detection, ledger variance analysis and the full engagement-agent journey remain missing. Existing native preparations use fixed person-only decisions; company-policy class computation and execution through the shared registry remain unproved.

#### READY-003 — Declining a draft changes no source evidence

Core · push-further · **partial** · From READY-001 · Cites BASE-DATA-006, BASE-ROLE-001 · Rules D-1

**Requirement.** Provide declining a draft changes no source evidence.

**Acceptance.**
1. Declining a draft changes no source evidence.
2. Question records retain source references/fingerprints and decisions, never source document bytes or copied answer values; maps re-read current authority and erased-file state.
3. ERASURE-002 inherits whole-client question/response retention and erasure; LEDGER-001 and ENGAGE-001 retain their full destinations and statuses.

**Evidence.** `src/blotter/readiness.ts`; `src/blotter/jobs.ts`; `migrations/core/0074_readiness.sql`; `tests/blotter/readiness.test.mjs`; `tests/blotter/readiness-ui.mjs`
**Gap.** Native current/prior-period request/checklist-answer maps and source-linked human-approved question tracking exist. Signed-scope joining, QBO/Xero context, semantic conflict detection, ledger variance analysis and the full engagement-agent journey remain missing. Existing native preparations use fixed person-only decisions; company-policy class computation and execution through the shared registry remain unproved.

#### RESCUE-001 — Coordinate a deadline rescue

Core · push-further · **partial** · Cites BASE-AGENT-007, BASE-AUDIT-001 · Rules D-1

**Requirement.** An agent combines sourced US obligations/extensions, remaining dependencies, ledger/document readiness, client response history, staff skills/leave and capacity to propose the smallest feasible rescue plan. Show deadlines at risk, reassignment/request options, costs and unresolved decisions. The company's policy decides staffing changes and deadline overrides (standard), messages (external), and binding extensions (commitment); the agent follows the decided actions and escalates specific blockers until resolved, using sourced statutory dates and recorded filing facts.

**Acceptance.**
1. Put a multi-client week at risk with absent staff and missing documents.
2. Under the held company policy, inspect feasible source-linked plans, approve a reassignment and client question, decline an extension and follow outcomes.
3. Under the held company policy, miss a response and verify escalation of that exact blocker with no unapproved deadline change or false filing.

**Evidence.** `src/blotter/jobs.ts`; `src/blotter/proposals.ts`; `tests/blotter/flows.test.mjs`
**Gap.** Human-entered sourced dates and approved roll-forward/reminder proposals exist; LEDGER-001 ledger readiness and US obligation/capacity/rescue-plan coordination are missing. Practitioner-linked readiness evidence is context only (ct 20 Oct 09:58Z). Existing native preparations use fixed person-only decisions; company-policy class computation and execution through the shared registry remain unproved.

#### LEARN-001 — Improve recurring work from review findings

Core · push-further · **partial** · Cites BASE-AGENT-007, BASE-AUDIT-001, BASE-ROLE-001 · Rules D-1

**Requirement.** An agent examines authorized reviewer corrections, repeated client questions, missing-document patterns and next-period outcomes to propose versioned checklist/request/organizer improvements. Explain supporting examples, exceptions and expected benefit; new template versions and client deviations carry standard and are decided by the company's policy. Measure the next period against the original assumptions without changing historical evidence or broadening another client's data access.

**Acceptance.**
1. Under the held company policy, complete two periods with a repeated reviewer correction, inspect a proposed template/request change with source examples and approve it for selected clients.
2. Under the held company policy, roll forward, compare exception outcomes and verify rejected changes and signed-off history remain unchanged.

**Evidence.** `src/blotter/learning.ts`; `src/blotter/learning-evidence.ts`; `tests/blotter/learning.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Under the held company policy; complete two periods with a repeated reviewer correction; inspect a proposed template/request change with source examples; approve it for selected clients; roll forward; compare exception outcomes; verify rejected changes; signed-off history remain unchanged. Existing preparations use fixed person-only decisions; company-policy class computation and execution through the shared registry remain unproved.

#### LEARN-002 — An immutable numbered checklist/request/organizer snapshot for selected observed

Core · push-further · **partial** · From LEARN-001 · Cites BASE-AGENT-007, BASE-DATA-001, BASE-DATA-006, BASE-ROLE-001 · Rules D-1

**Requirement.** Provide an immutable numbered checklist/request/organizer snapshot for selected observed.

**Acceptance.**
1. An immutable numbered checklist/request/organizer snapshot for selected observed clients carries standard; the company's policy decides the agent's call.
2. All new-job doors apply that client version while retaining source template identity, fees/currency and existing job snapshots; a declined preparation changes nothing.
3. Source/template/client-version changes fence stale approval.
4. Comparison uses the exact next period, per client, against the baseline per-period mean of reviewer-return events, client questions, and document-return events plus currently outstanding active requests.
5. Missing periods stay pending and unfinished work provisional; negative deltas mean fewer exceptions and do not prove causation.
6. Supporting private content stays at its current authorized source, with references in learning; versions and references are portable and source erasure retains the archive fence.

**Evidence.** `src/blotter/learning.ts`; `src/blotter/learning-evidence.ts`; `tests/blotter/learning.test.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: An immutable numbered checklist/request/organizer snapshot for selected observed clients carries standard; the company's policy decides the agent's call; All new-job doors apply that client version while retaining source template identity; fees/currency; existing job snapshots; a declined preparation changes nothing; Source/template/client-version changes fence stale approval; Comparison uses the exact next period; per client; against the baseline per-period mean of reviewer-return events; client questions; and document-return events plus currently outstanding active requests; Missing periods stay pending; unfinished work provisional; negative deltas mean fewer exceptions; do not prove causation; Supporting private content stays at its current authorized source; with references in learning; versions; references are portable; source erasure retains the archive fence. Existing preparations use fixed person-only decisions; company-policy class computation and execution through the shared registry remain unproved.

#### REVENUE-001 — Close billing leakage and reconciliation exceptions

Core · push-further · **partial** · Cites BASE-AGENT-007, BASE-ROLE-001 · Rules D-1

**Requirement.** An agent compares accepted scope/amendments, time/budgets/WIP, retainer schedules, invoices, credits and provider/accounting events to detect missed charges, duplicate invoices and unreconciled collections. Draft evidence-backed fee amendments or corrections, then verify approved collections reconcile under the single invoice authority. The company's policy decides fees, charges and write-offs (money), binding amendments (commitment) and messages (external); pending ACH remains distinct from settlement.

**Acceptance.**
1. Introduce unbilled out-of-scope work, a duplicate invoice and an ACH return.
2. Under the held company policy, inspect cited exceptions and an amendment draft, approve one correction and decline another; reconcile confirmed provider events and leave the returned payment owned/open without duplicate charging or a silent write-off.

**Evidence.** `tests/blotter/billing-analysis.test.mjs`; `tests/blotter/revenue-proof.mjs`; `tests/blotter/revenue-custody.mjs`; `tests/blotter/revenue-ui.mjs`
**Gap.** Delivered native paths are listed in Evidence. Complete outcome-level proof is missing for: Introduce unbilled out-of-scope work; a duplicate invoice; an ACH return; Under the held company policy; inspect cited exceptions; an amendment draft; approve one correction; decline another; reconcile confirmed provider events; leave the returned payment owned/open without duplicate charging or a silent write-off. Existing preparations use fixed person-only decisions; company-policy class computation and execution through the shared registry remain unproved.

#### ONBOARD-001 — Run new client onboarding to readiness

Core · push-further · **partial** · Cites BASE-AGENT-007 · Rules D-1

**Requirement.** An onboarding agent reads a signed engagement (ENGAGE-001, CRM-005) and proposes the complete setup. The plan covers clients and contacts per the scope, a work schedule from templates, requests for prior-year returns and opening balances, QBO and Xero and bank connection invitations, a 2848 or 8821 (AUTHZ-001) and portal invitations. Every item is linked to the scope it came from. The company's policy decides each plan item's class: invitations and requests carry external, account creation carries accounts, and a provider's person-only consent carries gated. The agent executes only the decided items, tracks responses, drafts targeted chases and escalates each blocker to its owner. A person's signature remains theirs; an agent's signature carries commitment, account connections carry access and gated when the provider requires a person, and fee or billing changes carry money, each decided by the company's policy.

**Acceptance.**
1. Sign a new 1120-S and monthly bookkeeping engagement and inspect the proposed onboarding plan with its scope links.
2. Under the held company policy, approve it with one item removed.
3. Under the held company policy, under the held company policy, the agent sends only the approved invitations, tracks responses, and escalates a missing QBO connection to its owner.
4. Under the held company policy, nothing outside the approved plan is sent, and no fee or signature changes.

**Evidence.** `src/blotter/onboarding.ts`; `src/ui/onboarding.tsx`; `migrations/core/0100_onboarding_plans.sql`; `tests/blotter/onboarding-ui.mjs`; `tests/blotter/intake.test.mjs`
**Gap.** Native principal-only signed-text scope mapping, template setup preview, once-only item selection and practitioner-recorded owned observations are available from the client details screen. Missing: ENGAGE-001 proposal and signed-scope lifecycle, agent preparation under explicit grants and budgets, partner review beyond the principal, approved invitation and request dispatch, client and provider response ingestion, automatic targeted chases and blocker escalation, and complete setup execution. QBO and Xero connections require LEDGER-001; outbound mail requires MAIL-001. Adopted conservative default: principal-only review and observations, no outbound or account action; ct approved this subset on 25 October 2026 at 17:55Z. Restored reviews stay held; merged-client review migration is not implemented. Existing native preparations use fixed person-only decisions; company-policy class computation and execution through the shared registry remain unproved.

#### ONBOARD-002 — principal explicitly maps exact readable quotes from

Core · push-further · **partial** · From ONBOARD-001 · Cites BASE-AUDIT-001, BASE-DATA-001, BASE-DATA-006, BASE-ROLE-001 · Rules D-1

**Requirement.** Provide a principal explicitly maps exact readable quotes from.

**Acceptance.**
1. A principal explicitly maps exact readable quotes from a completed SIGN-002 document or an honestly labelled practitioner-recorded letter to tax and bookkeeping templates.
2. Deterministic setup previews link every item to that source and its digest; they do not infer scope completeness.
3. Review records selected and removed items once per signed source, with current source, contact and template checks.
4. Observations retain earlier observations immutably and name the principal, evidence or blocker, next action and due condition; a received observation is never provider verification.
5. Restored reviews are held, and derived reviews join ERASURE-002 with its holds; removed or erased sources are refused. ct approved this principal-only review and observation subset on 25 October 2026 at 17:55Z: owner custody, audited review of signed scope, attributed immutable practitioner observations, no outbound execution and inactive held restoration.

**Evidence.** `src/blotter/onboarding.ts`; `src/ui/onboarding.tsx`; `migrations/core/0100_onboarding_plans.sql`; `tests/blotter/onboarding-ui.mjs`; `tests/blotter/intake.test.mjs`
**Gap.** Native principal-only signed-text scope mapping, template setup preview, once-only item selection and practitioner-recorded owned observations are available from the client details screen. Missing: ENGAGE-001 proposal and signed-scope lifecycle, agent preparation under explicit grants and budgets, partner review beyond the principal, approved invitation and request dispatch, client and provider response ingestion, automatic targeted chases and blocker escalation, and complete setup execution. QBO and Xero connections require LEDGER-001; outbound mail requires MAIL-001. Adopted conservative default: principal-only review and observations, no outbound or account action; ct approved this subset on 25 October 2026 at 17:55Z. Restored reviews stay held; merged-client review migration is not implemented. Existing native preparations use fixed person-only decisions; company-policy class computation and execution through the shared registry remain unproved.

#### SWITCH-001 — Plan and reconcile the switch from an incumbent

Core · push-further · **missing** · Cites BASE-AGENT-007, BASE-DATA-001, BASE-ROLE-001 · Rules D-1

**Requirement.** A migration agent reads an authorized Karbon, TaxDome, Canopy, Financial Cents or Double export or API extract. It proposes the full mapping: work types and statuses (WORK-007), templates, custom fields, and source automations rewritten as paused AUTOMATE-001 rules. It explains every unmapped or lossy field with examples, proposes duplicate merges (CRM-004) and produces the reconciliation report. The owner corrects and approves the mapping. The mapping runs through the MIGRATE-001–005 import path; subsequent automation activation (standard), messages (external) and charges (money) take the company's policy decision.

**Acceptance.**
1. Give the agent a Karbon export with custom statuses and automators.
2. Inspect the proposed mapping, its examples and its unmapped-field explanations.
3. Under the held company policy, correct one status mapping and approve.
4. Compare the reconciliation counts with the source, and confirm every rewritten automation is paused and no message was sent.

**Evidence.** None.
**Gap.** No migration-mapping agent, automation rewrite or reconciliation report exists. Existing native preparations use fixed person-only decisions; company-policy class computation and execution through the shared registry remain unproved.

#### NOTICE-001 — Read notices and propose the response plan

Core · push-further · **partial** · Cites BASE-AGENT-007, BASE-INPUT-003, BASE-ROLE-001 · Rules D-1

**Requirement.** A notice agent reads an uploaded IRS or state notice, such as a CP2000, CP14, CP504, LT11 or a state equivalent. It extracts the notice type, tax year, amount and response deadline from the notice date. It checks for a recorded authorization (AUTHZ-001) and the latest transcripts (RESOLVE-001), and compares the notice items with the wage-and-income transcript. It then proposes the DUE-002 work item, the deadline, client questions and a response outline, each citing the notice lines. An agent's deadline and work changes carry standard, and its client messages carry external, as decided by the company's policy. Agency contact carries external and a binding submission carries commitment, as decided by the company's policy; notice text supplies evidence, never instructions.

**Acceptance.**
1. Upload a CP2000 for a 1040 client.
2. Compare the extracted fields with the notice text, and inspect the proposed deadline, the income items that differ from the wage-and-income transcript, and the draft client questions.
3. Under the held company policy, approve some questions and decline others.
4. Overriding the deadline requires the practitioner.
5. A misleading instruction embedded in the notice triggers no action.

**Evidence.** `tests/blotter/ai.test.mjs`; `tests/blotter/ai-live.mjs`
**Gap.** IRS transcript context and wage-and-income comparison require authorized RESOLVE-001 and INTEGRATE-006. NOTICE-002 retains the separate mail and e-file response path. Existing native preparations use fixed person-only decisions; company-policy class computation and execution through the shared registry remain unproved.

#### NOTICE-003 — Approved native boundary

Core · push-further · **partial** · From NOTICE-001 · Cites BASE-AGENT-007, BASE-AUDIT-001, BASE-ROLE-001 · Rules D-1

**Requirement.** Provide approved native boundary. This part applies RL-6.

**Acceptance.**
1. The same owner enablement, attestation, masking, audit, saved-draft and explicit-click rules as AI-001 apply.
2. Only the principal or a reviewer prepares or reads a notice draft.
3. Every extraction carries an exact source quote and a proposed verification warning.
4. A person accepts or rejects each question and plan step; acceptance never changes a deadline, sends, posts, files or contacts an agency.
5. The practitioner uses the separate native notice and message doors to adopt verified values or send their selected question.
6. Recorded native taxpayer authorizations appear locally for review and are excluded from model input.

**Evidence.** `tests/blotter/ai.test.mjs`; `tests/blotter/ai-live.mjs`
**Gap.** IRS transcript context and wage-and-income comparison require authorized RESOLVE-001 and INTEGRATE-006. NOTICE-002 retains the separate mail and e-file response path. Existing native preparations use fixed person-only decisions; company-policy class computation and execution through the shared registry remain unproved.

#### NOTICE-004 — Processing for NOTICE-004

Core · push-further · **partial** · From NOTICE-001 · Cites BASE-AGENT-007, BASE-AUDIT-001, BASE-DATA-001, BASE-DATA-006 · Rules D-1

**Requirement.** Provide processing for NOTICE-004.

**Acceptance.**
1. The principal records the provider attestation reference, request budget and document review threshold.
2. Each selected-source request reserves that budget before a single call through the existing provider module.
3. Only saved output persists; current staff and source access are checked again after processing and on every saved-draft decision.
4. Archives carry attributed history with enablement disabled; derived AI drafts obey retention holds, preview, erasure and stale restore fencing.
5. Provider processing is listed as an observed outside copy under the recorded agreement, never as verified provider deletion.

**Evidence.** `tests/blotter/ai.test.mjs`; `tests/blotter/ai-live.mjs`
**Gap.** IRS transcript context and wage-and-income comparison require authorized RESOLVE-001 and INTEGRATE-006. NOTICE-002 retains the separate mail and e-file response path. Existing native preparations use fixed person-only decisions; company-policy class computation and execution through the shared registry remain unproved.

## Agent surface

### Agent surface

#### SURFACE-001 — Practice jobs and records

Agent surface · target · **missing** · From new · Cites BASE-AGENT-002, BASE-AGENT-003, BASE-AGENT-006

**Requirement.** Practice jobs and records for Blotter’s practice coordinator.

**Acceptance.**
1. The registry covers every Core id in this area’s tool table or its stated non-tool reason, including each split part.
2. The practice coordinator reads clients, work, documents, messages, authorizations, invoices, payments and plans through the listed resource templates.
3. Each listed prompt resolves to its named practice jobs, and the on-site agent documentation matches this table.

**Evidence.** None.
**Gap.** No remote MCP practice registry, risk classifier or two-policy conformance journey is implemented.

#### SURFACE-002 — Practice content and exposure classes

Agent surface · target · **missing** · From new · Cites BASE-AGENT-006

**Requirement.** Practice content and exposure classes for Blotter’s practice coordinator.

**Acceptance.**
1. A reversible internal plan edit carries standard with its record count; moving its attachment into an outside-visible client folder adds external with the recipient count and counterparty.
2. A message to an existing authorized contact is external known, a new outside address is external new, and an open document link is external public.
3. Reading a taxpayer identifier, transcript, bank record, card record or vault entry adds sensitive with its actual kind and record count.

**Evidence.** None.
**Gap.** No remote MCP practice registry, risk classifier or two-policy conformance journey is implemented.

#### SURFACE-003 — Financial and binding classes

Agent surface · target · **missing** · From new · Cites BASE-AGENT-006

**Requirement.** Financial and binding classes for Blotter’s practice coordinator.

**Acceptance.**
1. Changing an invoice fee, collecting, refunding, crediting or writing off carries money with the invoice amount, stored currency and counterparty.
2. Signing scope, approving a tax rule, signing off work, accepting an amendment and making a material engagement judgment carry commitment with the saved revision and counterparty.
3. The same collection cannot gain authority from a narrative; PAY-001’s invoice consent and remaining cumulative cap remain separate business facts.

**Evidence.** None.
**Gap.** No remote MCP practice registry, risk classifier or two-policy conformance journey is implemented.

#### SURFACE-004 — Authority and provider classes

Agent surface · target · **missing** · From new · Cites BASE-AGENT-006

**Requirement.** Authority and provider classes for Blotter’s practice coordinator.

**Acceptance.**
1. A staff, contact, client, device, integration or agent grant change carries access with the people affected and whether authority widens or narrows.
2. Factor settings, credential handling and recovery changes carry security with the setting; final erasure, purge and replacement restore carry destructive with affected record and file counts.
3. Creating an outside service resource carries accounts with its provider; a provider-owned consent, verification or hosted payment step carries gated with that provider and step.

**Evidence.** None.
**Gap.** No remote MCP practice registry, risk classifier or two-policy conformance journey is implemented.

#### SURFACE-005 — seeded practice week through MCP

Agent surface · target · **missing** · From new · Cites BASE-AGENT-007, BASE-AGENT-013

**Requirement.** A seeded practice week through MCP for Blotter’s practice coordinator.

**Acceptance.**
1. A stranger agent given only the installation URL runs a seeded firm week through MCP: recurring work, sourced deadlines, missing documents, client questions, independent review, an invoice and its confirmed collection.
2. Under the all-autonomous company policy, the week completes without a policy approval or policy refusal, preserving independent review authority and recorded filing facts.
3. Under the held company policy, standard actions enter review and every other carried class waits for the named person’s approval; the coordinator resumes the saved work and reconciles the same final records.
4. A mixed-currency fixture preserves USD and AUD independently throughout plans, invoicing and collection.
5. A missing document, declined plan item, interrupted collection and returned ACH remain owned and visible with their source links; no return becomes settlement.

**Evidence.** None.
**Gap.** No remote MCP practice registry, risk classifier or two-policy conformance journey is implemented.

#### SURFACE-006 — Practice handoffs and budgets

Agent surface · target · **missing** · From new · Cites BASE-AGENT-010, BASE-AGENT-011

**Requirement.** Practice handoffs and budgets for Blotter’s practice coordinator.

**Acceptance.**
1. A client upload or organizer answer updates the same work’s readiness and retains the source record URI.
2. A signature-complete event advances only the work whose recorded signer and scope match; a payment event changes delivery gating only for its actual invoice.
3. A ledger discrepancy or missed deadline response produces a blocker with its responsible person, next action and due condition.
4. The seeded week under company-selected spend and recipient caps records the provider cost and affected recipients before retrying an interrupted step.

**Evidence.** None.
**Gap.** No remote MCP practice registry, risk classifier or two-policy conformance journey is implemented.

## Later

None.

## Field proof register

| ID | Proof | Clauses | State | Date | Receipt |
| --- | --- | --- | --- | --- | --- |
| R-1 | Human screen-reader review | PORTAL-005, PORTAL-023, PORTAL-024, PORTAL-025, PORTAL-026, PORTAL-027, PORTAL-028 | not run | | |
| R-2 | Independent VPAT | PORTAL-005, PORTAL-023, PORTAL-024, PORTAL-025, PORTAL-026, PORTAL-027, PORTAL-028 | not run | | |
| R-3 | Current SOC 2 Type II report and bridge letter | SECURE-001 | not run | | |
| R-4 | Independent penetration-test summary | SECURE-001 | not run | | |
| R-5 | Native iOS and Android app-store distribution | MOBILE-001, MOBILE-002, MOBILE-003 | not run | | |
| R-6 | Authorized production Google Workspace and Microsoft 365 tenants | MAIL-001, MAIL-004, MAIL-005, MAIL-006, MAIL-007, MAIL-008, MAIL-009, MAIL-010, MAIL-011, MAIL-012 | not run | | |
| R-7 | Real Entra enterprise tenant; standards-provider conformance remains acceptance | ACCESS-003, ACCESS-012, ACCESS-013 | not run | | |
| R-8 | Actual IRS authorization, transcript and filing-provider enrollment | INTEGRATE-006, INTEGRATE-018 | not run | | |
| R-9 | Production KBA-provider authorization; sandbox and official-schema fixtures remain acceptance | SIGN-001, SIGN-003 | not run | | |
| R-10 | Real payment-provider production account; provider sandbox proof remains acceptance | PAY-001, PAY-003, PAY-004, PAY-005, PAY-006 | not run | | |
| R-11 | Claude, ChatGPT, Codex and Copilot client interoperability receipts | AGENT-001 | not run | | |
