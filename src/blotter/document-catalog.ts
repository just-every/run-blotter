import { relatedDocuments } from './document-related';
// DOC-004: client/period folders, internal page review and exact version grants.
// Legacy inline originals remain first versions; unknown authors/pages stay unknown.
import { atomic, audit, guard, human, id, insist, integer, job, need, now, optional, readableJob, readableJobParams, readableJobSql, rows, stmt, text, visibleJobParams, visibleJobSql, type Actor, type Data } from './model';
import { accessRow, liveAccess, revisionParams, revisionSql, scopeGuard, staffFile } from './document-source';

/** Completion appends these after the new custody record, in the same batch. */
export async function packetInheritance(db: D1Database, actor: Actor, previousId: string, fileId: string, sha256: string) {
  const source = await staffFile(db, actor, previousId), access = await accessRow(db, previousId);
  const visible = liveAccess(source, access), at = now(), revision = id();
  const [same, done] = scopeGuard(db, actor, source), [check, release] = guard(db, `${revisionSql}
    AND EXISTS(SELECT 1 FROM b_document_sources f JOIN b_document_packets p ON p.file_id=f.file_key
      WHERE f.file_key=? AND p.previous_file_id=? AND f.job_id=? AND f.client_id=? AND f.sha256=?)`,
    ...revisionParams(source, access), fileId, previousId, source.job_id, source.client_id, sha256);
  return [same, check,
    stmt(db, `INSERT INTO b_document_access(file_key,job_id,client_id,sha256,visibility,revision,updated_by,updated_at) VALUES(?,?,?,?,?,?,?,?)`,
      fileId, source.job_id, source.client_id, sha256, visible ? 'contacts' : 'internal', revision, actor.email, at),
    ...(visible ? [stmt(db, `INSERT INTO b_document_grants(file_key,contact_id,granted_by,granted_at)
      SELECT ?,contact_id,?,? FROM b_document_grants WHERE file_key=?`, fileId, actor.email, at, previousId)] : []),
    audit(db, actor, 'file.access_inherited', fileId, JSON.stringify({ fromRef: previousId, visibility: visible ? 'contacts' : 'internal', sha256 })), release, done];
}
const fields = `f.id file_id,COALESCE(p.packet_id,f.id) packet_id,p.previous_file_id,COALESCE(p.version,1) version,
 CASE WHEN f.storage='packet' THEN p.original_size ELSE f.size END original_size,p.page_count,
 COALESCE(p.source,CASE WHEN f.channel='portal' THEN 'Client portal upload' ELSE 'Staff-filed attachment' END) source,
 p.author,COALESCE(p.review_status,'unreviewed') review_status,COALESCE(p.review_note,'') review_note,
 p.revision,p.reviewed_by,p.reviewed_at,p.file_id IS NOT NULL metadata_exists,
 f.request_id,f.job_id,f.name,f.mime,f.sha256,f.storage,f.uploaded_by,f.uploaded_at,f.erased_at`;
