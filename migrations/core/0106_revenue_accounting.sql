-- Accounting source observations confer no invoice or provider authority.
CREATE TABLE b_revenue_accounting (
 id TEXT PRIMARY KEY,
 client_id TEXT NOT NULL REFERENCES b_clients(id),
 invoice_id TEXT NOT NULL REFERENCES b_invoices(id),
 source TEXT NOT NULL,
 reference TEXT NOT NULL,
 facts TEXT NOT NULL CHECK(json_valid(facts)),
 reason TEXT NOT NULL,
 recorded_by TEXT NOT NULL,
 recorded_at TEXT NOT NULL,
 UNIQUE(client_id,source,reference)
);
