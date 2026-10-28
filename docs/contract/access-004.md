# ACCESS-004 capability rules

The following source rules are retained from the contract at `ca2596bae4c081a2df169d327b23c0030428b918`. Current acceptance and company-policy classes are defined by CONTRACT.md.

Accepted factors are a TOTP authenticator app, a passkey or security key, or, under federated sign-in (ACCESS-005, ACCESS-003), an identity-provider assertion that MFA was performed.

Five incorrect codes within 15 minutes pause verification for 15 minutes.

**ACCESS-004 — Enforced staff multi factor authentication.** The owner can set a firm policy requiring a second factor for every staff sign-in, whatever the method.

**ACCESS-004 — Enforced staff multi factor authentication.** Status: **done**. Enable the firm MFA policy. A preparer without a factor must enroll before seeing any client. Sign in with TOTP and with a passkey. A sign-in with the correct first factor and no second factor is refused, and a session created before the policy must step up before further access. When the preparer loses their factor, the owner resets it; the preparer's sessions are revoked and the audit shows who reset it. A federated sign-in whose token lacks an MFA assertion is challenged for a Blotter factor. Export the enrollment report.
