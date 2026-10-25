import { documentBytes } from './document-packets';
import { staffFile } from './document-source';
import { readAiDraft } from './ai-assistance';
import { aiScope } from './ai-sources';
import { atomic, audit, digest, guard, id, insist, job, now, stmt, text, type Actor, type Data } from './model';

function proposal(output: Data, field: string): string {
  if (field === 'name') return output.suggestedName;
  if (['summary','reply','routing'].includes(field)) return output[field];
  const [kind, index] = field.split(':');
  const key = ({ question: 'questions', validation: 'validation', extraction: 'extraction', plan: 'plan' } as Data)[kind];
  insist(key && /^\d+$/.test(index) && Number(index) < output[key].length, 'Choose a proposal in this draft');
  const value = output[key][Number(index)];
  return typeof value === 'string' ? value : value.value;
}
/** Every decision is inert except a separately accepted internal file copy. */
export async function decideAiDraft(db: D1Database, actor: Actor, draftId: string, body: Data) {
  const draft = await readAiDraft(db, actor, draftId), field = text(body.field, 'Proposal', 50);
  const proposed = proposal(draft.output, field);
  insist(typeof proposed === 'string' && proposed.length > 0, 'This draft has no such proposal');
  insist(['accept','reject'].includes(body.decision), 'Accept or reject this one proposal');
  const editable = ['summary','reply','name'].includes(field);
  insist(editable || body.value === undefined || body.value === proposed, 'Extracted values and sourced proposals cannot be rewritten; reject and verify the source instead');
  const decisionId = id(), at = now(), value = body.decision === 'accept' && body.value !== undefined
    ? text(body.value, 'Reviewed proposal', field === 'name' ? 200 : field === 'summary' ? 800 : field === 'reply' ? 1200 : 5000) : proposed;
  const [pending, released] = guard(db, 'NOT EXISTS(SELECT 1 FROM b_ai_decisions WHERE draft_id=? AND field=?)', draftId, field);
  const [scope,scopeDone] = aiScope(db,actor,draft.job_id,draft.source_kind,draft.source_id);
  const statements: D1PreparedStatement[] = [scope,pending];
  let resultId: string | null = null;
  if (body.decision === 'accept' && field === 'routing') {
    insist(draft.purpose === 'document' && draft.source_kind === 'document', 'Only document routing can create a copy');
    const j = await job(db, actor, draft.job_id);
    insist(j.status === 'open', 'This job is not open for uploads', 409);
    const target = await stmt(db, 'SELECT * FROM b_requests WHERE id=? AND job_id=? AND organizer_active=1', text(body.targetRequestId, 'Destination request', 250), j.id).first<Data>();
    insist(target, 'Select a request on this same job; client and visibility cannot change', 404);
    const f = await staffFile(db, actor, draft.source_id), bytes = await documentBytes(db, f);
    insist(bytes.length <= 1_048_576, 'The original is too large for this copy', 422);
    const nameDecision = draft.decisions.find((d: Data) => d.field === 'name' && d.decision === 'accept');
    const name = text(nameDecision?.value ?? f.name, 'Copy name', 200).replace(/[\\/]/g, '_');
    let encoded = ''; for (const b of bytes) encoded += String.fromCharCode(b);
    resultId = id();
    const [open, done] = guard(db, "EXISTS(SELECT 1 FROM b_jobs WHERE id=? AND status='open')", j.id);
    statements.push(open, stmt(db, `INSERT INTO b_files(id,request_id,job_id,name,mime,size,sha256,content_base64,uploaded_by,channel,uploaded_at)
      VALUES(?,?,?,?,?,?,?,?,?,'person',?)`, resultId, target.id, j.id, name, f.mime, bytes.length, await digest(bytes), btoa(encoded), actor.email, at),
      stmt(db, "UPDATE b_requests SET status='received',updated_by=?,updated_at=? WHERE id=? AND status<>'accepted'", actor.email, at, target.id), done);
  }
  statements.push(stmt(db, 'INSERT INTO b_ai_decisions VALUES(?,?,?,?,?,?,?,?)', decisionId, draftId, field, body.decision, value, resultId, actor.email, at),
    audit(db, actor, 'ai.proposal_decided', draftId, JSON.stringify({ field, decision: body.decision, sourceId: draft.source_id, resultId })), released,scopeDone);
  await atomic(db, actor, statements);
  return readAiDraft(db, actor, draftId);
}
