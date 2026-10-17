# Target acceptance

A US principal or operations manager of a 1–15 staff bookkeeping or accounting firm can complete the following journeys. This replaces the earlier Australian first-release checklist with the full target; existing tested workflows remain part of it. Each numbered item corresponds to exactly one CONTRACT.md clause. Status is judged at `6201b0072ce67472a0ffbf038d49e77bb3415589` (17 October 2026); partial evidence proves only the subset and gap stated below. Real provider, native app and hosted journeys remain open unless explicitly evidenced.

1. **US-001 — US firm setup and currency.** Status: **partial**. Set up a US bookkeeping and tax practice, add an LLC and individual client, select USD and America/New_York, and create payroll, sales-tax and annual-tax work. Inspect currency and dates across a daylight-saving change; imported AUD history remains AUD.
   Current evidence: `src/blotter/clients.ts`; `src/blotter/billing.ts`; `tests/blotter/flows.test.mjs`.
   Remaining: Client/rate foundations exist, but ABN/AUD defaults remain; US setup, entity fields, currency selection and time-zone policy are missing.

2. **CRM-001 — Client entities and contacts.** Status: **partial**. Create a business with two contacts and an individual linked to its owner; assign different staff and portal permissions, change a contact, archive/reactivate the business and inspect retained jobs. A contact without entity authority cannot read its records.
   Current evidence: `src/blotter/clients.ts`; `tests/blotter/flows.test.mjs`.
   Remaining: Only one contact name/email per client exists; entity relationships, multiple contacts, client editing/lifecycle and portal identities are missing.

3. **CRM-002 — Client groups and custom fields.** Status: **missing**. Group a parent, subsidiary and household; add a fiscal-year and service-tier field, filter the group and schedule its annual work. Preview a bulk field change, reject one invalid value and confirm unrelated clients are unchanged.
   Remaining: No related-client groups, tags or custom-field model exists.

4. **CRM-003 — Engagement history and accountable ownership.** Status: **partial**. Open a client after two periods of work and trace a request from email through upload, review and payment. Filter unresolved items, change their owner and inspect authors, source links and timestamps; a preparer sees only authorized history.
   Current evidence: `src/blotter/jobs.ts`; `src/blotter/team.ts`; `tests/blotter/flows.test.mjs`.
   Remaining: Job, reminder and action records exist; unified communication/engagement history and owned follow-up items are missing.

5. **ENGAGE-001 — Proposals engagement letters and signatures.** Status: **missing**. Send a two-signer proposal, amend it before completion and verify the old version cannot bind the new terms. Complete signatures, download the signed letter/certificate and inspect one onboarding job; decline another and exercise a specialist tax-signature handoff.
   Remaining: No proposal, engagement-letter, signature or signer-authority workflow exists.

6. **WORK-001 — Reusable engagement templates.** Status: **done**. Through the app or authenticated HTTP doors, create a recurring template, start a client job and inspect copied checklist, requests, recurrence, fee, preparer and reviewer. A preparer cannot create templates.
   Current evidence: `src/blotter/clients.ts`; `src/blotter/jobs.ts`; `tests/blotter/flows.test.mjs`.

7. **WORK-002 — Automatic recurring work and roll forward.** Status: **partial**. Enable monthly and fiscal-year recurrence, let scheduled work become due and inspect exactly one next-period job with fresh requests. Restart the scheduler, pause a client, skip a period and override a due date; no duplicate or silently altered prior job appears.
   Current evidence: `src/blotter/jobs.ts`; `src/blotter/proposals.ts`; `tests/blotter/flows.test.mjs`.
   Remaining: Manual/human-approved roll-forward copies monthly/quarterly/annual work once; scheduled generation, custom rules, budgets and due-date calculation are missing.

8. **WORK-003 — Dependencies and conditional workflow.** Status: **partial**. Create a close feeding a tax engagement, branch on an organizer answer and complete prerequisite tasks. Inspect automatic advancement and blocked successors; reject a cycle and record an authorized exception without fabricating evidence.
   Current evidence: `src/blotter/jobs.ts`; `tests/blotter/flows.test.mjs`.
   Remaining: Hard document/checklist/review gates exist; configurable dependencies, conditional branches and automatic advancement are missing.

