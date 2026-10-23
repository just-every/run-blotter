CREATE TABLE b_agent_rules (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, key_id TEXT NOT NULL REFERENCES b_agent_keys(id),
 client_id TEXT NOT NULL REFERENCES b_clients(id), supervisor_id TEXT NOT NULL,
 supervisor_email TEXT NOT NULL, trigger TEXT NOT NULL,
 starts_at TEXT, every_hours INTEGER CHECK(every_hours>=1),
 tool TEXT NOT NULL, due_date TEXT, due_note TEXT,
 budget INTEGER NOT NULL CHECK(budget>=1), used INTEGER NOT NULL DEFAULT 0,
 after_seq INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'active', created_at TEXT NOT NULL,
 data_scope TEXT NOT NULL DEFAULT 'job metadata and outstanding request labels only',
 model_policy TEXT NOT NULL DEFAULT 'Native deterministic planner; no model or external provider is called. No training or provider retention. References and plans retained under firm erasure/hold policy.'
);
CREATE TABLE b_agent_runs (
 id TEXT PRIMARY KEY, rule_id TEXT NOT NULL REFERENCES b_agent_rules(id),
 event_key TEXT NOT NULL, job_id TEXT NOT NULL REFERENCES b_jobs(id),
 proposal_id TEXT, status TEXT NOT NULL DEFAULT 'pending', outcome TEXT NOT NULL DEFAULT '',
 cost_cents INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, UNIQUE(rule_id,event_key,job_id)
);
CREATE TRIGGER b_agent_question_event AFTER INSERT ON b_portal_items WHEN NEW.kind='question'
BEGIN INSERT OR IGNORE INTO b_automation_events(source,job_id,kind,at) VALUES('question:'||NEW.id,NEW.job_id,'question',NEW.created_at); END;
