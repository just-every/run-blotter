# SIGN-001 capability rules

The following source rules are retained from the contract at `ca2596bae4c081a2df169d327b23c0030428b918`. Current acceptance and company-policy classes are defined by CONTRACT.md.

**Receiving ERASURE-002 (ct 22 Oct 2026):** Its record is ERASURE-002's IRS e-file authorization class.

**SIGN-001 — IRS e-file signature authorizations with KBA.** Blotter collects IRS e-file signature authorizations: Forms 8879, 8879-S, 8879-PE, 8879-C, 8879-F and 8878.

**SIGN-001 — IRS e-file signature authorizations with KBA.** Status: **missing**. Attach a Form 8879 to a married-filing-jointly 1040 engagement and send it to both spouses through the KBA provider at its test edge. Make one spouse fail KBA once and pass on retry. Make the second spouse fail three times, and confirm electronic signing is refused for them and a handwritten-signature task with the printable form is created. Before both signatures exist, moving the work to ready to file is refused. After the wet signature is uploaded, the move is allowed. Inspect the stored signed PDF, certificate, per-signer IP address, login ID and KBA attempts on the 1040 engagement, and confirm a retention date three years after the later of due date and received date. Erasure before that date is refused. The return stays unfiled until an INTEGRATE-008 acceptance arrives, and an unsigned form is chased under FOLLOWUP-001. Before activation, satisfy BASE-001’s inherited authority/audit/erasure/portability gate with named public-door evidence. Inherited NOTIFY-001: before this capability ships, assert its corresponding signature, push, connected reply/sync or payment notification through a named public-door journey, preserving event preferences, quiet hours, authority and deduplication.

Receiving ERASURE-002 (ct 22 Oct 2026): Its record is ERASURE-002's IRS e-file authorization class.
