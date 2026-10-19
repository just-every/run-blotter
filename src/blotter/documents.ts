// Client document requests: uploads (portal or staff), acceptance, download,
// reminders with a client upload link, and the public portal behind that link.
import { operatorMail } from '../mail.server.mjs';
import { demoEffect } from '../modules/demo/index.mjs';
import { runtimeBindings, type Bindings } from '../auth.server';
import { atomic, audit, digest, guard, human, id, insist, job, now, optional, rows, secret, stmt, text, type Actor, type Data } from './model';

const MAX_BYTES = 1_048_576;
const SAFE_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'text/csv', 'text/plain'];
const LINK_DAYS = 30;

export function decodeFile(body: Data) {
  const name = text(body.name, 'File name', 200).replace(/[\\/]/g, '_');
  const mime = optional(body.mime, 'File type', 100) || 'application/octet-stream';
  const encoded = text(body.contentBase64, 'File contents', 1_398_104);
  insist(/^[A-Za-z0-9+/]*={0,2}$/.test(encoded), 'File contents must be base64');
  const bytes = Uint8Array.from(atob(encoded), c => c.charCodeAt(0));
  insist(bytes.length > 0 && bytes.length <= MAX_BYTES, 'Files must be between 1 byte and 1 MiB');
  return { name, mime, encoded, bytes };
}

async function fileStatements(db: D1Database, request: Data, file: ReturnType<typeof decodeFile>, by: string, channel: 'portal' | 'person') {
  const fileId = id();
  return {
    fileId,
    statements: [
      stmt(db, 'INSERT INTO b_files(id,request_id,job_id,name,mime,size,sha256,content_base64,uploaded_by,channel,uploaded_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)',
        fileId, request.id, request.job_id, file.name, file.mime, file.bytes.length, await digest(file.bytes), file.encoded, by, channel, now()),
      stmt(db, "UPDATE b_requests SET status='received',updated_by=?,updated_at=? WHERE id=? AND status<>'accepted'", by, now(), request.id),
    ],
  };
}

async function visibleRequest(db: D1Database, actor: Actor, requestId: string) {
  const request = await stmt(db, 'SELECT * FROM b_requests WHERE id=?', requestId).first<Data>();
  insist(request, 'Request not found', 404);
  const j = await job(db, actor, request.job_id);
  return { request, job: j };
}
const openGuard = (db: D1Database, jobId: string) => guard(db, "EXISTS(SELECT 1 FROM b_jobs WHERE id=? AND status='open')", jobId);

/** A team member files a document the client sent another way (email, in person). */
export async function staffUpload(db: D1Database, actor: Actor, requestId: string, body: Data) {
  human(actor);
  const { request, job: j } = await visibleRequest(db, actor, requestId);
  insist(j.status === 'open', 'This job is not open for uploads', 409);
  const { fileId, statements } = await fileStatements(db, request, decodeFile(body), actor.email, 'person');
  const [check, release] = openGuard(db, j.id);
  await atomic(db, actor, [check, ...statements, release, audit(db, actor, 'file.uploaded', fileId, request.label)]);
  return { id: fileId };
}

export async function decideRequest(db: D1Database, actor: Actor, requestId: string, body: Data) {
  human(actor);
  const { request, job: j } = await visibleRequest(db, actor, requestId);
  insist(j.status === 'open', 'This job is not open for work', 409);
  if (body.decision === 'accept') {
    insist(request.status === 'received', 'Only a received document can be accepted', 409);
    const [check, release] = guard(db, "EXISTS(SELECT 1 FROM b_requests WHERE id=? AND status='received') AND EXISTS(SELECT 1 FROM b_jobs WHERE id=? AND status='open')", request.id, j.id);
    await atomic(db, actor, [check, stmt(db, "UPDATE b_requests SET status='accepted',note=?,updated_by=?,updated_at=? WHERE id=?", optional(body.note, 'Note', 500), actor.email, now(), request.id), release, audit(db, actor, 'request.accepted', request.id, request.label)]);
  } else {
    insist(body.decision === 'return', 'Choose accept or return');
    const note = text(body.note, 'What the client should send instead', 500);
    const [check, release] = openGuard(db, j.id);
    await atomic(db, actor, [check, stmt(db, "UPDATE b_requests SET status='requested',note=?,updated_by=?,updated_at=? WHERE id=?", note, actor.email, now(), request.id), release, audit(db, actor, 'request.returned', request.id, note)]);
  }
  return { ok: true };
}

