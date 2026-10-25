// PORTAL-002 staff doors for the signed-in client portal. A grant is explicit per
// contact, so per entity: staff who may edit contacts invite one active, authorized,
// portal-enabled contact, and the invitation opens that entity for the account at the
// contact's address. Revoking the grant, the contact or the entity ends access on the
// next request. Only the principal sets the firm's portal policy and resets a factor.
import { runtimeBindings, type Bindings } from '../auth.server';
import { isLanguage, tr, type Key, type Language } from '../i18n/catalog';
import { readableClient } from './client-contacts';
import { sendMail } from './documents';
import { firmSettings } from './firm';
import { atomic, audit, digest, guard, human, id, insist, need, now, rows, secret, stmt, text, type Actor, type Data } from './model';

const INVITE_DAYS = 7;

/** A grant opens its entity only while its contact stays active, authorized and portal-enabled at the account's address on a live entity. */
export const liveGrantSql = (g = 'g') => `${g}.accepted_at IS NOT NULL AND ${g}.revoked_at IS NULL AND EXISTS(SELECT 1 FROM b_client_contacts lc
  JOIN b_clients le ON le.id=lc.client_id JOIN b_portal_accounts la ON la.id=${g}.account_id
  WHERE lc.id=${g}.contact_id AND lc.client_id=${g}.client_id AND lc.active=1 AND lc.authorized=1 AND lc.portal=1 AND lc.email=la.email
    AND la.status='active' AND le.lifecycle='active' AND le.merged_into IS NULL AND le.erased_at IS NULL)`;

/** The firm portal policy; with nothing recorded a second factor is required. */
export async function portalPolicy(db: D1Database) {
  const p = await stmt(db, 'SELECT * FROM b_portal_policy WHERE id=1').first<Data>();
  return { mfaRequired: p ? p.mfa_required === 1 : true, reason: p?.reason ?? null, setBy: p?.set_by ?? null, setAt: p?.set_at ?? null };
}
export async function readPortalPolicy(db: D1Database, actor: Actor) {
  need(actor, 'owner', 'reviewer');
  return portalPolicy(db);
}
export async function setPortalPolicy(db: D1Database, actor: Actor, body: Data) {
  human(actor); need(actor, 'owner');
  insist(typeof body.mfaRequired === 'boolean', 'Choose whether client portal accounts need a second factor');
  const reason = text(body.reason, 'Reason for the portal policy', 1000);
  await atomic(db, actor, [stmt(db, `INSERT INTO b_portal_policy(id,mfa_required,reason,set_by,set_at) VALUES(1,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET mfa_required=excluded.mfa_required,reason=excluded.reason,set_by=excluded.set_by,set_at=excluded.set_at`, body.mfaRequired ? 1 : 0, reason, actor.email, now()),
    audit(db, actor, 'portal.policy_set', 'portal-policy', `second factor ${body.mfaRequired ? 'required' : 'optional'}; ${reason}`)]);
  return portalPolicy(db);
}

/** Each contact's portal account state on one client, for staff who may read the client. */
export async function portalAccess(db: D1Database, actor: Actor, clientId: string) {
  await readableClient(db, actor, clientId);
  const grants = await rows(db, `SELECT g.contact_id,g.account_id,g.invited_by,g.invited_at,g.accepted_at,g.revoked_by,g.revoked_at,g.revoke_reason,a.email,a.status,a.totp_confirmed_at,
    ${liveGrantSql('g')} live FROM b_portal_grants g JOIN b_portal_accounts a ON a.id=g.account_id WHERE g.client_id=? ORDER BY g.invited_at`, clientId);
  return { policy: await portalPolicy(db), grants: grants.map(g => ({ contactId: g.contact_id, accountId: g.account_id, email: g.email, invitedBy: g.invited_by, invitedAt: g.invited_at,
    acceptedAt: g.accepted_at, revokedBy: g.revoked_by, revokedAt: g.revoked_at, revokeReason: g.revoke_reason, factor: !!g.totp_confirmed_at,
    status: g.revoked_at ? 'revoked' : !g.accepted_at ? 'invited' : g.live ? 'active' : 'suspended' })) };
}

const contactLanguage = (value: unknown): Language => isLanguage(value) ? value : 'en';

