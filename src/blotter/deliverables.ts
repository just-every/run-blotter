// Client approval of deliverables (DOC-003): staff send a numbered version of a
// deliverable through the client link; the client approves that exact version,
// or asks for changes with a comment. A decision records the approver, the time
// and the version's SHA-256. A newer version resets approval, and an approval can
// submit the job for review when its checklist and documents are complete.
import { runtimeBindings, type Bindings } from '../auth.server';
import { decodeFile, fileResponse, issueLink, mailClient, portalJob } from './documents';
import { atomic, audit, digest, guard, human, id, insist, job, now, optional, rows, stmt, text, type Actor, type Data } from './model';

const COLUMNS = `id,deliverable_id,version,name,mime,size,sha256,note,submit_on_approval,sent_by,sent_at,delivery,status,
  approver_name,approver_email,decided_at,decided_sha256,comment,moved_job`;
const newest = 'NOT EXISTS(SELECT 1 FROM b_deliverable_versions n WHERE n.deliverable_id=? AND n.version>?)';

/** Each deliverable with its versions, newest first; the newest version carries the deliverable's status. */
export async function deliverablesFor(db: D1Database, jobId: string) {
  const [series, versions] = await Promise.all([
    rows(db, 'SELECT * FROM b_deliverables WHERE job_id=? ORDER BY created_at', jobId),
    rows(db, `SELECT ${COLUMNS} FROM b_deliverable_versions WHERE job_id=? ORDER BY version DESC`, jobId),
  ]);
  return series.map((d): Data => {
    const list = versions.filter(v => v.deliverable_id === d.id);
    return { ...d, status: list[0]?.status, currentVersionId: list[0]?.id, versions: list };
  });
}

/** Sends a new deliverable, or the next version of one, and mails the client a fresh link to decide on it. */
export async function sendDeliverable(env: Bindings, actor: Actor, jobId: string, body: Data) {
  human(actor);
  const bindings = runtimeBindings(env), db = bindings.DB;
  const j = await job(db, actor, jobId);
  insist(j.status === 'open', 'Deliverables are sent from open jobs', 409);
  const client = await stmt(db, 'SELECT * FROM b_clients WHERE id=?', j.client_id).first<Data>();
  insist(client?.contact_email, 'Add a contact email for this client first', 409);
  const file = decodeFile(body), sha256 = await digest(file.bytes), at = now(), versionId = id();
  const existing = body.deliverableId === undefined ? null : await stmt(db, 'SELECT * FROM b_deliverables WHERE id=? AND job_id=?', String(body.deliverableId), j.id).first<Data>();
  insist(body.deliverableId === undefined || existing, 'Deliverable not found', 404);
  const deliverable = existing ?? { id: id(), title: text(body.title, 'Deliverable', 200) };
  if (!existing) insist(!await stmt(db, 'SELECT 1 FROM b_deliverables WHERE job_id=? AND title=?', j.id, deliverable.title).first(), 'This job already has a deliverable with that title: send a new version of it', 409);
  const last = await stmt(db, 'SELECT MAX(version) v FROM b_deliverable_versions WHERE deliverable_id=?', deliverable.id).first<Data>();
  const version = Number(last?.v ?? 0) + 1, note = optional(body.note, 'Note to the client', 1000);
  const link = await issueLink(db, actor, j.id, bindings.AUTH_ORIGIN);
  const [check, release] = guard(db, "EXISTS(SELECT 1 FROM b_jobs WHERE id=? AND status='open')", j.id);
  await atomic(db, actor, [check,
    ...(existing ? [] : [stmt(db, 'INSERT INTO b_deliverables(id,job_id,title,created_by,created_at) VALUES(?,?,?,?,?)', deliverable.id, j.id, deliverable.title, actor.email, at)]),
    stmt(db, `INSERT INTO b_deliverable_versions(id,deliverable_id,job_id,version,name,mime,size,sha256,content_base64,note,submit_on_approval,sent_by,sent_at,delivery,status)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,'pending','sent')`, versionId, deliverable.id, j.id, version, file.name, file.mime, file.bytes.length, sha256, file.encoded, note, body.submitOnApproval === true ? 1 : 0, actor.email, at),
    ...link.statements, release, audit(db, actor, 'deliverable.sent', versionId, `${deliverable.title} v${version} ${sha256}`)]);
  const message = [
    `Hello ${client.contact_name || client.name},`, '',
    `Please review ${deliverable.title} (version ${version}) for ${j.title} (${j.period_label}).`, '',
    ...(note ? [note, ''] : []),
    `Approve it or request changes here: ${link.url}`, `This link expires on ${link.expiresAt.slice(0, 10)}.`,
  ].join('\n');
  const delivery = await mailClient(bindings, versionId, client.contact_email, `For your approval: ${deliverable.title} v${version}`, message);
  await stmt(db, 'UPDATE b_deliverable_versions SET delivery=? WHERE id=?', delivery, versionId).run();
  return { id: versionId, deliverableId: deliverable.id, version, sha256, delivery, portalUrl: link.url, expiresAt: link.expiresAt };
}

