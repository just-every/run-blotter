// Human review evidence only. These records never authorize delivery or change grants.
import { readAiDraft } from './ai-assistance';
import { aiScope } from './ai-sources';
import { contactGuard, recipientFor } from './client-recipients';
import { documentBytes } from './document-packets';
import { accessRow, liveAccess, scopeGuard, staffFile } from './document-source';
import { documentAuthority } from './permissions';
import { atomic, audit, digest, Fault, guard, human, id, insist, now, rows, stmt, text, type Actor, type Data } from './model';

const quote = (value: string) => "'" + value.replaceAll("'", "''") + "'";
const portalText = `(SELECT group_concat(value,char(10)||char(10)) FROM
  (SELECT created_at||' ['||id||']'||char(10)||body||CASE WHEN response IS NOT NULL AND response<>'' THEN char(10)||'Reply: '||response ELSE '' END value
   FROM b_portal_items WHERE job_id=? AND kind IN ('message','question') ORDER BY created_at,id))`;

// A native session, its current operator version and its factor remain required inside the batch.
function sessionGuard(db: D1Database, actor: Actor) {
  return guard(db, `EXISTS(SELECT 1 FROM oa_sessions s JOIN oa_operators o ON o.id=s.operator_id
    WHERE s.id=? AND s.operator_id=? AND s.revoked_at IS NULL AND s.expires_at>? AND s.operator_version=o.version)
    AND (EXISTS(SELECT 1 FROM b_enterprise_sessions s JOIN b_enterprise_connection c ON c.id=1 AND c.active=1 AND c.revision=s.revision
      JOIN b_enterprise_identities i ON i.id=s.identity_id AND i.active=1 AND i.blocked=0 WHERE s.session_id=? AND i.email=? AND s.mfa=1)
    OR ((NOT EXISTS(SELECT 1 FROM b_mfa_policy WHERE required=1) AND NOT EXISTS(SELECT 1 FROM b_mfa_factors WHERE email=? AND confirmed_at IS NOT NULL))
      OR (EXISTS(SELECT 1 FROM b_mfa_factors WHERE email=? AND confirmed_at IS NOT NULL) AND EXISTS(SELECT 1 FROM b_mfa_sessions WHERE session_id=? AND email=?))))`,
    actor.sessionId, actor.id, Date.now(), actor.sessionId, actor.email, actor.email, actor.email, actor.sessionId, actor.email);
}

async function recorded(db: D1Database, draftId: string) {
  const review = await stmt(db, `SELECT r.*,d.decision,d.value FROM b_ai_reply_reviews r
    JOIN b_ai_decisions d ON d.id=r.decision_id WHERE r.draft_id=?`, draftId).first<Data>();
  return review ? { ...review, recipients: JSON.parse(review.recipients), attachments: JSON.parse(review.attachments), historical: !!review.restored } : null;
}

/** Eligible choices disclose existing access; this door creates no contact or document grant. */
export async function replyReviewState(db: D1Database, actor: Actor, draftId: string) {
  const draft = await readAiDraft(db, actor, draftId);
  insist(draft.output.reply, 'Choose a saved reply draft');
  const recipients: Data[] = [], attachments: Data[] = [];
  for (const c of await rows(db, 'SELECT id FROM b_client_contacts WHERE client_id=? ORDER BY name,id', draft.client_id)) {
    try {
      const contact = await recipientFor(db, draft.client_id, 'request', c.id);
      recipients.push({ id: contact.id, revision: contact.revision, name: contact.name, email: contact.email });
    } catch (error) { if (!(error instanceof Fault && error.status === 409)) throw error; }
  }
  for (const f of await rows(db, "SELECT file_key FROM b_document_sources WHERE client_id=? AND kind='file' AND content_base64 IS NOT NULL ORDER BY name,file_key", draft.client_id)) {
    try {
      const file = await staffFile(db, actor, f.file_key), access = await accessRow(db, file.file_key);
      if (!liveAccess(file, access)) continue;
      attachments.push({ id: file.file_key, sha256: file.sha256, accessRevision: access!.revision, name: file.name,
        contactIds: (await rows(db, 'SELECT contact_id FROM b_document_grants WHERE file_key=?', file.file_key)).map(c => c.contact_id) });
    } catch (error) { if (!(error instanceof Fault && [403,404].includes(error.status))) throw error; }
  }
  const [session, done] = sessionGuard(db, actor);
  await atomic(db, actor, [session, done]);
  return { sourceFingerprint: draft.source_fingerprint, recipients, attachments, review: await recorded(db, draftId) };
}

function selected(value: unknown, label: string, limit: number): Data[] {
  insist(Array.isArray(value) && value.length <= limit, `Choose up to ${limit} ${label}`);
  insist(value.every(v => v && typeof v === 'object' && !Array.isArray(v)), `Choose explicit ${label}`);
  const sorted = value.map(v => ({ ...v, id: text(v.id, label, 250) })).sort((a,b) => a.id.localeCompare(b.id));
  insist(new Set(sorted.map(v => v.id)).size === sorted.length, `Choose each of the ${label} only once`);
  return sorted;
}

