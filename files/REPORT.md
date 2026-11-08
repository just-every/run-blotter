# sx-blotter-c-f21

Scope: BASE-AGENT-008 acceptance point 6, native key and scheduled preparation attribution only. Keep PARTIAL. No contract status, gap or evidence edits; no optional capabilities, provider activation or effect authority.

Plan:
1. Inspect native session attribution, scheduled preparation, activity and existing archive paths. Map existing public-door journeys to the requested slice.
2. Snapshot current key labels and named rules as agent for sponsoring person on new audit rows, with stable key and rule references and existing proposal references. Preserve historical audit rows and distinct human decisions.
3. Extend existing flows, schedule and archive journeys and existing browser proof. Check exact actors and identifiers, historical byte equality, inactive restore, revocation, preparation counts, budgets and unchanged external effects.
4. Run touched journeys and typecheck, regenerate and check contract views then restore them, regenerate and check source lock last, and run first-party checks.
5. Reconcile main without rewriting published history, inspect all candidate identities and trailers, push named branch with fleet guard, discover exact-SHA Verify, publish actual non-secret evidence separately. Leave scanning and landing to fleet.

Initial inspection: session.ts already snapshots current key label and sponsoring display name. model.ts formats native agent activity as sponsor first. scheduled-agents.ts uses rule ID as display label. Existing archive policy preserves b_audit and excludes key secrets; restores pause scheduled rules and leave keys absent. Existing Team activity renders stored actor and detail without reinterpreting them.

Implemented:
- New native agent audit rows display the authenticated key label followed by its sponsoring person's current name and address. Native scheduler and keyed plan completion snapshot the named rule instead of its opaque ID. Existing Base door and human attribution are unchanged.
- Audit detail retains safe key and rule IDs; existing proposal and run references remain. Existing structured details keep their fields. Unstructured detail remains available under detail. Key bytes and digests are never added.
- No historical relabeling or migration. Historical fixture setup uses the prior native actor format and significant detail whitespace; public backup, restore and Team activity preserve its exact fields. Revocation leaves all existing audit rows unchanged; restored keys remain absent and rules paused.
- Necessary regression fix in src/blotter/erasure-scope.ts: new client-derived scheduled rule names would otherwise remain in actor after approved client erasure. The existing derived_ai class now redacts only the new named rule prefix before the rule name itself is erased; sponsor suffix, action, references and time stay. Existing holds apply. Legacy audit rows remain unchanged. No erasure hold is released.
- Existing tests were extended; no registrations added, removed or skipped. No existing assertion was weakened. The existing portability journey now uses an actual named timed schedule. Existing UI and tooltip components are reused; no product UI source was changed.

Frozen slice rubric:
R1 MET — Native key context and preparations are attributed to the current label for the authenticated sponsoring person. tests/blotter/flows.test.mjs, “BASE-001 / agent keys only prepare; a person approves or declines and the decision is recorded”, lines 594–642. Public HTTP context and three preparation doors, Team activity and backup; three exact attributed records, human-only decisions and revoked-key refusal.
R2 MET — Named scheduled and external preparations retain key, rule, run and proposal IDs with separate human decisions. tests/blotter/service-agents.test.mjs, “scoped file and scheduled plans” lines 73–119 and “keyed external plans enforce client, tool, immutable replay, live revocation and human decisions” lines 217 onward. Three distinct six-hour slots, once-only replay, budgets, scope refusal, roll-forward effect and human decision attribution are checked.
R3 MET — tests/blotter/service-agents-ui.mjs, serviceAgentsJourney, lines 70–100: real native key and named fixed-time schedule; exact Team activity, backup equality and human approver, after revocation, at 1440 and 390. Candidate screens native-agent-activity-1440.png and native-agent-activity-390.png inspected: readable wrapped text, no horizontal overflow. Existing keyboard and delayed hover tooltip assertions remain active at both widths.
R4 MET — tests/blotter/service-agents.test.mjs, “archives retain plans and costs”, lines 141–172: exact new and legacy historical fields survive revocation, inactive restore and re-export; revoked key refuses; restored keys absent, schedules paused, service activation off; erased-source journal refuses stale restore.
R5 MET — Existing “client erasure revokes scheduled grants” journey checks no derived rule name, provider policy or prepared text survives authorized unheld erasure, while sponsor and stable references remain. Both existing erasure-policy.test.mjs journeys pass, including client and class holds, preview, retained work, sealed remainder and stale restore. Preparation-only and external effect assertions remain unchanged.

Acceptance sentence coverage:
1–4 HELD — Full person-confirmation and classification guarantees, signed-person-step and form-mode guarantees, binding decisions, signatures and certificates are outside the selected native attribution slice.
5 INSPECTED AND EXERCISED IN SLICE — Existing native preparation approvals retain the signed-in human separately from the named preparer; broader preparation and approval journeys remain held.
6 MET FOR SELECTED NATIVE SLICE — R1–R4 above. Comprehensive runtime and optional-family conformance remains held.
7 HELD — Outside-message sender labeling is not activated or claimed. No new outbound agent effect was introduced.

