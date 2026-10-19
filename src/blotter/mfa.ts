// Enforced staff multi-factor authentication (ACCESS-004). The principal can
// require a second factor for every staff session, whatever the sign-in
// method. Each session must pass its own check (a TOTP code, a passkey or a
// one-time recovery code) before any practice data, so sessions from before the policy
// step up too. Agent keys stop working while their owner lacks a factor. The
// principal resets a member's factors, which revokes all of their sessions.
import { atomic, audit, digest, email, Fault, human, id, insist, integer, need, now, rows, stmt, text, type Actor, type Data } from './model';
import { b64url, verifyAssertion, verifyRegistration } from './webauthn';

/** The installation's session secret (sealing TOTP secrets) and origin (the passkey relying party). */
export type Site = { secret: string; origin: string };
const rpId = (site: Site) => new URL(site.origin).hostname;

const STEP_SECONDS = 30, DIGITS = 6, FAILURES = 5, LOCK_MINUTES = 15, RECOVERY_CODES = 10;
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32(bytes: Uint8Array) {
  let bits = 0, value = 0, out = '';
  for (const byte of bytes) { value = (value << 8) | byte; bits += 8; while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5; } }
  return bits > 0 ? out + B32[(value << (5 - bits)) & 31] : out;
}
function unbase32(text: string) {
  const out: number[] = [];
  let bits = 0, value = 0;
  for (const c of text.replace(/=+$/, '')) { value = (value << 5) | B32.indexOf(c); bits += 5; if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; } }
  return new Uint8Array(out);
}
/** RFC 6238 TOTP: HMAC-SHA-1, 30-second steps, 6 digits. */
async function totp(secret: string, step: number) {
  const key = await crypto.subtle.importKey('raw', unbase32(secret), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const counter = new Uint8Array(8);
  for (let i = 7, n = step; i >= 0; i--, n = Math.floor(n / 256)) counter[i] = n & 255;
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, counter)), o = mac[19] & 15;
  return String((((mac[o] & 127) << 24) | (mac[o + 1] << 16) | (mac[o + 2] << 8) | mac[o + 3]) % 10 ** DIGITS).padStart(DIGITS, '0');
}

/** TOTP secrets are sealed with AES-GCM under a key derived from the installation's SESSION_SECRET. */
async function sealing(sessionSecret: string) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(sessionSecret), 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(32), info: new TextEncoder().encode('blotter-mfa-totp') }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
async function seal(sessionSecret: string, value: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await sealing(sessionSecret), new TextEncoder().encode(value)));
  return btoa(String.fromCharCode(...iv, ...sealed));
}
async function unseal(sessionSecret: string, value: string) {
  const bytes = Uint8Array.from(atob(value), c => c.charCodeAt(0));
  return new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.slice(0, 12) }, await sealing(sessionSecret), bytes.slice(12)));
}

const policy = async (db: D1Database) => await stmt(db, 'SELECT * FROM b_mfa_policy WHERE id=1').first<Data>();
const policyOn = async (db: D1Database) => !!(await policy(db))?.required;
const factorCount = async (db: D1Database, address: string) => Number((await stmt(db, 'SELECT COUNT(*) n FROM b_mfa_factors WHERE email=? AND confirmed_at IS NOT NULL', address).first<Data>())!.n);
const verifiedSession = async (db: D1Database, sessionId: string) => !!await stmt(db, 'SELECT 1 FROM b_mfa_sessions WHERE session_id=?', sessionId).first();

/**
 * The gate every person door passes. A second factor is required when the firm
 * policy is on or the person has enrolled one; then the person must enroll,
 * and every session must be verified on its own. `open` lets only the
 * enrollment and verification doors through.
 */
