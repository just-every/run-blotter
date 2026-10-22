-- BILL-002: bounded automatic issue and send. The consent is one JSON record on the
-- rule (revision, per-invoice USD cap, recipient, reason, consenter); it never
-- travels in an archive. An invoice records the rule revision it was issued under
-- or the named exception that left it a draft.
ALTER TABLE b_invoice_retainers ADD COLUMN revision_no INTEGER NOT NULL DEFAULT 1;
ALTER TABLE b_invoice_retainers ADD COLUMN auto_consent TEXT CHECK(auto_consent IS NULL OR json_valid(auto_consent));
ALTER TABLE b_invoices ADD COLUMN auto_revision INTEGER;
ALTER TABLE b_invoices ADD COLUMN auto_exception TEXT;
