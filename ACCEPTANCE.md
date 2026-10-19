# Target acceptance

A US principal or operations manager of a 1–15 staff bookkeeping or accounting firm can complete the following journeys. This replaces the earlier Australian first-release checklist with the full target; existing tested workflows remain part of it. Each numbered item corresponds to exactly one CONTRACT.md clause. Status is judged at `6201b0072ce67472a0ffbf038d49e77bb3415589` (17 October 2026); partial evidence proves only the subset and gap stated below. Real provider, native app and hosted journeys remain open unless explicitly evidenced.

1. **US-001 — US firm setup and currency.** Status: **partial**. Set up a US bookkeeping and tax practice, add an LLC and individual client, select USD and America/New_York, and create payroll, sales-tax and annual-tax work. Inspect currency and dates across a daylight-saving change; imported AUD history remains AUD.
   Current evidence: `src/blotter/clients.ts`; `src/blotter/billing.ts`; `tests/blotter/flows.test.mjs`.
   Remaining: Client/rate foundations exist, but ABN/AUD defaults remain; US setup, entity fields, currency selection and time-zone policy are missing.

2. **CRM-001 — Client entities and contacts.** Status: **partial**. Create a business with two contacts and an individual linked to its owner; assign different staff and portal permissions, change a contact, archive/reactivate the business and inspect retained jobs. A contact without entity authority cannot read its records.
   Current evidence: `src/blotter/clients.ts`; `tests/blotter/flows.test.mjs`.
   Remaining: Only one contact name/email per client exists; entity relationships, multiple contacts, client editing/lifecycle and portal identities are missing.

3. **CRM-002 — Client groups and custom fields.** Status: **done**. Group a parent, subsidiary and household; add a fiscal-year and service-tier field, filter the group and schedule its annual work. Preview a bulk field change, reject one invalid value and confirm unrelated clients are unchanged.
   Current evidence: `src/blotter/profiles.ts`; `src/blotter/clients.ts`; `src/blotter/imports/client-list.ts`; `migrations/core/0021_client_profiles.sql`; `src/ui/profiles.tsx`; `tests/blotter/flows.test.mjs`.

4. **CRM-003 — Engagement history and accountable ownership.** Status: **partial**. Open a client after two periods of work and trace a request from email through upload, review and payment. Filter unresolved items, change their owner and inspect authors, source links and timestamps; a preparer sees only authorized history.
   Current evidence: `src/blotter/jobs.ts`; `src/blotter/team.ts`; `tests/blotter/flows.test.mjs`.
   Remaining: Job, reminder and action records exist; unified communication/engagement history and owned follow-up items are missing.

5. **CRM-004 — Merge duplicate clients and contacts.** Status: **done**. Import a Karbon client that duplicates a native client and accept the suggested match. Choose field values, merge, and inspect the moved jobs, email, invoices and portal access on the survivor with exactly one QBO mapping. Undo the merge before further edits and inspect the restored records; then repeat the merge, re-run the import and confirm it matches the survivor without creating a duplicate. A merge joining two unrelated entities' contacts without authority is refused. Until the clauses that add them ship, the Karbon client arrives through the client-list CSV with its Karbon client ID (MIGRATE-001 adds the extractor), email is the client's discussions (MAIL-001), invoices are the unbilled lines and exports (BILL-002), portal access is the moved jobs' upload links (PORTAL-002), and the QBO mapping follows LEDGER-001/INTEGRATE-001; each inherits the merge (see CONTRACT.md CRM-004).
   Current evidence: `src/blotter/duplicates.ts`; `src/blotter/merges.ts`; `src/blotter/imports/target.ts`; `migrations/core/0029_duplicates.sql`; `migrations/core/0030_client_merges.sql`; `src/ui/duplicates.tsx`; `tests/blotter/flows.test.mjs` ("CRM-004 duplicate proposals", "CRM-004 merge and undo").

6. **CRM-005 — Prospects intake and onboarding pipeline.** Status: **missing**. Submit the embedded intake form and inspect the new prospect with source and answers; a spam submission is rejected. Book a consult, send a proposal and accept it; confirm one client with contacts, signed scope and onboarding work, and repeat the acceptance event without a second client. Mark another prospect lost with a reason and inspect the pipeline report's conversion, stage age and fee totals.
   Remaining: No prospect record, pipeline stages, intake form or prospect-to-client conversion exists.

7. **ENGAGE-001 — Proposals engagement letters and signatures.** Status: **missing**. Send a two-signer proposal, amend it before completion and verify the old version cannot bind the new terms. Complete signatures, download the signed letter/certificate and inspect one onboarding job; decline another and inspect its retained declined state. Collect a married-filing-jointly Form 8879 under SIGN-001's acceptance.
   Remaining: No proposal, engagement-letter, signature or signer-authority workflow exists.

8. **SIGN-001 — IRS e-file signature authorizations with KBA.** Status: **missing**. Attach a Form 8879 to a married-filing-jointly 1040 engagement and send it to both spouses through the KBA provider at its test edge. Make one spouse fail KBA once and pass on retry. Make the second spouse fail three times, and confirm electronic signing is refused for them and a handwritten-signature task with the printable form is created. Before both signatures exist, moving the work to ready to file is refused. After the wet signature is uploaded, the move is allowed. Inspect the stored signed PDF, certificate, per-signer IP address, login ID and KBA attempts on the 1040 engagement, and confirm a retention date three years after the later of due date and received date. Erasure before that date is refused. The return stays unfiled until an INTEGRATE-008 acceptance arrives, and an unsigned form is chased under FOLLOWUP-001.
   Remaining: No IRS e-file authorization signing, KBA provider, three-attempt fallback, signer record or ready-to-file gate exists.

9. **SIGN-002 — General document signature requests.** Status: **missing**. Place fields on a PDF and request sequential signatures from two contacts. The first signer declines with a reason; resend the request, then complete both signatures. Inspect the signed file, its certificate, the signing order and the timeline on the client and work item. A voided request cannot be signed afterwards, and a contact who is not a signer cannot open it.
   Remaining: No document signature request, field placement, signer order or certificate workflow exists.

10. **AUTHZ-001 — Taxpayer authorizations 2848 and 8821.** Status: **missing**. Prepare a 2848 covering Form 1040 for 2022–2025, collect the client's and representative's signatures, and record its online submission and CAF-recorded status. Request a 2021 transcript and confirm it is blocked as outside the authorization's scope, while a 2024 request proceeds. Withdraw the authorization and confirm the dependent notice work is flagged and new transcript requests are refused.
   Remaining: No authorization record, CAF tracking, form preparation or scope gate exists.

11. **WORK-001 — Reusable engagement templates.** Status: **done**. Through the app or authenticated HTTP doors, create a recurring template, start a client job and inspect copied checklist, requests, recurrence, fee, preparer and reviewer. A preparer cannot create templates.
   Current evidence: `src/blotter/clients.ts`; `src/blotter/jobs.ts`; `tests/blotter/flows.test.mjs`.

