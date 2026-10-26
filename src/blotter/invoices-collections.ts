// BILL-004 collections on native invoices: the firm's overdue reminder schedule, per-client
// overrides, dispute and payment-plan holds, bulk resend and monthly client statements.
// Reminders are automatic outbound mail, so they run only under a recorded consent of the
// principal or a financial-authority holder, rechecked on every run (conservative default
// pending ct, as BILL-002's automatic issue and send). Quick collect needs PAY-001.
import { runtimeBindings, type Bindings } from '../auth.server';
import { sendMail } from './documents';
import { firmSettings, localClock } from './firm';
import { firmDayEnd } from './firm-day';
import { engagementOnly, localize, render, translationWarning, usable } from './messages';
import { atomic, audit, canReadBilling, date, digest, id, insist, integer, now, optional, rows, stmt, text, type Actor, type Data } from './model';
import { AGING_BUCKETS, agingBucket } from './invoice-aging';
import { invoiceNumber } from './invoices-pdf';
import { invoiceDetail } from './invoices';
import { previewInvoiceDelivery, sendInvoice } from './invoices-delivery';
import { billed, invoiceBalanceSql, invoiceHuman, liveBillingActor } from './invoices-sources';
import { canAccessClient } from './permissions';

const usd = (cents: number) => `USD ${(cents / 100).toFixed(2)}`;
const balanceSql = invoiceBalanceSql('i');
const addDays = (day: string, days: number) => new Date(Date.parse(day + 'T00:00:00Z') + days * 86_400_000).toISOString().slice(0, 10);
/** Schedule steps are whole days relative to the due date: negative before it, zero on it. */
function steps(value: unknown) {
  insist(Array.isArray(value) && value.length > 0 && value.length <= 10, 'Choose 1 to 10 reminder steps, in days from the due date');
  const list = [...new Set(value.map(v => integer(v, 'Reminder step in days from the due date', -60, 365)))].sort((a, b) => a - b);
  return list;
}
const firmToday = async (db: D1Database, at = new Date()) => localClock(await firmSettings(db), at).localDate;

export async function reminderState(db: D1Database, actor: Actor) {
  insist(canReadBilling(actor), 'Your role cannot perform this action', 403);
  const policy = await stmt(db, 'SELECT * FROM b_invoice_reminder_policy WHERE id=1').first<Data>();
  const clients = await rows(db, 'SELECT r.* FROM b_invoice_reminder_clients r JOIN b_clients c ON c.id=r.client_id WHERE c.erased_at IS NULL ORDER BY r.set_at');
  const mine: Data[] = [];
  for (const c of clients) if (await canAccessClient(db, actor.email, c.client_id)) mine.push({ ...c, offsets: c.offsets ? JSON.parse(c.offsets) : null });
  // Restrict both warnings and their aggregate count to billing contacts on open invoices the reader may access.
  const spanish: Data[] = [];
  for (const contact of await rows(db, `SELECT DISTINCT c.id,c.client_id,c.name,c.email FROM b_invoices i JOIN b_client_contacts c ON c.id=json_extract(i.snapshot,'$.recipient.id') AND c.client_id=i.client_id
    JOIN b_clients e ON e.id=c.client_id WHERE i.status='issued' AND i.erased_at IS NULL AND ${balanceSql}>0 AND c.active=1 AND c.language='es' AND e.lifecycle='active' AND e.erased_at IS NULL AND e.merged_into IS NULL`)) {
    if (await canAccessClient(db, actor.email, contact.client_id)) spanish.push(contact);
  }
  const warnings: Data[] = [];
  if (policy?.status === 'active' && spanish.length) {
    const template = await stmt(db, 'SELECT t.id,t.name,? version FROM b_msg_templates t WHERE t.id=?', policy.template_version, policy.template_id).first<Data>();
    if (template && (await localize(db, template, 'es')).missing) for (const contact of spanish) warnings.push({ ...translationWarning(template, 'es'), contactId: contact.id, contactName: contact.name, address: contact.email });
  }
  return { policy: policy ? { ...policy, offsets: JSON.parse(policy.offsets) } : null, clients: mine, spanishRecipients: spanish.length, warnings };
}

