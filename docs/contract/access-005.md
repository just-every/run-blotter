# ACCESS-005 capability rules


**ACCESS-005 — Google Workspace and Microsoft 365 staff sign in.** Staff sign in with their firm Google Workspace or Microsoft 365 (Entra ID) account through OpenID Connect, so the firm's existing password, MFA and conditional-access policies apply to Blotter.

**ACCESS-005 — Google Workspace and Microsoft 365 staff sign in.** Status: **missing**. Sign in one preparer through Google Workspace and another through Microsoft 365. A personal gmail.com account and an account from another tenant are refused. Suspend the Google account in Google Admin and confirm the Blotter browser session and that member's API token are refused within the revalidation interval, or immediately when the provider signal arrives. Disable the Microsoft user and confirm the same. The owner can still recover through native sign-in. Before activation, satisfy BASE-001’s inherited authority/audit/erasure/portability gate with named public-door evidence.
