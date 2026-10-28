// Optional engagement-text choices, through the authenticated contact portal only.
// A choice is historical evidence and never authorizes sending or marketing texts.
import { isLanguage, tr } from '../i18n/catalog';
import { readableClient } from './client-contacts';
import { liveGrantSql } from './portal-accounts';
import type { Client } from './portal-session';
import { atomic, audit, digest, Fault, guard, id, insist, now, rows, stmt, type Actor, type Data } from './model';

const VERSION = 'engagement-text-1';
const latestSql = 'SELECT * FROM b_sms_consents WHERE client_id=? AND contact_id=? ORDER BY sequence DESC LIMIT 1';
const latest = (db: D1Database, clientId: string, contactId: string) => stmt(db, latestSql, clientId, contactId).first<Data>();
const liveSessionSql = `EXISTS(SELECT 1 FROM b_portal_sessions s JOIN b_portal_accounts a ON a.id=s.account_id
  WHERE s.id=? AND s.account_id=? AND s.revoked_at IS NULL AND s.expires_at>? AND s.verified_at IS NOT NULL
  AND s.recovered=0 AND a.status='active' AND a.totp_confirmed_at IS NOT NULL)`;
async function contact(db: D1Database, client: Client, clientId: string) {
  insist(await stmt(db, `SELECT 1 WHERE ${liveSessionSql}`, client.sessionId, client.accountId, now()).first(), 'Complete your authenticator verification before recording an SMS choice', 403);
  const c = await stmt(db, `SELECT c.* FROM b_portal_grants g JOIN b_client_contacts c ON c.id=g.contact_id
    WHERE g.account_id=? AND g.client_id=? AND ${liveGrantSql('g')}`, client.accountId, clientId).first<Data>();
  insist(c, 'Not found', 404);
  return c;
}
const current = (event: Data | null, c: Data) => Boolean(event && event.choice === 'opt_in' && !event.invalidated_at && !event.restored && !event.erased_at
  && event.client_id === c.client_id && event.contact_id === c.id && event.contact_revision === c.revision && event.phone === c.phone);
const evidence = (event: Data) => ({ id: event.id, clientId: event.client_id, contactId: event.contact_id, accountId: event.account_id,
  contactRevision: event.contact_revision, phone: event.phone, wordingVersion: event.wording_version, wording: event.wording, language: event.language,
  choice: event.choice, actor: event.actor, at: event.at, invalidatedAt: event.invalidated_at, invalidationReason: event.invalidation_reason,
  historical: Boolean(event.restored), erasedAt: event.erased_at });

export async function clientSmsConsent(db: D1Database, client: Client, clientId: string) {
  const c = await contact(db, client, clientId), event = await latest(db, clientId, c.id), language = isLanguage(c.language) ? c.language : 'en';
  return { contactId: c.id, contactRevision: c.revision, contactName: c.name, phone: c.phone, language, wordingVersion: VERSION,
    wording: tr(language, 'sms.wording'), lastId: event?.id ?? null, optedIn: current(event, c), sendingAvailable: false, carrierVerified: false,
    history: (await rows(db, 'SELECT * FROM b_sms_consents WHERE client_id=? AND contact_id=? ORDER BY sequence DESC', clientId, c.id)).map(evidence) };
}

