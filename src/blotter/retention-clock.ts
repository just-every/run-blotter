import {signatureClocks} from './signatures-retention';
import { invoiceClocks } from './invoices-erasure';
// ERASURE-008 retention clocks (ct 22 Oct 2026). Each retained record class has a period in
// whole years (default 7, minimum 1; SIGN-003's IRS e-file authorizations at least 3) and a
// clock computed from the dates its own records carry, as a calendar date in the firm's time
// zone. A changed period recomputes every unerased record on the next read and never revives
// an erased one. Nothing here expires, deletes or sends anything.
import { firmSettings } from './firm';
import { atomic, audit, human, insist, need, now, rows, stmt, text, type Actor, type Data } from './model';

export const RETAINED_CLASSES = ['signed_work', 'engagement', 'efile_auth', 'signed_documents', 'billing'] as const;
export type RetainedClass = typeof RETAINED_CLASSES[number];
export const CLASS_LABELS: Record<RetainedClass, string> = {
  signed_work: 'Signed-off work', engagement: 'Signed engagements', efile_auth: 'IRS e-file authorizations (SIGN-001)',
  signed_documents: 'Signed documents (SIGN-002)', billing: 'Billing evidence',
};
export const DEFAULT_YEARS = 7;
const FLOOR: Partial<Record<RetainedClass, number>> = { efile_auth: 3 };
export const minimumYears = (cls: RetainedClass) => FLOOR[cls] ?? 1;

/** Shown beside any period below the default. No legal adequacy of any period is asserted. */
export const PERIOD_WARNING = {
  statute: 'IRC §6107(b) requires a return preparer to keep a copy or list of each return prepared for three years after the close of the return period.',
  publication583: [
    'Generally 3 years from the date the return was filed (IRS Publication 583).',
    '6 years if income was under-reported by more than 25 percent.',
    '7 years for a claim for a loss from worthless securities or a bad-debt deduction.',
    'Indefinitely if no return was filed or the return was fraudulent.',
    '4 years after the tax is due or paid for employment tax records.',
  ],
  notice: 'Blotter asserts no legal adequacy of any period.',
};

export async function periods(db: D1Database) {
  const set = new Map((await rows(db, 'SELECT class,years,reason,set_by,set_at FROM b_retention_periods')).map(r => [String(r.class), r]));
  return RETAINED_CLASSES.map(cls => {
    const row = set.get(cls), years = Number(row?.years ?? DEFAULT_YEARS);
    return { class: cls, label: CLASS_LABELS[cls], years, minimum: minimumYears(cls), isDefault: !row, setBy: row?.set_by ?? null, setAt: row?.set_at ?? null, reason: row?.reason ?? null,
      warning: years < DEFAULT_YEARS ? PERIOD_WARNING : null };
  });
}

export async function readPeriods(db: D1Database, actor: Actor) { human(actor); need(actor, 'owner'); return periods(db); }

export async function setPeriod(db: D1Database, actor: Actor, body: Data) {
  human(actor); need(actor, 'owner');
  const cls = body.class as RetainedClass;
  insist(RETAINED_CLASSES.includes(cls), 'Choose a retained record class');
  const years = body.years;
  insist(Number.isInteger(years) && years >= 1 && years <= 100, 'Use a whole number of years');
  insist(years >= minimumYears(cls), `${CLASS_LABELS[cls]} are kept at least ${minimumYears(cls)} years (SIGN-001 floor)`);
  const reason = text(body.reason, 'Reason', 1000), at = now();
  await atomic(db, actor, [
    stmt(db, `INSERT INTO b_retention_periods(class,years,reason,set_by,set_at) VALUES(?,?,?,?,?) ON CONFLICT(class) DO UPDATE SET years=excluded.years,reason=excluded.reason,set_by=excluded.set_by,set_at=excluded.set_at`, cls, years, reason, actor.email, at),
    audit(db, actor, 'retention.period', cls, `${years} years: ${reason}`)]);
  return (await periods(db)).find(p => p.class === cls)!;
}

