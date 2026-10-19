import { eligible } from './jobs';
import { clientContacts, readableClient } from './client-contacts';
import { atomic, audit, email, guard, human, id, insist, need, now, optional, stmt, text, type Actor, type Data } from './model';

export async function entityValues(db: D1Database, body: Data, previous: Data = {}): Promise<Data> {
  const type = body.entityType ?? previous.entity_type ?? 'business';
  insist(['individual','business','trust'].includes(type), 'Choose individual, business or trust');
  const partner = body.partnerEmail === undefined ? previous.partner_email ?? '' : body.partnerEmail ? email(body.partnerEmail, 'Responsible partner') : '';
  insist(!partner || await eligible(db, partner, ['reviewer']), 'Responsible partner must be an active reviewer or principal');
  const team = body.team === undefined ? JSON.parse(previous.team ?? '[]') : body.team;
  insist(Array.isArray(team) && team.length <= 50, 'Choose at most 50 team members');
  const normalizedTeam: string[] = [];
  for (const person of team) { const address = email(person, 'Team member'); insist(await eligible(db,address,['preparer','reviewer']), 'Team members must be active practice members'); normalizedTeam.push(address); }
  const services = body.services === undefined ? JSON.parse(previous.services ?? '[]') : body.services;
  insist(Array.isArray(services) && services.length <= 30, 'Record at most 30 services');
  const owner = body.ownerClientId === undefined ? previous.owner_client_id ?? null : body.ownerClientId ? text(body.ownerClientId, 'Related owner client') : null;
  if (owner) {
    insist(owner !== previous.id, 'An entity cannot own itself');
    insist(await stmt(db, 'SELECT 1 FROM b_clients WHERE id=? AND merged_into IS NULL', owner).first(), 'Related owner client not found', 404);
    if (previous.id) insist(!await stmt(db, `WITH RECURSIVE chain(id,owner) AS (SELECT id,owner_client_id FROM b_clients WHERE id=? UNION SELECT c.id,c.owner_client_id FROM b_clients c JOIN chain ON c.id=chain.owner) SELECT 1 FROM chain WHERE id=?`, owner, previous.id).first(), 'Entity relationship would form a cycle');
  }
  const last4 = body.ssnLast4 === undefined ? previous.ssn_last4 ?? '' : optional(body.ssnLast4,'Last four SSN digits',4);
  insist(!last4 || /^\d{4}$/.test(last4), 'SSN: supply only the last four digits');
  insist(!last4 || type === 'individual', 'SSN digits belong only to an individual');
  return { entity_type:type, partner_email:partner, team:JSON.stringify([...new Set(normalizedTeam)]), services:JSON.stringify([...new Set(services.map(s => text(s,'Service',120)))]), owner_client_id:owner, ssn_last4:last4 };
}
export async function clientDetail(db: D1Database, actor: Actor, clientId: string) {
  const c = await readableClient(db,actor,clientId), contacts = await clientContacts(db,actor,clientId);
  return { ...c, ssn_last4: c.ssn_last4 ? '•••••' + c.ssn_last4 : '', team:JSON.parse(c.team), services:JSON.parse(c.services), contacts };
}
export async function setClientLifecycle(db: D1Database, actor: Actor, clientId: string, body: Data) {
  human(actor); need(actor,'owner','reviewer');
  const c = await readableClient(db,actor,clientId), status = body.lifecycle;
  insist(status === 'active' || status === 'archived', 'Choose active or archived');
  insist(body.revision === c.revision, 'The client changed. Refresh and try again.',409);
  const [check,release] = guard(db,'EXISTS(SELECT 1 FROM b_clients WHERE id=? AND revision=? AND merged_into IS NULL)',clientId,c.revision);
  await atomic(db,actor,[check,stmt(db,'UPDATE b_clients SET lifecycle=?,archived_at=?,archived_by=?,revision=? WHERE id=?',status,status==='archived'?now():null,status==='archived'?actor.email:null,id(),clientId),
    ...(status==='archived'?[stmt(db,'UPDATE b_portal_links SET revoked_at=? WHERE revoked_at IS NULL AND job_id IN (SELECT id FROM b_jobs WHERE client_id=?)',now(),clientId)]:[]),
    audit(db,actor,status==='archived'?'client.archived':'client.reactivated',clientId,c.name),release]);
  return clientDetail(db,actor,clientId);
}