export async function mfaGate(db: D1Database, actor: Actor, open: boolean) {
  const rules = await policy(db);
  if (rules) await sessionLimits(db, actor, rules);
  const factors = await factorCount(db, actor.email);
  if (!factors && !rules?.required) return;
  if (open) return;
  if (!factors) throw new Fault('Set up a second factor before you continue: the practice requires one', 403, { mfa: 'enroll' });
  if (!await verifiedSession(db, actor.sessionId!)) throw new Fault('Confirm your second factor to continue', 403, { mfa: 'verify' });
}
/** The firm's session lifetime (from sign-in) and idle timeout (since the session's last request) end a session for good. */
async function sessionLimits(db: D1Database, actor: Actor, rules: Data) {
  const at = Date.now(), sid = actor.sessionId!;
  const seen = rules.idle_minutes ? (await stmt(db, 'SELECT seen_at FROM b_session_activity WHERE session_id=?', sid).first<Data>())?.seen_at : null;
  const expired = rules.session_minutes && at - actor.sessionStartedAt! > rules.session_minutes * 60_000;
  const idle = seen && at - Number(seen) > rules.idle_minutes * 60_000;
  if (expired || idle) {
    await db.batch([stmt(db, 'UPDATE oa_sessions SET revoked_at=? WHERE id=? AND revoked_at IS NULL', at, sid), stmt(db, 'DELETE FROM b_session_activity WHERE session_id=?', sid)]);
    throw new Fault(expired ? 'Your session reached the practice time limit. Sign in again.' : 'You were signed out after a period of inactivity. Sign in again.', 401);
  }
  if (rules.idle_minutes) await stmt(db, 'INSERT INTO b_session_activity(session_id,seen_at) VALUES(?,?) ON CONFLICT(session_id) DO UPDATE SET seen_at=excluded.seen_at', sid, at).run();
}

/** Agent keys act for their owner and cannot bypass the policy. */
export async function agentGate(db: D1Database, address: string) {
  insist(!await policyOn(db) || await factorCount(db, address) > 0, "This agent key's owner must set up a second factor first", 403);
}

export async function mfaState(db: D1Database, actor: Actor) {
  return {
    required: await policyOn(db), verified: await verifiedSession(db, actor.sessionId!),
    factors: await rows(db, 'SELECT id,kind,label,created_at,confirmed_at,last_used_at FROM b_mfa_factors WHERE email=? AND confirmed_at IS NOT NULL ORDER BY created_at', actor.email),
    passkeys: (await rows(db, "SELECT credential_id FROM b_mfa_factors WHERE email=? AND kind='passkey' AND confirmed_at IS NOT NULL", actor.email)).map(f => f.credential_id),
    recoveryCodesLeft: Number((await stmt(db, 'SELECT COUNT(*) n FROM b_mfa_recovery WHERE email=? AND used_at IS NULL', actor.email).first<Data>())!.n),
  };
}

/** Adding a factor once one exists needs a verified session, so a stolen session cannot add its own. */
async function mayEnroll(db: D1Database, actor: Actor) {
  insist(await factorCount(db, actor.email) === 0 || await verifiedSession(db, actor.sessionId!), 'Confirm your current second factor before adding another', 403);
}

export async function startTotp(db: D1Database, actor: Actor, sessionSecret: string, body: Data) {
  human(actor); await mayEnroll(db, actor);
  const secret = base32(crypto.getRandomValues(new Uint8Array(20))), factorId = id(), label = text(body.label ?? 'Authenticator app', 'Name', 80);
  await atomic(db, actor, [stmt(db, 'DELETE FROM b_mfa_factors WHERE email=? AND confirmed_at IS NULL', actor.email),
    stmt(db, "INSERT INTO b_mfa_factors(id,email,kind,label,sealed_secret,created_at) VALUES(?,?,'totp',?,?,?)", factorId, actor.email, label, await seal(sessionSecret, secret), now())]);
  const issuer = 'Blotter';
  return { id: factorId, secret, uri: `otpauth://totp/${encodeURIComponent(`${issuer}:${actor.email}`)}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=${DIGITS}&period=${STEP_SECONDS}` };
}

async function failures(db: D1Database, address: string) {
  const since = new Date(Date.now() - LOCK_MINUTES * 60_000).toISOString();
  insist(Number((await stmt(db, 'SELECT COUNT(*) n FROM b_mfa_failures WHERE email=? AND at>?', address, since).first<Data>())!.n) < FAILURES,
    `Too many incorrect codes. Wait ${LOCK_MINUTES} minutes and try again.`, 429);
}
const fail = async (db: D1Database, address: string, message: string): Promise<never> => {
  await stmt(db, 'INSERT INTO b_mfa_failures(id,email,at) VALUES(?,?,?)', id(), address, now()).run();
  throw new Fault(message, 400);
};

