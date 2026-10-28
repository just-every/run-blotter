# ACCESS-003 capability rules

The following source rules are retained from the contract at `ca2596bae4c081a2df169d327b23c0030428b918`. Current acceptance and company-policy classes are defined by CONTRACT.md.

**Adopted authority default (pending ct):** only the principal, after sensitive step-up and with an audited reason, connects the configured tenant, explicitly associates an invited existing member with its application-specific subject, maps groups and issues or revokes the hashed provisioning bearer.

**ACCESS-003 — Enterprise identity lifecycle.** Beyond ACCESS-005's Google Workspace and Microsoft 365 sign-in for every firm, optional Microsoft Entra ID SAML/OIDC SSO and SCIM map firm groups to roles/client teams, enforce the configured MFA policy and revoke active sessions on deprovisioning.

**ACCESS-003 — Enterprise identity lifecycle.** Status: **partial**. Connect an authorized Entra tenant, map groups, sign in, change membership and deprovision a user. Verify current-session/API denial and owner recovery, and refuse another tenant or missing required MFA assertion. Before activation, satisfy BASE-001’s inherited authority/audit/erasure/portability gate with named public-door evidence.
