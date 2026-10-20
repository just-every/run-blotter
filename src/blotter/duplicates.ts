// Duplicate client proposals (CRM-004: proposals, side-by-side compare and
// dismissal; merging and undo are in merges.ts). Blotter proposes two
// clients as likely duplicates, whatever created them (by hand, a CSV move-in,
// or any later source), when they share a contact email (case-insensitive), an
// EIN (the client's tax id column), or a name: equal once lower-cased, accents, punctuation, "&"/"and"
// and business suffixes (Inc, LLC, Ltd, Pty, Co, Corp, ...) are set aside, or
// similar (at least two words and at least 75% of their distinct words shared).
// Contact phone and individual SSN-last-four matches propose review, never identity authority.
import { atomic, audit, human, insist, need, now, rows, stmt, text, type Actor, type Data } from './model';

const SUFFIXES = new Set(['inc', 'llc', 'ltd', 'pty', 'co', 'corp', 'corporation', 'company', 'limited', 'plc', 'lp', 'llp', 'pc', 'pllc', 'the']);
export function nameWords(name: string) {
  return name.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(w => w && !SUFFIXES.has(w));
}
export function reasons(a: Data, b: Data) {
  const found: string[] = [];
  if (a.abn && a.abn === b.abn) found.push(String(a.abn).length === 11 ? 'same legacy ABN' : 'same EIN');
  const list = (c: Data, key: string, legacy = ''): string[] => c[key] ? JSON.parse(c[key]) : legacy ? [legacy.toLowerCase()] : [];
  const emails = list(a,'contact_emails',a.contact_email), phones = list(a,'contact_phones');
  if (emails.some(e => list(b,'contact_emails',b.contact_email).includes(e))) found.push('same contact email');
  if (phones.some(p => list(b,'contact_phones').includes(p))) found.push('same phone');
  if (a.ssn_last4 && a.ssn_last4 === b.ssn_last4) found.push('same last four SSN digits');
  const x = new Set(nameWords(a.name)), y = new Set(nameWords(b.name));
  const shared = [...x].filter(w => y.has(w)).length, union = new Set([...x, ...y]).size;
  if (x.size && [...x].join(' ') === [...y].join(' ')) found.push('same name');
  else if (x.size >= 2 && y.size >= 2 && shared / union >= 0.75) found.push('similar name');
  return found;
}
const WEIGHT: Record<string, number> = { 'same EIN': 3, 'same legacy ABN': 3, 'same contact email': 2, 'same phone': 2, 'same last four SSN digits': 1, 'same name': 2, 'similar name': 1 };
const pair = (a: string, b: string) => a < b ? [a, b] : [b, a];

/** Likely duplicate pairs, strongest first, without pairs a person dismissed. */
export async function duplicates(db: D1Database, actor: Actor) {
  need(actor, 'owner', 'reviewer');
  const clients = await rows(db, `SELECT c.*,(SELECT json_group_array(email) FROM b_client_contacts WHERE client_id=c.id AND active=1 AND email<>'') contact_emails,(SELECT json_group_array(phone) FROM b_client_contacts WHERE client_id=c.id AND active=1 AND phone<>'') contact_phones FROM b_clients c WHERE merged_into IS NULL ORDER BY created_at,id`);
  const dismissed = new Set((await rows(db, 'SELECT client_a,client_b FROM b_duplicate_dismissals')).map(d => d.client_a + ' ' + d.client_b));
  const found: Data[] = [];
  for (const [i, a] of clients.entries()) for (const b of clients.slice(i + 1)) {
    const why = reasons(a, b);
    if (why.length && !dismissed.has(pair(a.id, b.id).join(' '))) found.push({ a:{...a,ssn_last4:a.ssn_last4 ? '•••••'+a.ssn_last4 : ''}, b:{...b,ssn_last4:b.ssn_last4 ? '•••••'+b.ssn_last4 : ''}, reasons: why, score: why.reduce((s, r) => s + WEIGHT[r], 0) });
  }
  return found.sort((x, y) => y.score - x.score);
}

