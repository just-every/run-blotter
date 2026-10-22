import { documentBytes } from './document-packets';
// Audited staff, contact-portal and bearer download transports.
import { atomic, audit, digest, Fault, guard, id, insist, now, stmt, type Actor, type Data } from './model';
import { source, staffFile, scopeGuard, CONTACT_OK } from './document-source';
import { gateLockedSql, gateRefusal } from './payment-gates';

/** No documents import: these headers also avoid a documents/share circular dependency. */
async function downloadResponse(db: D1Database, file: Data) {
  const safeTypes = ['application/pdf', 'image/png', 'image/jpeg', 'text/csv', 'text/plain'];
  return new Response(await documentBytes(db,file), { headers: {
    'content-type': safeTypes.includes(file.mime) ? file.mime : 'application/octet-stream',
    'content-disposition': `attachment; filename="${String(file.name).replace(/[^A-Za-z0-9._ -]/g, '_')}"`,
    'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer',
  } });
}

/** Staff scope is unchanged by client grants. Audit and source/authority guards commit together. */
export async function staffDownload(db: D1Database, actor: Actor, fileId: string) {
  const file = await staffFile(db, actor, fileId), [same, done] = scopeGuard(db, actor, file);
  await atomic(db, actor, [same, audit(db, actor, 'file.downloaded', file.file_key, JSON.stringify({ channel: 'staff', sha256: file.sha256 })), done]);
  return downloadResponse(db,file);
}

const sharedSql = `SELECT f.* FROM b_document_shares s JOIN b_document_access a ON a.file_key=s.file_key
  JOIN b_document_grants g ON g.file_key=s.file_key AND g.contact_id=s.contact_id
  JOIN b_client_contacts c ON c.id=s.contact_id JOIN b_clients e ON e.id=c.client_id
  JOIN b_document_sources f ON f.file_key=s.file_key
  WHERE s.digest=? AND s.revoked_at IS NULL AND s.expires_at>? AND a.visibility='contacts'
  AND a.revision=s.access_revision AND a.sha256=s.sha256 AND f.sha256=s.sha256
  AND a.job_id=f.job_id AND a.client_id=f.client_id AND c.client_id=f.client_id
  AND c.revision=s.contact_revision AND ${CONTACT_OK} AND f.content_base64 IS NOT NULL`;

/** A bearer has one recipient-scoped file, never an entity/job listing or identity claim. */
export async function sharedDownload(db: D1Database, token: string) {
  insist(/^ds_[0-9a-f]{64}$/.test(token), 'This file link is unavailable', 404);
  const hashed = await digest(token), at = now(), shared = await stmt(db, 'SELECT file_key FROM b_document_shares WHERE digest=?', hashed).first<Data>();
  const locked = shared ? await gateRefusal(db, shared.file_key) : null; insist(!locked, locked ?? '', 402);
  const [check, release] = guard(db, `EXISTS(${sharedSql}) AND NOT ${gateLockedSql}`, hashed, at, shared?.file_key ?? '');
  let result: D1Result<Data>[];
  try {
    result = await db.batch<Data>([check, stmt(db, sharedSql, hashed, at),
      stmt(db, `INSERT INTO b_audit(id,actor,action,object_id,detail,at)
        SELECT ?,'document bearer (identity not verified)','file.downloaded',s.file_key,
        json_object('shareId',s.id,'contactId',s.contact_id,'channel','bearer','identityVerified',0,'sha256',s.sha256),?
        FROM b_document_shares s WHERE s.digest=?`, id(), at, hashed), release]);
  } catch (error) {
    if (/b_guard|constraint/i.test(String(error))) insist(false, 'This file link is unavailable', 404);
    throw error;
  }
  const file = result[1].results[0];
  insist(file, 'This file link is unavailable', 404);
  return downloadResponse(db,file);
}

const contactSql = `SELECT f.* FROM b_document_sources f JOIN b_document_access a ON a.file_key=f.file_key
  JOIN b_document_grants g ON g.file_key=f.file_key JOIN b_client_contacts c ON c.id=g.contact_id
  JOIN b_clients e ON e.id=c.client_id WHERE f.file_key=? AND c.id=? AND a.visibility='contacts'
  AND a.sha256=f.sha256 AND a.job_id=f.job_id AND a.client_id=f.client_id AND c.client_id=f.client_id
  AND ${CONTACT_OK} AND f.content_base64 IS NOT NULL`;

/** Listing filter only. The download repeats this check atomically with its audit. */
export async function contactCanRead(db: D1Database, fileRef: string, contactId: string) {
  try {
    const file = await source(db, fileRef);
    return Boolean(await stmt(db, contactSql, file.file_key, contactId).first<Data>());
  } catch (error) {
    if (error instanceof Fault && error.status === 404) return false;
    throw error;
  }
}

/** The caller supplies a contact from a validated entity-scoped portal link. */
export async function contactDownload(db: D1Database, fileRef: string, contactId: string, portalLinkId?: string) {
  const file = await source(db, fileRef), at = now();
  const locked = await gateRefusal(db, file.file_key); insist(!locked, locked ?? '', 402);
  const [check, release] = guard(db, `EXISTS(${contactSql}) AND NOT ${gateLockedSql} AND (? IS NULL OR EXISTS(SELECT 1 FROM b_portal_links l JOIN b_jobs j ON j.id=l.job_id WHERE l.id=? AND l.contact_id=? AND l.job_id=? AND l.revoked_at IS NULL AND l.expires_at>? AND j.status<>'signed_off'))`, file.file_key, contactId,file.file_key,portalLinkId??null,portalLinkId??null,contactId,file.job_id,at);
  let result: D1Result<Data>[];
  try {
    result = await db.batch<Data>([check, stmt(db, contactSql, file.file_key, contactId),
      stmt(db, `INSERT INTO b_audit(id,actor,action,object_id,detail,at) VALUES(?,'contact portal bearer (identity not verified)','file.downloaded',?,?,?)`,
        id(), file.file_key, JSON.stringify({ contactId, channel: 'contact_portal', identityVerified: false, sha256: file.sha256 }), at), release]);
  } catch (error) {
    if (/b_guard|constraint/i.test(String(error))) insist(false, 'This contact cannot access this file', 404);
    throw error;
  }
  insist(result[1].results[0], 'This contact cannot access this file', 404);
  return downloadResponse(db,result[1].results[0]);
}