12. **WORK-002 — Automatic recurring work and roll forward.** Status: **done**. Enable monthly and fiscal-year recurrence with a three-month lead time, let scheduled work become due and inspect exactly the periods inside the lead time, each once, with fresh requests. Attach two existing future jobs to a monthly rule and advance the horizon; the rule creates only the following period. Restart the scheduler, pause a client, skip a period and override a due date; no duplicate or silently altered prior job appears. The scheduler is the Worker's hourly Cron Trigger; due dates are the rule's days after the period ends (see CONTRACT.md WORK-002 semantics).
   Current evidence: `src/blotter/recurrence.ts`; `src/server.ts`; `wrangler.jsonc`; `migrations/core/0028_recurrence.sql`; `src/ui/recurrence.tsx`; `tests/blotter/flows.test.mjs` ("WORK-002 recurring work", fired through the Cron Trigger door).

13. **WORK-003 — Dependencies and conditional workflow.** Status: **done**. Create a close feeding a tax engagement, branch on an organizer answer and complete prerequisite tasks. Inspect automatic advancement and blocked successors; reject a cycle and record an authorized exception without fabricating evidence. Organizer answers are the job's questions, answered by its staff until PORTAL-004 organizers write the same questions (see CONTRACT.md WORK-003 semantics).
   Current evidence: `src/blotter/flow.ts`; `src/blotter/tasks.ts`; `src/blotter/jobs.ts`; `migrations/core/0027_task_flow.sql`; `src/ui/flow.tsx`; `tests/blotter/flows.test.mjs` ("WORK-003 dependencies").

14. **WORK-004 — Bulk work scheduling and assignment.** Status: **done**. Preview quarterly jobs for a client group, override two assignees, exclude one client and commit. Re-submit the same batch and inspect no duplicates, then bulk reassign work while refusing inactive or self-review assignments.
   Current evidence: `src/blotter/bulk.ts`; `src/ui/bulk.tsx`; `tests/blotter/flows.test.mjs`.

15. **WORK-005 — Firm work queues.** Status: **done**. Create two jobs for different preparers, open the work queue as each role and inspect dates, assignees, status and outstanding counts. Directly requesting another preparer's hidden job is refused.
   Current evidence: `src/blotter/clients.ts`; `src/ui/jobs.tsx`; `tests/blotter/flows.test.mjs`.

16. **WORK-006 — Personal plans boards and calendars.** Status: **missing**. Plan a preparer's week from the overdue queue, group a 1040 board by sub-status, move an eligible card and inspect the same job's new status in queue, calendar and client views. A blocked review transition is refused and filters persist after refresh.
   Remaining: No personal weekly plan, Kanban board or calendar view exists.

17. **WORK-007 — Firm work types and status model.** Status: **partial**. Create a 1040 work type and two sub-statuses under Waiting: "on client documents" and "on 8879 signature". Limit the second to 1040 and confirm it is not offered on a Monthly Bookkeeping job. Move a 1040 job through both sub-statuses on the board. An automation fires once on entering "on 8879 signature". Filter the queue and a saved view by that sub-status, and read a time-in-status report. Moving a job to Completed without review is refused. Deleting a sub-status in use is refused until a previewed bulk reassignment moves its jobs; status history is retained. Import a Karbon work item under MIGRATE-001 and confirm it keeps its work type and status.
   Current evidence: `migrations/core/0016_blotter.sql`; `src/blotter/jobs.ts`; `tests/blotter/flows.test.mjs`.
   Remaining: Fixed open/review/signed_off stages with database-enforced transitions exist; firm work types, job roles, sub-statuses with per-type limits, status history and status-driven boards, views, automation and reports are missing.

18. **WORK-008 — Starter US template library.** Status: **missing**. In a new US firm, browse the library and adopt the 1040 and monthly close templates. Edit one task and start a job from each, then inspect the copied tasks, requests, relative dates, statuses and messages. Publish a library update, preview its diff, accept one change and reject another. The firm's edited task survives and existing jobs are unchanged.
   Remaining: No maintained starter library, versioned adoption or update diff exists; firms build every template themselves.

19. **WORK-009 — Task assignees due dates and instructions.** Status: **done**. Create a template with three tasks due 10, 5 and 2 days before the work's due date, assigned to Preparer, Manager and a named person. Start a job and inspect the computed task dates and owners. Move the work's due date and see the open task dates follow. Change the job's Preparer and confirm the open tasks move to the new person, while a completed task keeps its original completer and time. Open a task's SOP link, and see the tasks in the new owner's weekly plan.
   Current evidence: `src/blotter/tasks.ts`; `src/blotter/jobs.ts`; `migrations/core/0023_tasks.sql`; `src/ui/tasks.tsx`; `tests/blotter/flows.test.mjs`.

20. **DUE-001 — Sourced US obligations and extensions.** Status: **partial**. Configure all five obligation types for clients in two states and different fiscal years. Calculate a weekend/holiday case, import a source revision and preview affected jobs before approval. Record an extension and override; verify separate original/extended/internal dates, preserved provenance and no claim of filing from a checklist.
   Current evidence: `src/blotter/jobs.ts`; `src/blotter/clients.ts`; `tests/blotter/flows.test.mjs`.
   Remaining: Human-entered valid dates and source notes exist; US source feeds, automatic calculation, applicability, rule approval and extension state do not.

21. **DUE-002 — Tax notices and resolution work.** Status: **done**. Open a notice from a client upload, verify the response deadline, assign a practitioner, link an authorized transcript and response receipt, and schedule follow-up. A failed response stays open; closing requires evidence and a recorded outcome.
   Remaining: No notice-specific deadline, authorization or resolution workflow exists.

22. **DUE-003 — Wider US obligation catalog and firm defined deadlines.** Status: **partial**. Configure 1040-ES quarterly estimates including a weekend shift, the January 31 W-2 and 1099-NEC deadlines, an FBAR with its automatic October extension, and a firm rule of 15 days after month end. Inspect the calculated dates and their sources. Import a source revision and preview the affected jobs before approving it. The firm rule shows as firm-defined rather than as an agency deadline.
   Current evidence: `src/blotter/jobs.ts`; `tests/blotter/flows.test.mjs`.
   Remaining: Human-entered due dates with a source note can represent any obligation; the maintained catalog, firm rule types and calculated dates are missing.

23. **RESOLVE-001 — Transcript analysis and resolution cases.** Status: **missing**. Load authorized account transcripts for four years, including one unfiled year. Inspect each year's balance, codes, CSED and unfiled flag against the source lines. Pull again with a new transaction code and see a change alert routed to the practitioner. Collect 433-A data through an organizer and inspect it on the case. No resolution recommendation is made without the practitioner's decision.
   Remaining: No transcript parsing, per-year account analysis, CSED or change routing exists.

