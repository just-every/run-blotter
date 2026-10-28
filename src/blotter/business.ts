import { createBusinessSettings } from '../modules/business-settings/index.ts'
import type { BusinessManifest, TeamAdapter } from '../modules/business-settings/types.ts'
import { createOperatorAuth } from '../modules/operator-auth/index.mjs'
import { authConfig, type Bindings } from '../auth.server'
import { operatorMail } from '../mail.server.mjs'
import { deactivation } from './offboarding'
import { stmt, type Data } from './model'

export const businessManifest: BusinessManifest = {
  settings: 1, values: ['display_name'], team: { roles: { admin: 'reviewer', member: 'preparer' } },
}

/** OA owns identities; the practice membership table remains the role authority. */
function practiceTeam(env: Bindings): TeamAdapter {
  const auth = createOperatorAuth({ db: env.DB, config: authConfig(env), mailSender: operatorMail(env), clientIp: request => request.headers.get('CF-Connecting-IP') ?? '' })
  const native = auth.businessTeam!
  return {
    ownerEmail: () => native.ownerEmail(),
    async prepare(input) {
      const plan = await native.prepare({ ...input, roles: { admin: 'admin', member: 'member' } })
      const statements = [...plan.statements]
      for (const row of plan.rows) {
        if (!row.operatorId || row.state === 'conflict') continue
        const member = input.members.find(person => person.email === row.email)
        const current = await stmt(env.DB, 'SELECT email FROM oa_operators WHERE id=?', row.operatorId).first<Data>()
        const address = current?.email ?? row.email
        // The settings CAS/nonce and OA's live owner fence run in this same batch.
        statements.push(stmt(env.DB, `INSERT INTO bs_assert(value) SELECT NULL WHERE NOT (${input.guard.sql})`, ...input.guard.args))
        if (member) {
          statements.push(stmt(env.DB, `INSERT INTO b_members(email,name,role,active) VALUES(?,?,?,1)
            ON CONFLICT(email) DO UPDATE SET name=excluded.name,role=excluded.role,active=1`,
          address, member.name, member.role === 'admin' ? 'reviewer' : 'preparer'))
          statements.push(stmt(env.DB, 'INSERT OR IGNORE INTO b_access_members(email) SELECT ? WHERE EXISTS(SELECT 1 FROM b_access_policy WHERE id=1)', address))
        } else statements.push(...deactivation(env.DB, address))
        statements.push(stmt(env.DB, 'INSERT INTO b_audit(id,actor,action,object_id,detail,at) VALUES(?,?,?,?,?,?)',
          crypto.randomUUID(), input.ownerEmail, member ? 'member.saved' : 'member.deactivated', address,
          `via Business; ${member?.role === 'admin' ? 'reviewer' : member ? 'preparer' : 'inactive'}`, new Date().toISOString()))
      }
      return { ...plan, statements }
    },
  }
}

export function businessSettings(env: Bindings) {
  return createBusinessSettings({ db: env.DB, business: businessManifest, trust: env.RER_BUSINESS_TRUST, team: practiceTeam(env) })
}