9. **WORK-004 — Bulk work scheduling and assignment.** Status: **partial**. Preview quarterly jobs for a client group, override two assignees, exclude one client and commit. Re-submit the same batch and inspect no duplicates, then bulk reassign work while refusing inactive or self-review assignments.
   Current evidence: `src/blotter/jobs.ts`; `tests/blotter/flows.test.mjs`.
   Remaining: Single-job creation validates active preparer/reviewer assignments; bulk creation, role routing and rescheduling are missing.

10. **WORK-005 — Firm work queues.** Status: **done**. Create two jobs for different preparers, open the work queue as each role and inspect dates, assignees, status and outstanding counts. Directly requesting another preparer's hidden job is refused.
   Current evidence: `src/blotter/clients.ts`; `src/ui/jobs.tsx`; `tests/blotter/flows.test.mjs`.

11. **WORK-006 — Personal plans boards and calendars.** Status: **missing**. Plan a preparer's week from the overdue queue, move an eligible board card and inspect the same job in calendar and client views. A blocked review transition is refused and filters persist after refresh.
   Remaining: No personal weekly plan, Kanban board or calendar view exists.

12. **DUE-001 — Sourced US obligations and extensions.** Status: **partial**. Configure all five obligation types for clients in two states and different fiscal years. Calculate a weekend/holiday case, import a source revision and preview affected jobs before approval. Record an extension and override; verify separate original/extended/internal dates, preserved provenance and no claim of filing from a checklist.
   Current evidence: `src/blotter/jobs.ts`; `src/blotter/clients.ts`; `tests/blotter/flows.test.mjs`.
   Remaining: Human-entered valid dates and source notes exist; US source feeds, automatic calculation, applicability, rule approval and extension state do not.

13. **DUE-002 — Tax notices and resolution work.** Status: **missing**. Open a notice from a client upload, verify the response deadline, assign a practitioner, link an authorized transcript and response receipt, and schedule follow-up. A failed response stays open; closing requires evidence and a recorded outcome.
   Remaining: No notice-specific deadline, authorization or resolution workflow exists.

14. **MAIL-001 — Gmail and Microsoft 365 shared inbox.** Status: **missing**. Connect a real authorized Google mailbox and Microsoft shared mailbox, receive and reply to client threads, delegate one as a job and file an attachment. Send the same event twice, introduce an ambiguous sender and revoke access; inspect one copy, explicit triage and actionable sync failure.
   Remaining: No connected email, shared inbox, email-to-task or attachment-sync adapter exists.

15. **COLLAB-001 — Contextual discussions and review alerts.** Status: **partial**. Submit work, receive the assigned reviewer's notification, mention a colleague and request a correction. Resolve it as the preparer, inspect the retained thread and verify that the client and unassigned staff cannot read private discussion.
   Current evidence: `src/blotter/jobs.ts`; `src/blotter/documents.ts`; `tests/blotter/flows.test.mjs`.
   Remaining: Review/request-return notes and review status exist; threaded discussion, mentions, unread state and manager notification delivery are missing.

16. **PORTAL-001 — Private document requests and uploads.** Status: **done**. Send a request, rotate its link, refuse the old link and cross-origin upload, upload within the displayed limit and reject an oversized file. Download and accept the files, sign off the job and verify collection closes.
   Current evidence: `src/blotter/documents.ts`; `src/ui/portal.tsx`; `tests/blotter/flows.test.mjs`.

17. **PORTAL-002 — Authenticated branded client portal.** Status: **missing**. Invite two contacts with different entity access, sign in with a second factor on the firm domain and recover a lost factor. Revoke one contact mid-session and attempt direct document/API access; inspect refusal without exposing another entity.
   Remaining: Only capability upload links exist; portal accounts, branding/domain configuration, recovery and MFA are missing.

