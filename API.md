# Blotter API

## Native read pages (API-002 partial)

`GET /api/blotter/v1/work`, `GET /api/blotter/v1/time` and
`GET /api/blotter/v1/clients` use an existing signed-in native staff session,
with the same current-member and MFA checks as the app. Agent keys do not
authenticate these endpoints. Supply the session's cookie jar, kept privately, to curl:

```sh
curl -sS --cookie "$BLOTTER_COOKIE_JAR" --get \
  'https://YOUR-INSTALLATION/api/blotter/v1/work' \
  --data-urlencode 'limit=25' --data-urlencode 'dueFrom=2026-10-01'

curl -sS --cookie "$BLOTTER_COOKIE_JAR" --get \
  'https://YOUR-INSTALLATION/api/blotter/v1/time' \
  --data-urlencode 'from=2026-10-01' --data-urlencode 'to=2026-10-31' \
  --data-urlencode 'limit=25'

curl -sS --cookie "$BLOTTER_COOKIE_JAR" --get \
  'https://YOUR-INSTALLATION/api/blotter/v1/clients' \
  --data-urlencode 'limit=25'
```

All return `{items:[...],nextCursor:string|null}`. `limit` is an integer from
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

Clients accepts an optional exact client id as `client`, intersected with the
session's existing workspace scope. Principals and reviewers see all unmerged
clients, including clients without jobs and archived clients. Preparers see
only clients with a currently readable job, including access through named
tasks. Items retain every native workspace client field and its existing
types (including JSON strings), with the same masked `ssn_last4` value.
Order is ascending `name`, then `id`, using SQL keyset pagination. Each page
rechecks job and task visibility; transferring access removes clients from
later pages even when a previously issued cursor is reused.

These are live views, without snapshot semantics. New entries, edits, moving
sort keys, changing permissions or the UTC day used for overdue work can change
later pages. Restart pagination for a fresh traversal. This partial slice
provides native session reads; external integration keys/scopes, webhooks and
Zapier are not provided by these endpoints.

## Native billing export history (API-002 partial)

`GET /api/blotter/v1/billing/exports` uses the native principal/reviewer
session and MFA checks. It returns native export metadata and snapshot strings,
plus explicit snapshot currency (historical currency-less snapshots retain
AUD), excluding CSV bytes. Download approved CSVs through the existing
`GET /api/blotter/exports/:id/csv` door. Preparers cannot read financial history.

The `{items,nextCursor}` envelope and limits follow the read pages above.
Optional `status` is `draft`, `approved` or `void`; `from` and `to` are inclusive
UTC preparation days (`YYYY-MM-DD`). SQL keysets order by `prepared_at DESC`,
then `id DESC`. Cursors bind route, filters and staff email/role; each request
resolves current membership and financial authority. Pages are live views and
create no data or grants. Restored pages retain the original billing snapshots.

## Native replay-safe client creation (API-002 partial)

`POST /api/blotter/v1/clients` uses the same native principal/reviewer session,
MFA, same-origin request check, client/contact validation and required custom
fields as the app. Supply a private cookie jar, the installation's Origin,
JSON body and an `Idempotency-Key` header (1–128 ASCII letters, digits, dots,
underscores, colons or hyphens). Agent bearer keys do not authenticate it.

```sh
curl -sS --cookie "$BLOTTER_COOKIE_JAR" \
  'https://YOUR-INSTALLATION/api/blotter/v1/clients' \
  -H 'Origin: https://YOUR-INSTALLATION' -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: create-cedar-2026' \
  --data '{"name":"Cedar River Tax LLC","ein":"92-7654321","services":["1120-S"]}'
```

The response is the native client detail plus `clientId` and `replayed`.
Keep the same key for the same intent: repeated or concurrent requests create
one client, contacts and creation audit. JSON object property order does not
matter; array order and exact scalar values do. A conflicting payload returns
409; validation failure does not consume the key. Keys are scoped to the
current actor email. A replay rechecks current membership, role and MFA and
returns current client data rather than an old cached response; if the client
has merged away, native not-found behavior refuses it without creating another.
Receipts retain only key/request digests, actor, client reference and time and
survive archive restore. They contain no raw request or credential. Whole-client
receipt retention/erasure is inherited by ERASURE-002. This door adds no
integration credential, task action, webhook or general rate-limit contract.

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


## RESOLVE-001 native 433-A collection

A principal or reviewer publishes a tax organizer with `collectionForm: "433-A"` in its versioned definition, under Settings. Start the authorized native job with that template, then inspect `GET /jobs/:id/resolution-case`. Before collection, the principal or reviewer confirms the frozen question set using `POST /jobs/:id/resolution-case {organizerId,revision,version,reviewed:true}`. The job and organizer must match, remain open and unerased, and belong to a current active client. Concurrent or repeated creation cannot produce a second case or audit event. A preparer may inspect an assigned case and collect its information but cannot approve the question set. Client scopes, session MFA and live native staff authority still apply.

The case records its exact organizer id, job id, definition version and review actor and time. Later template publication leaves it unchanged. The same read returns submitted current confirmations, completeness, supporting original file references, and the organizer's attributed submission and review history. Drafts and unconfirmed carry never become case facts or choose workflow branches. Contact collection uses the existing PORTAL-004 doors and explicit per-question responsibility; a designated 433-A organizer cannot be opened or invited before case review. No new client bearer or agency authority is introduced.

Transcript context is unavailable. This is firm-authored financial information collection, not a prepared IRS form, transcript analysis, recommendation or agency action. The practitioner remains responsible for resolution decisions. Form 433-F and the full transcript journey are not implemented.

Case records contain structural links and practitioner attribution only. Archives preserve those links and the existing organizer and file custody; portal tokens remain excluded. Holds refuse answer erasure. Submitted 433-A originals consumed by signed-off work use that work's retention and expiry instead of direct organizer erasure. Whole-client erasure preserves consumed originals while clearing draft facts and revoking links; the ordinary case read hides erased-client content. The existing current-journal restore fence refuses stale archives. No provider deletion is claimed.

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

