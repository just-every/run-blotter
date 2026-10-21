// ERASURE-002 restore fence, destination side (ct 22 Oct 2026). A destination that knows no later
// erasure can still be handed an archive made before one. Without the newer erasure journal the
// principal must acknowledge that the erasure history is unverified; the acknowledgment is
// recorded in the import report and the audit log. With the journal, Base refuses a stale archive.
import { atomic, audit, insist, now, type Actor, type Data } from './model';

export const UNVERIFIED = 'erasure history unverified: supply your latest erasure journal';

/** Throws unless a newer journal accompanies the restore or the principal acknowledged the unverified history. */
export function requireAcknowledgement(journal: unknown, acknowledge: unknown) {
  if (journal) return null;
  insist(acknowledge === UNVERIFIED, `This restore cannot verify that nothing was erased after the archive was made. Supply your latest erasure journal, or acknowledge: "${UNVERIFIED}"`, 409);
  return UNVERIFIED;
}
/** The import report: what was acknowledged, by whom, when. */
export const withReport = (result: Data, actor: Actor, acknowledged: string | null) => acknowledged
  ? { ...result, erasureHistory: { status: 'unverified', acknowledgment: acknowledged, acknowledgedBy: actor.email, acknowledgedAt: now() } } : { ...result, erasureHistory: { status: 'journal supplied' } };
export const acknowledgementAudit = (db: D1Database, actor: Actor, acknowledged: string | null, importId: string) =>
  acknowledged ? [audit(db, actor, 'archive.restore_unverified', 'archive:' + importId, acknowledged)] : [];
export const recordAcknowledgement = async (db: D1Database, actor: Actor, acknowledged: string | null, importId: string) => { if (acknowledged) await atomic(db, actor, acknowledgementAudit(db, actor, acknowledged, importId)); };