export async function downloadVersion(db: D1Database, actor: Actor, versionId: string) {
  const v = await stmt(db, 'SELECT * FROM b_deliverable_versions WHERE id=?', versionId).first<Data>();
  insist(v, 'Deliverable not found', 404);
  await job(db, actor, v.job_id);
  return fileResponse(v);
}

// ---- Client side, authorised only by the link's secret ----

export async function portalDeliverables(db: D1Database, token: string) {
  const { job: j } = await portalJob(db, token);
  return (await deliverablesFor(db, j.id)).map(d => ({
    id: d.id, title: d.title, status: d.status, currentVersionId: d.currentVersionId,
    versions: d.versions.map((v: Data) => ({ id: v.id, version: v.version, name: v.name, size: v.size, sha256: v.sha256, note: v.note, sentAt: v.sent_at,
      status: v.status, approverName: v.approver_name, decidedAt: v.decided_at, comment: v.comment })),
  }));
}

export async function portalVersionFile(db: D1Database, token: string, versionId: string) {
  const { job: j } = await portalJob(db, token);
  const v = await stmt(db, 'SELECT * FROM b_deliverable_versions WHERE id=? AND job_id=?', versionId, j.id).first<Data>();
  insist(v, 'Document not found', 404);
  return fileResponse(v);
}

/**
 * The client approves the newest version, or asks for changes with a comment.
 * The decision names the version's SHA-256 the client reviewed; an older or
 * already-decided version is refused. An approval sent with "submit on approval"
 * moves the job to review, but only through the same gates as a person's submit.
 */
export async function portalDecide(db: D1Database, token: string, versionId: string, body: Data) {
  const { link, job: j } = await portalJob(db, token);
  const v = await stmt(db, 'SELECT * FROM b_deliverable_versions WHERE id=? AND job_id=?', versionId, j.id).first<Data>();
  insist(v, 'Document not found', 404);
  insist(!await stmt(db, `SELECT 1 FROM b_deliverable_versions WHERE deliverable_id=? AND version>?`, v.deliverable_id, v.version).first(),
    'A newer version of this document has been sent. Review the latest version.', 409);
  insist(v.status === 'sent', 'This version has already been answered', 409);
  insist(body.sha256 === v.sha256, 'This document changed since you opened it. Reload and review it again.', 409);
  insist(body.decision === 'approve' || body.decision === 'changes', 'Choose approve or request changes');
  const approve = body.decision === 'approve', at = now();
  const name = text(body.name, 'Your name', 200);
  const comment = approve ? optional(body.comment, 'Comment', 2000) : text(body.comment, 'What should change', 2000);
  const [check, release] = guard(db, `EXISTS(SELECT 1 FROM b_portal_links WHERE id=? AND revoked_at IS NULL AND expires_at>?)
    AND EXISTS(SELECT 1 FROM b_deliverable_versions WHERE id=? AND status='sent') AND ${newest}`, link.id, at, v.id, v.deliverable_id, v.version);
  const submit = approve && v.submit_on_approval === 1 ? [
    stmt(db, `UPDATE b_jobs SET status='review',submitted_by=?,submitted_at=?,revision=? WHERE id=? AND status='open'
      AND NOT EXISTS(SELECT 1 FROM b_job_steps WHERE job_id=? AND done_at IS NULL) AND NOT EXISTS(SELECT 1 FROM b_requests WHERE job_id=? AND status<>'accepted')`,
      v.sent_by, at, id(), j.id, j.id, j.id),
    stmt(db, "UPDATE b_deliverable_versions SET moved_job=1 WHERE id=? AND EXISTS(SELECT 1 FROM b_jobs WHERE id=? AND status='review' AND submitted_at=?)", v.id, j.id, at),
    stmt(db, `INSERT INTO b_audit(id,actor,action,object_id,detail,at) SELECT ?,?,'job.submitted',?,?,? WHERE EXISTS(SELECT 1 FROM b_deliverable_versions WHERE id=? AND moved_job=1)`,
      id(), `client approval (${name})`, j.id, `on approval of v${v.version} for ${v.sent_by}`, at, v.id),
  ] : [];
  try {
    await db.batch([check,
      stmt(db, 'UPDATE b_deliverable_versions SET status=?,approver_name=?,approver_email=?,decided_at=?,decided_sha256=?,comment=? WHERE id=?',
        approve ? 'approved' : 'changes_requested', name, j.contact_email ?? null, at, v.sha256, comment, v.id),
      ...submit, release,
      stmt(db, 'INSERT INTO b_audit(id,actor,action,object_id,detail,at) VALUES(?,?,?,?,?,?)', id(), `client link (${name})`,
        approve ? 'deliverable.approved' : 'deliverable.changes_requested', v.id, approve ? v.sha256 : comment, at)]);
  } catch (error) {
    if (/b_guard|constraint|immutable/i.test(String(error))) insist(false, 'This document can no longer be answered. Reload to see the latest version.', 409);
    throw error;
  }
  const after = await stmt(db, 'SELECT b_jobs.status job_status,v.status,v.moved_job FROM b_deliverable_versions v JOIN b_jobs ON b_jobs.id=v.job_id WHERE v.id=?', v.id).first<Data>();
  return { status: after!.status, jobStatus: after!.job_status, movedJob: after!.moved_job === 1 };
}