BILL-003 current financial groups: the same performance response includes `financialBreakdowns.clients` and `.services`. Each group has `id`, `name`, `currency`, `jobIds` and the seven existing job financial totals. Follow `jobIds` into `jobs[].financial.sources` for the source rows. Groups use the same inclusive period-start cohort and filters, and never combine currencies. Draft exports reserve WIP without increasing approved-export totals; voids release WIP. Margin excludes staff cost. Retainers, receivables, credits, write-offs and invoice/payment realization remain unimplemented.

## Native engagement readiness (READY-001, partial)

These authenticated HTTP doors use existing job visibility; they do not change a
client grant. No new screen or native model execution is claimed.

| Method | Door | Behavior |
| --- | --- | --- |
| GET | `/api/blotter/jobs/:id/readiness` | Live document custody, checklist/answer map, latest accessible prior period, source links, drafted questions and tracked decisions/responses. |
| POST | `/api/blotter/jobs/:id/readiness/questions` | Prepare `{ "sourceKind": "request", "sourceId": "<request id>" }` or `sourceKind: "answer"` with the workflow answer key. Returns the same preparation for the same source fingerprint; sends nothing. |
| POST | `/api/blotter/jobs/:id/readiness/questions/:question/decide` | A person supplies `decision` (`approve`, `decline`, `resolve`) and a nonempty `reason`. Approval adds one exact link-only portal to-do, without email. Source changes refuse stale approval. Only the assigned reviewer or principal resolves an approved question. |
| GET | `/api/blotter/agent/jobs/:id/readiness` | Existing agent-key equivalent of the read door. |
| POST | `/api/blotter/agent/jobs/:id/readiness/questions` | Existing agent-key preparation; no decision door. |

`documents[].state` is `missing` without unerased files, `collected` with files,
and `validated` only when staff accepted that request. Recorded answer differences
are shown with the current/prior source jobs; no semantic contradiction is inferred.
A client response moves a question to `evidence_received_judgment_required`, never
to resolved. Approved unresolved questions prevent job sign-off. Declining a draft
does not remove a missing-document or answer judgment. Restores retain these gates
and do not replay questions or sends. Evidence maps re-read erased-file state.
Question records store source references and fingerprints, not document bytes or
copied workflow answer values. Whole-client retention/erasure remains ERASURE-002.
Signed-scope joining (ENGAGE-001), connected books (LEDGER-001), semantic conflict
detection and ledger variance analysis remain unimplemented; READY-001 stays partial.

## Bulk client messages and marketing consent (MSG-002, partial)

Person-session doors; the principal and reviewers preview and schedule, and the principal approves marketing. A batch's class (engagement or marketing), template version, segment, recipients and exclusions are fixed at preview (ct 20 Oct 21:21Z). Product policy, not legal certification.

- `POST /api/blotter/bulk-messages/preview`: `{idempotencyKey,class,templateId,workTypeId?,tag?,entityType?,reason (engagement),role? (engagement: primary|billing|tax|bookkeeping),topic (marketing: tax|other),chunkSize?}`. Returns the batch with its fingerprint, recipients with their basis, every exclusion with its reason, three sample renderings and, for "other services" marketing, the section 7216 notice. A repeated `idempotencyKey` returns the existing batch (`resubmitted: true`).
- Engagement preview additionally accepts `attachOrganizer: true` with a `{{portal_link}}` template. Each basis job must have an unerased open organizer whose questions are already assigned to the selected contact (assign through PORTAL-004 first). Recipients include `organizer_id` and `organizer_revision`; preview excludes unavailable organizers and unassigned contacts. Dispatch holds any changed revision or revoked authority. The same one email supplies the contact-scoped organizer link and recorded invitation/provider outcome. It never reassigns questions or sends a separate invitation; marketing attachments are refused.
- `GET /api/blotter/bulk-messages` and `GET /api/blotter/bulk-messages/:id`: batches, per-recipient status (pending, held, accepted, delivered, bounced, complained, failed, uncertain), stored rendered text and exclusions. Detail also lists the template version's `attachments`; every message made from the template is mailed with those files, and each sent recipient records their name, type, size and SHA-256.
- `POST /api/blotter/jobs/:id/portal/messages/preview` `{templateId,contactId?,values?,subject?,body?}` renders a message template for a contact of the job (default the primary contact) without sending it, returning `subject`, `body`, `missing` and the version's `attachments`. `POST /api/blotter/jobs/:id/portal/messages` with the same `templateId` fields is refused (409) naming any unresolved field, then shows the message and its files on the client's link; `{body,replyTo?}` without a template is unchanged. The client downloads a message file with `GET /api/blotter/portal/:token/messages/:message/files/:ordinal`, which needs that job's own link and checks the recorded SHA-256.
- `POST /api/blotter/bulk-messages/:id/approve`: `{fingerprint}`; principal only, marketing only.
- `POST /api/blotter/bulk-messages/:id/schedule`: `{fingerprint,sendAt?}`; resubmitting a scheduled or sent batch changes nothing.
- `POST /api/blotter/bulk-messages/:id/run`: send the next throttled chunk now; the hourly Cron Trigger sends one chunk of each due batch.
- `GET /api/blotter/bulk-messages/review` and `POST /api/blotter/bulk-messages/recipients/:id/misclassified` `{reason}`: the principal's review of engagement notices sent to addresses without a current marketing opt-in.
- `GET /api/blotter/marketing-consents?clientId=`: the append-only consent log and each contact's current eligibility; `POST /api/blotter/marketing-consents` `{contactId,kind: grant|withdraw,actedAt,wording,wordingVersion,language?,evidence,source?: staff_reply}`; `POST /api/blotter/marketing-consents/:id/correct` `{reason}` (principal); `POST /api/blotter/marketing-consents/confirm` `{note}` (principal, after a restore).
- `POST /api/blotter/mail/events`: Resend delivery, bounce and complaint webhooks, verified with `MAIL_WEBHOOK_SECRET` (Svix signature) and applied once per event id. Other event types and other mail are acknowledged untracked.
- `GET`/`POST /unsubscribe?t=…`: the public one-page unsubscribe (link token or typed address) and the RFC 8058 one-click POST.


Mapped marketing imports recheck erased-withdrawal digests inside every apply/resume
chunk, including a plan reviewed before the erasure. A grant captured at or before
the latest erasure refuses the whole chunk with 409; no client, contact, consent,
audit or checkpoint from that chunk commits. Review a source with a genuinely
later explicit opt-in before committing it. Repeated erasures advance the same
hashed-address cutoff; the address itself is not retained in the suppression.

