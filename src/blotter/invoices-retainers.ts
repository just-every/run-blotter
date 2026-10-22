// Monthly rules generate drafts. A rule revision issues and sends by itself only
// within the recorded consent of a financial-authority holder (per-invoice USD cap,
// one recipient, a reason), rechecked on every run; otherwise the draft stays a
// draft with a named exception. Price changes never rewrite generated entitlements.
import { type Bindings } from '../auth.server';
import { firmSettings, localClock } from './firm';
import { atomic, audit, date, digest, guard, id, insist, integer, job, now, rows, stmt, text, type Actor, type Data } from './model';
import { buildInvoicePreview, invoiceDetail, invoiceDraftStatements, invoiceRecipientGuard, issueInvoice } from './invoices';
import { previewInvoiceDelivery, sendInvoice } from './invoices-delivery';
import { canAccessClient } from './permissions';
import { activeInvoiceClientSql, billed, invoiceAuthority, invoiceAuthorityGuard, invoiceHuman, liveBillingActor } from './invoices-sources';

function month(value: unknown, label = 'Month') {
  const v = text(value, label, 7); insist(/^\d{4}-\d{2}$/.test(v), `${label}: use YYYY-MM`); date(v + '-01', label); return v;
}
const afterDays = (day: string, days: number) => new Date(Date.parse(day + 'T00:00:00Z') + days * 86_400_000).toISOString().slice(0, 10);

export async function createInvoiceRetainer(db: D1Database, actor: Actor, body: Data) {
  invoiceHuman(actor);
  insist(body.currency === undefined || body.currency === 'USD', 'Native retainers must be authorized in USD');
  const authority = await invoiceAuthority(db), j = await job(db, actor, text(body.jobId, 'Work item', 100));
  insist(j.currency === 'USD', 'Monthly retainers require USD work', 409);
  const title = text(body.title, 'Retainer title', 200), retainerId = id(), at = now();
  const definition = { amountCents: integer(body.amountCents, 'Monthly USD cents', 1),
    billDay: integer(body.billDay, 'Monthly billing day', 1, 28), dueDays: integer(body.dueDays, 'Days after issue until due', 0, 90),
    contactId: text(body.contactId, 'Billing contact', 100), terms: text(body.terms, 'Payment terms', 2000),
    taxCents: integer(body.taxCents, 'Supplied monthly sales tax USD cents'), taxTreatment: text(body.taxTreatment, 'Authorized sales-tax treatment', 1000),
    taxAuthorization: text(body.taxAuthorization, 'Tax authorization and source', 2000), authorization: text(body.authorization, 'Recurring fee and calendar authority', 2000) };
  const startMonth = month(body.startMonth, 'First month');
  const [check, release] = guard(db, activeInvoiceClientSql, j.client_id), [authorized, done] = invoiceAuthorityGuard(db, authority.revision);
  const recipientSnapshot = { client: { id: j.client_id }, recipient: { id: definition.contactId, revision: (await stmt(db, 'SELECT revision FROM b_client_contacts WHERE id=?', definition.contactId).first<Data>())?.revision ?? '' } };
  await atomic(db, actor, billed(db, actor, [check, authorized, ...invoiceRecipientGuard(db, recipientSnapshot),
    stmt(db, `INSERT INTO b_invoice_retainers(id,client_id,job_id,title,start_month,definition,revision,status,principal_id,owner_email,created_by,created_at) VALUES(?,?,?,?,?,?,?,'active',?,?,?,?)`,
      retainerId, j.client_id, j.id, title, startMonth, JSON.stringify(definition), id(), actor.id, actor.email, actor.email, at),
    done, release, audit(db, actor, 'invoice.retainer_authorized', retainerId, `${title}; monthly ${definition.amountCents} USD cents; ${definition.authorization}`)]));
  return { id: retainerId, startMonth, status: 'active', definition };
}

async function retainerFor(db: D1Database, retainerId: string) {
  const r = await stmt(db, 'SELECT * FROM b_invoice_retainers WHERE id=?', retainerId).first<Data>();
  insist(r, 'Retainer not found', 404); return r;
}
export async function retainerDefinition(db: D1Database, r: Data, period: string) {
  const amendments = await rows(db, 'SELECT * FROM b_invoice_amendments WHERE retainer_id=? AND effective_month<=? ORDER BY effective_month DESC LIMIT 1', r.id, period);
  return amendments[0] ? JSON.parse(amendments[0].after_snapshot) : JSON.parse(r.definition);
}

