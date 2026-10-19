ALTER TABLE b_templates ADD COLUMN starter_content TEXT;
ALTER TABLE b_jobs ADD COLUMN starter_content TEXT;
CREATE TABLE b_starter_adoptions(
 id TEXT PRIMARY KEY, library_id TEXT NOT NULL, version INTEGER NOT NULL,
 template_id TEXT NOT NULL UNIQUE REFERENCES b_templates(id), baseline TEXT NOT NULL CHECK(json_valid(baseline)),
 revision TEXT NOT NULL, adopted_by TEXT NOT NULL, adopted_at TEXT NOT NULL
);
CREATE TABLE b_starter_releases(
 library_id TEXT NOT NULL, version INTEGER NOT NULL, snapshot TEXT NOT NULL CHECK(json_valid(snapshot)),
 source TEXT NOT NULL, published_by TEXT NOT NULL, published_at TEXT NOT NULL,
 PRIMARY KEY(library_id,version)
);
CREATE TRIGGER b_starter_release_immutable BEFORE UPDATE ON b_starter_releases BEGIN SELECT RAISE(ABORT,'library releases are immutable'); END;
CREATE TRIGGER b_starter_release_retained BEFORE DELETE ON b_starter_releases BEGIN SELECT RAISE(ABORT,'library releases are retained'); END;
