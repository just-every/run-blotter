import { documentBytes } from './document-packets';
import { staffFile } from './document-source';
import { documentText } from './pdf-text';
import { documentAuthority, requireDocument } from './permissions';
import { digest, Fault, guard, human, insist, readableJob, readableJobParams, readableJobSql, rows, stmt, type Actor, type Data } from './model';

export function aiScope(db: D1Database, actor: Actor, jobId: string, kind: string, sourceId: string) {
  const file = "'" + sourceId.replaceAll("'", "''") + "'";
  return guard(db, `EXISTS(SELECT 1 FROM b_jobs JOIN b_clients c ON c.id=b_jobs.client_id WHERE b_jobs.id=?
    AND c.lifecycle='active' AND c.erased_at IS NULL AND c.merged_into IS NULL AND ${readableJobSql})
    AND (?<>'document' OR (${documentAuthority(actor,file)} AND EXISTS(SELECT 1 FROM b_document_sources WHERE file_key=? AND job_id=? AND content_base64 IS NOT NULL)))`,
    jobId,...readableJobParams(actor),kind,sourceId,jobId);
}

export async function aiJob(db: D1Database, actor: Actor, jobId: string) {
  human(actor);
  const j = await readableJob(db, actor, jobId);
  insist(await stmt(db, "SELECT 1 FROM b_clients WHERE id=? AND erased_at IS NULL AND lifecycle='active' AND merged_into IS NULL", j.client_id).first(), 'Client is inactive or erased', 409);
  return j;
}
export async function aiSources(db: D1Database, actor: Actor, jobId: string) {
  await aiJob(db, actor, jobId);
  const sources: Data[] = [];
  if (await stmt(db, "SELECT 1 FROM b_portal_items WHERE job_id=? AND kind IN ('message','question')", jobId).first())
    sources.push({ id: jobId, kind: 'portal', label: 'Client portal conversation' });
  for (const f of await rows(db, "SELECT file_key,name FROM b_document_sources WHERE job_id=? AND kind='file' AND content_base64 IS NOT NULL ORDER BY name", jobId)) {
    try { await requireDocument(db, actor, f.file_key); sources.push({ id: f.file_key, kind: 'document', label: f.name }); }
    catch (error) { if (!(error instanceof Fault && [403,404].includes(error.status))) throw error; }
  }
  return sources;
}
export async function aiSource(db: D1Database, actor: Actor, jobId: string, kind: string, sourceId: string) {
  const j = await aiJob(db, actor, jobId);
  let value = '', label = '', href = '', ids: string[] = [], requestLabel = '';
  if (kind === 'portal') {
    insist(sourceId === jobId, 'Select this job’s portal conversation', 404);
    const messages = await rows(db, "SELECT id,body,response,created_at FROM b_portal_items WHERE job_id=? AND kind IN ('message','question') ORDER BY created_at,id", jobId);
    insist(messages.length, 'No portal conversation is available', 404);
    value = messages.map(m => `${m.created_at} [${m.id}]\n${m.body}${m.response ? '\nReply: ' + m.response : ''}`).join('\n\n');
    ids = messages.map(m => m.id); label = 'Client portal conversation'; href = `/app?job=${encodeURIComponent(jobId)}#job-portal`;
  } else {
    insist(kind === 'document', 'Choose a document or portal conversation');
    const f = await staffFile(db, actor, sourceId);
    insist(f.job_id === jobId && f.kind === 'file', 'Select an uploaded document on this job', 404);
    insist(Number(f.size) <= 1_048_576, 'This document is too large for AI assistance; select a readable document of at most 1 MiB', 422);
    value = await documentText(f.mime, f.name, await documentBytes(db, f));
    insist(value.trim().length >= 12 && !value.includes('\u0000'), `Unsupported or unreadable document: ${f.name}. No text was sent to the provider.`, 422);
    ids = [f.file_key]; label = f.name; href = `/api/blotter/documents/${encodeURIComponent(f.file_key)}/file`;
    requestLabel = (await stmt(db,'SELECT label FROM b_requests WHERE id=(SELECT request_id FROM b_files WHERE id=?)',f.file_key).first<Data>())?.label ?? '';
  }
  insist(value.length <= 24_000, 'The selected source is too long; choose a shorter source. Nothing was sent.', 422);
  const client = await stmt(db,'SELECT name FROM b_clients WHERE id=?',j.client_id).first<Data>();
  return { id: sourceId, kind, label, text: value, href, ids, hash: await digest(value), clientId: j.client_id,
    expected: {client:client!.name,period:j.period_label,request:requestLabel} };
}
