-- Prospects and the onboarding pipeline (CRM-005, first slice). The firm's
-- stages are ordered; each is open, won or lost. Inquiry, Consult booked,
-- Proposal sent, Won and Lost are built in (in code); this table holds the
-- open stages the firm adds. A prospect carries its lead
-- source, requested services, estimated annual fees (integer cents) and owner,
-- and every stage change is kept for stage age. Winning converts it into
-- exactly one client (client_id is unique) with its onboarding job; a lost
-- prospect keeps its reason. Additive only.
CREATE TABLE b_prospect_stages(
 id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, position INTEGER NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('open','won','lost')),
 created_by TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE b_prospects(
 id TEXT PRIMARY KEY, name TEXT NOT NULL, contact_name TEXT NOT NULL, contact_email TEXT NOT NULL,
 source TEXT NOT NULL, services TEXT NOT NULL CHECK(json_valid(services)), fee_cents INTEGER NOT NULL CHECK(fee_cents BETWEEN 0 AND 100000000),
 owner_email TEXT NOT NULL, stage_id TEXT NOT NULL, stage_since TEXT NOT NULL,
 answers TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(answers)), lost_reason TEXT,
 client_id TEXT UNIQUE REFERENCES b_clients(id), onboarding_job_id TEXT REFERENCES b_jobs(id),
 created_by TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE b_prospect_events(
 id TEXT PRIMARY KEY, prospect_id TEXT NOT NULL REFERENCES b_prospects(id), from_stage TEXT, to_stage TEXT NOT NULL,
 note TEXT NOT NULL DEFAULT '', by_email TEXT NOT NULL, at TEXT NOT NULL
);
CREATE INDEX b_prospect_events_prospect ON b_prospect_events(prospect_id,at);
