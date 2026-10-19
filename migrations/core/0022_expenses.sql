-- Expenses and disbursements (TIME-004). Each expense is recorded against a
-- job (and so its client) at cost in integer cents. A billable expense's
-- charge is its cost plus a whole-percent markup, rounded half up to the cent;
-- a non-billable expense charges nothing. Mileage costs tenths of a mile at the
-- firm rate in force on the expense date. A reviewer or the principal approves
-- or rejects it; only approved billable expenses reach a billing export.
-- Staff-paid expenses are owed back to that person at cost, apart from the
-- client charge. Additive only, so older archives still restore.
CREATE TABLE b_mileage_rates(
 effective_from TEXT PRIMARY KEY, cents_per_mile INTEGER NOT NULL CHECK(cents_per_mile BETWEEN 1 AND 100000),
 set_by TEXT NOT NULL, set_at TEXT NOT NULL
);
CREATE TABLE b_expenses(
 id TEXT PRIMARY KEY, job_id TEXT NOT NULL REFERENCES b_jobs(id), client_id TEXT NOT NULL REFERENCES b_clients(id),
 kind TEXT NOT NULL CHECK(kind IN ('filing_fee','postage','mileage','software','other')),
 date TEXT NOT NULL, description TEXT NOT NULL,
 mile_tenths INTEGER CHECK(mile_tenths IS NULL OR mile_tenths BETWEEN 1 AND 100000), cents_per_mile INTEGER,
 cost_cents INTEGER NOT NULL CHECK(cost_cents BETWEEN 1 AND 100000000),
 billable INTEGER NOT NULL CHECK(billable IN (0,1)), markup_percent INTEGER NOT NULL CHECK(markup_percent BETWEEN 0 AND 100),
 charge_cents INTEGER NOT NULL CHECK(charge_cents>=0),
 paid_by TEXT NOT NULL CHECK(paid_by IN ('firm','staff')), person_email TEXT NOT NULL,
 receipt_name TEXT, receipt_mime TEXT, receipt_size INTEGER CHECK(receipt_size IS NULL OR receipt_size BETWEEN 1 AND 1048576),
 receipt_sha256 TEXT, receipt_base64 TEXT CHECK(receipt_base64 IS NULL OR length(receipt_base64)<=1398104),
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
 decided_by TEXT, decided_at TEXT, reason TEXT NOT NULL DEFAULT '',
 reimbursed_by TEXT, reimbursed_at TEXT,
 created_by TEXT NOT NULL, created_at TEXT NOT NULL,
 CHECK(billable=1 OR (markup_percent=0 AND charge_cents=0)),
 CHECK(kind<>'mileage' OR (mile_tenths IS NOT NULL AND cents_per_mile IS NOT NULL)),
 CHECK(status='pending' OR decided_by IS NOT NULL), CHECK(status<>'rejected' OR reason<>''),
 CHECK(reimbursed_at IS NULL OR (paid_by='staff' AND status='approved'))
);
CREATE INDEX b_expenses_job ON b_expenses(job_id,date);
-- Amounts never change; a decision is made once, and a reimbursement is recorded once.
CREATE TRIGGER b_expenses_immutable BEFORE UPDATE ON b_expenses
 WHEN NEW.id IS NOT OLD.id OR NEW.job_id IS NOT OLD.job_id OR NEW.client_id IS NOT OLD.client_id OR NEW.kind IS NOT OLD.kind
 OR NEW.date IS NOT OLD.date OR NEW.description IS NOT OLD.description OR NEW.mile_tenths IS NOT OLD.mile_tenths
 OR NEW.cents_per_mile IS NOT OLD.cents_per_mile OR NEW.cost_cents IS NOT OLD.cost_cents OR NEW.billable IS NOT OLD.billable
 OR NEW.markup_percent IS NOT OLD.markup_percent OR NEW.charge_cents IS NOT OLD.charge_cents OR NEW.paid_by IS NOT OLD.paid_by
 OR NEW.person_email IS NOT OLD.person_email OR NEW.receipt_sha256 IS NOT OLD.receipt_sha256 OR NEW.receipt_base64 IS NOT OLD.receipt_base64
 OR (OLD.status<>'pending' AND NEW.status IS NOT OLD.status) OR OLD.reimbursed_at IS NOT NULL
 BEGIN SELECT RAISE(ABORT,'expenses are immutable'); END;
CREATE TRIGGER b_expenses_delete BEFORE DELETE ON b_expenses BEGIN SELECT RAISE(ABORT,'expenses are immutable'); END;
