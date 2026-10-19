// Exact grant inheritance for explicitly sent deliverable versions.
import { audit, guard, human, id, insist, need, now, stmt, text, type Actor, type Data } from './model';
import { staffFile, accessRow, revisionSql, revisionParams, scopeGuard, liveAccess, CONTACT_OK } from './document-source';

function deliverableRef(ref: string) {
  const key = text(ref, 'Deliverable document', 250);
  insist(/^deliverable:[^:]+$/.test(key), 'Access inheritance is only available between deliverable versions');
  return key;
}

/** Append after the new version INSERT, inside the sender's atomic() batch. */
export async function initialContactAccessStatements(db: D1Database, ref: string, hash: string, contactId: string, actor: Actor) {
  human(actor); need(actor,'owner','reviewer','preparer');
  const key = deliverableRef(ref), contact = await stmt(db, `SELECT c.id,c.client_id,c.revision FROM b_client_contacts c
    JOIN b_clients e ON e.id=c.client_id WHERE c.id=? AND ${CONTACT_OK}`, text(contactId, 'Contact', 100)).first<Data>();
  insist(contact, 'Choose an active authorized portal contact', 409);
  const revision = id(), at = now(), [check, release] = guard(db, `NOT EXISTS(SELECT 1 FROM b_document_access WHERE file_key=?)
    AND EXISTS(SELECT 1 FROM b_document_sources f JOIN b_client_contacts c ON c.client_id=f.client_id
      JOIN b_clients e ON e.id=c.client_id WHERE f.file_key=? AND f.sha256=? AND f.content_base64 IS NOT NULL
      AND c.id=? AND c.client_id=? AND c.revision=? AND ${CONTACT_OK}
      AND (? IN ('owner','reviewer') OR EXISTS(SELECT 1 FROM b_jobs j WHERE j.id=f.job_id AND j.preparer_email=?)))`, key, key, hash, contact.id, contact.client_id, contact.revision,actor.role,actor.email);
  return [check,
    stmt(db, `INSERT INTO b_document_access(file_key,job_id,client_id,sha256,visibility,revision,updated_by,updated_at)
      SELECT file_key,job_id,client_id,sha256,'contacts',?,?,? FROM b_document_sources WHERE file_key=?`, revision, actor.email, at, key),
    stmt(db, 'INSERT INTO b_document_grants(file_key,contact_id,granted_by,granted_at) VALUES(?,?,?,?)', key, contact.id, actor.email, at),
    audit(db, actor, 'file.access_changed', key, JSON.stringify({ visibility: 'contacts', contactIds: [contact.id], sha256: hash })), release,
  ];
}

/** A new version copies the previous version's grants exactly; links never travel. */
export async function inheritAccessStatements(db: D1Database, fromRef: string, toRef: string, toHash: string, actor: Actor) {
  human(actor);
  const file = await staffFile(db, actor, deliverableRef(fromRef)), key = deliverableRef(toRef), access = await accessRow(db, file.file_key);
  insist(file.file_key !== key, 'Choose a new deliverable version');
  const previous = await stmt(db, 'SELECT deliverable_id FROM b_deliverable_versions WHERE id=?', file.document_id).first<Data>();
  const visible = liveAccess(file, access), revision = id(), at = now();
  const [same, done] = scopeGuard(db, actor, file), [check, release] = guard(db, `${revisionSql}
    AND NOT EXISTS(SELECT 1 FROM b_document_access WHERE file_key=?)
    AND (? IN ('owner','reviewer') OR EXISTS(SELECT 1 FROM b_jobs WHERE id=? AND preparer_email=?))
    AND EXISTS(SELECT 1 FROM b_document_sources f JOIN b_deliverable_versions v ON v.id=f.document_id
      WHERE f.file_key=? AND f.kind='deliverable' AND f.job_id=? AND f.client_id=? AND f.sha256=?
      AND f.content_base64 IS NOT NULL AND v.deliverable_id=?)`, ...revisionParams(file, access), key, actor.role, file.job_id, actor.email,
      key, file.job_id, file.client_id, toHash, previous!.deliverable_id);
  return [same, check,
    stmt(db, `INSERT INTO b_document_access(file_key,job_id,client_id,sha256,visibility,revision,updated_by,updated_at)
      VALUES(?,?,?,?,?,?,?,?)`, key, file.job_id, file.client_id, toHash, visible ? 'contacts' : 'internal', revision, actor.email, at),
    ...(visible ? [stmt(db, `INSERT INTO b_document_grants(file_key,contact_id,granted_by,granted_at)
      SELECT ?,contact_id,?,? FROM b_document_grants WHERE file_key=?`, key, actor.email, at, file.file_key)] : []),
    audit(db, actor, 'file.access_inherited', key, JSON.stringify({ fromRef: file.file_key, visibility: visible ? 'contacts' : 'internal', sha256: toHash })), release, done,
  ];
}
