# Generated contract claims

These clauses use the native contract mirror. Other clauses remain in the legacy acceptance register. CONTRACT.md is the source.

## SECURE-001 — Security program and attestation

Status: **partial**.

Evidence: `src/blotter/security-logs.ts`; `src/ui/security.tsx`; `API.md`; `tests/blotter/security-logs.test.mjs` — “Recorded access-log export selects exact UTC instants across DST” (actual staff, contact-portal and bearer HTTP downloads, exact UTC selection and exclusion, safe fields, spreadsheet escaping, unchanged sources and attributed export); “Access-log export requires the live principal” (role, delegated authority, agent, deactivated, MFA and per-session step-up refusals); “Current access logs remain portable” (safe projection, snapshotted CSV membership through empty export, later download and second export, unchanged copy inventory after restore, archive equality, excluded live authority and stale-restore fencing); `tests/blotter/security-logs-ui.mjs` / securityLogsJourney (Sign-in security CSV download, date boundaries, coverage and unverified identity disclosure, existing icon tooltips, 1440 and 390 screens).

Gap: Native recorded document-download log export only: successful staff, contact-portal and bearer events, principal-only with fresh step-up; bearer identity remains unverified and coverage is explicitly incomplete. Missing: security overview; authorized auditor or attestation-provider account or NDA report access supplying a genuine current SOC 2 Type II report, bridge letter and penetration-test summary; attestation-package request and download with current-period verification; enabled-integration subprocessor list; data-flow description; SIG Lite or CAIQ questionnaire; documented WISP and FTC controls covering encryption, US residency, access logging, tested backups and restores, vulnerability management and incident response with 72-hour customer notification; WISP template mapped to IRS Publications 4557 and 5708. No certification or provider evidence is claimed.
