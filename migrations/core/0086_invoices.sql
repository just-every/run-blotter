-- BILL-002: native USD invoice authority. Drafts reserve sources; issued documents
-- and their supplied tax treatment are snapshots, independent of job completion.
CREATE TABLE b_invoice_settings(
 id INTEGER PRIMARY KEY CHECK(id=1), authority TEXT NOT NULL CHECK(authority='blotter'),
 revision TEXT NOT NULL, authorized_by TEXT NOT NULL, authorized_at TEXT NOT NULL, reason TEXT NOT NULL
);
CREATE TABLE b_invoice_retainers(
 id TEXT PRIMARY KEY, client_id TEXT NOT NULL REFERENCES b_clients(id), job_id TEXT NOT NULL REFERENCES b_jobs(id),
 title TEXT NOT NULL, start_month TEXT NOT NULL, cancelled_from TEXT,
 definition TEXT NOT NULL CHECK(json_valid(definition)), revision TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('active','paused','cancelled')), principal_id TEXT,
 owner_email TEXT NOT NULL, created_by TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE b_invoice_amendments(
 id TEXT PRIMARY KEY, retainer_id TEXT NOT NULL REFERENCES b_invoice_retainers(id),
 effective_month TEXT NOT NULL, before_snapshot TEXT NOT NULL CHECK(json_valid(before_snapshot)),
 after_snapshot TEXT NOT NULL CHECK(json_valid(after_snapshot)), reason TEXT NOT NULL,
 authorized_by TEXT NOT NULL, authorized_at TEXT NOT NULL, UNIQUE(retainer_id,effective_month)
);
CREATE TABLE b_invoice_entitlements(
 id TEXT PRIMARY KEY, client_id TEXT NOT NULL REFERENCES b_clients(id), job_id TEXT NOT NULL REFERENCES b_jobs(id),
 kind TEXT NOT NULL CHECK(kind IN ('fixed','milestone','proration','retainer')),
 reference TEXT NOT NULL, description TEXT NOT NULL, amount_cents INTEGER NOT NULL CHECK(amount_cents BETWEEN 1 AND 100000000),
 currency TEXT NOT NULL DEFAULT 'USD' CHECK(currency='USD'), source_key TEXT NOT NULL UNIQUE,
 retainer_id TEXT REFERENCES b_invoice_retainers(id), period TEXT, authorized_by TEXT NOT NULL,
 authorized_at TEXT NOT NULL, authorization TEXT NOT NULL, UNIQUE(job_id,reference), UNIQUE(retainer_id,period)
);
CREATE UNIQUE INDEX b_invoice_fixed_job ON b_invoice_entitlements(job_id) WHERE kind='fixed';
CREATE TABLE b_invoices(
 id TEXT PRIMARY KEY, client_id TEXT NOT NULL REFERENCES b_clients(id), job_id TEXT NOT NULL REFERENCES b_jobs(id),
 title TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('draft','issued','void')),
 number INTEGER UNIQUE, currency TEXT NOT NULL DEFAULT 'USD' CHECK(currency='USD'),
 snapshot TEXT NOT NULL CHECK(json_valid(snapshot)), subtotal_cents INTEGER NOT NULL,
 tax_cents INTEGER NOT NULL CHECK(tax_cents>=0), credit_cents INTEGER NOT NULL CHECK(credit_cents>=0),
 total_cents INTEGER NOT NULL CHECK(total_cents>=0), revision TEXT NOT NULL,
 owner_email TEXT NOT NULL, issue_date TEXT NOT NULL, due_date TEXT NOT NULL,
 retainer_id TEXT REFERENCES b_invoice_retainers(id), period TEXT,
 prepared_by TEXT NOT NULL, prepared_at TEXT NOT NULL, issued_by TEXT, issued_at TEXT,
 pdf_base64 TEXT, pdf_sha256 TEXT, voided_by TEXT, voided_at TEXT, void_reason TEXT,
 erased_at TEXT, UNIQUE(retainer_id,period), CHECK(status<>'issued' OR number IS NOT NULL)
);
CREATE INDEX b_invoices_client ON b_invoices(client_id,status);
CREATE TABLE b_invoice_sources(
 source_key TEXT PRIMARY KEY, invoice_id TEXT NOT NULL REFERENCES b_invoices(id), job_id TEXT NOT NULL REFERENCES b_jobs(id),
 entitlement_id TEXT REFERENCES b_invoice_entitlements(id)
);
-- Reservations are shared with BILL-001, including a fixed entitlement's fee:<job>.
CREATE TRIGGER b_invoice_source_reserve BEFORE INSERT ON b_invoice_sources
 WHEN EXISTS(SELECT 1 FROM b_export_sources WHERE source_key=NEW.source_key)
 BEGIN SELECT RAISE(ABORT,'source already reserved by billing export'); END;
CREATE TRIGGER b_export_invoice_reserve BEFORE INSERT ON b_export_sources
 WHEN EXISTS(SELECT 1 FROM b_invoice_sources WHERE source_key=NEW.source_key)
 BEGIN SELECT RAISE(ABORT,'source already reserved by invoice'); END;
CREATE TRIGGER b_invoice_sources_release BEFORE DELETE ON b_invoice_sources
 WHEN NOT EXISTS(SELECT 1 FROM b_invoices WHERE id=OLD.invoice_id AND status='void' AND number IS NULL)
 BEGIN SELECT RAISE(ABORT,'issued invoice sources are permanent'); END;