24. **MAIL-001 — Gmail and Microsoft 365 shared inbox.** Status: **missing**. Connect a real authorized Google mailbox and Microsoft shared mailbox, receive and reply to client threads, delegate one as a job and file an attachment. Send the same event twice, introduce an ambiguous sender and revoke access; inspect one copy, explicit triage and actionable sync failure. With the person's mail consent, a sent client reply suggests TIME-001 time on its job linking that message; without it, or after withdrawal, mail suggests nothing.
   Remaining: No connected email, shared inbox, email-to-task or attachment-sync adapter exists.

25. **MAIL-002 — Mailbox privacy and sharing.** Status: **missing**. Connect a preparer's mailbox containing a client thread, a personal thread and a vendor thread. A colleague and the owner see only the client thread. Mark the client thread private: colleagues lose access, while its filed attachment stays on the job with its filing record. Add a private-domain rule and confirm a new email from that domain is not shared. The API, search and AI summaries cannot read private threads.
   Remaining: No connected mailbox exists, so no client-only sharing, private-thread rules or private-mail exclusions exist.

26. **MAIL-003 — Triage controls snooze and scheduled send.** Status: **missing**. Snooze a thread until tomorrow at 9:00 and see it return. Assign another thread to a colleague with a note. Convert one thread into a 1040 work item and link another to existing work. Schedule a reply for Monday at 8:00, cancel and reschedule it, and confirm exactly one send. Set a three-day no-reply reminder: it fires when the client stays silent and is cancelled when the client replies. Forward an email to a client's address and see it filed.
   Remaining: No mailbox triage list, snooze, assignment, scheduled send, no-reply reminder or email-in address exists.

27. **MSG-001 — Firm and personal message templates.** Status: **partial**. Create a "Month-end close request" firm template with client, period, due-date and outstanding-items placeholders. Use it in an inbox reply and as step 2 of a reminder sequence, and inspect the rendered text for two clients with different periods and outstanding lists. Remove one client's contact first name and confirm the send is refused naming that field. Edit the template and confirm messages already sent are unchanged while the next reminder uses the new version. A preparer cannot edit the firm template but can save a personal copy.
   Current evidence: `src/blotter/documents.ts`; `tests/blotter/flows.test.mjs`.
   Remaining: The built-in reminder fills client contact, job, period, outstanding requests and link and stores the rendered text; firm and personal templates, the placeholder catalog, preview and unresolved-field refusal are missing.

28. **MSG-002 — Bulk client messages.** Status: **missing**. Filter 40 individual clients by the 1040 work type. Two opted-out clients and one without an email address are excluded and listed. Preview three renderings and schedule the send. After it runs, inspect per-recipient delivery and one bounce in each client's history. A reply from one client threads to that client only. Unsubscribing from a marketing message stops later marketing sends but not engagement notices, and resubmitting the batch sends no duplicate.
   Remaining: No segment messaging, recipient preview, scheduling or per-recipient tracking exists.

29. **SMS-001 — Two way client text messaging.** Status: **missing**. Capture a client's SMS consent and send a templated text. The client replies with a photo, which appears in the client timeline and is filed to the work item. A text from an unknown number lands in triage. A send scheduled during quiet hours waits until the window opens. After the client replies STOP, further texts are refused, and HELP returns the firm's help message.
   Remaining: No SMS provider, two-way thread, consent capture or MMS filing exists.

30. **COLLAB-001 — Contextual discussions and review alerts.** Status: **done**. Submit work, receive the assigned reviewer's notification, mention a colleague and request a correction. Resolve it as the preparer, inspect the retained thread and verify that the client and unassigned staff cannot read private discussion.
   Current evidence: `src/blotter/threads.ts`; `src/blotter/notifications.ts`; `src/blotter/jobs.ts`; `migrations/core/0020_threads.sql`; `src/ui/discussions.tsx`; `tests/blotter/flows.test.mjs`.

31. **NOTIFY-001 — Staff notifications digest and settings.** Status: **missing**. Assign a job and a task to a preparer. Make one job due tomorrow and one overdue, mention the preparer and have a client upload a file. Inspect the in-app notifications, the emails for the events the preparer chose, and a 7:00 local-time digest that lists due-soon and overdue items once. Turn off email for mentions and confirm mentions then arrive in-app only. A firm-mandatory event cannot be muted, and no SSN or EIN appears in any subject line.
   Remaining: No staff notification center, assignment or due-date alerts, digest or per-user settings exist.

32. **PORTAL-001 — Private document requests and uploads.** Status: **done**. Send a request, rotate its link, refuse the old link and cross-origin upload, upload within the displayed limit and reject an oversized file. Download and accept the files, sign off the job and verify collection closes.
   Current evidence: `src/blotter/documents.ts`; `src/ui/portal.tsx`; `tests/blotter/flows.test.mjs`.

33. **PORTAL-002 — Authenticated branded client portal.** Status: **missing**. Invite two contacts with different entity access, sign in with a second factor on the firm domain and recover a lost factor. Revoke one contact mid-session and attempt direct document/API access; inspect refusal without exposing another entity.
   Remaining: Only capability upload links exist; portal accounts, branding/domain configuration, recovery and MFA are missing.

34. **PORTAL-003 — Client progress secure chat and to dos.** Status: **partial**. Open an engagement as a client, ask a secure question, complete one to-do and inspect the preparer's queue and progress view after review. Confirm internal notes and another entity's tasks remain hidden.
   Current evidence: `src/blotter/documents.ts`; `src/ui/portal.tsx`.
   Remaining: Document requested/received/accepted state and return notes are visible; secure chat, general to-dos and engagement-level progress are missing.

35. **PORTAL-004 — Conditional organizers.** Status: **missing**. Send an organizer, answer an ownership question that reveals a dependent section, save/resume on a phone and attach evidence. Submit, correct one answer and inspect both versions and the resulting request list; unconfirmed carried answers stay unresolved.
   Remaining: No organizer/questionnaire, conditional answers or submission versioning exists.

36. **PORTAL-005 — Client language and accessibility.** Status: **missing**. Set a contact to Spanish and send a templated request that has a Spanish version. Complete an organizer and a signature in Spanish. For a template with no Spanish version, staff are warned before the send. Run an automated accessibility check on the client flows, and complete an upload and a signature using only the keyboard.
   Remaining: Client screens are English-only; no per-contact language, translated templates or recorded WCAG 2.2 AA acceptance exist.

37. **MOBILE-001 — Mobile client and practitioner work.** Status: **partial**. At desktop and phone widths and on iOS/Android, capture a multi-page statement, interrupt/retry the upload, complete a client task and review it as staff. As staff on a phone, start a timer, close and reopen the app, stop it and add a manual entry; both appear once in the job's time with the snapshotted rate and respect a locked period. Inspect push privacy, offline-to-online conflict handling, keyboard navigation and revocation.
   Current evidence: `src/ui/portal.tsx`; `src/ui/workspace.tsx`.
   Remaining: Browser upload/workspace screens exist; camera scanning, native apps, mobile time entry and timers, push, offline handling and mobile/accessibility acceptance are missing.

