import { runtimeBindings, type Bindings } from '../auth.server';
import { recipientFor, contactGuard } from './client-recipients';
import { issueLink, sendMail } from './documents';
import { tr, verbatim, type Language } from '../i18n/catalog';
import { LINK_PREVIEW, engagementOnly, localize, render, templateFiles, translationWarning, usable, valuesFor } from './messages';
import { organizerAnswers, organizerStaffGuard, storedOrganizer } from './organizers-store';
import { organizerProjection, submittedAnswers } from './organizers-client';
import { advance } from './flow';
import { atomic, audit, guard, human, id, insist, job, now, rows, stmt, text, type Actor, type Data } from './model';

async function prepared(db: D1Database, actor: Actor, jobId: string, body: Data) {
  human(actor);
  const j = await job(db, actor, jobId);
  insist(j.status === 'open', 'This organizer is closed', 409);
  const row = await stmt(db, 'SELECT id FROM b_job_organizers WHERE job_id=? AND erased_at IS NULL', jobId).first<Data>();
  insist(row, 'This job has no organizer snapshot', 404);
  const organizer = await storedOrganizer(db, row.id), answers = await organizerAnswers(db, row.id);
  insist(body.revision === organizer.revision, 'Organizer changed; refresh before sending', 409);
  const assignments = body.assignments ?? Object.fromEntries(Object.entries(answers).map(([key, a]) => [key, a.contactId]));
  insist(assignments && typeof assignments === 'object' && !Array.isArray(assignments), 'Assign the questions to contacts');
  insist(Object.keys(assignments).length === organizer.definition.questions.length && Object.keys(assignments).every(key => Object.hasOwn(answers, key)), 'Assign every organizer question exactly once');
  const contacts: Data[] = [];
  for (const q of organizer.definition.questions) {
    const contactId = text(assignments[q.key], `Responsible contact for ${q.label}`);
    if (!contacts.some(c => c.id === contactId)) contacts.push(await recipientFor(db, j.client_id, 'request', contactId));
  }
  const client = await stmt(db, 'SELECT * FROM b_clients WHERE id=?', j.client_id).first<Data>();
  const outstanding = (await rows(db, "SELECT r.label,m.key FROM b_requests r LEFT JOIN b_organizer_requests m ON m.request_id=r.id WHERE r.job_id=? AND r.status='requested' AND r.organizer_active=1 ORDER BY r.ordinal", j.id));
  const template = body.templateId ? await usable(db, actor, text(body.templateId, 'Message template')) : null;
  engagementOnly(template);
  const files = template ? await templateFiles(db, template.id, template.version, true) : [];
  // Each contact reads the invitation in their own language: the template's Spanish version, or the built-in Spanish text.
  const wording = async (contact: Data) => {
    const language: Language = contact.language ?? 'en', localized = template ? await localize(db, template, language) : null, edited = body.subject !== undefined || body.body !== undefined;
    return { language, warnings: template && localized?.missing && !edited ? [translationWarning(template, language)] : [],
      subject: body.subject !== undefined ? text(body.subject, 'Subject', 200) : localized?.subject ?? tr(language, 'mail.organizer.subject', { work: `${j.title} ${j.period_label}` }),
      message: body.body !== undefined ? text(body.body, 'Message', 10_000) : localized?.body ?? verbatim(language, 'mail.organizer.body') };
  };
  const rendering = async (contact: Data, link: string) => { const w = await wording(contact); return { ...render(w.subject, w.message, await valuesFor(db, actor, j, { ...client, contact_email: contact.email, contact_name: contact.name }, outstanding.filter(r=>!r.key||assignments[r.key]===contact.id).map(r=>r.label), link), body.values), language: w.language, warnings: w.warnings }; };
  return { j, organizer, answers, assignments, contacts, template, files, rendering };
}

export async function previewOrganizerSend(db: D1Database, actor: Actor, jobId: string, body: Data) {
  const p = await prepared(db, actor, jobId, body);
  return { organizerId: p.organizer.id, revision: p.organizer.revision, recipients: await Promise.all(p.contacts.map(async c => ({ contactId: c.id, to: c.email, ...await p.rendering(c, LINK_PREVIEW) }))) };
}