/** A stable retainer/month entitlement survives process interruption and event replay. */
export async function generateRetainerInvoice(db: D1Database, actor: Actor, retainerId: string, body: Data): Promise<Data> {
  invoiceHuman(actor);
  const r = await retainerFor(db, retainerId), period = month(body.period, 'Billing month');
  const existing = await stmt(db, 'SELECT id FROM b_invoices WHERE retainer_id=? AND period=?', retainerId, period).first<Data>();
  if (existing) return { ...await invoiceDetail(db, actor, existing.id), replayed: true };
  insist(r.status === 'active' && period >= r.start_month && (!r.cancelled_from || period < r.cancelled_from), 'This retainer does not authorize this billing month', 409);
  const d = await retainerDefinition(db, r, period), sourceKey = `retainer:${r.id}:${period}`, authority = await invoiceAuthority(db);
  let e = await stmt(db, 'SELECT * FROM b_invoice_entitlements WHERE retainer_id=? AND period=?', r.id, period).first<Data>();
  if (!e) {
    const eid = id(), [check, release] = guard(db, "EXISTS(SELECT 1 FROM b_invoice_retainers WHERE id=? AND revision=? AND status='active' AND (cancelled_from IS NULL OR ?<cancelled_from)) AND " + activeInvoiceClientSql, r.id, r.revision, period, r.client_id);
    const [authorized, done] = invoiceAuthorityGuard(db, authority.revision);
    try {
      await atomic(db, actor, billed(db, actor, [check, authorized,
        stmt(db, `INSERT INTO b_invoice_entitlements(id,client_id,job_id,kind,reference,description,amount_cents,source_key,retainer_id,period,authorized_by,authorized_at,authorization)
          VALUES(?,?,?,'retainer',?,?,?,?,?,?,?,?,?)`, eid, r.client_id, r.job_id, sourceKey, `${r.title} - ${period}`, d.amountCents, sourceKey, r.id, period, actor.email, now(), d.authorization),
        done, release, audit(db, actor, 'invoice.retainer_entitled', eid, `${sourceKey}; ${d.amountCents} USD cents`)]));
    } catch (error) {
      // A concurrent delivery of the same event can only win this unique key once.
      if (!(await stmt(db, 'SELECT id FROM b_invoice_entitlements WHERE retainer_id=? AND period=?', r.id, period).first())) throw error;
    }
    e = await stmt(db, 'SELECT * FROM b_invoice_entitlements WHERE retainer_id=? AND period=?', r.id, period).first<Data>();
  }
  const allocated = await stmt(db, 'SELECT invoice_id FROM b_invoice_sources WHERE source_key=?', sourceKey).first<Data>();
  if (allocated) return { ...await invoiceDetail(db, actor, allocated.invoice_id), replayed: true };
  const issueDate = `${period}-${String(d.billDay).padStart(2, '0')}`;
  const preview = await buildInvoicePreview(db, actor, { ...d, jobId: r.job_id, sourceKeys: [e!.source_key], issueDate, dueDate: afterDays(issueDate, d.dueDays), title: `${r.title} - ${period}` });
  const invoiceId = id(), [check, release] = guard(db, "EXISTS(SELECT 1 FROM b_invoice_retainers WHERE id=? AND revision=? AND status='active' AND (cancelled_from IS NULL OR ?<cancelled_from))", r.id, r.revision, period);
  try {
    await atomic(db, actor, billed(db, actor, [check, ...invoiceDraftStatements(db, actor, invoiceId, preview, r.id, period), release]));
  } catch (error) {
    const raced = await stmt(db, 'SELECT id FROM b_invoices WHERE retainer_id=? AND period=?', r.id, period).first<Data>();
    if (!raced) throw error;
    return { ...await invoiceDetail(db, actor, raced.id), replayed: true };
  }
  return { ...await invoiceDetail(db, actor, invoiceId), replayed: false };
}

