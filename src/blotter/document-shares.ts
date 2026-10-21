// DOC-002: explicit entity-contact grants and recipient-scoped bearer downloads.
// Ref: ordinary upload id, deliverable:id, expense:id, task:jobId:ordinal, notice:eventId,
// intake:id (converted intake refs resolve to the regular upload).
import { atomic, audit, digest, guard, human, id, insist, integer, need, now, readableJob, rows, secret, stmt, text, type Actor, type Data } from './model';
import { staffFile, accessRow, revisionSql, revisionParams, scopeGuard, checkedRevision, liveAccess, contactReason, CONTACT_OK } from './document-source';
export { staffDownload,sharedDownload,contactCanRead,contactDownload } from './document-downloads';
export { initialContactAccessStatements,inheritAccessStatements } from './document-versions';

const DAY = 86_400_000;
const BEARER_NOTICE = 'Anyone holding this link can download this file. Possession of the link does not verify the recipient’s identity.';
const SHARE_COLUMNS = 'id,contact_id,contact_revision,access_revision,sha256,created_by,created_at,expires_at,revoked_at';
/** Preview contains no secret or digest, including existing expired/revoked shares. */
export async function staffAccess(db: D1Database, actor: Actor, fileId: string) {
  const file = await staffFile(db, actor, fileId);
  const [access, contacts, grants, shares, history] = await Promise.all([
    accessRow(db, file.file_key),
    file.client_id ? rows(db, `SELECT c.id,c.name,c.email,c.active,c.authorized,c.portal,c.revision,e.lifecycle,e.merged_into
      FROM b_client_contacts c JOIN b_clients e ON e.id=c.client_id WHERE c.client_id=? ORDER BY c.name,c.id`, file.client_id) : Promise.resolve([]),
    rows(db, 'SELECT contact_id,granted_by,granted_at FROM b_document_grants WHERE file_key=?', file.file_key),
    rows(db, `SELECT ${SHARE_COLUMNS} FROM b_document_shares WHERE file_key=? ORDER BY created_at DESC,id`, file.file_key),
    rows(db,"SELECT actor,action,detail,at FROM b_audit WHERE object_id=? AND action LIKE 'file.%' ORDER BY at DESC LIMIT 100",file.file_key),
  ]);
  const visible = liveAccess(file, access), at = now();
  const list = shares.map(s => {
    const contact = contacts.find(c => c.id === s.contact_id);
    const granted = grants.some(g => g.contact_id === s.contact_id);
    const state = s.revoked_at ? 'revoked' : s.expires_at <= at ? 'expired' :
      !visible || !granted || !contact || contactReason(contact) || contact.revision !== s.contact_revision || s.access_revision !== access?.revision || s.sha256 !== file.sha256 ? 'unavailable' : 'active';
    return { id: s.id, contactId: s.contact_id, createdBy: s.created_by, createdAt: s.created_at, expiresAt: s.expires_at, revokedAt: s.revoked_at, state };
  });
  return {
    file: { id: file.file_key, kind: file.kind, name: file.name, jobId: file.job_id, clientId: file.client_id, sha256: file.sha256 },
    visibility: visible ? 'contacts' : 'internal', revision: access?.revision ?? null,
    canManage: actor.channel === 'person' && ['owner', 'reviewer'].includes(actor.role), bearerNotice: BEARER_NOTICE,
    contacts: contacts.map(c => ({ id: c.id, name: c.name, email: c.email, eligible: !contactReason(c), reason: contactReason(c),
      granted: visible && grants.some(g => g.contact_id === c.id), shares: list.filter(s => s.contactId === c.id) })),
    history, grants, shares: list,
  };
}