/** The same request can commit once; a stale or changed intent cannot overwrite a later choice. */
export async function saveSmsConsent(db: D1Database, client: Client, clientId: string, body: Data) {
  const c = await contact(db, client, clientId);
  insist(Object.keys(body).every(k => ['requestId','contactRevision','phone','wordingVersion','language','choice','lastId'].includes(k)), 'Only the presented SMS choice fields are accepted');
  insist(typeof body.requestId === 'string' && /^[A-Za-z0-9._:-]{1,128}$/.test(body.requestId), 'Supply a unique SMS choice request id');
  insist(['decline','opt_in','withdraw'].includes(body.choice), 'Choose whether to allow engagement texts');
  const language = isLanguage(c.language) ? c.language : 'en';
  insist(body.contactRevision === c.revision && body.phone === c.phone && body.wordingVersion === VERSION && body.language === language,
    'The contact or wording changed. Refresh and review your choice again.', 409);
  insist(c.phone || body.choice === 'withdraw', 'Ask the practice to record your current phone before choosing SMS consent', 409);
  const key = await digest(body.requestId), payload = await digest(JSON.stringify([clientId, c.id, c.revision, c.phone, VERSION, language, body.choice, body.lastId ?? null]));
  const receipt = () => stmt(db, 'SELECT * FROM b_sms_consents WHERE account_id=? AND key_digest=?', client.accountId, key).first<Data>();
  const replay = async (saved: Data) => {
    insist(saved.payload_digest === payload, 'This SMS choice request was already used for a different choice', 409);
    const last = await latest(db, clientId, c.id);
    insist(last?.id === saved.id && !saved.restored && !saved.invalidated_at && !saved.erased_at, 'This SMS choice is historical. Review the current choice.', 409);
    return clientSmsConsent(db, client, clientId);
  };
  const saved = await receipt();
  if (saved) return replay(saved);
  const before = await latest(db, clientId, c.id);
  insist((body.lastId ?? null) === (before?.id ?? null), 'The SMS choice changed. Refresh and review it again.', 409);
  const [live, done] = guard(db, `${liveSessionSql} AND EXISTS(SELECT 1 FROM b_portal_grants g JOIN b_client_contacts c ON c.id=g.contact_id
    WHERE g.account_id=? AND g.client_id=? AND g.contact_id=? AND c.revision=? AND c.phone=? AND c.language=? AND ${liveGrantSql('g')})
    AND COALESCE((SELECT id FROM b_sms_consents WHERE client_id=? AND contact_id=? ORDER BY sequence DESC LIMIT 1),'')=?`,
    client.sessionId, client.accountId, now(), client.accountId, clientId, c.id, c.revision, c.phone, language, clientId, c.id, before?.id ?? '');
  const eventId = id(), at = now(), actor = `client portal account ${client.accountId}`;
  try {
    await db.batch([live, stmt(db, `INSERT INTO b_sms_consents(id,client_id,contact_id,account_id,contact_revision,phone,wording_version,wording,language,choice,actor,at,sequence,key_digest,payload_digest)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, eventId, clientId, c.id, client.accountId, c.revision, c.phone, VERSION, tr(language, 'sms.wording'), language, body.choice, actor, at, (before?.sequence ?? 0) + 1, key, payload),
      stmt(db, 'INSERT INTO b_audit(id,actor,action,object_id,detail,at) VALUES(?,?,?,?,?,?)', id(), actor, 'sms.choice_recorded', clientId, `${eventId}: contact ${c.id}; ${body.choice}; ${VERSION}; no sending authority`, at), done]);
  } catch (error) {
    if (/constraint|b_guard|UNIQUE/i.test(String(error))) {
      const winner = await receipt();
      if (winner) return replay(winner);
      throw new Fault('The contact, session or SMS choice changed. Refresh and try again.', 409);
    }
    throw error;
  }
  return clientSmsConsent(db, client, clientId);
}

/** Staff may inspect attributed evidence, including its original entity after a merge; they never choose for the client. */
export async function smsConsentEvidence(db: D1Database, actor: Actor, clientId: string) {
  insist(actor.channel === 'person', 'A current staff session is required', 403);
  await readableClient(db, actor, clientId);
  const events = await rows(db, `SELECT * FROM b_sms_consents WHERE client_id=? OR client_id IN (SELECT id FROM b_clients WHERE merged_into=?) ORDER BY at DESC,sequence DESC`, clientId, clientId);
  await atomic(db, actor, [audit(db, actor, 'sms.evidence_read', clientId, `${events.length} historical contact choices; no sending authority`)]);
  return { events: events.map(evidence), sendingAvailable: false, carrierVerified: false };
}
