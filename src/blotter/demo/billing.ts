// Billing and preparations for the sample practice: each past month exported
// and approved (one first draft voided), this month's fixed fees in a draft
// waiting for the principal, and the practice assistant's preparations, three
// of them waiting for a decision. Snapshots and CSVs come from billing.ts.
import { officeAt } from './clock';
import { exportCsv } from '../billing';
import { digest } from '../model';
import { chance, fixedId } from './ids';
import { clients, templates } from './practice';
import { dueDate, type Row, type Work } from './work';
import { engagements } from './practice';

const HOUR = 3_600_000, DAY = 24 * HOUR;
export const ASSISTANT = 'Practice assistant';
const iso = (ms: number) => new Date(ms).toISOString();

/** The billable lines unbilled() would list, in its order: fees, then time, each by client. */
function billable(work: Work) {
  const jobs = new Map(work.jobs.map(j => [j.id, j])), client = new Map(Object.values(clients).map(c => [c.id, c]));
  const context = (j: Row) => ({ currency: j.currency, job: j.title, period: j.period_label, client: client.get(j.client_id as string)!.name, abn: client.get(j.client_id as string)!.abn });
  const fees = work.jobs.filter(j => j.status === 'signed_off' && Number(j.fee_cents) > 0).map(j => ({
    source_key: `fee:${j.id}`, kind: 'fee', source_id: j.id, job_id: j.id, date: String(j.signed_off_at).slice(0, 10), person: j.signed_off_by,
    description: 'Fixed fee', minutes: null, rate_cents: null, amount_cents: j.fee_cents, ...context(j), order: String(j.signed_off_at) }));
  const time = work.time.map(t => ({
    source_key: `time:${t.id}`, kind: 'time', source_id: t.id, job_id: t.job_id, date: t.date, person: t.person_email, description: t.description,
    minutes: t.minutes, rate_cents: t.rate_cents, amount_cents: t.amount_cents, ...context(jobs.get(t.job_id as string)!), order: `${t.date}${t.created_at}` }));
  const byClient = (a: Row, b: Row) => String(a.client).localeCompare(String(b.client)) || String(a.order).localeCompare(String(b.order));
  return [...fees.sort(byClient), ...time.sort(byClient)];
}

