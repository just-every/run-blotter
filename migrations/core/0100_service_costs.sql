-- Prices are the firm's sourced USD estimate, never an invented provider tariff.
CREATE TABLE b_service_prices (
 service TEXT PRIMARY KEY, revision TEXT NOT NULL, unit TEXT NOT NULL,
 included INTEGER NOT NULL CHECK(included>=0), unit_cents INTEGER NOT NULL CHECK(unit_cents>=0),
 basis_points INTEGER NOT NULL CHECK(basis_points>=0 AND basis_points<=10000),
 source TEXT NOT NULL, updated_by TEXT NOT NULL, updated_at TEXT NOT NULL,
 enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1))
);
CREATE TABLE b_service_budget (
 id INTEGER PRIMARY KEY CHECK(id=1), revision TEXT NOT NULL,
 limit_cents INTEGER NOT NULL CHECK(limit_cents>=0), threshold_cents INTEGER NOT NULL CHECK(threshold_cents>=0),
 reason TEXT NOT NULL, updated_by TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE b_service_usage (
 action_id TEXT PRIMARY KEY, service TEXT NOT NULL, price_revision TEXT NOT NULL,
 quantity INTEGER NOT NULL CHECK(quantity>=0), amount_cents INTEGER NOT NULL CHECK(amount_cents>=0),
 estimated_cents INTEGER NOT NULL CHECK(estimated_cents>=0),
 status TEXT NOT NULL CHECK(status IN ('blocked','reserved','confirmed','held')),
 outcome TEXT NOT NULL, owner_email TEXT NOT NULL, created_at TEXT NOT NULL,
 confirmed_cents INTEGER, receipt TEXT, confirmed_by TEXT
);

CREATE TABLE b_service_price_versions (
 revision TEXT PRIMARY KEY, service TEXT NOT NULL, unit TEXT NOT NULL,
 included INTEGER NOT NULL, unit_cents INTEGER NOT NULL, basis_points INTEGER NOT NULL,
 source TEXT NOT NULL, updated_by TEXT NOT NULL, updated_at TEXT NOT NULL
);
