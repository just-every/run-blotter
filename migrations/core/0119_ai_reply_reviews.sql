ALTER TABLE b_ai_requests ADD COLUMN source_fingerprint TEXT;
CREATE TABLE b_ai_reply_reviews (
 id TEXT PRIMARY KEY,
 draft_id TEXT NOT NULL UNIQUE REFERENCES b_ai_drafts(id) ON DELETE CASCADE,
 decision_id TEXT NOT NULL UNIQUE REFERENCES b_ai_decisions(id) ON DELETE CASCADE,
 actor_id TEXT NOT NULL,
 intent_sha256 TEXT NOT NULL,
 text_sha256 TEXT NOT NULL,
 source_fingerprint TEXT NOT NULL,
 recipients TEXT NOT NULL,
 attachments TEXT NOT NULL,
 reviewed_by TEXT NOT NULL,
 reviewed_at TEXT NOT NULL,
 restored INTEGER NOT NULL DEFAULT 0 CHECK(restored IN (0,1))
);
