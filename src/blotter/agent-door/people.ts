import { operatorAuthPeople, ToolRefusal, type PeopleAdapter, type Person, type ToolContext } from '../../modules/agent-door/index.ts'
import { isActiveOperator } from '../../modules/operator-auth/index.mjs'
import { authConfig, type Bindings } from '../../auth.server'
import { person as nativeSession } from '../session'
import { accessActor } from '../permissions'
import { accessGate, redactAccess } from '../access-gate'
import { agentGate } from '../mfa'
import { Fault, stmt, type Actor, type Data, type Role } from '../model'

export async function nativePerson(env: Bindings, id: string): Promise<Person | null> {
  const operator = await stmt(env.DB, 'SELECT id,email,display_name AS displayName,role,status FROM oa_operators WHERE id=?', id).first<Data>()
  if (!operator || !isActiveOperator(operator as never, authConfig(env).allowList)) return null
  const member = await stmt(env.DB, 'SELECT role FROM b_members WHERE email=? AND active=1', operator.email).first<{ role: Role }>()
  const role = operator.role === 'owner' ? 'owner' : member?.role
  if (!role) return null
  try { await agentGate(env.DB, operator.email) } catch (error) { if (error instanceof Fault) return null; throw error }
  return { id: operator.id, email: operator.email, name: operator.displayName, role, active: true }
}

export function practicePeople(env: Bindings): PeopleAdapter {
  const mapped = operatorAuthPeople({ db: env.DB, allowList: authConfig(env).allowList, session: async () => null })
  return {
    person: id => nativePerson(env, id),
    async sponsor(claims) { const identity = await mapped.sponsor(claims); return identity ? nativePerson(env, identity.id) : null },
    async businessMember(person) { return await nativePerson(env, person.id) ? mapped.businessMember!(person) : null },
    async session(request) {
      try { const actor = await nativeSession(request, env); return { id: actor.id, email: actor.email, name: actor.name, role: actor.role, active: true } }
      catch (error) { if (error instanceof Fault) return null; throw error }
    },
  }
}

export async function actorFor(env: Bindings, person: Person, label?: string, agentId?: string): Promise<Actor> {
  const current = await nativePerson(env, person.id)
  if (!current) throw new ToolRefusal('unauthenticated')
  const actor: Actor = { ...current, role: current.role as Role, channel: 'agent', label }
  if (agentId?.startsWith('local:')) {
    const keyId = agentId.slice(6)
    const key = await stmt(env.DB, 'SELECT id FROM b_agent_keys WHERE id=? AND owner_id=? AND revoked=0', keyId, current.id).first()
    if (!key) throw new ToolRefusal('unauthenticated')
    actor.agentKeyId = keyId
  }
  return accessActor(env.DB, actor)
}

export async function nativeCall(env: Bindings, ctx: ToolContext, path: string, args: Data, run: (actor: Actor) => Promise<unknown>, readOnly = false) {
  try {
    const actor = await actorFor(env, ctx.person, ctx.actor.label, ctx.agent.id)
    if (actor.agentKeyId && path !== '/agent/context' && !path.startsWith('/agent/plans') && await stmt(env.DB, 'SELECT 1 FROM b_agent_rules WHERE key_id=?', actor.agentKeyId).first()) throw new ToolRefusal('insufficient_scope')
    await accessGate(env.DB, actor, new Request(env.AUTH_ORIGIN + '/api/blotter' + path, {
      method: readOnly ? 'GET' : 'POST', ...(!readOnly ? { headers: { 'content-type': 'application/json' }, body: JSON.stringify(args) } : {}),
    }))
    return JSON.parse(JSON.stringify(await redactAccess(env.DB, actor, await run(actor))))
  } catch (error) {
    if (error instanceof Fault) throw new ToolRefusal(error.status === 404 ? 'not_found' : error.status === 403 ? 'forbidden' : error.status === 409 ? 'conflict' : 'invalid_arguments', error.message)
    throw error
  }
}