export async function sendOrganizer(env: Bindings, actor: Actor, jobId: string, body: Data) {
  const bindings = runtimeBindings(env), db = bindings.DB;
  if (body.preview === true) return previewOrganizerSend(db, actor, jobId, body);
  const p = await prepared(db, actor, jobId, body), at = now(), statements: D1PreparedStatement[] = [], sends: Data[] = [];
  for (const contact of p.contacts) {
    const link = await issueLink(db, actor, jobId, bindings.AUTH_ORIGIN, contact.id), rendered = await p.rendering(contact, link.url);
    insist(!rendered.missing.length, `Fill in or remove before sending to ${contact.name}: ${rendered.missing.map(m => m.label).join(', ')}`, 409);
    const deliveryId = id(), [authorized, authorizedDone] = contactGuard(db, p.j.client_id, contact.id, 'request', contact.revision);
    statements.push(authorized, authorizedDone, ...link.statements,
      stmt(db, 'INSERT INTO b_organizer_deliveries(id,organizer_id,contact_id,to_email,subject,message,template_id,template_version,attachments,delivery,sent_by,sent_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',
        deliveryId, p.organizer.id, contact.id, contact.email, rendered.subject, rendered.body.replaceAll(link.url, `${bindings.AUTH_ORIGIN}/portal/…`), p.template?.id ?? null, p.template?.version ?? null,
        JSON.stringify(p.files.map(f => ({ name: f.name, mime: f.mime, size: f.size, sha256: f.sha256 }))), 'pending', actor.email, at));
    sends.push({ id: deliveryId, contactId: contact.id, to: contact.email, portalUrl: link.url, expiresAt: link.expiresAt, subject: rendered.subject, message: rendered.body });
  }
  for (const [key, contactId] of Object.entries(p.assignments)) {
    // Responsibility is not a grant to another contact's answers. A prior-
    // period carry is shown only to the contact who supplied its original.
    const old = p.answers[key], source = old.carriedFrom ? await stmt(db, 'SELECT contact_id FROM b_organizer_submissions WHERE id=?', old.carriedFrom).first<Data>() : null;
    const retain = old.contactId === contactId || (!old.contactId && (!old.carriedFrom || source?.contact_id === contactId));
    statements.push(stmt(db, 'UPDATE b_organizer_answers SET value=?,confirmed=?,carried_from=?,contact_id=? WHERE organizer_id=? AND key=?', retain ? old.value || null : null, old.contactId === contactId && old.confirmed ? 1 : 0, retain ? old.carriedFrom : null, contactId, p.organizer.id, key));
    p.answers[key] = { ...old, value: retain ? old.value : '', confirmed: old.contactId === contactId && old.confirmed, carriedFrom: retain ? old.carriedFrom : null, contactId };
  }
  statements.push(...await organizerProjection(db, p.organizer, await submittedAnswers(db, p.organizer.id, p.answers), actor.email));
  const revision = id(), [open, openDone] = organizerStaffGuard(db, actor, p.j.id);
  const [fresh, freshDone] = guard(db, 'EXISTS(SELECT 1 FROM b_job_organizers WHERE id=? AND revision=? AND erased_at IS NULL)', p.organizer.id, p.organizer.revision);
  await atomic(db, actor, [open, fresh, ...statements,
    stmt(db, 'UPDATE b_job_organizers SET sent_at=?,revision=? WHERE id=?', at, revision, p.organizer.id), freshDone, openDone,
    audit(db, actor, 'organizer.invitation_issued', p.j.id, `${p.organizer.id}; links issued for responsible contacts ${p.contacts.map(c => c.id).join(', ')}; mail outcomes recorded separately`)]);
  await advance(env, [p.j.id], actor.email);
  for (const send of sends) {
    send.delivery = await sendMail(bindings, send.id, send.to, send.subject, send.message, p.files);
    await stmt(db, 'UPDATE b_organizer_deliveries SET delivery=? WHERE id=?', send.delivery, send.id).run();
    delete send.message;
  }
  return { id: p.organizer.id, revision, recipients: sends };
}