export async function previewRetainerAmendment(db: D1Database, actor: Actor, retainerId: string, body: Data) {
  invoiceHuman(actor);
  const r = await retainerFor(db, retainerId), effectiveMonth = month(body.effectiveMonth, 'Effective month');
  insist(r.status === 'active' || r.status === 'paused', 'This retainer was cancelled', 409);
  insist(effectiveMonth >= r.start_month, 'Amendment cannot precede the retainer');
  const generated = await rows(db, 'SELECT id,period FROM b_invoice_entitlements WHERE retainer_id=? AND period>=?', r.id, effectiveMonth);
  insist(generated.length === 0, 'Generated entitlements are immutable. Use a separately authorized credit or proration.', 409);
  insist(!await stmt(db, 'SELECT id FROM b_invoice_amendments WHERE retainer_id=? AND effective_month>=?', r.id, effectiveMonth).first(), 'Choose a month after the last recorded amendment', 409);
  insist(body.action === 'price' || body.action === 'cancel', 'Choose price amendment or cancellation');
  const before = await retainerDefinition(db, r, effectiveMonth), after = body.action === 'cancel' ? { ...before, cancelled: true } : {
    ...before, amountCents: integer(body.amountCents, 'New monthly USD cents', 1), taxCents: integer(body.taxCents, 'New supplied sales tax USD cents'),
    taxTreatment: text(body.taxTreatment, 'Amended tax treatment', 1000), taxAuthorization: text(body.taxAuthorization, 'Amended tax authority', 2000), authorization: text(body.authorization, 'Amended fee authority', 2000) };
  const preview = { retainerId: r.id, revision: r.revision, effectiveMonth, action: body.action, before, after, reason: text(body.reason, 'Amendment reason', 2000),
    retainedEntitlements: await rows(db, 'SELECT id,period,amount_cents,source_key FROM b_invoice_entitlements WHERE retainer_id=? ORDER BY period', r.id),
    proration: 'No proration is inferred. Record an explicit, sourced proration entitlement or credit.' };
  return { ...preview, previewHash: await digest(JSON.stringify(preview)) };
}
export async function amendInvoiceRetainer(db: D1Database, actor: Actor, retainerId: string, body: Data) {
  invoiceHuman(actor); const preview = await previewRetainerAmendment(db, actor, retainerId, body);
  insist(body.previewHash === preview.previewHash, 'The amendment changed. Preview it again.', 409);
  const amendmentId = id(), [check, release] = guard(db, `EXISTS(SELECT 1 FROM b_invoice_retainers WHERE id=? AND revision=?) AND NOT EXISTS(SELECT 1 FROM b_invoice_entitlements WHERE retainer_id=? AND period>=?)`, retainerId, preview.revision, retainerId, preview.effectiveMonth);
  await atomic(db, actor, billed(db, actor, [check,
    stmt(db, 'INSERT INTO b_invoice_amendments(id,retainer_id,effective_month,before_snapshot,after_snapshot,reason,authorized_by,authorized_at) VALUES(?,?,?,?,?,?,?,?)', amendmentId, retainerId, preview.effectiveMonth, JSON.stringify(preview.before), JSON.stringify(preview.after), preview.reason, actor.email, now()),
    // A new revision ends any automatic issue and send consent: it covered the revision the holder reviewed.
    stmt(db, 'UPDATE b_invoice_retainers SET cancelled_from=CASE WHEN ?=\'cancel\' THEN ? ELSE cancelled_from END,revision=?,revision_no=revision_no+1 WHERE id=?', preview.action, preview.effectiveMonth, id(), retainerId),
    release, audit(db, actor, 'invoice.retainer_amended', retainerId, `${preview.action}; ${preview.effectiveMonth}; ${preview.reason}`)]));
  return { id: amendmentId, effectiveMonth: preview.effectiveMonth, action: preview.action };
}
export async function setInvoiceRetainerStatus(db: D1Database, actor: Actor, retainerId: string, body: Data) {
  invoiceHuman(actor); const r = await retainerFor(db, retainerId);
  insist(body.status === 'active' || body.status === 'paused', 'Choose active or paused');
  insist(r.status !== 'cancelled' && body.revision === r.revision, 'Retainer changed or was cancelled', 409);
  const reason = text(body.reason, 'Rule review and reason', 1000), authority = await invoiceAuthority(db), [check, release] = guard(db, 'EXISTS(SELECT 1 FROM b_invoice_retainers WHERE id=? AND revision=?) AND ' + activeInvoiceClientSql, r.id, r.revision, r.client_id), [authorized, done] = invoiceAuthorityGuard(db, authority.revision);
  await atomic(db, actor, billed(db, actor, [check, authorized, stmt(db, 'UPDATE b_invoice_retainers SET status=?,principal_id=?,owner_email=?,revision=?,revision_no=revision_no+1 WHERE id=?', body.status, actor.id, actor.email, id(), r.id), done, release, audit(db, actor, 'invoice.retainer_reviewed', r.id, `${body.status}; ${reason}`)]));
  return { id: r.id, status: body.status };
}