### Reviewed recurring-series carry-over (MIGRATE-006, partial)

The principal can use these authenticated person-session doors. They share the
existing client-import authority; agent keys cannot commit or read this report.
This accepts a reviewed native mapping, not a raw incumbent export or a claim
that extraction/reconciliation has occurred.

- `POST /api/blotter/recurrence-imports/preview`: no writes. Supply `source`
  (`karbon`, `taxdome`, `canopy`, `financial-cents`, `double`), `practiceId`,
  `seriesId`, a checked `sourceNote`, active `ownerEmail`, `mapping`, and `items`.
  The mapping uses WORK-002's `clientId`, `templateId`, `firstPeriod`, optional
  `endPeriod` and `months`, `leadMonths`, `dueDays`, `dueNote`, `preparerEmail`,
  `reviewerEmail`, optional `managerEmail` and integer `budgetMinutes`, plus the
  source's `frequency`. It must exactly equal the mapped template cadence.
  Items are up to twelve `{sourceItemId, jobId}` mappings to existing jobs.
  Body limit: 80,000 characters. The result shows ready/held, reasons, native
  rule/period details, and an exact `previewToken`.
- `POST /api/blotter/recurrence-imports/commit`: resubmit that body with its
  `previewToken`. An unsupported mapping records an owned hold. A valid mapping
  atomically creates a paused rule and every source-linked existing-job claim.
  Native job edits, dates, roles and status remain intact. Correct a held mapping
  by previewing/committing its source identity again. Exact mapped replays return
  the same binding/rule; changed mapped replays refuse without overwriting work.
- `GET /api/blotter/recurrence-imports`: retained source mappings, owned holds and
  item-to-native-job provenance. No source credential, file bytes or new client
  grant is accepted. A second series using the same client/template is held;
  native rules currently allow one rule per pair.

Review activation using `GET /api/blotter/rules/:id/activation`, then POST
`{status:"active",previewToken:token}` to `/api/blotter/rules/:id/status`.
The same review is required after restoration; historical jobs/claims are never
replayed. Paused native imported rules appear under Clients & templates →
Recurring work → Review schedule before activation.

This slice does not extract source recurrence, create missing imported jobs,
carry previous-item answers or reconcile a complete authorized practice export.
MIGRATE-001–005 and MIGRATE-006 retain those full source-specific destinations.

## Retention and whole-client erasure (ERASURE-002)

Owner, person session only. `GET /clients/:id/retention` lists marks and recorded external copies; `POST /clients/:id/retention` with `{scope:'client'|'job'|'file',targetId,kind:'hold'|'retain',until,reason}` places a mark and `POST /retention/:id/release` with `{reason}` releases it. `POST /clients/:id/external-copies` records `{kind:'document'|'provider'|'buyer',system,holder,note}`; `POST /external-copies/:id/close` with `{note}` records the principal's confirmation that the holder deleted it. `GET /clients/:id/erasure/preview` (archived clients only) returns blockers, per-table counts, named retained exceptions with owners, active marks, external copies and a `planHash`. `POST /clients/:id/erasure` with `{planHash,confirm:<client name>,reason}` erases exactly that plan (409 when it changed) and returns the receipt; `GET /erasures/:id` rereads it and `GET /erasure-journal` exports every receipt with the portability epoch and tombstones. Receipts hold counts and named exceptions, never values. Restore an older archive only with `journal` set to a newer archive.

### Native USD invoicing (BILL-002)

The principal explicitly selects `POST /invoices/authority` (`authority: blotter`, reason).
QBO/Xero authority refuses until INTEGRATE-001 is available. Authorize fixed/milestone/proration
sources at `/invoice-entitlements`, record supplied deposit/credit references at `/invoice-credits`,
and inspect `/invoices`. `/invoices/preview` returns the exact recipient, USD lines, supplied tax,
terms, credits and `previewHash`; `POST /invoices` reserves that preview. Issue the current draft
at `/invoices/:id/issue` with its revision, snapshotHash and reviewNote, then separately preview
and approve delivery at `/invoices/:id/delivery-preview` and `/send`. The PDF is immutable.
No charge, tax calculation or provider settlement is inferred. An unresolved delivery needs
provider evidence at `/invoice-deliveries/:id/reconcile` before another send. Recipient-specific
invoice links recheck the billing contact and its permission on every view and download.

Monthly rules at `/invoice-retainers` create drafts only, once per rule and month. Generate with
`/:id/generate`, preview/approve future fee amendments with `/:id/amendment-preview` and `/amend`,
and pause or explicitly review activation at `/:id/status`. Issued amounts and prior entitlements
retain their sources. Later credit allocations use `/invoices/:id/credits`. Whole-client erasure
and billing expiry refuse named open invoices and unapplied deposit/credit liabilities.

After whole-client erasure, retained invoices disappear from ordinary billing lists. Explicit invoice detail/PDF doors require the principal and attribute retained-record reads; expiry lists use opaque labels.

The existing `GET /api/blotter/reports/performance` response includes `invoiceReporting` for the same selected job-period cohort: native invoices and their source links, monthly retainers, supplied credits and current USD receivables. The existing CSV/PDF exports include the same financial values and source URLs. Supplied credits are recorded evidence, not verified provider settlement; exports record each included client and its named downloader for ERASURE-002 receipts.

### Native document signatures (SIGN-002)

Staff prepare a frozen PDF and fields at `POST /jobs/:id/signatures`: title, formKind,
mode (`sequential` or `parallel`), ordered authorized contactIds, file and fields.
Each field supplies contactId, type (`signature`, `initials`, `date`, `text`), page,
x/y from the top left in PDF points, width/height and label. Every signer needs a signature
field. Read `/signatures/:id`, then explicitly `/send` with its revision. Declined/restored
requests resend as a fresh attempt; `/void` needs revision and reason and prevents signing.
IRS e-file authorizations and KBA-required forms refuse this general-signing door.