38. **DOC-001 — Client files versions and annotations.** Status: **partial**. Upload a realistic multi-page packet, replace it with a corrected version, annotate a page and find both versions from the client and engagement. Interrupt an upload and resume; compare downloaded originals and inspect limit/error handling.
   Current evidence: `src/blotter/documents.ts`; `src/blotter/jobs.ts`; `tests/blotter/flows.test.mjs`.
   Remaining: Job/request attachments retain hashes and custody metadata at a 1 MiB limit; folders, versions, annotations, search and resumable larger packets are missing.

39. **DOC-002 — Document sharing and internal only custody.** Status: **partial**. Keep a workpaper internal, share a final packet with one contact, rotate/revoke its share and attempt direct reads as another contact and preparer. Inspect inherited version permissions and retained access history.
   Current evidence: `src/blotter/documents.ts`; `tests/blotter/flows.test.mjs`.
   Remaining: Assigned-job access and revocable job upload links exist; per-document visibility, selected-recipient downloads and download audit are missing.

40. **DOC-003 — Client approval of deliverables.** Status: **done**. Send version 1 of a set of financial statements. The client requests a change with a comment. Upload version 2 and have the client approve it. Inspect the approval bound to version 2's hash, the retained comment on version 1 and the resulting status change. Approving version 1 after version 2 exists is refused.
   Current evidence: `src/blotter/deliverables.ts`; `src/blotter/documents.ts`; `migrations/core/0019_deliverables.sql`; `src/ui/deliverables.tsx`; `tests/blotter/flows.test.mjs`.

41. **SEARCH-001 — Firm wide search.** Status: **missing**. Search for a client's last name, an invoice number, a phrase inside an uploaded PDF and an email subject, and open each result. A preparer without access to a client gets no result from that client, and a private thread never appears. Searching the last four digits of an SSN works only for an authorized role and shows the number masked.
   Remaining: No cross-record or full-text search exists.

42. **FOLLOWUP-001 — Automatic document chasing and escalation.** Status: **partial**. Approve a bounded reminder sequence, leave two items missing and complete one between sends. Observe only the remaining item chased, with that step's template rendered for the client and listing only the outstanding item, a failed delivery surfaced to its owner and escalation at the configured condition. Reply STOP to an actual consented US SMS and verify further SMS ceases; pause and resume without duplicate sends.
   Current evidence: `src/blotter/documents.ts`; `src/blotter/proposals.ts`; `tests/blotter/flows.test.mjs`.
   Remaining: Manual/human-approved outstanding-document email exists; schedules, stop-on-response rules, escalation, Twilio and carrier outcomes are missing.

43. **REVIEW-001 — Independent reviewer sign off.** Status: **done**. Attempt premature submission, complete the evidence and submit. Refuse preparer sign-off, approve as the assigned reviewer with a note, inspect identity/time and verify the closed portal and blocked signed-off checklist edits.
   Current evidence: `src/blotter/jobs.ts`; `src/blotter/documents.ts`; `tests/blotter/flows.test.mjs`.

44. **LEDGER-001 — QuickBooks and Xero client ledger context.** Status: **missing**. Authorize QBO Accountant and Xero client organizations, map them to two engagements and inspect a transaction, balance and close context against each source. Revoke one grant and change the period; stale context is labelled and never silently treated as current.
   Remaining: No QBO/QBO Accountant or Xero client-ledger connections exist.

45. **LEDGER-002 — Transaction questions and close evidence.** Status: **missing**. Select an uncategorized transaction, request its business purpose, receive an answer and receipt, then return it for more evidence. Inspect the source-linked thread in review, a prior-period variance and the recorded reviewer decision without any unapproved ledger write.
   Remaining: No ledger-linked transaction questions, close comparisons or source snapshots exist.

46. **LEDGER-003 — Cross client books health dashboard.** Status: **missing**. With two QBO clients and one Xero client connected, compare the dashboard counts with each source. A broken bank feed is flagged. Sort by staff member, and send one client's uncategorized transactions as questions. Revoke a grant and see that client labelled stale.
   Remaining: No ledger connection exists, so no cross-client books dashboard exists.

47. **CAPACITY-001 — Workload capacity and coverage.** Status: **missing**. Load a tax-season week with preparer/reviewer budgets, scheduled leave and a client meeting. Inspect available hours, overloaded staff and affected jobs; adjust an estimate and confirm totals and conflict explanations update.
   Remaining: No availability, leave, workload estimate or capacity model/view exists.

48. **CAPACITY-002 — Reassignment and dependency aware scheduling.** Status: **missing**. Remove an assigned preparer for leave, preview alternate staffing and move a dependent job chain. Approve the feasible changes, refuse an ineligible/self-review assignment and inspect new owners, notifications and unresolved deadline conflicts.
   Remaining: No capacity-based reassignment, absence coverage or scheduling plan exists.

49. **CAPACITY-003 — Capacity forecasts and hiring plans.** Status: **missing**. Project the next tax season from recurring work and prior actuals, add a hypothetical hire and lost client, and compare demand/capacity by skill. Inspect each week's forecast as a range with its stated confidence level, and confirm a client with no prior actuals widens the range and is named as the reason. Trace estimates to sources and save a scenario without changing live work.
   Remaining: No historical workload forecast, confidence ranges or hiring scenario planning exists.

50. **TIME-001 — Time budgets and activity suggestions.** Status: **done**. Record time, change the rate and inspect unchanged prior amounts and budget variance. Stop/restart a timer, reject one activity suggestion and approve another; verify only approved minutes enter WIP and unauthorized edits are refused.
   Current evidence: `src/blotter/billing.ts`; `src/blotter/timers.ts`; `src/blotter/suggestions.ts`; `migrations/core/0031_timers.sql`–`0034_time_tasks.sql`; `src/ui/timer.tsx`; `src/ui/suggestions.tsx`; `tests/blotter/flows.test.mjs` ("TIME-001 timers and budgets", "TIME-001 billable status and tasks", "TIME-001 activity suggestions"). Email and calendar suggestion sources are inherited by MAIL-001 and INTEGRATE-005.

51. **TIME-002 — Timesheet approval and period locks.** Status: **done**. Submit a weekly timesheet, return and correct one entry, approve it and close the period. Attempt direct edits and duplicate billing, then post an authorized adjustment and inspect its history.
   Current evidence: `src/blotter/timesheets.ts`; `src/blotter/billing.ts`; `migrations/core/0018_timesheets.sql`; `src/ui/timesheet.tsx`; `tests/blotter/flows.test.mjs`.

52. **TIME-003 — Billing rates and rate cards.** Status: **done**. Set a staff rate, a 1040 service rate and a client override. Record time across them and inspect each entry's resolved rate and source. Change the staff rate effective next month and confirm past entries are unchanged.
   Current evidence: `src/blotter/rates.ts`; `src/blotter/billing.ts`; `migrations/core/0017_rate_cards.sql`; `tests/blotter/flows.test.mjs`.