18. **PORTAL-003 — Client progress secure chat and to dos.** Status: **partial**. Open an engagement as a client, ask a secure question, complete one to-do and inspect the preparer's queue and progress view after review. Confirm internal notes and another entity's tasks remain hidden.
   Current evidence: `src/blotter/documents.ts`; `src/ui/portal.tsx`.
   Remaining: Document requested/received/accepted state and return notes are visible; secure chat, general to-dos and engagement-level progress are missing.

19. **PORTAL-004 — Conditional organizers.** Status: **missing**. Send an organizer, answer an ownership question that reveals a dependent section, save/resume on a phone and attach evidence. Submit, correct one answer and inspect both versions and the resulting request list; unconfirmed carried answers stay unresolved.
   Remaining: No organizer/questionnaire, conditional answers or submission versioning exists.

20. **MOBILE-001 — Mobile client and practitioner work.** Status: **partial**. At desktop and phone widths and on iOS/Android, capture a multi-page statement, interrupt/retry the upload, complete a client task and review it as staff. Inspect push privacy, offline-to-online conflict handling, keyboard navigation and revocation.
   Current evidence: `src/ui/portal.tsx`; `src/ui/workspace.tsx`.
   Remaining: Browser upload/workspace screens exist; camera scanning, native apps, push, offline handling and mobile/accessibility acceptance are missing.

21. **DOC-001 — Client files versions and annotations.** Status: **partial**. Upload a realistic multi-page packet, replace it with a corrected version, annotate a page and find both versions from the client and engagement. Interrupt an upload and resume; compare downloaded originals and inspect limit/error handling.
   Current evidence: `src/blotter/documents.ts`; `src/blotter/jobs.ts`; `tests/blotter/flows.test.mjs`.
   Remaining: Job/request attachments retain hashes and custody metadata at a 1 MiB limit; folders, versions, annotations, search and resumable larger packets are missing.

22. **DOC-002 — Document sharing and internal only custody.** Status: **partial**. Keep a workpaper internal, share a final packet with one contact, rotate/revoke its share and attempt direct reads as another contact and preparer. Inspect inherited version permissions and retained access history.
   Current evidence: `src/blotter/documents.ts`; `tests/blotter/flows.test.mjs`.
   Remaining: Assigned-job access and revocable job upload links exist; per-document visibility, selected-recipient downloads and download audit are missing.

23. **FOLLOWUP-001 — Automatic document chasing and escalation.** Status: **partial**. Approve a bounded reminder sequence, leave two items missing and complete one between sends. Observe only the remaining item chased, a failed delivery surfaced to its owner and escalation at the configured condition. Reply STOP to an actual consented US SMS and verify further SMS ceases; pause and resume without duplicate sends.
   Current evidence: `src/blotter/documents.ts`; `src/blotter/proposals.ts`; `tests/blotter/flows.test.mjs`.
   Remaining: Manual/human-approved outstanding-document email exists; schedules, stop-on-response rules, escalation, Twilio and carrier outcomes are missing.

24. **REVIEW-001 — Independent reviewer sign off.** Status: **done**. Attempt premature submission, complete the evidence and submit. Refuse preparer sign-off, approve as the assigned reviewer with a note, inspect identity/time and verify the closed portal and blocked signed-off checklist edits.
   Current evidence: `src/blotter/jobs.ts`; `src/blotter/documents.ts`; `tests/blotter/flows.test.mjs`.

25. **LEDGER-001 — QuickBooks and Xero client ledger context.** Status: **missing**. Authorize QBO Accountant and Xero client organizations, map them to two engagements and inspect a transaction, balance and close context against each source. Revoke one grant and change the period; stale context is labelled and never silently treated as current.
   Remaining: No QBO/QBO Accountant or Xero client-ledger connections exist.

26. **LEDGER-002 — Transaction questions and close evidence.** Status: **missing**. Select an uncategorized transaction, request its business purpose, receive an answer and receipt, then return it for more evidence. Inspect the source-linked thread in review, a prior-period variance and the recorded reviewer decision without any unapproved ledger write.
   Remaining: No ledger-linked transaction questions, close comparisons or source snapshots exist.

