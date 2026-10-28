# WORK-006 capability rules

The following source rules are retained from the contract at `ca2596bae4c081a2df169d327b23c0030428b918`. Current acceptance and company-policy classes are defined by CONTRACT.md.

**Status model (WORK-007, inherited before this ships):** moving a card or planning a job uses WORK-007's moves, sub-status limits and review gates and is recorded in its status history.

**Semantics (WORK-006):** a person's plan is a Monday-to-Sunday week: the jobs (where they are preparer, reviewer, manager or partner) and their own open tasks they place on its days, each job shown with its status, flags and WORK-007 move control, plus WORK-009's open tasks due in or before the week (or undated) and open jobs due in or before it to plan from; placing work never changes its status.

**Automations (AUTOMATE-001, inherited before it ships):** a board card or plan move is a WORK-007 status change recorded in the job's history, so AUTOMATE-001's status triggers fire on it as on any other move; WORK-006 is done for every capability that exists today.

**WORK-006 — Personal plans boards and calendars.** Provide a weekly personal action plan of the person's jobs and tasks (WORK-009), Kanban boards and firm/client calendars filtered by work type, primary status, sub-status, assignee, due date, blocked status and priority.

**WORK-006 — Personal plans boards and calendars.** Status: **done**. Plan a preparer's week from the overdue queue, group a 1040 board by sub-status, move an eligible card and inspect the same job's new status in queue, calendar and client views. A blocked review transition is refused and filters persist after refresh. The moved card's change appears in the job's WORK-007 status history. Filter by assignee, due dates, blocked and priority; moving a job's due date on the calendar previews its task dates, past-due warnings and capacity by week before it commits. An automation firing on a board move is AUTOMATE-001's (inherited).
