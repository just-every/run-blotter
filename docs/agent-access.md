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

## Company agent door

The production Worker also serves one shared MCP endpoint at `/mcp`, with
2026-07-28 and 2025-11-25 clients, discovery, canonical OAuth resource metadata,
`/api/rer/agent-policy`, and the native person controls at `/agents`.
Business tokens require consent and a signed Business-person binding to a current
native operator id. A matching email is insufficient. The native practice role,
MFA admission, client grants and read-only restrictions still apply. Only signed
Business owners and mapped team administrators can fill Business policy roles;
a local promotion never grants a Business policy role.

The practice coordinator currently supports these MCP jobs:

| Tool | Effect and class | Native clause |
| --- | --- | --- |
| `blotter.context.read` | Visible coordination metadata and internal preparation witness; standard | AGENT-001, ACCESS-001 |
| `blotter.proposals.rollforward` | Internal roll-forward draft; standard | AGENT-001, WORK-002 |
| `blotter.proposals.reminder` | Internal reminder draft; standard | AGENT-001, PORTAL-001 |
| `blotter.proposals.export` | Internal billing-export draft; standard | AGENT-001, BILL-001 |
| `blotter.readiness.read` | Source-linked request and answer evidence; sensitive | READY-001, AGENT-001 |
| `blotter.readiness.prepare` | Source-linked question draft; standard | READY-001, AGENT-001 |
| `blotter.learning.evidence` | Principal-only repeated review evidence; sensitive | LEARN-001, AGENT-001 |
| `blotter.learning.prepare` | Principal-only template-improvement draft; standard | LEARN-001, AGENT-001 |
| `blotter.learning.read` | Principal-only improvement and supporting sources; sensitive | LEARN-001, AGENT-001 |
| `blotter.events.list` | Shared door decision/effect history; standard | BASE-AGENT-010 |

`blotter://engagements/{id}` returns native readiness evidence;
`blotter://proposals/{id}` returns the preparing person's internal proposal.
Both recheck current native access through company policy, approval and audit.
Missing and restricted resources are indistinguishable. Imported/source text is
untrusted; neither resource returns document bytes, vault values or bearer links.

The company policy decides autonomous, review, approval or blocked calls. No
policy, an unanswered class, expired policy, Business/local Pause or revoked
consent prevents the next call. Autonomous preparation creates a draft directly;
it adds no company approval. A company approval authorizes only that exact draft
or read, and retains its named reviewer and agent preparer. The separate native
person decision still governs a reminder send, work roll-forward, portal question,
template version or billing export under AGENT-001. The native SDK/key doors
documented above retain their original preparation-only purpose; their key-bound
supervised schedules are not a Business MCP scheduling family.

Mutations require `idempotency_key`; exact retries have one effect and changed
arguments conflict. Job tools accept the native string `expected_revision` and
refuse stale first execution. Tools compute classes and summaries from current
records. No direct role, credential, payment, filing or provider account action
is exposed. There is no registered provider cost or spend authority. No declared
MCP job reaches an outside provider; human sends and existing provider callbacks
retain their native doors. Custom subscriptions, multi-sponsor orchestration,
outbound mail and resource refresh are undeclared families.

**Retained evidence and erasure.** Before the first admitted shared-door agent,
Blotter places an installation-wide native custody hold. File/client erasure and
retention expiry then remain held: deleting native records cannot remove retained
MCP outcomes, approvals or audit. Atomic client-scoped redaction needs a future
Base hook. The hold is conservative and cannot be cleared by an agent. Identity,
policy, pending execution and shared door evidence never move in domain archives;
retain installation evidence separately. This adoption makes no claim of complete
shared-door client erasure or portability.

**Base replay follow-up.** The 0.2.86 shared runtime can return the retained result of an approved aggregate context read after the sponsor’s native grants narrow. Fresh context reads and record resources recheck native access; complete held-aggregate replay authority needs a Base revalidation hook before production use of that path. This remains a partial shared-door claim.
