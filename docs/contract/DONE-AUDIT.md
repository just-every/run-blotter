Old reference: `ca2596bae4c081a2df169d327b23c0030428b918`.
| Clause | Point | Outcome | Asserting test | Result |
| --- | --- | --- | --- | --- |
| WORK-002 | 1 | Enable monthly. | none | none |
| WORK-002 | 1 | fiscal-year recurrence with a three-month lead time, let scheduled work become due. | none | none |
| WORK-002 | 1 | inspect exactly the periods inside the lead time, each once, with fresh requests. | none | none |
| WORK-002 | 2 | Attach two existing future jobs to a monthly rule. | none | none |
| WORK-002 | 2 | advance the horizon. | none | none |
| WORK-002 | 2 | the rule creates only the following period. | none | none |
| WORK-002 | 3 | Restart the scheduler, pause a client, skip a period. | none | none |
| WORK-002 | 3 | override a due date. | none | none |
| WORK-002 | 3 | no duplicate or silently altered prior job appears. | none | none |
| WORK-002 | 4 | Periods start on the first period's day in the chosen months, which are the template's own monthly, quarterly or annual cadence or a subset of it (custom schedules). | none | none |
| WORK-002 | 4 | a fiscal year is an annual first period in its first month. | none | none |
| WORK-002 | 5 | The end date is the last period's start, inclusive. | none | none |
| WORK-002 | 6 | The lead time is whole months: a period's job is created once the run's UTC calendar date reaches its start less the lead time. | none | none |
| WORK-002 | 7 | Its due date is the period's last day plus the rule's calendar days (a firm rule), or, when the rule names a client obligation, that obligation's calculated working due date for the period (DUE-001, DUE-003), shown in the rule's preview. | none | none |
| WORK-002 | 7 | stored with each job it creates. | none | none |
| WORK-010 | 1 | Budget is the rule's time budget in minutes, copied to each job. | none | none |
| WORK-010 | 1 | staff, fresh document requests. | none | none |
| WORK-010 | 1 | the template's task dependencies (WORK-003) come with each job. | none | none |
| WORK-010 | 2 | The scheduler is an hourly Cron Trigger (minute 17, UTC. | none | none |
| WORK-010 | 2 | `rer dev` runs it. | none | none |
| WORK-010 | 2 | deploys register it) plus Run now. | none | none |
| WORK-010 | 2 | each run creates, in order, every period through the horizon not yet held (generated, claimed or skipped), so restarts repeat nothing. | none | none |
| WORK-010 | 2 | runs after downtime or a pause catch up. | none | none |
| WORK-010 | 3 | A job that already exists for the client, template. | none | none |
| WORK-010 | 3 | period is claimed instead of duplicated. | none | none |
| WORK-010 | 3 | staff may also claim one. | none | none |
| WORK-010 | 3 | imported future items (MIGRATE-006) must be claimed the same way before that clause ships. | none | none |
| WORK-010 | 4 | Skipping needs a reason. | none | none |
| WORK-010 | 5 | A rule whose people can no longer do the work is held. | none | none |
| WORK-010 | 5 | named in the run log, never reassigned. | none | none |
| WORK-010 | 6 | Created jobs are never changed by a rule: a person overrides a due date on the job. | none | none |
| WORK-010 | 6 | sign-offs stay immutable. | none | none |
| US-001 | 1 | Set up a US bookkeeping. | none | none |
| US-001 | 1 | tax practice, add an LLC. | none | none |
| US-001 | 1 | individual client, select USD. | none | none |
| US-001 | 1 | America/New_York. | none | none |
| US-001 | 1 | create payroll, sales-tax. | none | none |
| US-001 | 1 | annual-tax work. | none | none |
| US-001 | 2 | Inspect currency. | none | none |
| US-001 | 2 | dates across a daylight-saving change. | none | none |
| US-001 | 2 | imported AUD history remains AUD. | none | none |
| US-001 | 3 | Existing money rows. | none | none |
| US-001 | 3 | historical export snapshots remain AUD, with no conversion or relabeling. | none | none |
| US-001 | 4 | Jobs inherit their template currency, time requires a rate in that currency, mixed-currency exports are refused. | none | none |
| US-001 | 4 | WIP, reimbursement. | none | none |
| US-001 | 4 | pipeline fee totals are grouped by currency. | none | none |
| US-001 | 5 | New client EINs accept nine digits. | none | none |
| US-001 | 5 | eleven-digit ABNs remain legacy ABNs. | none | none |
| US-001 | 6 | Native. | none | none |
| US-001 | 6 | CSV inputs retain that distinction. | none | none |
| US-001 | 6 | search keeps SEARCH-001 role restrictions. | none | none |
| US-001 | 6 | last-four masking. | none | none |
| US-001 | 7 | The demo uses US filings. | none | none |
| US-001 | 7 | America/New_York office instants, using each date’s daylight-saving offset. | none | none |
| CRM-001 | 1 | Create a business with two contacts. | none | none |
| CRM-001 | 1 | an individual linked to its owner. | none | none |
| CRM-001 | 1 | assign different staff. | none | none |
| CRM-001 | 1 | portal permissions, change a contact, archive/reactivate the business. | none | none |
| CRM-001 | 1 | inspect retained jobs. | none | none |
| CRM-001 | 2 | A contact without entity authority cannot read its records. | none | none |
| CRM-001 | 3 | Each contact relationship belongs to one entity. | none | none |
| CRM-001 | 3 | the same normalized email may represent several entities without pooling authority. | none | none |
| CRM-001 | 4 | Staff explicitly record primary/billing/tax/bookkeeping roles, signer authority, portal permission. | none | none |
| CRM-001 | 4 | request/email consent, with a note. | none | none |
| CRM-001 | 5 | Existing single contacts retain only their existing entity's collection authority. | none | none |
| CRM-001 | 6 | Requests. | none | none |
| CRM-001 | 6 | deliverables choose an authorized, consented recipient explicitly or the unique primary contact. | none | none |
| CRM-001 | 6 | ambiguous primaries refuse a send. | none | none |
| CRM-001 | 7 | A job link authenticates possession only. | none | none |
| CRM-001 | 7 | is bound to that entity/contact. | none | none |
| CRM-001 | 7 | contact edits revoke its old links. | none | none |
| CRM-001 | 7 | every portal read/write rechecks active entity, authority. | none | none |
| CRM-001 | 7 | consent. | none | none |
| CRM-001 | 8 | PORTAL-002 inherits identified portal accounts, recovery. | none | none |
| CRM-001 | 8 | MFA. | none | none |
| CRM-001 | 8 | BILL-002. | none | none |
| CRM-001 | 8 | SIGN-001/SIGN-002/ENGAGE-001 inherit billing/tax/signer routing before those capabilities ship. | none | none |
| CRM-006 | 1 | ACCESS-002 inherits configurable staff grants. | none | none |
| CRM-006 | 1 | assignments today never widen existing job visibility. | none | none |
| CRM-006 | 2 | Archive blocks new work, recurrence generation. | none | none |
| CRM-006 | 2 | client sends while preserving engagements/history. | none | none |
| CRM-006 | 2 | reactivation allows fresh links but never revives revoked ones. | none | none |
| CRM-006 | 3 | Phone normalization removes punctuation, adds +1 to ten-digit US numbers. | none | none |
| CRM-006 | 3 | otherwise requires a country code (8–15 digits). | none | none |
| CRM-006 | 3 | duplicate proposals use exact normalized phone. | none | none |
| CRM-006 | 4 | Individuals store only four SSN digits, never a full SSN. | none | none |
| CRM-006 | 4 | matching/search is principal/reviewer-only. | none | none |
| CRM-006 | 4 | output is masked. | none | none |
| CRM-006 | 5 | Contact merges need the principal's per-contact recorded authority whenever either side would gain records, preserve distinct relationships without combining consent, revoke old links. | none | none |
| CRM-006 | 5 | support CRM-004's unchanged 30-day undo. | none | none |
| CRM-006 | 6 | Prospect conversion copies all additional contacts once. | none | none |
| CRM-006 | 7 | Offboarding previews. | none | none |
| CRM-006 | 7 | transfers partner/team responsibilities. | none | none |
| CRM-006 | 7 | archive restore preserves contact grants. | none | none |
| CRM-006 | 7 | lifecycle. | none | none |
| CRM-003 | 1 | Open a client after two periods of work. | none | none |
| CRM-003 | 1 | trace a request from email through upload, review. | none | none |
| CRM-003 | 1 | payment. | none | none |
| CRM-003 | 2 | Filter unresolved items, change their owner. | none | none |
| CRM-003 | 2 | inspect authors, source links. | none | none |
| CRM-003 | 2 | timestamps. | none | none |
| CRM-003 | 2 | a preparer sees only authorized history. | none | none |
| CRM-003 | 3 | Unresolved items are open requests (owner: the job's preparer), open tasks (their named or role owner), jobs in review (the reviewer), open discussions (their owner). | none | none |
| CRM-003 | 3 | open notices (their assignee), each with its next action. | none | none |
| CRM-003 | 3 | due condition (the job's due date, a follow-up date or a response date), filterable by owner. | none | none |
| CRM-003 | 3 | resolving a discussion completes nothing else. | none | none |
| CRM-003 | 4 | A reviewer or the principal hands an item to another person: a request's owner is its job's preparer. | none | none |
| CRM-003 | 4 | a review's its reviewer, so those reassign the job. | none | none |
| CRM-003 | 4 | nobody is made to review their own work. | none | none |
| CRM-003 | 4 | a task is assigned by name (WORK-009 read access). | none | none |
| CRM-003 | 4 | a discussion goes only to someone who can read it. | none | none |
| CRM-003 | 4 | every handover is audited. | none | none |
| CRM-003 | 5 | A preparer sees only the jobs they may read (ACCESS-001). | none | none |
| CRM-003 | 5 | client-wide records. | none | none |
| CRM-003 | 5 | exports only reach reviewers. | none | none |
| CRM-003 | 5 | the principal. | none | none |
| CRM-007 | 1 | Today's email is the document reminder. | none | none |
| CRM-007 | 1 | connected-mailbox email (MAIL-001), portal messages (PORTAL-003), signed scope (ENGAGE-001), invoices (BILL-002). | none | none |
| CRM-007 | 1 | payments (PAY-001) write their events into this history, with author, time. | none | none |
| CRM-007 | 1 | source link. | none | none |
| CRM-007 | 1 | the same visibility, before they ship. | none | none |
| CRM-004 | 1 | Import a Karbon client that duplicates a native client. | none | none |
| CRM-004 | 1 | accept the suggested match. | none | none |
| CRM-004 | 2 | Choose field values, merge. | none | none |
| CRM-004 | 2 | inspect the moved jobs, email, invoices. | none | none |
| CRM-004 | 2 | portal access on the survivor with exactly one QBO mapping. | none | none |
| CRM-004 | 3 | Undo the merge before further edits. | none | none |
| CRM-004 | 3 | inspect the restored records. | none | none |
| CRM-004 | 3 | then repeat the merge, re-run the import. | none | none |
| CRM-004 | 3 | confirm it matches the survivor without creating a duplicate. | none | none |
| CRM-004 | 4 | A merge joining two unrelated entities' contacts without authority is refused. | none | none |
| CRM-004 | 5 | Phone. | none | none |
| CRM-004 | 5 | last-four SSN matches join when CRM-001 stores them, before CRM-001 ships. | none | none |
| CRM-004 | 6 | A person may record, with a reason, that a proposed pair is two different clients. | none | none |
| CRM-004 | 6 | it is not proposed again. | none | none |
| CRM-005 | 1 | Submit the embedded intake form. | none | none |
| CRM-005 | 1 | inspect the new prospect with source. | none | none |
| CRM-005 | 1 | answers. | none | none |
| CRM-005 | 1 | a spam submission is rejected. | none | none |
| CRM-005 | 2 | Book a consult, send a proposal. | none | none |
| CRM-005 | 2 | accept it. | none | none |
| CRM-005 | 2 | confirm one client with contacts, signed scope. | none | none |
| CRM-005 | 2 | onboarding work. | none | none |
| CRM-005 | 2 | repeat the acceptance event without a second client. | none | none |
| CRM-005 | 3 | Mark another prospect lost with a reason. | none | none |
| CRM-005 | 3 | inspect the pipeline report's conversion, stage age. | none | none |
| CRM-005 | 3 | fee totals. | none | none |
| CRM-005 | 4 | A prospect carries its name, contact, lead source, requested services, estimated annual fees (integer cents). | none | none |
| CRM-005 | 4 | owner (an active member). | none | none |
| CRM-005 | 4 | every stage change is kept with who. | none | none |
| CRM-005 | 4 | when. | none | none |
| CRM-005 | 5 | Moving to Lost needs a reason. | none | none |
| CRM-005 | 5 | Won is reached only by winning. | none | none |
| CRM-005 | 6 | Winning converts the prospect, in one batch, into exactly one client (its name. | none | none |
| CRM-005 | 6 | contact, the firm's required client fields supplied). | none | none |
| CRM-005 | 6 | starts its onboarding job from a chosen template (preparer, reviewer, period, due date. | none | none |
| CRM-005 | 6 | its source). | none | none |
| CRM-005 | 6 | a repeated win returns that client. | none | none |
| CRM-005 | 6 | job. | none | none |
| CRM-005 | 6 | creates nothing. | none | none |
| CRM-005 | 6 | a won prospect cannot be moved or lost again. | none | none |
| CRM-008 | 1 | The pipeline report, as of now in whole UTC days rounded down, gives per lead source. | none | none |
| CRM-008 | 1 | per owner the prospects, open, won. | none | none |
| CRM-008 | 1 | lost counts, conversion (won as a whole percentage of won plus lost. | none | none |
| CRM-008 | 1 | none until one closes). | none | none |
| CRM-008 | 1 | open, won. | none | none |
| CRM-008 | 1 | lost fee totals grouped by stored currency. | none | none |
| CRM-008 | 1 | per open stage the prospects in it with their average. | none | none |
| CRM-008 | 1 | oldest days in that stage. | none | none |
| SIGN-002 | 1 | Place fields on a PDF. | none | none |
| SIGN-002 | 1 | request sequential signatures from two contacts. | none | none |
| SIGN-002 | 2 | The first signer declines with a reason. | none | none |
| SIGN-002 | 2 | resend the request, then complete both signatures. | none | none |
| SIGN-002 | 3 | Inspect the signed file, its certificate, the signing order. | none | none |
| SIGN-002 | 3 | the timeline on the client. | none | none |
| SIGN-002 | 3 | work item. | none | none |
| SIGN-002 | 4 | A voided request cannot be signed afterwards. | none | none |
| SIGN-002 | 4 | a contact who is not a signer cannot open it. | none | none |
| SIGN-002 | 5 | offboard a preparer with a pending signature request. | none | none |
| SIGN-002 | 5 | it is listed, follows the successor. | none | none |
| SIGN-002 | 5 | no request is left owned by the deactivated member. | none | none |
| AUTHZ-001 | 1 | Prepare a 2848 covering Form 1040 for 2022–2025, collect the client's. | none | none |
| AUTHZ-001 | 1 | representative's signatures. | none | none |
| AUTHZ-001 | 1 | record its online submission. | none | none |
| AUTHZ-001 | 1 | CAF-recorded status. | none | none |
| AUTHZ-001 | 2 | Request a 2021 transcript. | none | none |
| AUTHZ-001 | 2 | confirm it is blocked as outside the authorization's scope, while a 2024 request proceeds. | none | none |
| AUTHZ-001 | 3 | Withdraw the authorization. | none | none |
| AUTHZ-001 | 3 | confirm the dependent notice work is flagged. | none | none |
| AUTHZ-001 | 3 | new transcript requests are refused. | none | none |
| AUTHZ-001 | 4 | A transcript request is recorded only inside a recorded 2848 or 8821 covering its form. | none | none |
| AUTHZ-001 | 4 | year (retrieval is INTEGRATE-006). | none | none |
| AUTHZ-001 | 5 | Agency contact on a DUE-002 notice needs a recorded 2848 (federal) or the state agency's recorded authorization covering the year in the notice's tax period. | none | none |
| AUTHZ-001 | 6 | Withdrawal writes a flag into the timeline of each open notice it covered, ends its transcript requests. | none | none |
| AUTHZ-001 | 6 | refuses new ones. | none | none |
| AUTHZ-001 | 7 | From October 1 of an authorization's last covered year, a client with an open job or active recurring rule raises one 'Authorization coverage ending' notification to the staff representative (or the principal), through the existing notification preferences, quiet hours. | none | none |
| AUTHZ-001 | 7 | live authority. | none | none |
| AUTHZ-001 | 8 | Every step is in the client's history. | none | none |
| AUTHZ-001 | 8 | the records are portable. | none | none |
| AUTHZ-001 | 8 | join the signed_documents (authorizations, representative. | none | none |
| AUTHZ-001 | 8 | CAF redacted on client erasure). | none | none |
| AUTHZ-001 | 8 | structure (transcript requests) classes. | none | none |
| WORK-003 | 1 | Create a close feeding a tax engagement, branch on an organizer answer. | none | none |
| WORK-003 | 1 | complete prerequisite tasks. | none | none |
| WORK-003 | 2 | Inspect automatic advancement. | none | none |
| WORK-003 | 2 | blocked successors. | none | none |
| WORK-003 | 2 | reject a cycle. | none | none |
| WORK-003 | 2 | record an authorized exception without fabricating evidence. | none | none |
| WORK-003 | 3 | A task may apply only when a job question has one of the chosen answers: unanswered, it waits. | none | none |
| WORK-003 | 3 | answered otherwise, it does not apply, is not needed for review. | none | none |
| WORK-003 | 3 | counts as satisfied for tasks waiting on it. | none | none |
| WORK-003 | 4 | Job staff can record workflow questions directly. | none | none |
| WORK-003 | 4 | confirmed PORTAL-004 submissions write their validated bound choices to those same questions, with contact attribution. | none | none |
| WORK-003 | 5 | Drafts. | none | none |
| WORK-003 | 5 | unconfirmed carried values never choose a workflow branch. | none | none |
| WORK-003 | 5 | future answer sources inherit those rules before shipping. | none | none |
| WORK-003 | 6 | Completion events (task done or reopened, document accepted, answer, job submitted, returned or signed off, exception) stamp each gated task that became ready. | none | none |
| WORK-003 | 6 | alert its owner. | none | none |
| WORK-003 | 6 | clear the stamp when it is blocked again. | none | none |
| WORK-003 | 7 | A cycle among a template's tasks is refused when it is saved. | none | none |
| WORK-003 | 7 | templates are saved as new versions that may wait only on templates that already exist, so cross-job waits cannot form a cycle. | none | none |
| WORK-011 | 1 | The job's reviewer, its manager or the principal may record an exception with a required reason: the task can then be worked, but nothing it waited for is completed, its own required attachment is still required, review still needs every applicable task done. | none | none |
| WORK-011 | 1 | every document accepted. | none | none |
| WORK-011 | 1 | an unanswered branch question is never waived. | none | none |
| WORK-004 | 1 | Preview quarterly jobs for the clients selected in a batch using per-client include/exclude. | none | none |
| WORK-004 | 1 | once CRM-002 client groups exist, verify choosing a group pre-selects its clients. | none | none |
| WORK-004 | 2 | Override two assignees, exclude one client. | none | none |
| WORK-004 | 2 | commit. | none | none |
| WORK-004 | 3 | Re-submit the same batch. | none | none |
| WORK-004 | 3 | inspect no duplicates, then bulk reassign work while refusing inactive or self-review assignments. | none | none |
| WORK-004 | 4 | Verify bulk start refuses every self-review assignment, including a principal assigned as both preparer. | none | none |
| WORK-004 | 4 | reviewer. | none | none |
| WORK-004 | 4 | verify a solo principal can instead start such a job one at a time with REVIEW-001’s acknowledged self-review. | none | none |
| WORK-006 | 1 | Plan a preparer's week from the overdue queue, group a 1040 board by sub-status, move an eligible card. | none | none |
| WORK-006 | 1 | inspect the same job's new status in queue, calendar. | none | none |
| WORK-006 | 1 | client views. | none | none |
| WORK-006 | 2 | A blocked review transition is refused. | none | none |
| WORK-006 | 2 | filters persist after refresh. | none | none |
| WORK-006 | 3 | the moved card's change appears in the job's status history. | none | none |
| WORK-006 | 4 | Each person plans their own week. | none | none |
| WORK-006 | 4 | until an admin role exists the principal opens. | none | none |
| WORK-006 | 4 | plans anyone's (pattern 2). | none | none |
| WORK-006 | 5 | Boards, calendars. | none | none |
| WORK-006 | 5 | the queue share filters over the jobs a person may read: work type, stage, sub-status, client, assignee (the job's preparer, reviewer, manager or partner), due dates as an inclusive range, overdue (due before today in UTC. | none | none |
| WORK-006 | 5 | not completed), blocked (open with remaining tasks of which none is ready, each waiting on a WORK-003 dependency or answer, with those reasons shown). | none | none |
| WORK-006 | 5 | priority (Low, Normal or High, Normal by default, set by the job's people until it is completed). | none | none |
| WORK-006 | 6 | A board has a column per stage, or for one chosen work type a column per stage. | none | none |
| WORK-006 | 6 | each sub-status that type may use (plus In review – partner sign-off when a job is in it). | none | none |
| WORK-006 | 6 | a card move is WORK-007's move, so In review. | none | none |
| WORK-006 | 6 | Completed are reached only by submission. | none | none |
| WORK-006 | 6 | sign-off. | none | none |
| WORK-012 | 1 | The firm calendar shows jobs. | none | none |
| WORK-012 | 1 | their open tasks on their due dates over at most 62 days. | none | none |
| WORK-012 | 1 | the client filter makes it one client's calendar. | none | none |
| WORK-012 | 2 | Moving a job's due date on the calendar is WORK-004's reschedule (principal or reviewer): its preview lists the task dates that follow it, anything that would fall due before today. | none | none |
| WORK-012 | 2 | each person's estimated demand against available hours (CAPACITY-001) in every week the job's estimated work leaves or enters. | none | none |
| WORK-012 | 2 | it commits only with that preview's fingerprint. | none | none |
| WORK-012 | 3 | Each person's last board filters (with the column grouping). | none | none |
| WORK-012 | 3 | calendar filters are kept for them, so a refresh opens the same view. | none | none |
| WORK-007 | 1 | Create a 1040 work type. | none | none |
| WORK-007 | 1 | two sub-statuses under Waiting: "on client documents". | none | none |
| WORK-007 | 1 | "on 8879 signature". | none | none |
| WORK-007 | 2 | Limit the second to 1040. | none | none |
| WORK-007 | 2 | confirm it is not offered on a Monthly Bookkeeping job. | none | none |
| WORK-007 | 3 | Move a 1040 job through both sub-statuses on the board. | none | none |
| WORK-007 | 4 | An automation fires once on entering "on 8879 signature". | none | none |
| WORK-007 | 5 | Filter the queue. | none | none |
| WORK-007 | 5 | a saved view by that sub-status. | none | none |
| WORK-007 | 5 | read a time-in-status report. | none | none |
| WORK-007 | 6 | Moving a job to Completed without review is refused. | none | none |
| WORK-007 | 7 | Deleting a sub-status in use is refused until a previewed bulk reassignment moves its jobs. | none | none |
| WORK-007 | 7 | status history is retained. | none | none |
| WORK-007 | 8 | Import a Karbon work item under MIGRATE-001. | none | none |
| WORK-007 | 8 | confirm it keeps its work type. | none | none |
| WORK-007 | 8 | status. | none | none |
| WORK-013 | 1 | filter the capacity week by the 1040 work type. | none | none |
| WORK-013 | 1 | see only 1040 demand. | none | none |
| WORK-008 | 1 | In a new US firm, browse the library. | none | none |
| WORK-008 | 1 | adopt the 1040. | none | none |
| WORK-008 | 1 | monthly close templates. | none | none |
| WORK-008 | 2 | Edit one task. | none | none |
| WORK-008 | 2 | start a job from each, then inspect the copied tasks, requests, relative dates, statuses. | none | none |
| WORK-008 | 2 | messages. | none | none |
| WORK-008 | 3 | Publish a library update, preview its diff, accept one change. | none | none |
| WORK-008 | 3 | reject another. | none | none |
| WORK-008 | 4 | The firm's edited task survives. | none | none |
| WORK-008 | 4 | existing jobs are unchanged. | none | none |
| WORK-008 | 5 | Each adoption makes a firm template, its own WORK-007 work type with all six stages, WORK-009 role tasks. | none | none |
| WORK-008 | 5 | relative dates, requests, an integer-minute default budget. | none | none |
| WORK-008 | 5 | MSG-001 message copies. | none | none |
| WORK-008 | 6 | Hours are minutes divided by 60, rounded to two decimals for display. | none | none |
| WORK-008 | 6 | planning offsets are whole days from the recorded period start or due date, not statutory calculations. | none | none |
| WORK-008 | 7 | The principal adopts a chosen version, edits tasks, requests. | none | none |
| WORK-008 | 7 | budget. | none | none |
| WORK-008 | 7 | edits messages through MSG-001. | none | none |
| WORK-008 | 8 | A new job copies the then-current tasks, requests, budget. | none | none |
| WORK-008 | 8 | message text/version. | none | none |
| WORK-008 | 8 | later library changes never mutate those jobs. | none | none |
| WORK-014 | 1 | Authored releases are bundled with the app. | none | none |
| WORK-014 | 1 | a principal can import a reviewed newer release package with its source/change note. | none | none |
| WORK-014 | 1 | author recorded. | none | none |
| WORK-014 | 2 | Imported releases are immutable, never claim agency verification. | none | none |
| WORK-014 | 2 | never change adoptions automatically. | none | none |
| WORK-014 | 3 | An update preview compares the prior adopted release, current firm copy (including MSG-001 edits/deletions). | none | none |
| WORK-014 | 3 | new release, one task, request, message, budget or description at a time. | none | none |
| WORK-014 | 4 | Each change is accepted or ignored. | none | none |
| WORK-014 | 4 | a conflicting firm edit must be retained. | none | none |
| WORK-014 | 4 | stale previews are refused. | none | none |
| WORK-014 | 5 | Ignored changes remain firm choices. | none | none |
| WORK-014 | 5 | the reviewed release becomes the next comparison baseline. | none | none |
| WORK-009 | 1 | Create a template with three tasks due 10, 5. | none | none |
| WORK-009 | 1 | 2 days before the work's due date, assigned to Preparer, Manager. | none | none |
| WORK-009 | 1 | a named person. | none | none |
| WORK-009 | 2 | Start a job. | none | none |
| WORK-009 | 2 | inspect the computed task dates. | none | none |
| WORK-009 | 2 | owners. | none | none |
| WORK-009 | 3 | Move the work's due date. | none | none |
| WORK-009 | 3 | see the open task dates follow. | none | none |
| WORK-009 | 4 | Change the job's Preparer. | none | none |
| WORK-009 | 4 | confirm the open tasks move to the new person, while a completed task keeps its original completer. | none | none |
| WORK-009 | 4 | time. | none | none |
| WORK-009 | 5 | Open a task's SOP link. | none | none |
| WORK-009 | 5 | see the tasks in the new owner's weekly plan. | none | none |
| DUE-001 | 1 | Configure all five obligation types for clients in two states. | none | none |
| DUE-001 | 1 | different fiscal years. | none | none |
| DUE-001 | 2 | Calculate a weekend/holiday case, import a source revision. | none | none |
| DUE-001 | 2 | preview affected jobs before approval. | none | none |
| DUE-001 | 3 | Record an extension. | none | none |
| DUE-001 | 3 | override. | none | none |
| DUE-001 | 3 | verify separate original/extended/internal dates, preserved provenance. | none | none |
| DUE-001 | 3 | no claim of filing from a checklist. | none | none |
| DUE-001 | 4 | Blotter does not fetch agency sites: a person imports each IRS or state revision. | none | none |
| DUE-001 | 5 | Until an admin role exists the principal approves each catalog rule for the firm (approving a state's rule selects that state. | none | none |
| DUE-001 | 5 | pattern 2). | none | none |
| DUE-001 | 5 | a principal or reviewer configures a client obligation: one approved rule with the client's two-letter state, fiscal-year-end month (calendar-year rules always December). | none | none |
| DUE-001 | 5 | internal lead days (0–90). | none | none |
| DUE-001 | 5 | a rule applies only to its entity types (individual, business, trust). | none | none |
| DUE-001 | 5 | a state rule only to its own state. | none | none |
| DUE-004 | 1 | A job started from an obligation, rolled forward from such a job, or created by a WORK-002 rule that names one takes its period from its template's cadence (starting on the first of a month. | none | none |
| DUE-004 | 1 | an annual period ends in the fiscal-year-end month, quarterly periods are the tax year's quarters). | none | none |
| DUE-004 | 1 | keeps these dates apart: the statutory date. | none | none |
| DUE-004 | 1 | the original due date, which is the statutory date moved to the next business day past Saturdays, Sundays. | none | none |
| DUE-004 | 1 | federal legal holidays (5 U.S.C. 6103. | none | none |
| DUE-004 | 1 | a Saturday holiday is observed the Friday before, a Sunday one the Monday after) and, for federal rules, DC Emancipation Day (16 April, observed. | none | none |
| DUE-004 | 1 | 26 U.S.C. 7503), with the reason recorded. | none | none |
| DUE-004 | 1 | the extended due date (shifted the same way), which applies once a person on the job records the extension request, or at once for an automatic extension. | none | none |
| DUE-004 | 1 | a relief date from an approved disaster postponement whose jurisdiction, states, rules. | none | none |
| DUE-004 | 1 | inclusive window cover the original or extended date. | none | none |
| DUE-004 | 1 | the internal target (that external date less the obligation's lead days, moved earlier to a business day). | none | none |
| DUE-004 | 1 | and any override. | none | none |
| DUE-005 | 1 | The job's working due date is the override, else the relief, extended or original date. | none | none |
| DUE-005 | 1 | an override needs a principal or reviewer. | none | none |
| DUE-005 | 1 | a reason. | none | none |
| DUE-005 | 1 | never changes a calculated date. | none | none |
| DUE-005 | 2 | A source revision is a JSON document with version, effective date, https source. | none | none |
| DUE-005 | 2 | changed rules (keeping each rule's key. | none | none |
| DUE-005 | 2 | jurisdiction) or relief windows. | none | none |
| DUE-005 | 2 | only the principal previews. | none | none |
| DUE-005 | 2 | approves it. | none | none |
| DUE-005 | 3 | The preview lists every job not yet signed off whose dates or rule version change. | none | none |
| DUE-005 | 3 | approval commits only with that preview's fingerprint, approving the revision's rules. | none | none |
| DUE-005 | 3 | recalculating those jobs. | none | none |
| DUE-005 | 3 | a job whose working date was set by hand (an override, or a WORK-004/WORK-006 move) keeps it while its calculated dates update. | none | none |
| DUE-005 | 4 | Filing is never inferred from a checklist, review, sign-off or status: only a recorded agency acknowledgment (submission ID, accepted date. | none | none |
| DUE-005 | 4 | an acknowledgment file on the job, labeled practitioner-recorded until INTEGRATE-008 supplies stack status) marks a return filed. | none | none |
| DUE-005 | 4 | a job whose extension was recorded cannot be signed off until it exists (pattern 3). | none | none |
| DUE-005 | 5 | Under the held company policy, agent keys cannot approve rules or revisions. | none | none |
| DUE-005 | 6 | Rules, revisions, relief, obligations. | none | none |
| DUE-005 | 6 | job dates are carried by native archives. | none | none |
| DUE-005 | 6 | move with a merged client (CRM-004). | none | none |
| DUE-005 | 6 | the acknowledgment file follows file erasure. | none | none |
| DUE-005 | 6 | stale-archive fencing. | none | none |
| DUE-002 | 1 | Open a notice from a client upload, verify the response deadline, assign a practitioner, link an authorized transcript. | none | none |
| DUE-002 | 1 | response receipt. | none | none |
| DUE-002 | 1 | schedule follow-up. | none | none |
| DUE-002 | 2 | A failed response stays open. | none | none |
| DUE-002 | 2 | closing requires evidence. | none | none |
| DUE-002 | 2 | a recorded outcome. | none | none |
| DUE-003 | 1 | Configure 1040-ES quarterly estimates including a weekend shift, the January 31 W-2. | none | none |
| DUE-003 | 1 | 1099-NEC deadlines, an FBAR with its automatic October extension. | none | none |
| DUE-003 | 1 | a firm rule of 15 days after month end. | none | none |
| DUE-003 | 2 | Inspect the calculated dates. | none | none |
| DUE-003 | 2 | their sources. | none | none |
| DUE-003 | 3 | Import a source revision. | none | none |
| DUE-003 | 3 | preview the affected jobs before approving it. | none | none |
| DUE-003 | 4 | The firm rule shows as firm-defined rather than as an agency deadline. | none | none |
| DUE-003 | 5 | Only the principal defines a firm rule (defining it approves it. | none | none |
| DUE-003 | 5 | pattern 2): a fixed month. | none | none |
| DUE-003 | 5 | day (the first such date after the period ends), a number of calendar days after the period ends, or the nth (1–5, or last) weekday of the month a chosen number of months after the period-end month. | none | none |
| DUE-003 | 6 | It carries an optional source or label (default "Firm-defined"). | none | none |
| DUE-003 | 6 | shows as a firm-defined deadline, never as an agency deadline, with no source URL. | none | none |
| DUE-003 | 6 | DUE-001's holiday shift (federal legal holidays, without DC Emancipation Day), obligation, override, revision. | none | none |
| DUE-003 | 6 | provenance rules apply to it unchanged. | none | none |
| MSG-001 | 1 | Create a "Month-end close request" firm template with client, period, due-date. | none | none |
| MSG-001 | 1 | outstanding-items placeholders. | none | none |
| MSG-001 | 2 | Use it in an inbox reply. | none | none |
| MSG-001 | 2 | as step 2 of a reminder sequence. | none | none |
| MSG-001 | 2 | inspect the rendered text for two clients with different periods. | none | none |
| MSG-001 | 2 | outstanding lists. | none | none |
| MSG-001 | 3 | Remove one client's contact first name. | none | none |
| MSG-001 | 3 | confirm the send is refused naming that field. | none | none |
| MSG-001 | 4 | Edit the template. | none | none |
| MSG-001 | 4 | confirm messages already sent are unchanged while the next reminder uses the new version. | none | none |
| MSG-001 | 5 | A preparer cannot edit the firm template but can save a personal copy. | none | none |
| MSG-001 | 6 | Every message made from a template is sent with that version's files, even when the sender edited its text. | none | none |
| MSG-001 | 6 | the sent message records each file's name, type, size. | none | none |
| MSG-001 | 6 | SHA-256. | none | none |
| COLLAB-001 | 1 | Submit work, receive the assigned reviewer's notification, mention a colleague. | none | none |
| COLLAB-001 | 1 | request a correction. | none | none |
| COLLAB-001 | 2 | Resolve it as the preparer, inspect the retained thread. | none | none |
| COLLAB-001 | 2 | verify that the client. | none | none |
| COLLAB-001 | 2 | unassigned staff cannot read private discussion. | none | none |
| NOTIFY-001 | 1 | Assign a job. | none | none |
| NOTIFY-001 | 1 | a task to a preparer. | none | none |
| NOTIFY-001 | 2 | Make one job due tomorrow. | none | none |
| NOTIFY-001 | 2 | one overdue, mention the preparer. | none | none |
| NOTIFY-001 | 2 | have a client upload a file. | none | none |
| NOTIFY-001 | 3 | Inspect the in-app notifications, the emails for the events the preparer chose. | none | none |
| NOTIFY-001 | 3 | a 7:00 local-time digest that lists due-soon. | none | none |
| NOTIFY-001 | 3 | overdue items once. | none | none |
| NOTIFY-001 | 4 | Turn off email for mentions. | none | none |
| NOTIFY-001 | 4 | confirm mentions then arrive in-app only. | none | none |
| NOTIFY-001 | 5 | A firm-mandatory event cannot be muted. | none | none |
| NOTIFY-001 | 5 | no SSN or EIN appears in any subject line. | none | none |
| NOTIFY-001 | 6 | ENGAGE-001/SIGN-001/SIGN-002 inherit completed-signature events, MAIL-001. | none | none |
| NOTIFY-001 | 6 | LEDGER-001/INTEGRATE-001–008 inherit connected replies/sync failures. | none | none |
| NOTIFY-001 | 6 | PAY-001/PAY-002 inherit received/failed payments. | none | none |
| NOTIFY-001 | 7 | Each carrier must assert its inherited notification behavior through a named public door before activation. | none | none |
| NOTIFY-001 | 8 | Existing review, discussion, client-question/to-do, task-ready, coverage. | none | none |
| NOTIFY-001 | 8 | report email delivery remains enabled by default. | none | none |
| NOTIFY-002 | 1 | Approved coverage receipts still reach their recorded active participants before first sign-in or after the job moves. | none | none |
| NOTIFY-002 | 1 | the receipt grants no job access or fresh job data. | none | none |
| NOTIFY-002 | 2 | Newly introduced events start in-app only until the individual enables email or the principal explicitly configures that event as mandatory. | none | none |
| NOTIFY-002 | 2 | defaults alone never silently opt users into new email kinds. | none | none |
| NOTIFY-002 | 3 | The principal alone sets defaults/mandatory email events. | none | none |
| NOTIFY-002 | 3 | personal choices cannot suppress mandatory delivery. | none | none |
| NOTIFY-002 | 4 | In-app notices always remain available. | none | none |
| NOTIFY-002 | 5 | Due-soon means an unfinished active-client job with its recorded due day between the user-local today. | none | none |
| NOTIFY-002 | 5 | today plus the chosen whole calendar-day lead (0–365), inclusive. | none | none |
| NOTIFY-002 | 5 | overdue means strictly before today. | none | none |
| NOTIFY-002 | 6 | Repeated scheduler runs collapse each job/recipient/due-day/kind. | none | none |
| NOTIFY-002 | 7 | The daily digest lists each currently eligible job once, at the first hourly trigger at or after the user-local time, once per local date including repeated DST hours. | none | none |
| NOTIFY-002 | 8 | Firm notification hours still apply. | none | none |
| NOTIFY-002 | 8 | personal quiet start is inclusive. | none | none |
| NOTIFY-002 | 8 | end exclusive, may span midnight. | none | none |
| NOTIFY-002 | 8 | equal times disable personal quiet hours. | none | none |
| NOTIFY-003 | 1 | Deferred deliveries wait for the next permitted trigger. | none | none |
| NOTIFY-003 | 2 | Every center read. | none | none |
| NOTIFY-003 | 2 | dispatch rechecks current staff/item authority, including revoked named-task access. | none | none |
| NOTIFY-003 | 2 | none broadens recipients. | none | none |
| NOTIFY-003 | 3 | Subjects redact nine-digit SSN/EIN formats. | none | none |
| NOTIFY-003 | 3 | new event summaries contain no client content. | none | none |
| NOTIFY-003 | 4 | Attempts are claimed before transport. | none | none |
| NOTIFY-003 | 4 | retained honestly, never blindly retried after failure or uncertainty. | none | none |
| NOTIFY-003 | 5 | Settings/read marks/consumption history are portable. | none | none |
| NOTIFY-003 | 5 | unfinished notices remain held. | none | none |
| NOTIFY-003 | 5 | digests restore disabled until deliberately enabled. | none | none |
| NOTIFY-003 | 6 | Native source erasure retains only safe notice metadata. | none | none |
| NOTIFY-003 | 6 | stale-archive fencing. | none | none |
| NOTIFY-003 | 7 | ERASURE-002 inherits whole-client notice/settings retention. | none | none |
| NOTIFY-003 | 7 | approved erasure before shipping. | none | none |
| PORTAL-002 | 1 | Invite two contacts with different entity access, sign in with a second factor on the installation host. | none | none |
| PORTAL-002 | 1 | recover a lost factor. | none | none |
| PORTAL-002 | 2 | Revoke one contact mid-session. | none | none |
| PORTAL-002 | 2 | attempt direct document. | none | none |
| PORTAL-002 | 2 | API access. | none | none |
| PORTAL-002 | 2 | inspect refusal without exposing another entity. | none | none |
| PORTAL-002 | 3 | The principal or a reviewer (never a preparer) invites one active, authorized, portal-enabled contact with an email address. | none | none |
| PORTAL-002 | 3 | email consent. | none | none |
| PORTAL-002 | 3 | the emailed invitation (one use, 7 days) opens only that contact's entity, so a person who is a contact on several entities is invited on each. | none | none |
| PORTAL-002 | 3 | switches among the ones accepted. | none | none |
| PORTAL-002 | 4 | Sign-in is an emailed one-use link (15 minutes, at most five an hour. | none | none |
| PORTAL-002 | 4 | the reply never says whether an address has access. | none | none |
| PORTAL-002 | 4 | the mail goes after the reply) followed by a TOTP second factor, required unless the principal records otherwise (default: required). | none | none |
| PORTAL-002 | 5 | Each factor comes with ten one-time recovery codes. | none | none |
| PORTAL-002 | 5 | a recovery code opens only the setup of a new factor, which replaces the lost one, issues new codes. | none | none |
| PORTAL-002 | 5 | ends the account's other sessions. | none | none |
| PORTAL-002 | 5 | the principal can reset a factor with a recorded reason, ending every session. | none | none |
| PORTAL-002 | 6 | Invitations revoke every existing account session, as do contact edits other than a language-only change. | none | none |
| PORTAL-007 | 1 | Invitation. | none | none |
| PORTAL-007 | 1 | reset acknowledgments are identical for existing. | none | none |
| PORTAL-007 | 1 | nonexistent accounts. | none | none |
| PORTAL-007 | 1 | staff eligibility. | none | none |
| PORTAL-007 | 1 | role checks still apply. | none | none |
| PORTAL-007 | 2 | Five wrong codes in 15 minutes lock the account for 15 minutes. | none | none |
| PORTAL-007 | 3 | Sessions are server-side rows behind an HttpOnly, Secure, SameSite=Strict cookie. | none | none |
| PORTAL-007 | 3 | last 8 hours. | none | none |
| PORTAL-007 | 3 | every request rechecks the session, the account. | none | none |
| PORTAL-007 | 3 | each entity's grant, contact (active, authorized, portal permission, the account's address). | none | none |
| PORTAL-007 | 3 | entity, so a revoked grant, a changed contact or an archived entity refuses on the next request with the same "not found" as an entity the account never held. | none | none |
| PORTAL-007 | 3 | nothing is shown before the second factor passes. | none | none |
| PORTAL-007 | 4 | Signed in, a client sees per entity the work the firm already sent that contact (a link or a signature request) with its client-facing progress, the documents shared with that contact (deliverables keep BILL-005's payment gate), its signature requests (the signed PDF once completed). | none | none |
| PORTAL-007 | 4 | the bills addressed to it (PDF), in the contact's language (PORTAL-005). | none | none |
| PORTAL-007 | 4 | manages notification preferences: marketing email stops there at once (a `portal_preference` withdrawal, renewed only by a new recorded opt-in), while notices about the client's own work (requests, organizers, signatures, deliverables, bills) are not optional, so no engagement mail is suppressed by a portal switch (adopted default). | none | none |
| PORTAL-008 | 1 | Staff actions, client sign-ins, factors, recoveries, refused codes. | none | none |
| PORTAL-008 | 1 | reads of signed PDFs. | none | none |
| PORTAL-008 | 1 | bills are audited. | none | none |
| PORTAL-008 | 1 | invitations. | none | none |
| PORTAL-008 | 1 | revocations appear in the client history. | none | none |
| PORTAL-008 | 2 | Archives carry accounts. | none | none |
| PORTAL-008 | 2 | grants but never invitations, sign-in links, sessions, recovery codes or factors, so a restored account sets up a new factor. | none | none |
| PORTAL-008 | 3 | Whole-client erasure revokes the entity's grants. | none | none |
| PORTAL-008 | 3 | deletes its invitations. | none | none |
| PORTAL-008 | 3 | an account that opens no other entity loses its address. | none | none |
| PORTAL-008 | 3 | factor. | none | none |
| PORTAL-008 | 3 | its sessions, links, codes. | none | none |
| PORTAL-008 | 3 | failures are deleted. | none | none |
| PORTAL-008 | 4 | A CRM-004 merge suspends the grants of the contacts it moves (invite them again on the surviving entity). | none | none |
| PORTAL-008 | 4 | its undo restores them. | none | none |
| PORTAL-008 | 5 | The portal is served on the installation host. | none | none |
| PORTAL-008 | 5 | PORTAL-006 carries firm custom-domain sign-in. | none | none |
| PORTAL-008 | 6 | Scoped upload links remain a separately controlled collection method. | none | none |
| PORTAL-008 | 7 | The principal brands the portal with a PNG or JPEG logo (up to 256 KiB, recognised by its bytes. | none | none |
| PORTAL-008 | 7 | SVG is refused). | none | none |
| PORTAL-008 | 7 | an accent colour, shown on every portal page including sign-in. | none | none |
| PORTAL-008 | 7 | the signed-in page. | none | none |
| PORTAL-008 | 7 | the invitation. | none | none |
| PORTAL-008 | 7 | sign-in emails carry the firm's name. | none | none |
| PORTAL-008 | 8 | Custom-domain sign-in belongs to PORTAL-006. | none | none |
| PORTAL-009 | 1 | The portal marketing grant stays with MSG-002's portal channel, asserted on its doors before portal marketing ships. | none | none |
| PORTAL-003 | 1 | Open an engagement as a client, ask a secure question, complete one to-do. | none | none |
| PORTAL-003 | 1 | inspect the preparer's queue. | none | none |
| PORTAL-003 | 1 | progress view after review. | none | none |
| PORTAL-003 | 2 | Confirm internal notes. | none | none |
| PORTAL-003 | 2 | another entity's tasks remain hidden. | none | none |
| PORTAL-003 | 3 | a client's secure question appears in the client history. | none | none |
| PORTAL-003 | 3 | as an unresolved item with its owner. | none | none |
| PORTAL-003 | 4 | The link shows the job's status as WORK-007 sets it (a sub-status's client label, else the stage name). | none | none |
| PORTAL-003 | 5 | Progress is four milestones: Documents (received. | none | none |
| PORTAL-003 | 5 | accepted of requested), Preparation (applicable steps done. | none | none |
| PORTAL-003 | 5 | done once the job leaves open), Review (in review, then reviewed at sign-off). | none | none |
| PORTAL-003 | 5 | Completed (signed off), with a stage (collecting while any request is outstanding, preparing, in review, completed). | none | none |
| PORTAL-003 | 5 | the client's next action: upload the outstanding documents. | none | none |
| PORTAL-003 | 5 | complete the open to-dos, or nothing needed. | none | none |
| PORTAL-003 | 6 | Staff control what is client-visible: the link shows request labels, status. | none | none |
| PORTAL-003 | 6 | return notes, client-facing tasks (WORK-009), progress counts. | none | none |
| PORTAL-003 | 6 | the messages. | none | none |
| PORTAL-003 | 6 | to-dos staff put on the link. | none | none |
| PORTAL-003 | 6 | internal discussions (COLLAB-001), internal tasks. | none | none |
| PORTAL-003 | 6 | their instructions, staff emails, time. | none | none |
| PORTAL-003 | 6 | every other job (another client's or another entity's) never reach it. | none | none |
| PORTAL-003 | 6 | CRM-001 entity relationships inherit this one-job scope before they ship. | none | none |
| PORTAL-010 | 1 | A client question is owned by the job's preparer when it is asked, alerts them (in-app. | none | none |
| PORTAL-010 | 1 | by mail), counts in the job queue as an open client question. | none | none |
| PORTAL-010 | 1 | stays open until a staff member who can write to the job answers it on the link. | none | none |
| PORTAL-010 | 1 | answering closes only that question. | none | none |
| PORTAL-010 | 2 | Staff set to-dos for the client (with an optional due date). | none | none |
| PORTAL-010 | 2 | own them. | none | none |
| PORTAL-010 | 2 | the client completes one with an optional reply, which alerts its owner. | none | none |
| PORTAL-010 | 2 | completes no request, task or other to-do. | none | none |
| PORTAL-010 | 3 | Staff messages appear on the link only: no email is sent for them. | none | none |
| PORTAL-010 | 4 | A client may hold at most 20 unanswered questions per job. | none | none |
| PORTAL-010 | 4 | the client's writes are same-origin only. | none | none |
| PORTAL-010 | 4 | refused once the link is replaced, expired or the job is signed off. | none | none |
| PORTAL-010 | 5 | Questions. | none | none |
| PORTAL-010 | 5 | to-dos are CRM-003 unresolved items that change hands like any other. | none | none |
| PORTAL-010 | 5 | move with ACCESS-006 offboarding. | none | none |
| PORTAL-010 | 5 | every question, answer, message, to-do. | none | none |
| PORTAL-010 | 5 | completion is in the client history. | none | none |
| PORTAL-004 | 1 | Send an organizer, answer an ownership question that reveals a dependent section, save/resume on a phone. | none | none |
| PORTAL-004 | 1 | attach evidence. | none | none |
| PORTAL-004 | 2 | Submit, correct one answer. | none | none |
| PORTAL-004 | 2 | inspect both versions. | none | none |
| PORTAL-004 | 2 | the resulting request list. | none | none |
| PORTAL-004 | 2 | unconfirmed carried answers stay unresolved. | none | none |
| PORTAL-004 | 3 | Definitions contain ordered text or choice questions, required flags, conditions on earlier choice answers, supporting document requests. | none | none |
| PORTAL-004 | 3 | optional WORK-003 workflow-question bindings. | none | none |
| PORTAL-004 | 4 | A job snapshots its definition at creation. | none | none |
| PORTAL-004 | 4 | edits. | none | none |
| PORTAL-004 | 4 | newer releases change future jobs only. | none | none |
| PORTAL-004 | 5 | Every question has one explicitly assigned active, authorized, consented CRM-001 contact on that entity. | none | none |
| PORTAL-004 | 5 | several contacts can divide one organizer. | none | none |
| PORTAL-004 | 6 | Assigned full-scope staff preview. | none | none |
| PORTAL-004 | 6 | send MSG-001 invitations per contact, refusing unresolved placeholders. | none | none |
| PORTAL-004 | 6 | keeping exact rendered text, version attachments. | none | none |
| PORTAL-004 | 6 | honest provider-acceptance outcomes. | none | none |
| PORTAL-004 | 7 | Each contact's new link rotates only that job/contact's prior links. | none | none |
| PORTAL-004 | 7 | current authority, consent, expiry. | none | none |
| PORTAL-004 | 7 | job state are rechecked on every call. | none | none |
| PORTAL-004 | 8 | A contact receives only their assigned question details. | none | none |
| PORTAL-004 | 8 | server-computed branch applicability, never another contact's answers or staff review notes. | none | none |
| PORTAL-011 | 1 | Draft answers save/resume on the same link. | none | none |
| PORTAL-011 | 1 | current confirmation reveals dependent questions. | none | none |
| PORTAL-011 | 1 | supporting requests, while only a submitted confirmed answer drives WORK-003 workflow. | none | none |
| PORTAL-011 | 2 | Each contact submits their currently applicable set, required answers must be confirmed. | none | none |
| PORTAL-011 | 2 | later corrections create another immutable submitted original. | none | none |
| PORTAL-011 | 3 | Staff inspect completeness by responsible contact, changed values, authors/times, review findings. | none | none |
| PORTAL-011 | 3 | every submission version. | none | none |
| PORTAL-011 | 4 | A request that no longer applies leaves the active request/reminder/review gate while its previously uploaded originals remain in DOC-001/002 custody. | none | none |
| PORTAL-011 | 5 | Prior-period carry uses the same client's/template's latest submitted confirmed answers, shows its provenance only to the original responsible contact. | none | none |
| PORTAL-011 | 5 | remains unconfirmed until that contact explicitly confirms current evidence. | none | none |
| PORTAL-011 | 5 | unconfirmed carry cannot complete an organizer or choose a workflow branch. | none | none |
| PORTAL-011 | 6 | WORK-008 library releases/adoptions carry organizer definitions. | none | none |
| PORTAL-011 | 6 | individual question changes, preserve firm edits. | none | none |
| PORTAL-011 | 6 | snapshot jobs. | none | none |
| PORTAL-011 | 6 | optional workflow bindings must match the template's choice questions. | none | none |
| PORTAL-011 | 7 | Owner-only typed-name/reason erasure removes answer payloads, source-linked workflow values. | none | none |
| PORTAL-011 | 7 | still-derived carry copies, retains ids/authors/times/review attribution. | none | none |
| PORTAL-011 | 7 | a marker, leaves job sign-off. | none | none |
| PORTAL-011 | 7 | separately managed file custody intact. | none | none |
| PORTAL-011 | 7 | uses Base's redaction journal to fence stale restores. | none | none |
| PORTAL-011 | 8 | ERASURE-002 supplies actual future hold/signed-record retention before such records ship. | none | none |
| PORTAL-012 | 1 | Organizer data follows job/contact relationships during CRM-004 merge/undo. | none | none |
| PORTAL-012 | 1 | native archive restore. | none | none |
| PORTAL-012 | 1 | portal tokens remain excluded. | none | none |
| PORTAL-012 | 2 | RESOLVE-001 inherits its 433-A/F case questions, PORTAL-005 translations/accessibility. | none | none |
| PORTAL-012 | 2 | MOBILE-001 native/offline organizers before those capabilities ship. | none | none |
| PORTAL-005 | 1 | Set a contact to Spanish. | none | none |
| PORTAL-005 | 1 | send a templated request that has a Spanish version. | none | none |
| PORTAL-005 | 2 | Complete an organizer. | none | none |
| PORTAL-005 | 2 | a signature in Spanish. | none | none |
| PORTAL-005 | 3 | For a template with no Spanish version, staff are warned before the send. | none | none |
| PORTAL-005 | 4 | Run an automated accessibility check on the client flows. | none | none |
| PORTAL-005 | 4 | complete an upload. | none | none |
| PORTAL-005 | 4 | a signature using only the keyboard. | none | none |
| DOC-001 | 1 | Upload a realistic multi-page packet, replace it with a corrected version, annotate a page. | none | none |
| DOC-001 | 1 | find both versions from the client. | none | none |
| DOC-001 | 1 | engagement. | none | none |
| DOC-001 | 2 | Interrupt an upload. | none | none |
| DOC-001 | 2 | resume. | none | none |
| DOC-001 | 2 | compare downloaded originals. | none | none |
| DOC-001 | 2 | inspect limit/error handling. | none | none |
| DOC-001 | 3 | A named notice assignee sees only notice evidence outside their normal job scope. | none | none |
| DOC-001 | 4 | Purpose-specific custody, versioning. | none | none |
| DOC-001 | 4 | approval stay in their own workflows. | none | none |
| DOC-001 | 4 | the packet workspace adds versions. | none | none |
| DOC-001 | 4 | page annotations to requested files, while DOC-003 retains its deliverable version/approval flow. | none | none |
| DOC-001 | 5 | Unknown historical author/page counts are labelled unknown. | none | none |
| DOC-001 | 5 | staff declare a missing page count before the first annotation. | none | none |
| DOC-001 | 6 | New packet source, author. | none | none |
| DOC-001 | 6 | page count are staff-recorded, not provider-verified or inferred. | none | none |
| DOC-001 | 7 | Staff with full job scope can upload 1 byte–20 MiB originals (20 × 1024 × 1024 bytes), with 1–2,000 declared pages, to an open request. | none | none |
| DOC-001 | 8 | Transport uses 256 KiB chunks except the final chunk. | none | none |
| DOC-001 | 8 | each call rechecks current staff, job. | none | none |
| DOC-001 | 8 | client scope, exact offset, chunk ID. | none | none |
| DOC-001 | 8 | SHA-256. | none | none |
| DOC-004 | 1 | A repeated identical chunk is idempotent. | none | none |
| DOC-004 | 1 | gaps, differing bytes. | none | none |
| DOC-004 | 1 | incomplete/final-hash mismatches refuse without discarding confirmed bytes. | none | none |
| DOC-004 | 2 | Pending uploads resume for seven days using the exact original. | none | none |
| DOC-004 | 2 | are then purged. | none | none |
| DOC-004 | 2 | cancellation removes staging. | none | none |
| DOC-004 | 3 | Completion preserves the exact original behind the usual permission-checked file door. | none | none |
| DOC-004 | 3 | marks the request received for staff acceptance. | none | none |
| DOC-004 | 4 | Corrections retain every prior original. | none | none |
| DOC-004 | 4 | the preceding exact DOC-002 contact grants, never its share tokens. | none | none |
| DOC-004 | 4 | start unreviewed. | none | none |
| DOC-004 | 5 | Notes name a page. | none | none |
| DOC-004 | 5 | exact version. | none | none |
| DOC-004 | 5 | review records status, author. | none | none |
| DOC-004 | 5 | time without altering original bytes. | none | none |
| DOC-004 | 6 | Search covers names, sources, authors, period, annotations. | none | none |
| DOC-004 | 6 | review metadata. | none | none |
| DOC-004 | 6 | SEARCH-001 also indexes supported PDF text from the real bytes. | none | none |
| DOC-004 | 7 | Final chunks, versions, annotations. | none | none |
| DOC-004 | 7 | grants are portable. | none | none |
| DOC-004 | 7 | pending chunks. | none | none |
| DOC-004 | 7 | bearer credentials are excluded. | none | none |
| DOC-004 | 8 | Existing file erasure removes final chunks. | none | none |
| DOC-004 | 8 | pending copies under the stale-restore fence. | none | none |
| DOC-005 | 1 | The owner JSON archive restore accepts up to 64,000,000 JSON characters. | none | none |
| DOC-005 | 1 | firm-scale streaming remains ARCHIVE-002. | none | none |
| DOC-005 | 2 | INTEGRATE-003. | none | none |
| DOC-005 | 2 | MIGRATE-001–005 inherit this catalog, original custody. | none | none |
| DOC-005 | 2 | exact grant preservation for their connector/imported kinds before shipping. | none | none |
| DOC-002 | 1 | Keep a workpaper internal, share a final packet with one contact, rotate/revoke its share. | none | none |
| DOC-002 | 1 | attempt direct reads as another contact. | none | none |
| DOC-002 | 1 | preparer. | none | none |
| DOC-002 | 2 | Inspect inherited version permissions. | none | none |
| DOC-002 | 2 | retained access history. | none | none |
| DOC-002 | 3 | Filing defaults to internal. | none | none |
| DOC-002 | 4 | A principal or reviewer previews. | none | none |
| DOC-002 | 4 | grants individual active, authorized portal contacts on the file's own active entity. | none | none |
| DOC-002 | 4 | staff retain the job's existing read scope. | none | none |
| DOC-002 | 5 | Pre-conversion intake has no entity authority. | none | none |
| DOC-002 | 5 | remains internal. | none | none |
| DOC-002 | 6 | Download shares are one-file, one-contact bearer credentials: 32 random bytes, only SHA-256 stored, shown once, never automatically mailed. | none | none |
| DOC-002 | 6 | expire after an explicitly chosen time within 30 × 24 hours. | none | none |
| DOC-002 | 7 | Possession is not verified personal identity. | none | none |
| DOC-002 | 7 | the UI says so. | none | none |
| DOC-002 | 8 | Rotate invalidates the old copy. | none | none |
| DOC-002 | 8 | revoke, erasure, contact edits/revocation, entity archive. | none | none |
| DOC-002 | 8 | permission changes refuse it. | none | none |
| DOC-006 | 1 | Every fetch rechecks the current file hash, entity, contact. | none | none |
| DOC-006 | 1 | grant. | none | none |
| DOC-006 | 1 | records a download without the secret. | none | none |
| DOC-006 | 2 | The contact-bound job portal lists/downloads only its explicit file grants. | none | none |
| DOC-006 | 2 | a different contact cannot fetch or approve another contact's deliverable. | none | none |
| DOC-006 | 3 | The assigned preparer's existing explicit deliverable send grants that version only to its selected currently authorized/consented contact. | none | none |
| DOC-006 | 3 | later versions inherit the preceding version's exact visibility/grants. | none | none |
| DOC-006 | 3 | never its tokens. | none | none |
| DOC-006 | 4 | A different recipient requires the principal/reviewer's explicit policy change first. | none | none |
| DOC-006 | 5 | A changed task attachment hash becomes internal until explicitly approved again. | none | none |
| DOC-006 | 6 | Grants. | none | none |
| DOC-006 | 6 | access/download history survive archives. | none | none |
| DOC-006 | 6 | authorized client merge/undo. | none | none |
| DOC-006 | 6 | bearer tokens do not survive archive restore. | none | none |
| DOC-006 | 6 | old links are revoked by a merge/undo. | none | none |
| DOC-006 | 7 | DOC-001 inherits further version kinds, INTEGRATE-003 connector copies. | none | none |
| DOC-006 | 7 | MIGRATE-001–005 imported documents before shipping. | none | none |
| DOC-006 | 7 | none may broaden the source grant or bypass current client/job authority. | none | none |
| SEARCH-001 | 1 | Search for a client's last name, an invoice number, a phrase inside an uploaded PDF. | none | none |
| SEARCH-001 | 1 | an email subject. | none | none |
| SEARCH-001 | 1 | open each result. | none | none |
| SEARCH-001 | 2 | A preparer without access to a client gets no result from that client. | none | none |
| SEARCH-001 | 2 | a private thread never appears. | none | none |
| SEARCH-001 | 3 | Searching the last four digits of an SSN works only for an authorized role. | none | none |
| SEARCH-001 | 3 | shows the number masked. | none | none |
| SEARCH-001 | 4 | Extracted text is read from plain-text. | none | none |
| SEARCH-001 | 4 | CSV files. | none | none |
| SEARCH-001 | 4 | from the strings a PDF's content streams (uncompressed or FlateDecode) show. | none | none |
| SEARCH-001 | 4 | scanned images. | none | none |
| SEARCH-001 | 4 | other encodings yield none (nothing is guessed). | none | none |
| SEARCH-001 | 5 | A document's text is extracted on the first search after upload. | none | none |
| SEARCH-001 | 5 | kept. | none | none |
| SEARCH-001 | 5 | erasing the file's bytes deletes it. | none | none |
| SEARCH-001 | 5 | it is left out of archives. | none | none |
| SEARCH-001 | 6 | Query. | none | none |
| SEARCH-001 | 6 | record text are split into words (case. | none | none |
| SEARCH-001 | 6 | accents ignored). | none | none |
| SEARCH-001 | 7 | Every query word must match a word of the result exactly (3), as a prefix (2) or within one typo for words of 4 to 7 letters, two for 8 or more (1, insertions, deletions, substitutions. | none | none |
| SEARCH-001 | 7 | transpositions). | none | none |
| SEARCH-001 | 7 | a match in the result's own name counts double. | none | none |
| SEARCH-001 | 7 | the whole query appearing as a phrase adds 5. | none | none |
| SEARCH-002 | 1 | Results are ordered by that score, then most recent first (the record's latest activity: done, answered, uploaded, posted or created), at most 50, optionally filtered to one type. | none | none |
| SEARCH-002 | 1 | each carries the door that opens it (the client's history, the job, the discussion, or the file download). | none | none |
| SEARCH-002 | 1 | in the app "/" focuses the box, arrow keys move. | none | none |
| SEARCH-002 | 1 | Enter opens the chosen result. | none | none |
| SEARCH-002 | 2 | A client's tax id (the EIN column) matches a query of four or more digits (spaces. | none | none |
| SEARCH-002 | 2 | hyphens ignored) only for the principal or a reviewer. | none | none |
| SEARCH-002 | 2 | every client result shows it masked to its last four digits for every role. | none | none |
| CAPACITY-004 | 1 | Open tasks or reviews due in the week without an estimate are unscheduled. | none | none |
| CAPACITY-004 | 1 | open tasks due before the week are listed as past due. | none | none |
| CAPACITY-004 | 1 | neither counts toward demand. | none | none |
| CAPACITY-004 | 2 | A deadline conflict is a job due in the week that is not signed off, with one explanation for each of its people who is overloaded or on leave between the week's start. | none | none |
| CAPACITY-004 | 2 | its due date. | none | none |
| CAPACITY-004 | 2 | for each unscheduled item on it. | none | none |
| CAPACITY-004 | 3 | The view filters by skill (people who have it). | none | none |
| CAPACITY-004 | 3 | service (the job's work type, WORK-007). | none | none |
| CAPACITY-004 | 3 | drills down to each job. | none | none |
| CAPACITY-004 | 3 | reviewers. | none | none |
| CAPACITY-004 | 3 | the principal see the whole firm, a preparer sees only themselves. | none | none |
| CAPACITY-004 | 4 | The job's people (or a reviewer or the principal) adjust an open task's estimate or the job's review estimate. | none | none |
| CAPACITY-004 | 4 | every change is audited. | none | none |
| CAPACITY-004 | 5 | CAPACITY-002. | none | none |
| CAPACITY-004 | 5 | CAPACITY-003 build on this model. | none | none |
| CAPACITY-002 | 1 | Remove an assigned preparer for leave, preview alternate staffing. | none | none |
| CAPACITY-002 | 1 | move a dependent job chain. | none | none |
| CAPACITY-002 | 2 | Approve the feasible changes, refuse an ineligible/self-review assignment. | none | none |
| CAPACITY-002 | 2 | inspect new owners, notifications. | none | none |
| CAPACITY-002 | 2 | unresolved deadline conflicts. | none | none |
| CAPACITY-002 | 3 | The plan takes the open jobs that person prepares. | none | none |
| CAPACITY-002 | 3 | the jobs not yet completed that they review, falling due from the first date through 14 days after the last, ordered so each job comes after the planned jobs it waits for (WORK-003). | none | none |
| CAPACITY-002 | 3 | otherwise by due date. | none | none |
| CAPACITY-002 | 4 | For each role the person holds it proposes an eligible colleague (preparer: an active preparer, reviewer or the principal. | none | none |
| CAPACITY-002 | 4 | reviewer: an active reviewer or the principal) who is not the person, never reviews their own work, is not the job's partner as preparer, is not on CAPACITY-001 leave on the due date. | none | none |
| CAPACITY-002 | 4 | still has the job's estimated minutes free that week (available less demand less the plan's earlier moves). | none | none |
| CAPACITY-002 | 4 | the colleague covering a job's prerequisite comes first, then one with the job's work type among their skills, then the most free minutes, then email order. | none | none |
| CAPACITY-005 | 1 | A manager may name the preparer or reviewer, move a due date (with where it comes from) or leave a job out. | none | none |
| CAPACITY-005 | 1 | a named person who is ineligible, would review their own work or lacks the capacity, or a prerequisite that would fall due after the job waiting for it, refuses the plan until changed. | none | none |
| CAPACITY-005 | 2 | The preview lists every line, the notifications. | none | none |
| CAPACITY-005 | 2 | the unresolved conflicts (no eligible colleague free). | none | none |
| CAPACITY-005 | 2 | approval needs the preview's fingerprint, applies every feasible line in one batch (role tasks follow, WORK-009), sends each notice in-app. | none | none |
| CAPACITY-005 | 2 | by email with its delivery recorded. | none | none |
| CAPACITY-005 | 2 | records each conflict owned by the approving manager in the plan. | none | none |
| CAPACITY-005 | 2 | among the client's unresolved items (CRM-003), where it can be handed on. | none | none |
| CAPACITY-005 | 2 | is closed with a resolution note by its owner or the principal. | none | none |
| CAPACITY-003 | 1 | Project the next tax season from recurring work. | none | none |
| CAPACITY-003 | 1 | prior actuals, add a hypothetical hire. | none | none |
| CAPACITY-003 | 1 | lost client. | none | none |
| CAPACITY-003 | 1 | compare demand/capacity by skill. | none | none |
| CAPACITY-003 | 2 | Inspect each week's forecast as a range with its stated confidence level. | none | none |
| CAPACITY-003 | 2 | confirm a client with no prior actuals widens the range. | none | none |
| CAPACITY-003 | 2 | is named as the reason. | none | none |
| CAPACITY-003 | 3 | Trace estimates to sources. | none | none |
| CAPACITY-003 | 3 | save a scenario without changing live work. | none | none |
| CAPACITY-003 | 4 | Demand is the periods of active, approved recurring rules (WORK-002) whose due date (the period's last day plus the rule's days) falls in a week, counted in that week. | none | none |
| CAPACITY-003 | 4 | paused rules, skipped periods. | none | none |
| CAPACITY-003 | 4 | periods whose job is already signed off are left out. | none | none |
| CAPACITY-003 | 4 | one-off jobs are not forecast. | none | none |
| CAPACITY-003 | 5 | A period's time traces to its source: the client's prior actuals for that template, which are the recorded time (TIME-001) on its signed-off jobs of earlier periods (a signed-off job with no recorded time is not one), using only periods starting in the same calendar month when there are any (seasonality). | none | none |
| CAPACITY-003 | 5 | the estimate is their mean rounded to the minute. | none | none |
| CAPACITY-003 | 5 | the range runs from 90% of the smallest (rounded down) to 110% of the largest (rounded up). | none | none |
| CAPACITY-006 | 1 | Without prior actuals the period uses the rule's time budget, else the work type's budget, else the sum of the template's task estimates, with a range from 50% to 150% of it (rounded to the minute). | none | none |
| CAPACITY-006 | 1 | the reason names the client. | none | none |
| CAPACITY-006 | 1 | with none of these its estimate is zero. | none | none |
| CAPACITY-006 | 1 | the reason says so. | none | none |
| CAPACITY-006 | 2 | Each week states its confidence: high when every period due in it rests on at least three prior actuals, medium when each rests on at least one, low when any rests on none (each such reason listed). | none | none |
| CAPACITY-006 | 3 | Capacity is each active person's weekly hours less leave. | none | none |
| CAPACITY-006 | 3 | commitments on the week's weekdays (CAPACITY-001). | none | none |
| CAPACITY-006 | 3 | by skill, a person counts in full under each of their skills. | none | none |
| CAPACITY-006 | 3 | demand counts under the skill named like its work type (lower case). | none | none |
| CAPACITY-006 | 3 | a skill is short by its demand's high end less its capacity. | none | none |
| CAPACITY-006 | 4 | A scenario adds hypothetical hires (weekly minutes. | none | none |
| CAPACITY-006 | 4 | skills from a start date), changes a person's weekly hours from a date (zero for a departure), drops lost clients' periods (listed as left out). | none | none |
| CAPACITY-006 | 4 | scales a work type's time to a percentage (0 drops the service). | none | none |
| CAPACITY-006 | 4 | it is compared week by week. | none | none |
| CAPACITY-006 | 4 | by skill with the baseline. | none | none |
| CAPACITY-007 | 1 | Forecasting computes from live records. | none | none |
| CAPACITY-007 | 1 | stores nothing. | none | none |
| CAPACITY-007 | 1 | saving a scenario stores only its name, window. | none | none |
| CAPACITY-007 | 1 | changes (audited). | none | none |
| CAPACITY-007 | 1 | changes no job, rule, assignment, estimate, due date or capacity row. | none | none |
| CAPACITY-007 | 1 | reopening it recomputes from current records. | none | none |
| TIME-001 | 1 | Record time, change the rate. | none | none |
| TIME-001 | 1 | inspect unchanged prior amounts. | none | none |
| TIME-001 | 1 | budget variance. | none | none |
| TIME-001 | 2 | Stop/restart a timer, reject one activity suggestion. | none | none |
| TIME-001 | 2 | approve another. | none | none |
| TIME-001 | 2 | verify only approved minutes enter WIP. | none | none |
| TIME-001 | 2 | unauthorized edits are refused. | none | none |
| TIME-001 | 3 | A job's budget is the minutes approved by the reviewer or principal who starts it, or by its recurrence rule (WORK-002). | none | none |
| TIME-001 | 3 | actual is every recorded entry in any review state plus adjustments, at their snapshotted amounts. | none | none |
| TIME-001 | 3 | variance is actual minus budget. | none | none |
| TIME-001 | 4 | A non-billable entry keeps its snapshotted rate. | none | none |
| TIME-001 | 4 | amount. | none | none |
| TIME-001 | 4 | counts in the job's actual time, cost. | none | none |
| TIME-001 | 4 | variance, but neither it nor any adjustment to it is ever ready to bill: it stays out of WIP, is refused in a billing export. | none | none |
| TIME-001 | 4 | stays out of the job's margin (TIME-004). | none | none |
| TIME-003 | 1 | Set rates for a practice role, a staff member, a 1040 service, a client. | none | none |
| TIME-003 | 1 | that client plus service. | none | none |
| TIME-003 | 2 | Record time with only the role matching, then with staff, service, client. | none | none |
| TIME-003 | 2 | client-plus-service rates also matching in turn. | none | none |
| TIME-003 | 2 | inspect each entry's resolved rate. | none | none |
| TIME-003 | 2 | source to prove every precedence level: client. | none | none |
| TIME-003 | 2 | service, client, service, staff member, role. | none | none |
| TIME-003 | 3 | Verify role means principal, reviewer or preparer. | none | none |
| TIME-003 | 4 | Start two jobs with distinct work types sharing a template. | none | none |
| TIME-003 | 4 | inspect their distinct service rates. | none | none |
| TIME-003 | 4 | a type without a default template also accepts its own rate. | none | none |
| TIME-003 | 5 | Verify client overrides, work-type versus template specificity, effective dates. | none | none |
| TIME-003 | 5 | recorded snapshots through archive restore. | none | none |
| TIME-003 | 6 | Change the staff rate effective next month. | none | none |
| TIME-003 | 6 | confirm past entries are unchanged. | none | none |
| TIME-004 | 1 | Record a state filing fee with a receipt. | none | none |
| TIME-004 | 1 | a 10% markup, approve it, invoice it. | none | none |
| TIME-004 | 1 | inspect the invoice line. | none | none |
| TIME-004 | 1 | WIP. | none | none |
| TIME-004 | 2 | A non-billable expense stays off the invoice. | none | none |
| TIME-004 | 2 | appears in profitability. | none | none |
| TIME-004 | 3 | An unapproved expense cannot be invoiced. | none | none |
| BILL-001 | 1 | Prepare a mixed time/fixed-fee export, reject source reuse. | none | none |
| BILL-001 | 1 | non-owner approval, approve as principal. | none | none |
| BILL-001 | 1 | download twice. | none | none |
| BILL-001 | 2 | Verify identical CSV bytes, source locks, formula-safe cells. | none | none |
| BILL-001 | 2 | a voided draft's released sources. | none | none |
| BILL-002 | 1 | Bill a fixed engagement. | none | none |
| BILL-002 | 1 | hourly extra, start a monthly retainer, apply a deposit. | none | none |
| BILL-002 | 1 | preview a fee amendment. | none | none |
| BILL-002 | 2 | Approve/deliver invoices, repeat the schedule event. | none | none |
| BILL-002 | 2 | inspect one invoice per entitlement with USD totals. | none | none |
| BILL-002 | 2 | retained source links. | none | none |
| BILL-002 | 3 | an issued invoice appears in the client history linked to its source time. | none | none |
| BILL-002 | 3 | fees. | none | none |
| BILL-002 | 4 | Approved time, adjustments. | none | none |
| BILL-002 | 4 | expenses share source reservations with reviewed exports. | none | none |
| BILL-002 | 4 | a numbered document never releases its source links. | none | none |
| BILL-002 | 5 | No taxability, bank settlement, charge or automatic proration is inferred. | none | none |
| BILL-002 | 6 | Monthly rules approved by the principal or a financial-authority holder create one draft per rule/month. | none | none |
| BILL-002 | 6 | issue. | none | none |
| BILL-002 | 6 | send are separate person actions unless a holder's recorded automatic-issue consent covers the rule revision (below). | none | none |
| BILL-002 | 6 | price changes. | none | none |
| BILL-002 | 6 | cancellation apply from the reviewed future month while existing entitlement prices remain. | none | none |
| BILL-002 | 7 | An explicit recorded credit allocation changes the current balance, never the issued PDF. | none | none |
| BILL-002 | 8 | Invoice links are contact/revision-bound, expire after 30 days, expose only their invoice. | none | none |
| BILL-002 | 8 | recheck live billing/portal/email authority. | none | none |
| BILL-006 | 1 | Unresolved sends are held for provider-evidence reconciliation without replay. | none | none |
| BILL-006 | 2 | Restored rules are paused. | none | none |
| BILL-006 | 2 | old invoice links revoked. | none | none |
| BILL-006 | 3 | Issued/sent/voided history links to its source job. | none | none |
| BILL-006 | 3 | open balances name an owner, next action. | none | none |
| BILL-006 | 3 | due date. | none | none |
| BILL-006 | 4 | Native invoice search. | none | none |
| BILL-006 | 4 | merge/undo preserve immutable document bytes. | none | none |
| BILL-006 | 4 | sources. | none | none |
| BILL-006 | 5 | Existing performance reports project the selected job cohort’s native invoices, retainers, supplied credits. | none | none |
| BILL-006 | 5 | open USD receivables from live sources, with job/document/source links, generation time. | none | none |
| BILL-006 | 5 | the same values in CSV/PDF. | none | none |
| BILL-006 | 5 | they never label supplied credit evidence as provider settlement. | none | none |
| BILL-006 | 6 | Each report download records its client scope. | none | none |
| BILL-006 | 6 | named downloader for erasure receipts. | none | none |
| BILL-006 | 7 | Invoices, credits, rules. | none | none |
| BILL-006 | 7 | deliveries join ERASURE-002 billing/link classes, holds, counts, receipt. | none | none |
| BILL-006 | 7 | journal fence. | none | none |
| BILL-006 | 7 | open invoice balances. | none | none |
| BILL-006 | 7 | unapplied deposits/credits refuse whole-client erasure. | none | none |
| BILL-006 | 7 | billing expiry. | none | none |
| BILL-006 | 8 | Erased-client invoice identities are absent from normal billing lists. | none | none |
| BILL-006 | 8 | use opaque expiry labels. | none | none |
| BILL-006 | 8 | explicit retained detail/PDF reads require the principal. | none | none |
| BILL-006 | 8 | are audited. | none | none |
| BILL-007 | 1 | Retention clocks use issue. | none | none |
| BILL-007 | 1 | later void/credit/allocation dates in the firm timezone. | none | none |
| BILL-007 | 1 | expiry requires principal confirmation. | none | none |
| BILL-007 | 1 | preserves amounts, number, attribution. | none | none |
| BILL-007 | 1 | SHA-256. | none | none |
| BILL-007 | 2 | INTEGRATE-001 inherits QBO/Xero authority selection. | none | none |
| BILL-007 | 2 | reconciliation before those connectors ship. | none | none |
| BILL-007 | 2 | unavailable external authorities refuse. | none | none |
| BILL-007 | 3 | PAY-001 inherits actual settlement evidence. | none | none |
| BILL-007 | 3 | balances before collections ship. | none | none |
| BILL-007 | 4 | AUTOMATE-001 inherits invoice creation as an additional action before it is exposed. | none | none |
| BILL-007 | 4 | current invoice schedules create approved-rule drafts and, within a recorded consent, issue. | none | none |
| BILL-007 | 4 | send them. | none | none |
| BILL-003 | 1 | Run WIP, aging. | none | none |
| BILL-003 | 1 | profitability for a client with hourly work, fixed fees, a retainer, partial payment. | none | none |
| BILL-003 | 1 | credit. | none | none |
| BILL-003 | 2 | Reconcile totals to approved sources. | none | none |
| BILL-003 | 2 | provider state, approve a write-off. | none | none |
| BILL-003 | 2 | inspect the changed period report without rewriting historical invoices. | none | none |
| BILL-003 | 3 | The inclusive period-start cohort. | none | none |
| BILL-003 | 3 | existing client/service/assignee filters apply before grouping. | none | none |
| BILL-003 | 4 | Totals sum approved billable time. | none | none |
| BILL-003 | 4 | adjustments, earned fixed fees, approved expense charges. | none | none |
| BILL-003 | 4 | costs, margin before staff cost, unreserved ready-to-bill WIP. | none | none |
| BILL-003 | 4 | approved export snapshots. | none | none |
| BILL-003 | 5 | Draft reservations remove WIP but never count as approved exports. | none | none |
| BILL-003 | 5 | voiding restores that WIP. | none | none |
| BILL-003 | 6 | Each group links to its source jobs. | none | none |
| BILL-003 | 6 | their calculation inputs. | none | none |
| BILL-005 | 1 | Gate a final return copy on an invoice. | none | none |
| BILL-005 | 2 | The client sees it locked, pays by card. | none | none |
| BILL-005 | 2 | the file unlocks. | none | none |
| BILL-005 | 3 | With a wait-for-settlement ACH policy, the file stays locked until settlement. | none | none |
| BILL-005 | 4 | The client's own uploaded documents stay downloadable throughout. | none | none |
| BILL-005 | 5 | A partner override is recorded with its reason. | none | none |
| BILL-005 | 5 | new work for an overdue client shows the credit hold. | none | none |
| BILL-005 | 6 | Every version of a gated deliverable is withheld from the client portal, the portal file door. | none | none |
| BILL-005 | 6 | any bearer share link (HTTP 402 naming the invoice) until the invoice's gross is covered by applied credits, recorded deposits. | none | none |
| BILL-005 | 6 | observed net provider payments under the ACH policy. | none | none |
| BILL-005 | 6 | staff downloads are never gated. | none | none |
| BILL-005 | 7 | A write-off never releases a gate. | none | none |
| BILL-005 | 7 | only a partner (principal or financial-authority holder) override with a reason does. | none | none |
| BILL-005 | 7 | it can be taken back. | none | none |
| BILL-005 | 8 | A receipt records how it was paid (card, ACH or other): a card or other receipt counts when recorded, an ACH deposit may be recorded pending until the bank settles it. | none | none |
| BILL-005 | 8 | the firm policy (principal only, default: settlement required) chooses whether a pending ACH deposit releases a gated file. | none | none |
| BILL-008 | 1 | The same principal-only policy sets the credit-hold threshold (default: off). | none | none |
| BILL-008 | 1 | grace days (default: 0): a client is on credit hold when the open balance of its issued invoices past due, after the grace days, is at least the threshold. | none | none |
| BILL-008 | 2 | Staff with client access see the hold on the client (amounts only if they may read billing). | none | none |
| BILL-008 | 2 | the job start, roll-forward. | none | none |
| BILL-008 | 2 | bulk schedule doors warn without blocking. | none | none |
| BILL-008 | 2 | a partner overrides or restores the hold with a reason. | none | none |
| BILL-008 | 2 | any payment or write-off lowering the balance below the threshold ends the hold. | none | none |
| BILL-008 | 3 | Gates, overrides. | none | none |
| BILL-008 | 3 | the policy are audited, appear in the client's billing history, are carried by archives. | none | none |
| BILL-008 | 3 | join ERASURE-002's link. | none | none |
| BILL-008 | 3 | firm classes (reasons redacted on client erasure). | none | none |
| BILL-008 | 4 | PAY-001 supplies the client's own card payment in the portal, provider confirmation. | none | none |
| BILL-008 | 4 | ACH states. | none | none |
| BILL-008 | 4 | its payment, refund. | none | none |
| BILL-008 | 4 | return events inherit this gate. | none | none |
| BILL-008 | 4 | hold. | none | none |
| BILL-008 | 4 | a returned ACH payment relocks the file. | none | none |
| BILL-008 | 4 | Every staff job screen rechecks. | none | none |
| BILL-008 | 4 | shows the live hold, including recurrence-generated. | none | none |
| BILL-008 | 4 | intake-onboarding work. | none | none |
| BILL-008 | 4 | no billing amounts are shown to staff without billing access. | none | none |
| BILL-008 | 5 | A new intake conversion creates a new client without an inherited balance. | none | none |
| REPORT-001 | 1 | Complete. | none | none |
| REPORT-001 | 1 | delay several engagements, filter a period/team. | none | none |
| REPORT-001 | 1 | drill from turnaround. | none | none |
| REPORT-001 | 1 | overdue totals to source jobs. | none | none |
| REPORT-001 | 2 | Schedule a partner report, export it. | none | none |
| REPORT-001 | 2 | compare totals. | none | none |
| REPORT-001 | 2 | a preparer/client cannot obtain the firm's private financial report. | none | none |
| REPORT-001 | 3 | read counts. | none | none |
| REPORT-001 | 3 | time in each status for the 1040 work type. | none | none |
| REPORT-001 | 4 | Period filters select jobs whose period start is within the inclusive date range. | none | none |
| REPORT-001 | 4 | client, service/work type. | none | none |
| REPORT-001 | 4 | assigned team member further restrict the cohort. | none | none |
| REPORT-001 | 5 | A team member matches preparer, reviewer, manager or partner. | none | none |
| REPORT-001 | 6 | Turnaround is created-to-sign-off elapsed UTC minutes, floored. | none | none |
| REPORT-001 | 6 | review rework counts recorded returns. | none | none |
| REPORT-001 | 7 | Client response delay is accepted-provider reminder to first retained portal upload of that requested document, or elapsed waiting time if unanswered. | none | none |
| REPORT-001 | 7 | unsent reminders are not a response clock. | none | none |
| REPORT-001 | 8 | Overdue means unfinished. | none | none |
| REPORT-001 | 8 | due before today in the firm zone. | none | none |
| REPORT-002 | 1 | Stage/sub-status visits, current counts. | none | none |
| REPORT-002 | 1 | elapsed minutes come from WORK-007 history for that cohort. | none | none |
| REPORT-002 | 2 | Capacity is CAPACITY-001 whole Monday–Sunday weeks overlapping the chosen range. | none | none |
| REPORT-002 | 2 | billable approved time in the range divided by available minutes is utilization, rounded to two percentage decimals (zero availability is undefined). | none | none |
| REPORT-002 | 3 | Money is grouped by stored currency: approved billable time. | none | none |
| REPORT-002 | 3 | adjustments, signed-off fixed fees, approved expense charges/costs, unbilled sources. | none | none |
| REPORT-002 | 3 | immutable approved export lines, counted once. | none | none |
| REPORT-002 | 4 | Margin is before staff cost. | none | none |
| REPORT-002 | 4 | exports never claim invoicing, collection or settlement. | none | none |
| REPORT-002 | 5 | Reports expose calculation inputs. | none | none |
| REPORT-002 | 5 | job/export links with generation time. | none | none |
| REPORT-002 | 5 | they recompute from retained sources after erasure. | none | none |
| REPORT-002 | 6 | Under the held company policy, principal/reviewer financial access follows existing BILL-001 authority. | none | none |
| REPORT-002 | 6 | preparers, agent keys. | none | none |
| REPORT-002 | 6 | client links cannot read internal reports or exports. | none | none |
| REPORT-002 | 7 | Saved views store filters. | none | none |
| REPORT-002 | 8 | The principal schedules an active principal/reviewer a live permission-checked link on firm-local dates at a whole-day interval. | none | none |
| REPORT-002 | 8 | notification hours apply, one durable notice per due date, downtime coalesces to one current link, revoked authority pauses delivery. | none | none |
| REPORT-002 | 8 | restored schedules remain paused without principal authority. | none | none |
| REPORT-003 | 1 | Existing client progress reports remain limited to PORTAL-003/CRM-001 approved client-visible data. | none | none |
| REPORT-003 | 2 | Each future capability adds its complete reporting before shipping: MAIL-001/003, SMS-001. | none | none |
| REPORT-003 | 2 | FOLLOWUP-001 response/delivery history. | none | none |
| REPORT-003 | 2 | BILL-002/003/004, PAY-001/002. | none | none |
| REPORT-003 | 2 | INTEGRATE-001 invoice, retainer, receivable, cost, collection. | none | none |
| REPORT-003 | 2 | profitability sources. | none | none |
| REPORT-003 | 2 | LEDGER-001/002 source freshness. | none | none |
| REPORT-003 | 2 | PORTAL-002/005. | none | none |
| REPORT-003 | 2 | MOBILE-001 any client report/export doors. | none | none |
| REPORT-003 | 3 | These inherit permission checks, source drill-down, CSV/PDF parity, freshness. | none | none |
| REPORT-003 | 3 | BASE-001 evidence, retaining their destinations/statuses. | none | none |
| API-001 | 1 | Under the held company policy, create/read work. | none | none |
| API-001 | 1 | time through the authenticated HTTP API, inspect billing as reviewer. | none | none |
| API-001 | 1 | refuse preparer/private-job reads, signed-out access. | none | none |
| API-001 | 1 | agent-key use on person-only routes. | none | none |
| AUTOMATE-001 | 1 | Enable rules through the app, including "when all tasks complete, set status In review". | none | none |
| AUTOMATE-001 | 1 | "on entering Waiting – on client documents, send the request template". | none | none |
| AUTOMATE-001 | 2 | Trigger status, file/task/proposal. | none | none |
| AUTOMATE-001 | 2 | due-time events, interrupt processing after provider acceptance. | none | none |
| AUTOMATE-001 | 2 | restart. | none | none |
| AUTOMATE-001 | 3 | Inspect one authorized effect, retained attempts, a visible ambiguous/failing item. | none | none |
| AUTOMATE-001 | 3 | no work after rule pause or authority revocation. | none | none |
| AUTOMATE-001 | 4 | an automation on entering "Waiting – on 8879 signature" fires once when a 1040 job enters it. | none | none |
| AUTOMATE-001 | 5 | moving a 1040 card on the board into "Waiting – on 8879 signature" fires that automation once. | none | none |
| IMPORT-001 | 1 | Map an exported client/contact CSV, preview errors. | none | none |
| IMPORT-001 | 1 | duplicates without writes, commit its reviewed fingerprint. | none | none |
| IMPORT-001 | 1 | resume. | none | none |
| IMPORT-001 | 2 | Re-import without duplication, create a native job on one imported client. | none | none |
| IMPORT-001 | 2 | undo. | none | none |
| IMPORT-001 | 2 | inspect preserved native work. | none | none |
| IMPORT-001 | 2 | the source journal. | none | none |
| IMPORT-001 | 3 | Repeated stable source client IDs group agreeing entity fields. | none | none |
| IMPORT-001 | 3 | entity-specific contacts. | none | none |
| IMPORT-001 | 3 | a contact matches only its stable source ID or exact normalized email within that entity. | none | none |
| IMPORT-001 | 4 | Conflicting rows block the whole preview. | none | none |
| IMPORT-001 | 5 | The mapped format imports individual/business/trust. | none | none |
| IMPORT-001 | 5 | native-validated contact roles, phone. | none | none |
| IMPORT-001 | 5 | explicit authority/consent flags, all default false. | none | none |
| IMPORT-001 | 6 | Possible native duplicates require an explicit keep-separate or provenance-only match to an active entity of the same type. | none | none |
| IMPORT-001 | 6 | supplied contacts must agree exactly with its native relationships. | none | none |
| IMPORT-001 | 7 | A match never changes native fields or grants. | none | none |
| IMPORT-001 | 8 | CRM-004 remains the merge door. | none | none |
| IMPORT-002 | 1 | Stable source associations survive native merges. | none | none |
| IMPORT-002 | 1 | replay. | none | none |
| IMPORT-002 | 1 | changed source content is refused, never silently applied. | none | none |
| IMPORT-002 | 2 | Resume uses the retained reviewed plan. | none | none |
| IMPORT-002 | 2 | undo removes untouched created contacts/entities, keeps any entity/contact edit or native dependent work. | none | none |
| IMPORT-002 | 2 | never removes a matched native entity. | none | none |
| IMPORT-002 | 3 | Owner-only journals. | none | none |
| IMPORT-002 | 3 | practice archives retain original UTF-8 bytes, mapping, decisions. | none | none |
| IMPORT-002 | 3 | source IDs. | none | none |
| IMPORT-002 | 4 | Existing v1 jobs. | none | none |
| IMPORT-002 | 4 | their established single-contact permissions remain resumable. | none | none |
| IMPORT-002 | 4 | reversible. | none | none |
| ACCESS-001 | 1 | Invite. | none | none |
| ACCESS-001 | 1 | sign in staff, call privileged. | none | none |
| ACCESS-001 | 1 | hidden-job routes as preparer. | none | none |
| ACCESS-001 | 1 | reviewer, attempt cross-origin writes. | none | none |
| ACCESS-001 | 1 | deactivate a member. | none | none |
| ACCESS-001 | 2 | Under the held company policy, inspect immediate denial, unchanged records. | none | none |
| ACCESS-001 | 2 | agent-key refusal on person-only routes. | none | none |
| ACCESS-002 | 1 | Give two teams overlapping client scopes, assign a read-only member. | none | none |
| ACCESS-002 | 1 | restrict a sensitive workpaper. | none | none |
| ACCESS-002 | 2 | Attempt direct API/export/share reads. | none | none |
| ACCESS-002 | 2 | background work after revocation, then step up for an authorized export. | none | none |
| ACCESS-002 | 2 | inspect denied writes. | none | none |
| ACCESS-002 | 2 | redacted diagnostics. | none | none |
| ACCESS-002 | 3 | a colleague without the client's grant is never proposed as cover. | none | none |
| ACCESS-002 | 3 | naming them refuses the plan. | none | none |
| ACCESS-002 | 4 | First configuration scopes every current staff member. | none | none |
| ACCESS-002 | 4 | no grant means no client access, including prior sessions, named-task access, API pages. | none | none |
| ACCESS-002 | 4 | agent context. | none | none |
| ACCESS-002 | 5 | New staff remain scoped. | none | none |
| ACCESS-002 | 6 | Client grants intersect the existing preparer/reviewer job role. | none | none |
| ACCESS-002 | 6 | read-only is a separate restriction refusing writes. | none | none |
| ACCESS-002 | 7 | Sensitive workpapers are internal to the principal. | none | none |
| ACCESS-002 | 7 | individually named staff with both client. | none | none |
| ACCESS-002 | 7 | job authority. | none | none |
| ACCESS-002 | 7 | restricting revokes contact grants. | none | none |
| ACCESS-002 | 7 | all existing shares. | none | none |
| ACCESS-002 | 8 | Permission changes invalidate concurrent writes. | none | none |
| ACCESS-002 | 8 | notification/report dispatch rechecks current grants. | none | none |
| ACCESS-007 | 1 | Sensitive administration (access settings, team, integration keys, firm settings, retention, credential archive mode, invoice authority. | none | none |
| ACCESS-007 | 1 | automatic-issue consent). | none | none |
| ACCESS-007 | 1 | exports (backup. | none | none |
| ACCESS-007 | 1 | complete-archive exports, erasure journal, approved billing exports, report CSV/PDF, invoice PDFs, the MFA enrollment report) require a separate fresh second-factor confirmation valid five minutes in that session, from installation. | none | none |
| ACCESS-007 | 1 | whether or not scopes are configured. | none | none |
| ACCESS-007 | 1 | restores. | none | none |
| ACCESS-007 | 1 | imports are not exports. | none | none |
| ACCESS-007 | 2 | Global financial/export/administration doors without a client-scoped query are principal-only for scoped staff, except for the two delegated permissions below. | none | none |
| ACCESS-004 | 1 | Enable the firm MFA policy. | none | none |
| ACCESS-004 | 2 | A preparer without a factor must enroll before seeing any client. | none | none |
| ACCESS-004 | 3 | Sign in with TOTP. | none | none |
| ACCESS-004 | 3 | with a passkey. | none | none |
| ACCESS-004 | 4 | A sign-in with the correct first factor. | none | none |
| ACCESS-004 | 4 | no second factor is refused. | none | none |
| ACCESS-004 | 4 | a session created before the policy must step up before further access. | none | none |
| ACCESS-004 | 5 | When the preparer loses their factor, the owner resets it. | none | none |
| ACCESS-004 | 5 | the preparer's sessions are revoked. | none | none |
| ACCESS-004 | 5 | the audit shows who reset it. | none | none |
| ACCESS-004 | 6 | A federated sign-in whose token lacks an MFA assertion is challenged for a Blotter factor. | none | none |
| ACCESS-004 | 7 | Export the enrollment report. | none | none |
| ACCESS-006 | 1 | Give a preparer clients, open work, a scheduled reminder sequence, a pending signature request. | none | none |
| ACCESS-006 | 1 | a connected mailbox. | none | none |
| ACCESS-006 | 2 | Preview the transfer, reassign everything to two successors. | none | none |
| ACCESS-006 | 2 | deactivate the preparer. | none | none |
| ACCESS-006 | 3 | No orphaned item remains. | none | none |
| ACCESS-006 | 4 | The next reminder goes from the successor, past messages show the original author. | none | none |
| ACCESS-006 | 4 | the deactivated member's sessions. | none | none |
| ACCESS-006 | 4 | tokens are refused. | none | none |
| ACCESS-006 | 5 | Under the held company policy, the preview lists, for one member, active or already deactivated: open jobs where they are preparer, reviewer or manager (a client's ownership is its jobs. | none | none |
| ACCESS-006 | 5 | recurring rules until CRM-001 adds a client owner, which inherits this transfer before it ships). | none | none |
| ACCESS-006 | 5 | their open named tasks. | none | none |
| ACCESS-006 | 5 | recurring rules naming them. | none | none |
| ACCESS-006 | 5 | open tax notices assigned to them. | none | none |
| ACCESS-006 | 5 | open discussions they own. | none | none |
| ACCESS-006 | 5 | open client questions. | none | none |
| ACCESS-006 | 5 | client to-dos they own (PORTAL-003). | none | none |
| ACCESS-006 | 5 | agent proposals waiting for their decision. | none | none |
| ACCESS-006 | 5 | templates naming them as a task owner. | none | none |
| ACCESS-006 | 5 | their running timer. | none | none |
| ACCESS-006 | 5 | their time not yet approved. | none | none |
| ACCESS-006 | 5 | their live agent keys. | none | none |
| ACCESS-006 | 5 | sessions. | none | none |
| ACCESS-006 | 6 | The principal names a work successor (preparation, tasks, notices, discussions, client questions. | none | none |
| ACCESS-006 | 6 | to-dos, template tasks). | none | none |
| ACCESS-006 | 6 | a review successor (review. | none | none |
| ACCESS-006 | 6 | manager roles, proposals. | none | none |
| ACCESS-006 | 6 | the work successor unless named). | none | none |
| ACCESS-009 | 1 | One batch, matching the preview exactly. | none | none |
| ACCESS-009 | 1 | refused while any job or rule would make someone review their own work, moves all of it, discards the running timer (nothing recorded. | none | none |
| ACCESS-009 | 1 | its start is kept in the audit), submits their unsubmitted time for approval on their behalf (returned entries never bill. | none | none |
| ACCESS-009 | 1 | the principal deletes them before closing their period). | none | none |
| ACCESS-009 | 1 | deactivates them. | none | none |
| ACCESS-009 | 2 | Document requests move with their jobs. | none | none |
| ACCESS-009 | 2 | sent messages, reminders, decisions. | none | none |
| ACCESS-009 | 2 | recorded time keep their authors. | none | none |
| ACCESS-009 | 3 | AUTOMATE-001 versions remain principal-owned: the preview lists versions referencing the departing person. | none | none |
| ACCESS-009 | 3 | the batch checks those unchanged versions. | none | none |
| ACCESS-009 | 4 | It never silently transfers standing approval. | none | none |
| ACCESS-009 | 4 | live checks refuse an inactive assignee until a new version is reviewed. | none | none |
| ACCESS-009 | 5 | Deactivation, whether by offboarding or directly, revokes every session. | none | none |
| ACCESS-009 | 5 | agent key at once. | none | none |
| ACCESS-009 | 5 | reactivation needs a new sign-in. | none | none |
| ACCESS-009 | 5 | new keys. | none | none |
| ACCESS-009 | 5 | a member deactivated urgently is offboarded the same way afterwards. | none | none |
| ACCESS-009 | 6 | Connected mailboxes, mail triage. | none | none |
| ACCESS-009 | 6 | mailbox grants (MAIL-001, MAIL-003), scheduled reminder sends (FOLLOWUP-001), signature requests (SIGN-001, SIGN-002) do not exist yet. | none | none |
| ACCESS-009 | 6 | each joins this preview. | none | none |
| ACCESS-009 | 6 | batch before it ships. | none | none |
| ACCESS-009 | 6 | a scheduled send changes sender only through this approved batch. | none | none |
| VAULT-001 | 1 | A client adds a state sales-tax portal login through the portal. | none | none |
| VAULT-001 | 2 | An assigned preparer reveals it after step-up. | none | none |
| VAULT-001 | 2 | the reveal is logged. | none | none |
| VAULT-001 | 3 | An unassigned preparer cannot reveal it. | none | none |
| VAULT-001 | 4 | The credential is absent from search, AI summaries. | none | none |
| VAULT-001 | 4 | plain exports. | none | none |
| VAULT-001 | 5 | Revoke the preparer's access. | none | none |
| VAULT-001 | 5 | confirm their next reveal is refused. | none | none |
| ARCHIVE-001 | 1 | Export via the owner HTTP door, reject a damaged archive. | none | none |
| ARCHIVE-001 | 1 | a nonempty restore, restore the intact archive into an empty installation. | none | none |
| ARCHIVE-001 | 1 | export again. | none | none |
| ARCHIVE-001 | 2 | Compare all archived rows, kept file bytes. | none | none |
| ARCHIVE-001 | 2 | approved CSV bytes. | none | none |
| ARCHIVE-001 | 2 | inspect excluded local authority. | none | none |
| ARCHIVE-002 | 1 | Export a multi-year firm with connected history, interrupt/resume the operation. | none | none |
| ARCHIVE-002 | 1 | restore to an empty destination. | none | none |
| ARCHIVE-002 | 2 | Reconcile record/file counts, relationships, permissions. | none | none |
| ARCHIVE-002 | 2 | financial totals, then activate only reviewed connections/rules without replaying past messages or payments. | none | none |
| ARCHIVE-002 | 3 | Owner-only durable export/restore doors confirm one part per request (at most 16 MiB of part JSON, with a 24,000,000-character request bound). | none | none |
| ARCHIVE-002 | 3 | progress survives page/process interruption. | none | none |
| ARCHIVE-002 | 3 | identical part replay, while changed parts fail verification. | none | none |
| ARCHIVE-002 | 4 | The legacy single-request restore retains its 64,000,000-character bound. | none | none |
| ARCHIVE-002 | 4 | the part door has no whole-file string limit. | none | none |
| ARCHIVE-002 | 5 | An archive holds a consistent source snapshot. | none | none |
| ARCHIVE-002 | 5 | selected included tables can also be downloaded as NDJSON for analysis, labelled non-restorable. | none | none |
| ARCHIVE-002 | 6 | Restored recurring rules start paused with a fresh review requirement. | none | none |
| ARCHIVE-002 | 6 | their exact held periods. | none | none |
| ARCHIVE-002 | 6 | catch-up plan must be previewed. | none | none |
| ARCHIVE-002 | 6 | approved before resuming. | none | none |
| ARCHIVE-002 | 7 | Original source rules remain unchanged. | none | none |
| ARCHIVE-002 | 8 | Previously unsent staff alerts are retained as held history. | none | none |
| ARCHIVE-002 | 8 | never replayed. | none | none |
| ARCHIVE-002 | 8 | confirmed historic messages keep their outcomes. | none | none |
| ARCHIVE-003 | 1 | Restored external references remain history, with configuration. | none | none |
| ARCHIVE-003 | 1 | provider credentials re-entered separately. | none | none |
| ARCHIVE-003 | 2 | Erasure invalidates staged transfer copies. | none | none |
| ARCHIVE-003 | 2 | a newer erasure journal refuses a stale restore. | none | none |
| ARCHIVE-003 | 3 | Full completion for shipped kinds is asserted by the named ARCHIVE-002/BASE-001 public-door journeys. | none | none |
| ARCHIVE-003 | 4 | Under the held company policy, each future capability adds its records, permission/financial reconciliation, exclusions, safe inactive restoration. | none | none |
| ARCHIVE-003 | 4 | reviewed reauthorization before shipping: MAIL-001–003, PORTAL-002/004, SIGN-001/002, ENGAGE-001, DUE-001/003, LEDGER-001–003, BILL-002–005, PAY-001/002, INTEGRATE-001–008, AUTOMATE-001, API-002, MIGRATE-001–007, VAULT-001, ERASURE-002, AI-001–003. | none | none |
| ARCHIVE-003 | 4 | READY-001/RESCUE-001/LEARN-001/REVENUE-001/ONBOARD-001/SWITCH-001/NOTICE-001. | none | none |
| ARCHIVE-003 | 5 | Those clauses retain their destinations. | none | none |
| ARCHIVE-003 | 5 | statuses. | none | none |
| ARCHIVE-003 | 5 | their unbuilt kinds do not make current-native portability incomplete. | none | none |
| ERASURE-001 | 1 | Export, erase a file through the owner door, refuse later downloads. | none | none |
| ERASURE-001 | 1 | inspect a new archive without the bytes. | none | none |
| ERASURE-001 | 2 | Restore the old archive with the later journal. | none | none |
| ERASURE-001 | 2 | require refusal. | none | none |
| ERASURE-001 | 2 | restore the latest archive. | none | none |
| ERASURE-001 | 2 | retain kept files. | none | none |
| ERASURE-001 | 2 | erasure history. | none | none |
| AUDIT-001 | 1 | Create. | none | none |
| AUDIT-001 | 1 | review work, approve a proposal/export. | none | none |
| AUDIT-001 | 1 | erase a file through public doors. | none | none |
| AUDIT-001 | 2 | Read the owner action history, compare attribution with the actors. | none | none |
| AUDIT-001 | 2 | inspect retained audit rows after an archive round trip. | none | none |
| BASE-001 | 1 | Use native sign-in, import a client list, collect a file, review work, approve a billing export. | none | none |
| BASE-001 | 1 | archive/erase/restore through public doors. | none | none |
| BASE-001 | 2 | Inspect staff/key. | none | none |
| BASE-001 | 2 | contact/share revocation, attributed decisions, retained file/import bytes. | none | none |
| BASE-001 | 2 | approved CSVs, denied stale restores. | none | none |
| BASE-001 | 2 | excluded document-share tokens. | none | none |
| BASE-001 | 3 | Future carriers repeat the inherited activation gate on their own paths before shipping. | none | none |
| BASE-001 | 3 | their unbuilt capabilities remain open under their own clauses. | none | none |
| AI-002 | 1 | Upload a wrong-period statement, illegible scan. | none | none |
| AI-002 | 1 | correct invoice with misleading embedded instructions. | none | none |
| AI-002 | 2 | Inspect sourced validation/naming/routing proposals, approve one. | none | none |
| AI-002 | 2 | reject another. | none | none |
| AI-002 | 2 | originals persist. | none | none |
| AI-002 | 2 | no file changes client or visibility without authority. | none | none |
| AI-002 | 3 | Only an authorized staff member's explicit click may transmit selected source text, after masking tax identifiers, SSNs. | none | none |
| AI-002 | 3 | bank numbers. | none | none |
| AI-002 | 4 | Retain input hash. | none | none |
| AI-002 | 4 | source identifiers rather than input content. | none | none |
| AI-002 | 4 | record requester, source identifiers, provider, model, bytes. | none | none |
| AI-002 | 4 | time once per request. | none | none |
| AI-002 | 5 | Provider output persists only as a draft the person saves. | none | none |
| AI-002 | 6 | The portal disclosure states that staff may use an AI provider on client documents. | none | none |
| AI-003 | 1 | Enable one client-scoped file-event agent. | none | none |
| AI-003 | 1 | one scheduled agent, deliver duplicate events. | none | none |
| AI-003 | 1 | inspect a single pending plan. | none | none |
| AI-003 | 2 | Under the held company policy, deny an external action, exhaust a budget. | none | none |
| AI-003 | 2 | revoke the agent mid-run. | none | none |
| AI-003 | 2 | verify retained outcomes, no unapproved effects. | none | none |
| AI-003 | 2 | no cross-client data. | none | none |
| LEARN-001 | 1 | Complete two periods with a repeated reviewer correction, inspect a proposed template/request change with source examples. | none | none |
| LEARN-001 | 1 | approve it for selected clients. | none | none |
| LEARN-001 | 2 | Roll forward, compare exception outcomes. | none | none |
| LEARN-001 | 2 | verify rejected changes. | none | none |
| LEARN-001 | 2 | signed-off history remain unchanged. | none | none |
| LEARN-001 | 3 | The principal approves an immutable numbered checklist/request/organizer snapshot for selected observed clients. | none | none |
| LEARN-001 | 4 | All new-job doors apply that client version while retaining source template identity, fees/currency. | none | none |
| LEARN-001 | 4 | existing job snapshots. | none | none |
| LEARN-001 | 4 | a declined preparation changes nothing. | none | none |
| LEARN-001 | 5 | Source/template/client-version changes fence stale approval. | none | none |
| LEARN-001 | 6 | Comparison uses the exact next period, per client, against the baseline per-period mean of reviewer-return events, client questions. | none | none |
| LEARN-001 | 6 | document-return events plus currently outstanding active requests. | none | none |
| LEARN-001 | 7 | Missing periods stay pending. | none | none |
| LEARN-001 | 7 | unfinished work provisional. | none | none |
| LEARN-001 | 7 | negative deltas mean fewer exceptions. | none | none |
| LEARN-001 | 7 | do not prove causation. | none | none |
| LEARN-001 | 8 | Supporting private content stays at its current authorized source, with references in learning. | none | none |
| LEARN-001 | 8 | versions. | none | none |
| LEARN-001 | 8 | references are portable. | none | none |
| LEARN-001 | 8 | source erasure retains the archive fence. | none | none |
| REVENUE-001 | 1 | Introduce unbilled out-of-scope work, a duplicate invoice. | none | none |
| REVENUE-001 | 1 | an ACH return. | none | none |
| REVENUE-001 | 2 | Inspect cited exceptions. | none | none |
| REVENUE-001 | 2 | an amendment draft, approve one correction. | none | none |
| REVENUE-001 | 2 | decline another. | none | none |
| REVENUE-001 | 2 | reconcile confirmed provider events. | none | none |
| REVENUE-001 | 2 | leave the returned payment owned/open without duplicate charging or a silent write-off. | none | none |
| CRM-002 | 1 | The parent, subsidiary and household have their recorded group relationships. | `tests/blotter/flows.test.mjs:702` | asserted |
| CRM-002 | 1 | The group filter returns exactly those three clients. | `tests/blotter/flows.test.mjs:704` | asserted |
| CRM-002 | 1 | Fiscal-year and service-tier fields retain their typed values. | `tests/blotter/flows.test.mjs:706` | asserted |
| CRM-002 | 1 | Scheduling the filtered annual work creates exactly three jobs. | `tests/blotter/flows.test.mjs:715` | asserted |
| CRM-002 | 2 | The bulk preview distinguishes unchanged, changed and rejected values. | `tests/blotter/flows.test.mjs:721` | asserted |
| CRM-002 | 2 | The invalid choice has the named validation reason. | `tests/blotter/flows.test.mjs:722` | asserted |
| CRM-002 | 2 | Only the previewed subsidiary changes. | `tests/blotter/flows.test.mjs:724` | asserted |
| CRM-002 | 2 | The unrelated client and excluded household retain their previous field values. | `tests/blotter/flows.test.mjs:726` | asserted |
| DOC-003 | 1 | The first statement version is listed as sent with its exact hash. | `tests/blotter/flows.test.mjs:484` | asserted |
| DOC-003 | 1 | The first statement’s downloaded bytes equal its original. | `tests/blotter/flows.test.mjs:485` | asserted |
| DOC-003 | 2 | The client change decision is recorded. | `tests/blotter/flows.test.mjs:490` | asserted |
| DOC-003 | 2 | The first version retains its requested-change comment. | `tests/blotter/flows.test.mjs:523` | asserted |
| DOC-003 | 3 | The second version is numbered two. | `tests/blotter/flows.test.mjs:510` | asserted |
| DOC-003 | 3 | The exact second version reaches approved and moves the job into review. | `tests/blotter/flows.test.mjs:515` | asserted |
| DOC-003 | 4 | The approval names the client and the second version’s exact hash. | `tests/blotter/flows.test.mjs:521` | asserted |
| DOC-003 | 4 | The approval has a recorded time. | `tests/blotter/flows.test.mjs:522` | asserted |
| DOC-003 | 4 | The first version’s comment remains on that version. | `tests/blotter/flows.test.mjs:523` | asserted |
| DOC-003 | 4 | The job is in review under the preparer’s submission attribution. | `tests/blotter/flows.test.mjs:524` | asserted |
| DOC-003 | 5 | Approval of the superseded first version is refused. | `tests/blotter/flows.test.mjs:513` | asserted |
| TIME-002 | 1 | Weekly submission includes both entries. | `tests/blotter/flows.test.mjs:247` | asserted |
| TIME-002 | 1 | Approved and returned entries have distinct states. | `tests/blotter/flows.test.mjs:255` | asserted |
| TIME-002 | 1 | The returned reason is read back. | `tests/blotter/flows.test.mjs:256` | asserted |
| TIME-002 | 1 | The correction preserves the original reference and corrected minutes. | `tests/blotter/flows.test.mjs:263` | asserted |
| TIME-002 | 1 | The approved period is locked and the original record survives. | `tests/blotter/flows.test.mjs:283` | asserted |
| TIME-002 | 2 | A direct edit of closed time is refused. | `tests/blotter/flows.test.mjs:272` | asserted |
| TIME-002 | 2 | A source reserved by one export cannot be billed again. | `tests/blotter/flows.test.mjs:276` | asserted |
| TIME-002 | 2 | An unauthorized adjustment is refused. | `tests/blotter/flows.test.mjs:278` | asserted |
| TIME-002 | 2 | The authorized adjustment has the correct amount. | `tests/blotter/flows.test.mjs:281` | asserted |
| TIME-002 | 2 | Adjustment minutes amount reason and author remain in history. | `tests/blotter/flows.test.mjs:284` | asserted |
| TIME-002 | 2 | The time audit retains add approve and adjust actions. | `tests/blotter/flows.test.mjs:285` | asserted |
| TIME-002 | 2 | The adjustment’s billing line has its own amount and source. | `tests/blotter/flows.test.mjs:287` | asserted |
| PORTAL-001 | 1 | Rotation refuses the old upload link. | `tests/blotter/flows.test.mjs:70` | asserted |
| PORTAL-001 | 1 | Cross-origin upload is refused. | `tests/blotter/flows.test.mjs:72` | asserted |
| PORTAL-001 | 1 | The oversized upload is refused. | `tests/blotter/flows.test.mjs:73` | asserted |
| PORTAL-001 | 1 | Both successful uploads are read back as received. | `tests/blotter/flows.test.mjs:77` | asserted |
| PORTAL-001 | 2 | The downloaded file equals the uploaded original bytes. | `tests/blotter/flows.test.mjs:79` | asserted |
| PORTAL-001 | 2 | Collection is closed after sign-off. | `tests/blotter/flows.test.mjs:95` | asserted |
| REVIEW-001 | 1 | Premature submission is refused. | `tests/blotter/flows.test.mjs:81` | asserted |
| REVIEW-001 | 2 | Preparer sign-off is refused. | `tests/blotter/flows.test.mjs:90` | asserted |
| REVIEW-001 | 2 | A sign-off without its required note is refused. | `tests/blotter/flows.test.mjs:91` | asserted |
| REVIEW-001 | 2 | Assigned-reviewer approval results in signed-off work. | `tests/blotter/flows.test.mjs:93` | asserted |
| REVIEW-001 | 2 | The signed-off actor is the reviewer. | `tests/blotter/flows.test.mjs:94` | asserted |
| REVIEW-001 | 2 | The completed work closes its upload portal. | `tests/blotter/flows.test.mjs:95` | asserted |
| REVIEW-001 | 2 | A signed-off checklist cannot be changed. | `tests/blotter/flows.test.mjs:96` | asserted |
| WORK-001 | 1 | The started job retains its copied fee. | `tests/blotter/flows.test.mjs:44` | asserted |
| WORK-001 | 1 | The started job retains its checklist. | `tests/blotter/flows.test.mjs:53` | asserted |
| WORK-001 | 1 | The started job begins with fresh requested documents. | `tests/blotter/flows.test.mjs:54` | asserted |
| WORK-001 | 2 | A preparer cannot create the template. | `tests/blotter/flows.test.mjs:30` | asserted |
| WORK-005 | 1 | The preparer’s queue excludes another preparer’s job beside a visible job. | `tests/blotter/flows.test.mjs:49` | asserted |
| WORK-005 | 2 | The other preparer’s direct private-job read is refused. | `tests/blotter/flows.test.mjs:50` | asserted |
| AGENT-001 | 1 | The roll-forward preparation is pending. | `tests/blotter/flows.test.mjs:601` | asserted |
| AGENT-001 | 1 | The agent credential cannot decide its own proposal. | `tests/blotter/flows.test.mjs:602` | asserted |
| AGENT-001 | 1 | The person-approved roll-forward creates the expected next period. | `tests/blotter/flows.test.mjs:604` | asserted |
| AGENT-001 | 1 | The prepared reminder sends one additional mail. | `tests/blotter/flows.test.mjs:612` | asserted |
| AGENT-001 | 1 | The proposal is linked to the recorded reminder. | `tests/blotter/flows.test.mjs:613` | asserted |
| AGENT-001 | 1 | The declined export preparation has declined status. | `tests/blotter/flows.test.mjs:618` | asserted |
| AGENT-001 | 2 | The proposal decision identifies the person. | `tests/blotter/flows.test.mjs:607` | asserted |
| AGENT-001 | 2 | The decision retains its result identity. | `tests/blotter/flows.test.mjs:608` | asserted |
| AGENT-001 | 2 | A repeated decision is refused. | `tests/blotter/flows.test.mjs:605` | asserted |
| AGENT-001 | 2 | The revoked agent key is refused. | `tests/blotter/flows.test.mjs:620` | asserted |
| CAPACITY-001 | 2 | Available time demand overload and actual time reconcile for the preparer. | `tests/blotter/flows.test.mjs:1483` | asserted |
| CAPACITY-001 | 2 | The reviewer’s commitment and available time reconcile separately. | `tests/blotter/flows.test.mjs:1484` | asserted |
| CAPACITY-001 | 2 | The drill-down includes only the due-week estimated tasks and preserves their actual time. | `tests/blotter/flows.test.mjs:1486` | asserted |
| CAPACITY-001 | 2 | The missing estimates are listed separately. | `tests/blotter/flows.test.mjs:1487` | asserted |
| CAPACITY-001 | 2 | Each deadline conflict has its specific explanation. | `tests/blotter/flows.test.mjs:1488` | asserted |
| CAPACITY-001 | 2 | Changed task and review estimates update demand and overload. | `tests/blotter/flows.test.mjs:1495` | asserted |
| CAPACITY-001 | 2 | The combined demand changes by both independent estimate deltas. | `tests/blotter/flows.test.mjs:1496` | asserted |
| CAPACITY-001 | 2 | Only the remaining conflicts remain after the estimates change. | `tests/blotter/flows.test.mjs:1497` | asserted |
| CAPACITY-001 | 6 | Actual time is retained beside each task estimate. | `tests/blotter/flows.test.mjs:1486` | asserted |
| CAPACITY-001 | 7 | Demand above available time marks overload. | `tests/blotter/flows.test.mjs:1483` | asserted |
| PORTAL-001 | 1 | The upload limit is displayed to the client. | none | none |
| REVIEW-001 | 2 | The persisted sign-off note and nonempty sign-off time are read back after approval. | none | none |
| WORK-001 | 1 | All copied recurrence and preparer/reviewer fields are asserted together. | none | none |
| WORK-005 | 1 | Every role’s queue dates assignees status and outstanding counts are asserted together. | none | none |
| AGENT-001 | 1 | The declined proposal’s reason is read back. | none | none |
| CAPACITY-001 | 1 | The seeded setup’s complete preparation and review budget is read back. | none | none |
| CAPACITY-001 | 3 | Unset hours and weekday-only leave rules are asserted for their boundary cases. | none | none |
| CAPACITY-001 | 4 | Availability clamps at zero after leave and commitments exceed the weekly hours. | none | none |
| CAPACITY-001 | 5 | Every demand source including the task-to-job due-date fallback is independently reconciled. | none | none |
