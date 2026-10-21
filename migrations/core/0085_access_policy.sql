-- Explicit per-person scopes preserve existing staff authority until configured.
-- A scoped person with no grants has no client access. Removing a team does
-- not restore legacy firm-wide authority.
CREATE TABLE b_access_policy(id INTEGER PRIMARY KEY CHECK(id=1),revision TEXT NOT NULL);
CREATE TABLE b_access_members(email TEXT PRIMARY KEY,scoped INTEGER NOT NULL DEFAULT 1 CHECK(scoped=1),read_only INTEGER NOT NULL DEFAULT 0 CHECK(read_only IN(0,1)));
CREATE TABLE b_access_teams(id TEXT PRIMARY KEY,name TEXT NOT NULL UNIQUE);
CREATE TABLE b_access_team_members(team_id TEXT NOT NULL REFERENCES b_access_teams(id) ON DELETE CASCADE,email TEXT NOT NULL,PRIMARY KEY(team_id,email));
CREATE TABLE b_access_team_clients(team_id TEXT NOT NULL REFERENCES b_access_teams(id) ON DELETE CASCADE,client_id TEXT NOT NULL REFERENCES b_clients(id),PRIMARY KEY(team_id,client_id));
CREATE TABLE b_access_grants(email TEXT NOT NULL,client_id TEXT NOT NULL REFERENCES b_clients(id),PRIMARY KEY(email,client_id));
CREATE VIEW b_access_effective AS SELECT email,client_id FROM b_access_grants UNION SELECT m.email,c.client_id FROM b_access_team_members m JOIN b_access_team_clients c ON c.team_id=m.team_id;
CREATE TABLE b_sensitive_documents(file_key TEXT PRIMARY KEY,classification TEXT NOT NULL,reason TEXT NOT NULL,updated_by TEXT NOT NULL,updated_at TEXT NOT NULL);
CREATE TABLE b_sensitive_grants(file_key TEXT NOT NULL REFERENCES b_sensitive_documents(file_key) ON DELETE CASCADE,email TEXT NOT NULL,PRIMARY KEY(file_key,email));
CREATE TABLE b_access_stepups(session_id TEXT PRIMARY KEY,email TEXT NOT NULL,method TEXT NOT NULL,verified_at TEXT NOT NULL);
