// The practice's recurring work around `now`: for each engagement, a short
// chain of signed-off periods, the current period in whatever state its due
// date suggests, and the next period once the current one is rolled forward.
// Labels and calendar steps come from Blotter's own jobs.ts; nothing here
// computes a tax due date: each engagement's recorded due day is a person's note.
import { localDay, officeAt } from './clock';
import { addMonths, periodLabel } from '../jobs';
import { amount } from '../billing';
import { weekStart } from '../timesheets';
import { chance, fixedId } from './ids';
import { base64, csv, pdf } from './files';
import { clients, engagements, principal, team, type Engagement } from './practice';

const DAY = 86_400_000, HOUR = 3_600_000;
const STEP = { monthly: 1, quarterly: 3, annual: 12 } as const;
const HISTORY = { monthly: 2, quarterly: 1, annual: 1 } as const;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const day = (iso: string) => iso.slice(0, 10);
const at = officeAt;
const iso = (ms: number) => new Date(ms).toISOString();
const between = (from: number, to: number, f: number) => Math.round(from + (to - from) * Math.min(1, Math.max(0, f)));
const lastDay = (start: string, months: number) => day(new Date(Date.parse(addMonths(start, months) + 'T00:00:00Z') - DAY).toISOString());

/** The due date the practice recorded for a period, following each engagement's note. */
export function dueDate(e: Engagement, start: string) {
  const on = (months: number, dayOfMonth: number) => addMonths(start, months).slice(0, 8) + String(dayOfMonth).padStart(2, '0');
  switch (e.template.key) {
    case 'close': return on(1, 12);
    case 'payroll': return on(0, 28);
    case 'salesTax': return on(3, 20);
    case 'company': return on(15, 15);
    default: return on(15, 15);
  }
}
function periodStart(recurrence: keyof typeof STEP, date: string) {
  const [y, m] = date.split('-').map(Number);
  if (recurrence === 'monthly') return `${y}-${String(m).padStart(2, '0')}-01`;
  if (recurrence === 'quarterly') return `${y}-${String(m - (m - 1) % 3).padStart(2, '0')}-01`;
  return `${y}-01-01`;
}

export type Row = Record<string, unknown>;
export type Work = ReturnType<typeof emptyWork>;
const emptyWork = () => ({
  jobs: [] as Row[], steps: [] as Row[], requests: [] as Row[], files: [] as Row[], links: [] as Row[],
  reminders: [] as Row[], time: [] as Row[], timeStatus: [] as Row[], audit: [] as Row[],
});

const rates = new Map<string, number>(team.map(m => [m.email, m.rateCents]));
const notes = ['Bank reconciled; sales-tax coding checked.', 'Reconciled to statements; nothing unusual.', 'Checked against last period; variances explained.', 'Tied out to source documents. Good to go.', 'Reviewed. Two coding fixes made with the preparer.'];
const nudges = ['Just the last few documents to go, thank you!', 'Could you send these by Friday so we can finish on time?', ''];
const minutesFor = { salesTax: 55, close: 70, payroll: 35, company: 110, individual: 45 } as Record<string, number>;

