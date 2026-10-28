-- Proposal terms are immutable versions attached to native contact-bound signing.
ALTER TABLE b_signatures ADD COLUMN retention_class TEXT NOT NULL DEFAULT 'signed_documents' CHECK(retention_class IN ('signed_documents','engagement'));
CREATE TABLE b_engagement_proposals(
 id TEXT PRIMARY KEY REFERENCES b_signatures(id),
 root_id TEXT NOT NULL,
 version INTEGER NOT NULL CHECK(version>0),
 predecessor_id TEXT UNIQUE REFERENCES b_engagement_proposals(id),
 superseded_by TEXT REFERENCES b_engagement_proposals(id),
 terms TEXT CHECK(terms IS NULL OR json_valid(terms)),
 created_by TEXT NOT NULL,
 created_at TEXT NOT NULL,
 UNIQUE(root_id,version)
);
CREATE INDEX b_engagement_proposal_root ON b_engagement_proposals(root_id);
CREATE TRIGGER b_engagement_proposal_frozen BEFORE UPDATE OF root_id,version,predecessor_id,created_by,created_at ON b_engagement_proposals
BEGIN SELECT RAISE(ABORT,'immutable proposal version'); END;
