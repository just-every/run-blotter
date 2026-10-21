// MSG-002 reuses PORTAL-004's existing contact assignments. A batch never
// assigns questions or copies answers into its message or archive history.
import { contactGuard } from './client-recipients';
import { Fault, audit, guard, insist, now, stmt, type Actor, type Data } from './model';

export async function organizerAttachment(db: D1Database, jobId: string | null, contactId: string) {
  insist(jobId, 'no open job to attach the organizer to', 409);
  const organizer = await stmt(db, `SELECT o.id,o.revision,o.erased_at,j.status,
    EXISTS(SELECT 1 FROM b_organizer_answers a WHERE a.organizer_id=o.id AND a.contact_id=?) assigned
    FROM b_job_organizers o JOIN b_jobs j ON j.id=o.job_id WHERE o.job_id=?`, contactId, jobId).first<Data>();
  insist(organizer && !organizer.erased_at, 'no current organizer on the basis job', 409);
  insist(organizer.status === 'open', 'the job holding the attached organizer closed', 409);
  insist(organizer.assigned, 'contact has no assigned organizer questions', 409);
  return { id: organizer.id as string, revision: organizer.revision as string };
}

export async function recheckOrganizer(db: D1Database, recipient: Data) {
  try {
    const current = await organizerAttachment(db, recipient.job_id, recipient.contact_id);
    return current.id === recipient.organizer_id && current.revision === recipient.organizer_revision
      ? '' : 'attached organizer changed; preview a fresh batch';
  } catch (error) {
    if (error instanceof Fault) return error.message;
    throw error;
  }
}

/** Link issuance and invitation attribution share the exact live source fence. */
export async function issueBulkOrganizer(db: D1Database, sender: Actor, batch: Data, recipient: Data,
  linkStatements: D1PreparedStatement[], subject: string, storedMessage: string, attachments = '[]') {
  const at = now(), [contact, contactDone] = contactGuard(db, recipient.client_id, recipient.contact_id);
  const [fresh, freshDone] = guard(db, `EXISTS(SELECT 1 FROM b_job_organizers o JOIN b_jobs j ON j.id=o.job_id
    WHERE o.id=? AND o.revision=? AND o.erased_at IS NULL AND j.id=? AND j.client_id=? AND j.status='open'
    AND EXISTS(SELECT 1 FROM b_organizer_answers a WHERE a.organizer_id=o.id AND a.contact_id=?))
    AND EXISTS(SELECT 1 FROM b_bulk_recipients WHERE id=? AND status='claimed' AND attempt_id=?)
    AND EXISTS(SELECT 1 FROM b_client_contacts c WHERE c.id=? AND c.email=?
      AND EXISTS(SELECT 1 FROM json_each(c.roles) WHERE value=?)
      AND NOT EXISTS(SELECT 1 FROM b_mail_suppressions s WHERE s.address=c.email))
    AND EXISTS(SELECT 1 FROM oa_operators o WHERE o.email=? AND o.status='active'
      AND (o.role='owner' OR EXISTS(SELECT 1 FROM b_members m WHERE m.email=o.email AND m.active=1 AND m.role='reviewer')))`,
    recipient.organizer_id, recipient.organizer_revision, recipient.job_id, recipient.client_id, recipient.contact_id,
    recipient.id, recipient.attempt_id, recipient.contact_id, recipient.address, batch.role, sender.email);
  try {
    await db.batch([contact, fresh, ...linkStatements,
      stmt(db, `INSERT INTO b_organizer_deliveries(id,organizer_id,contact_id,to_email,subject,message,template_id,template_version,attachments,delivery,sent_by,sent_at)
        VALUES(?,?,?,?,?,?,?,?,?,'pending',?,?)`, 'bulk:' + recipient.id, recipient.organizer_id, recipient.contact_id,
        recipient.address, subject, storedMessage, batch.template_id, batch.template_version, attachments, sender.email, at),
      // Issuing another invitation changes no answers, assignments or revision.
      stmt(db, 'UPDATE b_job_organizers SET sent_at=COALESCE(sent_at,?) WHERE id=?', at, recipient.organizer_id),
      audit(db, sender, 'organizer.invitation_issued', recipient.job_id,
        `${recipient.organizer_id}; bulk recipient ${recipient.id}; responsible contact ${recipient.contact_id}; mail outcome recorded separately`),
      freshDone, contactDone]);
  } catch (error) {
    if (/b_guard|constraint/i.test(String(error))) throw new Fault('Organizer or recipient authority changed; preview a fresh batch', 409);
    throw error;
  }
}
