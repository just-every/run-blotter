// DOC-001 upload transport. Staging is temporary; completion atomically files an
// immutable manifest and original chunks behind the existing b_files custody door.
import { atomic, audit, digest, guard, human, id, insist, integer, job, need, now, optional, rows, stmt, text, visibleJobParams, visibleJobSql, type Actor, type Data } from './model';
import { legacyPacketMetadata, packetInheritance } from './document-catalog';

export const PACKET_LIMITS = { maxBytes: 20 * 1024 * 1024, chunkBytes: 256 * 1024, maxPages: 2000, pendingDays: 7 } as const;
const roles = (actor: Actor) => { human(actor); need(actor, 'owner', 'reviewer', 'preparer'); };
const hash = (value: unknown) => { const v = text(value, 'SHA-256', 64).toLowerCase(); insist(/^[a-f0-9]{64}$/.test(v), 'Supply the SHA-256 of the original bytes'); return v; };
const encode = (bytes: Uint8Array) => { let binary = ''; for (let i = 0; i < bytes.length; i += 32768) binary += String.fromCharCode(...bytes.subarray(i, i + 32768)); return btoa(binary); };
function decode(value: unknown) {
  const encoded = text(value, 'Chunk contents', 349528);
  insist(encoded.length % 4 === 0 && /^[A-Za-z0-9+/]*={0,2}$/.test(encoded), 'Chunk contents must be valid base64');
  const bytes = Uint8Array.from(atob(encoded), c => c.charCodeAt(0));
  insist(bytes.length && bytes.length <= PACKET_LIMITS.chunkBytes, 'A chunk must contain 1 byte to 256 KiB');
  return { encoded, bytes };
}
const scopeSql = `EXISTS(SELECT 1 FROM b_jobs JOIN b_clients c ON c.id=b_jobs.client_id JOIN b_requests r ON r.job_id=b_jobs.id AND r.organizer_active=1
 WHERE b_jobs.id=? AND r.id=? AND b_jobs.status='open' AND c.lifecycle='active' AND c.merged_into IS NULL AND ${visibleJobSql})`;
const scopeParams = (u: Data, actor: Actor) => [u.job_id, u.request_id, ...visibleJobParams(actor)];
const summary = (u: Data) => ({ id: u.id, jobId: u.job_id, requestId: u.request_id, fileId: u.state === 'completed' ? u.file_id : null,
  name: u.name, mime: u.mime, size: u.size, sha256: u.sha256, pageCount: u.page_count, source: u.source, author: u.author,
  previousFileId: u.previous_file_id, receivedBytes: u.received_bytes, state: u.state, expiresAt: u.expires_at, limits: PACKET_LIMITS });