export function practiceWork(now: Date, owner: { id: string; email: string }) {
  const work = emptyWork(), clock = now.getTime(), today = localDay(now);
  rates.set(owner.email, principal.rateCents);
  const who = (person: string) => person === 'owner' ? owner.email : person;
  // Map each local day into New York office hours, using that date's DST offset.
  const office = (ms: number) => { const date = localDay(ms), midnight = at(date, 0), mapped = at(date, 8.5 + (ms - midnight) / DAY * 9); return mapped < clock - 10 * 60_000 ? mapped : ms; };
  const audit = (actor: string, action: string, objectId: string, detail: string, ms: number) =>
    work.audit.push({ id: fixedId(`audit:${action}:${objectId}:${ms}`), actor, action, object_id: objectId, detail, at: iso(ms) });
  // Distinct waiting, review and ready-to-roll stories survive calendar changes and review returns.
  const stuck = clients.ironbark.name, unrolled = 'Fig Tree Dental LLC:close', inReview = `${clients.cobalt.name}:payroll`;
  const reviewing = `${clients.saltwater.name}:salesTax`;

  for (const e of engagements) {
    const t = e.template, recurrence = t.recurrence, key = `${e.client.name}:${t.key}`;
    const preparer = who(e.preparer), reviewer = who(e.reviewer);
    // The current period: the first whose due date is no more than six days past.
    let current = periodStart(recurrence, today);
    while (dueDate(e, addMonths(current, -STEP[recurrence])) >= day(iso(at(today) - 6 * DAY))) current = addMonths(current, -STEP[recurrence]);
    // Leave time to complete a closed month, including when the demo opens early in a new month.
    if (key === unrolled) while (at(addMonths(current, 1), 9) > clock - 4 * DAY) current = addMonths(current, -1);
    if (key === inReview) while (at(current, 9) > clock - 4 * DAY) current = addMonths(current, -1);
    // Review an already closed period with a real work window. A current
    // quarter that has not ended cannot supply completed review evidence.
    if (key === reviewing) while (at(addMonths(current, STEP[recurrence]), 9) > clock - 4 * DAY) current = addMonths(current, -STEP[recurrence]);
    const isStuck = e.client.name === stuck && t.key === 'salesTax';
    // A completed quarter waits for principal review even when the current
    // date gives every other engagement an open or signed-off period.
    const reviewExample = e.client.id === clients.cobalt.id && t.key === 'salesTax';
    const first = addMonths(current, -STEP[recurrence] * HISTORY[recurrence]);
    let previous: Row | undefined, start = first;
    for (let n = 0; ; n++, start = addMonths(start, STEP[recurrence])) {
      if (reviewExample && previous?.status === 'review') break;
      const due = dueDate(e, start), id = fixedId(`job:${key}:${start}`), r = chance(id);
      const isCurrent = start === current, history = start < current;
      if (start > current) { if (previous?.status !== 'signed_off' || key === unrolled) break; }
      if (isStuck && isCurrent) break; // the stuck period below never got signed off
      const end = lastDay(start, STEP[recurrence]);
      const created = previous ? Date.parse(previous.signed_off_at as string) + 7 * 60_000 : Math.min(at(end, 9) - 10 * DAY, clock - 30 * DAY);
      // What state this period is in, from how close its due date is.
      const daysLeft = Math.round((at(due) - at(today)) / DAY);
      let status: 'open' | 'review' | 'signed_off', progress: number;
      if (isStuck && start === addMonths(current, -STEP[recurrence])) { status = 'open'; progress = 0.2; }
      else if (reviewExample && start === addMonths(current, -STEP[recurrence])) { status = 'review'; progress = 1; }
      else if (history) { status = 'signed_off'; progress = 1; }
      else if (!isCurrent) { status = 'open'; progress = 0; }
      else if (daysLeft < 0) { status = r < 0.5 ? 'signed_off' : r < 0.85 ? 'review' : 'open'; progress = status === 'open' ? 0.7 : 1; }
      else if (daysLeft <= 14) { status = r < 0.3 ? 'signed_off' : r < 0.6 ? 'review' : 'open'; progress = status === 'open' ? 0.45 + r * 0.4 : 1; }
      else { status = 'open'; progress = Math.max(0, Math.min(0.85, 0.15 + 0.7 * r - daysLeft / 300)); }
      if (key === unrolled && isCurrent) status = 'signed_off', progress = 1;
      if (key === inReview && isCurrent) status = 'review', progress = 1;
      if (key === reviewing && isCurrent) status = 'review', progress = 1;
      // The work window: from the period's end (payroll: its start) until review or now.
      const begin = Math.max(created + HOUR, at(t.key === 'payroll' ? start : day(iso(at(end) + DAY)), 9));
      const workEnd = clock - 45 * 60_000;
      // A period that has barely begun has nothing done yet.
      if (workEnd - begin < 3 * DAY && status !== 'open') status = 'open', progress = 0.5;
      if (workEnd - begin < 12 * HOUR) progress = 0;
      let submitted = 0, signed = 0;
      if (status !== 'open') {
        submitted = office(Math.min(Math.max(begin + 2 * DAY, at(due, 11) - (2 + Math.floor(r * 4)) * DAY), workEnd - (status === 'review' ? 3 * HOUR : DAY)));
        if (status === 'signed_off') signed = office(Math.min(submitted + (5 + Math.floor(r * 30)) * HOUR, workEnd - 2 * HOUR));
        // The ready-to-roll example was finished this week; its dependent work uses these dates below.
        if (key === unrolled && isCurrent) {
          submitted = at(localDay(clock - 2 * DAY), 17);
          signed = at(localDay(clock - DAY), 15);
        }
      }
      const finish = status === 'open' ? Math.max(begin, workEnd) : submitted;
      const job: Row = {
        id, client_id: e.client.id, template_id: t.id, title: t.name, period_start: start, period_label: periodLabel(start, recurrence),
        due_date: due, due_note: e.dueNote, preparer_email: preparer, reviewer_email: reviewer, status, fee_cents: t.feeCents, currency: 'USD',
        rolled_from: previous?.id ?? null, revision: fixedId(`revision:${id}:${status}`), created_by: previous ? reviewer : owner.email,
        created_channel: 'person', created_at: iso(created),
        submitted_by: submitted ? preparer : null, submitted_at: submitted ? iso(submitted) : null,
        signed_off_by: signed ? reviewer : null, signed_off_at: signed ? iso(signed) : null,
        sign_off_note: signed ? notes[Math.floor(r * notes.length)] : null,
      };
      if (due < start) throw new Error(`The sample due date for ${key} is before its period`);
      work.jobs.push(job);
      audit(previous ? reviewer : owner.email, previous ? 'job.rolled_forward' : 'job.started', id, `${t.name} ${start}`, created);

      // Client documents: a reminder with an upload link, then uploads and acceptance.
      const sent = office(Math.max(created + 20 * 60_000, at(day(iso(at(end) + DAY)), 9)));
      const reminders: number[] = e.client.contactEmail && sent < finish ? [sent] : [];
      const states = t.requests.map((label, i) => {
        if (isStuck && i === t.requests.length - 1) return 'requested';
        if (status !== 'open') return 'accepted';
        const q = chance(`${id}:${i}`);
        return q < progress ? 'accepted' : q < progress + 0.3 && progress > 0 ? 'received' : 'requested';
      });
      if (reminders.length && states.includes('requested') && finish - sent > 9 * DAY) reminders.push(sent + 7 * DAY);
      reminders.forEach((ms, k) => {
        const outstanding = t.requests.filter((_, i) => k === 0 || states[i] === 'requested');
        const reminderId = fixedId(`reminder:${id}:${k}`), note = k ? nudges[Math.floor(r * nudges.length)] : '';
        const expires = ms + 30 * DAY, replaced = reminders[k + 1];
        work.links.push({ id: fixedId(`link:${id}:${k}`), job_id: id, digest: '', created_by: preparer, created_at: iso(ms), expires_at: iso(expires),
          revoked_at: replaced ? iso(replaced) : signed ? iso(signed) : null });
        work.reminders.push({ id: reminderId, job_id: id, to_email: e.client.contactEmail, outstanding: JSON.stringify(outstanding),
          message: [`Hello ${e.client.contactName || e.client.name},`, '', `We need the following documents for ${t.name} (${job.period_label}):`, ...outstanding.map(label => `- ${label}`), '',
            ...(note ? [note, ''] : []), 'Upload them securely here: {origin}/portal/…', `This link expires on ${day(iso(expires))}.`].join('\n'),
          delivery: 'accepted by demo mail', sent_by: preparer, proposal_id: null, sent_at: iso(ms) });
        audit(preparer, 'reminder.sent', id, e.client.contactEmail, ms);
      });
      t.requests.forEach((label, i) => {
        const requestId = fixedId(`request:${id}:${i}`), state = states[i];
        let updatedBy = job.created_by as string, updated = created;
        if (state !== 'requested') {
          const viaPortal = reminders.length > 0 && chance(`${requestId}:channel`) < 0.8;
          const uploaded = office(between(viaPortal ? reminders[0] + 2 * HOUR : begin, finish - 4 * HOUR, (i + 1) / (t.requests.length + 2) * 0.6));
          const file = document(e, label, job.period_label as string, start, end, i);
          work.files.push({ id: fixedId(`file:${requestId}`), request_id: requestId, job_id: id, name: file.name, mime: file.mime, size: file.bytes.length,
            sha256: '', content_base64: base64(file.bytes), uploaded_by: viaPortal ? 'client' : preparer, channel: viaPortal ? 'portal' : 'person', uploaded_at: iso(uploaded) });
          audit(viaPortal ? 'client upload link' : preparer, 'file.uploaded', fixedId(`file:${requestId}`), label, uploaded);
          updatedBy = viaPortal ? 'client' : preparer; updated = uploaded;
          if (state === 'accepted') { updated = office(uploaded + 3 * HOUR); updatedBy = preparer; audit(preparer, 'request.accepted', requestId, label, updated); }
        }
        work.requests.push({ id: requestId, job_id: id, ordinal: i + 1, label, status: state, note: '', updated_by: updatedBy, updated_at: iso(updated) });
      });

      // The checklist, worked in order across the window, with time recorded as it goes.
      const done = status === 'open' ? Math.floor(t.steps.length * progress) : t.steps.length;
      t.steps.forEach((label, i) => {
        const doneAt = i < done ? office(between(begin, finish - HOUR, (i + 1) / (t.steps.length + 1))) : null;
        work.steps.push({ job_id: id, ordinal: i + 1, label, done_by: doneAt ? preparer : null, done_at: doneAt ? iso(doneAt) : null });
        if (doneAt && chance(`${id}:time:${i}`) < 0.55) {
          const minutes = Math.max(10, Math.round(minutesFor[t.key] * (0.4 + chance(`${id}:minutes:${i}`)) / 5) * 5);
          addTime(work, id, preparer, doneAt + 20 * 60_000, minutes, label);
        }
      });
      if (submitted) audit(preparer, 'job.submitted', id, '', submitted);
      if (signed) {
        addTime(work, id, reviewer, signed - 30 * 60_000, Math.round(minutesFor[t.key] * 0.4 / 5) * 5, 'Review and sign-off');
        audit(reviewer, 'job.signed_off', id, job.sign_off_note as string, signed);
      }
      previous = job;
    }
  }
  // One review came back this week; its real return event and note lift the Inbox exception.
  const returned = work.jobs.find(j => j.client_id === clients.harbour.id && j.template_id === engagements[0].template.id && j.status !== 'signed_off');
  if (returned) {
    const submitted = clock - 2 * DAY, back = clock - DAY;
    returned.status = 'open'; returned.submitted_at = iso(submitted); returned.submitted_by = returned.preparer_email;
    returned.signed_off_at = null; returned.signed_off_by = null; returned.sign_off_note = null;
    audit(String(returned.preparer_email), 'job.submitted', String(returned.id), '', submitted);
    audit(String(returned.reviewer_email), 'job.returned', String(returned.id), 'Please reconcile the sales-tax payable balance to the state account before resubmitting.', back);
  }
  // A waiting-client engagement has a genuine demo-suppressed reminder trail even early in a period.
  const waiting = work.jobs.find(j => j.client_id === clients.ironbark.id && j.status === 'open');
  if (waiting && !work.reminders.some(r => r.job_id === waiting.id)) {
    const outstanding = work.requests.filter(r => r.job_id === waiting.id && r.status === 'requested').map(r => r.label);
    if (outstanding.length) for (let n = 0; n < 2; n++) {
      const sent = clock - (5 - n * 3) * DAY;
      work.links.push({ id: fixedId(`waiting-link:${waiting.id}:${n}`), job_id: waiting.id, digest: '', created_by: waiting.preparer_email,
        created_at: iso(sent), expires_at: iso(sent + 30 * DAY), revoked_at: n === 0 ? iso(clock - 2 * DAY) : null });
      work.reminders.push({ id: fixedId(`waiting-reminder:${waiting.id}:${n}`), job_id: waiting.id, to_email: clients.ironbark.contactEmail,
        outstanding: JSON.stringify(outstanding), message: `Hello ${clients.ironbark.contactName},\n\nPlease send ${outstanding.join(', ')} for ${waiting.title}.\n\nUpload securely: {origin}/portal/…`,
        delivery: 'accepted by demo mail', sent_by: waiting.preparer_email, proposal_id: null, sent_at: iso(sent) });
      audit(String(waiting.preparer_email), 'reminder.sent', String(waiting.id), clients.ironbark.contactEmail, sent);
    }
  }
  // The activity log keeps its most recent entries: the screen shows the latest 100.
  work.audit = work.audit.sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 160);
  return work;
}