/** One holder consents to automatic issue and send for the rule revision it reviewed; the recorded limits bind every run. */
export async function setInvoiceAutoConsent(db: D1Database, actor: Actor, retainerId: string, body: Data) {
  invoiceHuman(actor); const r = await retainerFor(db, retainerId), authority = await invoiceAuthority(db);
  insist(r.status === 'active' && body.revision === r.revision, 'Retainer changed or is not active', 409);
  insist(await canAccessClient(db, actor.email, r.client_id), 'You do not hold this client', 403);
  if (body.enabled === false) {
    await atomic(db, actor, billed(db, actor, [stmt(db, 'UPDATE b_invoice_retainers SET auto_consent=NULL WHERE id=? AND revision=?', r.id, r.revision), audit(db, actor, 'invoice.auto_consent_cleared', r.id, `rule revision ${r.revision_no}`)]));
    return { id: r.id, autoConsent: null };
  }
  const consent = { revision: r.revision, ruleRevision: r.revision_no, capCents: integer(body.capCents, 'Per-invoice cap in USD cents', 1), contactId: text(body.contactId, 'Recipient', 100),
    reason: text(body.reason, 'Reason for automatic issue and send', 1000), consenterId: actor.id, consentedBy: actor.email, consentedAt: now() };
  const [check, release] = guard(db, 'EXISTS(SELECT 1 FROM b_invoice_retainers WHERE id=? AND revision=? AND status=\'active\')', r.id, r.revision), [authorized, done] = invoiceAuthorityGuard(db, authority.revision);
  const recipient = { client: { id: r.client_id }, recipient: { id: consent.contactId, revision: (await stmt(db, 'SELECT revision FROM b_client_contacts WHERE id=?', consent.contactId).first<Data>())?.revision ?? '' } };
  await atomic(db, actor, billed(db, actor, [check, authorized, ...invoiceRecipientGuard(db, recipient),
    stmt(db, 'UPDATE b_invoice_retainers SET auto_consent=? WHERE id=?', JSON.stringify(consent), r.id), done, release,
    audit(db, actor, 'invoice.auto_consent', r.id, `rule revision ${r.revision_no}; cap ${consent.capCents} USD cents; recipient ${consent.contactId}; ${consent.reason}`)]));
  return { id: r.id, autoConsent: consent };
}

