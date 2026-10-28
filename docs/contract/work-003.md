# WORK-003 capability rules

The following source rules are retained from the contract at `ca2596bae4c081a2df169d327b23c0030428b918`. Current acceptance and company-policy classes are defined by CONTRACT.md.

**Semantics (WORK-003):** a template task may wait for other tasks of its job, for accepted client documents (its required evidence) and for the same client's prerequisite job from a named template, submitted for review (preparer gate) or signed off (reviewer gate); that prerequisite is the job whose period contains this job's last period day.

**WORK-003 — Dependencies and conditional workflow.** Templates define task dependencies, conditional branches, required evidence and preparer/reviewer gates across jobs.

**WORK-003 — Dependencies and conditional workflow.** Status: **done**. Create a close feeding a tax engagement, branch on an organizer answer and complete prerequisite tasks. Inspect automatic advancement and blocked successors; reject a cycle and record an authorized exception without fabricating evidence. Confirmed PORTAL-004 submissions write their bound workflow choices; drafts and unconfirmed carry never choose a branch (see CONTRACT.md WORK-003 semantics).
