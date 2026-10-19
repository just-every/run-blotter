# Jobs and templates

Start a client's job from a template, then carry the same workflow into the next period.

## Add a client

Open **Clients & templates → Add a client**. Enter the client name, optional ABN, contact name and contact email. Document reminders go to this contact email.

You can also [bring in a client list](/docs/move-in) from a CSV.

## Save a template

Under **Job templates → Add a template**, set the name, recurrence, checklist steps, document requests and fixed fee. Each checklist step and document request goes on its own line. The prefilled **Quarterly BAS** template is a starting point; check it against how your practice works before saving.

The fixed fee is integer AUD cents, ex GST; use `0` for no fixed fee. Monthly, quarterly and annual recurrences describe the job's period. Due dates are recorded separately by a person.

### Tasks with owners and dates

Instead of plain checklist steps, press **Add a task** for each task. A task can have:

- an **owner**: a job role (Preparer, Reviewer or Manager), or a named person. A preparer named on a task can open that job and complete their own tasks there, even when they are not its preparer; they cannot change anything else on it. Each such grant is recorded in the audit, and it lasts while a task on the job is assigned to them.
- a **due** and **start** date, in whole days before (negative) or after the work's start (its period start) or its due date. For example, `-10` days from the due date.
- an **estimate** in minutes, **instructions** and an **SOP link** (a full `https://` address).
- **Needs an attachment to complete**: the task can only be ticked off by attaching a file (up to 1 MiB).
- **Client-facing**: the task's name, due date and progress appear on the client's upload link, without its instructions.

When tasks are listed, they replace the checklist steps text.

## Start a job

Under **Start a job**, choose the client and template. Enter the period start, the due date you have checked and **Where the due date comes from**. Assign a preparer and reviewer, and optionally a manager (otherwise the reviewer is the job's manager), then press **Start job**.

For example, a quarterly job starting `2026-07-01` is labelled Jul–Sep 2026. Record the applicable due date from the source you have checked; Blotter does not calculate it.

The **Jobs** tab lists visible work in progress by due date, then signed-off jobs, most recent first, with their status and outstanding checklist steps and documents. Open the job to do the work.

## Schedule work in bulk

As the principal or a reviewer, use **Clients & templates → Schedule work in bulk** to start one period's jobs for several clients at once. Choose the template, period start, due date and its source, and a default preparer and reviewer. Mark each client **Include** or **Exclude**, and override its preparer or reviewer where needed, then press **Preview**.

For each client, the preparer and reviewer come from your override, else the people on that client's last period of the template (while they are still active), else the defaults. The preview shows what will be created, which jobs already exist and are kept, and every conflict: an inactive person, someone who is not a reviewer, or a reviewer who would review their own work. Resolve or exclude each conflict, preview again and press **Commit this plan**. Blotter commits exactly the previewed plan, so if anything changed since the preview it asks you to preview again. Running the same batch again creates nothing new.

To move work between people or dates, open **Jobs → Reassign or reschedule in bulk**, tick the jobs, choose a new preparer, reviewer or due date (with its source), preview and commit. Signed-off jobs are never changed, inactive people cannot be assigned, and a job in review cannot go to the person who submitted it.

## Work through the job

The job records its client, template, people, period, due date and fixed fee. The checklist records who completed each step and when.

Each task shows its current owner and dates. Open tasks follow the job: when you move its due date or give it a new preparer (under **Reassign or reschedule in bulk**), their dates and owners change with it. A completed task keeps who completed it, when, and the owner and dates it had at that moment.

**Jobs → My week** is your weekly plan: choose any date to see that Monday-to-Sunday week. It lists your open tasks due that week or earlier (including overdue ones and tasks with no due date) with their SOP links, and your open jobs as preparer, reviewer or manager due by the end of the week. Collect the [client documents and review the finished job](/docs/documents-and-review); record your time in the job's **Time** section.

## Roll forward

As the principal or a reviewer, open **Roll forward to the next period** on the job. Record the next due date and its source, then press **Create next period's job**.

Blotter creates the next period with the same client, template and people. It refuses a second copy for that client, template and period. When the next job exists, **Open next period's job** takes you there.

## Keep the work visible to the right people

The principal and reviewers can see all jobs. A preparer sees only the jobs assigned to them. To change a person's role or remove access, use **Team & safety** as the principal.
