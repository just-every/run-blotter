// The practice's recurring work around `now`: for each engagement, a short
// chain of signed-off periods, the current period in whatever state its due
// date suggests, and the next period once the current one is rolled forward.
// Labels and calendar steps come from Blotter's own jobs.ts; nothing here
// computes a tax due date: each engagement's recorded due day is a person's note.
import { addMonths, periodLabel } from '../jobs';
import { amount } from '../billing';
import { chance, fixedId } from './ids';
import { base64, csv, pdf } from './files';
import { engagements, principal, team, type Engagement } from './practice';

const DAY = 86_400_000, HOUR = 3_600_000;
const STEP = { monthly: 1, quarterly: 3, annual: 12 } as const;
const HISTORY = { monthly: 2, quarterly: 1, annual: 1 } as const;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const day = (iso: string) => iso.slice(0, 10);
const at = (date: string, hour = 9) => Date.parse(`${date}T00:00:00Z`) + (hour - 10) * HOUR; // Sydney office hours, as UTC
const iso = (ms: number) => new Date(ms).toISOString();
const between = (from: number, to: number, f: number) => Math.round(from + (to - from) * Math.min(1, Math.max(0, f)));
const lastDay = (start: string, months: number) => day(new Date(Date.parse(addMonths(start, months) + 'T00:00:00Z') - DAY).toISOString());

/** The due date the practice recorded for a period, following each engagement's note. */
export function dueDate(e: Engagement, start: string) {
  const [, m] = start.split('-').map(Number);
  const on = (months: number, dayOfMonth: number) => addMonths(start, months).slice(0, 8) + String(dayOfMonth).padStart(2, '0');
  switch (e.template.key) {
    case 'close': return on(1, 12);
    case 'payroll': return on(0, 28);
    case 'bas': return m === 10 ? on(4, 28) : e.dueNote.startsWith('ATO') ? on(4, 25) : on(3, 28);
    case 'company': return on(22, 15);
    default: return on(20, 31);
  }
}
function periodStart(recurrence: keyof typeof STEP, date: string) {
  const [y, m] = date.split('-').map(Number);
  if (recurrence === 'monthly') return `${y}-${String(m).padStart(2, '0')}-01`;
  if (recurrence === 'quarterly') return `${y}-${String(m - (m - 1) % 3).padStart(2, '0')}-01`;
  return `${m >= 7 ? y : y - 1}-07-01`;
}

export type Row = Record<string, unknown>;
export type Work = ReturnType<typeof emptyWork>;
const emptyWork = () => ({
  jobs: [] as Row[], steps: [] as Row[], requests: [] as Row[], files: [] as Row[], links: [] as Row[],
  reminders: [] as Row[], time: [] as Row[], audit: [] as Row[],
});

const rates = new Map<string, number>(team.map(m => [m.email, m.rateCents]));
const notes = ['Bank reconciled; GST coding checked.', 'Reconciled to statements; nothing unusual.', 'Checked against last period; variances explained.', 'Tied out to source documents. Good to go.', 'Reviewed. Two coding fixes made with the preparer.'];
const nudges = ['Just the last few documents to go, thank you!', 'Could you send these by Friday so we can finish on time?', ''];
const minutesFor = { bas: 55, close: 70, payroll: 35, company: 110, individual: 45 } as Record<string, number>;

