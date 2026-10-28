# WORK-008 capability rules

The following source rules are retained from the contract at `ca2596bae4c081a2df169d327b23c0030428b918`. Current acceptance and company-policy classes are defined by CONTRACT.md.

**Semantics (WORK-008):** the maintained native library contains monthly close; quarterly 941, state withholding and unemployment; sales-tax filing; 1040, 1120-S, 1065, 1120, 1041 and 990 returns; year-end 1099 and W-2; notice response; onboarding and offboarding.

**PORTAL-004 integration:** every authored library workflow now carries a versioned organizer with conditions and supporting-request bindings; firm question edits and individual release choices follow the same three-way conflict rules, and existing job snapshots stay unchanged. Published packages can bind confirmed organizer choices to WORK-003 workflow questions; those bindings are validated before publication/adoption.

**WORK-008 — Starter US template library.** Blotter maintains a versioned starter library of US templates that a firm can adopt and edit: monthly bookkeeping close, quarterly payroll (941, state withholding and unemployment), sales-tax filing, the 1040, 1120-S, 1065, 1120, 1041 and 990 returns, year-end 1099 and W-2, tax notice response, new-client onboarding and client offboarding.

**WORK-008 — Starter US template library.** Status: **done**. In a new US firm, browse the library and adopt the 1040 and monthly close templates. Edit one task and start a job from each, then inspect the copied tasks, requests, relative dates, statuses and messages. Publish a library update, preview its diff, accept one change and reject another. The firm's edited task survives and existing jobs are unchanged.

The public-door journey browses and adopts every named workflow, tailors a task/requests/budget and a MSG-001 message, starts 1040 and close jobs, inspects role owners, relative dates, work type/stages, requests, budget and rendered copied messages, imports a newer immutable sourced release, refuses unauthorized/invalid publication and stale/conflicting updates, accepts one request change while ignoring others, and verifies firm edits, old jobs and archive restore. PORTAL-004 now supplies versioned organizer definitions, per-question release choices, retained firm edits and immutable job snapshots, exercised by the named PORTAL-004/WORK-008 public-door library journey. Templates remain authored starting points for firm review; no agency verification is claimed.
