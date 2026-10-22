-- ACCESS-002: the principal may grant a named member two published permissions.
-- Each grant is audited and live: every request reads this table, and the grant
-- bumps the access revision so concurrent writes of the old holder fail.
CREATE TABLE b_access_delegations(
 email TEXT NOT NULL, permission TEXT NOT NULL CHECK(permission IN('manage_access','financial_authority')),
 reason TEXT NOT NULL, granted_by TEXT NOT NULL, granted_at TEXT NOT NULL, PRIMARY KEY(email,permission)
);
