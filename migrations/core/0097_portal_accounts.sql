-- PORTAL-002: signed-in client portal accounts. One account per email address. It opens
-- only the entities whose contact (same address) staff explicitly invited and that stays
-- active, authorized and portal-enabled; every request rechecks that. Sign-in is a one-use
-- emailed link plus a second factor. Sessions, links, codes and factors never leave the
-- installation in an archive.
CREATE TABLE b_portal_accounts(
 id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, status TEXT NOT NULL DEFAULT 'active' CHECK(status IN('active','disabled')),
 totp_sealed TEXT, totp_pending_sealed TEXT, totp_confirmed_at TEXT, totp_last_step INTEGER NOT NULL DEFAULT 0, created_by TEXT NOT NULL, created_at TEXT NOT NULL
);
-- The explicit grant: one invited contact (one entity) for one account.
CREATE TABLE b_portal_grants(
 contact_id TEXT PRIMARY KEY REFERENCES b_client_contacts(id), account_id TEXT NOT NULL REFERENCES b_portal_accounts(id), client_id TEXT NOT NULL REFERENCES b_clients(id),
 invited_by TEXT NOT NULL, invited_at TEXT NOT NULL, accepted_at TEXT, revoked_by TEXT, revoked_at TEXT, revoke_reason TEXT
);
CREATE INDEX b_portal_grants_account ON b_portal_grants(account_id);
CREATE TABLE b_portal_invitations(
 digest TEXT PRIMARY KEY, contact_id TEXT NOT NULL REFERENCES b_client_contacts(id), account_id TEXT NOT NULL REFERENCES b_portal_accounts(id),
 created_by TEXT NOT NULL, created_at TEXT NOT NULL, expires_at TEXT NOT NULL, used_at TEXT
);
CREATE TABLE b_portal_signins(digest TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES b_portal_accounts(id), created_at TEXT NOT NULL, expires_at TEXT NOT NULL, used_at TEXT);
CREATE TABLE b_portal_sessions(
 id TEXT PRIMARY KEY, digest TEXT NOT NULL UNIQUE, account_id TEXT NOT NULL REFERENCES b_portal_accounts(id), created_at TEXT NOT NULL, expires_at TEXT NOT NULL,
 verified_at TEXT, recovered INTEGER NOT NULL DEFAULT 0, revoked_at TEXT
);
CREATE TABLE b_portal_recovery(account_id TEXT NOT NULL REFERENCES b_portal_accounts(id), digest TEXT NOT NULL, used_at TEXT, PRIMARY KEY(account_id,digest));
CREATE TABLE b_portal_failures(account_id TEXT NOT NULL, at TEXT NOT NULL);
-- Firm policy (principal only). With no row the second factor is required.
CREATE TABLE b_portal_policy(id INTEGER PRIMARY KEY CHECK(id=1), mfa_required INTEGER NOT NULL CHECK(mfa_required IN(0,1)), reason TEXT NOT NULL, set_by TEXT NOT NULL, set_at TEXT NOT NULL);
