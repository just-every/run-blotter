# Practice coordinator

Blotter's shared agent door is at `/mcp`; `/agents` shows policy, approvals,
review and the audit. It serves both supported MCP eras and canonical protected
resource metadata through the copied Base production entry. Business tokens
require signed consent and a durable Business person binding. Local keys retain
their existing narrow preparation scopes. Unknown or inactive people do not gain
access by matching a token email.

This adoption is incomplete. Its implemented registry covers the native
agent-readable context and preparation services below. The existing dedicated
HTTP agent and supervised-event doors have not yet been migrated, so this is not
a claim that every agent action in an installation uses company policy.

| Tool | Classes | Native clauses |
| --- | --- | --- |
| `blotter.practice.snapshot` | standard | AGENT-001, ACCESS-001, ACCESS-002 |
| `blotter.practice.context` | sensitive | AGENT-001, ACCESS-001, ACCESS-002 |
| `blotter.rollforward.prepare` | standard | AGENT-001, WORK-002 |
| `blotter.reminder.prepare` | standard | AGENT-001, PORTAL-001 |
| `blotter.billing.prepare` | standard | AGENT-001, BILL-001 |
| `blotter.readiness.read` | sensitive | READY-001, ACCESS-001, ACCESS-002 |
| `blotter.readiness.prepare` | standard, sensitive | READY-001 |
| `blotter.learning.evidence` | sensitive | LEARN-001 |
| `blotter.learning.prepare` | standard, sensitive | LEARN-001 |
| `blotter.learning.read` | sensitive | LEARN-001 |
| `blotter.events.list` | standard | BASE-AGENT-010 |

Preparation saves a draft; it does not send a reminder, roll work forward,
create a billing export, change a template or record a person's approval.
Company policy governs the shared call. The later native decision remains a
separate human act under the current AGENT-001 contract. Only actual private
reads receive sensitive; internal preparation receives standard. Preparations
returning native source evidence also carry sensitive. Caller flags
and imported text cannot remove these classes. Draft summaries identify the
native target and proposed items; job revisions use exact integer handles for
the native UUID revision. No provider cost or spend reservation is registered.
The journey uses `spend: {none: true}`; no tool in this registry calls an
outbound provider. Native mail used by setup and Business invitations retains
Base's built-in mail edge. Stripe, OpenAI, webhooks and enterprise OAuth remain
outside this registry.

Resources currently cover `blotter://clients/{id}` (identity metadata),
`blotter://engagements/{id}` (source-linked readiness),
`blotter://proposals/{id}` and `blotter://learning/{id}`. They re-read native
visibility, label source content untrusted, exclude bearer/download credentials
and use the same policy and audit machinery. Missing and restricted records
produce the same unavailable result. These resources do not claim document
bytes, notices, taxpayer authorization details, invoices, payments, imports or
supervised runs. Those broader native adapters remain to be adopted.

Business owner IDs bind to the setup owner's native operator ID. Business team
IDs bind through the signed roster ledger to native operator IDs; an admin maps
to a reviewer and a member to a preparer. The Business admin's policy role is
editor; a local reviewer promotion does not create that role. Native admission,
MFA requirements, read-only status, job visibility and client grants continue to
apply. Revocation is checked on each tool call and again on approval execution.
Device capture, installation, reviewed imports and separately granted connector
work retain their native doors and are declared as notTools.

The conformance owner fixture uses setup-token mode at the native
`/auth/bootstrap` endpoint, then enrolls and verifies MFA through real HTTP doors.
It creates two completed close periods with actual review returns and an open
period. The journey reads the evidence and prepares all declared draft kinds
under autonomous and held policy, with replay, injection, pause and refusal
checks. The manifest's `/auth/owner-claim` endpoint requires a signed claim when
a hosted trust ring is configured; a raw setup token is never sent there.

The `engagement-week` prompt describes this implemented subset. Deadline rescue,
revenue reconciliation, complete onboarding, incumbent switching, new provider
accounts, payment movement, access changes and autonomous effect execution are
not represented by these preparation tools. The broader ct Agent surface remains
unmerged and unjudged; its four-part job names also need alignment with Base's
three-part tool naming contract. No clause status is promoted by this adoption.

Three Base interfaces block complete adoption at the runtime pin recorded in
`base-copies.json`:

- Resource readers receive only `{person, db}`. Blotter's native retained-invoice
  reader records a private-read audit entry and needs the authenticated agent's
  identity and preparer attribution. Reading raw invoice tables instead would
  bypass the native reader; claiming a person performed that read would be false.
- Embedded `door.invoke` accepts only `{person, agent}` and constructs a principal
  without consent. The context also omits consent. Native supervised work cannot
  carry the originating Business consent into queued execution or stop on that
  consent's revocation through this hook. Persisting a guessed consent or calling
  a different policy dispatcher is not an adoption.

- The door has no client-custody/erasure hook for private cached outcomes,
  pending approvals, review summaries and trace data. The native registry classifies
  these stores explicitly. Existing client erasure remains available with empty
  shared history; once shared history exists, erasure fails closed with an owned
  custody exception. A complete client-scoped redaction and replay fence is
  required before that exception can be resolved.

A Base resource context carrying authenticated attribution, embedded
invocation/context carrying the originating consent, and module-owned
client-custody hooks are required before the
remaining resources, legacy agent endpoints, scheduled work and client custody can complete the
one-door migration. Practice archives retain door audit, events, usage and native revision handles. Live
Business bindings, policy state, agent admission, pending approvals/reviews and
cached call authority are installation-local and excluded from export and import.
A restored practice must establish its own current Business binding and policy.
No copied policy or transport source is modified here.
