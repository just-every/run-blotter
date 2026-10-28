# VAULT-001 capability rules

The following source rules are retained from the contract at `ca2596bae4c081a2df169d327b23c0030428b918`. Current acceptance and company-policy classes are defined by CONTRACT.md.

**Current semantics:** credentials are AES-GCM ciphertext under the firm's vault key, derived from the installation's own VAULT_KEY secret (never the session secret) and the firm's random salt; one installation is one firm, and without VAULT_KEY the vault refuses to store or reveal.

A reveal needs a step-up from that session in the last 5 minutes: a fresh TOTP, passkey or recovery-code answer, even when the session already passed its sign-in check; agent keys never reveal.

**Receiving ERASURE-002 (ct 22 Oct 2026):** Its owner erasure is refused inside an ERASURE-002 hold; whole-client erasure removes ciphertext, usernames and notes and keeps the reveal log under opaque labels (ERASURE-002).

**VAULT-001 — Client credential vault.** Clients and staff store client-provided logins, such as bank, payroll, state tax and sales-tax portal credentials, encrypted under per-firm keys.

**VAULT-001 — Client credential vault.** Status: **done**. A client adds a state sales-tax portal login through the portal. An assigned preparer reveals it after step-up, and the reveal is logged. An unassigned preparer cannot reveal it. The credential is absent from search, AI summaries and plain exports. Revoke the preparer's access and confirm their next reveal is refused. Before activation, satisfy BASE-001’s inherited authority/audit/erasure/portability gate with named public-door evidence.

Receiving ERASURE-002 (ct 22 Oct 2026): Its owner erasure is refused inside an ERASURE-002 hold; whole-client erasure removes ciphertext, usernames and notes and keeps the reveal log under opaque labels (ERASURE-002).
