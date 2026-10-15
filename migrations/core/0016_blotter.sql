-- Blotter practice workflow. Money is integer AUD cents; dates are YYYY-MM-DD.
-- Due dates are recorded by people, never computed.
CREATE TABLE b_members(
 email TEXT PRIMARY KEY, name TEXT NOT NULL,
 role TEXT NOT NULL CHECK(role IN ('reviewer','preparer')), active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1))
);
-- Hourly rates, including the principal's. Time entries snapshot the rate in force.
CREATE TABLE b_rates(
 email TEXT PRIMARY KEY, rate_cents INTEGER NOT NULL CHECK(rate_cents BETWEEN 0 AND 1000000),
 updated_by TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE b_guard(id TEXT PRIMARY KEY, ok INTEGER NOT NULL CHECK(ok=1));
CREATE TABLE b_meta(id INTEGER PRIMARY KEY CHECK(id=1), client_revision INTEGER NOT NULL DEFAULT 0);
INSERT INTO b_meta(id) VALUES(1);

CREATE TABLE b_clients(
 id TEXT PRIMARY KEY, name TEXT NOT NULL, abn TEXT NOT NULL DEFAULT '',
 contact_name TEXT NOT NULL DEFAULT '', contact_email TEXT NOT NULL DEFAULT '',
 source TEXT NOT NULL DEFAULT 'native', revision TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TRIGGER b_client_insert AFTER INSERT ON b_clients BEGIN UPDATE b_meta SET client_revision=client_revision+1 WHERE id=1; END;
CREATE TRIGGER b_client_update AFTER UPDATE ON b_clients BEGIN UPDATE b_meta SET client_revision=client_revision+1 WHERE id=1; END;
CREATE TRIGGER b_client_delete AFTER DELETE ON b_clients BEGIN UPDATE b_meta SET client_revision=client_revision+1 WHERE id=1; END;

CREATE TABLE b_templates(
 id TEXT PRIMARY KEY, name TEXT NOT NULL,
 recurrence TEXT NOT NULL CHECK(recurrence IN ('monthly','quarterly','annual')),
 steps TEXT NOT NULL CHECK(json_valid(steps)), requests TEXT NOT NULL CHECK(json_valid(requests)),
 fee_cents INTEGER NOT NULL DEFAULT 0 CHECK(fee_cents BETWEEN 0 AND 100000000),
 created_by TEXT NOT NULL, created_at TEXT NOT NULL
);

CREATE TABLE b_jobs(
 id TEXT PRIMARY KEY, client_id TEXT NOT NULL REFERENCES b_clients(id), template_id TEXT NOT NULL REFERENCES b_templates(id),
 title TEXT NOT NULL, period_start TEXT NOT NULL, period_label TEXT NOT NULL,
 due_date TEXT NOT NULL, due_note TEXT NOT NULL,
 preparer_email TEXT NOT NULL, reviewer_email TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('open','review','signed_off')),
 fee_cents INTEGER NOT NULL CHECK(fee_cents BETWEEN 0 AND 100000000),
 rolled_from TEXT REFERENCES b_jobs(id), revision TEXT NOT NULL,
 created_by TEXT NOT NULL, created_channel TEXT NOT NULL CHECK(created_channel IN ('person','agent')), created_at TEXT NOT NULL,
 submitted_by TEXT, submitted_at TEXT, signed_off_by TEXT, signed_off_at TEXT, sign_off_note TEXT,
 UNIQUE(client_id,template_id,period_start),
 CHECK(status<>'signed_off' OR (signed_off_by IS NOT NULL AND sign_off_note IS NOT NULL))
);
CREATE INDEX b_jobs_due ON b_jobs(due_date);
CREATE TRIGGER b_jobs_transition BEFORE UPDATE OF status ON b_jobs
 WHEN NEW.status<>OLD.status AND NOT ((OLD.status='open' AND NEW.status='review') OR (OLD.status='review' AND NEW.status IN ('open','signed_off')))
 BEGIN SELECT RAISE(ABORT,'invalid job transition'); END;
CREATE TRIGGER b_jobs_signed_off BEFORE UPDATE ON b_jobs WHEN OLD.status='signed_off'
 BEGIN SELECT RAISE(ABORT,'signed-off jobs are immutable'); END;
CREATE TRIGGER b_jobs_delete BEFORE DELETE ON b_jobs BEGIN SELECT RAISE(ABORT,'job history is immutable'); END;

CREATE TABLE b_job_steps(
 job_id TEXT NOT NULL REFERENCES b_jobs(id), ordinal INTEGER NOT NULL, label TEXT NOT NULL,
 done_by TEXT, done_at TEXT, PRIMARY KEY(job_id,ordinal)
);
CREATE TABLE b_requests(
 id TEXT PRIMARY KEY, job_id TEXT NOT NULL REFERENCES b_jobs(id), ordinal INTEGER NOT NULL, label TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('requested','received','accepted')),
 note TEXT NOT NULL DEFAULT '', updated_by TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(job_id,ordinal)
);
-- Base64 expands the 1 MiB byte cap to at most 1,398,104 characters. Erasure
-- removes bytes only; names, hashes and provenance remain.
CREATE TABLE b_files(
 id TEXT PRIMARY KEY, request_id TEXT NOT NULL REFERENCES b_requests(id), job_id TEXT NOT NULL REFERENCES b_jobs(id),
 name TEXT NOT NULL, mime TEXT NOT NULL, size INTEGER NOT NULL CHECK(size BETWEEN 1 AND 1048576), sha256 TEXT NOT NULL,
 content_base64 TEXT CHECK(length(content_base64)<=1398104),
 uploaded_by TEXT NOT NULL, channel TEXT NOT NULL CHECK(channel IN ('portal','person')), uploaded_at TEXT NOT NULL,
 erased_at TEXT, erased_by TEXT, erase_reason TEXT
);
CREATE INDEX b_files_job ON b_files(job_id);
CREATE TRIGGER b_files_immutable BEFORE UPDATE ON b_files
 WHEN NEW.id IS NOT OLD.id OR NEW.request_id IS NOT OLD.request_id OR NEW.job_id IS NOT OLD.job_id OR NEW.name IS NOT OLD.name
 OR NEW.mime IS NOT OLD.mime OR NEW.size IS NOT OLD.size OR NEW.sha256 IS NOT OLD.sha256 OR NEW.uploaded_by IS NOT OLD.uploaded_by
 OR NEW.channel IS NOT OLD.channel OR NEW.uploaded_at IS NOT OLD.uploaded_at OR NEW.content_base64 IS NOT NULL OR OLD.erased_at IS NOT NULL
 BEGIN SELECT RAISE(ABORT,'uploaded files are immutable'); END;
