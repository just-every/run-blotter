// Current document stores and the shared source/authority fences.
import { guard, insist, need, readableJob, readableJobParams, readableJobSql, stmt, text, type Actor, type Data } from './model';

export const CONTACT_OK = "c.active=1 AND c.authorized=1 AND c.portal=1 AND c.email<>'' AND e.lifecycle='active' AND e.merged_into IS NULL";
const noticeScopeSql = `EXISTS(SELECT 1 FROM b_notice_events ev JOIN b_notices n ON n.id=ev.notice_id
  JOIN b_jobs j ON j.id=n.job_id AND j.client_id=n.client_id WHERE ev.id=?
  AND (? IN ('owner','reviewer') OR j.preparer_email=? OR n.assignee_email=?))`;
const noticeScopeParams = (actor: Actor, file: Data) => [file.document_id, actor.role, actor.email, actor.email];

export async function source(db: D1Database, ref: string) {
  let key = text(ref, 'Document', 250);
  if (key.startsWith('intake:')) {
    const intake = await stmt(db, 'SELECT job_file_id FROM b_prospect_files WHERE id=?', key.slice(7)).first<Data>();
    if (intake?.job_file_id) key = intake.job_file_id;
  }
  const file = await stmt(db, 'SELECT * FROM b_document_sources WHERE file_key=? AND content_base64 IS NOT NULL', key).first<Data>();
  insist(file, 'File not found or erased', 404);
  return file;
}

export async function staffFile(db: D1Database, actor: Actor, ref: string) {
  const file = await source(db, ref);
  if (file.kind === 'notice') {
    insist(await stmt(db, `SELECT 1 WHERE ${noticeScopeSql}`, ...noticeScopeParams(actor, file)).first(), 'Notice not found', 404);
  } else if (file.job_id) await readableJob(db, actor, file.job_id);
  else need(actor, 'owner', 'reviewer');
  return file;
}

export const accessRow = (db: D1Database, key: string) => stmt(db, 'SELECT * FROM b_document_access WHERE file_key=?', key).first<Data>();
const sameFileSql = 'EXISTS(SELECT 1 FROM b_document_sources f WHERE f.file_key=? AND f.job_id IS ? AND f.client_id IS ? AND f.sha256=? AND f.content_base64 IS NOT NULL)';
const sameFileParams = (file: Data) => [file.file_key, file.job_id, file.client_id, file.sha256];
export const revisionSql = '((? IS NULL AND NOT EXISTS(SELECT 1 FROM b_document_access WHERE file_key=?)) OR EXISTS(SELECT 1 FROM b_document_access WHERE file_key=? AND revision=?))';
export const revisionParams = (file: Data, access: Data | null) => [access?.revision ?? null, file.file_key, file.file_key, access?.revision ?? null];

export function scopeGuard(db: D1Database, actor: Actor, file: Data) {
  if (file.kind === 'notice') return guard(db, `${sameFileSql} AND ${noticeScopeSql}`, ...sameFileParams(file), ...noticeScopeParams(actor, file));
  return guard(db, `${sameFileSql} AND (? IS NULL OR EXISTS(SELECT 1 FROM b_jobs WHERE id=? AND ${readableJobSql}))`,
    ...sameFileParams(file), file.job_id, file.job_id, ...readableJobParams(actor));
}

export function checkedRevision(body: Data, access: Data | null) {
  insist(body.revision === (access?.revision ?? null), 'Document access changed. Refresh and try again.', 409);
}

export function liveAccess(file: Data, access: Data | null) {
  return Boolean(access && access.sha256 === file.sha256 && access.job_id === file.job_id && access.client_id === file.client_id && access.visibility === 'contacts');
}

export function contactReason(c: Data) {
  if (c.lifecycle !== 'active' || c.merged_into) return 'Client entity is not active';
  if (!c.active) return 'Contact is inactive';
  if (!c.authorized) return 'Contact is not authorized for this entity';
  if (!c.portal) return 'Contact portal access is revoked';
  if (!c.email) return 'Contact has no email address';
  return '';
}