/** The newest 30-second step within one step either side whose code matches and is not yet used. */
async function matchingStep(sessionSecret: string, factor: Data, code: string) {
  const secret = await unseal(sessionSecret, factor.sealed_secret), current = Math.floor(Date.now() / 1000 / STEP_SECONDS);
  for (const step of [current + 1, current, current - 1]) if (step > Number(factor.last_step) && await totp(secret, step) === code) return step;
  return null;
}
const sixDigits = (value: unknown) => { const code = text(value, 'Code', 12).replace(/\s/g, ''); insist(/^\d{6}$/.test(code), 'Enter the 6-digit code'); return code; };

export async function confirmTotp(db: D1Database, actor: Actor, sessionSecret: string, body: Data) {
  human(actor); await mayEnroll(db, actor); await failures(db, actor.email);
  const factor = await stmt(db, 'SELECT * FROM b_mfa_factors WHERE id=? AND email=? AND confirmed_at IS NULL', text(body.id, 'Factor'), actor.email).first<Data>();
  insist(factor, 'Start setting up the authenticator again', 404);
  const step = await matchingStep(sessionSecret, factor, sixDigits(body.code));
  if (step === null) return fail(db, actor.email, 'That code is not right. Check the time on your device and try again.');
  const first = await factorCount(db, actor.email) === 0, codes = first ? recoveryCodes() : [];
  await atomic(db, actor, [
    stmt(db, 'UPDATE b_mfa_factors SET confirmed_at=?,last_step=?,last_used_at=? WHERE id=?', now(), step, now(), factor.id),
    ...await recoveryStatements(db, actor.email, codes),
    stmt(db, 'INSERT INTO b_mfa_sessions(session_id,email,method,verified_at) VALUES(?,?,?,?) ON CONFLICT(session_id) DO NOTHING', actor.sessionId, actor.email, 'totp', now()),
    audit(db, actor, 'mfa.enrolled', factor.id, factor.label)]);
  return { id: factor.id, recoveryCodes: codes };
}

function recoveryCodes() {
  return Array.from({ length: RECOVERY_CODES }, () => { const c = base32(crypto.getRandomValues(new Uint8Array(5))).toLowerCase(); return `${c.slice(0, 4)}-${c.slice(4)}`; });
}
const normalCode = (value: string) => value.toLowerCase().replace(/[^a-z2-7]/g, '');
async function recoveryStatements(db: D1Database, address: string, codes: string[]) {
  if (!codes.length) return [];
  return [stmt(db, 'DELETE FROM b_mfa_recovery WHERE email=?', address),
    ...await Promise.all(codes.map(async c => stmt(db, 'INSERT INTO b_mfa_recovery(email,digest,created_at) VALUES(?,?,?)', address, await digest(normalCode(c)), now())))];
}

/** New recovery codes replace every earlier one; shown once. */
export async function newRecoveryCodes(db: D1Database, actor: Actor) {
  human(actor);
  insist(await factorCount(db, actor.email) > 0 && await verifiedSession(db, actor.sessionId!), 'Confirm your second factor first', 403);
  const codes = recoveryCodes();
  await atomic(db, actor, [...await recoveryStatements(db, actor.email, codes), audit(db, actor, 'mfa.recovery_codes', actor.email)]);
  return { recoveryCodes: codes };
}

