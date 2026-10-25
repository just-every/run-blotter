-- Reviewed setup plans record human decisions, never outbound authority.
CREATE TABLE b_onboarding_plans(
 id TEXT PRIMARY KEY,
 client_id TEXT NOT NULL REFERENCES b_clients(id),
 source_kind TEXT NOT NULL CHECK(source_kind IN ('engagement','signature')),
 source_id TEXT NOT NULL,
 fingerprint TEXT NOT NULL,
 plan TEXT NOT NULL CHECK(json_valid(plan)),
 selection TEXT NOT NULL CHECK(json_valid(selection)),
 progress TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(progress)),
 status TEXT NOT NULL DEFAULT 'reviewed' CHECK(status IN ('reviewed','held')),
 decided_by TEXT NOT NULL,
 decision_reason TEXT NOT NULL,
 decided_at TEXT NOT NULL,
 revision TEXT NOT NULL,
 UNIQUE(client_id,source_kind,source_id)
);
