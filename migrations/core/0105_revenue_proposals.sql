-- Derived assistance only. Approval cannot sign, send, collect or write off.
CREATE TABLE b_revenue_proposals (
 id TEXT PRIMARY KEY,
 client_id TEXT NOT NULL REFERENCES b_clients(id),
 job_id TEXT NOT NULL REFERENCES b_jobs(id),
 plan_id TEXT NOT NULL REFERENCES b_onboarding_plans(id),
 exception_id TEXT NOT NULL,
 fingerprint TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('amendment','duplicate')),
 payload TEXT NOT NULL CHECK(json_valid(payload)),
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','declined','held')),
 prepared_by TEXT NOT NULL, created_at TEXT NOT NULL,
 decided_by TEXT, decided_at TEXT, decision_note TEXT,
 UNIQUE(client_id,plan_id,exception_id,fingerprint)
);