Each invitation uses the existing contact-bound portal. `/portal/:token/signatures/:id`
returns that signer's fields and consent version. `/sign` needs the current revision/attempt,
explicit consent/intent, consentVersion and values keyed by field id; `/decline` needs a
reason and revision. A non-signer cannot read it, and sequential signers cannot sign early.
Completed signed PDFs and certificates are under `/signatures/:id/files/signed` and
`/files/certificate`, with the same contact-scoped download routes. The certificate states
that portal possession does not verify identity, and records typed signatures, consent,
link id, times, order and hashes; connection IP and browser details are not collected.
Pending requests transfer in the ordinary offboarding batch. Completed attribution stays.
Signed documents join retention clocks, holds, erasure preview/receipt and restore fencing;
restored pending requests remain held until explicitly resent. Signature-complete automation
uses the same scoped, budgeted, live-authority and once-only effect transaction.


### Service costs and supervised native plans

The principal uses `GET /api/blotter/costs` for current quotes, immutable quote versions, usage and owned exceptions; `POST /costs/prices` records `{service,included,unitCents,basisPoints,source}`. Quantities and USD cents are whole numbers; basis points are 0–10000. `POST /costs/estimate` takes `{items:[{service,quantity,amountCents}]}`. Missing prices leave the total unavailable. `POST /costs/budget` records `{limitCents,thresholdCents,reason}`. These paths all have the `/api/blotter` prefix.

Only `agent_plan` can currently be enabled, with `POST /costs/services/agent_plan` and `{revision,enabled,reason}` after price review. Other service estimates never enable an unbuilt provider. `POST /costs/usage/:actionId/reconcile` takes `{cents,receipt}` and records verified/native cost evidence without repeating an effect. `GET /costs/export` exports the complete current JSON costs and usage through the native fresh-confirmation gate, with an attributed download audit. The Preparations screen uses this same door. Quotes are firm estimates, not provider tariff verification. Included units apply per price revision; reservations remain counted after reconciliation.

`GET /agent-rules` returns grants and retained runs/decisions. `POST /agent-rules` takes `{name,keyId,clientId,trigger,tool,budget}`. Triggers are `file`, `tasks_complete`, `question` and `schedule`; tools are `reminder` and `rollforward` preparations only. A schedule also needs `{startsAt,everyHours}` with an explicit timezone; roll-forward needs `{dueDate,dueNote}`. The principal is the named supervisor. `POST /agent-rules/run` evaluates current native events; the same bounded processor runs on Cron. `POST /agent-rules/:id/revoke` immediately refuses further plans and pending effects. New grants do not replay older file/task/question events. Duplicate schedule/event evaluations never duplicate plans or reservations.

This is a deterministic native planner; no model/provider is called. Its grant covers only job metadata and outstanding request labels for that client. A key bound to a native rule may read only those active client scopes and cannot bypass rule/service budgets through legacy preparation or learning commands. It receives no financial context or file bytes. Existing person-only proposal decisions perform the effect under the current client, source and key/rule authority. Archives exclude keys and restore grants paused and service prices disabled. Retained history cannot authorize replay; after restoring, create a fresh key and explicitly review a new grant. Full AI/provider capabilities remain partial under CONTRACT.md.

External agent plans: a principal may choose `mode: external` when approving an agent rule, supplying `providerName`, `modelName`, `dataUse` and `providerRetention` (owner declarations, never credentials; not provider verification). `GET /api/blotter/agent/plans` with that key lists only its budgeted queued job metadata and outstanding labels. `POST /api/blotter/agent/plans/:id` accepts the granted reminder `message` or roll-forward `dueDate`/`dueNote`. The first preparation is immutable; an identical replay returns the same proposal and incurs no additional usage. Changing job/tool is refused. Every read/fill and later human effect rechecks source, key, client, supervisor and grant. Blotter sends no content to any model provider. Document bytes, portal/internal discussions, vault and financial context stay excluded.


### Native onboarding scope review (ONBOARD-001, partial)

The principal uses POST `/api/blotter/clients/:id/onboarding/preview` with
`source: {kind: "signature" | "engagement", id}` and a `services` array. Each
service names `kind` (tax or bookkeeping), an exact readable signed-text `quote`
and `templateId`; tax mappings choose `authorization` (2848 or 8821), and
bookkeeping mappings choose `ledger` (qbo or xero). Completed SIGN-002 documents
and practitioner-recorded letters keep distinct labels. Sources must belong to
the active client, retain their bytes and pass their recorded digest check.
Unreadable text and unsupported mappings are refused; no scope is guessed.

The response contains a fingerprint, template cadence, and source-linked proposed
setup items. It does not establish that the mapping covers the entire engagement.
POST `/api/blotter/clients/:id/onboarding/plans` repeats that mapping with the
current `fingerprint`, distinct `selectedItemIds` and a `reason`. Only displayed
items can be selected. The first review is retained once per signed source; an
identical replay returns its id, and a different selection is refused. Source,
client, contact and template state are rechecked inside the write. This review
does not authorize any invitation, request, account connection or billing action.

GET `/api/blotter/clients/:id/onboarding/plans/:plan` reads the review. POST
`/api/blotter/clients/:id/onboarding/plans/:plan/progress` requires its current
`revision`, selected `itemId`, `state` (pending, received or blocked), `note`,
`nextAction` including its due condition, and the principal's own `ownerEmail`.
These are practitioner-recorded observations, never independently verified client
responses or provider connections. Missing items include an unsent chase draft.
Removed items cannot acquire progress. All doors require the principal's person
session; agent keys have no onboarding authority. Reviews are held on restore,
refuse erased sources, and join the derived-data erasure class and its holds.
There is no execution or reactivation door. Delegated partner review, native
engagement generation, agent grants, sending, response ingestion and automatic
escalation remain explicit contract gaps.


## Stripe invoice payments

See `STRIPE.md` for private binding setup, authorization boundaries and remaining activation gaps. Staff doors require a native person session and current invoice access. Writes require the principal or financial authority; quick collection, refund and revocation require fresh confirmation.