27. **CAPACITY-001 — Workload capacity and coverage.** Status: **missing**. Load a tax-season week with preparer/reviewer budgets, scheduled leave and a client meeting. Inspect available hours, overloaded staff and affected jobs; adjust an estimate and confirm totals and conflict explanations update.
   Remaining: No availability, leave, workload estimate or capacity model/view exists.

28. **CAPACITY-002 — Reassignment and dependency aware scheduling.** Status: **missing**. Remove an assigned preparer for leave, preview alternate staffing and move a dependent job chain. Approve the feasible changes, refuse an ineligible/self-review assignment and inspect new owners, notifications and unresolved deadline conflicts.
   Remaining: No capacity-based reassignment, absence coverage or scheduling plan exists.

29. **CAPACITY-003 — Capacity forecasts and hiring plans.** Status: **missing**. Project the next tax season from recurring work and prior actuals, add a hypothetical hire and lost client, and compare demand/capacity by skill. Trace estimates to sources and save a scenario without changing live work.
   Remaining: No historical workload forecast or hiring scenario planning exists.

30. **TIME-001 — Time budgets and activity suggestions.** Status: **partial**. Record time, change the rate and inspect unchanged prior amounts and budget variance. Stop/restart a timer, reject one activity suggestion and approve another; verify only approved minutes enter WIP and unauthorized edits are refused.
   Current evidence: `src/blotter/billing.ts`; `src/blotter/team.ts`; `tests/blotter/flows.test.mjs`.
   Remaining: Manual job time, integer amounts and rate snapshots exist; timers, budgets, cost/billable distinctions and activity-based suggestions are missing.

31. **TIME-002 — Timesheet approval and period locks.** Status: **partial**. Submit a weekly timesheet, return and correct one entry, approve it and close the period. Attempt direct edits and duplicate billing, then post an authorized adjustment and inspect its history.
   Current evidence: `src/blotter/billing.ts`; `tests/blotter/flows.test.mjs`.
   Remaining: Live-export source reservations and approved-export time locks exist; timesheet approval, period close and adjustment records are missing.

32. **BILL-001 — Reviewed immutable billing exports.** Status: **done**. Prepare a mixed time/fixed-fee export, reject source reuse and non-owner approval, approve as principal and download twice. Verify identical CSV bytes, source locks, formula-safe cells and a voided draft's released sources.
   Current evidence: `src/blotter/billing.ts`; `tests/blotter/flows.test.mjs`.

33. **BILL-002 — Invoices retainers and recurring fees.** Status: **partial**. Bill a fixed engagement and hourly extra, start a monthly retainer, apply a deposit and preview a fee amendment. Approve/deliver invoices, repeat the schedule event and inspect one invoice per entitlement with USD totals and retained source links.
   Current evidence: `src/blotter/billing.ts`; `tests/blotter/flows.test.mjs`.
   Remaining: Time/fixed-fee reviewed AUD CSV drafts exist; invoice documents, delivery, recurring retainers, terms, deposits, taxes and invoice authority are missing.

34. **PAY-001 — Card ACH and authorized collections.** Status: **missing**. Pay a real authorized low-value invoice by card and ACH, authorize a recurring mandate and inspect provider receipts and ledger reconciliation. At the provider test edge exercise duplicate/out-of-order events, ACH return, partial payment, refund and failed collection; revoke the mandate and verify no later debit.
   Remaining: No payment processor, saved-method mandate, card/ACH collection or payment-state/reconciliation workflow exists.

35. **BILL-003 — WIP receivables realization and profitability.** Status: **partial**. Run WIP, aging and profitability for a client with hourly work, fixed fees, a retainer, partial payment and credit. Reconcile totals to approved sources and provider state, approve a write-off and inspect the changed period report without rewriting historical invoices.
   Current evidence: `src/blotter/billing.ts`; `tests/blotter/flows.test.mjs`.
   Remaining: Unbilled time/fixed-fee listing exists; WIP valuation, receivables, credits, realization and profitability reporting are missing.