/** Wire to the existing scheduled door; expired staging is never portable. */
export async function purgeDocumentUploads(db: D1Database, at = now()) {
  await stmt(db, 'DELETE FROM b_document_uploads WHERE expires_at<=?', at).run();
}
async function upload(db: D1Database, actor: Actor, uploadId: string) {
  roles(actor);
  const u = await stmt(db, 'SELECT * FROM b_document_uploads WHERE id=?', text(uploadId, 'Upload', 100)).first<Data>();
  insist(u, 'Upload not found. Start again with the original file.', 404);
  const j = await job(db, actor, u.job_id);
  insist(j.status === 'open', 'The job is no longer open for uploads', 409);
  insist(await stmt(db, `SELECT 1 WHERE ${scopeSql}`, ...scopeParams(u, actor)).first(), 'The client or request is no longer accepting uploads', 409);
  if (u.expires_at <= now()) {
    await stmt(db, 'DELETE FROM b_document_uploads WHERE id=?', u.id).run();
    insist(false, 'This upload expired after seven days. Start again with the original file.', 410);
  }
  return u;
}
export async function packetUploadStatus(db: D1Database, actor: Actor, uploadId: string) {
  return summary(await upload(db, actor, uploadId));
}
export async function jobPacketUploads(db: D1Database, actor: Actor, jobId: string) {
  roles(actor); await job(db, actor, jobId);
  await purgeDocumentUploads(db);
  return (await rows(db, "SELECT * FROM b_document_uploads WHERE job_id=? AND state='pending' ORDER BY created_at DESC", jobId)).map(summary);
}
export async function startPacketUpload(db: D1Database, actor: Actor, requestId: string, body: Data) {
  roles(actor);
  const request = await stmt(db, 'SELECT * FROM b_requests WHERE id=?', requestId).first<Data>();
  insist(request && request.organizer_active, 'Request not found', 404);
  const j = await job(db, actor, request.job_id);
  insist(j.status === 'open', 'The job is no longer open for uploads', 409);
  const name = text(body.name, 'File name', 200).replace(/[\\/]/g, '_'), mime = optional(body.mime, 'File type', 100) || 'application/octet-stream';
  const size = integer(body.size, 'Original size in bytes', 1, PACKET_LIMITS.maxBytes), sha256 = hash(body.sha256);
  const pageCount = integer(body.pageCount, 'Page count', 1, PACKET_LIMITS.maxPages);
  const source = text(body.source, 'Document source', 200), author = text(body.author, 'Document author', 200);
  let previous: Data | null = null;
  if (body.previousFileId) {
    previous = await stmt(db, `SELECT f.id file_id,f.request_id,f.job_id,f.size,f.channel,p.packet_id,p.version,p.file_id metadata_exists FROM b_files f LEFT JOIN b_document_packets p ON p.file_id=f.id
      WHERE f.id=? AND f.erased_at IS NULL`, text(body.previousFileId, 'Previous version', 100)).first<Data>();
    insist(previous && previous.job_id === j.id && previous.request_id === request.id, 'Choose an existing packet in this same request', 409);
    insist(!await stmt(db, 'SELECT 1 FROM b_document_packets WHERE previous_file_id=?', previous.file_id).first(), 'A corrected version already exists. Replace the latest version instead.', 409);
  }
  const uploadId = id(), fileId = id(), packetId = previous ? previous.packet_id ?? previous.file_id : fileId, version = previous ? (previous.version ?? 1) + 1 : 1;
  const at = now(), expires = new Date(Date.now() + PACKET_LIMITS.pendingDays * 86400000).toISOString();
  const [check, release] = guard(db, scopeSql, j.id, request.id, ...visibleJobParams(actor));
  await purgeDocumentUploads(db);
  await atomic(db, actor, [check, stmt(db, `INSERT INTO b_document_uploads(id,job_id,request_id,file_id,packet_id,previous_file_id,version,name,mime,size,sha256,page_count,source,author,created_by,created_at,expires_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, uploadId, j.id, request.id, fileId, packetId, previous?.file_id ?? null, version, name, mime, size, sha256, pageCount, source, author, actor.email, at, expires),
    audit(db, actor, 'file.upload_started', fileId, JSON.stringify({ name, size, sha256, jobId: j.id })), release]);
  return packetUploadStatus(db, actor, uploadId);
}
export async function appendPacketChunk(db: D1Database, actor: Actor, uploadId: string, body: Data) {
  const u = await upload(db, actor, uploadId), offset = integer(body.offset, 'Chunk offset', 0, u.size - 1), chunkId = text(body.chunkId, 'Chunk id', 100);
  const { bytes, encoded } = decode(body.contentBase64), sha256 = hash(body.sha256);
  insist(await digest(bytes) === sha256, 'Chunk hash does not match. Retry this chunk with the original bytes.', 409);
  insist(offset % PACKET_LIMITS.chunkBytes === 0 && bytes.length === Math.min(PACKET_LIMITS.chunkBytes, u.size - offset), 'Send a full 256 KiB chunk except for the final chunk');
  const table = u.state === 'completed' ? 'b_document_chunks' : 'b_document_upload_chunks', key = u.state === 'completed' ? 'file_id' : 'upload_id';
  const prior = await stmt(db, `SELECT * FROM ${table} WHERE ${key}=? AND (chunk_id=? OR offset=?)`, u.state === 'completed' ? u.file_id : u.id, chunkId, offset).first<Data>();
  insist(!prior || (prior.chunk_id === chunkId && prior.offset === offset && prior.sha256 === sha256 && prior.size === bytes.length), 'This chunk id or offset already contains different bytes', 409);
  if (u.state === 'completed') { insist(prior, 'This upload is already complete', 409); return summary(u); }
  insist(prior || offset === u.received_bytes, `Resume at byte ${u.received_bytes}. No bytes were discarded.`, 409);
  const [check, release] = guard(db, `${scopeSql} AND EXISTS(SELECT 1 FROM b_document_uploads u WHERE u.id=? AND u.state='pending' AND u.expires_at>? AND
    ((u.received_bytes=? AND NOT EXISTS(SELECT 1 FROM b_document_upload_chunks WHERE upload_id=u.id AND (chunk_id=? OR offset=?))) OR
     EXISTS(SELECT 1 FROM b_document_upload_chunks WHERE upload_id=u.id AND chunk_id=? AND offset=? AND sha256=? AND size=?)))`,
    ...scopeParams(u, actor), u.id, now(), offset, chunkId, offset, chunkId, offset, sha256, bytes.length);
  await atomic(db, actor, [check,
    stmt(db, 'INSERT INTO b_document_upload_chunks(upload_id,chunk_id,offset,size,sha256,content_base64) VALUES(?,?,?,?,?,?) ON CONFLICT(upload_id,chunk_id) DO NOTHING', u.id, chunkId, offset, bytes.length, sha256, encoded),
    stmt(db, 'UPDATE b_document_uploads SET received_bytes=received_bytes+? WHERE id=? AND received_bytes=?', bytes.length, u.id, offset), release]);
  return packetUploadStatus(db, actor, u.id);
}

async function assemble(chunks: Data[], size: number, sha256: string) {
  const result = new Uint8Array(size); let offset = 0;
  for (const c of chunks) {
    const bytes = Uint8Array.from(atob(c.content_base64), x => x.charCodeAt(0));
    insist(c.offset === offset && c.size === bytes.length && offset + bytes.length <= size && await digest(bytes) === c.sha256,
      'Stored packet chunks are incomplete or damaged. The original cannot be downloaded.', 409);
    result.set(bytes, offset); offset += bytes.length;
  }
  insist(offset === size && await digest(result) === sha256, 'The complete packet does not match its original size and hash. Cancel this upload and start again with the original file.', 409);
  return result;
}
/** Called only after an existing custody/download permission check. No alternate download door. */
export async function documentBytes(db: D1Database, file: Data) {
  if (file.storage !== 'packet') return Uint8Array.from(atob(file.content_base64), c => c.charCodeAt(0));
  const packet = await stmt(db, `SELECT p.original_size,f.sha256 FROM b_document_packets p JOIN b_files f ON f.id=p.file_id
    WHERE p.file_id=? AND f.storage='packet' AND f.erased_at IS NULL AND f.content_base64 IS NOT NULL`, file.file_key ?? file.id).first<Data>();
  insist(packet, 'Packet original is unavailable or erased', 404);
  const chunks = await rows(db, 'SELECT * FROM b_document_chunks WHERE file_id=? ORDER BY offset', file.file_key ?? file.id);
  return assemble(chunks, packet.original_size, packet.sha256);
}
export async function completePacketUpload(db: D1Database, actor: Actor, uploadId: string) {
  const u = await upload(db, actor, uploadId);
  if (u.state === 'completed') return summary(u);
  insist(u.received_bytes === u.size, `Upload is incomplete. Resume at byte ${u.received_bytes}.`, 409);
  const chunks = await rows(db, 'SELECT * FROM b_document_upload_chunks WHERE upload_id=? ORDER BY offset', u.id);
  await assemble(chunks, u.size, u.sha256);
  const manifest = new TextEncoder().encode(JSON.stringify({ format: 'blotter.chunked-document/1', size: u.size, sha256: u.sha256, chunks: chunks.length }));
  const [check, release] = guard(db, `${scopeSql} AND EXISTS(SELECT 1 FROM b_document_uploads WHERE id=? AND state='pending' AND received_bytes=size AND expires_at>?)
    AND (? IS NULL OR EXISTS(SELECT 1 FROM b_files f WHERE f.id=? AND f.job_id=? AND f.request_id=? AND f.erased_at IS NULL
      AND NOT EXISTS(SELECT 1 FROM b_document_packets n WHERE n.previous_file_id=f.id)))`, ...scopeParams(u, actor), u.id, now(), u.previous_file_id, u.previous_file_id, u.job_id, u.request_id);
  const inherited = u.previous_file_id ? await packetInheritance(db, actor, u.previous_file_id, u.file_id, u.sha256) : [];
  const previous = u.previous_file_id ? await stmt(db, 'SELECT f.*,f.id file_id FROM b_files f LEFT JOIN b_document_packets p ON p.file_id=f.id WHERE f.id=? AND p.file_id IS NULL', u.previous_file_id).first<Data>() : null;
  const at = now();
  await atomic(db, actor, [check, ...(previous ? [legacyPacketMetadata(db, previous)] : []),
    stmt(db, `INSERT INTO b_files(id,request_id,job_id,name,mime,size,sha256,content_base64,uploaded_by,channel,uploaded_at,storage) VALUES(?,?,?,?,?,?,?,?,?,'person',?,'packet')`,
      u.file_id, u.request_id, u.job_id, u.name, u.mime, manifest.length, u.sha256, encode(manifest), actor.email, at),
    stmt(db, `INSERT INTO b_document_packets(file_id,packet_id,previous_file_id,version,original_size,page_count,source,author,revision) VALUES(?,?,?,?,?,?,?,?,?)`,
      u.file_id, u.packet_id, u.previous_file_id, u.version, u.size, u.page_count, u.source, u.author, id()),
    stmt(db, 'INSERT INTO b_document_chunks(file_id,chunk_id,offset,size,sha256,content_base64) SELECT ?,chunk_id,offset,size,sha256,content_base64 FROM b_document_upload_chunks WHERE upload_id=?', u.file_id, u.id),
    ...inherited,
    stmt(db, 'DELETE FROM b_document_upload_chunks WHERE upload_id=?', u.id),
    stmt(db, "UPDATE b_document_uploads SET state='completed' WHERE id=?", u.id),
    stmt(db, "UPDATE b_requests SET status='received',updated_by=?,updated_at=? WHERE id=?", actor.email, at, u.request_id),
    audit(db, actor, 'file.uploaded', u.file_id, JSON.stringify({ name: u.name, size: u.size, sha256: u.sha256, previousFileId: u.previous_file_id, version: u.version })), release]);
  return packetUploadStatus(db, actor, u.id);
}
export async function cancelPacketUpload(db: D1Database, actor: Actor, uploadId: string) {
  const u = await upload(db, actor, uploadId);
  insist(u.state === 'pending', 'Completed originals use the existing file erasure action', 409);
  const [check, release] = guard(db, scopeSql, ...scopeParams(u, actor));
  await atomic(db, actor, [check, stmt(db, "DELETE FROM b_document_uploads WHERE id=? AND state='pending'", u.id), audit(db, actor, 'file.upload_cancelled', u.file_id, u.name), release]);
  return { ok: true };
}