53. **TIME-004 — Expenses and disbursements.** Status: **done**. Record a state filing fee with a receipt and a 10% markup, approve it, invoice it and inspect the invoice line and WIP. A non-billable expense stays off the invoice and appears in profitability. An unapproved expense cannot be invoiced.
   Remaining: No expense or disbursement record exists.

54. **BILL-001 — Reviewed immutable billing exports.** Status: **done**. Prepare a mixed time/fixed-fee export, reject source reuse and non-owner approval, approve as principal and download twice. Verify identical CSV bytes, source locks, formula-safe cells and a voided draft's released sources.
   Current evidence: `src/blotter/billing.ts`; `tests/blotter/flows.test.mjs`.

55. **BILL-002 — Invoices retainers and recurring fees.** Status: **partial**. Bill a fixed engagement and hourly extra, start a monthly retainer, apply a deposit and preview a fee amendment. Approve/deliver invoices, repeat the schedule event and inspect one invoice per entitlement with USD totals and retained source links.
   Current evidence: `src/blotter/billing.ts`; `tests/blotter/flows.test.mjs`.
   Remaining: Time/fixed-fee reviewed AUD CSV drafts exist; invoice documents, delivery, recurring retainers, terms, deposits, taxes and invoice authority are missing.

56. **PAY-001 — Card ACH and authorized collections.** Status: **missing**. Pay a real authorized low-value invoice by card and ACH, authorize a recurring mandate and inspect provider receipts and ledger reconciliation. At the provider test edge exercise duplicate/out-of-order events, ACH return, partial payment, refund and failed collection; revoke the mandate and verify no later debit.
   Remaining: No payment processor, saved-method mandate, card/ACH collection or payment-state/reconciliation workflow exists.

57. **PAY-002 — Payment plans and client payment self service.** Status: **missing**. A client pays two invoices in one card payment, and the payment is allocated correctly. The client accepts a three-installment ACH plan; the second installment is returned, which creates owned follow-up with no retry outside the authorized policy. After the client removes a saved card, a later auto-pay is refused.
   Remaining: No client payment portal, multi-invoice payment, installment plan or auto-pay exists.

58. **BILL-003 — WIP receivables realization and profitability.** Status: **partial**. Run WIP, aging and profitability for a client with hourly work, fixed fees, a retainer, partial payment and credit. Reconcile totals to approved sources and provider state, approve a write-off and inspect the changed period report without rewriting historical invoices.
   Current evidence: `src/blotter/billing.ts`; `tests/blotter/flows.test.mjs`.
   Remaining: Unbilled time/fixed-fee listing exists; WIP valuation, receivables, credits, realization and profitability reporting are missing.

59. **BILL-004 — Invoice reminders statements and bulk resend.** Status: **missing**. Issue three invoices with different due dates, let the reminders run and pay one between steps; only the unpaid invoices are reminded, on schedule. Bulk resend two invoices. Generate a statement and reconcile it to open balances. Quick collect one invoice with an authorized saved card; a quick collect without authorization is refused.
   Remaining: No invoices exist, so no overdue reminders, statements, bulk resend or quick collect exist.

60. **BILL-005 — Payment gated delivery and credit hold.** Status: **missing**. Gate a final return copy on an invoice. The client sees it locked, pays by card, and the file unlocks. With a wait-for-settlement ACH policy, the file stays locked until settlement. The client's own uploaded documents stay downloadable throughout. A partner override is recorded with its reason, and new work for an overdue client shows the credit hold.
   Remaining: No payment-gated release or credit-hold policy exists.

61. **REPORT-001 — Firm performance and client reporting.** Status: **partial**. Complete and delay several engagements, filter a period/team and drill from turnaround and overdue totals to source jobs. Schedule a partner report, export it and compare totals; a preparer/client cannot obtain the firm's private financial report.
   Current evidence: `src/blotter/clients.ts`; `src/ui/jobs.tsx`.
   Remaining: Current status/due/outstanding queues exist; historical analytics, financial reports, saved views and scheduled reporting are missing.

62. **INTEGRATE-001 — Firm accounting invoice and payment exchange.** Status: **missing**. Connect firm QBO and Xero organizations in separate runs, choose each as invoice authority, deliver an approved invoice and reconcile payment/credit. Replay an event, change a closed-period invoice externally and inspect one source of truth and a visible conflict.
   Remaining: No firm-ledger customer/invoice/payment adapter or authority mapping exists.

63. **INTEGRATE-002 — US tax software document and status handoff.** Status: **missing**. For each named tax stack, send an approved client-year packet through its supported connector/desktop path, receive a final packet and that stack's INTEGRATE-008 filing-status evidence and inspect IDs/provenance. Disconnect the bridge and verify blocked work remains owned and no false filed state appears.
   Remaining: No tax-software adapter, desktop bridge or tax-status import exists.

64. **INTEGRATE-003 — Connected document storage.** Status: **missing**. Connect each service, map two client folders and import/link an approved packet. Replace and move a source file, revoke a grant and attempt a cross-client share; inspect versions, freshness, custody and denied access.
   Remaining: No external document-storage connectors or custody mapping exist.

65. **INTEGRATE-004 — Ignition engagement onboarding.** Status: **missing**. Accept a real authorized Ignition proposal, observe client/team/onboarding creation and signed-scope linkage, replay the event and amend/cancel it. Inspect exactly one engagement and a reviewed change with future work stopped when appropriate.
   Remaining: No Ignition connector or accepted-proposal onboarding trigger exists.

66. **INTEGRATE-005 — Calendars and client appointment booking.** Status: **missing**. Connect Google and Outlook staff calendars, book one Calendly and one Acuity appointment through a portal and reschedule across DST. Inspect capacity and the client timeline, masked private events and removal of cancelled commitments. With the person's calendar consent, a client meeting suggests TIME-001 time on its job linking the event; a private event or a withdrawn consent suggests nothing.
   Remaining: No Google/Outlook calendar or Calendly/Acuity booking integration exists.

67. **INTEGRATE-006 — Authorized IRS transcripts.** Status: **missing**. Using an authorized practitioner/taxpayer pair, request a permitted transcript, receive it into the correct client-period and link a discrepancy to review. Exercise absent authorization, expired practitioner access and pending/failure responses without a fabricated transcript.
   Remaining: No IRS e-Services/TDS connector, authorization tracking or transcript workflow exists.

68. **INTEGRATE-007 — Gusto payroll engagement context.** Status: **missing**. Connect an authorized Gusto client, observe a payroll work item and missing-information exception, follow its run status and inspect the linked source result. Revoke access and verify stale status and owned follow-up without payroll money movement.
   Remaining: No Gusto payroll-work/status connector exists.

69. **INTEGRATE-008 — Return filing status source per tax stack.** Status: **missing**. For each of the five stacks, ingest one return's status from that stack's named source (transmitted, then accepted) and one rejection with its reject code, each mapped to the right client-year. For a return whose stack exposes no status, record a practitioner acknowledgment with its submission ID and file. Confirm the labels distinguish each source, and that the rejection reopens the work item to rework. Disconnect the bridge and confirm no status is invented.
   Remaining: No tax-software status import, practitioner acknowledgment record or reject reopening exists.

