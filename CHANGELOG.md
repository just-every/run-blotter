# Blotter changelog

## 2026-10-28 — Contract structure rewrite

The contract now uses one generated acceptance source. The judgement date and evidence provenance are carried; no new Done status is claimed.

## Prior judgement and delivery history

This is the product destination. Status below describes current code, not a reduction of that destination. The previous first-release ACCEPTANCE.md described an Australian BAS-style workflow with manual deadlines, link uploads, independent review and billing CSVs; there was no root CONTRACT.md or existing product clause ID to rename. Its useful guarantees are retained here. The Status table classifies each clause as published, target or push-further, including implemented foundations. Existing UI, homepage and runtime behavior are unchanged by this document.

Every named clause gives buyer behavior and an acceptance journey through the app, authenticated HTTP API, CLI or authorized provider door. ACCEPTANCE.md lists the same journeys and statuses. A cited local file/test proves only its stated implemented subset; it does not prove real-provider acceptance, tax authority access, native distribution, production capacity or accessibility. Real-provider journeys use authorized accounts; automated tests fake only paid/network edges. Source freshness, provider acknowledgment, settlement and human judgment are distinct facts.

Current statuses describe this candidate tree. The exact commit and its verification runs are reported in the branch handoff; a status claim is counted only after the guarded landing and CT judgment. Due dates are recorded by people, set by WORK-002 rules or calculated from approved deadline rules (DUE-001, DUE-003).


Judged from the code and tests at commit `288174d52e6669fd343d2a249f440cb2a44f2a88` (27 October 2026).

The prior revenue proof snapshot `83f849a50ea31844e903a91dad44c1ce628f1603` is the revenue candidate `7bc2dbcb01872282b30dd4bb9093cd281460d563` rebased onto the identity source baseline `254d43d34f4352a40a64c7189e0a58ec6a8a1d11`. Its REVENUE-001 proof snapshot contains the production source and all cited revenue assertions, including first-write and replay acknowledgments, and includes the fresh ct fix-round assertions for taxable and voided retainers, nonzero native receipts and attributed preparation and accounting writes. CT judged REVENUE-001 and accepted it as done.

The identity candidate adds atomic native-deactivation fencing and isolated live-journey proof configuration to its source baseline; its exact commit and recorded runs are in the branch handoff. Guarded landing and CT judgment remain required before counting ACCESS-003.

SECURE-001 is a partial native recorded-download export slice. Its implementation and original public-door proof are in the opening snapshot; final branch checks and strengthened erasure and authority assertions are recorded with the candidate handoff. Export audits retain their exact event membership, so a later download within the same date range cannot create a false outside-copy attribution. No attestation or complete security-program claim is made.

BILL-005 includes held-key sandbox proof from 26 October 2026; earlier judgements are retained.



CRM-004: Implemented and asserted on MSG-002's doors (consent carriers journey, `tests/blotter/bulk-messages.test.mjs`); MSG-002 states the exact semantics.

CRM-005: Implemented and asserted on MSG-002's doors (consent carriers journey, `tests/blotter/bulk-messages.test.mjs`); MSG-002 states the exact semantics.

WORK-006: a board card or plan move is a WORK-007 status change recorded in the job's history, so AUTOMATE-001's status triggers fire on it as on any other move; WORK-006 is done for every capability that exists today.

WORK-007: AUTOMATE-001 status triggers and set-status actions, WORK-006 plans and boards, REPORT-001 status reports and the MIGRATE-001 Karbon import carry WORK-007's status model in their own text and acceptance; WORK-007 is done for every capability that exists today.

SEARCH-001: SEARCH-001 is done for every capability that exists today.

CAPACITY-002: CAPACITY-002 is done for every capability that exists today.

CAPACITY-003: CAPACITY-003 is done for every capability that exists today.

ACCESS-006: Implemented and asserted on MSG-002's doors (consent carriers journey, `tests/blotter/bulk-messages.test.mjs`); MSG-002 states the exact semantics.

AI-001: Mailbox threads and signed engagement scope remain unavailable.

READY-001: No native model, ledger comparison, signed scope or tax filing is claimed.

LEARN-001: the existing external-agent key reads live source-linked corrections, questions and missing-document patterns and prepares a structured improvement for the principal who owns that key; Blotter does not claim to have run a model.

ONBOARD-001: This subset has no agent or model door and no execution or send authority.

