-- Enterprise policy is optional; the principal always retains native recovery.
CREATE TABLE b_enterprise_connection(id INTEGER PRIMARY KEY CHECK(id=1),tenant TEXT NOT NULL,required INTEGER NOT NULL CHECK(required IN(0,1)),require_mfa INTEGER NOT NULL CHECK(require_mfa IN(0,1)),active INTEGER NOT NULL CHECK(active IN(0,1)),revision INTEGER NOT NULL DEFAULT 1,token_digest TEXT);
CREATE TABLE b_enterprise_identities(id TEXT PRIMARY KEY,email TEXT NOT NULL UNIQUE,subject TEXT NOT NULL UNIQUE,active INTEGER NOT NULL DEFAULT 1 CHECK(active IN(0,1)));
CREATE TABLE b_enterprise_groups(id TEXT PRIMARY KEY,display_name TEXT NOT NULL);
CREATE TABLE b_enterprise_group_members(group_id TEXT NOT NULL REFERENCES b_enterprise_groups(id) ON DELETE CASCADE,identity_id TEXT NOT NULL REFERENCES b_enterprise_identities(id) ON DELETE CASCADE,PRIMARY KEY(group_id,identity_id));
CREATE TABLE b_enterprise_mappings(group_id TEXT PRIMARY KEY,role TEXT NOT NULL CHECK(role IN('preparer','reviewer')),team_id TEXT REFERENCES b_access_teams(id));
CREATE TABLE b_enterprise_team_grants(team_id TEXT NOT NULL,email TEXT NOT NULL,PRIMARY KEY(team_id,email));
CREATE TABLE b_enterprise_sessions(session_id TEXT PRIMARY KEY,identity_id TEXT NOT NULL REFERENCES b_enterprise_identities(id),revision INTEGER NOT NULL,mfa INTEGER NOT NULL CHECK(mfa IN(0,1)));
