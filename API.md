# Agent API

An agent works with a key that the principal or a reviewer creates in
**Team & safety → Agent keys**. The key is shown once; keep it in your agent's
secret store. The agent acts for the person who created the key and sees what
that person sees. It can read context and **prepare** work. It cannot approve,
change records or send anything: each preparation waits in **Preparations**
until that person approves or declines it, and the decision is recorded with
its result.

Send the key as a bearer token. Bodies are JSON.

```sh
curl -s https://YOUR-INSTALLATION/api/blotter/agent/context \
  -H "authorization: Bearer $BLOTTER_AGENT_KEY"
```

## Read context

`GET /api/blotter/agent/context` returns:

- `jobs`: each visible job's `id`, `title`, `period_start`, `period_label`,
  `due_date`, `status`, `client`, whether the client has a contact email
  (`has_contact`), `outstanding` document labels and `next_job_id` (set once
  the next period exists);
- `unbilled`: billable items not yet in an export, each with a `source_key`
  (empty for preparers);
- `commands`: the preparation commands below.

## Prepare

| Command | Body | On approval |
| --- | --- | --- |
| `POST /api/blotter/agent/prepare-rollforward` | `{"jobId", "dueDate": "YYYY-MM-DD", "dueNote"}` | Creates the next period's job. `dueNote` says where the due date comes from; Blotter never computes it. |
| `POST /api/blotter/agent/prepare-reminder` | `{"jobId", "message"?}` | Issues a fresh upload link and mails the client the outstanding requests. |
| `POST /api/blotter/agent/prepare-export` | `{"title", "sourceKeys": [...]}` | Creates a draft billing export; the principal still approves it before any CSV exists. |

Roll-forwards and exports need a principal's or reviewer's key. Each command
returns `{"id", "kind", "status": "pending", "payload"}`. A revoked key, or a
person who is deactivated, gets `401` or `403`.

## Staff document packets (DOC-001)

These doors use a signed-in native person, not an agent key. Mutations retain the
job's full staff scope; task-only readers retain read access without annotation
or review authority. Chunked uploads are staff-only; the client portal keeps
its existing upload door. All completed originals use the normal permission-
checked `/api/blotter/files/:id` and `/documents/:id/file` downloads.

- `POST /api/blotter/requests/:id/packet-uploads`: `{name,mime,size,sha256,pageCount,source,author,previousFileId?}`. Returns upload id, confirmed byte offset, expiry and limits.
- `GET /api/blotter/jobs/:id/packet-uploads` and `GET /api/blotter/packet-uploads/:id`: discover pending uploads and resume their confirmed offset.
- `POST /api/blotter/packet-uploads/:id/chunks`: `{offset,chunkId,sha256,contentBase64}`. Full 256 KiB chunks except the final chunk; same id/offset/hash is idempotent.
- `POST /api/blotter/packet-uploads/:id/complete` or `/cancel`: `{}`. Completion requires exact original size/hash; cancel removes staging only.
- `GET /api/blotter/jobs/:id/document-packets?q=...` or `/clients/:id/document-packets?q=...`: authorized client/period folders, all versions, source/author/timestamps, annotations and review.
- `GET` / `POST /api/blotter/document-packets/:id/annotations`: read notes or append `{page,note,pageCount?}`; a historical original with unknown page count requires a one-time staff declaration.
- `POST /api/blotter/document-packets/:id/review`: `{revision,status,note?}`. Returned packets require a note.

Originals are 1 byte–20 MiB and 1–2,000 declared pages; pending uploads expire
after seven days. Every chunk rechecks staff/job/client scope. Original bytes
and prior versions remain exact, with independent review state and internal
notes. Corrected versions preserve exact contact grants without sharing tokens.
Archives include final chunks and metadata, exclude pending chunks and bearer
links, and retain the file-erasure fence. The existing JSON archive restore door
accepts up to 64,000,000 JSON characters; larger firm-scale streaming restoration
remains ARCHIVE-002.


## ARCHIVE-002 resumable practice archives

Owner sign-in and the existing same-origin write checks apply to every `/api/blotter/portability` route. `GET /portability` lists this owner's durable transfers and the limits. `POST /portability/exports {}` creates a frozen native snapshot; `GET /portability/exports/:id` returns progress, and `POST /portability/exports/:id/advance {expectedPart}` confirms at most one part. Repeating the previous cursor returns current progress. On completion, `GET /portability/exports/:id/download` streams the full `.rer` archive; append `?table=b_clients` (or any included manifest table) for a selected NDJSON analysis export that cannot restore an installation.

For an empty destination, `POST /portability/imports {manifest,confirm:"RESTORE"}` starts durable staging. Upload each verified archive part with `POST /portability/imports/:id/parts {part}`; identical retries are idempotent and differing content fails. `GET /portability/imports/:id` recovers progress after interruption. Finish with `POST /portability/imports/:id/finalize {archiveHash,contentHash,laterJournal?}` using the closing record's hashes. A later erasure journal has `{sourceIdentity,epoch,journal}` from a newer archive manifest and fences stale input. Either kind has `POST /portability/exports|imports/:id/abort {}` to remove staging. Max part JSON is 16 MiB, per-request JSON is bounded to 24,000,000 characters; the legacy `/restore` wrapper accepts at most 64,000,000 characters.