async function packet(db: D1Database, actor: Actor, fileId: string, write = false) {
  need(actor, 'owner', 'reviewer', 'preparer');
  const p = await stmt(db, `SELECT ${fields} FROM b_files f LEFT JOIN b_document_packets p ON p.file_id=f.id WHERE f.id=?`, fileId).first<Data>();
  insist(p && (p.storage !== 'packet' || p.metadata_exists), 'Document version not found', 404);
  if (write) await job(db, actor, p.job_id); else await readableJob(db, actor, p.job_id);
  return p;
}
const annotations = (db: D1Database, fileId: string) => rows(db, 'SELECT id,file_id,page,note,created_by,created_at FROM b_document_annotations WHERE file_id=? ORDER BY page,created_at,id', fileId);
export async function packetAnnotations(db: D1Database, actor: Actor, fileId: string) {
  const p = await packet(db, actor, fileId);
  return { fileId, pageCount: p.page_count, annotations: await annotations(db, fileId) };
}
function editableGuard(db: D1Database, actor: Actor, p: Data) {
  return guard(db, `EXISTS(SELECT 1 FROM b_files f JOIN b_jobs ON b_jobs.id=f.job_id JOIN b_clients c ON c.id=b_jobs.client_id
    WHERE f.id=? AND f.erased_at IS NULL AND b_jobs.status IN ('open','review') AND c.lifecycle='active' AND c.merged_into IS NULL AND ${visibleJobSql})`, p.file_id, ...visibleJobParams(actor));
}
/** Register a legacy first version without inventing an author or a page count. */
export function legacyPacketMetadata(db: D1Database, p: Data, pageCount: number | null = null) {
  return stmt(db, `INSERT INTO b_document_packets(file_id,packet_id,version,original_size,page_count,source,author,revision)
    VALUES(?,?,1,?,?,?,'',?)`, p.file_id, p.file_id, p.original_size ?? p.size, pageCount, p.source ?? (p.channel === 'portal' ? 'Client portal upload' : 'Staff-filed attachment'), id());
}
export async function annotatePacket(db: D1Database, actor: Actor, fileId: string, body: Data) {
  human(actor); const p = await packet(db, actor, fileId, true), note = text(body.note, 'Annotation', 4000);
  const pageCount = p.page_count ?? integer(body.pageCount, 'Record the original page count before annotating', 1, 2000), page = integer(body.page, 'Page', 1, pageCount);
  const annotationId = id(), [check, release] = editableGuard(db, actor, p);
  const [same, done] = guard(db, p.metadata_exists ? 'EXISTS(SELECT 1 FROM b_document_packets WHERE file_id=? AND revision=?)' : 'NOT EXISTS(SELECT 1 FROM b_document_packets WHERE file_id=?)', fileId, ...(p.metadata_exists ? [p.revision] : []));
  await atomic(db, actor, [check, same,
    ...(!p.metadata_exists ? [legacyPacketMetadata(db, p, pageCount)] : p.page_count === null ? [stmt(db, 'UPDATE b_document_packets SET page_count=?,revision=? WHERE file_id=? AND page_count IS NULL', pageCount, id(), fileId)] : []),
    stmt(db, 'INSERT INTO b_document_annotations(id,file_id,page,note,created_by,created_at) VALUES(?,?,?,?,?,?)', annotationId, fileId, page, note, actor.email, now()),
    audit(db, actor, 'file.annotated', fileId, JSON.stringify({ annotationId, page, ...(p.page_count === null ? { declaredPageCount: pageCount } : {}) })), done, release]);
  return packetAnnotations(db, actor, fileId);
}
export async function reviewPacket(db: D1Database, actor: Actor, fileId: string, body: Data) {
  human(actor); const p = await packet(db, actor, fileId, true);
  insist(body.revision === p.revision, 'Document review changed. Refresh before deciding.', 409);
  insist(['unreviewed', 'in_review', 'accepted', 'returned'].includes(body.status), 'Choose unreviewed, in review, accepted or returned');
  const note = body.status === 'returned' ? text(body.note, 'Reason for return', 2000) : optional(body.note, 'Review note', 2000);
  const revision = id(), [check, release] = editableGuard(db, actor, p), [same, done] = guard(db,
    p.metadata_exists ? 'EXISTS(SELECT 1 FROM b_document_packets WHERE file_id=? AND revision=?)' : 'NOT EXISTS(SELECT 1 FROM b_document_packets WHERE file_id=?)', fileId, ...(p.metadata_exists ? [p.revision] : []));
  await atomic(db, actor, [check, same, ...(!p.metadata_exists ? [legacyPacketMetadata(db, p)] : []),
    stmt(db, 'UPDATE b_document_packets SET review_status=?,review_note=?,revision=?,reviewed_by=?,reviewed_at=? WHERE file_id=?', body.status, note, revision, actor.email, now(), fileId),
    audit(db, actor, 'file.reviewed', fileId, JSON.stringify({ status: body.status, note, sha256: p.sha256 })), done, release]);
  return { fileId, status: body.status, revision };
}
const normalized = (v: string) => v.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
export async function documentCatalog(db: D1Database, actor: Actor, scope: { jobId?: string; clientId?: string; q?: string }) {
  need(actor, 'owner', 'reviewer', 'preparer');
  insist(Boolean(scope.jobId) !== Boolean(scope.clientId), 'Choose one engagement or client folder');
  if (scope.jobId) insist(await stmt(db,`SELECT id FROM b_jobs WHERE id=? AND (${readableJobSql} OR EXISTS(SELECT 1 FROM b_notices n WHERE n.job_id=b_jobs.id AND n.assignee_email=?))`,scope.jobId,...readableJobParams(actor),actor.email).first(),'Job not found',404);
  if (scope.clientId) {
    const c = await stmt(db, `SELECT c.id FROM b_clients c WHERE c.id=? AND (? IN ('owner','reviewer') OR EXISTS(SELECT 1 FROM b_jobs WHERE b_jobs.client_id=c.id AND ${readableJobSql}) OR EXISTS(SELECT 1 FROM b_notices n WHERE n.client_id=c.id AND n.assignee_email=?))`,
      scope.clientId, actor.role, ...readableJobParams(actor),actor.email).first();
    insist(c, 'Client not found', 404);
  }
  const q = optional(scope.q, 'Document search', 200), terms = normalized(q).split(/\s+/).filter(Boolean);
  const files = await rows(db, `SELECT ${fields},b_jobs.client_id,b_jobs.title job_title,b_jobs.period_label,c.name client_name,
    CASE WHEN a.sha256=f.sha256 AND a.client_id=c.id AND a.visibility='contacts' THEN 'contacts' ELSE 'internal' END visibility,
    CASE WHEN b_jobs.status IN ('open','review') AND f.erased_at IS NULL AND c.lifecycle='active' AND c.merged_into IS NULL AND ${visibleJobSql} THEN 1 ELSE 0 END can_edit,
    EXISTS(SELECT 1 FROM b_document_packets n WHERE n.previous_file_id=f.id) has_newer_version
    FROM b_files f LEFT JOIN b_document_packets p ON p.file_id=f.id JOIN b_jobs ON b_jobs.id=f.job_id JOIN b_clients c ON c.id=b_jobs.client_id LEFT JOIN b_document_access a ON a.file_key=f.id
    WHERE ${scope.jobId ? 'b_jobs.id=?' : 'b_jobs.client_id=?'} AND ${readableJobSql} ORDER BY b_jobs.period_label DESC,COALESCE(p.packet_id,f.id),COALESCE(p.version,1) DESC`,
    ...visibleJobParams(actor), scope.jobId ?? scope.clientId, ...readableJobParams(actor));
  const notes = files.length ? await rows(db, `SELECT a.* FROM b_document_annotations a JOIN b_files f ON f.id=a.file_id JOIN b_jobs ON b_jobs.id=f.job_id
    WHERE ${scope.jobId ? 'b_jobs.id=?' : 'b_jobs.client_id=?'} AND ${readableJobSql} ORDER BY a.page,a.created_at`, scope.jobId ?? scope.clientId, ...readableJobParams(actor)) : [];
  const related = await relatedDocuments(db,actor,scope);
  const matches = [...files.map<Data>(f=>({...f,kind:'file'})),...related].map<Data>(f => ({ ...f, annotations: notes.filter(a => a.file_id === f.file_id) })).filter(f => {
    const search = normalized([f.name, f.source, f.author, f.uploaded_by, f.uploaded_at, f.review_status, f.review_note, f.reviewed_by, f.reviewed_at,
      f.client_name, f.period_label, f.job_title, f.workflow, f.source_status, f.version, f.packet_id, f.previous_file_id, ...f.annotations.map((a: Data) => a.note)].join(' '));
    return terms.every(t => search.includes(t));
  });
  const folders: Data[] = [];
  for (const f of matches) {
    let folder = folders.find(x => x.jobId === f.job_id);
    if (!folder) { folder = { clientId: f.client_id, clientName: f.client_name, period: f.period_label, jobId: f.job_id, title: f.job_title, files: [] }; folders.push(folder); }
    folder.files.push(f);
  }
  return { q, folders, total: matches.length };
}
