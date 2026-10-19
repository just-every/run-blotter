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
