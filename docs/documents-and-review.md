# Client documents and review

Collect the requested files through one private link, then record a review decision on the finished job.

## Send a document request

Open a job in **Jobs**, then **Client documents → Send a reminder with an upload link**. Either keep **Standard reminder**, add an optional message and press **Send reminder**, or choose a message template: Blotter shows the subject and message exactly as this client will receive them. If a placeholder has no value (for example the client has no contact name), the preview names it; fill it in or choose another template, because Blotter will not send a message with a gap. Then press **Send this message**. The job's reminder history keeps the text as sent.

### Message templates

Under **Clients & templates → Message templates** (preparers: **Team & safety**), search templates or filter by category. The principal keeps firm templates and sets the **Firm name**; everyone can keep personal templates and **Save a personal copy** of a firm one. A template has a name, category, subject and message, with placeholders in double braces: `{{firm_name}}`, `{{sender_name}}`, `{{client_name}}`, `{{contact_first_name}}` (the first word of the contact's name), `{{work_item}}`, `{{work_type}}`, `{{period}}`, `{{due_date}}`, `{{outstanding_requests}}` (one line per document), `{{portal_link}}`, `{{invoice_amount}}` and `{{invoice_due_date}}` (no invoices exist yet, so these must be filled in by hand). Saving an edit creates a new version with its author; messages already sent never change, and deleting a template keeps what was sent.

On a deployed installation, Blotter mails the client their outstanding requests and upload link. Locally, mail is suppressed and you can copy the link shown in the job. The link appears once, replaces earlier links and has a displayed expiry date. Treat it as a private credential.

Reminders are sent when a person sends them, or approves an agent's preparation. They are not scheduled from the due date.

## The client's view

The client opens the link without an account. The page shows the practice name, job, period, due date, link expiry and document requests. For each request, the client chooses a file to upload. Each file can be at most 1 MiB.

To try this locally, open the upload link in a private browser window. Uploaded files appear against their request in the job.

## Accept or ask again

For each received request, inspect the files and choose **Accept**. If something is missing or unsuitable, open **Ask again**, explain what the client should send instead, then press **Ask the client again**.

If you received a document another way, use **Add a file received another way** on its request. The job keeps the file's name, size, upload channel and upload time.

## Client approval of deliverables

Send the client a finished deliverable, such as financial statements, a draft return copy or a management report, for approval. On an open job, open **Deliverables for client approval → Send a deliverable for approval**. Name the deliverable, choose its file (up to 1 MiB), add an optional note and press **Send for approval**. Tick **Submit the job for review when the client approves** to let the client's approval move the job to **Review**.

Blotter mails the client a fresh link, which replaces earlier links, and shows it once so you can pass it on yourself. The client opens it, downloads the version and either approves it or requests changes with a comment. Each answer records the client's name, the contact email on file, the time and the SHA-256 of the exact version they reviewed. A version is answered once.

To send a corrected file, open **Send a new version** on the deliverable. The new version becomes the one to decide on: an earlier approval no longer stands, earlier comments stay on their versions, and the client can no longer approve an older version.

An approval moves the job to **Review** only when its checklist is finished and every requested document is accepted; otherwise the job stays open and the approval says so. The person who sent the version is recorded as the submitter, so the normal review rules still apply.

## Submit and review

Finish every checklist step and accept every requested document, then press **Submit for review**. The job moves from **Open** to **Review**.

The assigned reviewer, or the principal, opens **Review**. Choose **Sign off** or **Return to preparer**, write a **Review note** and press **Record decision**. Reviewers cannot sign off their own preparation. A principal reviewing their own work must explicitly confirm this; it is recorded.

Submitting a job alerts its assigned reviewer, in **Alerts** on the Jobs page and by email. Returning a job alerts the preparer the same way.

Returning a job opens it for further work. Signing off records the person, time and note, and closes the client upload link. The audit log in **Team & safety** records the decisions.

## Internal discussion

Open **Internal discussion → Start a discussion** on a job. Give it a subject, choose what it is about (the job, its review, a checklist step, a document request or the whole client) and write a message. To mention colleagues, list their emails; only people who can already see the work can be mentioned, and each is alerted. Reviewers and the principal can tick **Request a correction from the preparer** with a **Follow up by** date: the preparer owns the correction and is alerted.

Threads show **Unread** until you open them, and a reply makes them unread for the others. Replies alert the thread's owner and the person who started it. The owner, or the principal, resolves a thread with a recorded decision; the resolved thread and its messages are kept and can no longer be changed.

Threads are internal. The client link never shows them, and a preparer who is not assigned to the work cannot open them.

Next, [roll the job forward](/docs/jobs) or [export the billable items](/docs/time-and-billing).
