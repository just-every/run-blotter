import {signatureOpenWork} from './signatures-retention';
import { invoiceOpenBalances } from './invoices-sources';
// ERASURE-013 dry run (ct 22 Oct 2026): every record class with its action (removed; payload
// replaced by the erasure marker; retained with class, clock and expiry; held with the hold; or
// an outside copy with its owner) and its count, the refusals while work is open, and the digest
// that execution must present. The same predicates later apply the erasure inside one batch.
import { CLIENT_CLASSES, unclassified, type ClientClass } from './erasure-registry';
import { observedCopies } from './erasure-copies';
import { active, firmToday } from './client-retention';
import { lit, retained, rowsOf, selectors, steps, suppressionDigest, unheld, type Context, type Held, type Step } from './erasure-scope';
import { identityOf } from './retained-records';
import { clocks } from './retention-clock';
import { digest, insist, now, rows, stmt, type Actor, type Data } from './model';

const count = async (db: D1Database, table: string, where: string) => rowsOf(await stmt(db, `SELECT count(*) n FROM ${table} WHERE ${where}`).first<Data>());

/** Audit values that name this client or its contacts, never staff addresses. */
async function auditedValues(db: D1Database, clientId: string) {
  const people = new Set([...await rows(db, 'SELECT email FROM b_members'), ...await rows(db, 'SELECT email FROM oa_operators')].map(r => String(r.email).toLowerCase()));
  const client = (await rows(db, 'SELECT * FROM b_clients WHERE id=?', clientId))[0];
  const identity = client ? await identityOf(db, client) : null;
  const found = [...await rows(db, 'SELECT name v,contact_name w,contact_email x FROM b_clients WHERE id=?', clientId),
    ...await rows(db, 'SELECT name v,contact_name w,contact_email x FROM b_clients WHERE merged_into=?', clientId),
    ...await rows(db, "SELECT name v,first_name||' '||last_name w,email x,phone y FROM b_client_contacts WHERE client_id=?", clientId)].flatMap(r => Object.values(r));
  if (identity) found.push(identity.taxpayerId, ...Object.values(identity.address));
  return [...new Set(found.map(v => String(v ?? '').trim()).filter(v => v.length >= 4 && !people.has(v.toLowerCase()) && !/^Erased (contact|client)/.test(v)))].sort();
}

/** The marks that preserve records: the client, record classes (this client or the whole firm), jobs and files. */
async function heldBy(db: D1Database, clientId: string, today: string) {
  const marks = await rows(db, `SELECT id,scope,target_id,class,kind,until,owner,review_date,reason,placed_by FROM b_retention_marks WHERE (client_id=? OR (client_id IS NULL AND scope='class')) AND ${active(today)} ORDER BY placed_at,id`, clientId);
  const held: Held = { client: marks.some(m => m.scope === 'client'), classes: marks.filter(m => m.scope === 'class').map(m => String(m.class)), jobs: marks.filter(m => m.scope === 'job').map(m => String(m.target_id)), files: marks.filter(m => m.scope === 'file'||m.scope==='signature').map(m => String(m.target_id)) };
  return { marks, held };
}

async function withdrawnAddresses(db: D1Database, x: Context) {
  const s = selectors(x);
  return (await rows(db, `SELECT DISTINCT w.address a FROM b_marketing_consents w WHERE w.kind='withdraw' AND w.channel='email' AND (w.contact_id IN ${s.K} OR w.client_id=${s.c})
    AND NOT EXISTS(SELECT 1 FROM b_marketing_consents v WHERE v.corrects_id=w.id)`)).map(r => String(r.a));
}
export const carrySql = (x: Context) => {
  const s = selectors(x);
  return { from: `FROM b_client_contacts o JOIN b_marketing_consents w ON w.address=o.email AND w.kind='withdraw' AND w.channel='email' AND (w.contact_id IN ${s.K} OR w.client_id=${s.c})
    AND NOT EXISTS(SELECT 1 FROM b_marketing_consents v WHERE v.corrects_id=w.id) WHERE o.client_id<>${s.c} AND o.email<>''` };
};

