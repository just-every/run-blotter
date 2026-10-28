# MIGRATE-001 capability rules

The following source rules are retained from the contract at `ca2596bae4c081a2df169d327b23c0030428b918`. Current acceptance and company-policy classes are defined by CONTRACT.md.

**Status model (WORK-007, inherited before this ships):** imported work keeps its work type, stage, sub-status (with per-type limits) and job roles, including a partner sign-off.

**Inherited MSG-002 marketing consent (ct 20 Oct 21:21Z):** Migration brings marketing in as not granted; unsubscribed, bounced and complained states always import as withdrawals, and an incumbent "subscribed" status without evidence imports as not granted.

**Receiving ERASURE-002 (ct 22 Oct 2026):** Before shipping, MIGRATE-001 adds its records and provider copies to ERASURE-002's classes, clocks, holds, preview, erasure, receipt and restore fence (ct 22 Oct 2026).

**MIGRATE-001 — Karbon migration.** Migrate Karbon using authorized API extraction and supported exports/assisted extraction for clients/contacts/groups/custom fields, work types, primary statuses and firm sub-statuses with their per-type limits, job roles, work templates, repeating work schedules with the future work items they have already created (MIGRATE-006), automators (imported paused), email templates, active tasks/dependencies and assignments, triage email/thread references, notes/files, time/budget/billing history and Karbon Payments auto-pay enrollments with their saved-method references (MIGRATE-007).

**MIGRATE-001 — Karbon migration.** Status: **missing**. Import an authorized Karbon practice containing completed history and live work, confirm every active work item keeps its work type and primary/sub-status (WORK-007) and that an unmapped status is held for review, review mappings and source limitations, compare counts and representative files/messages/fees, interrupt/resume and repeat the import. On the same practice, pass MIGRATE-006's repeating-schedule journey (monthly, quarterly and annual series with pre-created future items) and MIGRATE-007's auto-pay journey (three auto-pay clients). Complete a migrated engagement through review/payment, verify historical permissions and no duplicate reminders/debits, then exercise cutover rollback without deleting native work. An imported 1040 work item keeps its work type, sub-status and partner (WORK-007). Before activation, satisfy BASE-001’s inherited authority/audit/erasure/portability gate with named public-door evidence.

Inherited MSG-002 marketing consent (ct 20 Oct 21:21Z), asserted on MSG-002's doors before marketing ships: migration brings marketing in as not granted; unsubscribed, bounced and complained states always import as withdrawals, and an incumbent "subscribed" status without evidence imports as not granted.

Receiving ERASURE-002 (ct 22 Oct 2026): Before shipping, MIGRATE-001 adds its records and provider copies to ERASURE-002's classes, clocks, holds, preview, erasure, receipt and restore fence (ct 22 Oct 2026).