/** Replace the entire explicit grant set. Merely filing bytes never grants access. */
export async function saveAccess(db: D1Database, actor: Actor, fileId: string, body: Data) {
  human(actor); need(actor, 'owner', 'reviewer');
  const file = await staffFile(db, actor, fileId), access = await accessRow(db, file.file_key);
  insist(body.visibility!=='contacts' || !await stmt(db,'SELECT 1 FROM b_sensitive_documents WHERE file_key=?',file.file_key).first(),'Restricted documents cannot be exposed to contacts',403);
  checkedRevision(body, access);
  insist(body.visibility === 'internal' || body.visibility === 'contacts', 'Choose internal or explicit contact access');
  insist(Array.isArray(body.contactIds) && body.contactIds.length <= 100, 'Choose up to 100 contacts');
  const contactIds = [...new Set((body.contactIds as unknown[]).map(v => text(v, 'Contact', 200)))];
  insist(body.visibility !== 'internal' || !contactIds.length, 'An internal file cannot have contact grants');
  insist(body.visibility !== 'contacts' || (file.client_id && contactIds.length), 'Choose at least one contact on this file’s client entity');
  const contacts = await Promise.all(contactIds.map(contactId => stmt(db, `SELECT c.id,c.revision FROM b_client_contacts c JOIN b_clients e ON e.id=c.client_id
    WHERE c.id=? AND c.client_id=? AND ${CONTACT_OK}`, contactId, file.client_id).first<Data>()));
  insist(contacts.every(Boolean), 'Every recipient must be an active, authorized portal contact on this client entity', 409);
  const [same, done] = scopeGuard(db, actor, file), [unchanged, release] = guard(db, revisionSql, ...revisionParams(file, access));
  const contactGuards = contacts.map(c => guard(db, `EXISTS(SELECT 1 FROM b_client_contacts c JOIN b_clients e ON e.id=c.client_id
    WHERE c.id=? AND c.client_id=? AND c.revision=? AND ${CONTACT_OK})`, c!.id, file.client_id, c!.revision));
  const revision = id(), at = now();
  await atomic(db, actor, [same, unchanged, ...contactGuards.map(g => g[0]),
    stmt(db, `INSERT INTO b_document_access(file_key,job_id,client_id,sha256,visibility,revision,updated_by,updated_at) VALUES(?,?,?,?,?,?,?,?)
      ON CONFLICT(file_key) DO UPDATE SET job_id=excluded.job_id,client_id=excluded.client_id,sha256=excluded.sha256,visibility=excluded.visibility,revision=excluded.revision,updated_by=excluded.updated_by,updated_at=excluded.updated_at`,
      file.file_key, file.job_id, file.client_id, file.sha256, body.visibility, revision, actor.email, at),
    stmt(db, 'UPDATE b_document_shares SET revoked_at=? WHERE file_key=? AND revoked_at IS NULL', at, file.file_key),
    stmt(db, 'DELETE FROM b_document_grants WHERE file_key=?', file.file_key),
    ...contactIds.map(contactId => stmt(db, 'INSERT INTO b_document_grants(file_key,contact_id,granted_by,granted_at) VALUES(?,?,?,?)', file.file_key, contactId, actor.email, at)),
    audit(db, actor, 'file.access_changed', file.file_key, JSON.stringify({ visibility: body.visibility, contactIds, sha256: file.sha256 })),
    ...contactGuards.map(g => g[1]), release, done,
  ]);
  return staffAccess(db, actor, file.file_key);
}

function expiry(body: Data, at: string) {
  const expires = body.expiresAt === undefined ? Date.parse(at) + integer(body.days ?? 30, 'Expiry days', 1, 30) * DAY : Date.parse(text(body.expiresAt, 'Expiry', 40));
  insist(Number.isFinite(expires) && expires > Date.parse(at) && expires <= Date.parse(at) + 30 * DAY, 'Share expiry must be in the next 30 days');
  return new Date(expires).toISOString();
}

async function shareContext(db: D1Database, actor: Actor, fileId: string, body: Data) {
  human(actor); need(actor, 'owner', 'reviewer');
  const file = await staffFile(db, actor, fileId), access = await accessRow(db, file.file_key);
  checkedRevision(body, access);
  insist(liveAccess(file, access), 'Explicitly grant contact access to this file first', 409);
  return { file, access: access! };
}

