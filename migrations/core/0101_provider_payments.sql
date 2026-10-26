-- Provider references and bounded client authorization; payment instruments stay at Stripe.
CREATE TABLE b_provider_payments (
 id TEXT PRIMARY KEY, invoice_id TEXT NOT NULL REFERENCES b_invoices(id), client_id TEXT NOT NULL REFERENCES b_clients(id),
 amount_cents INTEGER NOT NULL CHECK(amount_cents>0), state TEXT NOT NULL DEFAULT 'creating', kind TEXT,
 provider_id TEXT UNIQUE, session_id TEXT, customer_id TEXT, mandate_id TEXT, request_key TEXT NOT NULL UNIQUE,
 refunded_cents INTEGER NOT NULL DEFAULT 0, fee_cents INTEGER NOT NULL DEFAULT 0, net_cents INTEGER NOT NULL DEFAULT 0,
 revision TEXT NOT NULL, created_by TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, failure_code TEXT, restored INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX b_provider_invoice ON b_provider_payments(invoice_id);
CREATE TABLE b_payment_mandates (
 id TEXT PRIMARY KEY, invoice_id TEXT NOT NULL REFERENCES b_invoices(id), client_id TEXT NOT NULL REFERENCES b_clients(id),
 contact_id TEXT NOT NULL, contact_revision TEXT NOT NULL, customer_id TEXT, method_id TEXT, kind TEXT, last4 TEXT,
 max_cents INTEGER NOT NULL CHECK(max_cents>0), status TEXT NOT NULL DEFAULT 'pending', authorization TEXT NOT NULL,
 authorized_by TEXT NOT NULL, authorized_at TEXT NOT NULL, revoked_at TEXT
);
CREATE TABLE b_payment_observations (
 id TEXT PRIMARY KEY, payment_id TEXT NOT NULL REFERENCES b_provider_payments(id), state TEXT NOT NULL, net_cents INTEGER NOT NULL,
 fee_cents INTEGER NOT NULL, observed_at TEXT NOT NULL, provider_event_id TEXT
);
CREATE INDEX b_payment_observed ON b_payment_observations(payment_id,observed_at);
CREATE TABLE b_payment_events (
 id TEXT PRIMARY KEY, payment_id TEXT REFERENCES b_provider_payments(id), payload_digest TEXT NOT NULL, event_type TEXT NOT NULL, received_at TEXT NOT NULL
);