export async function practiceBilling(work: Work, now: Date, owner: { email: string }, today: string) {
  const clock = now.getTime(), month = today.slice(0, 7), riley = 'riley@morganco.example';
  const exports: Row[] = [], sources: Row[] = [], proposals: Row[] = [], audit: Row[] = [];
  const lines = billable(work);
  const record = (actor: string, action: string, objectId: string, detail: string, ms: number) =>
    audit.push({ id: fixedId(`audit:${action}:${objectId}:${ms}`), actor, action, object_id: objectId, detail, at: iso(ms) });
  async function prepare(title: string, chosen: Row[], preparedAt: number, by: string, outcome?: { approvedAt?: number; note?: string; voidedAt?: number; reason?: string }) {
    const id = fixedId(`export:${title}`), snapshotLines: Row[] = chosen.map(({ order: _, ...line }, n) => ({ line: n + 1, ...line }));
    const total = snapshotLines.reduce((sum, l) => sum + Number(l.amount_cents), 0), snapshot = { lines: snapshotLines, totalCents: total, currency: 'USD', taxIdTypes: true };
    const approved = outcome?.approvedAt !== undefined, voided = outcome?.voidedAt !== undefined;
    const csv = approved ? exportCsv(id, snapshot) : null;
    exports.push({ id, title, status: approved ? 'approved' : voided ? 'void' : 'draft', snapshot: JSON.stringify(snapshot), total_cents: total,
      csv, csv_sha256: csv ? await digest(csv) : null, revision: fixedId(`revision:${id}`), prepared_by: by, prepared_channel: 'person', prepared_at: iso(preparedAt),
      approved_by: approved ? owner.email : null, approved_at: approved ? iso(outcome!.approvedAt!) : null, review_note: approved ? outcome!.note : null,
      voided_by: voided ? owner.email : null, voided_at: voided ? iso(outcome!.voidedAt!) : null, void_reason: voided ? outcome!.reason : null });
    if (!voided) for (const line of chosen) sources.push({ source_key: line.source_key, export_id: id });
    record(by, 'export.prepared', id, `${chosen.length} lines, ${total} cents`, preparedAt);
    if (approved) record(owner.email, 'export.approved', id, outcome!.note!, outcome!.approvedAt!);
    if (voided) record(owner.email, 'export.voided', id, outcome!.reason!, outcome!.voidedAt!);
  }

  // Every month before this one is billed: prepared on the 1st, approved on the 2nd.
  const months = [...new Set(lines.map(l => String(l.date).slice(0, 7)))].filter(m => m < month).sort();
  for (const [n, m] of months.entries()) {
    const [y, mm] = m.split('-').map(Number), next = officeAt(`${mm === 12 ? y + 1 : y}-${String(mm % 12 + 1).padStart(2, '0')}-01`, 0);
    const preparedAt = Math.min(next + 10 * HOUR, clock - 6 * HOUR), approvedAt = Math.min(preparedAt + 29 * HOUR, clock - 2 * HOUR);
    const chosen = lines.filter(l => String(l.date).slice(0, 7) === m);
    if (n === months.length - 1 && chosen.length > 3) await prepare(`Billing ${m} (first draft)`, chosen.slice(0, 3), preparedAt - 2 * HOUR, riley, { voidedAt: preparedAt - HOUR, reason: 'Missing the review time; prepared again with every item.' });
    await prepare(`Billing ${m}`, chosen, preparedAt, riley, { approvedAt, note: 'Checked against the jobs list; fixed fees match the engagement letters.' });
  }
  // This month: fixed fees so far in a draft for the principal.
  const current = lines.filter(l => String(l.date).slice(0, 7) === month), fees = current.filter(l => l.kind === 'fee');
  if (fees.length) await prepare(`Billing ${month} fixed fees`, fees, clock - 20 * HOUR, riley);
  const exported = new Set(sources.map(s => s.source_key));

  // The practice assistant's preparations, made with the principal's agent key.
  const agent = `${owner.email} (agent: ${ASSISTANT})`, jobs = work.jobs;
  const propose = (kind: string, payload: Row, createdAt: number, decision?: { status: string; at: number; note?: string; resultId?: string }) => {
    const id = fixedId(`proposal:${kind}:${payload.summary}`);
    proposals.push({ id, kind, payload: JSON.stringify(payload), for_email: owner.email, agent_label: ASSISTANT, status: decision?.status ?? 'pending',
      result_id: decision?.resultId ?? null, decided_by: decision ? owner.email : null, decided_at: decision ? iso(decision.at) : null, decision_note: decision?.note ?? null, created_at: iso(createdAt) });
    record(agent, 'proposal.prepared', id, kind, createdAt);
    if (decision) record(owner.email, `proposal.${decision.status}`, id, decision.note ?? kind, decision.at);
    return id;
  };
  // Roll forward the signed-off job nobody has rolled yet.
  const unrolled = jobs.find(j => j.status === 'signed_off' && !jobs.some(n => n.rolled_from === j.id) && j.template_id === templates.close.id);
  if (unrolled) {
    const engagement = engagements.find(e => e.client.id === unrolled.client_id && e.template.id === unrolled.template_id)!;
    const [y, m] = String(unrolled.period_start).split('-').map(Number), next = `${m === 12 ? y + 1 : y}-${String(m % 12 + 1).padStart(2, '0')}-01`;
    const due = dueDate(engagement, next);
    propose('rollforward', { jobId: unrolled.id, dueDate: due, dueNote: unrolled.due_note, summary: `Roll ${unrolled.title} (${unrolled.period_label}) forward, due ${due}` }, clock - 3 * HOUR);
  }
  // Remind a client who still owes documents for open work.
  // A job whose client was already asked once and still owes documents.
  const waiting = jobs.filter(j => j.status === 'open' && work.reminders.some(r => r.job_id === j.id) && work.requests.some(r => r.job_id === j.id && r.status === 'requested'));
  const remind = waiting.sort((a, b) => String(a.due_date).localeCompare(String(b.due_date)))[0];
  if (remind) propose('reminder', { jobId: remind.id, message: 'Nearly there: just the documents below, please, so we can finish before the due date.', summary: `Remind the client about ${remind.title} (${remind.period_label})` }, clock - 5 * HOUR);
  // Bill this month's recorded time for two clients.
  const time = current.filter(l => l.kind === 'time' && !exported.has(l.source_key as string));
  const two = [...new Set(time.map(l => l.client))].slice(0, 2), chosen = time.filter(l => two.includes(l.client));
  if (chosen.length) {
    const title = `Billing ${month} time: ${two.map(c => String(c).split(' ')[0]).join(' and ')}`;
    propose('export', { title, sourceKeys: chosen.map(l => l.source_key), summary: `Prepare billing export "${title}" with ${chosen.length} items` }, clock - 26 * HOUR);
  }
  // Decided earlier: a nudge the principal approved, and one declined.
  const nudge = work.reminders.find(r => Date.parse(String(r.sent_at)) < clock - 2 * DAY && work.reminders.some(o => o.job_id === r.job_id && String(o.sent_at) < String(r.sent_at)));
  if (nudge) {
    const j = jobs.find(x => x.id === nudge.job_id)!;
    const sent = Date.parse(String(nudge.sent_at));
    nudge.proposal_id = propose('reminder', { jobId: j.id, message: '', summary: `Remind the client about ${j.title} (${j.period_label})` }, sent - 2 * HOUR, { status: 'approved', at: sent, resultId: String(nudge.id) });
    nudge.sent_by = owner.email;
  }
  const declined = jobs.filter(j => j.status !== 'open' && Date.parse(String(j.submitted_at)) > clock - 20 * DAY).sort((a, b) => chance(String(a.id)) - chance(String(b.id)))[0];
  if (declined) {
    const asked = Date.parse(String(declined.submitted_at)) - DAY;
    propose('reminder', { jobId: declined.id, message: '', summary: `Remind the client about ${declined.title} (${declined.period_label})` }, asked,
      { status: 'declined', at: asked + 3 * HOUR, note: 'The client dropped the last documents in on Tuesday.' });
  }
  return { exports, sources, proposals, audit };
}
