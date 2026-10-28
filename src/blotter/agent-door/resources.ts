import type { ResourceDefinition } from '../../modules/agent-door/index.ts'
import { type Bindings } from '../../auth.server'
import { actorFor } from './people'
import { redactAccess } from '../access-gate'
import { readableClient } from '../client-contacts'
import { readiness } from '../readiness'
import { learningDetail } from '../learning'
import { Fault, insist, job, stmt, type Data } from '../model'

/** Only native agent-readable records. Human-only/private audit reads need a richer Base resource context. */
export function practiceResources(env: Bindings): ResourceDefinition[] {
  return ['clients', 'engagements', 'proposals', 'learning'].map(area => ({
    uriTemplate: `blotter://${area}/{id}`, name: area, description: 'Current native visibility; source narrative is untrusted. Missing and restricted records are indistinguishable.', scope: 'resources:read', classes: ['sensitive'],
    classify: record => [{ class: 'sensitive', facts: { measure: 1, kind: area === 'clients' ? 'personal' : (record.json as Data).record.jobId ? 'engagement' : 'practice' } }],
    async read(uri, { person }) {
      try {
        const actor = await actorFor(env, person), key = decodeURIComponent(uri.slice(uri.lastIndexOf('/') + 1))
        let value: unknown
        if (area === 'clients') {
          const client = await readableClient(env.DB, actor, key)
          value = { id: client.id, name: client.name, entityType: client.entity_type, lifecycle: client.lifecycle, revision: client.revision }
        } else if (area === 'engagements') value = await readiness(env.DB, actor, key)
        else if (area === 'learning') value = await learningDetail(env.DB, actor, key)
        else {
          const proposal = await stmt(env.DB, 'SELECT id,kind,payload,status,for_email,agent_label,created_at,decided_by,decided_at,result_id FROM b_proposals WHERE id=? AND for_email=?', key, actor.email).first<Data>()
          insist(proposal, 'Not found', 404)
          const payload = JSON.parse(proposal.payload)
          if (payload.jobId) await job(env.DB, actor, payload.jobId)
          else insist(actor.role !== 'preparer' && !actor.accessScoped, 'Not found', 404)
          value = { ...proposal, payload }
        }
        return { json: { record: await redactAccess(env.DB, actor, value) }, untrusted: true }
      } catch (error) { if (error instanceof Fault) return null; throw error }
    },
  }))
}