/** Verify this session with an authenticator code, a passkey or a one-time recovery code. */
export async function verifySession(db: D1Database, actor: Actor, site: Site, body: Data) {
  human(actor); await failures(db, actor.email);
  insist(await factorCount(db, actor.email) > 0, 'Set up a second factor first', 409);
  let method: string, statements: D1PreparedStatement[];
  if (body.passkey) {
    const answer = body.passkey as Data;
    const factor = await stmt(db, "SELECT * FROM b_mfa_factors WHERE email=? AND kind='passkey' AND confirmed_at IS NOT NULL AND credential_id=?", actor.email, String(answer.id ?? '')).first<Data>();
    if (!factor) return fail(db, actor.email, 'That passkey is not one of yours');
    const challenge = await takeChallenge(db, actor, 'verify');
    const { signCount } = await verifyAssertion(answer, { challenge, origin: site.origin }, rpId(site), { publicKey: JSON.parse(factor.public_key), signCount: Number(factor.sign_count) });
    method = 'passkey';
    statements = [stmt(db, 'UPDATE b_mfa_factors SET sign_count=?,last_used_at=? WHERE id=?', signCount, now(), factor.id)];
  } else if (body.recoveryCode) {
    const hash = await digest(normalCode(text(body.recoveryCode, 'Recovery code', 20)));
    const unused = await stmt(db, 'SELECT 1 FROM b_mfa_recovery WHERE email=? AND digest=? AND used_at IS NULL', actor.email, hash).first();
    if (!unused) return fail(db, actor.email, 'That recovery code is not valid or was already used');
    method = 'recovery_code';
    statements = [stmt(db, 'UPDATE b_mfa_recovery SET used_at=? WHERE email=? AND digest=? AND used_at IS NULL', now(), actor.email, hash)];
  } else {
    const code = sixDigits(body.code);
    const factors = await rows(db, "SELECT * FROM b_mfa_factors WHERE email=? AND kind='totp' AND confirmed_at IS NOT NULL", actor.email);
    let hit: { factor: Data; step: number } | null = null;
    for (const factor of factors) { const step = await matchingStep(site.secret, factor, code); if (step !== null) { hit = { factor, step }; break; } }
    if (!hit) return fail(db, actor.email, 'That code is not right, or it was already used. Wait for the next code.');
    method = 'totp';
    // The step only moves forward, so a code is never accepted twice.
    statements = [stmt(db, 'UPDATE b_mfa_factors SET last_step=?,last_used_at=? WHERE id=? AND last_step<?', hit.step, now(), hit.factor.id, hit.step)];
  }
  await atomic(db, actor, [...statements,
    stmt(db, 'INSERT INTO b_mfa_sessions(session_id,email,method,verified_at) VALUES(?,?,?,?) ON CONFLICT(session_id) DO NOTHING', actor.sessionId, actor.email, method, now()),
    audit(db, actor, 'mfa.verified', actor.sessionId!, method)]);
  return { verified: true, method };
}

const CHALLENGE_MINUTES = 5;
async function newChallenge(db: D1Database, actor: Actor, purpose: 'register' | 'verify') {
  const challenge = b64url(crypto.getRandomValues(new Uint8Array(32)));
  await stmt(db, 'DELETE FROM b_mfa_challenges WHERE session_id=? AND purpose=?', actor.sessionId, purpose).run();
  await stmt(db, 'INSERT INTO b_mfa_challenges(id,email,session_id,purpose,challenge,expires_at) VALUES(?,?,?,?,?,?)', id(), actor.email, actor.sessionId, purpose, challenge,
    new Date(Date.now() + CHALLENGE_MINUTES * 60_000).toISOString()).run();
  return challenge;
}
/** Each challenge answers once, for this session, within five minutes. */
async function takeChallenge(db: D1Database, actor: Actor, purpose: 'register' | 'verify') {
  const row = await stmt(db, 'DELETE FROM b_mfa_challenges WHERE session_id=? AND purpose=? AND email=? RETURNING challenge,expires_at', actor.sessionId, purpose, actor.email).first<Data>();
  insist(row && row.expires_at > now(), 'This passkey request expired. Try again.', 409);
  return row.challenge as string;
}
const passkeyIds = async (db: D1Database, address: string) => (await rows(db, "SELECT credential_id FROM b_mfa_factors WHERE email=? AND kind='passkey' AND confirmed_at IS NOT NULL", address)).map(f => ({ type: 'public-key', id: f.credential_id }));