/** Records that refuse erasure while they are open. Each names the records, never their content. */
async function openWork(db: D1Database, clientId: string) {
  const c = lit(clientId), jobs = `(SELECT id FROM b_jobs WHERE client_id=${c})`, out: string[] = [];
  for (const j of await rows(db, `SELECT title,period_label FROM b_jobs WHERE client_id=${c} AND status<>'signed_off' ORDER BY period_start`)) out.push(`Open job: ${j.title} · ${j.period_label}. Sign it off first.`);
  for (const r of await rows(db, `SELECT t.name,r.first_period FROM b_recurrence_rules r JOIN b_templates t ON t.id=r.template_id WHERE r.client_id=${c} AND r.status='active'`)) out.push(`Active recurring rule: ${r.name} from ${r.first_period}. Pause or end it first.`);
  const queued = await count(db, 'b_bulk_recipients', `client_id=${c} AND status IN ('pending','claimed')`);
  if (queued) out.push(`${queued} queued or scheduled message(s). Let them send or hold them first.`);
  const uploads = await count(db, 'b_document_uploads', `job_id IN ${jobs} AND state='pending'`);
  if (uploads) out.push(`${uploads} open upload(s). Wait for them to complete or cancel them first.`);
  const organizers = await count(db, 'b_job_organizers o', `o.job_id IN ${jobs} AND o.sent_at IS NOT NULL AND NOT EXISTS(SELECT 1 FROM b_organizer_submissions s WHERE s.organizer_id=o.id)`);
  if (organizers) out.push(`${organizers} open organizer request(s) the client has not answered. Wait for the answer or take the organizer back first.`);
  const proposals = await count(db, 'b_proposals', `status='pending' AND json_extract(payload,'$.jobId') IN ${jobs}`) + await count(db, 'b_automation_attempts', `job_id IN ${jobs} AND status IN ('pending','running','dispatching')`);
  if (proposals) out.push(`${proposals} pending agent run(s) for this client. Decide or let them finish first.`);
  out.push(...await signatureOpenWork(db,clientId));
  for(const item of await invoiceOpenBalances(db,clientId))out.push(`Open balance: ${item.title} (${item.balance_cents} USD cents). Resolve it before erasure.`);
  for(const r of await rows(db,"SELECT title FROM b_invoice_retainers WHERE client_id=? AND status='active'",clientId))out.push(`Active invoice retainer: ${r.title}. Pause or cancel it first.`);
  return out;
}