/** Invite one contact: the account is its address, the grant is this contact on this entity. An earlier unused invitation ends. */
export async function invitePortal(env: Bindings, actor: Actor, clientId: string, contactId: string) {
  human(actor); need(actor, 'owner', 'reviewer');
  const bindings = runtimeBindings(env), db = bindings.DB, client = await readableClient(db, actor, clientId);
  const contact = await stmt(db, `SELECT c.* FROM b_client_contacts c JOIN b_clients e ON e.id=c.client_id WHERE c.id=? AND c.client_id=? AND c.active=1 AND c.authorized=1 AND c.portal=1
    AND c.email<>'' AND c.email_consent=1 AND e.lifecycle='active' AND e.merged_into IS NULL AND e.erased_at IS NULL`, contactId, clientId).first<Data>();
  insist(contact, 'Invite an active, authorized contact with portal access, an email address and email consent', 409);
  const account = await stmt(db, 'SELECT * FROM b_portal_accounts WHERE email=?', contact.email).first<Data>();
  insist(!account || account.status === 'active', 'This portal account is disabled', 409);
  const accountId = account?.id ?? id(), token = secret('pi_'), at = now(), expiresAt = new Date(Date.parse(at) + INVITE_DAYS * 86_400_000).toISOString();
  const [check, release] = guard(db, `EXISTS(SELECT 1 FROM b_client_contacts WHERE id=? AND revision=? AND active=1 AND authorized=1 AND portal=1)`, contact.id, contact.revision);
  await atomic(db, actor, [check,
    ...(account ? [] : [stmt(db, 'INSERT INTO b_portal_accounts(id,email,created_by,created_at) VALUES(?,?,?,?)', accountId, contact.email, actor.email, at)]),
    // A live accepted grant stays accepted on a resend; a revoked or re-addressed one needs this invitation accepted again.
    stmt(db, `INSERT INTO b_portal_grants(contact_id,account_id,client_id,invited_by,invited_at) VALUES(?,?,?,?,?) ON CONFLICT(contact_id) DO UPDATE SET
      accepted_at=CASE WHEN b_portal_grants.revoked_at IS NULL AND b_portal_grants.account_id=excluded.account_id THEN b_portal_grants.accepted_at ELSE NULL END,
      account_id=excluded.account_id,invited_by=excluded.invited_by,invited_at=excluded.invited_at,revoked_by=NULL,revoked_at=NULL,revoke_reason=NULL`, contact.id, accountId, clientId, actor.email, at),
    stmt(db, 'UPDATE b_portal_sessions SET revoked_at=? WHERE account_id=? AND revoked_at IS NULL', at, accountId),
    stmt(db, 'UPDATE b_portal_invitations SET used_at=? WHERE contact_id=? AND used_at IS NULL', at, contact.id),
    stmt(db, 'INSERT INTO b_portal_invitations(digest,contact_id,account_id,created_by,created_at,expires_at) VALUES(?,?,?,?,?,?)', await digest(token), contact.id, accountId, actor.email, at, expiresAt),
    release, audit(db, actor, 'portal.invited', clientId, `${contact.id}: ${contact.email}`)]);
  const language = contactLanguage(contact.language), T = (key: Key, vars: Record<string, string | number> = {}) => tr(language, key, vars), firm = (await firmSettings(db)).name || T('unsub.thisPractice');
  await sendMail(bindings, id(), contact.email, T('account.invite.subject', { firm }),
    [T('mail.hello', { name: contact.name || contact.email }), '', T('account.invite.body', { firm, client: client.name }), `${bindings.AUTH_ORIGIN}/client?invite=${token}&lang=${language}`, T('account.invite.expires', { date: expiresAt.slice(0, 10) })].join('\n'));
  return { requested: true };
}

/** Revoke one contact's grant; the account's sessions lose that entity on their next request. */
export async function revokePortal(db: D1Database, actor: Actor, clientId: string, contactId: string, body: Data) {
  human(actor); need(actor, 'owner', 'reviewer');
  await readableClient(db, actor, clientId);
  const reason = text(body.reason, 'Reason to revoke portal access', 1000), at = now();
  insist(await stmt(db, 'SELECT 1 FROM b_portal_grants WHERE contact_id=? AND client_id=? AND revoked_at IS NULL', contactId, clientId).first(), 'This contact has no portal access to revoke', 404);
  await atomic(db, actor, [stmt(db, 'UPDATE b_portal_grants SET revoked_by=?,revoked_at=?,revoke_reason=? WHERE contact_id=? AND revoked_at IS NULL', actor.email, at, reason, contactId),
    stmt(db, 'UPDATE b_portal_invitations SET used_at=? WHERE contact_id=? AND used_at IS NULL', at, contactId),
    audit(db, actor, 'portal.revoked', clientId, `${contactId}: ${reason}`)]);
  return { contactId, status: 'revoked' };
}

/** The principal clears a lost factor: recovery codes go, every session ends, and the client sets up a new factor at next sign-in. */
export async function resetPortalFactor(db: D1Database, actor: Actor, accountId: string, body: Data) {
  human(actor); need(actor, 'owner');
  const reason = text(body.reason, 'Reason to reset the second factor', 1000), at = now();
  const account = await stmt(db, 'SELECT id,email FROM b_portal_accounts WHERE id=?', accountId).first<Data>();
  if (!account) return { requested: true };
  await atomic(db, actor, [stmt(db, 'UPDATE b_portal_accounts SET totp_sealed=NULL,totp_pending_sealed=NULL,totp_confirmed_at=NULL WHERE id=?', account.id),
    stmt(db, 'DELETE FROM b_portal_recovery WHERE account_id=?', account.id), stmt(db, 'UPDATE b_portal_sessions SET revoked_at=? WHERE account_id=? AND revoked_at IS NULL', at, account.id),
    audit(db, actor, 'portal.factor_reset', account.id, `${account.email}: ${reason}`)]);
  return { requested: true };
}