/** Enabling the schedule is the consent: who, which template version, which steps and why, audited and step-up confirmed. */
export async function setReminderPolicy(db: D1Database, actor: Actor, body: Data) {
  invoiceHuman(actor);
  insist(actor.role === 'owner' || !actor.accessScoped, 'A firm-wide reminder schedule needs the principal or a financial-authority holder without client scopes', 403);
  const current = await stmt(db, 'SELECT * FROM b_invoice_reminder_policy WHERE id=1').first<Data>();
  if (body.status === 'paused') {
    insist(current?.status === 'active', 'Reminders are not running', 409);
    const reason = text(body.reason, 'Reason to pause reminders', 1000);
    await atomic(db, actor, billed(db, actor, [stmt(db, "UPDATE b_invoice_reminder_policy SET status='paused',revision=? WHERE id=1", id()), audit(db, actor, 'invoice.reminders_paused', 'invoice-reminders', reason)]));
    return reminderState(db, actor);
  }
  const offsets = steps(body.offsets), template = await usable(db, actor, text(body.templateId, 'Reminder template', 100)), reason = text(body.reason, 'Consent and reason for automatic reminders', 1000);
  engagementOnly(template);
  insist(template.scope === 'firm', 'Choose a firm template for firm-wide reminders', 409);
  await atomic(db, actor, billed(db, actor, [stmt(db, `INSERT INTO b_invoice_reminder_policy(id,offsets,template_id,template_version,status,revision,consenter_id,consented_by,reason,consented_at) VALUES(1,?,?,?,'active',?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET offsets=excluded.offsets,template_id=excluded.template_id,template_version=excluded.template_version,status='active',revision=excluded.revision,consenter_id=excluded.consenter_id,consented_by=excluded.consented_by,reason=excluded.reason,consented_at=excluded.consented_at`,
    JSON.stringify(offsets), template.id, template.version, id(), actor.id, actor.email, reason, now()),
    audit(db, actor, 'invoice.reminders_enabled', 'invoice-reminders', `steps ${offsets.join(', ')} days from due; template ${template.name} v${template.version}; ${reason}`)]));
  return reminderState(db, actor);
}

/** A client follows the firm schedule, opts out, or uses its own steps; recorded in the client's history. */
export async function setClientReminders(db: D1Database, actor: Actor, clientId: string, body: Data) {
  invoiceHuman(actor);
  insist(await stmt(db, 'SELECT 1 FROM b_clients WHERE id=? AND erased_at IS NULL AND merged_into IS NULL', clientId).first(), 'Client not found', 404);
  insist(['firm', 'off', 'custom'].includes(body.mode), 'Choose the firm schedule, no reminders, or custom steps');
  const reason = text(body.reason, 'Reason for this client', 1000), offsets = body.mode === 'custom' ? steps(body.offsets) : null;
  await atomic(db, actor, billed(db, actor, [body.mode === 'firm' ? stmt(db, 'DELETE FROM b_invoice_reminder_clients WHERE client_id=?', clientId)
    : stmt(db, `INSERT INTO b_invoice_reminder_clients(client_id,mode,offsets,reason,set_by,set_at) VALUES(?,?,?,?,?,?) ON CONFLICT(client_id) DO UPDATE SET mode=excluded.mode,offsets=excluded.offsets,reason=excluded.reason,set_by=excluded.set_by,set_at=excluded.set_at`,
      clientId, body.mode, offsets ? JSON.stringify(offsets) : null, reason, actor.email, now()),
    audit(db, actor, 'invoice.reminders_client', clientId, `${body.mode === 'custom' ? `custom steps ${offsets!.join(', ')}` : body.mode}; ${reason}`)]));
  return { clientId, mode: body.mode, offsets };
}

