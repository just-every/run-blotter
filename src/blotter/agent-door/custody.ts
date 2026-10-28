import type { Data } from '../model'
import { stmt } from '../model'

/** The copied door retains private snapshots and arbitrary trace text. Until its
 * client-custody hook exists, erasure must not leave those outside the preview.
 * Empty stores do not block the practice's existing native erasure lifecycle. */
export async function agentCustodyBlockers(db: D1Database) {
  const record = await stmt(db, `SELECT EXISTS(SELECT 1 FROM agent_door_audit
    UNION ALL SELECT 1 FROM agent_door_calls
    UNION ALL SELECT 1 FROM agent_door_approvals
    UNION ALL SELECT 1 FROM agent_door_reviews
    UNION ALL SELECT 1 FROM agent_door_events) present`).first<Data>()
  return record?.present ? ['Shared-agent history requires a custody review before client erasure. The principal owns this unresolved exception.'] : []
}
