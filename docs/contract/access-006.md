# ACCESS-006 capability rules

The following source rules are retained from the contract at `ca2596bae4c081a2df169d327b23c0030428b918`. Current acceptance and company-policy classes are defined by CONTRACT.md.

**Semantics (ACCESS-006):** the principal offboards (until a second owner role exists).

The preview lists, for one member, active or already deactivated: open jobs where they are preparer, reviewer or manager (a client's ownership is its jobs and recurring rules until CRM-001 adds a client owner, which inherits this transfer before it ships); their open named tasks; recurring rules naming them; open tax notices assigned to them; open discussions they own; open client questions and client to-dos they own (PORTAL-003); agent proposals waiting for their decision; templates naming them as a task owner; their running timer; their time not yet approved; their live agent keys and sessions.

**Inherited MSG-002 marketing consent (ct 20 Oct 21:21Z):** A departing member's bulk-message batches move to the successor, and marketing batches need fresh principal approval. Implemented and asserted on MSG-002's doors (consent carriers journey, `tests/blotter/bulk-messages.test.mjs`); MSG-002 states the exact semantics.

**ACCESS-006 — Staff offboarding and ownership transfer.** Before deactivating a departing or long-absent staff member, the owner previews everything that person owns.

No orphaned item remains.

**ACCESS-006 — Staff offboarding and ownership transfer.** Status: **done**. Give a preparer clients, open work, a scheduled reminder sequence, a pending signature request and a connected mailbox. Preview the transfer, reassign everything to two successors and deactivate the preparer. No orphaned item remains. The next reminder goes from the successor, past messages show the original author, and the deactivated member's sessions and tokens are refused.

Inherited MSG-002 marketing consent (ct 20 Oct 21:21Z), asserted on MSG-002's doors before marketing ships: a departing member's bulk-message batches move to the successor, and marketing batches need fresh principal approval. Asserted by the MSG-002 consent carriers journey in `tests/blotter/bulk-messages.test.mjs`.