/** A dispute or payment plan stops reminders for one invoice until a billing person resumes them. */
export async function setCollectionHold(db: D1Database, actor: Actor, invoiceId: string, body: Data) {
  invoiceHuman(actor);
  const invoice = await stmt(db, "SELECT id,status,collection_hold FROM b_invoices WHERE id=? AND status='issued' AND erased_at IS NULL", invoiceId).first<Data>();
  insist(invoice, 'Issued invoice not found', 404);
  insist(body.hold === null || body.hold === 'disputed' || body.hold === 'payment_plan', 'Choose disputed, payment plan, or resume');
  const note = body.hold ? text(body.note, 'Dispute or payment-plan note', 1000) : optional(body.note, 'Note', 1000);
  await atomic(db, actor, billed(db, actor, [stmt(db, "UPDATE b_invoices SET collection_hold=?,collection_note=? WHERE id=? AND status='issued'", body.hold, note || null, invoiceId),
    audit(db, actor, body.hold ? 'invoice.collection_hold' : 'invoice.collection_resumed', invoiceId, `${body.hold ?? 'reminders resumed'}${note ? `; ${note}` : ''}`)]));
  return { id: invoiceId, hold: body.hold };
}

/** Quick collect charges only a saved method authorized under PAY-001; none can exist until PAY-001 ships, so it refuses honestly. */
export async function quickCollect(db: D1Database, actor: Actor, invoiceId: string) {
  invoiceHuman(actor);
  insist(await stmt(db, "SELECT 1 FROM b_invoices WHERE id=? AND status='issued' AND erased_at IS NULL", invoiceId).first(), 'Issued invoice not found', 404);
  insist(false, 'Quick collect needs a saved payment method authorized under PAY-001. No payment processor or authorization exists here, so nothing was charged.', 409);
}

/** One reviewed preview for several invoices; the send repeats the same recipients, documents and reason. */
export async function previewResend(db: D1Database, actor: Actor, body: Data) {
  invoiceHuman(actor);
  insist(Array.isArray(body.invoiceIds) && body.invoiceIds.length > 0 && body.invoiceIds.length <= 50 && new Set(body.invoiceIds).size === body.invoiceIds.length, 'Choose 1 to 50 distinct invoices');
  const reason = text(body.reason, 'Reason to resend', 1000), items: Data[] = [];
  for (const invoiceId of body.invoiceIds as string[]) {
    const invoice = await invoiceDetail(db, actor, text(invoiceId, 'Invoice', 100));
    insist(invoice.status === 'issued' && !invoice.erased_at && await canAccessClient(db, actor.email, invoice.client_id), 'Choose issued invoices for clients you hold', 409);
    const last = invoice.deliveries.at(-1);
    items.push(await previewInvoiceDelivery(db, actor, invoice.id, { contactId: invoice.snapshot.recipient.id, previousDeliveryId: last?.id, resendReason: reason }));
  }
  return { reason, items, previewHash: await digest(JSON.stringify(items.map(i => i.previewHash))) };
}
export async function bulkResend(env: Bindings, actor: Actor, body: Data) {
  const db = runtimeBindings(env).DB, preview = await previewResend(db, actor, body);
  insist(body.previewHash === preview.previewHash, 'The resend preview changed. Review the current recipients and documents.', 409);
  const results: Data[] = [];
  for (const item of preview.items) results.push(await sendInvoice(env, actor, item.invoiceId, { contactId: item.recipient.id, previousDeliveryId: item.previousDeliveryId ?? undefined, resendReason: preview.reason, previewHash: item.previewHash }));
  return { results };
}