36. **REPORT-001 — Firm performance and client reporting.** Status: **partial**. Complete and delay several engagements, filter a period/team and drill from turnaround and overdue totals to source jobs. Schedule a partner report, export it and compare totals; a preparer/client cannot obtain the firm's private financial report.
   Current evidence: `src/blotter/clients.ts`; `src/ui/jobs.tsx`.
   Remaining: Current status/due/outstanding queues exist; historical analytics, financial reports, saved views and scheduled reporting are missing.

37. **INTEGRATE-001 — Firm accounting invoice and payment exchange.** Status: **missing**. Connect firm QBO and Xero organizations in separate runs, choose each as invoice authority, deliver an approved invoice and reconcile payment/credit. Replay an event, change a closed-period invoice externally and inspect one source of truth and a visible conflict.
   Remaining: No firm-ledger customer/invoice/payment adapter or authority mapping exists.

38. **INTEGRATE-002 — US tax software document and status handoff.** Status: **missing**. For each named tax stack, send an approved client-year packet through its supported connector/desktop path, receive a final packet and filing-status evidence and inspect IDs/provenance. Disconnect the bridge and verify blocked work remains owned and no false filed state appears.
   Remaining: No tax-software adapter, desktop bridge or tax-status import exists.

39. **INTEGRATE-003 — Connected document storage.** Status: **missing**. Connect each service, map two client folders and import/link an approved packet. Replace and move a source file, revoke a grant and attempt a cross-client share; inspect versions, freshness, custody and denied access.
   Remaining: No external document-storage connectors or custody mapping exist.

40. **INTEGRATE-004 — Ignition engagement onboarding.** Status: **missing**. Accept a real authorized Ignition proposal, observe client/team/onboarding creation and signed-scope linkage, replay the event and amend/cancel it. Inspect exactly one engagement and a reviewed change with future work stopped when appropriate.
   Remaining: No Ignition connector or accepted-proposal onboarding trigger exists.

41. **INTEGRATE-005 — Calendars and client appointment booking.** Status: **missing**. Connect Google and Outlook staff calendars, book one Calendly and one Acuity appointment through a portal and reschedule across DST. Inspect capacity and the client timeline, masked private events and removal of cancelled commitments.
   Remaining: No Google/Outlook calendar or Calendly/Acuity booking integration exists.

42. **INTEGRATE-006 — Authorized IRS transcripts.** Status: **missing**. Using an authorized practitioner/taxpayer pair, request a permitted transcript, receive it into the correct client-period and link a discrepancy to review. Exercise absent authorization, expired practitioner access and pending/failure responses without a fabricated transcript.
   Remaining: No IRS e-Services/TDS connector, authorization tracking or transcript workflow exists.

43. **INTEGRATE-007 — Gusto payroll engagement context.** Status: **missing**. Connect an authorized Gusto client, observe a payroll work item and missing-information exception, follow its run status and inspect the linked source result. Revoke access and verify stale status and owned follow-up without payroll money movement.
   Remaining: No Gusto payroll-work/status connector exists.

44. **API-001 — Authenticated product HTTP doors.** Status: **done**. Create/read work and time through the authenticated HTTP API, inspect billing as reviewer and refuse preparer/private-job reads, signed-out access and agent-key use on person-only routes.
   Current evidence: `src/blotter/api.ts`; `src/blotter/session.ts`; `tests/blotter/flows.test.mjs`.

45. **API-002 — Documented API webhooks and Zapier.** Status: **partial**. Connect Zapier to create a client and task from an approved event, read paginated work/time and receive a signed completion webhook. Replay a write/event, revoke a key and inspect deduplication, bounded scopes and actionable delivery failure.
   Current evidence: `src/blotter/api.ts`; `src/blotter/proposals.ts`; `tests/blotter/flows.test.mjs`.
   Remaining: Authenticated native APIs and external-agent preparations exist; versioned documentation, integration scopes, pagination/webhooks and Zapier are missing.

46. **AUTOMATE-001 — Durable firm automation.** Status: **partial**. Enable rules through the app, trigger file/task/proposal and due-time events, interrupt processing after provider acceptance and restart. Inspect one authorized effect, retained attempts, a visible ambiguous/failing item and no work after rule pause or authority revocation.
   Current evidence: `src/blotter/proposals.ts`; `src/blotter/documents.ts`; `tests/blotter/flows.test.mjs`.
   Remaining: Manual/approved preparations, review gates and reminder delivery records exist; durable scheduled/event rule execution and crash reconciliation are missing.