/** Options for navigator.credentials.create: a passkey or security key for this site, without attestation. */
export async function startPasskey(db: D1Database, actor: Actor, site: Site) {
  human(actor); await mayEnroll(db, actor);
  return {
    challenge: await newChallenge(db, actor, 'register'), rp: { id: rpId(site), name: 'Blotter' },
    user: { id: b64url(new TextEncoder().encode(actor.id)), name: actor.email, displayName: actor.name || actor.email },
    pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }], timeout: CHALLENGE_MINUTES * 60_000, attestation: 'none',
    authenticatorSelection: { userVerification: 'preferred', residentKey: 'preferred' }, excludeCredentials: await passkeyIds(db, actor.email),
  };
}
export async function confirmPasskey(db: D1Database, actor: Actor, site: Site, body: Data) {
  human(actor); await mayEnroll(db, actor);
  const challenge = await takeChallenge(db, actor, 'register');
  const key = await verifyRegistration(body, { challenge, origin: site.origin }, rpId(site));
  insist(key.credentialId === body.id, 'Passkey credential is not valid');
  insist(!await stmt(db, 'SELECT 1 FROM b_mfa_factors WHERE credential_id=?', key.credentialId).first(), 'This passkey is already registered', 409);
  const factorId = id(), label = text(body.label ?? 'Passkey', 'Name', 80), first = await factorCount(db, actor.email) === 0, codes = first ? recoveryCodes() : [];
  await atomic(db, actor, [
    stmt(db, "INSERT INTO b_mfa_factors(id,email,kind,label,credential_id,public_key,sign_count,created_at,confirmed_at,last_used_at) VALUES(?,?,'passkey',?,?,?,?,?,?,?)",
      factorId, actor.email, label, key.credentialId, JSON.stringify(key.publicKey), key.signCount, now(), now(), now()),
    ...await recoveryStatements(db, actor.email, codes),
    stmt(db, 'INSERT INTO b_mfa_sessions(session_id,email,method,verified_at) VALUES(?,?,?,?) ON CONFLICT(session_id) DO NOTHING', actor.sessionId, actor.email, 'passkey', now()),
    audit(db, actor, 'mfa.enrolled', factorId, label)]);
  return { id: factorId, recoveryCodes: codes };
}
/** Options for navigator.credentials.get when this session steps up with a passkey. */
export async function passkeyChallenge(db: D1Database, actor: Actor, site: Site) {
  human(actor);
  const allowCredentials = await passkeyIds(db, actor.email);
  insist(allowCredentials.length, 'You have no passkey yet', 409);
  return { challenge: await newChallenge(db, actor, 'verify'), rpId: rpId(site), allowCredentials, timeout: CHALLENGE_MINUTES * 60_000, userVerification: 'preferred' };
}

export async function setPolicy(db: D1Database, actor: Actor, body: Data) {
  human(actor); need(actor, 'owner');
  insist(typeof body.required === 'boolean', 'Choose whether a second factor is required');
  await atomic(db, actor, [
    stmt(db, 'INSERT INTO b_mfa_policy(id,required,set_by,set_at) VALUES(1,?,?,?) ON CONFLICT(id) DO UPDATE SET required=excluded.required,set_by=excluded.set_by,set_at=excluded.set_at', body.required ? 1 : 0, actor.email, now()),
    audit(db, actor, body.required ? 'mfa.policy_on' : 'mfa.policy_off', 'mfa-policy')]);
  return { required: body.required };
}

/** Session lifetime and idle timeout in whole minutes; empty keeps sign-in's own limit. */
export async function setSessionLimits(db: D1Database, actor: Actor, body: Data) {
  human(actor); need(actor, 'owner');
  const minutes = (value: unknown, label: string, max: number) => value === null || value === undefined || value === '' ? null : integer(value, label, 1, max);
  const lifetime = minutes(body.sessionMinutes, 'Session lifetime in minutes', 43_200), idle = minutes(body.idleMinutes, 'Idle timeout in minutes', 1440);
  await atomic(db, actor, [
    stmt(db, 'INSERT INTO b_mfa_policy(id,session_minutes,idle_minutes,set_by,set_at) VALUES(1,?,?,?,?) ON CONFLICT(id) DO UPDATE SET session_minutes=excluded.session_minutes,idle_minutes=excluded.idle_minutes,set_by=excluded.set_by,set_at=excluded.set_at',
      lifetime, idle, actor.email, now()),
    audit(db, actor, 'session.limits', 'mfa-policy', `lifetime ${lifetime ?? 'default'} min, idle ${idle ?? 'none'} min`)]);
  return { sessionMinutes: lifetime, idleMinutes: idle };
}