70. **API-001 — Authenticated product HTTP doors.** Status: **done**. Create/read work and time through the authenticated HTTP API, inspect billing as reviewer and refuse preparer/private-job reads, signed-out access and agent-key use on person-only routes.
   Current evidence: `src/blotter/api.ts`; `src/blotter/session.ts`; `tests/blotter/flows.test.mjs`.

71. **API-002 — Documented API webhooks and Zapier.** Status: **partial**. Connect Zapier to create a client and task from an approved event, read paginated work/time and receive a signed completion webhook. Replay a write/event, revoke a key and inspect deduplication, bounded scopes and actionable delivery failure.
   Current evidence: `src/blotter/api.ts`; `src/blotter/proposals.ts`; `tests/blotter/flows.test.mjs`.
   Remaining: Authenticated native APIs and external-agent preparations exist; versioned documentation, integration scopes, pagination/webhooks and Zapier are missing.

72. **AUTOMATE-001 — Durable firm automation.** Status: **partial**. Enable rules through the app, including "when all tasks complete, set status In review" and "on entering Waiting – on client documents, send the request template". Trigger status, file/task/proposal and due-time events, interrupt processing after provider acceptance and restart. Inspect one authorized effect, retained attempts, a visible ambiguous/failing item and no work after rule pause or authority revocation.
   Current evidence: `src/blotter/proposals.ts`; `src/blotter/documents.ts`; `tests/blotter/flows.test.mjs`.
   Remaining: Manual/approved preparations, review gates and reminder delivery records exist; durable scheduled/event rule execution and crash reconciliation are missing.

73. **IMPORT-001 — Reviewed client list import.** Status: **partial**. Map an exported client/contact CSV, preview errors and duplicates without writes, commit its reviewed fingerprint and resume. Re-import without duplication, create a native job on one imported client and undo; inspect preserved native work and the source journal.
   Current evidence: `src/blotter/imports.ts`; `src/blotter/imports/client-list.ts`; `tests/blotter/flows.test.mjs`.
   Remaining: Fixed-shape client CSV preview/fingerprint/commit/resume/journal/undo exists; flexible mapping, US identifiers and multiple-contact/entity migration are missing.

74. **MIGRATE-001 — Karbon migration.** Status: **missing**. Import an authorized Karbon practice containing completed history and live work, confirm every active work item keeps its work type and primary/sub-status (WORK-007) and that an unmapped status is held for review, review mappings and source limitations, compare counts and representative files/messages/fees, interrupt/resume and repeat the import. On the same practice, pass MIGRATE-006's repeating-schedule journey (monthly, quarterly and annual series with pre-created future items) and MIGRATE-007's auto-pay journey (three auto-pay clients). Complete a migrated engagement through review/payment, verify historical permissions and no duplicate reminders/debits, then exercise cutover rollback without deleting native work.
   Remaining: No Karbon-specific extractor, full-work/history mapping or reconciled cutover exists; the generic client CSV is not a complete migration.

75. **MIGRATE-002 — TaxDome migration.** Status: **missing**. Import an authorized TaxDome practice containing completed history and live work. Confirm every active item keeps its mapped work type and pipeline stage (WORK-007) and that an unmapped pipeline stage is held for review with an owner. Run MIGRATE-006's series check on a monthly and an annual recurring job that have already created future items: one recurrence rule each, the pre-created items claimed once, and the next period created exactly once after cutover. Run MIGRATE-007's auto-pay journey with three TaxDome clients who pay automatically. Review mappings and source limitations, compare counts and representative files/messages/fees, interrupt/resume and repeat the import. Complete a migrated engagement through review/payment, verify historical permissions and no duplicate reminders/debits, then exercise cutover rollback without deleting native work.
   Remaining: No TaxDome-specific extractor, full-work/history mapping or reconciled cutover exists; the generic client CSV is not a complete migration.

76. **MIGRATE-003 — Canopy migration.** Status: **missing**. Import an authorized Canopy practice containing completed history and live work. Confirm every active item keeps its mapped work type and task status (WORK-007) and that an unmapped task status is held for review with an owner. Run MIGRATE-006's series check on a monthly and an annual recurring task that have already created future items: one recurrence rule each, the pre-created items claimed once, and the next period created exactly once after cutover. Run MIGRATE-007's auto-pay journey with three Canopy clients who pay automatically. Review mappings and source limitations, compare counts and representative files/messages/fees, interrupt/resume and repeat the import. Complete a migrated engagement through review/payment, verify historical permissions and no duplicate reminders/debits, then exercise cutover rollback without deleting native work.
   Remaining: No Canopy-specific extractor, full-work/history mapping or reconciled cutover exists; the generic client CSV is not a complete migration.

77. **MIGRATE-004 — Financial Cents migration.** Status: **missing**. Import an authorized Financial Cents practice containing completed history and live work. Confirm every active item keeps its mapped work type and project status (WORK-007) and that an unmapped project status is held for review with an owner. Run MIGRATE-006's series check on a monthly and an annual recurring project that have already created future items: one recurrence rule each, the pre-created items claimed once, and the next period created exactly once after cutover. Run MIGRATE-007's auto-pay journey with three Financial Cents clients who pay automatically. Review mappings and source limitations, compare counts and representative files/messages/fees, interrupt/resume and repeat the import. Complete a migrated engagement through review/payment, verify historical permissions and no duplicate reminders/debits, then exercise cutover rollback without deleting native work.
   Remaining: No Financial Cents-specific extractor, full-work/history mapping or reconciled cutover exists; the generic client CSV is not a complete migration.

78. **MIGRATE-005 — Double migration.** Status: **missing**. Import an authorized Double practice containing completed history and live work. Confirm every active item keeps its mapped work type and close status (WORK-007) and that an unmapped close status is held for review with an owner. Run MIGRATE-006's series check on a monthly and an annual recurring close task that have already created future items: one recurrence rule each, the pre-created items claimed once, and the next period created exactly once after cutover. Review mappings and source limitations, compare counts and representative files/messages/fees, interrupt/resume and repeat the import. Complete a migrated engagement through review/payment, verify historical permissions and no duplicate reminders/debits, then exercise cutover rollback without deleting native work.
   Remaining: No Double-specific extractor, full-work/history mapping or reconciled cutover exists; the generic client CSV is not a complete migration.

79. **MIGRATE-006 — Recurring schedules and future work carry over.** Status: **missing**. Import an authorized Karbon practice with a monthly close series that has already created its next three periods, a quarterly 941 series and an annual 1120-S series. Inspect one rule per series linked to its migrated template, with the source frequency, end date, assignees, budget and lead time, and the three pre-created monthly items attached to the monthly rule with their Karbon IDs. Approve cutover and advance the scheduler's horizon by one month: it creates exactly the first monthly period Karbon had not created, nothing for periods already held, and no period between the last Karbon item and the first Blotter item is missing. Add a series with a frequency Blotter cannot express and confirm it is held for review with its owner on the cutover report rather than dropped. Repeat the import and confirm rule and future-item counts are unchanged.
   Remaining: No source recurrence extraction, series-to-rule mapping, claiming of pre-created future items, held-series review or idempotent series matching exists; native roll-forward has no lead time or held periods.

