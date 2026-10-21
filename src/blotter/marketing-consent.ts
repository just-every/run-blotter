// Marketing consent (MSG-002; ct 20 Oct 21:21Z). An append-only log: staff
// record a contact's own explicit opt-in or withdrawal with evidence, the
// unsubscribe page and provider complaints record withdrawals, and only the
// principal records a correction. Grants belong to one contact relationship;
// withdrawals apply to the address across the whole firm. Product policy, not
// legal certification.
import { atomic, audit, human, id, insist, need, now, optional, rows, stmt, text, type Actor, type Data } from './model';

/** An event a later owner correction voided. */
export const voided = (alias: string) => `EXISTS(SELECT 1 FROM b_marketing_consents v WHERE v.corrects_id=${alias}.id)`;
/**
 * The contact `c` holds an email grant later than every withdrawal of its address (a withdrawal at the same
 * instant wins) and later than any standing contact-merge hold on it (CRM-004: the most restrictive consent wins).
 */
export const marketingGrantSql = `EXISTS(SELECT 1 FROM b_marketing_consents g WHERE g.contact_id=c.id AND g.kind='grant' AND g.channel='email' AND g.address=c.email AND NOT ${voided('g')}
  AND NOT EXISTS(SELECT 1 FROM b_marketing_consents w WHERE w.address=c.email AND w.kind='withdraw' AND w.channel='email' AND NOT ${voided('w')} AND w.acted_at>=g.acted_at)
  AND NOT EXISTS(SELECT 1 FROM b_marketing_merge_holds h WHERE h.contact_id=c.id AND h.held_at>=g.acted_at))`;
export const withdrawnSql = `EXISTS(SELECT 1 FROM b_marketing_consents w WHERE w.address=c.email AND w.kind='withdraw' AND w.channel='email' AND NOT ${voided('w')})`;
const STAFF_SOURCES = ['staff_evidence', 'staff_reply'];
/** The public intake form's optional, unticked marketing checkbox (CRM-005 carrier), kept apart from the reply consent. */
export const INTAKE_MARKETING = { wording: 'Optional: also email me newsletters, seminar invitations and offers from this practice. I can unsubscribe at any time.', version: 'intake-marketing-v1', language: 'en' };

/** Contacts, by id, holding a current marketing grant. */
export async function grantedContacts(db: D1Database, ids: string[]) {
  return new Set(ids.length ? (await rows(db, `SELECT c.id FROM b_client_contacts c WHERE c.id IN (SELECT value FROM json_each(?)) AND ${marketingGrantSql}`, JSON.stringify(ids))).map(r => String(r.id)) : []);
}

/**
 * A prospect's own intake opt-in, recorded against its converted contact when the prospect is won: the contact
 * acted when the inquiry was submitted; the person winning the prospect records the carried grant.
 */
export function intakeGrantStatements(db: D1Database, actor: Actor, contactId: string, clientId: string, address: string, optIn: Data, prospectId: string) {
  return [stmt(db, `INSERT INTO b_marketing_consents(id,contact_id,client_id,address,channel,kind,source,acted_at,recorded_at,actor,wording,wording_version,language,evidence) VALUES(?,?,?,?,'email','grant','intake_checkbox',?,?,?,?,?,?,?)`,
    id(), contactId, clientId, address, optIn.at, now(), actor.email, optIn.wording, optIn.version, optIn.language, `website intake checkbox on prospect ${prospectId}`),
    audit(db, actor, 'consent.marketing_granted', clientId, `${address}: intake_checkbox`)];
}

function instant(value: unknown, label: string) {
  const v = text(value, label, 40);
  insist(!Number.isNaN(Date.parse(v)) && /T\d{2}:\d{2}/.test(v), `${label}: use an ISO date and time`);
  const at = new Date(v).toISOString();
  insist(at <= new Date(Date.now() + 300_000).toISOString(), `${label} cannot be in the future`);
  return at;
}

/** Marketing stays off after a restore until the principal confirms the consent log is current. */
export async function marketingHold(db: D1Database) {
  const restored = await stmt(db, 'SELECT 1 FROM b_marketing_consents WHERE restored=1 LIMIT 1').first();
  const confirmed = await stmt(db, 'SELECT 1 FROM b_marketing_confirmations LIMIT 1').first();
  return restored && !confirmed ? 'Marketing is off after a restore until the principal confirms the consent log is current' : '';
}

export async function confirmMarketing(db: D1Database, actor: Actor, body: Data) {
  human(actor); need(actor, 'owner');
  const note = text(body.note, 'What you checked', 500), confirmationId = id();
  await atomic(db, actor, [stmt(db, 'INSERT INTO b_marketing_confirmations(id,confirmed_by,confirmed_at,note) VALUES(?,?,?,?)', confirmationId, actor.email, now(), note),
    audit(db, actor, 'consent.log_confirmed', 'firm', note)]);
  return { id: confirmationId, hold: await marketingHold(db) };
}