DONE-RIDERS review (no DONE claim):
1 PARTIAL — Selected native activity and export slice exercised; other clause outcomes remain held.
2 PASS FOR SLICE — Populated HTTP and browser fixtures, allowed preparations and human decisions, revoked and foreign refusals, unchanged mail and budget assertions.
3 PENDING — Exact candidate Verify is reported in receipt.json; this report never substitutes another SHA's CI.
4 PASS — Final source tree and test hashes are in receipt.json; relevant source bytes were unchanged after successful browser proof.
5 INSPECTED — Existing BASE-AGENT-008 clause is the duty being implemented; no receiving-clause rewrite.
6 PASS MECHANICAL — Contract generator write then check passes, 63 DONE / 37 PARTIAL / 21 MISSING. Views restored from main and excluded from commits. Contract Status, Gap and Evidence untouched.
7 PASS — No acceptance, coverage, ruling or clause text edits.
8 PASS FOR SLICE — Existing live authority, revoked key, foreign caller, forbidden direct preparation, human-only decision and MFA assertions remain; both erasure-policy journeys pass.
9 HELD — No provider, full erasure activation or all-policy conformance claim. Existing provider and Base custody holds remain.
10 NOT APPLICABLE — No new policy default; existing preparation-only authority, consent, budgets and retention rules are reused.
11 PENDING LANDER — Cloud branch only. Main equality, complete publication scan with zero findings and Run site at landed SHA belong to guarded lander. Baseline main 686c2b4a41fc684df10727c97f53dbead829533e had Verify 42495520920 and Run site 42495520780 completed successfully.

Pre-ready checks:
1. Selected behaviour has populated runtime assertions through public doors. Local touched tests pass; exact-SHA Verify state is recorded separately.
2. No original assertions removed, narrowed, skipped or moved behind width conditions. No test registrations added.
3. Existing revoked authority, replay, client erasure, inactive restore and newer-journal stale restore checks pass. The existing client erasure assertion caught the new name exposure; fixed without weakening it.
4. Screens inspected at both widths. Product screen source unchanged. Existing icon tooltip tests pass at both widths.
5. Source lock fresh; contract views generate and check. Publication scan and landed Run site are not performed or claimed from cloud.

Validation history:
- First touched run: 46 passed, 2 failed. Existing erasure assertion found new rule label retained in actor; new browser fixture used a date beyond scheduler API's year-2189 limit. Fixed by class-respecting actor-prefix redaction and a fixed 2188 test clock. No assertions removed or weakened.
- Second touched run: 48 passed, 0 failed, including both browser widths. Separate existing erasure-policy run: 2 passed, 0 failed.
- Final archive fixture was strengthened from file-triggered to an actual timed named rule; final focused rerun and checks recorded in receipt.json.

Counts and planning: BASE-AGENT-008 PARTIAL remains PARTIAL. Actual main and after counts: 63 DONE / 37 PARTIAL / 21 MISSING; delta 0 / 0 / 0. The shipped extract's older totals are not current. No target plan row existed in extract; queue entry's native attribution slice is complete, no plan file changed.

GAP BASE-AGENT-008: Declared CORE preparation subset only. Optional custom events and subscriptions, multi-sponsor, outbound mail and resource refresh remain undeclared. Base runtime and harness subset switch, full person-confirmation and classification, form-mode elicitation, binding decisions and signatures and certificates, broader preparation and approval journeys, outside-message sender labels, remaining BASE-AGENT-001–012 acceptance, complete all-policy conformance and stranger-agent completion remain outside this slice. Preserve Base custody, aggregate-read replay and native-authority holds and ERASURE-002 retained-artifact custody hold. No capability, provider action or hold clearance is claimed.

Candidate: branch cloud/sx-blotter-c-f21, head 7c365d0b606430a862368de1ade6cc96e50342d7. Product push attempt 1 succeeded. No PR required: Verify starts on branch pushes. Exact-SHA Verify push run 42497299056 was in progress at discovery. No dispatch or rerun. GitHub API calls so far: 2 (baseline and candidate discovery).

MECHANICAL lock=node scripts/edition-authoring/cli.mjs lock then check exit=0; views=node scripts/contract-docs.mjs write then check exit=0; ledger=none exit=0. Generated views restored from origin/main; no contract cells changed.

Final exact-SHA follow-up: 3 passed / 0 failed (named timed schedule archive and inactive restore, keyed external preparations and full operator browser journey at 1440 and 390), plus typecheck exit 0. Both activity screenshots were regenerated on the pushed commit. No product source or test byte changed after the commit.

PROBE BASE-AGENT-008 6: native preparation, Team activity and backup -> named agent for sponsor, stable key and proposal IDs, human decision and unchanged history after revocation

PROBE BASE-AGENT-008 6: scheduled preparation and backup -> named rule for sponsor, stable key, rule, run and proposal IDs; three budgeted slots, one human-approved roll-forward and revoked-key refusal

PROBE BASE-AGENT-008 6: Team activity at 1440 and backup -> exact key and named schedule attribution, distinct human approval, stable identifiers after revocation

PROBE BASE-AGENT-008 6: Team activity at 390 and backup -> exact key and named schedule attribution, distinct human approval, stable identifiers after revocation

CLAIM BASE-AGENT-008 PARTIAL points=6 tests=tests/blotter/flows.test.mjs#BASE-001 / agent keys only prepare; a person approves or declines and the decision is recorded; tests/blotter/service-agents.test.mjs#AI-003 / COST-001 / BASE-001: archives retain plans and costs, restore schedules and service grants inactive, and erased sources fence old restores; tests/blotter/service-agents.test.mjs#COST-001 / AI-003: operator estimates and supervised-agent screens at 1440 and 390, with keyboard and delayed hover tooltips
