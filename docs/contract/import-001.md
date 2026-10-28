# IMPORT-001 capability rules

The following source rules are retained from the contract at `ca2596bae4c081a2df169d327b23c0030428b918`. Current acceptance and company-policy classes are defined by CONTRACT.md.

**Semantics (ct 19 Oct 16:47Z):** the owner maps source headers explicitly; the reviewed fingerprint binds original bytes, mapping and duplicate decisions.

**Inherited MSG-002 marketing consent (ct 20 Oct 21:21Z):** Imports bring marketing in as not granted; a grant comes in only from an explicitly mapped opt-in column with a capture date and the owner's attestation at commit, shown separately in the preview; unsubscribed, bounced and complained states always import as withdrawals.

**IMPORT-001 — Reviewed client list import.** Preview CSV account/contact imports with flexible field mapping, validation, entity/contact matching, duplicate policy and source provenance.

**IMPORT-001 — Reviewed client list import.** Status: **done**. Map an exported client/contact CSV, preview errors and duplicates without writes, commit its reviewed fingerprint and resume. Re-import without duplication, create a native job on one imported client and undo; inspect preserved native work and the source journal.

Inherited MSG-002 marketing consent (ct 20 Oct 21:21Z), asserted on MSG-002's doors before marketing ships: imports bring marketing in as not granted; a grant comes in only from an explicitly mapped opt-in column with a capture date and the owner's attestation at commit, shown separately in the preview; unsubscribed, bounced and complained states always import as withdrawals. Asserted by the named MSG-002 / IMPORT-001 / BASE-001 journey in `tests/blotter/import-mapping.test.mjs` and native Move in browser journey in `tests/blotter/import-marketing-ui.mjs`.
