-- BILL-005: payment-gated release of the firm's own work product (a deliverable), a firm credit
-- hold, and the partner overrides of both. A receipt records how it was paid; an ACH deposit stays
-- pending until the bank settles it. Client-supplied records are never gated.
ALTER TABLE b_invoice_credits ADD COLUMN method TEXT NOT NULL DEFAULT 'other' CHECK(method IN('card','ach','other'));
ALTER TABLE b_invoice_credits ADD COLUMN settlement TEXT NOT NULL DEFAULT 'settled' CHECK(settlement IN('pending','settled'));
ALTER TABLE b_invoice_credits ADD COLUMN settled_by TEXT;
ALTER TABLE b_invoice_credits ADD COLUMN settled_at TEXT;
CREATE TRIGGER b_invoice_credit_settlement BEFORE UPDATE ON b_invoice_credits
 WHEN NEW.settlement IS NOT OLD.settlement AND NOT (OLD.settlement='pending' AND NEW.settlement='settled' AND OLD.kind='deposit' AND OLD.method='ach')
 BEGIN SELECT RAISE(ABORT,'only a pending ACH deposit settles'); END;
-- One firm policy: whether a pending ACH payment releases a gated file, and the credit-hold threshold.
CREATE TABLE b_payment_policy(
 id INTEGER PRIMARY KEY CHECK(id=1), ach_unlock TEXT NOT NULL CHECK(ach_unlock IN('pending','settled')),
 hold_threshold_cents INTEGER CHECK(hold_threshold_cents IS NULL OR hold_threshold_cents>=1),
 hold_grace_days INTEGER NOT NULL DEFAULT 0 CHECK(hold_grace_days BETWEEN 0 AND 365),
 reason TEXT NOT NULL, set_by TEXT NOT NULL, set_at TEXT NOT NULL
);
CREATE TABLE b_payment_gates(
 id TEXT PRIMARY KEY, deliverable_id TEXT NOT NULL REFERENCES b_deliverables(id), invoice_id TEXT NOT NULL REFERENCES b_invoices(id),
 client_id TEXT NOT NULL REFERENCES b_clients(id), reason TEXT NOT NULL CHECK(reason<>''), created_by TEXT NOT NULL, created_at TEXT NOT NULL,
 removed_by TEXT, removed_at TEXT, remove_reason TEXT
);
CREATE UNIQUE INDEX b_payment_gates_active ON b_payment_gates(deliverable_id) WHERE removed_at IS NULL;
CREATE TABLE b_payment_overrides(
 id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK(kind IN('gate','hold')), gate_id TEXT REFERENCES b_payment_gates(id), client_id TEXT NOT NULL REFERENCES b_clients(id),
 reason TEXT NOT NULL CHECK(reason<>''), approved_by TEXT NOT NULL, approved_at TEXT NOT NULL, revoked_by TEXT, revoked_at TEXT, revoke_reason TEXT,
 CHECK((kind='gate' AND gate_id IS NOT NULL) OR (kind='hold' AND gate_id IS NULL))
);
CREATE INDEX b_payment_overrides_live ON b_payment_overrides(kind,client_id) WHERE revoked_at IS NULL;