80. **MIGRATE-007 — Auto pay enrollments carried over or reauthorized.** Status: **missing**. Migrate three Karbon auto-pay clients, one whose saved card copies through Stripe's payment-data migration at the provider test edge and two whose methods cannot be copied. Inspect the cutover report: one mandate migrated and two awaiting reauthorization, each with an owner and a sent template message. Have one of the two reauthorize through the portal and watch the report update. Issue the first post-cutover invoices: the migrated and reauthorized clients are collected automatically on the due date; the third client's invoice is not charged, stays open and carries owned reauthorization follow-up with a scheduled chase. Confirm Karbon auto-pay was recorded off for each client before Blotter's first charge and that no invoice was charged in both systems.
   Remaining: No payment provider, auto-pay enrollment import, Stripe payment-data migration, reauthorization request tracking, cutover payment report or single-collector check exists.

81. **ACCESS-001 — Native roles and server authority.** Status: **done**. Invite and sign in staff, call privileged and hidden-job routes as preparer and reviewer, attempt cross-origin writes and deactivate a member. Inspect immediate denial, unchanged records and agent-key refusal on person-only routes.
   Current evidence: `src/blotter/session.ts`; `src/blotter/model.ts`; `src/blotter/team.ts`; `tests/blotter/flows.test.mjs`.

82. **ACCESS-002 — Client permissions and sensitive data policies.** Status: **partial**. Give two teams overlapping client scopes, assign a read-only member and restrict a sensitive workpaper. Attempt direct API/export/share reads and background work after revocation, then step up for an authorized export; inspect denied writes and redacted diagnostics.
   Current evidence: `src/blotter/model.ts`; `src/blotter/session.ts`; `tests/blotter/flows.test.mjs`.
   Remaining: Owner/reviewer/preparer and job scoping exist; configurable client/document grants, read-only roles, sensitive-data policy and step-up are missing.

83. **ACCESS-003 — Enterprise identity lifecycle.** Status: **missing**. Connect an authorized Entra tenant, map groups, sign in, change membership and deprovision a user. Verify current-session/API denial and owner recovery, and refuse another tenant or missing required MFA assertion.
   Remaining: No enterprise identity-provider connection, group mapping or SCIM lifecycle exists.

84. **ACCESS-004 — Enforced staff multi factor authentication.** Status: **done**. Enable the firm MFA policy. A preparer without a factor must enroll before seeing any client. Sign in with TOTP and with a passkey. A sign-in with the correct first factor and no second factor is refused, and a session created before the policy must step up before further access. When the preparer loses their factor, the owner resets it; the preparer's sessions are revoked and the audit shows who reset it. A federated sign-in whose token lacks an MFA assertion is challenged for a Blotter factor. Export the enrollment report.
   Current evidence: `src/blotter/mfa.ts`; `src/blotter/webauthn.ts`; `src/blotter/session.ts`; `migrations/core/0024_mfa.sql`; `src/ui/security.tsx`; `tests/blotter/flows.test.mjs`.

85. **ACCESS-005 — Google Workspace and Microsoft 365 staff sign in.** Status: **missing**. Sign in one preparer through Google Workspace and another through Microsoft 365. A personal gmail.com account and an account from another tenant are refused. Suspend the Google account in Google Admin and confirm the Blotter browser session and that member's API token are refused within the revalidation interval, or immediately when the provider signal arrives. Disable the Microsoft user and confirm the same. The owner can still recover through native sign-in.
   Remaining: No Google or Microsoft staff sign-in, domain/tenant restriction or identity revalidation exists.

86. **ACCESS-006 — Staff offboarding and ownership transfer.** Status: **partial**. Give a preparer clients, open work, a scheduled reminder sequence, a pending signature request and a connected mailbox. Preview the transfer, reassign everything to two successors and deactivate the preparer. No orphaned item remains. The next reminder goes from the successor, past messages show the original author, and the deactivated member's sessions and tokens are refused.
   Current evidence: `src/blotter/team.ts`; `tests/blotter/flows.test.mjs`.
   Remaining: Member deactivation immediately denies every handler; ownership preview, bulk transfer to successors and handover of mailbox, automation and signature work are missing.

87. **SECURE-001 — Security program and attestation.** Status: **missing**. As the owner, request and download the attestation package from settings, and check that the report period is current and the subprocessor list matches the enabled integrations. Export an access log for a date range. A preparer cannot download the package.
   Remaining: No security attestation package, SOC 2 report, subprocessor list, WISP mapping or access-log export exists.

88. **VAULT-001 — Client credential vault.** Status: **missing**. A client adds a state sales-tax portal login through the portal. An assigned preparer reveals it after step-up, and the reveal is logged. An unassigned preparer cannot reveal it. The credential is absent from search, AI summaries and plain exports. Revoke the preparer's access and confirm their next reveal is refused.
   Remaining: No credential vault, reveal step-up or reveal log exists.

89. **AGENT-001 — Agents prepare people approve.** Status: **done**. Create a key, prepare all three proposal kinds, attempt approval with the key, approve as its human and decline another with a reason. Inspect decision/result history, refusal of a second decision and immediate key revocation.
   Current evidence: `src/blotter/proposals.ts`; `src/blotter/team.ts`; `tests/blotter/flows.test.mjs`.

90. **ARCHIVE-001 — Whole practice portability and restore.** Status: **done**. Export via the owner HTTP door, reject a damaged archive and a nonempty restore, restore the intact archive into an empty installation and export again. Compare all archived rows, kept file bytes and approved CSV bytes; inspect excluded local authority.
   Current evidence: `src/blotter/archive.ts`; `src/blotter/archive-policy.mjs`; `tests/blotter/flows.test.mjs`.

91. **ARCHIVE-002 — Complete target data portability.** Status: **partial**. Export a multi-year firm with connected history, interrupt/resume the operation and restore to an empty destination. Reconcile record/file counts, relationships, permissions and financial totals, then activate only reviewed connections/rules without replaying past messages or payments.
   Current evidence: `src/blotter/archive.ts`; `src/blotter/archive-policy.mjs`; `tests/blotter/flows.test.mjs`.
   Remaining: Native implemented records are portable; absent target records, firm-scale resumability and reviewed connector/rule reactivation are not implemented.

92. **ERASURE-001 — File erasure and stale archive fencing.** Status: **done**. Export, erase a file through the owner door, refuse later downloads and inspect a new archive without the bytes. Restore the old archive with the later journal and require refusal; restore the latest archive and retain kept files and erasure history.
   Current evidence: `src/blotter/archive.ts`; `tests/blotter/flows.test.mjs`.