Restored recurrence is paused. `GET /rules/:id/activation` previews held periods and exact pending catch-up; pass its `token` as `previewToken` with `POST /rules/:id/status {status:"active",previewToken}`. A changed plan requires another preview. Past deferred alerts stay held history; source rules and confirmed past effects remain unchanged. No accounts, keys, second factors, client/share bearer credentials or provider secrets travel. Future capability clauses must provide the matching portability and inactive/reactivation journeys before activation.


## PORTAL-004 conditional organizers

Publish a template organizer with `POST /templates/:id/organizer {expectedVersion,organizer}`; read current/immutable versions with GET on that path. `organizer` has name, kind (`tax`/`bookkeeping`), positive integer version and ordered questions. Each question has a unique key, label, `type:"text"|"choice"`, choice options, required flag, optional `when:{question,values}` naming an earlier choice, optional supporting `request`, and optional `workflowQuestion`. Confirmed submitted choice bindings must match WORK-003 question options. New jobs snapshot definitions and confirmed prior submissions as explicitly unconfirmed carry.

`GET /jobs/:id/organizers` returns full-scope staff's current answers, responsibility, completeness, immutable submitted versions and review. `POST /jobs/:id/organizers/send/preview` previews `{revision,assignments:{questionKey:contactId},templateId?}`; POST the same body to `/send` for exact MSG-001 recipient rendering/attachments and separately labelled provider acceptance. Tokens are returned once and rotate only the same job/contact's older links. Contacts must already hold entity authority, request/email consent and portal permission.

A contact's existing `/portal/:token/organizers` list and `/organizers/:organizerId` detail expose only assigned questions and computed applicability. POST detail with `{revision,answers:{key:{value,confirmed}},submit?:true}` to save a draft or create a new immutable submitted original. Required current answers must be confirmed. Supporting files use the existing portal request-upload door; an inactive or other-contact request is refused. Staff review a submission through `POST /organizers/:id/review {submissionId,note}`. The owner alone may `POST /organizers/:id/erase {revision,confirm:organizerName,reason}`; payloads, source workflow values and still-derived carry are redacted while attribution, file custody and job sign-off remain, and the erasure journal fences old archives. No client token travels in an archive.

Client credentials (VAULT-001): `GET /clients/:id/credentials` lists names, portal addresses, authors, times, rotation dates and the reveal log to the principal, reviewers and a preparer holding a job on the client; `POST` the same path with `{label,url?,username,password,notes?,rotateBy?}` (plus `{id,revision}` to replace one in full). `POST /credentials/:id/reveal` returns the username, password and notes after a step-up in that session within 5 minutes: send `{code}`, `{recoveryCode}` or `{passkey}` (challenge from `POST /mfa/passkey/challenge`), or `{}` inside the window. Every reveal and refusal is logged. The owner sets `POST /credentials/archive-mode {mode:'encrypt'|'exclude'}` and erases with `POST /credentials/:id/erase {confirm:label,reason}`. A contact's link lists names with `GET /portal/:token/credentials` and adds or replaces with POST; nothing is read back. Agent keys have no vault door, and credentials never enter search, agent context, mail or CSV exports. The vault needs the installation's `VAULT_KEY` secret.

## LEARN-001 review learning

An external agent uses the principal's existing key; Blotter does not call a model or claim an inference it did not run. Read `POST /api/blotter/agent/learning/evidence` with `{jobIds:[...]}` (or `{templateId}` for the latest 30 jobs). The response includes live reviewer-return notes, portal questions, request-return/outstanding patterns and source record IDs. No file bytes, organizer answers or credentials enter this context.

`POST /api/blotter/agent/prepare-learning` takes `{jobIds,clientIds,title,expectedBenefit,exceptions,assumptions,improvement,supportingRefs}`. Use at least two completed periods of one template, with the same actual reviewer correction in two periods. `supportingRefs` contains `{kind:"review_return"|"portal_question"|"missing_request",id}`. `improvement` supplies the desired `steps` or structured `tasks`, `requests`, optional workflow `questions` and optional `organizer`; omitted organizer retains the original. Select clients observed in the source jobs. Examples remain source references; approved operational instructions should express the reusable work, without copying a client's private evidence.

The principal reads `GET /api/blotter/learning/:id` and posts `{decision:"approve"|"decline",reason,clientIds?}` to `/learning/:id/decide` through the existing native session and same-origin checks. Approval can select a subset of the prepared clients. Agent keys cannot decide. Native `POST /learning/evidence` and `/learning` provide the same inspection/preparation to the principal. Agent reads use `GET /agent/learning/:id`.

Approval creates an immutable numbered checklist/request/organizer snapshot, applied to new work for those clients through manual starts, roll-forward, bulk scheduling and recurrence. Source template identity, fees, currency and existing jobs remain intact. Source, template or client-version changes refuse a stale approval. Rejection has no operational effect.

Detail includes the exact next period's source-linked comparison against the selected client's baseline per-period mean: review returns, portal questions, document-return events plus currently outstanding active requests. Missing periods are pending; unfinished work is provisional. Negative deltas mean fewer exceptions, without claiming causation. Original assumptions, benefit and exceptions remain alongside the result. Learning references, versions and job-version attribution travel in archives; keys and portal tokens remain excluded. Referenced source erasure keeps the existing journal fence. Client mappings follow reviewed merge and undo.
