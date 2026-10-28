# TIME-001 capability rules

The following source rules are retained from the contract at `ca2596bae4c081a2df169d327b23c0030428b918`. Current acceptance and company-policy classes are defined by CONTRACT.md.

**Timers and budgets (implemented subset):** a person runs at most one timer, kept by the server so it continues across restarts and devices; stopping it records one time entry through the manual-entry path (rate in force snapshotted, closed periods refused) for the elapsed time rounded up to the next whole minute (at least 1, at most 1440), dated the UTC day the timer started, and a discarded timer records nothing.

**Billable status (implemented subset):** each time entry is billable or not, chosen by the person when they record it by hand or start a timer (billable unless they choose otherwise), and a TIME-002 correction keeps the returned entry's status unless the person changes it.

**Semantics (TIME-001):** a time entry or timer names its job, and so its client, and optionally one of that job's checklist tasks; a correction keeps the task unless the person changes it.

**Activity suggestions:** consent is per person, off by default, given and withdrawn only by that person on their Jobs screen. While it is on, that person's own audited work actions on jobs they can record time on (completing a checklist task, accepting or returning a document, opening, replying to or requesting a correction in a discussion, any tax-notice timeline action, discarding a timer) taken at or after the moment of consent suggest one entry per job and UTC day on which they recorded no time of their own on that job; each suggestion lists and links its source actions. Only that person sees, approves or rejects their suggestions: approval needs the minutes and an explicit billable choice and records the entry through the manual-entry path (rate in force on that day snapshotted, closed periods refused); rejection records nothing; each decision is kept once with its source action ids. Approved suggestions are ordinary time, so they reach WIP only once approved on a timesheet (TIME-002) and only if billable. Withdrawing consent removes every pending suggestion, and consenting again never uses earlier actions. Email and calendar activity are not sources until MAIL-001 and INTEGRATE-005 ship, each with its own per-source consent (written into those clauses).

**TIME-001 — Time budgets and activity suggestions.** Record time against client/job/task with manual entry and timers, billable status and snapshotted rate; compare actual hours/cost with approved budgets.

**TIME-001 — Time budgets and activity suggestions.** Status: **done**. Record time, change the rate and inspect unchanged prior amounts and budget variance. Stop/restart a timer, reject one activity suggestion and approve another; verify only approved minutes enter WIP and unauthorized edits are refused.