function addTime(work: Work, jobId: string, person: string, ms: number, minutes: number, description: string) {
  const rate = rates.get(person) ?? 0, entryId = fixedId(`time:${jobId}:${person}:${ms}`);
  work.time.push({ id: entryId, job_id: jobId, person_email: person, date: localDay(ms), currency: 'USD', minutes, rate_cents: rate, amount_cents: amount(minutes, rate), rate_source: 'staff', rate_card_id: fixedId('rate:' + person),
    description, created_by: person, created_channel: 'person', created_at: iso(ms) });
  work.audit.push({ id: fixedId(`audit:time:${entryId}`), actor: person, action: 'time.added', object_id: entryId, detail: `${minutes} min`, at: iso(ms) });
  // The sample practice's time is submitted and approved (by Riley, or Priya for Riley's own), so it is ready to bill.
  const approver = person === 'riley@morganco.example' ? 'priya@morganco.example' : 'riley@morganco.example';
  work.timeStatus.push({ entry_id: entryId, person_email: person, week_start: weekStart(String(work.time.at(-1)!.date)), status: 'approved', submitted_at: iso(ms), reason: '', decided_by: approver, decided_at: iso(ms) });
}

/** The file a client sends for a request: a CSV register or a one-page PDF. */
function document(e: Engagement, label: string, period: string, start: string, end: string, i: number) {
  const slug = label.toLowerCase().split(/[^a-z]+/).filter(Boolean).slice(0, 2).join('-'), when = `${MONTHS[Number(start.slice(5, 7)) - 1].toLowerCase()}-${start.slice(0, 4)}`;
  if (/statement|register|timesheet|bank/i.test(label) && i % 2 === 0) {
    const rows: (string | number)[][] = [['date', 'description', 'amount_usd']];
    for (let n = 0; n < 6; n++) rows.push([addMonths(start, 0).slice(0, 8) + String(3 + n * 4).padStart(2, '0'), ['Card sales', 'Supplier payment', 'Transfer', 'Rent', 'Wages', 'Utilities'][n], ((chance(`${e.client.name}:${start}:${n}`) * 4000 - 1500)).toFixed(2)]);
    return { name: `${slug}-${when}.csv`, mime: 'text/csv', bytes: csv(rows) };
  }
  return { name: `${slug}-${when}.pdf`, mime: 'application/pdf', bytes: pdf([e.client.name, `${label}`, `Period ${period} (${start} to ${end})`, 'Sample document for the Blotter demo.']) };
}

