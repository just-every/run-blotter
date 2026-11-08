import { retainAgentEvidence } from './custody.ts';
import { operatorAuth, authConfig, type Bindings } from '../../auth.server.ts';
import { operatorAuthPeople, type PeopleAdapter, type Person, ToolRefusal, type ToolContext } from '../../modules/agent-door/index.ts';
import { person as sessionPerson, agent as keyActor } from '../session.ts';
import { accessActor } from '../permissions.ts';
import { agentGate } from '../mfa.ts';
import { Fault, stmt, type Actor, type Role } from '../model.ts';

/** The operator id is durable; practice admission and client grants remain native. */
export function people(env: Bindings): PeopleAdapter {
 const native = operatorAuthPeople({ db: env.DB, allowList: authConfig(env).allowList, session: request => operatorAuth(env).getSession(request) });
 const read = async (id: string): Promise<Person | null> => {
  const operator = await native.person(id);
  if (!operator?.active) return null;
  const member = await stmt(env.DB, 'SELECT role FROM b_members WHERE email=? AND active=1', operator.email).first<{role: Role}>();
  const role = operator.role === 'owner' ? 'owner' : member?.role;
  if (!role) return null;
  try { await agentGate(env.DB, operator.email); } catch { return null; }
  let binding=await native.businessMember?.(operator);
  if(binding?.role!=='owner'&&!await stmt(env.DB,"SELECT 1 FROM bs_team t JOIN bs_settings s ON s.singleton=1 AND s.stopped=0 WHERE t.operator_id=? AND t.state='active'",operator.id).first())binding=null;
  return { ...operator, role, policyRole: binding?.role ?? null } as Person;
 };
 return {
  async person(id) {const current=await read(id);if(current?.active)await retainAgentEvidence(env.DB);return current;},
  async sponsor(claims) {
   const settings=await stmt(env.DB,'SELECT owner_id FROM bs_settings WHERE singleton=1 AND stopped=0').first<{owner_id:string}>();
   if(!settings)return null;
   if(settings.owner_id!==claims.sub&&!await stmt(env.DB,"SELECT 1 FROM bs_team WHERE business_id=? AND state='active'",claims.sub).first())return null;
   const bound = await native.sponsor(claims),current=bound?await read(bound.id):null;
   if(current?.active)await retainAgentEvidence(env.DB);return current;
  },
  async businessMember(person) {
   if(!await stmt(env.DB,'SELECT 1 FROM bs_settings WHERE singleton=1 AND stopped=0').first())return null;
   const member=await native.businessMember?.(person);
   if(!member||member.role==='owner')return member??null;
   return await stmt(env.DB,"SELECT 1 FROM bs_team WHERE business_id=? AND state='active'",member.id).first()?member:null;
  },
  // A local reviewer/admin never becomes a Business policy editor by promotion.
  businessRole: person => env.RER_BUSINESS_TRUST ? (person as Person & {policyRole?:'owner'|'editor'|null}).policyRole ?? null : person.role === 'owner' ? 'owner' : null,
  async session(request) {
   try { const actor = await sessionPerson(request, env); return read(actor.id); }
   catch (error) { if (error instanceof Fault) return null; throw error; }
  },
 };
}

export const scopes = ['context:read', 'proposals:write', 'readiness:read', 'readiness:write', 'learning:read', 'learning:write', 'plans:read', 'plans:write'];
export async function localCredential(request: Request, env: Bindings) {
 try {
  const actor = await keyActor(request, env);
  await retainAgentEvidence(env.DB);
  return { sponsor: { id: actor.id }, agent: { id: `blotter-key:${actor.agentKeyId}`, name: actor.label!, specialist: 'practice coordinator' },
   clientId: `blotter-key:${actor.agentKeyId}`, scopes: await keyScopes(env.DB, actor.agentKeyId!) };
 } catch (error) { if (error instanceof Fault) return null; throw error; }
}
export async function keyScopes(db: D1Database, keyId: string) {
 const key = await stmt(db, 'SELECT id FROM b_agent_keys WHERE id=? AND revoked=0', keyId).first();
 if (!key) return [];
 const limited = await stmt(db, 'SELECT 1 FROM b_agent_rules WHERE key_id=?', keyId).first();
 return limited ? ['context:read', 'plans:read', 'plans:write'] : scopes;
}
export async function nativeActor(ctx: Pick<ToolContext, 'db' | 'person' | 'agent' | 'clientId'>): Promise<Actor> {
 const row = await stmt(ctx.db, `SELECT o.id,o.email,o.display_name,o.role,m.role member_role FROM oa_operators o
 LEFT JOIN b_members m ON m.email=o.email AND m.active=1 WHERE o.id=? AND o.status='active'`, ctx.person.id).first<any>();
 if (!row || (row.role !== 'owner' && !row.member_role)) throw new ToolRefusal('unauthenticated');
 await agentGate(ctx.db, row.email);
 const keyId = ctx.clientId?.startsWith('blotter-key:') ? ctx.clientId.slice(12) : undefined;
 if (keyId && !await stmt(ctx.db, 'SELECT 1 FROM b_agent_keys WHERE id=? AND owner_id=? AND revoked=0', keyId, row.id).first()) throw new ToolRefusal('unauthenticated');
 return accessActor(ctx.db, { id: row.id, email: row.email, name: row.display_name, role: row.role === 'owner' ? 'owner' : row.member_role,
  channel: 'agent', label: ctx.agent.name, agentKeyId: keyId, doorAgent: { id: ctx.agent.id, name: ctx.agent.name } });
}