93. **ERASURE-002 — Retention legal hold and target erasure.** Status: **partial**. Request client erasure with a held signed engagement and an external document copy. Preview scope, approve eligible deletion, inspect counts and named retained exceptions, verify derived data is removed and test stale restore with the newer journal.
   Current evidence: `src/blotter/archive.ts`; `tests/blotter/flows.test.mjs`.
   Remaining: File-byte erasure and transfer fencing exist; client-wide policies, legal holds, connector/AI erasure and retention lifecycle are missing.

94. **AUDIT-001 — Durable action attribution.** Status: **done**. Create and review work, approve a proposal/export and erase a file through public doors. Read the owner action history, compare attribution with the actors and inspect retained audit rows after an archive round trip.
   Current evidence: `src/blotter/model.ts`; `src/blotter/team.ts`; `src/blotter/archive.ts`; `tests/blotter/flows.test.mjs`.

95. **BASE-001 — Maintained Base foundations and product replacements.** Status: **partial**. Use native sign-in, import a client list, collect a file, review work, approve a billing export and archive/erase/restore through public doors. For every new identity/provider/storage path, repeat permission denial, revocation and stale-restore cases and compare the documented exclusions.
   Current evidence: `src/auth.server.ts`; `src/blotter/model.ts`; `src/blotter/imports.ts`; `src/blotter/archive.ts`; `tests/blotter/flows.test.mjs`.
   Remaining: Existing integrated foundations and product paths are exercised; equivalent guarantees for new target identities, connectors, storage and automation remain unproven.

96. **COST-001 — Predictable USD service and usage costs.** Status: **missing**. Estimate a tax-season workspace with signatures, scanning/AI, messages and ACH/card payments, enable it and reconcile metered usage with displayed USD costs. Hit an optional-action budget, inspect the blocked action/owner notice and approve an increase without duplicate effects.
   Remaining: No subscription/usage pricing, budgets or metered-service controls exist.

97. **AI-001 — Source linked summaries and reply drafts.** Status: **missing**. Summarize a long email/portal thread with conflicting amounts, inspect source links and unresolved questions, edit a reply and approve its exact recipients/attachments. Reject another draft and confirm no send or unauthorized client information.
   Remaining: No communication-summary or suggested-reply capability exists.

98. **AI-002 — Document validation naming and routing.** Status: **missing**. Upload a wrong-period statement, illegible scan and correct invoice with misleading embedded instructions. Inspect sourced validation/naming/routing proposals, approve one and reject another; originals persist and no file changes client or visibility without authority.
   Remaining: No AI document validation, extraction, rename or routing workflow exists.

99. **AI-003 — Client scoped scheduled agents.** Status: **partial**. Enable one client-scoped file-event agent and one scheduled agent, deliver duplicate events and inspect a single pending plan. Deny an external action, exhaust a budget and revoke the agent mid-run; verify retained outcomes, no unapproved effects and no cross-client data.
   Current evidence: `src/blotter/proposals.ts`; `src/blotter/api.ts`; `tests/blotter/flows.test.mjs`.
   Remaining: Role-scoped external-agent context/proposals and human decisions exist; schedule/event runtime, tool/data grants, budgets and model data-use controls are missing.

100. **READY-001 — Maintain engagement evidence and readiness.** Status: **partial**. Create a close with a missing statement, contradictory client answer and unusual ledger movement. Inspect the cited readiness map and precise question drafts, approve one, receive evidence and compare before/after. Reject another inference; the unresolved judgment stays open and review cannot be replaced by an agent verdict.
   Current evidence: `src/blotter/jobs.ts`; `src/blotter/documents.ts`; `src/blotter/proposals.ts`; `tests/blotter/flows.test.mjs`.
   Remaining: Checklist/document readiness gates and agent-prepared missing-request reminders exist; ledger/prior-period comparison, variance analysis and judgment-oriented question tracking are missing.

101. **RESCUE-001 — Coordinate a deadline rescue.** Status: **partial**. Put a multi-client week at risk with absent staff and missing documents. Inspect feasible source-linked plans, approve a reassignment and client question, decline an extension and follow outcomes. Miss a response and verify escalation of that exact blocker with no unapproved deadline change or false filing.
   Current evidence: `src/blotter/jobs.ts`; `src/blotter/proposals.ts`; `tests/blotter/flows.test.mjs`.
   Remaining: Human-entered sourced dates and approved roll-forward/reminder proposals exist; US obligation, capacity and rescue-plan coordination are missing.

102. **LEARN-001 — Improve recurring work from review findings.** Status: **missing**. Complete two periods with a repeated reviewer correction, inspect a proposed template/request change with source examples and approve it for selected clients. Roll forward, compare exception outcomes and verify rejected changes and signed-off history remain unchanged.
   Remaining: No review-learning, template-improvement proposal or outcome-comparison agent exists.

103. **REVENUE-001 — Close billing leakage and reconciliation exceptions.** Status: **partial**. Introduce unbilled out-of-scope work, a duplicate invoice and an ACH return. Inspect cited exceptions and an amendment draft, approve one correction and decline another; reconcile confirmed provider events and leave the returned payment owned/open without duplicate charging or a silent write-off.
   Current evidence: `src/blotter/billing.ts`; `src/blotter/proposals.ts`; `tests/blotter/flows.test.mjs`.
   Remaining: Selected unbilled time/fee export proposals and duplicate-source reservations exist; scope-leakage detection, amendments, provider event reconciliation and collection follow-up are missing.

104. **ONBOARD-001 — Run new client onboarding to readiness.** Status: **missing**. Sign a new 1120-S and monthly bookkeeping engagement and inspect the proposed onboarding plan with its scope links. Approve it with one item removed. The agent sends only the approved invitations, tracks responses, and escalates a missing QBO connection to its owner. Nothing outside the approved plan is sent, and no fee or signature changes.
   Remaining: No onboarding agent, scope-derived setup plan or onboarding tracking exists.

105. **SWITCH-001 — Plan and reconcile the switch from an incumbent.** Status: **missing**. Give the agent a Karbon export with custom statuses and automators. Inspect the proposed mapping, its examples and its unmapped-field explanations. Correct one status mapping and approve. Compare the reconciliation counts with the source, and confirm every rewritten automation is paused and no message was sent.
   Remaining: No migration-mapping agent, automation rewrite or reconciliation report exists.

106. **NOTICE-001 — Read notices and propose the response plan.** Status: **missing**. Upload a CP2000 for a 1040 client. Compare the extracted fields with the notice text, and inspect the proposed deadline, the income items that differ from the wage-and-income transcript, and the draft client questions. Approve some questions and decline others. Overriding the deadline requires the practitioner. A misleading instruction embedded in the notice triggers no action.
   Remaining: No notice-reading agent, extraction or response-plan proposal exists.

The destination includes provider apps/agreements, US tax-calendar maintenance, native mobile distribution, electronic signatures, invoicing and card/ACH payments. Tax calculation/filing, ledgers, payroll execution, payment networks and specialist identity verification remain connected authorities as described in CONTRACT.md; those boundaries do not remove Blotter's named integration or follow-up journeys.
