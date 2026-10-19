// Practice members, invitations and agent keys. Rate cards are in rates.ts.
// Adapted from just-every/run-satchel src/satchel/team.ts (MIT).
import { type Bindings, operatorAuth, runtimeBindings } from '../auth.server';
import { atomic, audit, digest, email, human, id, insist, need, now, rows, secret, stmt, text, type Actor, type Data } from './model';
import { rateCards, resolveRate } from './rates';
import { deactivation } from './offboarding';

export async function saveMember(db: D1Database, actor: Actor, body: Data) {
  human(actor); need(actor, 'owner');
  const address = email(body.email), name = text(body.name, 'Name', 100);
  insist(body.role === 'reviewer' || body.role === 'preparer', 'Choose reviewer or preparer');
  const active = body.active === false || body.active === 'false' ? 0 : 1;
  await atomic(db, actor, [
    stmt(db, 'INSERT INTO b_members(email,name,role,active) VALUES(?,?,?,?) ON CONFLICT(email) DO UPDATE SET name=excluded.name,role=excluded.role,active=excluded.active', address, name, body.role, active),
    ...(active ? [] : deactivation(db, address)),
    audit(db, actor, active ? 'member.saved' : 'member.deactivated', address, body.role),
  ]);
  return { email: address, name, role: body.role, active: !!active };
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
  const owner = actor.role === 'owner', today = now().slice(0, 10);
  // A person's own rate today, before any client or service override.
  const ownRate = async (address: string, role: Data['role']) => (await resolveRate(db, { date: today, clientId: '', templateId: '', email: address, role }))?.rateCents ?? null;
  const members = owner || actor.role === 'reviewer' ? await rows(db, 'SELECT * FROM b_members ORDER BY name') : [];
  return {
    members: await Promise.all(members.map(async m => ({ ...m, rate_cents: await ownRate(m.email, m.role) }))),
    ownRateCents: await ownRate(actor.email, actor.role),
    rates: await rateCards(db, actor),
    keys: await rows(db, 'SELECT id,label,revoked,created_at FROM b_agent_keys WHERE owner_id=? ORDER BY created_at DESC', actor.id),
    audit: owner ? await rows(db, 'SELECT * FROM b_audit ORDER BY at DESC LIMIT 100') : [],
  };
}
