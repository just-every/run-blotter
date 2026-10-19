-- Enforced staff multi-factor authentication (ACCESS-004). The principal can
-- require a second factor for every staff session. A factor is a TOTP
-- authenticator (its secret sealed under a key derived from SESSION_SECRET)
-- or a passkey/security key (its public key and signature counter); one-time
-- recovery codes are stored only as digests. A session counts as
-- verified only after its own second-factor check. Factors, recovery codes,
-- verified sessions, challenges and failures stay out of every archive. The
-- policy row also holds the firm's session lifetime and idle timeout, in
-- minutes (NULL keeps sign-in's own limit); last activity is kept per session.
CREATE TABLE b_mfa_policy(
 id INTEGER PRIMARY KEY CHECK(id=1), required INTEGER NOT NULL DEFAULT 0 CHECK(required IN (0,1)),
 session_minutes INTEGER CHECK(session_minutes IS NULL OR session_minutes BETWEEN 1 AND 43200),
 idle_minutes INTEGER CHECK(idle_minutes IS NULL OR idle_minutes BETWEEN 1 AND 1440),
 set_by TEXT NOT NULL, set_at TEXT NOT NULL
);
CREATE TABLE b_session_activity(session_id TEXT PRIMARY KEY, seen_at INTEGER NOT NULL);
CREATE TABLE b_mfa_factors(
 id TEXT PRIMARY KEY, email TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('totp','passkey')), label TEXT NOT NULL,
 sealed_secret TEXT, last_step INTEGER NOT NULL DEFAULT 0,
 credential_id TEXT UNIQUE, public_key TEXT CHECK(public_key IS NULL OR json_valid(public_key)), sign_count INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL, confirmed_at TEXT, last_used_at TEXT,
 CHECK((kind='totp' AND sealed_secret IS NOT NULL) OR (kind='passkey' AND credential_id IS NOT NULL AND public_key IS NOT NULL))
);
CREATE INDEX b_mfa_factors_email ON b_mfa_factors(email);
CREATE TABLE b_mfa_recovery(
 email TEXT NOT NULL, digest TEXT NOT NULL, created_at TEXT NOT NULL, used_at TEXT, PRIMARY KEY(email,digest)
);
CREATE TABLE b_mfa_sessions(
 session_id TEXT PRIMARY KEY, email TEXT NOT NULL, method TEXT NOT NULL, verified_at TEXT NOT NULL
);
CREATE INDEX b_mfa_sessions_email ON b_mfa_sessions(email);
CREATE TABLE b_mfa_challenges(
 id TEXT PRIMARY KEY, email TEXT NOT NULL, session_id TEXT NOT NULL, purpose TEXT NOT NULL CHECK(purpose IN ('register','verify')),
 challenge TEXT NOT NULL, expires_at TEXT NOT NULL
);
CREATE INDEX b_mfa_challenges_session ON b_mfa_challenges(session_id,purpose);
CREATE TABLE b_mfa_failures(id TEXT PRIMARY KEY, email TEXT NOT NULL, at TEXT NOT NULL);
CREATE INDEX b_mfa_failures_email ON b_mfa_failures(email,at);
