# MAIL-001 capability rules

The following source rules are retained from the contract at `ca2596bae4c081a2df169d327b23c0030428b918`. Current acceptance and company-policy classes are defined by CONTRACT.md.

**Time suggestions (TIME-001, inherited before this ships):** a person's connected-mailbox activity becomes a TIME-001 activity-suggestion source only with that person's separate consent for mail, given and withdrawn by them; each suggestion links the message it came from, and nothing is recorded until they approve it.

**Offboarding (ACCESS-006, inherited before this ships):** a departing staff member's connected mailbox, triaged threads and mailbox grants appear in the offboarding preview; the batch moves triaged threads to the work successor and deactivation revokes the mailbox grants.

**Message templates (MSG-001, inherited before this ships):** an inbox reply composes from a firm or personal template, previews it for the exact recipient, is refused while a placeholder is unresolved, sends the version's attachments and stores its rendered text.

**Engagement history (CRM-003, inherited before this ships):** sent and received client emails appear in the client's history with author, time and source link, visible only to those who may read the job, and any unresolved item it creates (an unanswered client email) names an owner, next action and due condition. 

**Receiving ERASURE-002 (ct 22 Oct 2026):** Before shipping, MAIL-001 adds its records and provider copies to ERASURE-002's classes, clocks, holds, preview, erasure, receipt and restore fence (ct 22 Oct 2026).

**MAIL-001 — Gmail and Microsoft 365 shared inbox.** Connect Gmail/Google Workspace and Microsoft 365/Exchange mailboxes with scoped OAuth, shared/delegated mailbox access and visible sync health.

**MAIL-001 — Gmail and Microsoft 365 shared inbox.** Status: **missing**. Connect a real authorized Google mailbox and Microsoft shared mailbox, receive and reply to client threads, delegate one as a job and file an attachment. Send the same event twice, introduce an ambiguous sender and revoke access; inspect one copy, explicit triage and actionable sync failure. With the person's mail consent, a sent client reply suggests TIME-001 time on its job linking that message; without it, or after withdrawal, mail suggests nothing. Offboard a preparer with a connected mailbox (ACCESS-006): the grant is revoked, triaged threads follow the successor and sent mail keeps its author. Reply to a client thread with the "Month-end close request" template (MSG-001) and inspect the rendered reply, its attachment and the stored text. Trace a request from the client's email through upload and review in the CRM-003 client history. Before activation, satisfy BASE-001’s inherited authority/audit/erasure/portability gate with named public-door evidence. Inherited NOTIFY-001: before this capability ships, assert its corresponding signature, push, connected reply/sync or payment notification through a named public-door journey, preserving event preferences, quiet hours, authority and deduplication.

Receiving ERASURE-002 (ct 22 Oct 2026): Before shipping, MAIL-001 adds its records and provider copies to ERASURE-002's classes, clocks, holds, preview, erasure, receipt and restore fence (ct 22 Oct 2026).