47. **IMPORT-001 — Reviewed client list import.** Status: **partial**. Map an exported client/contact CSV, preview errors and duplicates without writes, commit its reviewed fingerprint and resume. Re-import without duplication, create a native job on one imported client and undo; inspect preserved native work and the source journal.
   Current evidence: `src/blotter/imports.ts`; `src/blotter/imports/client-list.ts`; `tests/blotter/flows.test.mjs`.
   Remaining: Fixed-shape client CSV preview/fingerprint/commit/resume/journal/undo exists; flexible mapping, US identifiers and multiple-contact/entity migration are missing.

48. **MIGRATE-001 — Karbon migration.** Status: **missing**. Import an authorized Karbon practice containing completed history and live work, review mappings and source limitations, compare counts and representative files/messages/fees, interrupt/resume and repeat the import. Complete a migrated engagement through review/payment, verify historical permissions and no duplicate reminders/debits, then exercise cutover rollback without deleting native work.
   Remaining: No Karbon-specific extractor, full-work/history mapping or reconciled cutover exists; the generic client CSV is not a complete migration.

49. **MIGRATE-002 — TaxDome migration.** Status: **missing**. Import an authorized TaxDome practice containing completed history and live work, review mappings and source limitations, compare counts and representative files/messages/fees, interrupt/resume and repeat the import. Complete a migrated engagement through review/payment, verify historical permissions and no duplicate reminders/debits, then exercise cutover rollback without deleting native work.
   Remaining: No TaxDome-specific extractor, full-work/history mapping or reconciled cutover exists; the generic client CSV is not a complete migration.

50. **MIGRATE-003 — Canopy migration.** Status: **missing**. Import an authorized Canopy practice containing completed history and live work, review mappings and source limitations, compare counts and representative files/messages/fees, interrupt/resume and repeat the import. Complete a migrated engagement through review/payment, verify historical permissions and no duplicate reminders/debits, then exercise cutover rollback without deleting native work.
   Remaining: No Canopy-specific extractor, full-work/history mapping or reconciled cutover exists; the generic client CSV is not a complete migration.

51. **MIGRATE-004 — Financial Cents migration.** Status: **missing**. Import an authorized Financial Cents practice containing completed history and live work, review mappings and source limitations, compare counts and representative files/messages/fees, interrupt/resume and repeat the import. Complete a migrated engagement through review/payment, verify historical permissions and no duplicate reminders/debits, then exercise cutover rollback without deleting native work.
   Remaining: No Financial Cents-specific extractor, full-work/history mapping or reconciled cutover exists; the generic client CSV is not a complete migration.

52. **MIGRATE-005 — Double migration.** Status: **missing**. Import an authorized Double practice containing completed history and live work, review mappings and source limitations, compare counts and representative files/messages/fees, interrupt/resume and repeat the import. Complete a migrated engagement through review/payment, verify historical permissions and no duplicate reminders/debits, then exercise cutover rollback without deleting native work.
   Remaining: No Double-specific extractor, full-work/history mapping or reconciled cutover exists; the generic client CSV is not a complete migration.

53. **ACCESS-001 — Native roles and server authority.** Status: **done**. Invite and sign in staff, call privileged and hidden-job routes as preparer and reviewer, attempt cross-origin writes and deactivate a member. Inspect immediate denial, unchanged records and agent-key refusal on person-only routes.
   Current evidence: `src/blotter/session.ts`; `src/blotter/model.ts`; `src/blotter/team.ts`; `tests/blotter/flows.test.mjs`.

54. **ACCESS-002 — Client permissions and sensitive data policies.** Status: **partial**. Give two teams overlapping client scopes, assign a read-only member and restrict a sensitive workpaper. Attempt direct API/export/share reads and background work after revocation, then step up for an authorized export; inspect denied writes and redacted diagnostics.
   Current evidence: `src/blotter/model.ts`; `src/blotter/session.ts`; `tests/blotter/flows.test.mjs`.
   Remaining: Owner/reviewer/preparer and job scoping exist; configurable client/document grants, read-only roles, sensitive-data policy and step-up are missing.

