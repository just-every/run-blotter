-- Sourced deadline rules, firm-defined rules, imported source revisions and
-- per-job calculated dates (DUE-001, DUE-003).
CREATE TABLE b_deadline_rules(
 key TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK(kind IN ('agency','firm')),
 definition TEXT NOT NULL CHECK(json_valid(definition)), version TEXT NOT NULL, effective TEXT NOT NULL,
 source_url TEXT NOT NULL, source_title TEXT NOT NULL, revision_id TEXT,
 approved_by TEXT NOT NULL, approved_at TEXT NOT NULL
);
CREATE TABLE b_deadline_revisions(
 id TEXT PRIMARY KEY, version TEXT NOT NULL UNIQUE, effective TEXT NOT NULL, source_url TEXT NOT NULL, source_title TEXT NOT NULL,
 document TEXT NOT NULL CHECK(json_valid(document)), affected_jobs INTEGER NOT NULL, approved_by TEXT NOT NULL, approved_at TEXT NOT NULL
);
CREATE TABLE b_deadline_relief(
 id TEXT PRIMARY KEY, revision_id TEXT NOT NULL REFERENCES b_deadline_revisions(id), title TEXT NOT NULL, jurisdiction TEXT NOT NULL,
 states TEXT NOT NULL CHECK(json_valid(states)), rule_keys TEXT NOT NULL CHECK(json_valid(rule_keys)),
 from_date TEXT NOT NULL, to_date TEXT NOT NULL, postponed_to TEXT NOT NULL, source_url TEXT NOT NULL
);
CREATE TABLE b_client_obligations(
 id TEXT PRIMARY KEY, client_id TEXT NOT NULL REFERENCES b_clients(id), rule_key TEXT NOT NULL REFERENCES b_deadline_rules(key),
 state TEXT NOT NULL CHECK(length(state)=2), fiscal_year_end INTEGER NOT NULL CHECK(fiscal_year_end BETWEEN 1 AND 12),
 internal_days INTEGER NOT NULL DEFAULT 0 CHECK(internal_days BETWEEN 0 AND 90), created_by TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE INDEX b_client_obligations_client ON b_client_obligations(client_id);
CREATE TABLE b_job_deadlines(
 job_id TEXT PRIMARY KEY REFERENCES b_jobs(id), obligation_id TEXT NOT NULL REFERENCES b_client_obligations(id),
 rule_key TEXT NOT NULL, rule_version TEXT NOT NULL, source_url TEXT NOT NULL, source_title TEXT NOT NULL, period_end TEXT NOT NULL,
 statutory_due TEXT NOT NULL, original_due TEXT NOT NULL, shift_note TEXT NOT NULL DEFAULT '',
 extension_form TEXT, extension_due TEXT, extension_automatic INTEGER NOT NULL DEFAULT 0,
 extension_recorded_by TEXT, extension_recorded_at TEXT,
 relief_id TEXT, relief_due TEXT, internal_due TEXT NOT NULL,
 override_due TEXT, override_reason TEXT, override_by TEXT, override_at TEXT,
 filing_submission_id TEXT, filing_file_id TEXT REFERENCES b_files(id), filing_accepted_on TEXT, filing_recorded_by TEXT, filing_recorded_at TEXT
);
-- WORK-002 recurrence rules may take each period's due date from a client obligation.
ALTER TABLE b_recurrence_rules ADD COLUMN obligation_id TEXT REFERENCES b_client_obligations(id);
