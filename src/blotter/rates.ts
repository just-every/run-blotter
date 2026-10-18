// Rate cards (TIME-003): hourly rates by staff member, practice role, service
// (the engagement template) and client, each in force from its effective date.
// Precedence: client and service, then client, then service, then staff
// member, then role. A new card applies from its date; recorded time keeps the
// rate and source it snapshotted.
import { atomic, audit, date, email, human, id, insist, integer, need, now, rows, stmt, type Actor, type Data, type Role } from './model';

export const SCOPES = ['client_service', 'client', 'service', 'staff', 'role'] as const;
type Scope = typeof SCOPES[number];
export type Resolved = { cardId: string | null; source: Scope; rateCents: number };

/** Every card that could apply to this entry, best first. Rates saved before
 * rate cards (b_rates) count as staff rates in force from the start. */
function candidates(entry: { date: string; clientId: string; templateId: string; email: string; role: Role }) {
  return {
    sql: `SELECT id card_id,scope source,rate_cents FROM (
      SELECT id,scope,rate_cents,effective_from,created_at,CASE scope WHEN 'client_service' THEN 1 WHEN 'client' THEN 2 WHEN 'service' THEN 3 WHEN 'staff' THEN 4 ELSE 5 END rank
        FROM b_rate_cards WHERE effective_from<=? AND ((scope='client_service' AND client_id=? AND template_id=?) OR (scope='client' AND client_id=?)
          OR (scope='service' AND template_id=?) OR (scope='staff' AND person_email=?) OR (scope='role' AND role=?))
      UNION ALL SELECT NULL,'staff',rate_cents,'',updated_at,4 FROM b_rates WHERE email=?
    ) ORDER BY rank,effective_from DESC,created_at DESC,id DESC LIMIT 1`,
    params: [entry.date, entry.clientId, entry.templateId, entry.clientId, entry.templateId, entry.email, entry.role, entry.email],
  };
}

export async function resolveRate(db: D1Database, entry: Parameters<typeof candidates>[0]) {
  const q = candidates(entry);
  const found = await stmt(db, q.sql, ...q.params).first<Data>();
  return found ? { cardId: found.card_id ?? null, source: found.source as Scope, rateCents: Number(found.rate_cents) } as Resolved : null;
}

/** SQL that holds only while the same card still resolves for this entry (for a batch guard). */
export function stillResolves(entry: Parameters<typeof candidates>[0], resolved: Resolved) {
  const q = candidates(entry);
  return { sql: `EXISTS(SELECT 1 FROM (${q.sql}) WHERE coalesce(card_id,'')=? AND source=? AND rate_cents=?)`, params: [...q.params, resolved.cardId ?? '', resolved.source, resolved.rateCents] };
}

export async function setRate(db: D1Database, actor: Actor, body: Data) {
  human(actor); need(actor, 'owner');
  const scope = (body.scope ?? 'staff') as Scope;
  insist(SCOPES.includes(scope), 'Choose a staff member, role, service, client, or client and service rate');
  const card = {
    id: id(), scope, rateCents: integer(body.rateCents, 'Hourly rate in cents', 0, 1_000_000), effectiveFrom: date(body.effectiveFrom, 'Effective from'),
    personEmail: null as string | null, role: null as string | null, templateId: null as string | null, clientId: null as string | null,
  };
  if (scope === 'staff') {
    card.personEmail = email(body.email);
    const known = card.personEmail === actor.email || await stmt(db, 'SELECT 1 FROM b_members WHERE email=?', card.personEmail).first();
    insist(known, 'Add the person to the practice first', 404);
  }
  if (scope === 'role') {
    insist(['owner', 'reviewer', 'preparer'].includes(body.role), 'Choose principal, reviewer or preparer');
    card.role = body.role;
  }
  if (scope === 'service' || scope === 'client_service') {
    insist(await stmt(db, 'SELECT 1 FROM b_templates WHERE id=?', String(body.templateId ?? '')).first(), 'Service template not found', 404);
    card.templateId = String(body.templateId);
  }
  if (scope === 'client' || scope === 'client_service') {
    insist(await stmt(db, 'SELECT 1 FROM b_clients WHERE id=?', String(body.clientId ?? '')).first(), 'Client not found', 404);
    card.clientId = String(body.clientId);
  }
  await atomic(db, actor, [
    stmt(db, 'INSERT INTO b_rate_cards(id,scope,person_email,role,template_id,client_id,rate_cents,effective_from,created_by,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)',
      card.id, scope, card.personEmail, card.role, card.templateId, card.clientId, card.rateCents, card.effectiveFrom, actor.email, now()),
    audit(db, actor, 'rate.set', card.id, `${scope} ${card.personEmail ?? card.role ?? ''}${card.clientId ?? ''}${card.templateId ? ' ' + card.templateId : ''} ${card.rateCents} from ${card.effectiveFrom}`.replace(/\s+/g, ' ').trim()),
  ]);
  return card;
}

/** Rate cards with what each applies to; preparers and reviewers see only their own staff rates. */
export async function rateCards(db: D1Database, actor: Actor) {
  const all = `SELECT r.*,c.name client_name,t.name template_name FROM b_rate_cards r LEFT JOIN b_clients c ON c.id=r.client_id LEFT JOIN b_templates t ON t.id=r.template_id`;
  return actor.role === 'owner'
    ? rows(db, `${all} ORDER BY r.scope,r.effective_from DESC,r.created_at DESC`)
    : rows(db, `${all} WHERE r.scope='staff' AND r.person_email=? ORDER BY r.effective_from DESC,r.created_at DESC`, actor.email);
}
