-- WORK-007: each person's saved queue views (work type, stage, sub-status),
-- and an optional client-facing label per sub-status for the client link
-- (PORTAL-003). Additive only.
CREATE TABLE b_saved_views(
 id TEXT PRIMARY KEY, owner_email TEXT NOT NULL, name TEXT NOT NULL,
 filters TEXT NOT NULL CHECK(json_valid(filters)), created_at TEXT NOT NULL, UNIQUE(owner_email,name)
);
ALTER TABLE b_sub_statuses ADD COLUMN client_label TEXT CHECK(client_label IS NULL OR length(client_label) BETWEEN 1 AND 80);
