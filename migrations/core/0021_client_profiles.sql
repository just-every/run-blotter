-- Client groups, tags and firm-defined fields (CRM-002). Field values and tags
-- live on the client row as JSON, so imports, undo and archives carry them with
-- the client. Additive only, so older archives still restore.
ALTER TABLE b_clients ADD COLUMN fields TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(fields) AND json_type(fields)='object');
ALTER TABLE b_clients ADD COLUMN tags TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(tags) AND json_type(tags)='array');
CREATE TABLE b_client_fields(
 key TEXT PRIMARY KEY CHECK(length(key) BETWEEN 1 AND 40), label TEXT NOT NULL,
 type TEXT NOT NULL CHECK(type IN ('text','number','date','choice')), choices TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(choices)),
 required INTEGER NOT NULL CHECK(required IN (0,1)), created_by TEXT NOT NULL, created_at TEXT NOT NULL,
 CHECK(type<>'choice' OR json_array_length(choices)>0)
);
CREATE TABLE b_client_groups(
 id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, created_by TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE b_client_group_members(
 group_id TEXT NOT NULL REFERENCES b_client_groups(id), client_id TEXT NOT NULL,
 relationship TEXT NOT NULL CHECK(relationship IN ('parent','subsidiary','household','member')),
 added_by TEXT NOT NULL, added_at TEXT NOT NULL, PRIMARY KEY(group_id,client_id)
);
CREATE INDEX b_client_group_members_client ON b_client_group_members(client_id);