export async function plan(db: D1Database, actor: Actor, clientId: string) {
  const client = await stmt(db, 'SELECT * FROM b_clients WHERE id=?', clientId).first<Data>();
  insist(client, 'Client not found', 404);
  const at = now(), today = await firmToday(db), { marks, held } = await heldBy(db, clientId, today);
  const label = 'Erased client ' + [...crypto.getRandomValues(new Uint8Array(4))].map(b => b.toString(16).padStart(2, '0')).join('');
  const x: Context = { client: clientId, today, at, who: actor.email, reason: '', label, held };
  const values = await auditedValues(db, clientId);
  const audited = values.length ? { where: values.map(v => `instr(detail,${lit(v)})>0`).join(' OR '), set: 'detail=' + values.reduce((expr, v) => `replace(${expr},${lit(v)},'[erased]')`, 'detail') } : null;
  const list = steps(x, audited), free = unheld(x, audited);
  const counts: { table: string; action: Step['action']; label: string; cls: string; count: number; preserved: number }[] = [];
  for (const [n, step] of list.entries()) counts.push({ table: step.table, action: step.action, label: step.label, cls: step.cls, count: await count(db, step.table, step.where), preserved: Math.max(0, await count(db, free[n].table, free[n].where) - await count(db, step.table, step.where)) });
  const s = selectors(x), carry = rowsOf(await stmt(db, `SELECT count(*) n FROM (SELECT o.id ${carrySql(x).from} GROUP BY o.id)`).first<Data>());
  const withdrawn = await withdrawnAddresses(db, x);
  const keep: { key: string; cls: ClientClass; label: string; reason: string; owner: string; count: number }[] = [];
  for (const r of retained(x)) keep.push({ key: r.key, cls: r.cls, label: r.label, reason: r.reason, owner: r.owner, count: rowsOf(await stmt(db, r.sql).first<Data>()) });
  const records = (await clocks(db)).filter(c => c.clientIds.includes(clientId));
  const auditRows = rowsOf(await stmt(db, `SELECT count(*) n FROM b_audit WHERE object_id=${s.c} OR object_id IN ${s.JALL} OR object_id IN ${s.K} OR object_id IN (SELECT id FROM b_files WHERE job_id IN ${s.JALL})`).first<Data>());
  const copies = await rows(db, 'SELECT id,kind,system,holder,note,recorded_by,closed_at FROM b_external_copies WHERE client_id=? ORDER BY recorded_at,id', clientId);
  const observed = await observedCopies(db, clientId);
  const blockers: string[] = [];
  const missing = await unclassified(db);
  if (missing.length) blockers.push(`Unclassified stores hold or may hold client data: ${missing.join(', ')}. The record class registry fails closed (ERASURE-002).`);
  if (client.erased_at) blockers.push('This client was already erased');
  if (client.lifecycle !== 'archived') blockers.push('Archive the client before requesting erasure');
  blockers.push(...await openWork(db, clientId));
  if (client.merged_into) blockers.push('This client was merged into another. Erase the surviving client: erasure covers it and every record merged into it.');
  // Which marks preserve what, so the preview can say held with the hold.
  const holders = (cls: string) => marks.filter(m => m.scope === 'client' || (m.scope === 'class' && m.class === cls) || m.scope === 'job' || m.scope === 'file').map(m => ({ id: m.id, scope: m.scope, kind: m.kind, owner: m.owner, reason: m.reason }));
  const classes = (Object.keys(CLIENT_CLASSES) as ClientClass[]).map(cls => {
    const mine = counts.filter(c => c.cls === cls);
    return { class: cls, label: CLIENT_CLASSES[cls], removed: mine.filter(c => c.action !== 'redact').reduce((n, c) => n + c.count, 0), marker: mine.filter(c => c.action === 'redact').reduce((n, c) => n + c.count, 0),
      retained: keep.filter(k => k.cls === cls).reduce((n, k) => n + k.count, 0), held: mine.reduce((n, c) => n + c.preserved, 0), holds: mine.some(c => c.preserved) ? holders(cls) : [] };
  });
  const retainedAll = [...keep.filter(k => k.count > 0), { key: 'audit_history', cls: 'audit', label: 'Audit history rows about this client (actor, action, object, time; names replaced)', reason: 'Durable attribution (AUDIT-001).', owner: 'Principal', count: auditRows }];
  const totals = { redacted: 0, deleted: 0, cascade: 0 };
  for (const c of counts) totals[c.action === 'redact' ? 'redacted' : c.action === 'delete' ? 'deleted' : 'cascade'] += c.count;
  const heldTotal = counts.reduce((n, c) => n + c.preserved, 0);
  // The sealed remainder is needed when a retained or held record still names the client.
  const remainder = !held.client && (keep.some(k => k.count > 0) || heldTotal > 0);
  const body = { client: { ref: clientId.slice(0, 8), revision: client.revision }, counts: counts.map(({ table, action, count, preserved }) => ({ table, action, count, preserved })), classes, carried: carry, retained: retainedAll.map(({ key, count }) => ({ key, count })),
    marks: marks.map(m => m.id), records: records.map(r => [r.id, r.expiry]), copies: copies.map(c => c.id), observed: observed.map(o => [o.source, o.owner, o.count]), digests: withdrawn.length, blockers };
  const planHash = await digest(JSON.stringify(body));
  const eligible = blockers.length === 0;
  return { x, client, list, audited, counts, carry, withdrawn, retained: retainedAll, marks, copies, observed, records, blockers, totals, planHash, remainder, held, classes, heldTotal, fingerprint: await fingerprint(db),
    preview: { client: { id: clientId, ref: clientId.slice(0, 8), name: client.name, lifecycle: client.lifecycle }, eligible, blockers, erase: counts.filter(c => c.count > 0).map(({ table, action, label, cls, count }) => ({ table, action, label, class: cls, count })),
      classes, totals, withdrawalsCarried: carry, retained: retainedAll, records: records.map(r => ({ ...r, class: r.cls })), holds: marks, held: counts.filter(c => c.preserved > 0).map(c => ({ table: c.table, label: c.label, class: c.cls, count: c.preserved })),
      suppressionDigests: withdrawn.length, sealedRemainder: remainder,
      externalCopies: [...copies.map(c => ({ ...c, source: 'principal-recorded', status: c.closed_at ? 'closed' : 'open', action: c.closed_at ? 'confirmed deleted by the principal' : `Not erased by Blotter; ${c.holder} must delete it` })),
        ...observed.map(o => ({ source: o.source, kind: 'observed', system: o.label, holder: o.owner, count: o.count, status: 'open', action: `Not erased by Blotter; ${o.owner} controls it` }))],
      planHash } };
}

/** Marks and periods must not change between the preview and the batch that erases. */
export const fingerprint = async (db: D1Database) => ({
  marks: rowsOf(await stmt(db, 'SELECT count(*)*1000+count(released_at) n FROM b_retention_marks').first<Data>()),
  periods: rowsOf(await stmt(db, 'SELECT coalesce(sum(years),0)+count(*)*1000 n FROM b_retention_periods').first<Data>()),
});
export const fingerprintSql = '(SELECT count(*)*1000+count(released_at) FROM b_retention_marks)=? AND (SELECT coalesce(sum(years),0)+count(*)*1000 FROM b_retention_periods)=?';

export const digestsOf = async (withdrawn: string[]) => new Map(await Promise.all(withdrawn.map(async a => [await suppressionDigest(a), 'withdrawn marketing consent'] as const)));
