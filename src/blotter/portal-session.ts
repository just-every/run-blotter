// PORTAL-009 client sign-in. A client proves the address with a one-use emailed link
// (an invitation or a sign-in link), then a second factor when the firm requires one or
// the account has one. The session is a server-side row behind an HttpOnly cookie; every
// request rechecks the session, the account and, through liveGrantSql, each entity.
import { runtimeBindings, type Bindings } from '../auth.server';
import { isLanguage, tr, type Key, type Language } from '../i18n/catalog';
import { sendMail } from './documents';
import { firmSettings } from './firm';
import { base32, normalCode, recoveryCodes, seal, sixDigits, totp, unseal } from './mfa';
import { digest, email, Fault, guard, id, insist, now, rows, secret, stmt, text, type Data } from './model';
import { liveGrantSql, portalPolicy } from './portal-accounts';

const COOKIE = 'blotter_portal', SESSION_HOURS = 8, LINK_MINUTES = 15, LINKS_PER_HOUR = 5, FAILURES = 5, LOCK_MINUTES = 15;
export type Client = { accountId: string; email: string; sessionId: string; factor: boolean; verified: boolean; recovered: boolean; mfaRequired: boolean };

const cookieToken = (request: Request) => {
  const value = (request.headers.get('cookie') ?? '').split(';').map(p => p.trim()).find(p => p.startsWith(COOKIE + '='))?.slice(COOKIE.length + 1) ?? '';
  return /^ps_[0-9a-f]{64}$/.test(value) ? value : '';
};
export const sessionCookie = (token: string) => `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_HOURS * 3600}`;
export const endedCookie = `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
const who = (address: string) => `client portal (${address})`;
const clientAudit = (db: D1Database, address: string, action: string, objectId: string, detail = '') =>
  stmt(db, 'INSERT INTO b_audit(id,actor,action,object_id,detail,at) VALUES(?,?,?,?,?,?)', id(), who(address), action, objectId, detail, now());

/** Writes from the client portal come from this origin only. */
export function sameSite(request: Request, env: Bindings) {
  const origin = runtimeBindings(env).AUTH_ORIGIN;
  insist(new URL(request.url).origin === origin, 'Invalid host', 403);
  if (!['GET', 'HEAD'].includes(request.method)) insist(request.headers.get('origin') === origin && request.headers.get('sec-fetch-site') !== 'cross-site', 'Invalid request origin', 403);
}

/** The signed-in client. `open` admits a session that still owes its second factor: only the factor doors use it. */
export async function clientSession(request: Request, env: Bindings, open = false): Promise<Client> {
  sameSite(request, env);
  const db = runtimeBindings(env).DB, token = cookieToken(request);
  insist(token, 'Sign in to the client portal', 401);
  const s = await stmt(db, `SELECT s.*,a.email,a.status,a.totp_confirmed_at FROM b_portal_sessions s JOIN b_portal_accounts a ON a.id=s.account_id WHERE s.digest=?`, await digest(token)).first<Data>();
  insist(s && !s.revoked_at && s.expires_at > now() && s.status === 'active', 'Your portal session has ended. Sign in again.', 401);
  const { mfaRequired } = await portalPolicy(db), factor = !!s.totp_confirmed_at;
  const client: Client = { accountId: s.account_id, email: s.email, sessionId: s.id, factor, verified: !!s.verified_at, recovered: s.recovered === 1, mfaRequired };
  if (!open && (mfaRequired || factor || client.recovered)) {
    if (!factor || client.recovered) throw new Fault('Set up your authenticator app before you continue', 403, { mfa: 'enroll' });
    if (!client.verified) throw new Fault('Enter the code from your authenticator app to continue', 403, { mfa: 'verify' });
  }
  return client;
}

/** A new server-side session for the account; the token exists only in the cookie. */
async function newSession(db: D1Database, accountId: string) {
  const token = secret('ps_'), sessionId = id(), at = now();
  return { token, sessionId, statement: stmt(db, 'INSERT INTO b_portal_sessions(id,digest,account_id,created_at,expires_at) VALUES(?,?,?,?,?)', sessionId, await digest(token), accountId, at, new Date(Date.parse(at) + SESSION_HOURS * 3_600_000).toISOString()) };
}
const usable = (db: D1Database, accountId: string) => stmt(db, `SELECT a.* FROM b_portal_accounts a WHERE a.id=? AND a.status='active' AND EXISTS(SELECT 1 FROM b_portal_grants g WHERE g.account_id=a.id AND ${liveGrantSql('g')})`, accountId).first<Data>();
async function accountLanguage(db: D1Database, accountId: string): Promise<Language> {
  const spanish = await stmt(db, `SELECT 1 FROM b_portal_grants g JOIN b_client_contacts c ON c.id=g.contact_id WHERE g.account_id=? AND c.language='es' AND ${liveGrantSql('g')}`, accountId).first();
  return spanish ? 'es' : 'en';
}

/**
 * Ask for a sign-in link. The reply never says whether the address has access, and the
 * link is prepared and mailed after the reply is sent, so its timing says nothing either.
 */
export function requestSignIn(env: Bindings, body: Data, later: (work: Promise<unknown>) => void) {
  const bindings = runtimeBindings(env), db = bindings.DB, address = email(body.email, 'Email');
  later((async () => {
    const account = await stmt(db, `SELECT a.id FROM b_portal_accounts a WHERE a.email=? AND a.status='active' AND EXISTS(SELECT 1 FROM b_portal_grants g WHERE g.account_id=a.id AND ${liveGrantSql('g')})`, address).first<Data>();
    if (!account) return;
    const recent = Number((await stmt(db, 'SELECT COUNT(*) n FROM b_portal_signins WHERE account_id=? AND created_at>?', account.id, new Date(Date.now() - 3_600_000).toISOString()).first<Data>())!.n);
    if (recent >= LINKS_PER_HOUR) return;
    const token = secret('pl_'), at = now(), language = await accountLanguage(db, account.id), T = (key: Key, vars: Record<string, string | number> = {}) => tr(language, key, vars);
    await db.batch([stmt(db, 'UPDATE b_portal_signins SET used_at=? WHERE account_id=? AND used_at IS NULL', at, account.id),
      stmt(db, 'INSERT INTO b_portal_signins(digest,account_id,created_at,expires_at) VALUES(?,?,?,?)', await digest(token), account.id, at, new Date(Date.now() + LINK_MINUTES * 60_000).toISOString())]);
    const firm = (await firmSettings(db)).name || T('unsub.thisPractice');
    await sendMail(bindings, id(), address, T('account.signin.subject', { firm }), [T('account.signin.body', { firm }), `${bindings.AUTH_ORIGIN}/client?signin=${token}&lang=${language}`, T('account.signin.expires', { minutes: LINK_MINUTES })].join('\n'));
  })().catch(error => console.error('portal sign-in mail', error)));
  return { requested: true };
}

/** Spend an emailed sign-in link: one use, within its minutes, for an account that still opens an entity. */
export async function confirmSignIn(env: Bindings, body: Data) {
  const db = runtimeBindings(env).DB, token = text(body.token, 'Sign-in link', 100);
  insist(/^pl_[0-9a-f]{64}$/.test(token), 'This sign-in link is not valid. Ask for a new one.', 404);
  const link = await stmt(db, 'SELECT * FROM b_portal_signins WHERE digest=?', await digest(token)).first<Data>();
  insist(link && !link.used_at && link.expires_at > now(), 'This sign-in link has expired or was already used. Ask for a new one.', 404);
  const account = await usable(db, link.account_id);
  insist(account, 'This sign-in link has expired or was already used. Ask for a new one.', 404);
  const session = await newSession(db, account.id), [check, release] = guard(db, 'EXISTS(SELECT 1 FROM b_portal_signins WHERE digest=? AND used_at IS NULL)', link.digest);
  await spend(db, [check, stmt(db, 'UPDATE b_portal_signins SET used_at=? WHERE digest=?', now(), link.digest), session.statement, release, clientAudit(db, account.email, 'portal.signed_in', account.id, 'emailed sign-in link')]);
  return { cookie: sessionCookie(session.token), body: { signedIn: true } };
}

/** Accept an invitation: it proves the address, opens its entity and starts a session. */
export async function acceptInvitation(env: Bindings, body: Data) {
  const db = runtimeBindings(env).DB, token = text(body.token, 'Invitation', 100);
  insist(/^pi_[0-9a-f]{64}$/.test(token), 'This invitation is not valid. Ask your accountant for a new one.', 404);
  const invitation = await stmt(db, `SELECT i.*,a.email,a.status FROM b_portal_invitations i JOIN b_portal_accounts a ON a.id=i.account_id WHERE i.digest=?`, await digest(token)).first<Data>();
  insist(invitation && !invitation.used_at && invitation.expires_at > now() && invitation.status === 'active', 'This invitation has expired or was already used. Ask your accountant for a new one.', 404);
  const at = now(), session = await newSession(db, invitation.account_id);
  // The contact must still be the invited, authorized, portal-enabled person at this address on a live entity.
  const [check, release] = guard(db, `EXISTS(SELECT 1 FROM b_portal_invitations i JOIN b_portal_grants g ON g.contact_id=i.contact_id AND g.account_id=i.account_id AND g.revoked_at IS NULL
    JOIN b_client_contacts c ON c.id=i.contact_id JOIN b_clients e ON e.id=c.client_id JOIN b_portal_accounts a ON a.id=i.account_id
    WHERE i.digest=? AND i.used_at IS NULL AND c.active=1 AND c.authorized=1 AND c.portal=1 AND c.email=a.email AND e.lifecycle='active' AND e.merged_into IS NULL AND e.erased_at IS NULL)`, invitation.digest);
  await spend(db, [check, stmt(db, 'UPDATE b_portal_invitations SET used_at=? WHERE digest=?', at, invitation.digest),
    stmt(db, 'UPDATE b_portal_grants SET accepted_at=COALESCE(accepted_at,?) WHERE contact_id=? AND account_id=? AND revoked_at IS NULL', at, invitation.contact_id, invitation.account_id),
    session.statement, release, clientAudit(db, invitation.email, 'portal.accepted', invitation.contact_id, 'invitation accepted')]);
  return { cookie: sessionCookie(session.token), body: { accepted: true } };
}

async function spend(db: D1Database, statements: D1PreparedStatement[]) {
  try { await db.batch(statements); }
  catch (error) {
    if (/b_guard|constraint/i.test(String(error))) throw new Fault('This link has expired or was already used. Ask for a new one.', 404);
    throw error;
  }
}

export async function signOut(env: Bindings, client: Client) {
  const db = runtimeBindings(env).DB;
  await db.batch([stmt(db, 'UPDATE b_portal_sessions SET revoked_at=? WHERE id=? AND revoked_at IS NULL', now(), client.sessionId), clientAudit(db, client.email, 'portal.signed_out', client.accountId)]);
  return { cookie: endedCookie, body: { signedOut: true } };
}

/** Start an authenticator: on an account without one, or in a session a recovery code opened to replace a lost one. */
export async function startFactor(env: Bindings, client: Client) {
  const bindings = runtimeBindings(env), db = bindings.DB;
  insist(!client.factor || client.recovered, 'Your authenticator app is already set up', 409);
  const value = base32(crypto.getRandomValues(new Uint8Array(20))), issuer = 'Blotter';
  await stmt(db, 'UPDATE b_portal_accounts SET totp_pending_sealed=? WHERE id=?', await seal(bindings.SESSION_SECRET, value), client.accountId).run();
  return { secret: value, uri: `otpauth://totp/${encodeURIComponent(`${issuer}:${client.email}`)}?secret=${value}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30` };
}