CREATE TRIGGER b_invoice_time_delete BEFORE DELETE ON b_time
 WHEN EXISTS(SELECT 1 FROM b_invoice_sources WHERE source_key='time:'||OLD.id)
 BEGIN SELECT RAISE(ABORT,'invoiced time is immutable'); END;
CREATE TABLE b_invoice_credits(
 id TEXT PRIMARY KEY, client_id TEXT NOT NULL REFERENCES b_clients(id),
 kind TEXT NOT NULL CHECK(kind IN ('deposit','credit')), reference TEXT NOT NULL,
 amount_cents INTEGER NOT NULL CHECK(amount_cents BETWEEN 1 AND 100000000), currency TEXT NOT NULL DEFAULT 'USD' CHECK(currency='USD'),
 reason TEXT NOT NULL, recorded_by TEXT NOT NULL, recorded_at TEXT NOT NULL, UNIQUE(client_id,reference)
);
CREATE TABLE b_invoice_credit_uses(
 id TEXT PRIMARY KEY, invoice_id TEXT NOT NULL REFERENCES b_invoices(id), credit_id TEXT NOT NULL REFERENCES b_invoice_credits(id),
 amount_cents INTEGER NOT NULL CHECK(amount_cents>0)
);
CREATE TRIGGER b_invoice_credit_available BEFORE INSERT ON b_invoice_credit_uses
 WHEN NOT EXISTS(SELECT 1 FROM b_invoice_credits c JOIN b_invoices i ON i.id=NEW.invoice_id WHERE c.id=NEW.credit_id AND c.client_id=i.client_id
 AND NEW.amount_cents<=c.amount_cents-COALESCE((SELECT sum(u.amount_cents) FROM b_invoice_credit_uses u JOIN b_invoices x ON x.id=u.invoice_id WHERE u.credit_id=c.id AND x.status<>'void'),0))
 BEGIN SELECT RAISE(ABORT,'credit is unavailable'); END;
CREATE TABLE b_invoice_deliveries(
 id TEXT PRIMARY KEY, invoice_id TEXT NOT NULL REFERENCES b_invoices(id), contact_id TEXT NOT NULL REFERENCES b_client_contacts(id),
 contact_revision TEXT NOT NULL, recipient_email TEXT NOT NULL, recipient_name TEXT NOT NULL,
 digest TEXT NOT NULL UNIQUE, expires_at TEXT NOT NULL, revoked_at TEXT,
 status TEXT NOT NULL CHECK(status IN ('dispatching','accepted','failed','held')),
 delivery TEXT NOT NULL, subject TEXT NOT NULL, message TEXT NOT NULL,
 sent_by TEXT NOT NULL, sent_at TEXT NOT NULL, resolved_by TEXT, resolved_at TEXT, resolution TEXT
);
CREATE INDEX b_invoice_deliveries_invoice ON b_invoice_deliveries(invoice_id,sent_at);
CREATE TRIGGER b_invoice_document_immutable BEFORE UPDATE ON b_invoices
 WHEN OLD.status IN ('issued','void') AND (NEW.number IS NOT OLD.number OR NEW.snapshot IS NOT OLD.snapshot
 OR NEW.subtotal_cents IS NOT OLD.subtotal_cents OR NEW.tax_cents IS NOT OLD.tax_cents OR NEW.credit_cents IS NOT OLD.credit_cents
 OR NEW.total_cents IS NOT OLD.total_cents OR NEW.currency IS NOT OLD.currency OR NEW.pdf_base64 IS NOT OLD.pdf_base64
 OR NEW.pdf_sha256 IS NOT OLD.pdf_sha256 OR NEW.issue_date IS NOT OLD.issue_date OR NEW.due_date IS NOT OLD.due_date
 OR NEW.issued_at IS NOT OLD.issued_at OR NEW.issued_by IS NOT OLD.issued_by OR NEW.prepared_at IS NOT OLD.prepared_at
 OR NEW.prepared_by IS NOT OLD.prepared_by OR NEW.status NOT IN (OLD.status,'void'))
 BEGIN SELECT RAISE(ABORT,'issued invoice is immutable'); END;
CREATE TRIGGER b_invoice_delete BEFORE DELETE ON b_invoices
 BEGIN SELECT RAISE(ABORT,'invoice history is immutable'); END;

-- A confirmed invoice expiry joins the existing erasure journal/fence.
ALTER TABLE b_expiry_erasures RENAME TO b_expiry_erasures_pre_invoice;
CREATE TABLE b_expiry_erasures(
 id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK(kind IN ('job','engagement','export','invoice')), record_id TEXT NOT NULL, client_id TEXT REFERENCES b_clients(id),
 reason TEXT NOT NULL CHECK(reason<>''), confirmed_by TEXT NOT NULL, confirmed_at TEXT NOT NULL, counts TEXT NOT NULL CHECK(json_valid(counts)), journal_epoch INTEGER NOT NULL,
 UNIQUE(kind,record_id)
);
INSERT INTO b_expiry_erasures SELECT * FROM b_expiry_erasures_pre_invoice;
DROP TABLE b_expiry_erasures_pre_invoice;
