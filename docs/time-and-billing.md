# Time and billing

Record time at the rate in force on its date, then approve an export whose CSV stays fixed.

## Set rates first

As the principal, use **Team & safety → Set an hourly rate**. Choose what the rate applies to: a staff member, a role, a service (an engagement template, such as a 1040 return), a client, or a client and service together. Choose the currency (USD unless the rate is for first-release AUD work), enter cents per hour, before tax, and the date it takes effect. For example, `15000` means $150.00 per hour.

A time entry uses the first rate in force on the entry's date, in this order: client and service, then client, then service, then staff member, then role. **Rate cards** lists every rate with its start date.

Each time entry snapshots the rate it resolved and where it came from; the job's **Time** table shows both. A new rate applies from its date and never rewrites recorded time.

## Record time on a job

Open the job's **Time** section. Enter the date, minutes and description, then press **Record time**. The table shows the person, rate and amount.

Time is billable unless you untick **Billable to the client** (for internal or written-off work). Non-billable time keeps its rate and amount and counts against the job's time budget, but it never appears in **Ready to bill**, an export or the job's margin. A timer is billable or not as chosen when you start it.

To record time against one of the job's checklist tasks, choose it under **Task (optional)**; the table shows the task next to the description.

## Suggested time

Under **Jobs → Suggested time**, press **Turn on suggestions** to let Blotter suggest time from your own work. From that moment, each job and day on which you completed a checklist task, accepted or returned a document, posted in a discussion or worked on a tax notice, but recorded no time on that job, appears as a suggestion listing those actions. Only you see your suggestions. **Approve** one by entering the minutes and choosing whether it is billable (nothing is assumed), or **Reject** it; nothing is recorded until you approve. Approved time is ordinary time: submit it on your timesheet as usual. **Turn off suggestions** removes the pending ones; turning them on again starts afresh. Email and calendar activity are not used.

You can delete your own entries until they are submitted (or after one is returned to you); the principal can also delete them. Submitted, approved and exported entries are protected.

## Submit and approve timesheets

Under **Jobs → My timesheet**, each week (Monday to Sunday) lists your entries. Press **Submit** to send the week's new entries for approval.

As a reviewer or the principal, open **Time & billing → Timesheets to approve**. **Approve** each entry, or **Return** it with a reason. Nobody but the principal approves their own time. A returned entry shows its reason in the person's timesheet; they open **Correct**, fix the minutes, description or billable status and submit the correction, which replaces the returned entry.

Only approved billable time is ready to bill.

## Close a billing period

As the principal, open **Close a billing period** under **Timesheets to approve**, enter the dates and a closing note and press **Close period**. Every entry in the period must be approved first. Once closed, time dated in the period cannot be added, deleted or corrected.

## Adjust approved time

To correct approved or closed time, the principal opens the entry's **History** on the job and posts an adjustment: minutes to add or remove, with a reason. The original entry stays exactly as recorded; the adjustment is billed as its own line at the entry's rate. **History** shows the entry's submission, approval, adjustments and audit trail.

## Record expenses

Open the job's **Expenses** section and press **Record an expense**. Choose the kind (filing fee, postage, mileage, software pass-through or other), the date and a description, and enter the cost in the job's currency (US dollars unless the job is first-release AUD work). For mileage, enter the miles instead (one decimal place, such as `12.4`): Blotter uses the firm's mileage rate in force on that date. Tick **Billable to the client** and enter a markup percent (a whole number from 0 to 100) to charge the client cost plus markup, rounded to the cent. Attach the receipt if you have one (up to 1 MiB). If you paid it yourself, choose **Paid by: Me** so the firm reimburses you.

A reviewer or the principal then presses **Approve**, or **Reject** with a reason. Nobody but the principal approves their own expense. An expense dated in a closed billing period cannot be recorded, and recorded expenses never change.

Only approved billable expenses appear in **Ready to bill**, at cost plus markup. A non-billable expense never reaches an export, but its cost still counts against the job: the job's **Expenses** section shows its margin before staff cost (fixed fee, approved billable time and billable expense charges, less every approved expense's cost).

As the principal, set the firm's mileage rate (cents per mile and the date it takes effect) under **Time & billing → Staff reimbursements**. That section lists approved expenses staff paid themselves, owed back at cost and kept apart from what the client is charged; press **Mark reimbursed** once you have paid the person.

## Prepare an export

As the principal or a reviewer, open **Time & billing**. **Ready to bill** shows approved billable time and its adjustments, the fixed fees of signed-off jobs and approved billable expenses, with their total as work in progress. Choose the items, give the export a title and press **Prepare export**.

Each time entry, adjustment, fixed fee or expense can be reserved once by a billing export or a native invoice. Every amount keeps the currency it was recorded in, US dollars by default. Each export uses one currency, and amounts are never converted. Blotter does not calculate tax. Native invoices use their explicit review and delivery steps.

## Approve and download

As the principal, inspect the draft under **Exports**, open **Approve**, write a review note and press **Approve export**. Then use **Download CSV** for your own billing system.

Approval fixes the CSV. The export shows its line count, approval information and SHA-256 hash; downloading it again returns the same approved content.

If a draft should not proceed, open **Void**, enter a reason and press **Void draft**. Its items become available for another export. Approved exports cannot be voided or edited.

An [agent can prepare an export](/docs/agent-access) for a person to approve. Approving that preparation creates a draft; the principal still approves the billing export before a CSV exists.

## Review revenue exceptions

In **Time & billing**, the principal opens **Revenue review** and selects a client and its reviewed signed scope from Intake. Read the source quotes beside unbilled work, suspected duplicate invoices and owned payment exceptions. Each finding links to its evidence. Scope mapping requires human interpretation.

Use **Prepare draft** to retain an amendment or duplicate correction for review. Approving a duplicate correction voids its current draft invoice and keeps its source reserved against rebilling; an issued invoice keeps its own correction process. Approving an amendment records review and leaves signing, fee authorization and delivery for their explicit steps. A decline keeps its reason. Evidence changes require a fresh draft.

**Reconcile provider** reads current Stripe state. A returned ACH remains open with its invoice owner and next action. This review never retries a charge, schedules a debit or writes off a balance.