export async function client(db: D1Database, clientId: unknown) {
  const c = await stmt(db, `SELECT c.*,(SELECT json_group_array(email) FROM b_client_contacts WHERE client_id=c.id AND active=1 AND email<>'') contact_emails,(SELECT json_group_array(phone) FROM b_client_contacts WHERE client_id=c.id AND active=1 AND phone<>'') contact_phones FROM b_clients c WHERE id=?`, text(clientId, 'Client')).first<Data>();
  insist(c, 'Client not found', 404);
  return c;
}
export const linked = async (db: D1Database, id: string) => stmt(db, `SELECT
  (SELECT COUNT(*) FROM b_jobs WHERE client_id=?1) jobs, (SELECT COUNT(*) FROM b_jobs WHERE client_id=?1 AND status<>'signed_off') open_jobs,
  (SELECT COUNT(*) FROM b_threads WHERE client_id=?1) threads, (SELECT COUNT(*) FROM b_notices WHERE client_id=?1) notices,
  (SELECT COUNT(*) FROM b_expenses WHERE client_id=?1) expenses, (SELECT COUNT(*) FROM b_recurrence_rules WHERE client_id=?1) rules,
  (SELECT COUNT(*) FROM b_client_contacts WHERE client_id=?1) contacts,(SELECT COUNT(*) FROM b_clients WHERE owner_client_id=?1 AND merged_into IS NULL) relationships,
  (SELECT COUNT(*) FROM b_client_group_members WHERE client_id=?1) groups, (SELECT COUNT(*) FROM b_rate_cards WHERE client_id=?1) rates, (SELECT COUNT(*) FROM b_client_obligations WHERE client_id=?1) obligations`, id).first<Data>() as Promise<Data>;
/** Every field a merge chooses between, with both values; `source` is shown but each record keeps its own source IDs. */
export function fieldRows(a: Data, b: Data) {
  const fa = JSON.parse(a.fields), fb = JSON.parse(b.fields);
  return [['name', 'Name'], ['abn', 'Tax ID (EIN or legacy ABN)'], ['contact_name', 'Contact name'], ['contact_email', 'Contact email'], ['entity_type','Entity type'], ['partner_email','Responsible partner'], ['team','Assigned team'], ['services','Service scope'], ['owner_client_id','Related owner'], ['ssn_last4','Last four SSN digits'], ['lifecycle','Lifecycle'], ['source', 'Came from'], ['tags', 'Tags']]
    .map(([key, label]) => ({ key, label, a: a[key], b: b[key], same: a[key] === b[key] }))
    .concat([...new Set([...Object.keys(fa), ...Object.keys(fb)])].sort().map(key => ({ key: 'fields.' + key, label: key, a: fa[key] ?? '', b: fb[key] ?? '', same: fa[key] === fb[key] })));
}

/** Two clients side by side: each field, whether it matches, what is linked to each, and why they were proposed. */
export async function compareClients(db: D1Database, actor: Actor, query: Data) {
  need(actor, 'owner', 'reviewer');
  const [a, b] = [await client(db, query.a), await client(db, query.b)];
  insist(a.id !== b.id, 'Choose two different clients');
  const fields = fieldRows(a, b).map(f => f.key === 'ssn_last4' ? {...f,a:f.a ? '•••••'+String(f.a).slice(-4) : '',b:f.b ? '•••••'+String(f.b).slice(-4) : ''} : f);
  return { a: { id: a.id, name: a.name, linked: await linked(db, a.id), contacts:await rows(db,'SELECT * FROM b_client_contacts WHERE client_id=? ORDER BY name,id',a.id) }, b: { id: b.id, name: b.name, linked: await linked(db, b.id), contacts:await rows(db,'SELECT * FROM b_client_contacts WHERE client_id=? ORDER BY name,id',b.id) }, reasons: reasons(a, b), fields };
}

/** A person records that a proposed pair is not a duplicate; it is not proposed again. */
export async function dismissPair(db: D1Database, actor: Actor, body: Data) {
  human(actor); need(actor, 'owner', 'reviewer');
  const [a, b] = [await client(db, body.a), await client(db, body.b)];
  insist(a.id !== b.id, 'Choose two different clients');
  insist(reasons(a, b).length > 0, 'These clients are not proposed as duplicates', 409);
  const [x, y] = pair(a.id, b.id), reason = text(body.reason, 'Why these are different clients', 500);
  insist(!await stmt(db, 'SELECT 1 FROM b_duplicate_dismissals WHERE client_a=? AND client_b=?', x, y).first(), 'Already marked as different clients', 409);
  await atomic(db, actor, [stmt(db, 'INSERT INTO b_duplicate_dismissals(client_a,client_b,reason,by_email,at) VALUES(?,?,?,?,?)', x, y, reason, actor.email, now()),
    audit(db, actor, 'client.not_duplicate', x, `${a.name} / ${b.name}: ${reason}`)]);
  return { dismissed: [x, y] };
}