/** Issue and send one period's draft only inside the live consent; every other case leaves a draft with a named exception. */
async function autoIssueAndSend(env: Bindings, r: Data, period: string) {
  const db = env.DB, consent = r.auto_consent ? JSON.parse(r.auto_consent) : null;
  const invoice = consent ? await stmt(db, 'SELECT * FROM b_invoices WHERE retainer_id=? AND period=?', r.id, period).first<Data>() : null;
  if (!invoice || invoice.status === 'void' || invoice.auto_exception) return null;
  if (invoice.status === 'issued' && (invoice.auto_revision === null || await stmt(db, 'SELECT 1 FROM b_invoice_deliveries WHERE invoice_id=?', invoice.id).first())) return null;
  const hold = async (reason: string) => {
    await db.batch([stmt(db, 'UPDATE b_invoices SET auto_exception=? WHERE id=? AND auto_exception IS NULL', reason, invoice.id),
      stmt(db, 'INSERT INTO b_audit(id,actor,action,object_id,detail,at) VALUES(?,?,?,?,?,?)', id(), 'invoice scheduler', 'invoice.auto_exception', invoice.id, `${period}; rule revision ${r.revision_no}; ${reason}`, now())]);
    return { invoiceId: invoice.id, exception: reason };
  };
  const usd = (cents: number) => `USD ${(cents / 100).toFixed(2)}`, snapshot = JSON.parse(invoice.snapshot);
  if (consent.revision !== r.revision) return hold(`The rule changed after the consent (revision ${consent.ruleRevision} -> ${r.revision_no})`);
  const consenter = await liveBillingActor(db, consent.consenterId);
  if (!consenter) return hold(`${consent.consentedBy} no longer holds financial authority`);
  if (!await canAccessClient(db, consenter.email, r.client_id)) return hold(`${consent.consentedBy} no longer holds this client`);
  if (snapshot.recipient.id !== consent.contactId) return hold('The invoice recipient differs from the consented recipient');
  if (invoice.total_cents > consent.capCents) return hold(`Invoice total ${usd(invoice.total_cents)} exceeds the consented cap ${usd(consent.capCents)}`);
  const contact = await stmt(db, `SELECT 1 FROM b_client_contacts WHERE id=? AND client_id=? AND active=1 AND authorized=1 AND email_consent=1 AND email<>'' AND EXISTS(SELECT 1 FROM json_each(roles) WHERE value='billing')`, consent.contactId, r.client_id).first();
  if (!contact) return hold('The recipient no longer has a billing role with email consent');
  try {
    if (invoice.status === 'draft') {
      const draft = await invoiceDetail(db, consenter, invoice.id);
      await issueInvoice(db, consenter, invoice.id, { revision: draft.revision, snapshotHash: draft.snapshotHash,
        reviewNote: `Auto-issued under rule revision ${r.revision_no}: cap ${usd(consent.capCents)}; ${consent.reason}` }, { ruleRevision: r.revision_no });
    }
    const preview = await previewInvoiceDelivery(db, consenter, invoice.id, { contactId: consent.contactId });
    const sent = await sendInvoice(env, consenter, invoice.id, { contactId: consent.contactId, previewHash: preview.previewHash });
    return sent.status === 'accepted' ? { invoiceId: invoice.id, autoIssued: true, delivery: sent.status } : hold(`Issued; delivery ${sent.status}: ${sent.delivery}`);
  } catch (error) { return hold(String(error instanceof Error ? error.message : error)); }
}

/** Cron runs only the current firm's month, under the live person who last approved the rule. */
export async function runInvoiceSchedules(env: Bindings, at = new Date()) {
  const db = env.DB, day = localClock(await firmSettings(db), at).localDate, period = day.slice(0, 7), result: Data[] = [];
  for (const r of await rows(db, `SELECT r.* FROM b_invoice_retainers r JOIN b_clients c ON c.id=r.client_id WHERE r.status='active' AND c.lifecycle='active' AND c.erased_at IS NULL AND c.merged_into IS NULL
    AND r.start_month<=? AND (r.cancelled_from IS NULL OR r.cancelled_from>?)`, period, period)) {
    const d = await retainerDefinition(db, r, period);
    if (Number(day.slice(8)) < d.billDay) continue;
    const actor = await liveBillingActor(db, r.principal_id);
    try {
      insist(actor && await canAccessClient(db, actor.email, r.client_id), 'The person who approved this rule no longer holds financial authority for the client');
      const invoice = await generateRetainerInvoice(db, actor, r.id, { period });
      result.push({ id: r.id, invoiceId: invoice.id, replayed: invoice.replayed, ...(await autoIssueAndSend(env, r, period)) });
    } catch (error) {
      // Hold the actual failed rule for a person's review; never fabricate a draft.
      const reason = String(error instanceof Error ? error.message : error);
      await db.batch([stmt(db, "UPDATE b_invoice_retainers SET status='paused',revision=?,revision_no=revision_no+1 WHERE id=?", id(), r.id),
        stmt(db, 'INSERT INTO b_audit(id,actor,action,object_id,detail,at) VALUES(?,?,?,?,?,?)', id(), 'invoice scheduler', 'invoice.retainer_held', r.id, reason, now())]);
      result.push({ id: r.id, status: 'paused', reason });
    }
  }
  return result;
}