export async function reviewAiReply(db: D1Database, actor: Actor, draftId: string, body: Data) {
  human(actor);
  insist(actor.sessionId && !actor.readOnly && !actor.automation, 'A writable human staff session is required', 403);
  const draft = await readAiDraft(db, actor, draftId);
  insist(typeof draft.output.reply === 'string' && draft.output.reply.length, 'Choose a saved reply draft');
  insist(['accept','reject'].includes(body.decision), 'Accept or reject this reply');
  insist(draft.source_fingerprint && body.sourceFingerprint === draft.source_fingerprint, 'The source changed or this older draft lacks a source fingerprint; prepare and save a fresh draft', 409);
  const value = text(body.value ?? draft.output.reply, 'Reviewed reply', 1200), textHash = await digest(value);
  insist(body.textSha256 === textHash, 'Review the exact wording before recording this decision', 409);
  const recipients = selected(body.recipients, 'recipients', 100).map(c => ({ id: c.id, revision: text(c.revision, 'Contact revision', 250) }));
  const attachments = selected(body.attachments, 'attachments', 20).map(f => ({ id: f.id, sha256: text(f.sha256, 'Original digest', 64), accessRevision: text(f.accessRevision, 'Document access revision', 250) }));
  insist(body.decision !== 'accept' || recipients.length, 'Select the intended recipients');
  insist(body.decision !== 'reject' || (!recipients.length && !attachments.length), 'Rejection records no intended delivery');
  const intentHash = await digest(JSON.stringify({ decision: body.decision, value, sourceFingerprint: body.sourceFingerprint, recipients, attachments }));
  const checks: ReturnType<typeof guard>[] = [sessionGuard(db, actor), aiScope(db, actor, draft.job_id, draft.source_kind, draft.source_id)];
  if (draft.source_kind === 'portal') checks.push(guard(db, `${portalText}=?`, draft.job_id, draft.source.text));
  else {
    const source = await staffFile(db, actor, draft.source_id);
    insist(source.sha256 === draft.source.originalSha256, 'The source changed during review', 409);
    checks.push(guard(db, 'EXISTS(SELECT 1 FROM b_document_sources WHERE file_key=? AND sha256=? AND content_base64=?)', source.file_key, source.sha256, source.content_base64));
  }
  for (const c of recipients) {
    const contact = await recipientFor(db, draft.client_id, 'request', c.id);
    insist(contact.revision === c.revision, 'A selected recipient changed; review the intended recipients again', 409);
    checks.push(contactGuard(db, draft.client_id, c.id, 'request', c.revision));
  }
  for (const a of attachments) {
    const file = await staffFile(db, actor, a.id), access = await accessRow(db, a.id);
    checks.push(scopeGuard(db, actor, file));
    insist(file.kind === 'file' && file.client_id === draft.client_id, 'Choose an original uploaded attachment on this client', 404);
    insist(file.sha256 === a.sha256 && await digest(await documentBytes(db, file)) === a.sha256 && liveAccess(file, access) && access!.revision === a.accessRevision,
      'Attachment bytes or explicit document access changed; review again', 409);
    for (const c of recipients) {
      insist(await stmt(db, 'SELECT 1 FROM b_document_grants WHERE file_key=? AND contact_id=?', a.id, c.id).first(), 'Every selected recipient needs existing explicit access to every attachment', 409);
      checks.push(guard(db, 'EXISTS(SELECT 1 FROM b_document_grants WHERE file_key=? AND contact_id=?)', a.id, c.id));
    }
    checks.push(guard(db, `EXISTS(SELECT 1 FROM b_document_sources f JOIN b_document_access a ON a.file_key=f.file_key
      WHERE f.file_key=? AND f.kind='file' AND f.client_id=? AND f.sha256=? AND f.content_base64=? AND a.revision=?
      AND a.visibility='contacts' AND a.sha256=f.sha256 AND a.job_id=f.job_id AND a.client_id=f.client_id)
      AND ${documentAuthority(actor, quote(a.id))}`, a.id, draft.client_id, a.sha256, file.content_base64, a.accessRevision));
  }
  const replay = async (review: Data) => {
    insist(!review.restored, 'Restored review is historical only; it cannot be replayed', 409);
    insist(review.actor_id === actor.id && review.intent_sha256 === intentHash, 'This reply already has a different review', 409);
    await atomic(db, actor, [...checks.map(c => c[0]), ...checks.map(c => c[1])]);
    return { review, replayed: true };
  };
  const previous = await recorded(db, draftId);
  if (previous) return replay(previous);
  const reviewId = id(), decisionId = id(), at = now();
  // A pre-existing text-only decision cannot be silently upgraded into membership review.
  checks.push(guard(db, 'NOT EXISTS(SELECT 1 FROM b_ai_decisions WHERE draft_id=? AND field=?)', draftId, 'reply'));
  try {
    await atomic(db, actor, [...checks.map(c => c[0]),
      stmt(db, 'INSERT INTO b_ai_decisions VALUES(?,?,?,?,?,?,?,?)', decisionId, draftId, 'reply', body.decision, value, null, actor.email, at),
      stmt(db, `INSERT INTO b_ai_reply_reviews(id,draft_id,decision_id,actor_id,intent_sha256,text_sha256,source_fingerprint,recipients,attachments,reviewed_by,reviewed_at)
        VALUES(?,?,?,?,?,?,?,?,?,?,?)`, reviewId, draftId, decisionId, actor.id, intentHash, textHash, draft.source_fingerprint, JSON.stringify(recipients), JSON.stringify(attachments), actor.email, at),
      audit(db, actor, 'ai.reply_reviewed', reviewId, JSON.stringify({ draftId, decision: body.decision, textSha256: textHash, sourceFingerprint: draft.source_fingerprint })),
      ...checks.map(c => c[1])]);
  } catch (error) {
    if (error instanceof Fault && error.status === 409) {
      const winner = await recorded(db, draftId);
      // Remove only the pending-decision guard for a concurrently completed identical review.
      checks.pop();
      if (winner) return replay(winner);
    }
    throw error;
  }
  return { review: await recorded(db, draftId), replayed: false };
}
