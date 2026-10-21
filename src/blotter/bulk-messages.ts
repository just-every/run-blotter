// Bulk client messages (MSG-002; ct 20 Oct 21:21Z). A batch has one class,
// engagement or marketing, fixed with its template version and recipients at
// preview. Engagement batches declare a reason and a per-recipient basis and go
// per client under the existing recipient rules; marketing batches need the
// principal's approval, the firm's postal address and each address's own
// opt-in, and go once per address. Dispatch claims each recipient, rechecks it
// immediately before sending and never retries a held, failed or uncertain one.
// An engagement template using {{portal_link}} attaches the request: each
// recipient gets its own secure upload link for its basis job, issued at send.
import { runtimeBindings, type Bindings } from '../auth.server';
import { deliverAlerts } from './notifications';
import { operatorMail } from '../mail.server.mjs';
import { demoEffect } from '../modules/demo/index.mjs';
import { firmSettings } from './firm';
import { issueLink } from './documents';
import { issueBulkOrganizer, organizerAttachment, recheckOrganizer } from './bulk-organizers';
import { LINK_PREVIEW, render, templateFiles, usable, valuesFor } from './messages';
import { marketingGrantSql, marketingHold, withdrawnSql } from './marketing-consent';
import { Fault, atomic, audit, digest, human, id, insist, integer, need, now, optional, rows, secret, stmt, text, type Actor, type Data } from './model';

/** Placeholders that tie a message to the recipient's current engagement (refusal g). */
export const ENGAGEMENT_OPENERS = ['work_type', 'work_item', 'period', 'due_date', 'outstanding_requests'];
const NOTICE_7216 = 'Section 7216 notice: marketing opt-in is not the written consent 26 CFR 301.7216-3 requires to use tax return information. An "other services" batch cannot filter on tax-derived criteria such as work types.';
const ROLES = ['primary', 'billing', 'tax', 'bookkeeping'];
const suppressed = `EXISTS(SELECT 1 FROM b_mail_suppressions s WHERE s.address=c.email)`;

export function postalAddress(firm: Data) {
  return firm.address && firm.city && firm.state && firm.zip ? `${firm.name || 'The practice'}, ${firm.address}, ${firm.city}, ${firm.state} ${firm.zip}` : '';
}
const opener = (s: string) => ENGAGEMENT_OPENERS.some(k => new RegExp(`\\{\\{\\s*${k}\\s*\\}\\}`).test(s));
/** An engagement template that attaches each recipient's document request through its own upload link. */
const attachesRequest = (t: Data) => /\{\{\s*portal_link\s*\}\}/.test(`${t.subject}\n${t.body}`);

type Candidate = { client: Data; contact: Data; basis: string; jobId: string | null; job: Data | null };

/** Clients in the segment, newest rules first: work type (a job or recurring rule of it), tag and entity type. */
async function segment(db: D1Database, filter: Data) {
  return rows(db, `SELECT c.* FROM b_clients c WHERE c.merged_into IS NULL
    AND (?1='' OR EXISTS(SELECT 1 FROM b_jobs j WHERE j.client_id=c.id AND j.work_type_id=?1) OR EXISTS(SELECT 1 FROM b_recurrence_rules r WHERE r.client_id=c.id AND 'wt-'||r.template_id=?1))
    AND (?2='' OR EXISTS(SELECT 1 FROM json_each(c.tags) WHERE value=?2)) AND (?3='' OR c.entity_type=?3) ORDER BY c.name,c.id`, filter.workTypeId, filter.tag, filter.entityType);
}

/** The client's current engagement basis (refusal a): an open job, else an active recurring rule, of the filtered work type. */
async function basisFor(db: D1Database, clientId: string, workTypeId: string) {
  const job = await stmt(db, `SELECT j.*,w.name work_type_name FROM b_jobs j LEFT JOIN b_work_types w ON w.id=j.work_type_id WHERE j.client_id=? AND j.status<>'signed_off' AND (?='' OR j.work_type_id=?) ORDER BY j.due_date,j.id LIMIT 1`, clientId, workTypeId, workTypeId).first<Data>();
  if (job) return { basis: `open job: ${job.title} ${job.period_label}`, job };
  const rule = await stmt(db, `SELECT r.id,t.name FROM b_recurrence_rules r JOIN b_templates t ON t.id=r.template_id WHERE r.client_id=? AND r.status='active' AND (?='' OR 'wt-'||r.template_id=?) ORDER BY t.name,r.id LIMIT 1`, clientId, workTypeId, workTypeId).first<Data>();
  return rule ? { basis: `active recurring rule: ${rule.name}`, job: { title: rule.name, period_label: '', due_date: '', work_type_name: rule.name } as Data, ruleOnly: true } : null;
}