- `GET /api/blotter/invoices/:id/payments`: observed payments, remaining saved-method authority and unreserved balance.
- `POST /api/blotter/invoices/:id/payment-link`: `{amountCents}` creates hosted card or bank Checkout.
- `POST /api/blotter/invoices/:id/quick-collect`: `{mandateId,requestId,amountCents?}`; repeat the same request identifier to reconcile its existing attempt.
- `POST /api/blotter/payments/:id/reconcile`: fetch current provider state.
- `POST /api/blotter/payments/:id/refund`: `{amountCents,reason,requestId}`.
- `POST /api/blotter/payment-mandates/:id/revoke`: `{reason}` ends authority before detaching the provider method.
- `POST /api/blotter/invoice-portal/:token/pay`: `{amountCents,confirm,saveMethod,authorizeSaved,requestId}`; payment and saved-method consent are separate and unticked.
- `POST /api/blotter/invoice-portal/:token/mandates/:id/revoke`: `{reason}`, with current billing-link authority and same-origin enforcement.
- `POST /api/blotter/stripe/events`: raw signed Stripe notification; no staff session, no unsigned mutation, duplicate event identifiers retained.

## Reviewed integration credentials (API-002)

Integration bearers are non-person credentials. They authenticate only the versioned doors below; they never authenticate a staff session, an agent door, a review decision or a financial execution. The principal enrolls a second factor and confirms sensitive access in the native session before minting a key. POST `https://blotter.example.test/api/blotter/integration-keys` accepts `label`, a recorded `reason`, 1–100 explicit `clientIds` and explicit `actions`. Its response shows the random bearer once. Only its digest is stored. GET on that door lists metadata and client grants; POST to its key id followed by `/revoke` records the reason and immediately ends authority.

| Action | Versioned door | Boundary |
| --- | --- | --- |
| `clients:read` | GET `https://blotter.example.test/api/blotter/v1/clients` | Existing native fields and pages, intersected with the key's clients. |
| `clients:create` | POST `https://blotter.example.test/api/blotter/v1/clients` | Native validation of `name`, `ein`, `entityType`, `services`, `fields` and `tags` only. No contacts, consent flags, invitations, relationships or team grants. The newly created entity joins this key's scope atomically; no existing entity is added. Returns `clientId` and `replayed`. |
| `work:read` | GET `https://blotter.example.test/api/blotter/v1/work` | Native filtered pages intersected with the key's clients. |
| `time:read` | GET `https://blotter.example.test/api/blotter/v1/time` | Native date and person filters intersected with the key's clients. |
| `tasks:create` | POST `https://blotter.example.test/api/blotter/v1/tasks` | `jobId` and `label` only; adds an uncompleted task to an active client's open job. Does not assign another person, complete work or approve anything. Returns `jobId`, `ordinal` and `replayed`. |
| `documents:metadata` | GET `https://blotter.example.test/api/blotter/v1/documents` | Identifiers, names, kind, media type, size and checksum only; no original bytes or annotations. |
| `billing:metadata` | GET `https://blotter.example.test/api/blotter/v1/billing/invoices` | Invoice identifiers, status, number, currency, integer totals, dates and PDF checksum only. No snapshot, PDF bytes, recipient narrative, payment credential or financial execution. |
| `webhooks:completion` | Principal registers a completion webhook as described below. | Thin events for this key's clients only. |

Send the shown bearer in the Authorization header. Every request checks that its creator is still the same active principal with a confirmed second factor. Observed creator identity, authority, factor or complete client-scope loss suspends the key and needs a newly reviewed credential; restoring authority never silently reactivates a suspended key. Native writes recheck key action, creator authority and the target client in their effect transaction. Reads recheck authority and the unchanged client grant set before returning data, and record attributed possible outside copies.

All admitted key requests share a durable rolling limit of 60 requests in 60 seconds per key, including malformed requests to an allowed action. Excess requests return HTTP 429 with `retryAfter:60`; another key has its own allowance. Unauthorized actions do not gain access or consume an allowed action. Existing staff-session doors retain their behavior.

Both creation doors require the existing `Idempotency-Key` header syntax and canonical JSON semantics. Each integration key has its own replay space. A repeat with the same intent returns the original reference; changed intent returns HTTP 409. Validation failure consumes no receipt. Concurrent repeats commit one effect and attributed audit. Task replay also requires the job still to be open and in the current client scope. Client replay is refused after its reference is merged or erased. This is record creation, not automatic human approval.

Metadata pages use `items` and `nextCursor`, a default limit of 50, maximum 100, and optional exact `client` and `job` filters. They sort by identifier in SQLite BINARY order. Their cursor binds the integration key, route and filters. All pages remain live views. New broad work mutations, time recording and document-byte integration doors remain unbuilt; callers must not infer support from the native app's unversioned doors.

## Thin completion webhooks

The principal uses POST `https://blotter.example.test/api/blotter/integration-webhooks` with `keyId`, `label`, `url` and a recorded `reason`. The key must grant `webhooks:completion`. Registration is an explicit standing approval of thin completion notices. The destination must use HTTPS on port 443 with a public DNS hostname and no embedded credentials or fragment. Redirects are never followed. The installation's dedicated vault key seals both the destination and a fresh signing secret. The signing secret is shown once; neither it nor the destination appears in history or archives.

A registered endpoint receives only completion history committed after its registration transaction. The hourly worker and the principal's POST to `https://blotter.example.test/api/blotter/integration-webhook-run` evaluate the same durable deliveries. There is no historical backfill. Payload fields are exactly `version`, `id`, `type` (`work.completed`), `clientId`, `workId` and `occurredAt`: no client name, note, document, answer, contact field or billing narrative. Field mapping in an external workflow uses these documented references; no Zapier activation is claimed.

`Blotter-Event-Id` is the stable completion event id. `Blotter-Signature` has `t=<Unix seconds>,v1=<hex HMAC-SHA-256>`. The signed bytes are the timestamp, one period and the exact UTF-8 request body, keyed by the shown signing secret. Receivers verify the signature and timestamp freshness and deduplicate the event id; an explicit replay keeps that id.

GET `https://blotter.example.test/api/blotter/integration-webhooks` shows registration metadata and the latest 200 delivery rows with attempts, outcomes and next actions. An attempt is durably marked dispatching before the network call and live key and client authority is checked again immediately before dispatch. HTTP success records receiver acceptance. A non-success response, timeout or lost response is held for principal reconciliation; no receiver body or raw network error is stored. Interrupted dispatching attempts are never automatically repeated.