/** A staff member records a contact's own opt-in or withdrawal, with its evidence. */
export async function recordConsent(db: D1Database, actor: Actor, body: Data) {
  human(actor); need(actor, 'owner', 'reviewer');
  const contact = await stmt(db, `SELECT c.*,e.lifecycle,e.merged_into FROM b_client_contacts c JOIN b_clients e ON e.id=c.client_id WHERE c.id=?`, text(body.contactId, 'Contact')).first<Data>();
  insist(contact, 'Contact not found', 404);
  insist(contact.email, 'This contact has no email address', 409);
  insist(body.channel === undefined || body.channel === 'email', 'Portal marketing waits for portal accounts (PORTAL-002); record email consent only', 409);
  insist(body.kind === 'grant' || body.kind === 'withdraw', 'Choose grant or withdraw');
  const source = body.source === 'staff_reply' ? 'staff_reply' : 'staff_evidence';
  insist(body.kind === 'withdraw' || source === 'staff_evidence', 'A reply records a withdrawal; record a grant with its evidence');
  insist(body.kind === 'withdraw' || (contact.active && contact.lifecycle === 'active' && !contact.merged_into), 'Record a grant only for an active contact on an active client', 409);
  const event = { id: id(), actedAt: instant(body.actedAt, 'When the contact acted'), evidence: text(body.evidence, 'Evidence', 1000),
    wording: body.kind === 'grant' ? text(body.wording, 'Exact consent wording', 1000) : optional(body.wording, 'Wording', 1000),
    version: body.kind === 'grant' ? text(body.wordingVersion, 'Wording version', 60) : optional(body.wordingVersion, 'Wording version', 60), language: optional(body.language, 'Language', 20) || 'en' };
  await atomic(db, actor, [
    stmt(db, `INSERT INTO b_marketing_consents(id,contact_id,client_id,address,channel,kind,source,acted_at,recorded_at,actor,wording,wording_version,language,evidence) VALUES(?,?,?,?,'email',?,?,?,?,?,?,?,?,?)`,
      event.id, contact.id, contact.client_id, contact.email, body.kind, source, event.actedAt, now(), actor.email, event.wording, event.version, event.language, event.evidence),
    audit(db, actor, body.kind === 'grant' ? 'consent.marketing_granted' : 'consent.marketing_withdrawn', contact.client_id, `${contact.email}: ${source}`)]);
  return { id: event.id, kind: body.kind, address: contact.email };
}

/** A withdrawal of the whole address, effective immediately (unsubscribe page, one-click header or provider complaint). */
export function withdrawStatements(db: D1Database, address: string, source: 'unsubscribe_link' | 'one_click' | 'provider_complaint', who: string, evidence: string, clientId: string | null) {
  const at = now(), eventId = id();
  return [stmt(db, `INSERT INTO b_marketing_consents(id,client_id,address,channel,kind,source,acted_at,recorded_at,actor,evidence) VALUES(?,?,?,'email','withdraw',?,?,?,?,?)`, eventId, clientId, address, source, at, at, who, evidence),
    stmt(db, 'INSERT INTO b_audit(id,actor,action,object_id,detail,at) VALUES(?,?,?,?,?,?)', id(), who, 'consent.marketing_withdrawn', clientId ?? 'firm', `${address}: ${source}`, at)];
}

/**
 * Only the principal corrects, naming the event and a reason. A correction voids
 * a mistaken grant or a withdrawal staff recorded against the wrong contact,
 * never a withdrawal the contact made themselves.
 */
export async function correctConsent(db: D1Database, actor: Actor, eventId: string, body: Data) {
  human(actor); need(actor, 'owner');
  const event = await stmt(db, 'SELECT * FROM b_marketing_consents WHERE id=?', eventId).first<Data>();
  insist(event && event.kind !== 'correction', 'Consent event not found', 404);
  insist(event.kind === 'grant' || STAFF_SOURCES.includes(event.source), "A contact's own withdrawal cannot be voided; only their later grant revives marketing", 409);
  const reason = text(body.reason, 'Reason', 500), correction = id(), at = now();
  await atomic(db, actor, [
    stmt(db, `INSERT INTO b_marketing_consents(id,contact_id,client_id,address,channel,kind,source,acted_at,recorded_at,actor,corrects_id,reason) VALUES(?,?,?,?,?,'correction','owner_correction',?,?,?,?,?)`,
      correction, event.contact_id, event.client_id, event.address, event.channel, at, at, actor.email, event.id, reason),
    audit(db, actor, 'consent.corrected', event.client_id ?? 'firm', `voided ${event.kind} ${event.id}: ${reason}`)]);
  return { id: correction, voided: event.id };
}

/** The log for one client's contacts (and their addresses), or the whole firm; principal and reviewers only. */
export async function consentLog(db: D1Database, actor: Actor, query: Data = {}) {
  need(actor, 'owner', 'reviewer');
  const clientId = optional(query.clientId, 'Client', 100);
  const events = await rows(db, `SELECT e.*,${voided('e')} voided FROM b_marketing_consents e
    WHERE ?='' OR e.client_id=? OR e.address IN (SELECT email FROM b_client_contacts WHERE client_id=? AND email<>'') ORDER BY e.recorded_at,e.id`, clientId, clientId, clientId);
  const contacts = clientId ? await rows(db, `SELECT c.id,c.name,c.email,c.email_consent,${marketingGrantSql} marketing,${withdrawnSql} withdrawn FROM b_client_contacts c WHERE c.client_id=? AND c.active=1 ORDER BY c.name`, clientId) : [];
  return { events: events.map(e => ({ ...e, voided: !!e.voided })), contacts: contacts.map(c => ({ ...c, marketing: !!c.marketing, withdrawn: !!c.withdrawn })), hold: await marketingHold(db) };
}