/** A client statement as of a date: open issued invoices with aging, recorded credits, and no provider payments until PAY-001. */
export async function clientStatement(db: D1Database, actor: Actor, clientId: string, query: Data) {
  insist(canReadBilling(actor) && actor.channel === 'person', 'Your role cannot perform this action', 403);
  const client = await stmt(db, 'SELECT id,name FROM b_clients WHERE id=? AND erased_at IS NULL', clientId).first<Data>();
  insist(client, 'Client not found', 404);
  const firm = await firmSettings(db);
  const asOf = query.asOf ? date(query.asOf, 'Statement date') : localClock(firm, new Date()).localDate;
  const end = firmDayEnd(asOf, firm.timeZone);
  const issued = await rows(db, `SELECT i.id,i.number,i.title,i.issue_date,i.due_date,i.total_cents,i.subtotal_cents+i.tax_cents gross_cents,i.collection_hold,
    COALESCE((SELECT sum(u.amount_cents) FROM b_invoice_credit_uses u JOIN b_invoice_credits c ON c.id=u.credit_id WHERE u.invoice_id=i.id AND c.recorded_at<=?),0) applied_cents,
    COALESCE((SELECT sum(w.amount_cents) FROM b_invoice_writeoffs w WHERE w.invoice_id=i.id AND w.approved_at<=?),0) written_off_cents
    FROM b_invoices i WHERE i.client_id=? AND i.status='issued' AND i.erased_at IS NULL AND i.issue_date<=? ORDER BY i.due_date,i.number`, end, end, clientId, asOf);
  const bucket = (due: string) => agingBucket(asOf, due);
  const invoices = issued.map(i => ({ id: i.id, number: invoiceNumber(i.number), title: i.title, issueDate: i.issue_date, dueDate: i.due_date, totalCents: i.total_cents, creditsCents: i.applied_cents, writtenOffCents: i.written_off_cents,
    balanceCents: i.gross_cents - i.applied_cents - i.written_off_cents, aging: bucket(i.due_date), hold: i.collection_hold })).filter(i => i.balanceCents > 0);
  const credits = (await rows(db, `SELECT c.id,c.kind,c.reference,c.amount_cents,c.recorded_at,COALESCE((SELECT sum(u.amount_cents) FROM b_invoice_credit_uses u JOIN b_invoices i ON i.id=u.invoice_id WHERE u.credit_id=c.id AND i.status='issued'),0) applied_cents
    FROM b_invoice_credits c WHERE c.client_id=? AND c.recorded_at<=? ORDER BY c.recorded_at,c.id`, clientId, end)).map(c => ({ id: c.id, kind: c.kind, reference: c.reference, recordedAt: c.recorded_at, amountCents: c.amount_cents, appliedCents: c.applied_cents, availableCents: c.amount_cents - c.applied_cents }));
  const openCents = invoices.reduce((n, i) => n + i.balanceCents, 0), availableCents = credits.reduce((n, c) => n + c.availableCents, 0);
  const aging = AGING_BUCKETS.map(b => ({ bucket: b, cents: invoices.filter(i => i.aging === b).reduce((n, i) => n + i.balanceCents, 0) }));
  return { client, asOf, currency: 'USD', invoices, credits, payments: [], paymentsNote: 'No provider payments: PAY-001 is not active here. Deposits and credits the practice recorded are listed as credits.',
    totals: { openCents, availableCreditCents: availableCents, netCents: openCents - availableCents }, aging };
}
export async function clientStatementCsv(db: D1Database, actor: Actor, clientId: string, query: Data) {
  const s = await clientStatement(db, actor, clientId, query), cell = (v: unknown) => `"${String(v ?? '').replaceAll('"', '""')}"`;
  const lines = [['Line', 'Reference', 'Title', 'Issue date', 'Due date', 'Aging', 'USD amount', 'USD credits', 'USD written off', 'USD balance'].map(cell).join(','),
    ...s.invoices.map(i => ['Invoice', i.number, i.title, i.issueDate, i.dueDate, i.aging, (i.totalCents / 100).toFixed(2), (i.creditsCents / 100).toFixed(2), (i.writtenOffCents / 100).toFixed(2), (i.balanceCents / 100).toFixed(2)].map(cell).join(',')),
    ...s.credits.filter(c => c.availableCents > 0).map(c => [c.kind === 'deposit' ? 'Unapplied deposit' : 'Unapplied credit', c.reference, '', c.recordedAt.slice(0, 10), '', '', (c.amountCents / 100).toFixed(2), (c.appliedCents / 100).toFixed(2), '', (-c.availableCents / 100).toFixed(2)].map(cell).join(',')),
    ['Total', '', `${s.client.name} statement as of ${s.asOf}`, '', '', '', '', '', '', (s.totals.netCents / 100).toFixed(2)].map(cell).join(',')];
  await atomic(db, actor, [audit(db, actor, 'invoice.statement_downloaded', clientId, `as of ${s.asOf}; open ${usd(s.totals.openCents)}`)]);
  return new Response(lines.join('\r\n') + '\r\n', { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="statement-${s.asOf}.csv"`, 'cache-control': 'no-store' } });
}

/** The hourly run: the latest passed step per open invoice sends once; earlier passed steps are recorded as skipped. */
export async function runInvoiceReminders(env: Bindings, at = new Date()) {
  const bindings = runtimeBindings(env), db = bindings.DB, policy = await stmt(db, "SELECT * FROM b_invoice_reminder_policy WHERE id=1 AND status='active'").first<Data>();
  if (!policy) return [];
  const pause = async (reason: string) => {
    await db.batch([stmt(db, "UPDATE b_invoice_reminder_policy SET status='paused',revision=? WHERE id=1 AND revision=?", id(), policy.revision),
      stmt(db, 'INSERT INTO b_audit(id,actor,action,object_id,detail,at) VALUES(?,?,?,?,?,?)', id(), 'invoice reminder scheduler', 'invoice.reminders_held', 'invoice-reminders', reason, now())]);
    return [{ paused: reason }];
  };
  const consenter = await liveBillingActor(db, policy.consenter_id);
  if (!consenter || (consenter.role !== 'owner' && consenter.accessScoped)) return pause(`${policy.consented_by} no longer holds firm-wide financial authority`);
  const template = await stmt(db, `SELECT v.subject,v.body,v.message_class FROM b_msg_templates t JOIN b_msg_template_versions v ON v.template_id=t.id AND v.version=?
    WHERE t.id=? AND t.deleted_at IS NULL AND t.scope='firm'`, policy.template_version, policy.template_id).first<Data>();
  if (!template || template.message_class !== 'engagement') return pause('The consented reminder template version is no longer an available engagement template');
  const today = await firmToday(db, at), firm = await firmSettings(db), results: Data[] = [];
  for (const i of await rows(db, `SELECT i.*,${balanceSql} balance_cents,o.mode override_mode,o.offsets override_offsets FROM b_invoices i JOIN b_clients c ON c.id=i.client_id
    LEFT JOIN b_invoice_reminder_clients o ON o.client_id=i.client_id WHERE i.status='issued' AND i.erased_at IS NULL AND i.collection_hold IS NULL
    AND c.lifecycle='active' AND c.erased_at IS NULL AND c.merged_into IS NULL AND ${balanceSql}>0 ORDER BY i.due_date,i.id`)) {
    if (i.override_mode === 'off') continue;
    const due = (JSON.parse(i.override_offsets ?? policy.offsets) as number[]).filter(o => addDays(i.due_date, o) <= today);
    if (!due.length) continue;
    const latest = due.at(-1)!, recorded = new Set((await rows(db, 'SELECT step FROM b_invoice_reminders WHERE invoice_id=?', i.id)).map(r => Number(r.step)));
    if (recorded.has(latest)) continue;
    const reminderId = id(), snapshot = JSON.parse(i.snapshot), at0 = now();
    // Claim the step once; a concurrent run loses on the unique (invoice, step) key.
    try {
      await db.batch([...due.filter(o => o !== latest && !recorded.has(o)).map(o => stmt(db, "INSERT OR IGNORE INTO b_invoice_reminders(id,invoice_id,step,scheduled_on,status,delivery,policy_revision,created_at) VALUES(?,?,?,?,'skipped','not sent: a later step was already due',?,?)", id(), i.id, o, addDays(i.due_date, o), policy.revision, at0)),
        stmt(db, "INSERT INTO b_invoice_reminders(id,invoice_id,step,scheduled_on,status,delivery,policy_revision,created_at) VALUES(?,?,?,?,'dispatching','Provider outcome not yet recorded',?,?)", reminderId, i.id, latest, addDays(i.due_date, latest), policy.revision, at0)]);
    } catch { continue; }
    const hold = async (reason: string) => {
      await db.batch([stmt(db, "UPDATE b_invoice_reminders SET status='held',delivery=? WHERE id=?", `held: not sent (${reason})`, reminderId),
        stmt(db, 'INSERT INTO b_audit(id,actor,action,object_id,detail,at) VALUES(?,?,?,?,?,?)', id(), policy.consented_by, 'invoice.reminder_held', i.id, `${latest} days from due: not sent (${reason})`, now())]);
      results.push({ invoiceId: i.id, step: latest, held: reason });
    };
    // MSG-002 engagement send-time recheck: the invoice's billing contact must still be active, authorized, consenting and deliverable.
    const contact = await stmt(db, `SELECT c.*,EXISTS(SELECT 1 FROM b_mail_suppressions s WHERE s.address=c.email) invalid,EXISTS(SELECT 1 FROM json_each(c.roles) WHERE value='billing') billing
      FROM b_client_contacts c WHERE c.id=? AND c.client_id=?`, snapshot.recipient.id, i.client_id).first<Data>();
    if (!contact || !contact.active || !contact.authorized || !contact.billing) { await hold('contact no longer an authorized billing contact'); continue; }
    if (!contact.email_consent || !contact.email) { await hold('email consent withdrawn'); continue; }
    if (contact.invalid) { await hold('address invalid after a hard bounce'); continue; }
    if (!await canAccessClient(db, consenter.email, i.client_id)) { await hold(`${policy.consented_by} no longer holds this client`); continue; }
    const values: Record<string, string> = { firm_name: firm.name ?? '', sender_name: consenter.name || consenter.email, client_name: snapshot.client.name, contact_first_name: String(contact.first_name || contact.name || '').trim().split(/\s+/)[0] ?? '',
      invoice_amount: usd(i.balance_cents), invoice_due_date: i.due_date };
    const localized = await localize(db, { id: policy.template_id, version: policy.template_version, ...template }, contact.language ?? 'en'), message = render(localized.subject, localized.body, values, undefined);
    if (message.missing.length) { await hold(`unresolved placeholder: ${message.missing.map(m => m.label).join(', ')}`); continue; }
    const delivery = await sendMail(bindings, reminderId, contact.email, message.subject, message.body, i.pdf_base64 ? [{ name: `${invoiceNumber(i.number)}.pdf`, mime: 'application/pdf', content_base64: i.pdf_base64 }] : []);
    const status = delivery.startsWith('accepted by ') || delivery.startsWith('suppressed in development') ? 'accepted' : /^(not sent:|rejected )/.test(delivery) ? 'failed' : 'held';
    await db.batch([stmt(db, "UPDATE b_invoice_reminders SET status=?,recipient_email=?,subject=?,message=?,delivery=? WHERE id=? AND status='dispatching'", status, contact.email, message.subject, message.body, delivery, reminderId),
      stmt(db, 'INSERT INTO b_audit(id,actor,action,object_id,detail,at) VALUES(?,?,?,?,?,?)', id(), policy.consented_by, status === 'accepted' ? 'invoice.reminder_sent' : 'invoice.reminder_held', i.id, `${latest} days from due (${addDays(i.due_date, latest)}) to ${contact.email}: ${delivery}`, now())]);
    results.push({ invoiceId: i.id, step: latest, status });
  }
  return results;
}
