# AUTOMATE-001 capability rules

The following source rules are retained from the contract at `ca2596bae4c081a2df169d327b23c0030428b918`. Current acceptance and company-policy classes are defined by CONTRACT.md.

**Status model (WORK-007, inherited before this ships):** a trigger on entering a stage or sub-status fires once per entry in the job's status history, and a set-status action moves jobs only through WORK-007's moves, sub-status limits and review gates (including partner sign-off).

**Boards and plans (WORK-006, inherited before this ships):** a status trigger fires on a move made from a WORK-006 board card or personal plan exactly as on any other WORK-007 move.

**Inherited MSG-002 marketing consent (ct 20 Oct 21:21Z):** Automation sends engagement class only, with MSG-002's send-time recheck.

**AUTOMATE-001 — Durable firm automation.** Firm-reviewed schedules and events coordinate status changes (WORK-007), recurrence, conditional step advancement, email filing, review notifications, reminders, onboarding and due-date billing.

**Current-native completion and inheritance (AUTOMATE-001; ct 20 Oct 09:58Z):** Offboarding previews rules that reference the departing person and checks their unchanged versions in its batch; approval is never silently transferred, and live checks refuse the inactive assignee until a new version is reviewed.

A principal previews explicit active clients, current jobs, message recipients/renderings and a positive lifetime attempt budget, saves an immutable version, then records its standing approval.

The approval stands until pause or revocation.

A new version requires its own preview and approval and supersedes the family's prior active version.

Drafts never execute.

Each run and native effect transaction rechecks that exact active version, its approving principal's current owner authority, live client scope/lifecycle and remaining budget; native assignment, document-consent, template-version, work-type, dependency and independent-review gates still apply.

A budget unit reserves one attempted effect, including failed attempts, with no automatic retry.

Status history entries, all applicable tasks completing, completed file uploads, all active document requests being accepted, organizer submissions, and decided job proposals are transactionally recorded events.

An offset-bearing ISO due time is an inclusive instant (displayed in the firm zone); the hourly trigger and principal's Evaluate door run the same durable processor.

Every status-history entry fires at most once per approved version, including board/personal-plan moves.

Reapproval starts with new events rather than replaying paused history.

Rules cover later work for their explicitly selected clients.

Available native actions set an open stage/sub-status or submit through the full review gate, assign a job role while preserving independent review, create a document request, send the exact approved message-template version through current recipient consent, or roll work forward with its recorded due-date source.

Existing conditional task advancement and review alerts remain the native consequences of those moves.

Due-date billing/invoice creation, signature completion/requests, connected email filing and accepted-proposal onboarding arrive with BILL-002, SIGN-001/002, MAIL-001/003 and ENGAGE-001/INTEGRATE-004 respectively; those carriers add their native event/action, live authority and budget checks, and this clause's once-only recovery assertions before shipping.

No nonexistent send, invoice, signature or provider verification is claimed.

Before external mail dispatch an attempt is durably marked dispatching, and approval is checked again; confirmed acceptance is recorded, while any lost/uncertain outcome stays held for recorded principal reconciliation.

Restart never blindly repeats a running/dispatching attempt.

Human reconciliation records confirmed acceptance or nonacceptance with evidence and never resends.

Retained attempts show outcomes and next actions.

Automation source records contain references, never file/organizer byte or answer copies; erased sources refuse pending effects, and the existing erasure journal fences stale restore.

Archives retain definitions, approvals and attempts, exclude the derived event queue, restore rules paused without live principal authority, and hold unfinished attempts; explicit fresh review is required before new work.

Current completion is asserted by the named AUTOMATE-001 / WORK-006 / WORK-007 / BASE-001 public-door journeys and the app journey.

Further action/provider/record kinds in FOLLOWUP-001, NOTIFY-001, PORTAL-002/005, LEDGER-001–003, PAY-001/002, BILL-003–005, API-002, INTEGRATE-001–008, MIGRATE-001–007 and AI-001–003 inherit the same activation and recovery obligations before shipping.

**AUTOMATE-001 — Durable firm automation.** Status: **done**. Enable rules through the app, including "when all tasks complete, set status In review" and "on entering Waiting – on client documents, send the request template". Trigger status, file/task/proposal and due-time events, interrupt processing after provider acceptance and restart. Inspect one authorized effect, retained attempts, a visible ambiguous/failing item and no work after rule pause or authority revocation. An automation on entering "Waiting – on 8879 signature" fires once when a 1040 job enters it (WORK-007). Moving a 1040 card on the board into "Waiting – on 8879 signature" fires that automation once (WORK-006). Before activation, satisfy BASE-001’s inherited authority/audit/erasure/portability gate with named public-door evidence.

Inherited MSG-002 marketing consent (ct 20 Oct 21:21Z), asserted on MSG-002's doors before marketing ships: automation sends engagement class only, with MSG-002's send-time recheck.

Current semantics and inherited actions: principal-approved immutable versions stand until paused/revoked (ct 20 Oct 09:58Z), with explicit client scope and lifetime attempt budgets, live authority and effect-transaction guards. Native events/actions, offset-bearing inclusive due instants, review gates, exact template versions, durable once-only claims, held ambiguous outcomes, evidence-backed human reconciliation without replay, safe paused restore and future action/provider carriers follow CONTRACT.md's AUTOMATE-001 semantics. BILL-002, SIGN-001/002, MAIL-001/003, ENGAGE-001/INTEGRATE-004 and the other named future carriers assert those obligations on their own doors before shipping.

Named acceptance: `tests/blotter/automation.test.mjs` exercises native tasks/status/file/request/organizer/proposal/due events, actual status gates, scoped effects, assignments/requests/roll-forward, exact message renderings and consent/template revocation, repeated board-door entries, lifetime budgets, pause/revoke, principal authority loss, worker restart after provider acceptance with a lost response, retained attempts, human reconciliation, audit attribution, paused archival restore, source erasure and stale-restore refusal. The app journey previews, saves and activates rules and inspects completed/held end states at 1440 and 390.
