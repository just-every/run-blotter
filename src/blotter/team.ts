// Practice members, hourly rates, invitations and agent keys.
// Adapted from just-every/run-satchel src/satchel/team.ts (MIT).
import { type Bindings, operatorAuth, runtimeBindings } from '../auth.server';
import { atomic, audit, digest, email, human, id, insist, integer, need, now, rows, secret, stmt, text, type Actor, type Data } from './model';

export async function saveMember(db: D1Database, actor: Actor, body: Data) {
  human(actor); need(actor, 'owner');
  const address = email(body.email), name = text(body.name, 'Name', 100);
  insist(body.role === 'reviewer' || body.role === 'preparer', 'Choose reviewer or preparer');
  const active = body.active === false || body.active === 'false' ? 0 : 1;
  await atomic(db, actor, [
    stmt(db, 'INSERT INTO b_members(email,name,role,active) VALUES(?,?,?,?) ON CONFLICT(email) DO UPDATE SET name=excluded.name,role=excluded.role,active=excluded.active', address, name, body.role, active),
    audit(db, actor, active ? 'member.saved' : 'member.deactivated', address, body.role),
  ]);
  return { email: address, name, role: body.role, active: !!active };
}

export async function setRate(db: D1Database, actor: Actor, body: Data) {
  human(actor); need(actor, 'owner');
  const address = email(body.email), rate = integer(body.rateCents, 'Hourly rate in cents', 0, 1_000_000);
  const known = address === actor.email || await stmt(db, 'SELECT 1 FROM b_members WHERE email=?', address).first();
  insist(known, 'Add the person to the practice first', 404);
  await atomic(db, actor, [
    stmt(db, 'INSERT INTO b_rates(email,rate_cents,updated_by,updated_at) VALUES(?,?,?,?) ON CONFLICT(email) DO UPDATE SET rate_cents=excluded.rate_cents,updated_by=excluded.updated_by,updated_at=excluded.updated_at', address, rate, actor.email, now()),
    audit(db, actor, 'rate.set', address, String(rate)),
  ]);
  return { email: address, rateCents: rate };
}

export async function inviteMember(request: Request, env: Bindings, actor: Actor, body: Data) {
  human(actor); need(actor, 'owner');
  const member = await stmt(env.DB, 'SELECT * FROM b_members WHERE email=? AND active=1', email(body.email)).first<Data>();
  insist(member, 'Save an active practice member first', 404);
  return operatorAuth(runtimeBindings(env)).invite(request, { email: member.email, displayName: member.name, role: 'member', returnTo: '/app' });
}

export async function createAgentKey(db: D1Database, actor: Actor, body: Data) {
  human(actor); need(actor, 'owner', 'reviewer');
  const key = secret('blotter_'), keyId = id(), label = text(body.label, 'Agent name', 80);
  await atomic(db, actor, [
    stmt(db, 'INSERT INTO b_agent_keys(id,label,digest,owner_id,revoked,created_at) VALUES(?,?,?,?,0,?)', keyId, label, await digest(key), actor.id, now()),
    audit(db, actor, 'agent.key_created', keyId, label),
  ]);
  return { id: keyId, label, key };
}

export async function revokeAgentKey(db: D1Database, actor: Actor, keyId: string) {
  human(actor);
  await atomic(db, actor, [stmt(db, 'UPDATE b_agent_keys SET revoked=1 WHERE id=? AND owner_id=?', keyId, actor.id), audit(db, actor, 'agent.key_revoked', keyId)]);
  return { ok: true };
}

export async function teamState(db: D1Database, actor: Actor) {
  const owner = actor.role === 'owner';
  return {
    members: owner || actor.role === 'reviewer' ? await rows(db, 'SELECT m.*,r.rate_cents FROM b_members m LEFT JOIN b_rates r ON r.email=m.email ORDER BY m.name') : [],
    rates: owner ? await rows(db, 'SELECT * FROM b_rates ORDER BY email') : await rows(db, 'SELECT * FROM b_rates WHERE email=?', actor.email),
    keys: await rows(db, 'SELECT id,label,revoked,created_at FROM b_agent_keys WHERE owner_id=? ORDER BY created_at DESC', actor.id),
    audit: owner ? await rows(db, 'SELECT * FROM b_audit ORDER BY at DESC LIMIT 100') : [],
  };
}
