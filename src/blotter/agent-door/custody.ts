import type { Data } from '../model'
import { stmt } from '../model'

/** The copied door retains private snapshots and arbitrary trace text. Until its
 * client-custody hook exists, erasure must not leave those outside the preview.
 * Empty stores do not block the practice's existing native erasure lifecycle. */
export const agentCustodyClearSql = [
  'agent_door_state', 'agent_door_agents', 'agent_door_audit', 'agent_door_calls',
  'agent_door_approvals', 'agent_door_reviews', 'agent_door_events',
].map(table => `NOT EXISTS(SELECT 1 FROM ${table})`).join(' AND ')

export async function agentCustodyBlockers(db: D1Database) {
  const record = await stmt(db, `SELECT NOT (${agentCustodyClearSql}) present`).first<Data>()
  return record?.present ? ['Shared-agent history requires a custody review before client erasure. The principal owns this unresolved exception.'] : []
}
