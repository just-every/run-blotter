# WORK-002 capability rules

The following source rules are retained from the contract at `ca2596bae4c081a2df169d327b23c0030428b918`. Current acceptance and company-policy classes are defined by CONTRACT.md.

**Semantics (WORK-002):** a principal or reviewer approves one rule per client and template; approving it is the approval.

**WORK-002 — Automatic recurring work and roll forward.** Approved recurrence rules create the next period automatically with assigned staff, fresh requests, dependencies, budget and calculated due dates.

Skipping needs a reason.

**WORK-002 — Automatic recurring work and roll forward.** Status: **done**. Enable monthly and fiscal-year recurrence with a three-month lead time, let scheduled work become due and inspect exactly the periods inside the lead time, each once, with fresh requests. Attach two existing future jobs to a monthly rule and advance the horizon; the rule creates only the following period. Restart the scheduler, pause a client, skip a period and override a due date; no duplicate or silently altered prior job appears. The scheduler is the Worker's hourly Cron Trigger; due dates are the rule's days after the period ends (see CONTRACT.md WORK-002 semantics).