For a delivery id, the principal can POST a confirmed `accepted` or `not_accepted` outcome and evidence `reason` to `https://blotter.example.test/api/blotter/integration-deliveries/<id>/reconcile`. Only confirmed nonacceptance allows POST with a reason to the same delivery id followed by `/replay`. It still needs live authority when evaluated. A confirmed accepted delivery cannot replay. Revoking the endpoint or key ends further dispatch. Revocation never claims to undo a request already accepted by a receiver.

Archives retain inactive key and endpoint metadata, grants, digest-only replay receipts and delivery history; bearer digests, endpoint destinations, signing secrets and transient rate rows cannot authorize anything after restore. Unfinished delivery history restores held. A fresh endpoint and new reviewed key are required, without replaying historical completions. Whole-client erasure removes key grants and client replay receipts, suspends a key whose final client was erased, cancels unfinished deliveries as `record_erased`, records the counts and names possible external copies. A stale archive remains refused by the existing erasure journal.

Native evidence: `tests/blotter/integration-keys.test.mjs` covers the lifecycle, event writes, rolling limit, erasure and metadata boundaries; `tests/blotter/integration-webhooks.test.mjs` covers signed completion notices and recovery through the built Worker with only the receiver network edge replaced. The full clause remains partial: an authorized Zapier workspace and its complete mapped live integration journey have not been supplied.

## Principal revenue review

`GET /api/blotter/revenue` lists active clients and signed-scope reviews. Supply `clientId` and `planId` to read the current evidence map. It compares an explicitly selected reviewed scope with native work, invoices, credits, retainers and confirmed payment observations. Only the principal's native session can use these doors.

`POST /api/blotter/revenue/proposals` takes `clientId`, `planId`, `fingerprint` and `exceptionId` from that map. It prepares the cited amendment or duplicate correction once for those exact sources. `POST /api/blotter/revenue/proposals/:id/decide` takes `decision` (`approve` or `decline`) and a required `reason`. Changed evidence refuses approval. Duplicate approval voids only the identified draft; amendment approval records a reviewed draft and does not change accepted terms or authorize billing. Restored pending drafts remain held. Use the existing explicit invoice and payment doors for any subsequent financial action.

Retainer comparisons use the rule's first month, recorded work months and accepted amendment effective months, never a guessed current billing period. Each period compares its accepted gross fee with non-void generated invoices. Future planned discrepancies are review findings; no billing action is automatic. A completed scheduled draft removes its period's finding. Accepted price and cancellation amendments control only their effective periods.

`POST /api/blotter/revenue/accounting` records an explicit principal observation of a firm-accounting event against an issued native `invoiceId`. Supply `currency` (`USD`), `source`, immutable event `reference`, `reason`, and integer `grossCents`, `receiptCents` (net of returns and refunds), `creditCents` (applied), and `writeoffCents`. These are practitioner-recorded observations, never authenticated ledger-provider receipts or a second invoice authority. Exact reference replay returns the original observation; changed evidence under that reference is refused. Record a new event reference for later evidence.

`GET /api/blotter/revenue/accounting?clientId=...` and the revenue map compare the latest recorded observation per source and native invoice with that invoice's gross, confirmed provider net, applied credits and approved write-offs. Mismatches retain the invoice owner and due condition. Both accounting doors require the principal's native session and the selected Blotter invoice authority; no ledger post, invoice change, mail, charge or write-off is performed. Observations travel as billing history in archives, confer no restored execution authority, honor billing and work holds, and retain amounts and attribution with their invoice. Client erasure or confirmed invoice expiry removes source references and reason text through the existing retention engine.

## Native staff time creation (API-002 partial)

`POST /api/blotter/v1/time` uses the existing writable native staff session,
its current membership, client scope, job authority and per-session MFA. It
accepts `jobId`, `date` (YYYY-MM-DD), `minutes` (1–1440), `description`
(1–500 characters), optional boolean `billable` (default true), and optional
`taskOrdinal` identifying a task on that job. Named-task read access alone
does not grant the native job permission to record time. No other fields
are accepted. The caller records their own unsubmitted entry; the server
resolves and snapshots the native rate, amount and job currency. Missing
rates, currency mismatches and closed billing periods refuse creation.

An `Idempotency-Key` is required: 1–128 ASCII letters, digits, dots,
underscores, colons or hyphens. Keys are scoped to the staff email and are
independent of client-creation keys. Object field order is immaterial;
array order and scalar values are exact intent. Successful creation commits
the entry, one attributed `time.added` event and a digest-only receipt in
one atomic batch, with current session, MFA, access, job, task, rate and
period checks. Concurrent identical requests return one entry. Changed
intent returns 409, while validation failures consume no receipt.

The response has `entryId`, `id`, `replayed`, `date`, `minutes`,
`description`, `rateCents`, `rateSource`, `rateCardId`, `currency`,
`amountCents`, `billable` and `taskOrdinal`. Read the entry through the
existing paginated `GET /api/blotter/v1/time`. An identical replay returns
its referenced entry under current staff and job authority; it does not
submit time, recalculate rates, create another audit or unlock a period.
Deleted entries return 404 and their consumed keys cannot recreate them.
An erased or merged-away client refuses replay and new creation alike.

Receipts retain only staff email, key and request digests, opaque entry and
client references, and creation time. They travel with native archives;
sessions do not. Whole-client erasure removes these receipts under the
existing erasure policy, and the erasure journal fences older restores.
Integration bearers and agent keys gain no time-write action. This door
creates no person API token or session type. API-002 stays PARTIAL: the
live mapped Zapier workflow requires an authorized workspace; broader work
mutations, non-person integration time recording, document-byte integration
doors and remaining integration activation evidence are held. Billing
integration remains metadata-only with no financial execution. Future
person-created API credentials still owe ACCESS-004 before activation.
## Recorded access-log CSV (SECURE-001 partial)

`GET /api/blotter/security/access-log.csv?from=2026-03-08&to=2026-03-08`
requires a current principal staff session and a second factor confirmed through
`POST /api/blotter/access/step-up` within five minutes in that same session.
Preparer, reviewer, delegated, deactivated, agent and integration identities have
no export authority. A sign-in still owing MFA cannot reach this door.