CREATE TRIGGER b_files_delete BEFORE DELETE ON b_files BEGIN SELECT RAISE(ABORT,'uploaded files are immutable'); END;

-- Client upload links: only a digest of the secret is stored. Not archived.
CREATE TABLE b_portal_links(
 id TEXT PRIMARY KEY, job_id TEXT NOT NULL REFERENCES b_jobs(id), digest TEXT NOT NULL UNIQUE,
 created_by TEXT NOT NULL, created_at TEXT NOT NULL, expires_at TEXT NOT NULL, revoked_at TEXT
);
CREATE TABLE b_reminders(
 id TEXT PRIMARY KEY, job_id TEXT NOT NULL REFERENCES b_jobs(id), to_email TEXT NOT NULL,
 outstanding TEXT NOT NULL CHECK(json_valid(outstanding)), message TEXT NOT NULL,
 delivery TEXT NOT NULL, sent_by TEXT NOT NULL, proposal_id TEXT, sent_at TEXT NOT NULL
);

CREATE TABLE b_time(
 id TEXT PRIMARY KEY, job_id TEXT NOT NULL REFERENCES b_jobs(id), person_email TEXT NOT NULL,
 date TEXT NOT NULL, minutes INTEGER NOT NULL CHECK(minutes BETWEEN 1 AND 1440),
 rate_cents INTEGER NOT NULL CHECK(rate_cents BETWEEN 0 AND 1000000), amount_cents INTEGER NOT NULL CHECK(amount_cents>=0),
 description TEXT NOT NULL, created_by TEXT NOT NULL, created_channel TEXT NOT NULL CHECK(created_channel IN ('person','agent')), created_at TEXT NOT NULL
);
CREATE INDEX b_time_job ON b_time(job_id,date);
CREATE TRIGGER b_time_immutable BEFORE UPDATE ON b_time BEGIN SELECT RAISE(ABORT,'time entries are immutable'); END;

