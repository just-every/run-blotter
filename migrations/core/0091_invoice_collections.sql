-- BILL-004: the firm's overdue-invoice reminder schedule runs only under a recorded
-- consent of the principal or a financial-authority holder; clients may opt out or
-- use their own steps; a dispute or payment plan stops reminders for that invoice.
-- Each invoice reminds once per schedule step: a passed step is either sent or
-- recorded as skipped, and a held send is never replayed.
CREATE TABLE b_invoice_reminder_policy(
 id INTEGER PRIMARY KEY CHECK(id=1), offsets TEXT NOT NULL CHECK(json_valid(offsets)),
 template_id TEXT NOT NULL, template_version INTEGER NOT NULL,
 status TEXT NOT NULL CHECK(status IN('active','paused')), revision TEXT NOT NULL,
 consenter_id TEXT, consented_by TEXT NOT NULL, reason TEXT NOT NULL, consented_at TEXT NOT NULL
);
CREATE TABLE b_invoice_reminder_clients(
 client_id TEXT PRIMARY KEY REFERENCES b_clients(id), mode TEXT NOT NULL CHECK(mode IN('off','custom')),
 offsets TEXT CHECK(offsets IS NULL OR json_valid(offsets)), reason TEXT NOT NULL, set_by TEXT NOT NULL, set_at TEXT NOT NULL
);
ALTER TABLE b_invoices ADD COLUMN collection_hold TEXT CHECK(collection_hold IS NULL OR collection_hold IN('disputed','payment_plan'));
ALTER TABLE b_invoices ADD COLUMN collection_note TEXT;
CREATE TABLE b_invoice_reminders(
 id TEXT PRIMARY KEY, invoice_id TEXT NOT NULL REFERENCES b_invoices(id), step INTEGER NOT NULL, scheduled_on TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN('dispatching','accepted','failed','held','skipped')),
 recipient_email TEXT, subject TEXT, message TEXT, delivery TEXT, policy_revision TEXT NOT NULL, created_at TEXT NOT NULL,
 UNIQUE(invoice_id,step)
);
