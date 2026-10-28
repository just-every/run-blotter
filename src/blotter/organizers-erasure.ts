// Explicit owner answer erasure. Identity, authorship, times and sign-off stay;
// content redaction fences all older exports through native portability.
import { createPortability } from '@runeditrun/rer/modules/portability';
import policy from './archive-policy.mjs';
import { refuseHeld } from './client-retention';
import { storedOrganizer } from './organizers-store';
import { atomic, audit, guard, human, id, insist, job, need, now, stmt, text, type Actor, type Data } from './model';

export async function eraseOrganizer(db: D1Database, actor: Actor, organizerId: string, body: Data) {
  human(actor); need(actor, 'owner');
  const organizer = await storedOrganizer(db, organizerId), j = await job(db, actor, organizer.job_id);
  insist(!organizer.erased_at, 'This organizer was already erased', 409);
  if (organizer.definition.collectionForm) {
    const consumed = await stmt(db, `SELECT 1 FROM b_organizer_submissions WHERE organizer_id=? AND submitted_at<=? AND erased_at IS NULL`, organizerId, j.signed_off_at ?? '').first();
    insist(!consumed || j.status !== 'signed_off', 'Consumed resolution originals use signed-off work retention and expiry', 409);
  }
  await refuseHeld(db, { clientIds: [String(j.client_id)], jobId: j.id, cls: 'organizer' }, 'Erasing these answers');
  insist(body.revision === organizer.revision, 'Organizer changed; refresh before erasing', 409);
  insist(body.confirm === organizer.definition.name, 'Type the organizer name to confirm erasing its answers');
  const reason = text(body.reason, 'Erasure reason', 1000), at = now(), service = await createPortability({ db, policy });
  const [check, release] = guard(db, 'EXISTS(SELECT 1 FROM b_job_organizers WHERE id=? AND revision=? AND erased_at IS NULL)', organizerId, organizer.revision);
  const sourceIds = 'SELECT id FROM b_organizer_submissions WHERE organizer_id=?';
  const statements: D1PreparedStatement[] = [check,
    // An unconfirmed carry is still the source's data. Confirming a current
    // answer creates new contact-attributed evidence and clears this link.
    stmt(db, `UPDATE b_job_organizers SET revision=? WHERE id IN(SELECT organizer_id FROM b_organizer_answers WHERE carried_from IN(${sourceIds}))`, id(), organizerId),
    stmt(db, `UPDATE b_organizer_answers SET value=NULL,confirmed=0 WHERE carried_from IN(${sourceIds})`, organizerId),
    stmt(db, 'UPDATE b_organizer_answers SET value=NULL,confirmed=0 WHERE organizer_id=?', organizerId),
    stmt(db, 'UPDATE b_organizer_submissions SET answers=NULL,review_note=NULL,erased_at=? WHERE organizer_id=?', at, organizerId),
    stmt(db, 'UPDATE b_job_organizers SET erased_at=?,erased_by=?,erase_reason=?,revision=? WHERE id=?', at, actor.email, reason, id(), organizerId),
  ];
  for (const q of organizer.definition.questions) {
    // A later staff answer is independent evidence. Only the organizer's
    // own client-authored projection is removed with the original payload.
    statements.push(stmt(db, 'UPDATE b_job_answers SET value=NULL WHERE job_id=? AND key=? AND organizer_source=?', j.id, q.workflowQuestion || q.key, organizerId));
  }
  statements.push(...await service.redactionStatements(), ...await service.invalidateTransfersStatements(), release,
    audit(db, actor, 'organizer.erased', j.id, `${organizerId}; ${reason}`));
  await atomic(db, actor, statements);
  return { id: organizerId, erased: true, erasedAt: at };
}