Both required dates are valid `YYYY-MM-DD` UTC calendar dates, inclusive. The
example selects instants from `2026-03-08T00:00:00.000Z` through, but excluding,
`2026-03-09T00:00:00.000Z`, irrespective of the firm zone or daylight saving.
Reversed or invalid dates return 400. The last date must precede 9999-12-31.
Rows are ordered by instant, then event ID; an empty range returns headings.

Coverage is the retained `file.downloaded` audit events, generated by successful
staff, contact-portal and document-bearer downloads. It excludes sign-ins,
other reads, refused downloads and activity before recording began. It is not
a complete access history or evidence of certification. The response header
`X-Access-Log-Coverage` discloses this limitation, also repeated on each CSV row.
Bearer rows preserve the original actor and say identity is not verified;
a contact or share grant never becomes proof of who used the bearer.
Unknown or erased channel metadata is labelled `not recorded`.

Columns contain event ID, UTC instant, original actor, action, opaque resource
ID, recorded channel, identity qualification, exact range boundaries and
coverage. No document names, bytes, hashes, contact identifiers, arbitrary audit
details, sealed values, links or tokens are exported. CSV fields are quoted,
embedded quotes escaped, and spreadsheet formula prefixes neutralized. The
response is private, uncached and a download. Source events are unchanged;
`security.access_log_exported` records the principal, time, exact boundaries and
row count and the exact exported event IDs atomically with the read. The erasure
preview attributes a downloaded CSV to a client only when that snapshot contains
a download of the client's document. Later events within the same date range
never change an earlier CSV's membership. The CSV is generated from current portable
audit history, with no new retained copy or credential. Native archives retain
that history and export attribution, exclude step-ups and bearer tokens, and
retain the existing newer-erasure-journal fence on stale restore. Downloaded
logs are external copies the principal must safeguard and erase independently.
The remainder of SECURE-001, including attestation and WISP materials, is unbuilt.
### Recoverable client portal uploads

The existing portal link can start and list uploads at
`/api/blotter/portal/:token/requests/:request/packet-uploads`. POST supplies
`name`, `mime`, `size`, `sha256` and a recorded `pageCount`. The selected original
is limited to 20 MiB, 2,000 pages and 256 KiB chunks. Upload status is GET
`/api/blotter/portal/:token/packet-uploads/:upload`; POST its `chunks`, `complete`
or `cancel` child. Chunks supply `offset`, `chunkId`, `sha256` and `contentBase64`.
Only confirmed bytes count. Exact chunk and completion replays retain one original.

Progress is bound to the issuing link, contact revision, job and visible request.
Each effect rechecks current link validity, contact authority, request visibility
and open work inside its transaction. Replaced links cannot recover old staging.
The browser keeps original bytes only in memory, requires an explicit retry and
checks the reselected original digest before resuming. There is no automatic
background sync, camera capture or native-device qualification. Link possession
remains bearer authority and does not verify personal identity.

Staging expires after seven days, is cancellable while work accepts uploads and
is excluded from archives with portal links. Completed files use ordinary
DOC-001 originals and ERASURE-002 classes, clocks, holds, preview, receipts and
stale-restore fencing. Staff transport cannot resume portal staging. New packet
originals start internal and grant no new contact download rights.

## Practitioner filing source fallback

`GET /jobs/:id/filing-status` returns the native agency return identity (job, client, form, jurisdiction and tax year), the named stack choices and its recorded source, or an explicit absence of stack status. The tax year is the year the obligation period ends, including a fiscal year. Source provenance is always `practitioner-recorded`; this door does not contact a tax provider.

`POST /jobs/:id/filing-status` records only the accepted-acknowledgment fallback. Supply `jobId`, `clientId`, `form`, `jurisdiction`, `taxYear`, `stack` (Lacerte, ProSeries, Drake, UltraTax CS or CCH Axcess), `noStatus: true`, `noStatusDeclaration`, `fileId`, `submissionId` and `acceptedOn` (a calendar date). The declaration records that the chosen stack exposes no status for this exact return. The file must be an unerased original on this job, readable under current document grants. The server checks the identity against the agency obligation rather than trusting a client or year supplied by the caller.

The writable staff session needs full current job access. Agents, integration bearers, read-only staff, revoked sessions, foreign files and mismatched return identities are refused. One mapping exists per job: identical concurrent requests return the same source and commit one acknowledgment and source audit; changed intent is refused. If the native deadline acknowledgment already exists, its file, submission and accepted date must match exactly; its original attribution is preserved. Checklist completion, signatures and sign-off never create a filing source.

The source mapping and acknowledgment share an atomic write through the deadline authority. Readback includes the declaration, exact file reference and digest, submission, accepted date, original acknowledgment attribution and mapping attribution. Erased files are shown as unavailable evidence and cannot authorize replay. Mappings travel in native archives as historical evidence without connector credentials or outbound authority. They join signed-off work under its existing retention clock and holds; whole-client erasure names the retained mappings in the receipt, refuses ordinary source reads and replay, and fences older archives. Approved retention expiry removes the declaration and replay intent while preserving source references and attribution.

This is a native fallback only. Licensed five-stack ingestion, transmitted and rejected outcomes, reject codes, rejection-driven rework, paper-filed proof and disconnect journeys remain unbuilt. No provider verification is implied by practitioner-recorded acceptance.

## Client current statement and payment history (PAY-002 partial)

`GET /api/blotter/client/entities/:id/billing` uses the installation-host
client portal session and its completed factor, with the same live entity and
contact grant as the entity page. The entity response also includes `billing`.
Both reads are attributed as `portal.billing_read` and use `Cache-Control: no-store`.
Staff sessions, invoice links and integration credentials do not authenticate this door.
An unknown entity and an entity the contact cannot currently open return the same refusal.

The projection contains only issued, unerased invoices whose frozen recipient is
that contact. It includes paid invoices for history; open invoices have a positive
`balanceCents`. `asOf` is the current read time, rather than a selectable historical
statement date. All amounts are integer USD cents, using native invoice balance
semantics: gross subtotal plus tax, less applied credits and recorded deposits,
approved write-offs and net recorded provider payments. `totals` reconciles those
five categories across exactly the included invoices. No unapplied client-wide
credit balance or other recipient's allocations are disclosed.