export function practiceWork(now: Date, owner: { id: string; email: string }) {
  const work = emptyWork(), clock = now.getTime(), today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Sydney' }).format(now);
  rates.set(owner.email, principal.rateCents);
  const who = (person: string) => person === 'owner' ? owner.email : person;
  // People work office hours: a moment's place in its Sydney day maps into 8:30 to 17:30 (order kept).
  const office = (ms: number) => { const midnight = Math.floor((ms + 10 * HOUR) / DAY) * DAY - 10 * HOUR, mapped = Math.round(midnight + (8.5 + (ms - midnight) / DAY * 9) * HOUR); return mapped < clock - 10 * 60_000 ? mapped : ms; };
  const audit = (actor: string, action: string, objectId: string, detail: string, ms: number) =>
    work.audit.push({ id: fixedId(`audit:${action}:${objectId}:${ms}`), actor, action, object_id: objectId, detail, at: iso(ms) });
  // Two jobs that tell a story: one stuck waiting on the client, one signed off but not yet rolled forward.
  const stuck = 'Ironbark Landscaping', unrolled = 'Fig Tree Dental Pty Ltd:close';

  for (const e of engagements) {
    const t = e.template, recurrence = t.recurrence, key = `${e.client.name}:${t.key}`;
    const preparer = who(e.preparer), reviewer = who(e.reviewer);
    // The current period: the first whose due date is no more than six days past.
    let current = periodStart(recurrence, today);
    while (dueDate(e, addMonths(current, -STEP[recurrence])) >= day(iso(at(today) - 6 * DAY))) current = addMonths(current, -STEP[recurrence]);
    const isStuck = e.client.name === stuck && t.key === 'bas';
    const first = addMonths(current, -STEP[recurrence] * HISTORY[recurrence]);
    let previous: Row | undefined, start = first;
    for (let n = 0; ; n++, start = addMonths(start, STEP[recurrence])) {
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
      else if (history) { status = 'signed_off'; progress = 1; }
      else if (!isCurrent) { status = 'open'; progress = 0; }
      else if (daysLeft < 0) { status = r < 0.5 ? 'signed_off' : r < 0.85 ? 'review' : 'open'; progress = status === 'open' ? 0.7 : 1; }
      else if (daysLeft <= 14) { status = r < 0.3 ? 'signed_off' : r < 0.6 ? 'review' : 'open'; progress = status === 'open' ? 0.45 + r * 0.4 : 1; }
      else { status = 'open'; progress = Math.max(0, Math.min(0.85, 0.15 + 0.7 * r - daysLeft / 300)); }
      if (key === unrolled && isCurrent) status = 'signed_off', progress = 1;
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
      }
      const finish = status === 'open' ? Math.max(begin, workEnd) : submitted;
      const job: Row = {
        id, client_id: e.client.id, template_id: t.id, title: t.name, period_start: start, period_label: periodLabel(start, recurrence),
        due_date: due, due_note: e.dueNote, preparer_email: preparer, reviewer_email: reviewer, status, fee_cents: t.feeCents,
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
  // The activity log keeps its most recent entries: the screen shows the latest 100.
  work.audit = work.audit.sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 160);
  return work;
}

function addTime(work: Work, jobId: string, person: string, ms: number, minutes: number, description: string) {
  const rate = rates.get(person) ?? 0, entryId = fixedId(`time:${jobId}:${person}:${ms}`);
  work.time.push({ id: entryId, job_id: jobId, person_email: person, date: day(iso(ms + 10 * HOUR)), minutes, rate_cents: rate, amount_cents: amount(minutes, rate),
    description, created_by: person, created_channel: 'person', created_at: iso(ms) });
  work.audit.push({ id: fixedId(`audit:time:${entryId}`), actor: person, action: 'time.added', object_id: entryId, detail: `${minutes} min`, at: iso(ms) });
}

/** The file a client sends for a request: a CSV register or a one-page PDF. */
function document(e: Engagement, label: string, period: string, start: string, end: string, i: number) {
  const slug = label.toLowerCase().split(/[^a-z]+/).filter(Boolean).slice(0, 2).join('-'), when = `${MONTHS[Number(start.slice(5, 7)) - 1].toLowerCase()}-${start.slice(0, 4)}`;
  if (/statement|register|timesheet|bank/i.test(label) && i % 2 === 0) {
    const rows: (string | number)[][] = [['date', 'description', 'amount']];
    for (let n = 0; n < 6; n++) rows.push([addMonths(start, 0).slice(0, 8) + String(3 + n * 4).padStart(2, '0'), ['Card sales', 'Supplier payment', 'Transfer', 'Rent', 'Wages', 'Utilities'][n], ((chance(`${e.client.name}:${start}:${n}`) * 4000 - 1500)).toFixed(2)]);
    return { name: `${slug}-${when}.csv`, mime: 'text/csv', bytes: csv(rows) };
  }
  return { name: `${slug}-${when}.pdf`, mime: 'application/pdf', bytes: pdf([e.client.name, `${label}`, `Period ${period} (${start} to ${end})`, 'Sample document for the Blotter demo.']) };
}