/** Placeholder values for one recipient: only firm, sender, first name and client name for marketing. */
async function values(db: D1Database, sender: Actor, batchClass: string, c: Candidate, link = '', organizerId: string | null = null) {
  const contact = { ...c.client, contact_name: c.contact.first_name || c.contact.name };
  if (batchClass === 'marketing') {
    const v = await valuesFor(db, sender, { title: '', period_label: '', due_date: '' }, contact, [], '');
    return { firm_name: v.firm_name, sender_name: v.sender_name, client_name: v.client_name, contact_first_name: v.contact_first_name } as Record<string, string>;
  }
  const outstanding = c.jobId ? (await rows(db, `SELECT r.label FROM b_requests r LEFT JOIN b_organizer_requests m ON m.request_id=r.id
    WHERE r.job_id=? AND r.status='requested' AND r.organizer_active=1
    AND (? IS NULL OR m.key IS NULL OR EXISTS(SELECT 1 FROM b_organizer_answers a WHERE a.organizer_id=? AND a.key=m.key AND a.contact_id=?)) ORDER BY r.ordinal`, c.jobId, organizerId, organizerId, c.contact.id)).map(r => r.label as string) : [];
  const v = await valuesFor(db, sender, c.job ?? {}, contact, outstanding, link);
  // A rule without a job yet names its work type only; work item, period and due date stay unresolved.
  return { ...v, work_type: c.job?.work_type_name || c.job?.title || '', work_item: c.jobId ? v.work_item : '', period: c.jobId ? v.period : '', due_date: c.jobId ? v.due_date : '' } as Record<string, string>;
}

async function candidates(db: D1Database, batchClass: string, filter: Data, role: string) {
  const included: Candidate[] = [], excluded: Data[] = [], addresses = new Set<string>();
  for (const client of await segment(db, filter)) {
    if (client.lifecycle !== 'active') { excluded.push({ client_id: client.id, client: client.name, reason: batchClass === 'engagement' ? 'archived client: never receives engagement class' : 'archived client' }); continue; }
    if (batchClass === 'engagement') {
      const basis = await basisFor(db, client.id, filter.workTypeId);
      if (!basis) { excluded.push({ client_id: client.id, client: client.name, reason: 'no current engagement basis (open job or active recurring rule)' }); continue; }
      const contacts = await rows(db, `SELECT c.*,${suppressed} invalid FROM b_client_contacts c WHERE c.client_id=? AND c.active=1 AND c.authorized=1 AND EXISTS(SELECT 1 FROM json_each(c.roles) WHERE value=?) ORDER BY c.name,c.id`, client.id, role);
      const reason = !contacts.length ? `no authorized ${role} contact` : contacts.length > 1 ? `more than one ${role} contact; send to this client individually` : !contacts[0].email ? 'no email address' : !contacts[0].email_consent ? 'email consent withdrawn' : contacts[0].invalid ? 'address invalid after a hard bounce' : '';
      if (reason) { excluded.push({ client_id: client.id, client: client.name, contact_id: contacts[0]?.id ?? null, address: contacts[0]?.email ?? '', reason }); continue; }
      included.push({ client, contact: contacts[0], basis: basis.basis, jobId: basis.ruleOnly ? null : basis.job.id, job: basis.job });
    } else {
      const contacts = await rows(db, `SELECT c.*,${suppressed} invalid,${marketingGrantSql} granted,${withdrawnSql} withdrawn FROM b_client_contacts c WHERE c.client_id=? AND c.active=1 ORDER BY c.name,c.id`, client.id);
      if (!contacts.length) excluded.push({ client_id: client.id, client: client.name, reason: 'no contact' });
      for (const contact of contacts) {
        const reason = !contact.email ? 'no email address' : !contact.email_consent ? 'email consent withdrawn' : contact.invalid ? 'address invalid after a hard bounce'
          : contact.granted ? (addresses.has(contact.email) ? 'address already included once in this batch' : '') : contact.withdrawn ? 'marketing withdrawn for this address' : 'no marketing opt-in';
        if (reason) { excluded.push({ client_id: client.id, client: client.name, contact_id: contact.id, address: contact.email, reason }); continue; }
        addresses.add(contact.email);
        included.push({ client, contact, basis: 'marketing opt-in', jobId: null, job: null });
      }
    }
  }
  return { included, excluded };
}

