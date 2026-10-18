# Time and billing

Record time at the rate in force on its date, then approve an export whose CSV stays fixed.

## Set rates first

As the principal, use **Team & safety → Set an hourly rate**. Choose what the rate applies to: a staff member, a role, a service (an engagement template, such as a 1040 return), a client, or a client and service together. Enter cents per hour, ex tax, and the date it takes effect. For example, `15000` means $150.00 per hour.

A time entry uses the first rate in force on the entry's date, in this order: client and service, then client, then service, then staff member, then role. **Rate cards** lists every rate with its start date.

Each time entry snapshots the rate it resolved and where it came from; the job's **Time** table shows both. A new rate applies from its date and never rewrites recorded time.

## Record time on a job

Open the job's **Time** section. Enter the date, minutes and description, then press **Record time**. The table shows the person, rate and amount.

You can delete your own unexported entries; the principal can also delete unexported entries. An entry already included in an export is protected.

## Prepare an export

As the principal or a reviewer, open **Time & billing**. **Ready to bill** shows recorded time and the fixed fees of signed-off jobs. Choose the items, give the export a title and press **Prepare export**.

Each time entry or fixed fee can belong to one export. Amounts are AUD ex GST. Blotter does not calculate GST or send invoices.

## Approve and download

As the principal, inspect the draft under **Exports**, open **Approve**, write a review note and press **Approve export**. Then use **Download CSV** for your own billing system.

Approval fixes the CSV. The export shows its line count, approval information and SHA-256 hash; downloading it again returns the same approved content.

If a draft should not proceed, open **Void**, enter a reason and press **Void draft**. Its items become available for another export. Approved exports cannot be voided or edited.

An [agent can prepare an export](/docs/agent-access) for a person to approve. Approving that preparation creates a draft; the principal still approves the billing export before a CSV exists.
