// Client transport has its own authority. Portal bearers never become staff actors.
// Staging uses the existing excluded tables; completed originals use b_files custody.
import { portalJob } from './documents';
import { contactRequestSql } from './organizers-requests';
import { PACKET_LIMITS, packetHash, encodePacket, decodePacket, assemblePacket, packetSummary, purgeDocumentUploads } from './document-packets';
import { guard, id, insist, integer, now, optional, rows, stmt, text, digest, type Data } from './model';

type Context = Awaited<ReturnType<typeof context>>;
async function context(db: D1Database, token: string, requestId: string) {
  const c = await portalJob(db, token);
  insist(c.job.status === 'open', 'This job is no longer collecting documents', 410);
  const request = await stmt(db, `SELECT r.* FROM b_requests r WHERE r.id=? AND r.job_id=? AND ${contactRequestSql()}`, requestId, c.job.id, c.contact.id).first<Data>();
  insist(request, 'Request not found', 404);
  return { ...c, request };
}
function authority(db: D1Database, c: Context, extra = '1', params: unknown[] = []) {
  return guard(db, `EXISTS(SELECT 1 FROM b_portal_links l JOIN b_jobs j ON j.id=l.job_id JOIN b_clients e ON e.id=j.client_id
    JOIN b_client_contacts k ON k.id=l.contact_id AND k.client_id=e.id JOIN b_requests r ON r.job_id=j.id
    WHERE l.id=? AND l.contact_id=? AND l.revoked_at IS NULL AND l.expires_at>? AND j.status='open'
    AND e.lifecycle='active' AND e.merged_into IS NULL AND k.active=1 AND k.authorized=1 AND k.portal=1 AND k.request_consent=1
    AND k.revision=? AND r.id=? AND r.status<>'accepted' AND ${contactRequestSql()}) AND (${extra})`,
    c.link.id, c.contact.id, now(), c.contact.revision, c.request.id, c.contact.id, ...params);
}
async function batch(db: D1Database, statements: D1PreparedStatement[]) {
  try { await db.batch(statements); }
  catch (e) { if (/constraint|b_guard|UNIQUE/i.test(String(e))) insist(false, 'Upload authority or progress changed. Refresh before retrying.', 409); throw e; }
}
function event(db: D1Database, c: Context, action: string, fileId: string) {
  return stmt(db, 'INSERT INTO b_audit(id,actor,action,object_id,detail,at) VALUES(?,?,?,?,?,?)', id(), `portal contact ${c.contact.id}`, action, fileId,
    JSON.stringify({ contactId: c.contact.id, linkId: c.link.id, requestId: c.request.id }), now());
}
async function load(db: D1Database, token: string, uploadId: string) {
  const u = await stmt(db, 'SELECT * FROM b_document_uploads WHERE id=?', text(uploadId, 'Upload', 100)).first<Data>();
  insist(u?.portal_link_id, 'Upload not found', 404);
  const c = await context(db, token, u.request_id);
  insist(u.portal_link_id === c.link.id && u.portal_contact_id === c.contact.id && u.portal_contact_revision === c.contact.revision, 'Upload not found', 404);
  insist(u.expires_at > now(), 'This upload expired. Start again with the original.', 410);
  if (u.state === 'completed') insist(await stmt(db, 'SELECT 1 FROM b_files WHERE id=? AND erased_at IS NULL', u.file_id).first(), 'Original no longer available', 404);
  else insist(c.request.status !== 'accepted', 'This request no longer accepts uploads', 409);
  return { u, c };
}
export async function portalPacketStatus(db: D1Database, token: string, uploadId: string) {
  return packetSummary((await load(db, token, uploadId)).u);
}
export async function portalPacketList(db: D1Database, token: string, requestId: string) {
  const c = await context(db, token, requestId);
  return (await rows(db, `SELECT * FROM b_document_uploads WHERE portal_link_id=? AND portal_contact_id=? AND portal_contact_revision=? AND request_id=? AND expires_at>? ORDER BY created_at DESC`,
    c.link.id, c.contact.id, c.contact.revision, requestId, now())).map(packetSummary);
}
export async function startPortalPacket(db: D1Database, token: string, requestId: string, body: Data) {
  const c = await context(db, token, requestId);
  insist(c.request.status !== 'accepted', 'This request no longer accepts uploads', 409);
  const name = text(body.name, 'File name', 200).replace(/[\\/]/g, '_'), mime = optional(body.mime, 'File type', 100) || 'application/octet-stream';
  const size = integer(body.size, 'Original size', 1, PACKET_LIMITS.maxBytes), sha256 = packetHash(body.sha256), pages = integer(body.pageCount, 'Page count', 1, PACKET_LIMITS.maxPages);
  const uploadId = id(), fileId = id(), at = now(), expires = new Date(Date.now() + PACKET_LIMITS.pendingDays * 86400000).toISOString();
  const [check, release] = authority(db, c);
  await purgeDocumentUploads(db);
  await batch(db, [check, stmt(db, `INSERT INTO b_document_uploads(id,job_id,request_id,file_id,packet_id,version,name,mime,size,sha256,page_count,source,author,created_by,created_at,expires_at,portal_link_id,portal_contact_id,portal_contact_revision)
    VALUES(?,?,?,?,?,1,?,?,?,?,?,'Client portal',?,?,?,?,?,?,?)`, uploadId, c.job.id, requestId, fileId, fileId, name, mime, size, sha256, pages,
    c.contact.name, `portal contact ${c.contact.id}`, at, expires, c.link.id, c.contact.id, c.contact.revision), event(db, c, 'file.upload_started', fileId), release]);
  return portalPacketStatus(db, token, uploadId);
}
export async function appendPortalPacket(db: D1Database, token: string, uploadId: string, body: Data) {
  const { u, c } = await load(db, token, uploadId), offset = integer(body.offset, 'Offset', 0, u.size - 1), chunkId = text(body.chunkId, 'Chunk id', 100);
  const { bytes, encoded } = decodePacket(body.contentBase64), sha256 = packetHash(body.sha256);
  insist(await digest(bytes) === sha256, 'Chunk hash does not match the original', 409);
  insist(offset % PACKET_LIMITS.chunkBytes === 0 && bytes.length === Math.min(PACKET_LIMITS.chunkBytes, u.size - offset), 'Send a full chunk except for the final chunk');
  const table = u.state === 'completed' ? 'b_document_chunks' : 'b_document_upload_chunks', key = u.state === 'completed' ? 'file_id' : 'upload_id';
  const prior = await stmt(db, `SELECT * FROM ${table} WHERE ${key}=? AND (offset=? OR chunk_id=?)`, u.state === 'completed' ? u.file_id : u.id, offset, chunkId).first<Data>();
  insist(!prior || prior.offset === offset && prior.chunk_id === chunkId && prior.sha256 === sha256 && prior.size === bytes.length, 'Different bytes already occupy this chunk', 409);
  if (u.state === 'completed') { insist(prior, 'Upload already complete', 409); return packetSummary(u); }
  insist(prior || offset === u.received_bytes, `Resume at byte ${u.received_bytes}`, 409);
  const [check, release] = authority(db, c, `EXISTS(SELECT 1 FROM b_document_uploads u WHERE u.id=? AND u.state='pending' AND u.expires_at>? AND
    ((u.received_bytes=? AND NOT EXISTS(SELECT 1 FROM b_document_upload_chunks WHERE upload_id=u.id AND (offset=? OR chunk_id=?))) OR
    EXISTS(SELECT 1 FROM b_document_upload_chunks WHERE upload_id=u.id AND offset=? AND chunk_id=? AND sha256=? AND size=?)))`,
    [u.id, now(), offset, offset, chunkId, offset, chunkId, sha256, bytes.length]);
  await batch(db, [check, stmt(db, `INSERT INTO b_document_upload_chunks(upload_id,chunk_id,offset,size,sha256,content_base64) VALUES(?,?,?,?,?,?) ON CONFLICT(upload_id,chunk_id) DO NOTHING`,
    u.id, chunkId, offset, bytes.length, sha256, encoded), stmt(db, 'UPDATE b_document_uploads SET received_bytes=received_bytes+? WHERE id=? AND received_bytes=?', bytes.length, u.id, offset), release]);
  return portalPacketStatus(db, token, u.id);
}
export async function completePortalPacket(db: D1Database, token: string, uploadId: string) {
  const { u, c } = await load(db, token, uploadId);
  if (u.state === 'completed') return packetSummary(u);
  insist(u.received_bytes === u.size, 'Upload incomplete. Reselect the exact original to resume.', 409);
  const chunks = await rows(db, 'SELECT * FROM b_document_upload_chunks WHERE upload_id=? ORDER BY offset', u.id);
  await assemblePacket(chunks, u.size, u.sha256);
  const manifest = new TextEncoder().encode(JSON.stringify({ format: 'blotter.chunked-document/1', size: u.size, sha256: u.sha256, chunks: chunks.length }));
  const [check, release] = authority(db, c, `EXISTS(SELECT 1 FROM b_document_uploads WHERE id=? AND state='pending' AND received_bytes=size AND expires_at>?)`, [u.id, now()]);
  const at = now(), by = `portal contact ${c.contact.id}`;
  try {
    await batch(db, [check, stmt(db, `INSERT INTO b_files(id,request_id,job_id,name,mime,size,sha256,content_base64,uploaded_by,channel,uploaded_at,storage) VALUES(?,?,?,?,?,?,?,?,?,'portal',?,'packet')`,
      u.file_id, u.request_id, u.job_id, u.name, u.mime, manifest.length, u.sha256, encodePacket(manifest), by, at),
      stmt(db, `INSERT INTO b_document_packets(file_id,packet_id,version,original_size,page_count,source,author,revision) VALUES(?,?,1,?,?,?,?,?)`, u.file_id, u.packet_id, u.size, u.page_count, u.source, u.author, id()),
      stmt(db, 'INSERT INTO b_document_chunks(file_id,chunk_id,offset,size,sha256,content_base64) SELECT ?,chunk_id,offset,size,sha256,content_base64 FROM b_document_upload_chunks WHERE upload_id=?', u.file_id, u.id),
      stmt(db, 'DELETE FROM b_document_upload_chunks WHERE upload_id=?', u.id), stmt(db, "UPDATE b_document_uploads SET state='completed' WHERE id=?", u.id),
      stmt(db, "UPDATE b_requests SET status='received',updated_by=?,updated_at=? WHERE id=?", by, at, u.request_id), event(db, c, 'file.uploaded', u.file_id), release]);
  } catch (e) {
    // A concurrent completion is a replay only after rechecking live portal authority.
    const current = await load(db, token, uploadId);
    if (current.u.state !== 'completed') throw e;
  }
  return portalPacketStatus(db, token, u.id);
}
export async function cancelPortalPacket(db: D1Database, token: string, uploadId: string) {
  const { u, c } = await load(db, token, uploadId);
  insist(u.state === 'pending', 'Completed originals use staff retention and erasure controls', 409);
  const [check, release] = authority(db, c, "EXISTS(SELECT 1 FROM b_document_uploads WHERE id=? AND state='pending')", [u.id]);
  await batch(db, [check, stmt(db, 'DELETE FROM b_document_uploads WHERE id=?', u.id), event(db, c, 'file.upload_cancelled', u.file_id), release]);
  return { ok: true };
}
