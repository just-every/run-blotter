-- Reviewed source bindings contain native mappings, never source credentials or file bytes.
CREATE TABLE b_recurrence_imports(
 id TEXT PRIMARY KEY, source TEXT NOT NULL, practice_id TEXT NOT NULL, series_id TEXT NOT NULL,
 definition TEXT NOT NULL CHECK(json_valid(definition)), owner_email TEXT NOT NULL,
 disposition TEXT NOT NULL CHECK(disposition IN ('held','mapped')), reason TEXT NOT NULL,
 rule_id TEXT REFERENCES b_recurrence_rules(id), revision TEXT NOT NULL,
 created_by TEXT NOT NULL, created_at TEXT NOT NULL, updated_by TEXT NOT NULL, updated_at TEXT NOT NULL,
 UNIQUE(source,practice_id,series_id), UNIQUE(rule_id),
 CHECK((disposition='mapped')=(rule_id IS NOT NULL))
);
CREATE TABLE b_recurrence_import_items(
 import_id TEXT NOT NULL REFERENCES b_recurrence_imports(id), source TEXT NOT NULL, practice_id TEXT NOT NULL,
 item_id TEXT NOT NULL, job_id TEXT NOT NULL REFERENCES b_jobs(id), period_start TEXT NOT NULL,
 PRIMARY KEY(source,practice_id,item_id), UNIQUE(import_id,period_start), UNIQUE(job_id)
);
