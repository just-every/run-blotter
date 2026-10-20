# Blotter API

## Native read pages (API-002 partial)

`GET /api/blotter/v1/work` and `GET /api/blotter/v1/time` use an existing
signed-in native staff session. Supply its cookie jar, kept privately, to curl:

```sh
curl -sS --cookie "$BLOTTER_COOKIE_JAR" --get \
  'https://YOUR-INSTALLATION/api/blotter/v1/work' \
  --data-urlencode 'limit=25' --data-urlencode 'dueFrom=2026-10-01'

curl -sS --cookie "$BLOTTER_COOKIE_JAR" --get \
  'https://YOUR-INSTALLATION/api/blotter/v1/time' \
  --data-urlencode 'from=2026-10-01' --data-urlencode 'to=2026-10-31' \
  --data-urlencode 'limit=25'
```

Both return `{items:[...],nextCursor:string|null}`. `limit` is an integer from
1 to 100, default 50. To continue, repeat the same endpoint and filters and add
`--data-urlencode "cursor=$BLOTTER_NEXT_CURSOR"`, using the returned
`nextCursor`; stop when it is `null`. Page size may change between requests.
Treat the cursor as opaque. It binds a version, route, normalized filters,
actor email/role and last sort tuple; malformed cursors and incompatible
routes, actors, roles or filters return 400, as do invalid limits and date
ranges. A cursor grants no authority:
every request resolves the current session and visibility again.

Work accepts the queue's `workType`, `stage`, `subStatus`, `client`, `assignee`,
`dueFrom`, `dueTo`, `overdue`, `blocked` and `priority` filters. `blocked` is
`yes` or `no`; `overdue=1` selects overdue work; due ranges are inclusive valid
`YYYY-MM-DD` dates. Items contain the native queue fields, including
`client_name`, stage and blocked state. Order is ascending `due_date`,
`client_name`, then `id`, so equal dates and clients paginate consistently.
Principal/reviewer visibility and preparers' assigned jobs or named tasks use
the existing native readable-job scope. Work currently loads and filters the
authorized queue in memory before returning its bounded page.

Time accepts optional inclusive `from` and `to` dates in valid `YYYY-MM-DD`
format and `person` as an email address. Principal/reviewer sessions see all
time; preparers see only their own entries. `person` narrows that scope and
cannot expand it. Items retain the native timesheet entry fields plus
`created_at`. Order is descending `date`, `created_at`, then `id`; SQL keyset
pagination traverses beyond the legacy timesheets screen's 500-entry limit.

These are live views, without snapshot semantics. New entries, edits, moving
sort keys, changing permissions or the UTC day used for overdue work can change
later pages. Restart pagination for a fresh traversal. This partial slice
provides native session reads; external integration keys/scopes, webhooks and
Zapier are not provided by these endpoints.

## Agent preparations

An agent works with a key that the principal or a reviewer creates in
**Team & safety → Agent keys**. The key is shown once; keep it in your agent's
secret store. The agent acts for the person who created the key and sees what
that person sees. It can read context and **prepare** work. It cannot approve,
change records or send anything: the standard preparations wait in **Preparations** until that person approves or declines them. Review-learning preparations use the authenticated HTTP review doors below. Each decision is recorded with its result.

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


## Principal-approved native automation (AUTOMATE-001)

In Preparations, the principal previews an explicit client scope, immutable rule and positive lifetime attempt budget, saves a draft and separately approves activation. `GET /api/blotter/automation` lists parsed definitions and retained outcomes. `POST /automation/preview` and `POST /automation` accept `{name,clientIds,budget,trigger,action}`; save also requires the exact preview `fingerprint`. Supplying `ruleId` saves a new version in that family; activation supersedes the old active version. These paths are relative to `/api/blotter`. Agent keys and non-principals cannot configure or execute rules.

Triggers: `{kind:"status",stage,subStatusId?}`, `tasks_complete`, `file`, `request_complete`, `organizer_complete`, `proposal` (decided job preparation), or `{kind:"due",at}` with an offset-bearing ISO instant. Due is inclusive; the app displays the firm zone. Scope includes future work for the explicitly selected active clients. Events are captured in the source transaction. Activation/reapproval starts after existing events; pauses do not accumulate a replay backlog.

Actions: `{kind:"status",stage,subStatusId?}`, `{kind:"reminder",templateId}`, `{kind:"assign",role,email}`, `{kind:"request",label}` or `{kind:"rollforward",dueDate,dueNote}`. Message versions are bound at preview and checked at execution. Status moves use native work-type and review gates; `in_review` submits through every task/document gate, and completion still requires independent review. No invoice/signature/connected-mail action is claimed before its carrier ships.

`POST /automation/:id/activate`, `/pause`, `/revoke` record principal decisions. Revocation needs a new version to resume. `POST /automation/run` and the hourly Cron Trigger share processing. Each claimed attempt reserves one lifetime budget unit even if its effect fails. Every effect rechecks the approving principal's live authority, exact version/status, client scope and budget. An event/version claim is unique. Failed/refused work has a next action and is never automatically replayed. External effects are marked dispatching before the provider call; loss of its response or interruption holds the attempt for reconciliation. `POST /automation/attempts/:id/reconcile` accepts `{outcome:"accepted"|"not_accepted",reason}` only for held attempts and never resends.

Archives include immutable rules and retained attempt history, exclude the derived event queue and all bearer credentials, restore rules paused with no live principal id, and hold unfinished attempts. Fresh explicit principal review precedes new events. Source references contain no copied file bytes/organizer answers; erased sources refuse pending effects and the existing erasure journal refuses stale restore. Native tests and the app acceptance journey name AUTOMATE-001 and BASE-001.

### REPORT-001 performance reports

Principal/reviewer: `GET /api/blotter/reports/performance?from=2026-01-01&to=2026-03-31` (optional `client`, `workType`, `assignee`). `/reports/performance/csv` and `/reports/performance/pdf` use the same filters, totals and permission checks. Read generation time and basis before interpreting the period-start cohort; each job includes calculation sources. These are current native approved export figures, not collection/settlement figures.

`GET /reports/views` lists saved filter views, schedules and queued run records. `POST /reports/views` takes those filters plus `name`. The principal uses `POST /reports/schedules` with `viewId`, active principal/reviewer `recipient`, firm-local `nextDate` and `everyDays` (1–366); `POST /reports/schedules/:id/pause` pauses. The hourly trigger queues one live link, respects notification hours, rechecks authority and never replays restored schedules. `/app?report=<view-id>` opens the saved report after native sign-in and live role checks.
