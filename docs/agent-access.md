# Agent access

Give an agent a key to read the practice context and prepare work that waits for a person's decision.

## Create and protect a key

As the principal or a reviewer, open **Team & safety → Agent keys**. Enter an **Agent name** and press **Create agent key**. Copy it immediately: it is shown once. Store it in the agent's secret store.

The agent acts for the person who created its key, with that person's visibility. It can read context and create preparations. It cannot approve work, directly change practice records or send reminders. The key's creator decides each preparation in **Preparations**. Revoking a key, or deactivating its person, removes access; deactivation revokes the key for good, so a reactivated person creates a new one.

## Authentication

Use your installation's origin, not the public documentation site. Supply the key as a bearer token and send JSON bodies. In these examples, `BLOTTER_ORIGIN` is your installation's origin and `BLOTTER_AGENT_KEY` comes from your secret store.

```sh
curl --fail-with-body --silent --show-error \
  "$BLOTTER_ORIGIN/api/blotter/agent/context" \
  -H "Authorization: Bearer $BLOTTER_AGENT_KEY"
```

Never put the key in a URL, source file, log or chat.

## Read context

`GET /api/blotter/agent/context` returns:

- `jobs`: visible jobs with `id`, `title`, `period_start`, `period_label`, `due_date`, `status`, `client`, `has_contact`, outstanding document labels in `outstanding`, and `next_job_id` when the next period exists.
- `unbilled`: billable items not already in an export, including each item's `source_key`. This is empty for preparers.
- `commands`: the supported preparation command paths.

Use the returned job IDs and source keys in the commands below. People supply due dates and their sources; an agent must not calculate tax due dates.

## Prepare work

| Method and path | JSON body | Result when the person approves |
| --- | --- | --- |
| `POST /api/blotter/agent/prepare-rollforward` | `jobId`, `dueDate` as `YYYY-MM-DD`, `dueNote` | Creates the next period's job. `dueNote` records where the due date comes from. |
| `POST /api/blotter/agent/prepare-reminder` | `jobId`, optional `message` | Issues a new upload link and mails the client their outstanding requests. |
| `POST /api/blotter/agent/prepare-export` | `title`, `sourceKeys` array | Creates a draft billing export. The principal still approves the export before a CSV exists. |

Roll-forwards and exports require a principal's or reviewer's key. A reminder preparation is for an open job.

For a reminder, replace the example job ID with one from context:

```sh
curl --fail-with-body --silent --show-error \
  "$BLOTTER_ORIGIN/api/blotter/agent/prepare-reminder" \
  -H "Authorization: Bearer $BLOTTER_AGENT_KEY" \
  -H 'Content-Type: application/json' \
  --data '{"jobId":"JOB_ID_FROM_CONTEXT","message":"Please upload the outstanding documents."}'
```

Each command returns `id`, `kind`, `status: "pending"` and `payload`. Creating a preparation does not perform its proposed action.

## Decide in Preparations

Sign in as the person who created the key. Open **Preparations**, inspect the proposal and **Approve** it, or **Decline** it with a reason. Approval performs the prepared action and records its result. Decisions are recorded in the practice history.

A revoked key or deactivated person receives `401` or `403`. Other rejected requests return JSON with an `error` message. Read context again when the job or billable items have changed; do not repeatedly submit a stale preparation.

The repository's [API reference](https://github.com/just-every/run-blotter/blob/main/API.md) describes the same agent doors.