ONBOARD-001: The complete partner and agent workflow remains an unbuilt obligation.

NOTICE-001: IRS transcript context and comparison remain unavailable until RESOLVE-001 and INTEGRATE-006 are authorized; the response plan is a proposal, never legal or tax advice.

## Prior incremental claim mirror
# Generated contract claims

These clauses use the native contract mirror. Other clauses remain in the legacy acceptance register. CONTRACT.md is the source.

## SECURE-001 — Security program and attestation

Status: **partial**.

Evidence: `src/blotter/security-logs.ts`; `src/ui/security.tsx`; `API.md`; `tests/blotter/security-logs.test.mjs` — “Recorded access-log export selects exact UTC instants across DST” (actual staff, contact-portal and bearer HTTP downloads, exact UTC selection and exclusion, safe fields, spreadsheet escaping, unchanged sources and attributed export); “Access-log export requires the live principal” (role, delegated authority, agent, deactivated, MFA and per-session step-up refusals); “Current access logs remain portable” (safe projection, snapshotted CSV membership through empty export, later download and second export, unchanged copy inventory after restore, archive equality, excluded live authority and stale-restore fencing); `tests/blotter/security-logs-ui.mjs` / securityLogsJourney (Sign-in security CSV download, date boundaries, coverage and unverified identity disclosure, existing icon tooltips, 1440 and 390 screens).

Gap: Native recorded document-download log export only: successful staff, contact-portal and bearer events, principal-only with fresh step-up; bearer identity remains unverified and coverage is explicitly incomplete. Missing: security overview; authorized auditor or attestation-provider account or NDA report access supplying a genuine current SOC 2 Type II report, bridge letter and penetration-test summary; attestation-package request and download with current-period verification; enabled-integration subprocessor list; data-flow description; SIG Lite or CAIQ questionnaire; documented WISP and FTC controls covering encryption, US residency, access logging, tested backups and restores, vulnerability management and incident response with 72-hour customer notification; WISP template mapped to IRS Publications 4557 and 5708. No certification or provider evidence is claimed.

## MOBILE-001 — Mobile client and practitioner work

Status: **partial**.

Evidence: `src/ui/portal.tsx`; `src/ui/workspace.tsx`; `src/ui/job.tsx`; `src/ui/timer.tsx`; `src/blotter/timers.ts`; `tests/blotter/flows.test.mjs` (TIME-001 timers and budgets; PORTAL-003 client progress, secure questions and to-dos); `tests/blotter/mobile-ui.mjs` (mobileTimeJourney; mobileTaskJourney); `tests/blotter/mobile-upload.test.mjs` (MOBILE-001 browser recovery and portal authority journeys; invokes `tests/blotter/mobile-ui.mjs` mobileUploadJourney in push Verify); `tests/blotter/erasure-policy.test.mjs` (policy journey with portal packet original: holds, signed-work clocks, preview, receipt and restore fence); `tests/blotter/organizers.test.mjs` (conditional organizers: contact-specific packet authority and inactive-request refusal)

Gap: Browser timer and manual-time, client to-do and staff review, keyboard navigation, automated accessibility, tooltip and revoked-authority journeys are proven. Browser interrupted uploads of a selected multi-page original now retain confirmed progress, require explicit retry and exact-original reselection after reload, complete once, preserve contact attribution, exclude staging from archives and retain existing completed-file custody and erasure fencing. Camera scanning and cropping and capture qualification, native iOS and Android apps and distribution, physical-device client and staff journeys, consented private push with NOTIFY-001, offline draft state and organizer conflict reconciliation with current-confirmation rules, and native assistive-technology qualification remain missing. Those capabilities require real devices and Apple and Google developer accounts with signing and push credentials. Remaining native records and provider copies still owe the inherited BASE-001 and ERASURE-002 activation gates.

CRM-022: CRM-005 is done for the native pipeline and intake that exist today.

MSG-012: real-provider bounce, complaint and one-click proof on an authorized account (ct 20 Oct 23:12Z: a real signed event from the platform mail relay; no fixture is claimed as real); reply threading (no inbound mail door yet); the portal channel (PORTAL-002); incumbent migration consent mapping (MIGRATE-001–005); contact-only erasure suppression (ERASURE-002); and a workspace screen.

ARCHIVE-004: Those clauses retain their destinations and statuses; their unbuilt kinds do not make current-native portability incomplete.