55. **ACCESS-003 — Enterprise identity lifecycle.** Status: **missing**. Connect an authorized Entra tenant, map groups, sign in, change membership and deprovision a user. Verify current-session/API denial and owner recovery, and refuse another tenant or missing required MFA assertion.
   Remaining: No enterprise identity-provider connection, group mapping or SCIM lifecycle exists.

56. **AGENT-001 — Agents prepare people approve.** Status: **done**. Create a key, prepare all three proposal kinds, attempt approval with the key, approve as its human and decline another with a reason. Inspect decision/result history, refusal of a second decision and immediate key revocation.
   Current evidence: `src/blotter/proposals.ts`; `src/blotter/team.ts`; `tests/blotter/flows.test.mjs`.

57. **ARCHIVE-001 — Whole practice portability and restore.** Status: **done**. Export via the owner HTTP door, reject a damaged archive and a nonempty restore, restore the intact archive into an empty installation and export again. Compare all archived rows, kept file bytes and approved CSV bytes; inspect excluded local authority.
   Current evidence: `src/blotter/archive.ts`; `src/blotter/archive-policy.mjs`; `tests/blotter/flows.test.mjs`.

58. **ARCHIVE-002 — Complete target data portability.** Status: **partial**. Export a multi-year firm with connected history, interrupt/resume the operation and restore to an empty destination. Reconcile record/file counts, relationships, permissions and financial totals, then activate only reviewed connections/rules without replaying past messages or payments.
   Current evidence: `src/blotter/archive.ts`; `src/blotter/archive-policy.mjs`; `tests/blotter/flows.test.mjs`.
   Remaining: Native implemented records are portable; absent target records, firm-scale resumability and reviewed connector/rule reactivation are not implemented.

59. **ERASURE-001 — File erasure and stale archive fencing.** Status: **done**. Export, erase a file through the owner door, refuse later downloads and inspect a new archive without the bytes. Restore the old archive with the later journal and require refusal; restore the latest archive and retain kept files and erasure history.
   Current evidence: `src/blotter/archive.ts`; `tests/blotter/flows.test.mjs`.

60. **ERASURE-002 — Retention legal hold and target erasure.** Status: **partial**. Request client erasure with a held signed engagement and an external document copy. Preview scope, approve eligible deletion, inspect counts and named retained exceptions, verify derived data is removed and test stale restore with the newer journal.
   Current evidence: `src/blotter/archive.ts`; `tests/blotter/flows.test.mjs`.
   Remaining: File-byte erasure and transfer fencing exist; client-wide policies, legal holds, connector/AI erasure and retention lifecycle are missing.

61. **AUDIT-001 — Durable action attribution.** Status: **done**. Create and review work, approve a proposal/export and erase a file through public doors. Read the owner action history, compare attribution with the actors and inspect retained audit rows after an archive round trip.
   Current evidence: `src/blotter/model.ts`; `src/blotter/team.ts`; `src/blotter/archive.ts`; `tests/blotter/flows.test.mjs`.

62. **BASE-001 — Maintained Base foundations and product replacements.** Status: **partial**. Use native sign-in, import a client list, collect a file, review work, approve a billing export and archive/erase/restore through public doors. For every new identity/provider/storage path, repeat permission denial, revocation and stale-restore cases and compare the documented exclusions.
   Current evidence: `src/auth.server.ts`; `src/blotter/model.ts`; `src/blotter/imports.ts`; `src/blotter/archive.ts`; `tests/blotter/flows.test.mjs`.
   Remaining: Existing integrated foundations and product paths are exercised; equivalent guarantees for new target identities, connectors, storage and automation remain unproven.

63. **COST-001 — Predictable USD service and usage costs.** Status: **missing**. Estimate a tax-season workspace with signatures, scanning/AI, messages and ACH/card payments, enable it and reconcile metered usage with displayed USD costs. Hit an optional-action budget, inspect the blocked action/owner notice and approve an increase without duplicate effects.
   Remaining: No subscription/usage pricing, budgets or metered-service controls exist.