/** The principal resets a member who lost their factor: factors and codes go, and every one of their sessions is revoked. */
export async function resetMember(db: D1Database, actor: Actor, body: Data) {
  human(actor); need(actor, 'owner');
  const address = email(body.email), reason = text(body.reason, 'Reason', 500);
  insist(address !== actor.email, 'Use one of your recovery codes to recover your own second factor');
  insist(await stmt(db, 'SELECT 1 FROM b_members WHERE email=?', address).first(), 'Practice member not found', 404);
  await atomic(db, actor, [
    stmt(db, 'DELETE FROM b_mfa_factors WHERE email=?', address), stmt(db, 'DELETE FROM b_mfa_recovery WHERE email=?', address),
    stmt(db, 'DELETE FROM b_mfa_sessions WHERE email=?', address),
    stmt(db, 'UPDATE oa_sessions SET revoked_at=? WHERE revoked_at IS NULL AND operator_id IN (SELECT id FROM oa_operators WHERE email=?)', Date.now(), address),
    audit(db, actor, 'mfa.reset', address, `${reason}; all sessions revoked`)]);
  return { email: address, reset: true };
}

const reportRows = (db: D1Database) => rows(db, `SELECT p.email,p.name,p.role,p.active,
    (SELECT COUNT(*) FROM b_mfa_factors f WHERE f.email=p.email AND f.confirmed_at IS NOT NULL AND f.kind='totp') totp_factors,
    (SELECT COUNT(*) FROM b_mfa_factors f WHERE f.email=p.email AND f.confirmed_at IS NOT NULL AND f.kind='passkey') passkey_factors,
    (SELECT MIN(confirmed_at) FROM b_mfa_factors f WHERE f.email=p.email) enrolled_at,
    (SELECT MAX(verified_at) FROM b_mfa_sessions s WHERE s.email=p.email) last_verified_at,
    (SELECT COUNT(*) FROM b_mfa_recovery r WHERE r.email=p.email AND r.used_at IS NULL) recovery_codes_left
  FROM (SELECT email,display_name name,'owner' role,1 active FROM oa_operators WHERE role='owner' AND status='active' UNION ALL SELECT email,name,role,active FROM b_members) p ORDER BY p.role<>'owner',p.name`);

/**
 * The enrollment report: who has a second factor, since when and when they last
 * verified, as evidence for the firm's WISP and its FTC Safeguards Rule
 * multi-factor control (16 CFR 314.4(c)(5)). It records facts; it does not certify compliance.
 */
export async function enrollmentReport(db: D1Database, actor: Actor) {
  need(actor, 'owner');
  const people = await reportRows(db), required = await policyOn(db), generated = now();
  const cell = (v: unknown) => { const s = v === null || v === undefined ? '' : String(v); return /[",\n\r]/.test(s) || /^[=+\-@]/.test(s) ? `"${(/^[=+\-@]/.test(s) ? "'" : '') + s.replace(/"/g, '""')}"` : s; };
  const header = ['email', 'name', 'role', 'active', 'enrolled', 'totp_factors', 'passkey_factors', 'enrolled_at', 'last_verified_at', 'recovery_codes_left', 'policy_required', 'generated_at'];
  const csv = [header, ...people.map(p => [p.email, p.name, p.role, p.active ? 'yes' : 'no', p.totp_factors + p.passkey_factors > 0 ? 'yes' : 'no', p.totp_factors, p.passkey_factors, p.enrolled_at, p.last_verified_at, p.recovery_codes_left, required ? 'yes' : 'no', generated])]
    .map(r => r.map(cell).join(',')).join('\r\n') + '\r\n';
  return new Response(csv, { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="blotter-mfa-enrollment.csv"', 'cache-control': 'no-store' } });
}
export async function mfaOverview(db: D1Database, actor: Actor) {
  need(actor, 'owner');
  const rules = await policy(db);
  return { required: !!rules?.required, sessionMinutes: rules?.session_minutes ?? null, idleMinutes: rules?.idle_minutes ?? null, people: await reportRows(db) };
}
