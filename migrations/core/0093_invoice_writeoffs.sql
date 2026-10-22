-- BILL-003: an approved write-off discharges part of an issued invoice's balance. It is
-- its own immutable record: the issued invoice, its PDF and its totals never change.
CREATE TABLE b_invoice_writeoffs(
 id TEXT PRIMARY KEY, invoice_id TEXT NOT NULL REFERENCES b_invoices(id), client_id TEXT NOT NULL REFERENCES b_clients(id),
 amount_cents INTEGER NOT NULL CHECK(amount_cents BETWEEN 1 AND 100000000), currency TEXT NOT NULL DEFAULT 'USD' CHECK(currency='USD'),
 reason TEXT NOT NULL CHECK(reason<>''), approved_by TEXT NOT NULL, approved_at TEXT NOT NULL
);
CREATE INDEX b_invoice_writeoffs_invoice ON b_invoice_writeoffs(invoice_id,approved_at);
CREATE TRIGGER b_invoice_writeoff_open BEFORE INSERT ON b_invoice_writeoffs
 WHEN NOT EXISTS(SELECT 1 FROM b_invoices i WHERE i.id=NEW.invoice_id AND i.status='issued' AND i.erased_at IS NULL AND i.client_id=NEW.client_id
 AND NEW.amount_cents<=i.subtotal_cents+i.tax_cents-COALESCE((SELECT sum(u.amount_cents) FROM b_invoice_credit_uses u WHERE u.invoice_id=i.id),0)
 -COALESCE((SELECT sum(w.amount_cents) FROM b_invoice_writeoffs w WHERE w.invoice_id=i.id),0))
 BEGIN SELECT RAISE(ABORT,'write-off exceeds the open balance'); END;
CREATE TRIGGER b_invoice_writeoff_immutable BEFORE UPDATE ON b_invoice_writeoffs
 WHEN NEW.amount_cents IS NOT OLD.amount_cents OR NEW.invoice_id IS NOT OLD.invoice_id OR NEW.approved_at IS NOT OLD.approved_at OR NEW.approved_by IS NOT OLD.approved_by
 BEGIN SELECT RAISE(ABORT,'a write-off is immutable'); END;
CREATE TRIGGER b_invoice_writeoff_delete BEFORE DELETE ON b_invoice_writeoffs
 BEGIN SELECT RAISE(ABORT,'write-off history is immutable'); END;
