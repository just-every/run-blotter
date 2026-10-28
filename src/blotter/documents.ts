import { contactRequestSql } from './organizers-requests';
import { contactDocuments,staffDownload } from './document-shares';
// Client document requests: uploads (portal or staff), acceptance, download,
// reminders with a client upload link, and the public portal behind that link.
import { recipientFor, contactGuard } from './client-recipients';
import { operatorMail } from '../mail.server.mjs';
import { demoEffect } from '../modules/demo/index.mjs';
import { runtimeBindings, type Bindings } from '../auth.server';
import { advance } from './flow';
import { clientTasks } from './tasks';
import { portalItems } from './portal-items';
import { tr, type Key, type Language } from '../i18n/catalog';
import { LINK_PREVIEW, engagementOnly, localize, render, templateFiles, translationWarning, usable, valuesFor } from './messages';
import { atomic, audit, digest, guard, human, id, insist, job, now, optional, rows, secret, stmt, text, type Actor, type Data } from './model';

const MAX_BYTES = 1_048_576;
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

export async function decideRequest(env: Bindings, actor: Actor, requestId: string, body: Data) {
  human(actor);
  const db = runtimeBindings(env).DB;
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
  await advance(env, [j.id], actor.email);
  return { ok: true };
}

export const downloadFile = (db: D1Database, actor: Actor, fileId: string) => staffDownload(db,actor,fileId);

/** A fresh client link for a job. Earlier links for that contact stop working; only the secret's digest is stored. */
export async function issueLink(db: D1Database, actor: Actor, jobId: string, origin: string, contactId?: string) {
  const j = await stmt(db,'SELECT client_id FROM b_jobs WHERE id=?',jobId).first<Data>();
  insist(j, 'Job not found',404);
  const contact = await recipientFor(db,j.client_id,'request',contactId);
  const token = secret('up_'), at = now();
  const expiresAt = new Date(Date.now() + LINK_DAYS * 86_400_000).toISOString();
  return { url: `${origin}/portal/${token}`, expiresAt, statements: [
    stmt(db, 'UPDATE b_portal_links SET revoked_at=? WHERE job_id=? AND contact_id=? AND revoked_at IS NULL', at, jobId,contact.id),
    stmt(db, 'INSERT INTO b_portal_links(id,job_id,digest,created_by,created_at,expires_at,contact_id) VALUES(?,?,?,?,?,?,?)', id(), jobId, await digest(token), actor.email, at, expiresAt, contact.id),
  ] };
}