CREATE TABLE b_exports(
 id TEXT PRIMARY KEY, title TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('draft','approved','void')),
 snapshot TEXT NOT NULL CHECK(json_valid(snapshot)), total_cents INTEGER NOT NULL,
 csv TEXT, csv_sha256 TEXT, revision TEXT NOT NULL,
 prepared_by TEXT NOT NULL, prepared_channel TEXT NOT NULL CHECK(prepared_channel IN ('person','agent')), prepared_at TEXT NOT NULL,
 approved_by TEXT, approved_at TEXT, review_note TEXT, voided_by TEXT, voided_at TEXT, void_reason TEXT,
 CHECK(status<>'approved' OR (csv IS NOT NULL AND csv_sha256 IS NOT NULL AND approved_by IS NOT NULL AND review_note IS NOT NULL))
);
-- One export per billable source: 'time:<id>' or 'fee:<job id>'.
CREATE TABLE b_export_sources(source_key TEXT PRIMARY KEY, export_id TEXT NOT NULL REFERENCES b_exports(id));
CREATE TRIGGER b_exports_transition BEFORE UPDATE ON b_exports
 WHEN NOT (OLD.status='draft' AND NEW.status IN ('approved','void'))
 OR NEW.snapshot<>OLD.snapshot OR NEW.total_cents<>OLD.total_cents OR NEW.prepared_by<>OLD.prepared_by OR NEW.prepared_at<>OLD.prepared_at
 BEGIN SELECT RAISE(ABORT,'approved exports are immutable'); END;
CREATE TRIGGER b_exports_delete BEFORE DELETE ON b_exports BEGIN SELECT RAISE(ABORT,'export history is immutable'); END;
CREATE TRIGGER b_export_sources_release BEFORE DELETE ON b_export_sources
 WHEN NOT EXISTS(SELECT 1 FROM b_exports WHERE id=OLD.export_id AND status='void')
 BEGIN SELECT RAISE(ABORT,'only void exports release sources'); END;
CREATE TRIGGER b_time_delete BEFORE DELETE ON b_time
 WHEN EXISTS(SELECT 1 FROM b_export_sources WHERE source_key='time:'||OLD.id)
 BEGIN SELECT RAISE(ABORT,'exported time is immutable'); END;

CREATE TABLE b_audit(id TEXT PRIMARY KEY, actor TEXT NOT NULL, action TEXT NOT NULL, object_id TEXT NOT NULL, detail TEXT NOT NULL, at TEXT NOT NULL);
CREATE TABLE b_agent_keys(id TEXT PRIMARY KEY, label TEXT NOT NULL, digest TEXT NOT NULL UNIQUE, owner_id TEXT NOT NULL, revoked INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
CREATE TABLE b_proposals(
 id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK(kind IN ('rollforward','reminder','export')), payload TEXT NOT NULL CHECK(json_valid(payload)),
 for_email TEXT NOT NULL, agent_label TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','declined')),
 result_id TEXT, decided_by TEXT, decided_at TEXT, decision_note TEXT, created_at TEXT NOT NULL
);
