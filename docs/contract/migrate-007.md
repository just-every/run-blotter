# MIGRATE-007 capability rules

The following source rules are retained from the contract at `ca2596bae4c081a2df169d327b23c0030428b918`. Current acceptance and company-policy classes are defined by CONTRACT.md.

**Receiving ERASURE-002 (ct 22 Oct 2026):** Before shipping, MIGRATE-007 adds its records and provider copies to ERASURE-002's classes, clocks, holds, preview, erasure, receipt and restore fence (ct 22 Oct 2026).

**MIGRATE-007 — Auto pay enrollments carried over or reauthorized.** Migration imports each client's auto-pay enrollment and saved-method references (card or US bank account, brand and last four, authorization date and wording where available): from Karbon Payments, which runs on Stripe Connect, under MIGRATE-001, and from TaxDome Payments, Canopy Payments and Financial Cents under MIGRATE-002 to 004.

**MIGRATE-007 — Auto pay enrollments carried over or reauthorized.** Status: **missing**. Migrate three Karbon auto-pay clients, one whose saved card copies through Stripe's payment-data migration at the provider test edge and two whose methods cannot be copied. Inspect the cutover report: one mandate migrated and two awaiting reauthorization, each with an owner and a sent template message. Have one of the two reauthorize through the portal and watch the report update. Issue the first post-cutover invoices: the migrated and reauthorized clients are collected automatically on the due date; the third client's invoice is not charged, stays open and carries owned reauthorization follow-up with a scheduled chase. Confirm Karbon auto-pay was recorded off for each client before Blotter's first charge and that no invoice was charged in both systems. Before activation, satisfy BASE-001’s inherited authority/audit/erasure/portability gate with named public-door evidence.

Receiving ERASURE-002 (ct 22 Oct 2026): Before shipping, MIGRATE-007 adds its records and provider copies to ERASURE-002's classes, clocks, holds, preview, erasure, receipt and restore fence (ct 22 Oct 2026).
