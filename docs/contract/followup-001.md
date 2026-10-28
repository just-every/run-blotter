# FOLLOWUP-001 capability rules

The following source rules are retained from the contract at `ca2596bae4c081a2df169d327b23c0030428b918`. Current acceptance and company-policy classes are defined by CONTRACT.md.

**Offboarding (ACCESS-006, inherited before this ships):** a departing staff member's scheduled reminder sequences appear in the offboarding preview and move to the work successor in its approved batch; later sends go from the successor and past sends keep their sender.

**Message templates (MSG-001, inherited before this ships):** each reminder-sequence step may use a firm or personal template, rendered per recipient when it sends, with the same refusal and stored text; editing the template changes later steps only.

**Inherited MSG-002 marketing consent (ct 20 Oct 21:21Z):** Follow-up sequences send engagement class only, with MSG-002's send-time recheck.

**FOLLOWUP-001 — Automatic document chasing and escalation.** A firm-approved reminder sequence follows missing documents, organizer answers, signatures and unresolved questions through email, portal and opted-in US SMS via Twilio.

**FOLLOWUP-001 — Automatic document chasing and escalation.** Status: **partial**. Approve a bounded reminder sequence, leave two items missing and complete one between sends. Observe only the remaining item chased, with that step's template rendered for the client and listing only the outstanding item, a failed delivery surfaced to its owner and escalation at the configured condition. Reply STOP to an actual consented US SMS and verify further SMS ceases; pause and resume without duplicate sends. Offboard a preparer with a scheduled reminder sequence (ACCESS-006): the next reminder goes from the successor and earlier reminders still show the preparer. Use the "Month-end close request" template (MSG-001) as step 2 of a sequence for two clients; edit it and confirm the next step uses the new version while sent steps keep their text. Before activation, satisfy BASE-001’s inherited authority/audit/erasure/portability gate with named public-door evidence.

Inherited MSG-002 marketing consent (ct 20 Oct 21:21Z), asserted on MSG-002's doors before marketing ships: follow-up sequences send engagement class only, with MSG-002's send-time recheck.
