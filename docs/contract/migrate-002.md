# MIGRATE-002 capability rules

The following source rules are retained from the contract at `ca2596bae4c081a2df169d327b23c0030428b918`. Current acceptance and company-policy classes are defined by CONTRACT.md.

**Inherited MSG-002 marketing consent (ct 20 Oct 21:21Z):** Migration brings marketing in as not granted; unsubscribed, bounced and complained states always import as withdrawals, and an incumbent "subscribed" status without evidence imports as not granted. 

**Receiving ERASURE-002 (ct 22 Oct 2026):** Before shipping, MIGRATE-002 adds its records and provider copies to ERASURE-002's classes, clocks, holds, preview, erasure, receipt and restore fence (ct 22 Oct 2026).

**MIGRATE-002 — TaxDome migration.** Migrate TaxDome using authorized API extraction and supported exports/assisted extraction for accounts/contacts, pipelines and stages (mapped to WORK-007 work types and statuses), jobs/templates/automations, recurring jobs with their already-created future jobs (MIGRATE-006), message templates, organizers and answers, portal requests/chats, documents, proposals/signed letters, invoices/credits/payment history, TaxDome Payments saved methods and auto-pay (MIGRATE-007) and staff permissions.

**MIGRATE-002 — TaxDome migration.** Status: **missing**. Import an authorized TaxDome practice containing completed history and live work. Confirm every active item keeps its mapped work type and pipeline stage (WORK-007) and that an unmapped pipeline stage is held for review with an owner. Run MIGRATE-006's series check on a monthly and an annual recurring job that have already created future items: one recurrence rule each, the pre-created items claimed once, and the next period created exactly once after cutover. Run MIGRATE-007's auto-pay journey with three TaxDome clients who pay automatically. Review mappings and source limitations, compare counts and representative files/messages/fees, interrupt/resume and repeat the import. Complete a migrated engagement through review/payment, verify historical permissions and no duplicate reminders/debits, then exercise cutover rollback without deleting native work. Before activation, satisfy BASE-001’s inherited authority/audit/erasure/portability gate with named public-door evidence.

Inherited MSG-002 marketing consent (ct 20 Oct 21:21Z), asserted on MSG-002's doors before marketing ships: migration brings marketing in as not granted; unsubscribed, bounced and complained states always import as withdrawals, and an incumbent "subscribed" status without evidence imports as not granted.

Receiving ERASURE-002 (ct 22 Oct 2026): Before shipping, MIGRATE-002 adds its records and provider copies to ERASURE-002's classes, clocks, holds, preview, erasure, receipt and restore fence (ct 22 Oct 2026).