/** Mails one person through the operator's provider and says what happened. */
export async function sendMail(bindings: ReturnType<typeof runtimeBindings>, deliveryId: string, to: string, subject: string, message: string, files: Data[] = []) {
  const sender = operatorMail(bindings);
  if (!sender) return 'not sent: no mail provider is configured';
  insist(bindings.MAIL_FROM, 'Set MAIL_FROM to send client mail', 500);
  try {
    const html = message.split('\n').map(line => `<p>${line.replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`)}</p>`).join('');
    // A demo copy reports the provider's acceptance without sending anything.
    const result = await demoEffect(() => sender.send({ deliveryId, from: bindings.MAIL_FROM!, to: [to], subject, text: message, html, headers: {},
      ...(files.length ? { attachments: files.map(f => ({ filename: f.name, contentType: f.mime, content: Uint8Array.from(atob(f.content_base64), c => c.charCodeAt(0)) })) } : {}) }), { status: 'accepted', provider: 'demo mail', providerMessageId: null });
    return result.status === 'development' ? 'suppressed in development (no email sent)' : result.status === 'accepted' ? `accepted by ${result.provider}` : `${result.status} by ${result.provider}`;
  } catch (error) { return `failed: ${error instanceof Error ? error.message : 'mail error'}`; }
}

/**
 * A reminder issues a fresh client upload link (older links for that contact stop working) and
 * mails it to the client contact. The link is also returned once, so staff can
 * pass it on themselves; only its digest is stored.
 */
async function reminderContext(db: D1Database, actor: Actor, jobId: string, contactId?: string) {
  const j = await job(db, actor, jobId);
  insist(j.status === 'open', 'Reminders are only for open jobs', 409);
  const client = await stmt(db, 'SELECT * FROM b_clients WHERE id=?', j.client_id).first<Data>();
  const contact = await recipientFor(db,j.client_id,'request',contactId);
  client!.contact_email = contact.email; client!.contact_name = contact.name;
  const outstanding = (await rows(db, `SELECT r.label FROM b_requests r WHERE r.job_id=? AND r.status='requested' AND ${contactRequestSql()} ORDER BY r.ordinal`, j.id,contact.id)).map(r => r.label as string);
  insist(outstanding.length > 0, 'No documents are outstanding', 409);
  return { j, client: client!, contact, outstanding };
}

/** A message template (MSG-003) rendered for this job: the template's current version, or the sender's edited text. */
async function templated(db: D1Database, actor: Actor, ctx: Awaited<ReturnType<typeof reminderContext>>, body: Data, link: string) {
  const t = body.templateId ? await usable(db, actor, text(body.templateId, 'Template')) : null;
  engagementOnly(t);
  // The contact's language picks the template's Spanish version; a missing one warns staff before the send and the English text is used.
  const language: Language = ctx.contact.language ?? 'en', localized = t ? await localize(db, t, language) : null;
  const subject = body.subject !== undefined ? text(body.subject, 'Subject', 200) : localized?.subject, message = body.body !== undefined ? text(body.body, 'Message', 10_000) : localized?.body;
  insist(subject && message, 'Choose a template or write the subject and message');
  const rendered = render(subject, message, await valuesFor(db, actor, ctx.j, ctx.client, ctx.outstanding, link), body.values);
  // The template version's attachments go with the message, even when its text was edited.
  const edited = body.subject !== undefined || body.body !== undefined;
  return { ...rendered, templateId: t?.id ?? null, version: t?.version ?? null, attachments: t?.attachments ?? [], edited, language, translated: Boolean(localized?.translated) && !edited,
    warnings: t && localized?.missing && !edited ? [translationWarning(t, language)] : [] };
}

/** Render a reminder without sending it; the secure link is created only when sending. */
export async function previewReminder(db: D1Database, actor: Actor, jobId: string, body: Data) {
  const ctx = await reminderContext(db, actor, jobId, body.contactId);
  return { to: ctx.client.contact_email, ...await templated(db, actor, ctx, body, LINK_PREVIEW) };
}

export async function sendReminder(env: Bindings, actor: Actor, jobId: string, body: Data) {
  human(actor);
  const bindings = runtimeBindings(env), db = bindings.DB;
  const ctx = await reminderContext(db, actor, jobId, body.contactId), { j, client, outstanding } = ctx;
  const reminderId = actor.automation?.attemptId ?? actor.approval?.resultId ?? id(), at = now();
  const { url, expiresAt: expires, statements } = await issueLink(db, actor, j.id, bindings.AUTH_ORIGIN, ctx.contact.id);
  const language: Language = ctx.contact.language ?? 'en', T = (key: Key, vars: Record<string, string | number> = {}) => tr(language, key, vars);
  let subject = T('mail.request.subject', { work: `${j.title} ${j.period_label}` }), message: string, template: { id: string | null; version: number | null } = { id: null, version: null }, files: Data[] = [];
  if (body.templateId || body.subject !== undefined || body.body !== undefined) {
    const r = await templated(db, actor, ctx, body, url);
    insist(!r.missing.length, `Fill in or remove before sending: ${r.missing.map(m => m.label).join(', ')}`, 409);
    subject = r.subject; message = r.body; template = { id: r.templateId, version: r.edited ? null : r.version };
    if (r.templateId) files = await templateFiles(db, r.templateId, r.version, true);
  } else {
    const note = optional(body.message, 'Message', 1000);
    message = [
      T('mail.hello', { name: client.contact_name || client.name }), '',
      T('mail.request.intro', { work: `${j.title} (${j.period_label})` }), ...outstanding.map(label => `- ${label}`), '',
      ...(note ? [note, ''] : []),
      T('mail.request.upload', { url }), T('mail.expires', { date: expires.slice(0, 10) }),
    ].join('\n');
  }
  const [check, release] = openGuard(db, j.id);
  const [authorized, authorizedDone] = contactGuard(db,j.client_id,ctx.contact.id,'request',ctx.contact.revision);
  await atomic(db, actor, [check, authorized, authorizedDone, ...statements,
    stmt(db, 'INSERT INTO b_reminders(id,job_id,to_email,outstanding,message,delivery,sent_by,proposal_id,sent_at,subject,template_id,template_version,attachments,language) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      reminderId, j.id, client.contact_email, JSON.stringify(outstanding), message.replaceAll(url, `${bindings.AUTH_ORIGIN}/portal/…`), 'pending', actor.email, actor.approval?.id ?? null, at,
      subject, template.id, template.version, JSON.stringify(files.map(f => ({ name: f.name, mime: f.mime, size: f.size, sha256: f.sha256 }))), language),
    release, audit(db, actor, 'reminder.sent', j.id, client.contact_email)]);
  if (actor.automation) {
    insist(await stmt(db,"SELECT 1 FROM b_automation_rules r JOIN oa_operators o ON o.id=r.principal_id WHERE r.id=? AND r.status='active' AND r.used<=r.budget AND o.status='active' AND o.role='owner' AND EXISTS(SELECT 1 FROM b_client_contacts c WHERE c.id=? AND c.active=1 AND c.authorized=1 AND c.portal=1 AND c.request_consent=1 AND c.email_consent=1 AND c.revision=?)",actor.automation.ruleId,ctx.contact.id,ctx.contact.revision).first(),'Automation paused or authority revoked before dispatch',409);
  }
  const delivery = await sendMail(bindings, reminderId, client.contact_email, subject, message, files);
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
  const contact = link.contact_id ? await stmt(db,"SELECT * FROM b_client_contacts WHERE id=? AND client_id=? AND active=1 AND authorized=1 AND portal=1 AND request_consent=1",link.contact_id,j?.client_id).first<Data>() : null;
  const entity = j ? await stmt(db,"SELECT lifecycle FROM b_clients WHERE id=?",j.client_id).first<Data>() : null;
  insist(contact && entity?.lifecycle === 'active', 'This contact no longer has access to this entity',404);
  j!.contact_email = contact.email;
  insist(j && j.status !== 'signed_off', 'This job is no longer collecting documents', 410);
  return { link, job: j, contact };
}

export async function portalView(db: D1Database, token: string, practice: string) {
  const { link, job: j, contact } = await portalJob(db, token);
  const requests = await rows(db, `SELECT r.id,r.label,r.status,r.note FROM b_requests r WHERE r.job_id=? AND ${contactRequestSql()} ORDER BY r.ordinal`, j.id,contact.id);
  const files = await rows(db, 'SELECT request_id,name,uploaded_at FROM b_files WHERE job_id=? AND channel=? ORDER BY uploaded_at', j.id, 'portal');
  return {
    language: contact.language, practice, client: j.client_name, job: j.title, period: j.period_label, dueDate: j.due_date, expiresAt: link.expires_at, collecting: j.status === 'open',
    requests: requests.map(r => ({ ...r, files: files.filter(f => f.request_id === r.id).map(f => ({ name: f.name, uploadedAt: f.uploaded_at })) })),
    sharedFiles: await contactDocuments(db,j.id,contact.id), tasks: await clientTasks(db, j), ...await portalItems(db, j,contact.id,contact.language),
  };
}

export async function portalUpload(db: D1Database, token: string, requestId: string, body: Data) {
  const { link, job: j,contact } = await portalJob(db, token);
  insist(j.status === 'open', 'This job is no longer collecting documents', 410);
  const request = await stmt(db, `SELECT r.* FROM b_requests r WHERE r.id=? AND r.job_id=? AND ${contactRequestSql()}`, requestId, j.id,contact.id).first<Data>();
  insist(request, 'Request not found', 404);
  insist(request.status !== 'accepted', 'Your accountant has already accepted this document', 409);
  const { fileId, statements } = await fileStatements(db, request, decodeFile(body), 'client', 'portal');
  const [check, release] = guard(db, `EXISTS(SELECT 1 FROM b_portal_links l JOIN b_jobs j ON j.id=l.job_id WHERE l.id=? AND l.revoked_at IS NULL AND l.expires_at>? AND j.status='open') AND EXISTS(SELECT 1 FROM b_requests r WHERE r.id=? AND ${contactRequestSql()})`, link.id, now(),requestId,contact.id);
  try {
    const [authorized, authorizedDone] = contactGuard(db,j.client_id,link.contact_id);
    await db.batch([check, authorized, authorizedDone, ...statements, release, stmt(db, 'INSERT INTO b_audit(id,actor,action,object_id,detail,at) VALUES(?,?,?,?,?,?)', id(), 'client upload link', 'file.uploaded', fileId, request.label, now())]);
  } catch (error) {
    if (/b_guard|constraint/i.test(String(error))) insist(false, 'This upload link is no longer accepting files. Ask your accountant for a new one.', 409);
    throw error;
  }
  return { id: fileId, status: 'received' };
}