async function locked(db: D1Database, accountId: string) {
  const since = new Date(Date.now() - LOCK_MINUTES * 60_000).toISOString();
  insist(Number((await stmt(db, 'SELECT COUNT(*) n FROM b_portal_failures WHERE account_id=? AND at>?', accountId, since).first<Data>())!.n) < FAILURES, `Too many incorrect codes. Wait ${LOCK_MINUTES} minutes and try again.`, 429);
}
async function failed(db: D1Database, client: Client, message: string): Promise<never> {
  await db.batch([stmt(db, 'INSERT INTO b_portal_failures(account_id,at) VALUES(?,?)', client.accountId, now()), clientAudit(db, client.email, 'portal.code_refused', client.accountId)]);
  throw new Fault(message, 400);
}
/** The newest 30-second step within one either side whose code matches and is later than the last one used. */
async function matchingStep(sessionSecret: string, sealed: string, code: string, lastStep: number) {
  const value = await unseal(sessionSecret, sealed), current = Math.floor(Date.now() / 30_000);
  for (const step of [current + 1, current, current - 1]) if (step > lastStep && await totp(value, step) === code) return step;
  return null;
}

/** Confirm the new authenticator: it replaces any earlier one, new recovery codes replace the old, and other sessions end. */
export async function confirmFactor(env: Bindings, client: Client, body: Data) {
  const bindings = runtimeBindings(env), db = bindings.DB;
  insist(!client.factor || client.recovered, 'Your authenticator app is already set up', 409);
  await locked(db, client.accountId);
  const account = await stmt(db, 'SELECT * FROM b_portal_accounts WHERE id=?', client.accountId).first<Data>();
  insist(account?.totp_pending_sealed, 'Start setting up the authenticator app again', 409);
  const step = await matchingStep(bindings.SESSION_SECRET, account.totp_pending_sealed, sixDigits(body.code), 0);
  if (step === null) return failed(db, client, 'That code is not right. Check the time on your device and try again.');
  const codes = recoveryCodes(), at = now();
  await db.batch([stmt(db, 'UPDATE b_portal_accounts SET totp_sealed=totp_pending_sealed,totp_pending_sealed=NULL,totp_confirmed_at=?,totp_last_step=? WHERE id=?', at, step, client.accountId),
    stmt(db, 'DELETE FROM b_portal_recovery WHERE account_id=?', client.accountId),
    ...await Promise.all(codes.map(async c => stmt(db, 'INSERT INTO b_portal_recovery(account_id,digest) VALUES(?,?)', client.accountId, await digest(normalCode(c))))),
    stmt(db, 'UPDATE b_portal_sessions SET verified_at=?,recovered=0 WHERE id=?', at, client.sessionId),
    stmt(db, 'UPDATE b_portal_sessions SET revoked_at=? WHERE account_id=? AND id<>? AND revoked_at IS NULL', at, client.accountId, client.sessionId),
    clientAudit(db, client.email, client.recovered ? 'portal.factor_replaced' : 'portal.factor_enrolled', client.accountId)]);
  return { recoveryCodes: codes };
}