export async function downloadFile(db: D1Database, actor: Actor, fileId: string) {
  const file = await stmt(db, 'SELECT * FROM b_files WHERE id=?', fileId).first<Data>();
  insist(file, 'File not found', 404);
  await job(db, actor, file.job_id);
  insist(file.content_base64, 'This file was erased', 404);
  return fileResponse(file);
}

/** Stored bytes as a download: never rendered inline, never cached. */
export function fileResponse(file: Data) {
  const bytes = Uint8Array.from(atob(file.content_base64), c => c.charCodeAt(0));
  return new Response(bytes, { headers: {
    'content-type': SAFE_TYPES.includes(file.mime) ? file.mime : 'application/octet-stream',
    'content-disposition': `attachment; filename="${file.name.replace(/[^A-Za-z0-9._ -]/g, '_')}"`,
    'cache-control': 'no-store', 'x-content-type-options': 'nosniff',
  } });
}

/** A fresh client link for a job. Earlier links stop working; only the secret's digest is stored. */
export async function issueLink(db: D1Database, actor: Actor, jobId: string, origin: string) {
  const token = secret('up_'), at = now();
  const expiresAt = new Date(Date.now() + LINK_DAYS * 86_400_000).toISOString();
  return { url: `${origin}/portal/${token}`, expiresAt, statements: [
    stmt(db, 'UPDATE b_portal_links SET revoked_at=? WHERE job_id=? AND revoked_at IS NULL', at, jobId),
    stmt(db, 'INSERT INTO b_portal_links(id,job_id,digest,created_by,created_at,expires_at) VALUES(?,?,?,?,?,?)', id(), jobId, await digest(token), actor.email, at, expiresAt),
  ] };
}

