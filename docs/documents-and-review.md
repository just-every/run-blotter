# Client documents and review

Collect the requested files through one private link, then record a review decision on the finished job.

## Send a document request

Open a job in **Jobs**, then **Client documents → Send a reminder with an upload link**. Add an optional message and press **Send reminder**.

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

Returning a job opens it for further work. Signing off records the person, time and note, and closes the client upload link. The audit log in **Team & safety** records the decisions.

Next, [roll the job forward](/docs/jobs) or [export the billable items](/docs/time-and-billing).
