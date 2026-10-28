# NOTIFY-001 capability rules

The following source rules are retained from the contract at `ca2596bae4c081a2df169d327b23c0030428b918`. Current acceptance and company-policy classes are defined by CONTRACT.md.

**Native completion and inherited events (NOTIFY-001, ct 20 Oct 16:55Z):** completion covers every shipped native event and email channel; MOBILE-001 supplies actual mobile push before it ships.

**Inherited MSG-002 marketing consent (ct 20 Oct 21:21Z):** A provider complaint alerts the batch owner.

**NOTIFY-001 — Staff notifications digest and settings.** Staff receive in-app, email and mobile push (MOBILE-001) notifications for: work or a task assigned to them, a review requested or returned, a mention, a client reply, an upload, an organizer submission or a completed signature, work due soon (with a configurable lead time), overdue work, status changes on work they own, failed deliveries or syncs, and payments received or failed.

**NOTIFY-001 — Staff notifications digest and settings.** Status: **done**. Assign a job and a task to a preparer. Make one job due tomorrow and one overdue, mention the preparer and have a client upload a file. Inspect the in-app notifications, the emails for the events the preparer chose, and a 7:00 local-time digest that lists due-soon and overdue items once. Turn off email for mentions and confirm mentions then arrive in-app only. A firm-mandatory event cannot be muted, and no SSN or EIN appears in any subject line. Before activation, satisfy BASE-001’s inherited authority/audit/erasure/portability gate with named public-door evidence.

Inherited MSG-002 marketing consent (ct 20 Oct 21:21Z), asserted on MSG-002's doors before marketing ships: a provider complaint alerts the batch owner.

Native bulk-send provider refusals and hard bounces create durable owner-directed failure alerts. The named NOTIFY-001 journey in `tests/blotter/bulk-messages.test.mjs` asserts default in-app delivery, chosen email preferences, safe subjects, refusal/bounce deduplication across repeated events/runs and restart, recipient authority, inactive owners and no failure notice for an unsent hold. `tests/blotter/bulk-failure-ui.mjs` opens the actual staff notification center at desktop and phone widths.