/** The firm's calendar date for an instant. Date-only values are never shifted. */
export const localDate = (instant: string, timeZone: string) => new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(instant));
/** The same month and day `years` later; 29 February falls on 28 February in a common year. */
export function addYears(day: string, years: number) {
  const [y, m, d] = day.split('-').map(Number), target = y + years;
  const leap = (target % 4 === 0 && target % 100 !== 0) || target % 400 === 0;
  return `${String(target).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(m === 2 && d === 29 && !leap ? 28 : d).padStart(2, '0')}`;
}
const latest = (days: (string | null | undefined)[]) => days.filter((d): d is string => !!d).sort().at(-1) ?? null;

export type Clocked = { jobId?:string; kind: 'job' | 'engagement' | 'export' | 'invoice' | 'signature'; id: string; cls: RetainedClass; clientIds: string[]; label: string; clock: string; years: number; expiry: string };

/** Every retained record with its computed clock and expiry. Records past their date are listed by the expiry module, never erased here. */
export async function clocks(db: D1Database): Promise<Clocked[]> {
  const tz = (await firmSettings(db)).timeZone, years = Object.fromEntries((await periods(db)).map(p => [p.class, p.years]));
  const out: Clocked[] = [];
  const signOffs = await rows(db, "SELECT id,client_id,signed_off_at FROM b_jobs WHERE status='signed_off' AND signed_off_at IS NOT NULL");
  for (const j of await rows(db, `SELECT j.id,j.client_id,j.title,j.period_label,j.due_date,j.signed_off_at,d.extension_due,d.extension_recorded_at,d.filing_accepted_on
    FROM b_jobs j LEFT JOIN b_job_deadlines d ON d.job_id=j.id WHERE j.status='signed_off'`)) {
    const clock = latest([localDate(j.signed_off_at, tz), j.due_date, j.extension_recorded_at ? j.extension_due : null, j.filing_accepted_on])!;
    out.push({ kind: 'job', id: j.id, cls: 'signed_work', clientIds: [j.client_id], label: `${j.title} · ${j.period_label}`, clock, years: years.signed_work, expiry: addYears(clock, years.signed_work) });
  }
  for (const e of await rows(db, 'SELECT id,client_id,title,signed_date FROM b_engagements WHERE erased_at IS NULL')) {
    const after = signOffs.filter(j => j.client_id === e.client_id).map(j => localDate(j.signed_off_at, tz)).filter(d => d >= e.signed_date);
    const clock = latest([e.signed_date, ...after])!;
    out.push({ kind: 'engagement', id: e.id, cls: 'engagement', clientIds: [e.client_id], label: e.title, clock, years: years.engagement, expiry: addYears(clock, years.engagement) });
  }
  for (const x of await rows(db, "SELECT id,title,approved_at FROM b_exports WHERE status='approved'")) {
    const events: (string | null)[] = [localDate(x.approved_at, tz)];
    const time = await rows(db, `SELECT t.id,t.job_id,j.client_id FROM b_export_sources s JOIN b_time t ON s.source_key='time:'||t.id JOIN b_jobs j ON j.id=t.job_id WHERE s.export_id=?`, x.id);
    for (const a of await rows(db, `SELECT created_at FROM b_time_adjustments WHERE entry_id IN (SELECT substr(source_key,6) FROM b_export_sources WHERE export_id=? AND source_key LIKE 'time:%')`, x.id)) events.push(localDate(a.created_at, tz));
    const expenses = await rows(db, `SELECT e.client_id,e.decided_at,e.reimbursed_at FROM b_export_sources s JOIN b_expenses e ON s.source_key='exp:'||e.id WHERE s.export_id=?`, x.id);
    for (const e of expenses) events.push(e.decided_at ? localDate(e.decided_at, tz) : null, e.reimbursed_at ? localDate(e.reimbursed_at, tz) : null);
    const fees = await rows(db, `SELECT j.client_id FROM b_export_sources s JOIN b_jobs j ON s.source_key='fee:'||j.id WHERE s.export_id=?`, x.id);
    const clientIds = [...new Set([...time.map(r => r.client_id), ...expenses.map(r => r.client_id), ...fees.map(r => r.client_id)])] as string[];
    const clock = latest(events)!;
    out.push({ kind: 'export', id: x.id, cls: 'billing', clientIds, label: x.title, clock, years: years.billing, expiry: addYears(clock, years.billing) });
  }
  out.push(...await signatureClocks(db,tz,years.signed_documents));
  out.push(...await invoiceClocks(db,tz,years.billing));
  return out;
}
