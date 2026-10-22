import { authorizationFields, authorizationPdf } from './authorization-pdf';
import { atomic, audit, human, insist, job, need, stmt, text, type Actor, type Data } from './model';
import { recipientFor } from './client-recipients';
import { createSignature } from './signatures';

/** Preparation creates a reviewable SIGN-002 draft and never sends invitations or submits to an agency. */
export async function prepareAuthorization(db: D1Database, actor: Actor, authorizationId: string, body: Data) {
  human(actor); need(actor, 'owner', 'reviewer');
  const a = await stmt(db, 'SELECT a.* FROM b_authorizations a JOIN b_clients c ON c.id=a.client_id WHERE a.id=? AND c.erased_at IS NULL AND c.merged_into IS NULL AND c.lifecycle=\'active\'', authorizationId).first<Data>();
  insist(a, 'Authorization not found', 404);
  insist(body.revision === a.revision && a.status === 'draft' && !a.signature_id, 'Only an unchanged unsigned draft can be prepared', 409);
  insist(a.kind === '2848' || a.kind === '8821', 'Supply the state agency form through Document signatures');
  insist(body.reviewed === true, 'Review the scope, signer authority, representative eligibility and replacement of prior authorizations');
  const work = await job(db, actor, text(body.jobId, 'Authorization work item'));
  insist(work.client_id === a.client_id, 'Choose work for this authorization client', 409);
  const contact = await recipientFor(db, a.client_id, 'signature', text(body.contactId, 'Taxpayer signer'));
  insist(a.kind !== '2848' || a.representative_email, 'Record a staff representative who signs the Form 2848 declaration in their own session', 409);
  const contentBase64 = await authorizationPdf(a, body, contact.name);
  const signature: Data = await createSignature(db, actor, work.id, {
    title: `Form ${a.kind} - ${body.taxpayerName}`, formKind: a.kind, mode: 'sequential',
    contactIds: [contact.id, ...(a.kind === '2848' ? [`staff:${a.representative_email}`] : [])],
    fields: authorizationFields(a.kind, contact.id, a.representative_email),
    file: { name: `form-${a.kind}.pdf`, mime: 'application/pdf', contentBase64 },
  });
  await atomic(db, actor, [audit(db, actor, 'authorization.prepared', a.client_id, `Official IRS Form ${a.kind} (January 2021); signature draft ${signature.id}; scope and signer authority reviewed`)]);
  return signature;
}