/** Mails the client contact through the operator's provider and says what happened. */
export async function mailClient(bindings: ReturnType<typeof runtimeBindings>, deliveryId: string, to: string, subject: string, message: string) {
  const sender = operatorMail(bindings);
  if (!sender) return 'not sent: no mail provider is configured';
  insist(bindings.MAIL_FROM, 'Set MAIL_FROM to send client mail', 500);
  try {
    const html = message.split('\n').map(line => `<p>${line.replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`)}</p>`).join('');
    // A demo copy reports the provider's acceptance without sending anything.
    const result = await demoEffect(() => sender.send({ deliveryId, from: bindings.MAIL_FROM!, to: [to], subject, text: message, html, headers: {} }), { status: 'accepted', provider: 'demo mail', providerMessageId: null });
    return result.status === 'development' ? 'suppressed in development (no email sent)' : result.status === 'accepted' ? `accepted by ${result.provider}` : `${result.status} by ${result.provider}`;
  } catch (error) { return `failed: ${error instanceof Error ? error.message : 'mail error'}`; }
}

/**
 * A reminder issues a fresh client upload link (older links stop working) and
 * mails it to the client contact. The link is also returned once, so staff can
 * pass it on themselves; only its digest is stored.
 */
export async function sendReminder(env: Bindings, actor: Actor, jobId: string, body: Data) {
  human(actor);
  const bindings = runtimeBindings(env), db = bindings.DB;
  const j = await job(db, actor, jobId);
  insist(j.status === 'open', 'Reminders are only for open jobs', 409);
  const client = await stmt(db, 'SELECT * FROM b_clients WHERE id=?', j.client_id).first<Data>();
  insist(client?.contact_email, 'Add a contact email for this client first', 409);
  const outstanding = (await rows(db, "SELECT label FROM b_requests WHERE job_id=? AND status='requested' ORDER BY ordinal", j.id)).map(r => r.label as string);
  insist(outstanding.length > 0, 'No documents are outstanding', 409);
  const reminderId = actor.approval?.resultId ?? id(), at = now();
  const { url, expiresAt: expires, statements } = await issueLink(db, actor, j.id, bindings.AUTH_ORIGIN);
  const note = optional(body.message, 'Message', 1000);
  const message = [
    `Hello ${client.contact_name || client.name},`, '',
    `We need the following documents for ${j.title} (${j.period_label}):`, ...outstanding.map(label => `- ${label}`), '',
    ...(note ? [note, ''] : []),
    `Upload them securely here: ${url}`, `This link expires on ${expires.slice(0, 10)}.`,
  ].join('\n');
  const [check, release] = openGuard(db, j.id);
  await atomic(db, actor, [check, ...statements,
    stmt(db, 'INSERT INTO b_reminders(id,job_id,to_email,outstanding,message,delivery,sent_by,proposal_id,sent_at) VALUES(?,?,?,?,?,?,?,?,?)',
      reminderId, j.id, client.contact_email, JSON.stringify(outstanding), message.replace(url, `${bindings.AUTH_ORIGIN}/portal/…`), 'pending', actor.email, actor.approval?.id ?? null, at),
    release, audit(db, actor, 'reminder.sent', j.id, client.contact_email)]);
  const delivery = await mailClient(bindings, reminderId, client.contact_email, `Documents needed: ${j.title} ${j.period_label}`, message);
  await stmt(db, 'UPDATE b_reminders SET delivery=? WHERE id=?', delivery, reminderId).run();
  return { id: reminderId, delivery, portalUrl: url, expiresAt: expires };
}

// ---- Public client portal, authorised only by the link's secret ----

/** The link's job while it is open or in review; uploads additionally need an open job. */
export async function portalJob(db: D1Database, token: string) {
  insist(/^up_[0-9a-f]{64}$/.test(token), 'This upload link is not valid', 404);
  const link = await stmt(db, 'SELECT * FROM b_portal_links WHERE digest=?', await digest(token)).first<Data>();
  insist(link && !link.revoked_at && link.expires_at > now(), 'This upload link has expired or been replaced. Ask your accountant for a new one.', 404);
  const j = await stmt(db, 'SELECT b_jobs.*,c.name client_name,c.contact_email FROM b_jobs JOIN b_clients c ON c.id=b_jobs.client_id WHERE b_jobs.id=?', link.job_id).first<Data>();
  insist(j && j.status !== 'signed_off', 'This job is no longer collecting documents', 410);
  return { link, job: j };
}

export async function portalView(db: D1Database, token: string, practice: string) {
  const { link, job: j } = await portalJob(db, token);
  const requests = await rows(db, 'SELECT id,label,status,note FROM b_requests WHERE job_id=? ORDER BY ordinal', j.id);
  const files = await rows(db, 'SELECT request_id,name,uploaded_at FROM b_files WHERE job_id=? AND channel=? ORDER BY uploaded_at', j.id, 'portal');
  return {
    practice, client: j.client_name, job: j.title, period: j.period_label, dueDate: j.due_date, expiresAt: link.expires_at, collecting: j.status === 'open',
    requests: requests.map(r => ({ ...r, files: files.filter(f => f.request_id === r.id).map(f => ({ name: f.name, uploadedAt: f.uploaded_at })) })),
  };
}

export async function portalUpload(db: D1Database, token: string, requestId: string, body: Data) {
  const { link, job: j } = await portalJob(db, token);
  insist(j.status === 'open', 'This job is no longer collecting documents', 410);
  const request = await stmt(db, 'SELECT * FROM b_requests WHERE id=? AND job_id=?', requestId, j.id).first<Data>();
  insist(request, 'Request not found', 404);
  insist(request.status !== 'accepted', 'Your accountant has already accepted this document', 409);
  const { fileId, statements } = await fileStatements(db, request, decodeFile(body), 'client', 'portal');
  const [check, release] = guard(db, "EXISTS(SELECT 1 FROM b_portal_links l JOIN b_jobs j ON j.id=l.job_id WHERE l.id=? AND l.revoked_at IS NULL AND l.expires_at>? AND j.status='open')", link.id, now());
  try {
    await db.batch([check, ...statements, release, stmt(db, 'INSERT INTO b_audit(id,actor,action,object_id,detail,at) VALUES(?,?,?,?,?,?)', id(), 'client upload link', 'file.uploaded', fileId, request.label, now())]);
  } catch (error) {
    if (/b_guard|constraint/i.test(String(error))) insist(false, 'This upload link is no longer accepting files. Ask your accountant for a new one.', 409);
    throw error;
  }
  return { id: fileId, status: 'received' };
}
