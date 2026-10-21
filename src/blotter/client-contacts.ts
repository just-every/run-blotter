import { requireClient } from './permissions';
// Contact records are entity relationships; a matching email never grants access.
import { atomic, audit, email, guard, human, id, insist, need, now, optional, readableJobParams, readableJobSql, rows, stmt, text, type Actor, type Data } from './model';

export const CONTACT_ROLES = ['primary', 'billing', 'tax', 'bookkeeping'];
export function normalizedPhone(value: unknown) {
  const raw = optional(value, 'Phone', 40);
  if (!raw) return '';
  insist(/^\+?[\d\s().-]+$/.test(raw), 'Phone: use an international number or a US number');
  let digits = raw.replace(/\D/g, '');
  if (!raw.startsWith('+') && digits.length === 10) digits = '1' + digits;
  insist(/^[1-9]\d{7,14}$/.test(digits), 'Phone: use 8 to 15 digits including the country code');
  return '+' + digits;
}
export function contactValues(body: Data, previous: Data = {}): Data {
  const flag = (key: string, column = key) => body[key] === undefined ? Number(previous[column] ?? (key === 'active' ? 1 : 0)) : (() => { insist(typeof body[key] === 'boolean', `${key} must be true or false`); return body[key] ? 1 : 0; })();
  const first = body.firstName === undefined ? previous.first_name ?? '' : optional(body.firstName, 'First name', 100);
  const last = body.lastName === undefined ? previous.last_name ?? '' : optional(body.lastName, 'Last name', 100);
  const name = body.name === undefined ? previous.name ?? [first, last].filter(Boolean).join(' ') : optional(body.name, 'Contact name', 200);
  const address = body.email === undefined ? previous.email ?? '' : body.email ? email(body.email, 'Contact email') : '';
  const roles = body.roles === undefined ? JSON.parse(previous.roles ?? '[]') : body.roles;
  insist(Array.isArray(roles) && roles.length <= 4 && roles.every(r => CONTACT_ROLES.includes(r)), 'Contact roles: choose primary, billing, tax or bookkeeping');
  insist(name || address, 'Record a contact name or email');
  const values = { name, first_name: first, last_name: last, email: address, phone: body.phone === undefined ? previous.phone ?? '' : normalizedPhone(body.phone), roles: JSON.stringify([...new Set(roles)]),
    authorized: flag('authorized'), signer: flag('signer'), portal: flag('portal'), request_consent: flag('requestConsent', 'request_consent'), email_consent: flag('emailConsent', 'email_consent'), active: flag('active'),
    consent_note: body.consentNote === undefined ? previous.consent_note ?? '' : optional(body.consentNote, 'Consent note', 1000) };
  insist(!values.signer || values.authorized, 'A signer must be authorized for this entity');
  insist(!values.portal || values.authorized, 'Portal permission requires entity authority');
  return values;
}
/** A one-time conversion of the previous single-recipient model, never a read fallback. */
export function legacyContactValues(name: string, address: string): Data {
  return contactValues({ name, firstName:name.trim().split(/\s+/)[0] ?? '', email:address, roles:['primary'], authorized:true, portal:!!address, requestConsent:!!address, emailConsent:!!address });
}
export function contactInsert(db: D1Database, actor: Actor, clientId: string, value: Data, contactId: string = id(), at = now()) {
  return stmt(db, `INSERT INTO b_client_contacts(id,client_id,name,first_name,last_name,email,phone,roles,authorized,signer,portal,request_consent,email_consent,active,consent_note,revision,created_by,created_at,updated_by,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    contactId, clientId, value.name, value.first_name, value.last_name, value.email, value.phone, value.roles, value.authorized, value.signer, value.portal, value.request_consent, value.email_consent, value.active, value.consent_note, id(), actor.email, at, actor.email, at);
}
export async function readableClient(db: D1Database, actor: Actor, clientId: string) {
  await requireClient(db,actor,clientId);
  const c = await stmt(db, `SELECT c.* FROM b_clients c WHERE c.id=? AND c.merged_into IS NULL AND (?<>'preparer' OR EXISTS(SELECT 1 FROM b_jobs WHERE b_jobs.client_id=c.id AND ${readableJobSql}))`, clientId, actor.role, ...readableJobParams(actor)).first<Data>();
  insist(c, 'Client not found', 404);
  return c;
}
export async function clientContacts(db: D1Database, actor: Actor, clientId: string): Promise<Data[]> {
  await readableClient(db, actor, clientId);
  return (await rows(db, 'SELECT * FROM b_client_contacts WHERE client_id=? ORDER BY active DESC,name,email,id', clientId)).map(c => ({ ...c, roles: JSON.parse(c.roles) }));
}
export async function saveContact(db: D1Database, actor: Actor, clientId: string, body: Data) {
  human(actor); need(actor, 'owner', 'reviewer');
  const client = await readableClient(db, actor, clientId);
  const previous = body.id ? await stmt(db, 'SELECT * FROM b_client_contacts WHERE id=? AND client_id=?', text(body.id, 'Contact'), clientId).first<Data>() : null;
  insist(!body.id || previous, 'Contact not found', 404);
  insist(!previous || body.revision === previous.revision, 'The contact changed. Refresh and try again.', 409);
  const c = contactValues(body, previous ?? {}), contactId = previous?.id ?? id();
  insist(!c.active || !c.email || !await stmt(db, 'SELECT 1 FROM b_client_contacts WHERE client_id=? AND email=? AND active=1 AND id<>?', clientId, c.email, contactId).first(), 'This email already represents this entity; edit that contact', 409);
  const [check, release] = guard(db, 'EXISTS(SELECT 1 FROM b_clients WHERE id=? AND revision=? AND merged_into IS NULL)', clientId, client.revision);
  await atomic(db, actor, [check, ...(previous ? [stmt(db, `UPDATE b_client_contacts SET name=?,first_name=?,last_name=?,email=?,phone=?,roles=?,authorized=?,signer=?,portal=?,request_consent=?,email_consent=?,active=?,consent_note=?,revision=?,updated_by=?,updated_at=? WHERE id=?`, c.name,c.first_name,c.last_name,c.email,c.phone,c.roles,c.authorized,c.signer,c.portal,c.request_consent,c.email_consent,c.active,c.consent_note,id(),actor.email,now(),contactId)] : [contactInsert(db, actor, clientId, c, contactId)]),
    // Any permission or address edit fences already issued bearer credentials.
    ...(previous ? [stmt(db, 'UPDATE b_portal_links SET revoked_at=? WHERE contact_id=? AND revoked_at IS NULL', now(), contactId)] : []),
    stmt(db,'UPDATE b_clients SET revision=? WHERE id=?',id(),clientId),
    audit(db, actor, previous ? 'client.contact_changed' : 'client.contact_added', clientId, `${contactId}: ${c.name || c.email}`), release]);
  return (await clientContacts(db, actor, clientId)).find(c => c.id === contactId);
}

/** Convert pre-contact demo/archived data once, before admitting app requests. */
export async function ensureLegacyContacts(db: D1Database) {
  await stmt(db, `INSERT INTO b_client_contacts(id,client_id,name,first_name,email,roles,authorized,portal,request_consent,email_consent,revision,created_by,created_at,updated_by,updated_at)
    SELECT 'legacy:'||c.id,c.id,c.contact_name,CASE WHEN instr(trim(c.contact_name),' ')>0 THEN substr(trim(c.contact_name),1,instr(trim(c.contact_name),' ')-1) ELSE trim(c.contact_name) END,
      lower(trim(c.contact_email)),'["primary"]',1,CASE WHEN c.contact_email<>'' THEN 1 ELSE 0 END,CASE WHEN c.contact_email<>'' THEN 1 ELSE 0 END,CASE WHEN c.contact_email<>'' THEN 1 ELSE 0 END,c.revision,'legacy conversion',c.created_at,'legacy conversion',c.created_at
    FROM b_clients c WHERE (c.contact_name<>'' OR c.contact_email<>'') AND NOT EXISTS(SELECT 1 FROM b_client_contacts x WHERE x.client_id=c.id)`).run();
}