async function issueShare(db: D1Database, actor: Actor, fileId: string, body: Data, replacing?: string) {
  const { file, access } = await shareContext(db, actor, fileId, body);
  const previous = replacing ? await stmt(db, 'SELECT * FROM b_document_shares WHERE id=? AND file_key=?', replacing, file.file_key).first<Data>() : null;
  insist(!replacing || previous, 'Share not found', 404);
  insist(!previous?.revoked_at, 'This share was revoked. Create a new share instead.', 409);
  const contactId = previous?.contact_id ?? text(body.contactId, 'Contact', 200);
  const contact = await stmt(db, `SELECT c.id,c.revision FROM b_client_contacts c JOIN b_clients e ON e.id=c.client_id
    JOIN b_document_grants g ON g.contact_id=c.id AND g.file_key=? WHERE c.id=? AND c.client_id=? AND ${CONTACT_OK}`, file.file_key, contactId, file.client_id).first<Data>();
  insist(contact, 'This contact no longer has permission for this file', 409);
  if (!replacing) insist(!await stmt(db, 'SELECT 1 FROM b_document_shares WHERE file_key=? AND contact_id=? AND revoked_at IS NULL', file.file_key, contactId).first(), 'A share already exists for this contact; rotate it instead', 409);
  const at = now(), expiresAt = expiry(body, at), token = secret('ds_'), shareId = id();
  const [same, done] = scopeGuard(db, actor, file), [unchanged, release] = guard(db, `${revisionSql} AND EXISTS(SELECT 1 FROM b_client_contacts c
    JOIN b_clients e ON e.id=c.client_id JOIN b_document_grants g ON g.contact_id=c.id AND g.file_key=?
    WHERE c.id=? AND c.client_id=? AND c.revision=? AND ${CONTACT_OK})`, ...revisionParams(file, access), file.file_key, contactId, file.client_id, contact.revision);
  const priorGuard = previous ? guard(db, 'EXISTS(SELECT 1 FROM b_document_shares WHERE id=? AND file_key=? AND digest=? AND revoked_at IS ?)', previous.id, file.file_key, previous.digest, previous.revoked_at) : null;
  await atomic(db, actor, [same, unchanged, ...(priorGuard ? [priorGuard[0]] : []),
    ...(previous ? [stmt(db, 'UPDATE b_document_shares SET revoked_at=? WHERE file_key=? AND contact_id=? AND revoked_at IS NULL', at, file.file_key, contactId)] : []),
    stmt(db, `INSERT INTO b_document_shares(id,file_key,contact_id,contact_revision,access_revision,sha256,digest,created_by,created_at,expires_at) VALUES(?,?,?,?,?,?,?,?,?,?)`,
      shareId, file.file_key, contactId, contact.revision, access.revision, file.sha256, await digest(token), actor.email, at, expiresAt),
    audit(db, actor, previous ? 'file.share_rotated' : 'file.share_created', file.file_key, JSON.stringify({ shareId, contactId, expiresAt })),
    ...(priorGuard ? [priorGuard[1]] : []), release, done,
  ]);
  return { id: shareId, fileId: file.file_key, contactId, token, expiresAt, bearerNotice: BEARER_NOTICE };
}

export const createShare = (db: D1Database, actor: Actor, fileId: string, body: Data) => issueShare(db, actor, fileId, body);
export const rotateShare = (db: D1Database, actor: Actor, fileId: string, shareId: string, body: Data) => issueShare(db, actor, fileId, body, text(shareId, 'Share'));

export async function revokeShare(db: D1Database, actor: Actor, fileId: string, shareId: string, body: Data) {
  human(actor); need(actor, 'owner', 'reviewer');
  const file = await staffFile(db, actor, fileId), access = await accessRow(db, file.file_key);
  checkedRevision(body, access);
  const share = await stmt(db, 'SELECT id,contact_id,revoked_at FROM b_document_shares WHERE id=? AND file_key=?', shareId, file.file_key).first<Data>();
  insist(share, 'Share not found', 404);
  const [same, done] = scopeGuard(db, actor, file), [unchanged, release] = guard(db, `${revisionSql}
    AND EXISTS(SELECT 1 FROM b_document_shares WHERE id=? AND file_key=? AND revoked_at IS ?)`, ...revisionParams(file, access), share.id, file.file_key, share.revoked_at);
  await atomic(db, actor, [same, unchanged,
    stmt(db, 'UPDATE b_document_shares SET revoked_at=? WHERE id=? AND revoked_at IS NULL', now(), share.id),
    audit(db, actor, 'file.share_revoked', file.file_key, JSON.stringify({ shareId: share.id, contactId: share.contact_id })), release, done]);
  return { id: share.id, revoked: true };
}

/** Every current byte store on a readable job, with no bytes in the index. */
export async function jobDocuments(db: D1Database, actor: Actor, jobId: string) {
  await readableJob(db,actor,jobId);
  return rows(db, `SELECT f.file_key,f.kind,f.name,f.sha256,f.size,CASE WHEN a.sha256=f.sha256 AND a.client_id=f.client_id AND a.visibility='contacts' THEN 'contacts' ELSE 'internal' END visibility
    FROM b_document_sources f LEFT JOIN b_document_access a ON a.file_key=f.file_key WHERE f.job_id=? ORDER BY f.kind,f.name,f.file_key`,jobId);
}

/** Client index uses the same live explicit grant as the download door. */
export async function contactDocuments(db: D1Database,jobId: string,contactId: string) {
 return rows(db,`SELECT f.file_key,f.kind,f.name,f.mime,f.size,f.sha256 FROM b_document_sources f
 JOIN b_document_access a ON a.file_key=f.file_key JOIN b_document_grants g ON g.file_key=f.file_key
 JOIN b_client_contacts c ON c.id=g.contact_id JOIN b_clients e ON e.id=c.client_id
 WHERE f.job_id=? AND c.id=? AND a.visibility='contacts' AND a.sha256=f.sha256
 AND a.job_id=f.job_id AND a.client_id=f.client_id AND c.client_id=f.client_id AND ${CONTACT_OK} AND f.kind<>'deliverable' ORDER BY f.name`,jobId,contactId);
}