64. **AI-001 — Source linked summaries and reply drafts.** Status: **missing**. Summarize a long email/portal thread with conflicting amounts, inspect source links and unresolved questions, edit a reply and approve its exact recipients/attachments. Reject another draft and confirm no send or unauthorized client information.
   Remaining: No communication-summary or suggested-reply capability exists.

65. **AI-002 — Document validation naming and routing.** Status: **missing**. Upload a wrong-period statement, illegible scan and correct invoice with misleading embedded instructions. Inspect sourced validation/naming/routing proposals, approve one and reject another; originals persist and no file changes client or visibility without authority.
   Remaining: No AI document validation, extraction, rename or routing workflow exists.

66. **AI-003 — Client scoped scheduled agents.** Status: **partial**. Enable one client-scoped file-event agent and one scheduled agent, deliver duplicate events and inspect a single pending plan. Deny an external action, exhaust a budget and revoke the agent mid-run; verify retained outcomes, no unapproved effects and no cross-client data.
   Current evidence: `src/blotter/proposals.ts`; `src/blotter/api.ts`; `tests/blotter/flows.test.mjs`.
   Remaining: Role-scoped external-agent context/proposals and human decisions exist; schedule/event runtime, tool/data grants, budgets and model data-use controls are missing.

67. **READY-001 — Maintain engagement evidence and readiness.** Status: **partial**. Create a close with a missing statement, contradictory client answer and unusual ledger movement. Inspect the cited readiness map and precise question drafts, approve one, receive evidence and compare before/after. Reject another inference; the unresolved judgment stays open and review cannot be replaced by an agent verdict.
   Current evidence: `src/blotter/jobs.ts`; `src/blotter/documents.ts`; `src/blotter/proposals.ts`; `tests/blotter/flows.test.mjs`.
   Remaining: Checklist/document readiness gates and agent-prepared missing-request reminders exist; ledger/prior-period comparison, variance analysis and judgment-oriented question tracking are missing.

68. **RESCUE-001 — Coordinate a deadline rescue.** Status: **partial**. Put a multi-client week at risk with absent staff and missing documents. Inspect feasible source-linked plans, approve a reassignment and client question, decline an extension and follow outcomes. Miss a response and verify escalation of that exact blocker with no unapproved deadline change or false filing.
   Current evidence: `src/blotter/jobs.ts`; `src/blotter/proposals.ts`; `tests/blotter/flows.test.mjs`.
   Remaining: Human-entered sourced dates and approved roll-forward/reminder proposals exist; US obligation, capacity and rescue-plan coordination are missing.

69. **LEARN-001 — Improve recurring work from review findings.** Status: **missing**. Complete two periods with a repeated reviewer correction, inspect a proposed template/request change with source examples and approve it for selected clients. Roll forward, compare exception outcomes and verify rejected changes and signed-off history remain unchanged.
   Remaining: No review-learning, template-improvement proposal or outcome-comparison agent exists.

70. **REVENUE-001 — Close billing leakage and reconciliation exceptions.** Status: **partial**. Introduce unbilled out-of-scope work, a duplicate invoice and an ACH return. Inspect cited exceptions and an amendment draft, approve one correction and decline another; reconcile confirmed provider events and leave the returned payment owned/open without duplicate charging or a silent write-off.
   Current evidence: `src/blotter/billing.ts`; `src/blotter/proposals.ts`; `tests/blotter/flows.test.mjs`.
   Remaining: Selected unbilled time/fee export proposals and duplicate-source reservations exist; scope-leakage detection, amendments, provider event reconciliation and collection follow-up are missing.

The destination includes provider apps/agreements, US tax-calendar maintenance, native mobile distribution, electronic signatures, invoicing and card/ACH payments. Tax calculation/filing, ledgers, payroll execution, payment networks and specialist identity verification remain connected authorities as described in CONTRACT.md; those boundaries do not remove Blotter's named integration or follow-up journeys.