/**
 * Verify this session with a current authenticator code, or with a one-time recovery
 * code when the factor is lost: that session must then set up a new authenticator
 * before it reaches any client data.
 */
export async function verifyFactor(env: Bindings, client: Client, body: Data) {
  const bindings = runtimeBindings(env), db = bindings.DB;
  insist(client.factor, 'Set up your authenticator app first', 409);
  await locked(db, client.accountId);
  if (body.recoveryCode !== undefined) {
    const code = normalCode(text(body.recoveryCode, 'Recovery code', 40)), hashed = await digest(code);
    if (!await stmt(db, 'SELECT 1 FROM b_portal_recovery WHERE account_id=? AND digest=? AND used_at IS NULL', client.accountId, hashed).first()) return failed(db, client, 'That recovery code is not right or was already used.');
    const [check, release] = guard(db, 'EXISTS(SELECT 1 FROM b_portal_recovery WHERE account_id=? AND digest=? AND used_at IS NULL)', client.accountId, hashed);
    await spend(db, [check, stmt(db, 'UPDATE b_portal_recovery SET used_at=? WHERE account_id=? AND digest=?', now(), client.accountId, hashed),
      stmt(db, 'UPDATE b_portal_sessions SET verified_at=?,recovered=1 WHERE id=?', now(), client.sessionId), release, clientAudit(db, client.email, 'portal.recovery_used', client.accountId)]);
    return { verified: false, recovered: true, next: 'enroll' };
  }
  const account = await stmt(db, 'SELECT * FROM b_portal_accounts WHERE id=?', client.accountId).first<Data>();
  const step = await matchingStep(bindings.SESSION_SECRET, account!.totp_sealed, sixDigits(body.code), Number(account!.totp_last_step));
  if (step === null) return failed(db, client, 'That code is not right. Check the time on your device and try again.');
  const [check, release] = guard(db, 'EXISTS(SELECT 1 FROM b_portal_accounts WHERE id=? AND totp_last_step<?)', client.accountId, step);
  await spend(db, [check, stmt(db, 'UPDATE b_portal_accounts SET totp_last_step=? WHERE id=?', step, client.accountId),
    stmt(db, 'UPDATE b_portal_sessions SET verified_at=? WHERE id=?', now(), client.sessionId), release, clientAudit(db, client.email, 'portal.verified', client.accountId)]);
  return { verified: true };
}

/** What the signed-in client may open: the account and its factor state, and each live entity only once the session passed its factor. */
export async function clientMe(db: D1Database, client: Client) {
  const mfa = !(client.mfaRequired || client.factor || client.recovered) ? null : !client.factor || client.recovered ? 'enroll' : !client.verified ? 'verify' : null;
  const entities = mfa ? [] : await rows(db, `SELECT g.client_id,g.contact_id,e.name,c.name contact_name,c.language FROM b_portal_grants g JOIN b_clients e ON e.id=g.client_id JOIN b_client_contacts c ON c.id=g.contact_id
    WHERE g.account_id=? AND ${liveGrantSql('g')} ORDER BY e.name,e.id`, client.accountId);
  return { email: client.email, firm: (await firmSettings(db)).name ?? '', factor: client.factor, mfaRequired: client.mfaRequired, mfa, language: mfa ? await accountLanguage(db, client.accountId) : undefined,
    entities: entities.map(e => ({ clientId: e.client_id, name: e.name, contactId: e.contact_id, contactName: e.contact_name, language: isLanguage(e.language) ? e.language : 'en' })) };
}
