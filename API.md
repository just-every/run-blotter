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