async function batchRow(db: D1Database, batchId: string) {
  const b = await stmt(db, 'SELECT * FROM b_bulk_batches WHERE id=?', batchId).first<Data>();
  insist(b, 'Batch not found', 404);
  return b;
}
const senderFor = async (db: D1Database, email: string): Promise<Actor> => ({ id: '', email, name: String((await stmt(db, 'SELECT name FROM b_members WHERE email=?', email).first<Data>())?.name ?? email), role: 'owner', channel: 'person' });

/**
 * Preview a batch: class, template version, segment, recipients with their
 * basis, every exclusion with its reason and three sample renderings. A
 * repeated idempotency key returns the batch it already made.
 */
export async function previewBatch(db: D1Database, actor: Actor, body: Data) {
  human(actor); need(actor, 'owner', 'reviewer');
  const key = text(body.idempotencyKey, 'Idempotency key', 100);
  const existing = await stmt(db, 'SELECT id FROM b_bulk_batches WHERE idempotency_key=?', key).first<Data>();
  if (existing) return { ...await batchDetail(db, actor, existing.id), resubmitted: true };
  insist(body.class === 'engagement' || body.class === 'marketing', 'Choose the class: engagement or marketing');
  insist(body.channel === undefined || body.channel === 'email', body.class === 'marketing' ? 'Portal marketing waits for portal accounts (PORTAL-002); marketing by text message is refused' : 'Bulk engagement messages are sent by email', 409);
  const t = await usable(db, actor, text(body.templateId, 'Template'));
  insist(t.message_class === body.class, body.class === 'engagement' ? 'An engagement batch cannot use a marketing template' : 'A marketing batch needs a marketing template', 409);
  const filter = { workTypeId: optional(body.workTypeId, 'Work type', 100), tag: optional(body.tag, 'Tag', 60), entityType: optional(body.entityType, 'Entity type', 20) };
  insist(filter.workTypeId || filter.tag || filter.entityType, 'Filter the segment by work type, tag or entity type');
  insist(!filter.entityType || ['individual', 'business', 'trust'].includes(filter.entityType), 'Entity type is individual, business or trust');
  const firm = await firmSettings(db);
  let reason = '', topic: string | null = null, role = 'primary';
  if (body.class === 'engagement') {
    reason = text(body.reason, 'Engagement reason', 300);
    role = optional(body.role, 'Contact role', 20) || 'primary';
    insist(ROLES.includes(role), `Contact role is one of ${ROLES.join(', ')}`);
    insist(opener(t.subject) && opener(String(t.body).split('\n').find(line => line.trim()) ?? ''), 'An engagement notice opens with its engagement: use a work type, work item, period, due date or outstanding-requests placeholder in the subject and first line', 409);
  } else {
    insist(body.topic === 'tax' || body.topic === 'other', 'Declare the topic: tax (tax preparation services and tax education) or other services');
    topic = body.topic;
    insist(topic === 'tax' || !filter.workTypeId, 'An "other services" marketing batch cannot filter on tax-derived criteria such as a work type (section 7216)', 409);
    insist(postalAddress(firm), "Record the firm's US postal address before marketing", 409);
    const hold = await marketingHold(db); insist(!hold, hold, 409);
  }
  const sender = await senderFor(db, actor.email);
  const { included, excluded } = await candidates(db, body.class, filter, role);
  insist(body.attachOrganizer === undefined || typeof body.attachOrganizer === 'boolean', 'Attach organizer must be true or false');
  const attachOrganizer = body.attachOrganizer === true;
  insist(!attachOrganizer || (body.class === 'engagement' && attachesRequest(t)), 'An organizer attachment needs an engagement template with {{portal_link}}', 409);
  const recipients = [], linked = body.class === 'engagement' && attachesRequest(t);
  for (const c of included) {
    // A request link needs an open basis job and a contact authorized for requests (portal and request consent).
    const unlinked = !linked ? '' : !c.jobId ? 'no open job to attach the request to' : !c.contact.request_consent || !c.contact.portal ? 'contact not authorized for requests' : '';
    if (unlinked) { excluded.push({ client_id: c.client.id, client: c.client.name, contact_id: c.contact.id, address: c.contact.email, reason: unlinked }); continue; }
    let organizer: Awaited<ReturnType<typeof organizerAttachment>> | null = null;
    if (attachOrganizer) {
      try { organizer = await organizerAttachment(db, c.jobId, c.contact.id); }
      catch (error) {
        if (!(error instanceof Fault)) throw error;
        excluded.push({ client_id: c.client.id, client: c.client.name, contact_id: c.contact.id, address: c.contact.email, reason: error.message });
        continue;
      }
    }
    const r = render(t.subject, t.body, await values(db, sender, body.class, c, linked ? LINK_PREVIEW : '', organizer?.id), undefined);
    if (r.missing.length) excluded.push({ client_id: c.client.id, client: c.client.name, contact_id: c.contact.id, address: c.contact.email, reason: `unresolved placeholder: ${r.missing.map(m => m.label).join(', ')}` });
    else recipients.push({ c, r, organizer });
  }
  if (!recipients.length) throw new Fault('No recipient in this segment can receive this message', 409, { exclusions: excluded.map(e => ({ client: e.client, address: e.address ?? '', reason: e.reason })) });
  const batchId = id(), at = now(), chunk = body.chunkSize === undefined ? 50 : integer(body.chunkSize, 'Chunk size', 1, 500);
  const fingerprint = await digest(JSON.stringify([body.class, t.id, t.version, filter, role, reason, topic, attachOrganizer, recipients.map(({ c, organizer }) => [c.client.id, c.contact.id, c.contact.email, c.basis, organizer]), excluded.map(e => [e.client_id, e.contact_id ?? '', e.reason])]));
  await atomic(db, actor, [
    stmt(db, 'INSERT INTO b_bulk_batches(id,idempotency_key,class,template_id,template_version,reason,topic,role,filter,fingerprint,status,chunk_size,owner_email,created_by,created_at,attach_organizer) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      batchId, key, body.class, t.id, t.version, reason, topic, role, JSON.stringify(filter), fingerprint, 'previewed', chunk, actor.email, actor.email, at, attachOrganizer ? 1 : 0),
    ...recipients.map(({ c, organizer }, n) => stmt(db, "INSERT INTO b_bulk_recipients(id,batch_id,ordinal,client_id,contact_id,address,dedupe_key,basis,job_id,status,organizer_id,organizer_revision) VALUES(?,?,?,?,?,?,?,?,?,'pending',?,?)",
      id(), batchId, n + 1, c.client.id, c.contact.id, c.contact.email, body.class === 'marketing' ? c.contact.email : c.client.id, c.basis, c.jobId, organizer?.id ?? null, organizer?.revision ?? null)),
    ...excluded.map(e => stmt(db, 'INSERT INTO b_bulk_exclusions(id,batch_id,client_id,contact_id,address,reason) VALUES(?,?,?,?,?,?)', id(), batchId, e.client_id, e.contact_id ?? null, e.address ?? '', e.reason)),
    audit(db, actor, 'bulk.previewed', batchId, `${body.class}: ${recipients.length} recipients, ${excluded.length} excluded`)]);
  return { ...await batchDetail(db, actor, batchId), samples: recipients.slice(0, 3).map(({ c, r }) => ({ client: c.client.name, to: c.contact.email, subject: r.subject, body: r.body })), notice: topic === 'other' ? NOTICE_7216 : null };
}

export async function batchDetail(db: D1Database, actor: Actor, batchId: string) {
  need(actor, 'owner', 'reviewer');
  const batch = await batchRow(db, batchId);
  const recipients = await rows(db, `SELECT r.id,r.client_id,c.name client,r.contact_id,r.address,r.basis,r.job_id,r.organizer_id,r.organizer_revision,r.status,r.held_reason,r.subject,r.body,r.attachments,r.delivery,r.provider_message_id,r.attempted_at,r.misclassified_by,r.misclassified_reason
    FROM b_bulk_recipients r JOIN b_clients c ON c.id=r.client_id WHERE r.batch_id=? ORDER BY r.ordinal`, batchId);
  const exclusions = await rows(db, 'SELECT x.client_id,c.name client,x.contact_id,x.address,x.reason FROM b_bulk_exclusions x JOIN b_clients c ON c.id=x.client_id WHERE x.batch_id=? ORDER BY c.name,x.address', batchId);
  const counts: Record<string, number> = {}; for (const r of recipients) counts[r.status] = (counts[r.status] ?? 0) + 1;
  return { batch: { ...batch, filter: JSON.parse(batch.filter) }, attachments: await templateFiles(db, batch.template_id, batch.template_version), recipients, exclusions, counts };
}

export async function batches(db: D1Database, actor: Actor) {
  need(actor, 'owner', 'reviewer');
  return { batches: await rows(db, `SELECT b.id,b.class,b.status,b.reason,b.topic,b.owner_email,b.created_at,b.send_at,b.approved_by,(SELECT count(*) FROM b_bulk_recipients r WHERE r.batch_id=b.id) recipients,
    (SELECT count(*) FROM b_bulk_exclusions x WHERE x.batch_id=b.id) excluded FROM b_bulk_batches b ORDER BY b.created_at DESC LIMIT 200`) };
}

/** The principal approves a marketing batch exactly as previewed. */
export async function approveBatch(db: D1Database, actor: Actor, batchId: string, body: Data) {
  human(actor); need(actor, 'owner');
  const b = await batchRow(db, batchId);
  insist(b.class === 'marketing', 'Engagement batches need no approval; the principal and reviewers schedule them', 409);
  insist(b.status === 'previewed' && !b.restore_review, 'Preview a fresh batch; this one can no longer be approved', 409);
  insist(text(body.fingerprint, 'Preview fingerprint', 64) === b.fingerprint, 'The preview changed; preview again', 409);
  insist(postalAddress(await firmSettings(db)), "Record the firm's US postal address before marketing", 409);
  const hold = await marketingHold(db); insist(!hold, hold, 409);
  await atomic(db, actor, [stmt(db, "UPDATE b_bulk_batches SET approved_by=?,approved_at=? WHERE id=? AND status='previewed' AND approved_by IS NULL", actor.email, now(), b.id), audit(db, actor, 'bulk.approved', b.id, 'marketing batch approved by the principal')]);
  return batchDetail(db, actor, b.id);
}

/** Schedule a previewed batch; resubmitting a scheduled or sent batch changes nothing and sends no duplicate. */
export async function scheduleBatch(db: D1Database, actor: Actor, batchId: string, body: Data) {
  human(actor); need(actor, 'owner', 'reviewer');
  const b = await batchRow(db, batchId);
  insist(text(body.fingerprint, 'Preview fingerprint', 64) === b.fingerprint, 'The preview changed; preview again', 409);
  if (['scheduled', 'sending', 'sent'].includes(b.status)) return { ...await batchDetail(db, actor, b.id), resubmitted: true };
  insist(b.status === 'previewed' && !b.restore_review, 'A restored or paused batch needs a fresh preview', 409);
  insist(b.class === 'engagement' || b.approved_by, 'The principal approves every marketing batch before it is scheduled', 409);
  const sendAt = body.sendAt === undefined ? now() : new Date(text(body.sendAt, 'Send at', 40)).toISOString();
  await atomic(db, actor, [stmt(db, "UPDATE b_bulk_batches SET status='scheduled',send_at=?,scheduled_by=?,scheduled_at=? WHERE id=? AND status='previewed'", sendAt, actor.email, now(), b.id),
    audit(db, actor, 'bulk.scheduled', b.id, `${b.class} batch to send from ${sendAt}`)]);
  return batchDetail(db, actor, b.id);
}

/** Why a claimed recipient may not be sent now (Q6/Q7), or '' when it may. */
async function recheck(db: D1Database, b: Data, r: Data, linked: boolean) {
  const c = await stmt(db, `SELECT c.*,e.lifecycle,e.merged_into,${suppressed} invalid,${marketingGrantSql} granted,EXISTS(SELECT 1 FROM json_each(c.roles) WHERE value=?) has_role
    FROM b_client_contacts c JOIN b_clients e ON e.id=c.client_id WHERE c.id=? AND c.client_id=?`, b.role, r.contact_id, r.client_id).first<Data>();
  if (!c || c.lifecycle !== 'active' || c.merged_into) return 'client archived or merged';
  if (!c.active || c.email !== r.address) return 'contact inactive or address changed';
  if (!c.email_consent) return 'email consent withdrawn';
  if (c.invalid) return 'address invalid after a hard bounce';
  if (b.class === 'engagement') {
    if (!c.authorized || !c.has_role) return 'contact no longer authorized for this role';
    if (!await basisFor(db, r.client_id, JSON.parse(b.filter).workTypeId)) return 'engagement basis ended';
    if (linked && (!c.request_consent || !c.portal)) return 'contact no longer authorized for requests';
    if (linked && !await stmt(db, "SELECT 1 FROM b_jobs WHERE id=? AND status<>'signed_off'", r.job_id).first()) return 'the job holding the attached request closed';
    return b.attach_organizer ? recheckOrganizer(db, r) : '';
  }
  if (!c.granted) return 'marketing opt-in withdrawn or voided';
  const principal = await stmt(db, "SELECT 1 FROM oa_operators WHERE email=? AND role='owner' AND status='active'", b.approved_by).first();
  if (!principal) return 'principal approval no longer current';
  if (!postalAddress(await firmSettings(db))) return 'firm postal address missing';
  return await marketingHold(db);
}

/** Mail one bulk message; the provider's message id is kept for its delivery events. */
async function deliver(env: Bindings, deliveryId: string, to: string, subject: string, message: string, files: Data[], unsubscribe?: string) {
  const bindings = runtimeBindings(env), sender = operatorMail(bindings);
  if (!sender) return { status: 'failed', delivery: 'not sent: no mail provider is configured', providerMessageId: null };
  try {
    const html = message.split('\n').map(line => `<p>${line.replace(/[&<>"']/g, ch => `&#${ch.charCodeAt(0)};`)}</p>`).join('');
    const result = await demoEffect(() => sender.send({ deliveryId, from: bindings.MAIL_FROM!, to: [to], subject, text: message, html, headers: {}, ...(unsubscribe ? { unsubscribe: { url: unsubscribe, oneClick: true } } : {}),
      ...(files.length ? { attachments: files.map(f => ({ filename: f.name, contentType: f.mime, content: Uint8Array.from(atob(f.content_base64), c => c.charCodeAt(0)) })) } : {}) }),
      { status: 'accepted', provider: 'demo mail', providerMessageId: null });
    if (result.status === 'development') return { status: 'accepted', delivery: 'suppressed in development (no email sent)', providerMessageId: null };
    return { status: result.status === 'accepted' ? 'accepted' : result.status === 'uncertain' ? 'uncertain' : 'failed', delivery: `${result.status} by ${result.provider}`, providerMessageId: result.providerMessageId ?? null };
  } catch (error) { return { status: 'uncertain', delivery: `held: provider outcome uncertain (${error instanceof Error ? error.message : 'mail error'}); reconcile, never resend`, providerMessageId: null }; }
}

const historyObject = (r: Data) => r.job_id ?? r.client_id;

/** One throttled chunk per due batch: claim, recheck, send; held, failed and uncertain recipients are never retried. */
export async function runBulk(env: Bindings, at = new Date(), onlyBatch?: string) {
  const db = runtimeBindings(env).DB, origin = runtimeBindings(env).AUTH_ORIGIN;
  const due = await rows(db, "SELECT * FROM b_bulk_batches WHERE status IN ('scheduled','sending') AND send_at<=? AND (?='' OR id=?) ORDER BY send_at,id", at.toISOString(), onlyBatch ?? '', onlyBatch ?? '');
  const results = [];
  for (const b of due) {
    await stmt(db, "UPDATE b_bulk_batches SET status='sending' WHERE id=? AND status='scheduled'", b.id).run();
    const template = await stmt(db, 'SELECT subject,body FROM b_msg_template_versions WHERE template_id=? AND version=?', b.template_id, b.template_version).first<Data>();
    const sender = await senderFor(db, b.owner_email), firm = await firmSettings(db), linked = b.class === 'engagement' && attachesRequest(template!);
    // Every message goes with this template version's files, which never change; each recipient records them.
    const files = await templateFiles(db, b.template_id, b.template_version, true), recorded = JSON.stringify(files.map(f => ({ name: f.name, mime: f.mime, size: f.size, sha256: f.sha256 })));
    let sent = 0, held = 0;
    for (const r of await rows(db, "SELECT * FROM b_bulk_recipients WHERE batch_id=? AND status='pending' ORDER BY ordinal LIMIT ?", b.id, b.chunk_size)) {
      const attemptId = id();
      const claimed = await stmt(db, "UPDATE b_bulk_recipients SET status='claimed',attempt_id=?,attempted_at=? WHERE id=? AND status='pending'", attemptId, now(), r.id).run();
      if (!claimed.meta.changes) continue;
      const reason = await recheck(db, b, r, linked);
      if (reason) {
        held++;
        await db.batch([stmt(db, "UPDATE b_bulk_recipients SET status='held',held_reason=? WHERE id=? AND attempt_id=?", `held: not sent (${reason})`, r.id, attemptId),
          stmt(db, 'INSERT INTO b_audit(id,actor,action,object_id,detail,at) VALUES(?,?,?,?,?,?)', id(), b.owner_email, 'bulk.held', historyObject(r), `${b.class}: held, not sent to ${r.address} (${reason})`, now())]);
        continue;
      }
      const client = await stmt(db, 'SELECT * FROM b_clients WHERE id=?', r.client_id).first<Data>();
      const contact = await stmt(db, 'SELECT * FROM b_client_contacts WHERE id=?', r.contact_id).first<Data>();
      const job = r.job_id ? await stmt(db, 'SELECT j.*,w.name work_type_name FROM b_jobs j LEFT JOIN b_work_types w ON w.id=j.work_type_id WHERE j.id=?', r.job_id).first<Data>() : (await basisFor(db, r.client_id, JSON.parse(b.filter).workTypeId))?.job ?? null;
      // The recipient's own upload link replaces any earlier link it held for this job; only the sent mail carries the secret.
      let link: Awaited<ReturnType<typeof issueLink>> | null = null;
      if (linked) {
        try { link = await issueLink(db, sender, r.job_id, origin, r.contact_id); }
        catch (error) {
          if (!(error instanceof Fault)) throw error;
          held++;
          await stmt(db, "UPDATE b_bulk_recipients SET status='held',held_reason=? WHERE id=? AND attempt_id=?", `held: not sent (${error.message})`, r.id, attemptId).run();
          continue;
        }
      }
      const rendered = render(template!.subject, template!.body, await values(db, sender, b.class, { client: client!, contact: contact!, basis: r.basis, jobId: r.job_id, job }, link?.url ?? '', r.organizer_id), undefined);
      if (rendered.missing.length) {
        held++;
        await stmt(db, "UPDATE b_bulk_recipients SET status='held',held_reason=? WHERE id=? AND attempt_id=?", `held: not sent (unresolved placeholder: ${rendered.missing.map(m => m.label).join(', ')})`, r.id, attemptId).run();
        continue;
      }
      const storedSubject = link ? rendered.subject.replaceAll(link.url, `${origin}/portal/…`) : rendered.subject;
      let message = rendered.body, unsubscribe: string | undefined, stored = link ? rendered.body.replaceAll(link.url, `${origin}/portal/…`) : rendered.body;
      if (link) {
        try {
          if (r.organizer_id) await issueBulkOrganizer(db, sender, b, { ...r, attempt_id: attemptId }, link.statements, storedSubject, stored, recorded);
          else await db.batch(link.statements);
        } catch (error) {
          if (!(error instanceof Fault)) throw error;
          held++;
          await db.batch([stmt(db, "UPDATE b_bulk_recipients SET status='held',held_reason=? WHERE id=? AND attempt_id=?", `held: not sent (${error.message})`, r.id, attemptId),
            audit(db, sender, 'bulk.held', historyObject(r), `engagement: held, not sent to ${r.address} (${error.message})`)]);
          continue;
        }
      }
      if (b.class === 'marketing') {
        const token = secret('us_');
        const link = unsubscribe = `${origin}/unsubscribe?t=${token}`;
        await stmt(db, 'INSERT INTO b_unsubscribe_tokens(digest,recipient_id,address,created_at) VALUES(?,?,?,?)', await digest(token), r.id, r.address, now()).run();
        const footer = ['', '--', `You receive marketing email from ${firm.name || 'this practice'} because you opted in. Unsubscribe: ${link}`, postalAddress(firm)].join('\n');
        message += '\n' + footer; stored += '\n' + footer.replace(link, `${origin}/unsubscribe?t=…`);
      }
      const outcome = await deliver(env, r.id, r.address, rendered.subject, message, files, unsubscribe);
      if (r.organizer_id) await stmt(db, 'UPDATE b_organizer_deliveries SET delivery=? WHERE id=?', outcome.delivery, 'bulk:' + r.id).run();
      sent++;
      await db.batch([stmt(db, "UPDATE b_bulk_recipients SET status=?,subject=?,body=?,attachments=?,delivery=?,provider_message_id=? WHERE id=? AND attempt_id=? AND status='claimed'", outcome.status, storedSubject, stored, recorded, outcome.delivery, outcome.providerMessageId, r.id, attemptId),
        stmt(db, 'INSERT INTO b_audit(id,actor,action,object_id,detail,at) VALUES(?,?,?,?,?,?)', id(), b.owner_email, outcome.status === 'accepted' ? 'bulk.sent' : 'bulk.failed', historyObject(r), `${b.class}: "${storedSubject}" to ${r.address}: ${outcome.delivery}`, now()),
        ...(outcome.status === 'failed' && !r.organizer_id ? [stmt(db, `INSERT OR IGNORE INTO b_notifications(id,to_email,kind,job_id,summary,delivery,created_at)
          SELECT ?,?,'delivery_failed',?,'Bulk message delivery failed','in-app only',?
          WHERE EXISTS(SELECT 1 FROM oa_operators WHERE email=? AND role='owner' AND status='active')
             OR EXISTS(SELECT 1 FROM b_members WHERE email=? AND active=1)`,
          'bulk-failed:' + r.id, b.owner_email, r.job_id, now(), b.owner_email, b.owner_email)] : [])]);
    }
    const left = await stmt(db, "SELECT count(*) n FROM b_bulk_recipients WHERE batch_id=? AND status IN ('pending','claimed')", b.id).first<Data>();
    if (!Number(left?.n)) await stmt(db, "UPDATE b_bulk_batches SET status='sent' WHERE id=? AND status='sending'", b.id).run();
    results.push({ id: b.id, sent, held, remaining: Number(left?.n ?? 0) });
  }
  await deliverAlerts(env, at);
  return { batches: results };
}

/** "Send next chunk now" for one due batch, by the principal or a reviewer. */
export async function runBatch(env: Bindings, actor: Actor, batchId: string) {
  human(actor); need(actor, 'owner', 'reviewer');
  const db = runtimeBindings(env).DB;
  await batchRow(db, batchId);
  await runBulk(env, new Date(), batchId);
  return batchDetail(db, actor, batchId);
}

/** Engagement notices sent to addresses without a current marketing opt-in, for the principal's review (refusal f). */
export async function reviewList(db: D1Database, actor: Actor) {
  need(actor, 'owner');
  return { notices: await rows(db, `SELECT r.id,r.batch_id,b.reason,r.client_id,e.name client,r.address,r.subject,r.attempted_at sent_at,r.status,r.misclassified_by,r.misclassified_at,r.misclassified_reason
    FROM b_bulk_recipients r JOIN b_bulk_batches b ON b.id=r.batch_id JOIN b_clients e ON e.id=r.client_id JOIN b_client_contacts c ON c.id=r.contact_id
    WHERE b.class='engagement' AND r.status IN ('accepted','delivered','bounced','complained') AND NOT ${marketingGrantSql} ORDER BY r.attempted_at DESC,r.id LIMIT 500`) };
}

export async function markMisclassified(db: D1Database, actor: Actor, recipientId: string, body: Data) {
  human(actor); need(actor, 'owner');
  const r = await stmt(db, "SELECT r.* FROM b_bulk_recipients r JOIN b_bulk_batches b ON b.id=r.batch_id WHERE r.id=? AND b.class='engagement' AND r.status IN ('accepted','delivered','bounced','complained')", recipientId).first<Data>();
  insist(r, 'Engagement notice not found', 404);
  insist(!r.misclassified_by, 'Already marked misclassified', 409);
  const reason = text(body.reason, 'Reason', 500);
  await atomic(db, actor, [stmt(db, 'UPDATE b_bulk_recipients SET misclassified_by=?,misclassified_at=?,misclassified_reason=? WHERE id=? AND misclassified_by IS NULL', actor.email, now(), reason, r.id),
    audit(db, actor, 'bulk.misclassified', historyObject(r), `engagement notice to ${r.address} marked misclassified: ${reason}`)]);
  return { id: r.id, misclassified: true };
}