Each payment exposes its native id, invoice id and number, currency, safe method
category, state, original amount, refunded amount, net applied amount,
`lastObservedAt` and `historical`. Pending, returned, failed, refunded and disputed
amounts do not count as settled receipts. A partial refund reduces the net even
while the remaining payment is settled. A missing observation time is explicitly
unconfirmed. These are recorded provider observations, never a fresh provider
query or settlement guarantee. Restored payment rows remain historical, with their
original observation time, after fresh portal enrollment; restored mandates stay held.
Provider references, credentials, raw failure details, internal approval reasons
and other contacts' billing records are excluded.

The English and Spanish account page shows the current statement, open invoices,
recorded payment history and readable invoice PDFs. Reads never change invoices,
payment records or mandates and never contact a payment provider. Multi-invoice
payment, method management, auto-pay and installment mandates remain unimplemented.


### Optional engagement-text consent

The authenticated client portal has a separate `GET` and `POST` door at
`/api/blotter/client/entities/:id/sms-consent`. Both require a completed
current authenticator factor and a live entity and contact grant, even when the
firm's other portal reads permit an optional factor. The read presents the current
normalized phone, contact revision, language, wording and version, latest event id
and attributed history. Staff cannot record a choice for a contact.

The write accepts the opaque `reviewToken` from that read, `requestId`, `contactRevision`, `phone`, `language`,
`wordingVersion`, `lastId` and `choice` (`decline`, `opt_in` or `withdraw`).
It retains the exact presented wording and immutable original entity, contact,
account actor id, phone, revision, choice and time. Request ids are digest-only,
scoped to the account; identical concurrent requests create one event and audit.
Changed intent and stale choices are refused. The review token binds the presented wording, current entity revision and consent state, so a new request prepared before a merge or its undo cannot revive a choice. A database fence invalidates earlier choices on contact edits, including imported
edits and their undo, except for a language-only edit. Native evidence preserves its client and contact during import undo.
Merging either entity invalidates choices
on both. Undo invalidates choices recorded during the merge too; it never revives earlier choices. Matching phones, imports and email, request or
marketing consent create no SMS choice. No default is changed.

Authorized native staff may inspect evidence with
`GET /api/blotter/clients/:id/sms-consent`, including the immutable original entity
for records merged into that client. It supplies no staff write door. The contact
record class covers SMS evidence in retention holds, erasure previews and receipts;
unheld erasure redacts the phone, wording and revision while retaining attributed
choice history. Archives carry historical evidence with `restored=1`; fresh portal
enrollment cannot reactivate it. The existing erasure journal rejects stale restores.

Phones are not carrier-verified. Text delivery remains unavailable. Consent capture
creates no message, provider request, scheduled send, sender connection or sending
authority. Marketing texts remain refused. An authorized Twilio account and
registered US sender, carrier STOP and HELP, MMS, quiet hours and full provider-copy
activation proof remain required by SMS-001.

### Unsigned Form 8879 intake

Native staff with full job and document access use `GET /api/blotter/jobs/:id/efile-authorization` to inspect the exact US 1040 client-year engagement, practitioner-recorded spouse requirements and missing signature and KBA reasons. `POST /api/blotter/jobs/:id/efile-authorization` requires `jobId`, `clientId`, `taxYear`, `form` equal to `8879`, `filingStatus` equal to `married_filing_jointly`, the same job's `fileId`, two distinct `spouseContactIds` with their reviewed `spouseContactRevisions` in the same order, and explicit true `reviewedFinalUnsigned` and `reviewedRequiredSigners` confirmations. Add the valid unsigned PDF through the job's existing document upload first. No tax-software provenance or verified identity is claimed.

The first intake freezes original bytes and digest, the reviewed contact names and revisions, and recorder and time. Identical concurrent submissions yield one record and history event; different intent, revoked authority, erased originals and inactive restored records are refused. `GET /api/blotter/jobs/:id/efile-authorization/original` returns the byte-identical unsigned PDF after current staff, document, contact and session checks, with an attributed download. No contact or integration bearer can create this intake.

The principal sets `efileReady: true` when creating or editing an empty open-stage sub-status through the existing sub-status doors under Settings. The designation is permanent and survives renaming. Every status effect, including automation and bulk reassignment, refuses entry while required signature and KBA evidence is unavailable. Review and completion still use the existing review gates. A label alone confers no readiness designation. General signing refuses IRS e-file forms; no local signature completion or gate override is supported.

Unsigned intake has no signed-record retention clock. Its originals and spouse roster are classified for class, job and original-file holds, preview and confirmed erasure; digest and attribution remain. Downloaded outside copies name their staff holder. Archives carry the exact record as inactive historical evidence; they grant no signing authority and cannot bypass the erasure journal fence. Genuine KBA, remote delivery, handwritten fallback, signed artifacts and release to ready to file remain unavailable.

### Personal calendar time-suggestion choice

`GET /api/blotter/time/calendar-consent` presents the authenticated staff member's
optional calendar choice, exact wording and version, calendar source category,
review token and attributed history. It starts off and remains separate from
native work-action consent. Scoped staff see only their own choice.

`POST /api/blotter/time/calendar-consent` accepts only `staffId`, `source`,
`wordingVersion`, `reviewToken`, `lastId`, `requestId` and `choice` (`decline`,
`opt_in` or `withdraw`) from that presentation. The staff identity and actor are
resolved from the current native session; choosing for somebody else is refused.
A request id commits one immutable event and audit, including the exact presented
wording, choice and time. A changed intent or an old request after a newer choice
is refused. Current session, staff authority and the installation's per-session
MFA rules are checked at the write boundary. Agent and integration credentials
cannot use this door; read-only staff cannot write.

Deactivation and offboarding invalidate prior choices without transferring them
to a successor. Staff-classified choice history travels in native archives with
its original staff identity and attribution, always inactive after restore; a
fresh current presentation and explicit personal choice are required. Staff
records contain no client data and are retained under the existing staff class,
without a client-record erasure clock or provider-copy claim.

Calendars are not connected and calendar suggestions remain unavailable. This
choice creates no calendar event, time suggestion, time entry, billing change,
provider request or provider-access grant. Google, Outlook, Calendly and Acuity
integration, connected-event suggestions, CRM consultation linkage and full
connector retention and erasure evidence remain unimplemented.
