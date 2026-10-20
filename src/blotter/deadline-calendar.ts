// Deadline date arithmetic (DUE-001, DUE-003): due-date specs, US legal
// holidays and the next-business-day rule. Dates are plain YYYY-MM-DD civil
// dates; no time zone applies.
import { Fault } from './model';

export type DueSpec =
  | { type: 'after-period-end'; months: number; day: number | 'last' }
  | { type: 'installments'; offsets: number[]; day: number }
  | { type: 'fixed'; month: number; day: number }
  | { type: 'days-after-period-end'; days: number }
  | { type: 'nth-weekday'; n: number; weekday: number; months: number };

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (y: number, m: number, d: number) => { const t = new Date(Date.UTC(y, m - 1, d)); return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`; };
const parts = (value: string) => value.split('-').map(Number) as [number, number, number];
const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const weekday = (value: string) => new Date(value + 'T00:00:00Z').getUTCDay();
export const addDays = (value: string, days: number) => { const [y, m, d] = parts(value); return iso(y, m, d + days); };
/** The month `months` after the month of `value`, on `day` (or its last day). */
function monthAfter(value: string, months: number, day: number | 'last') {
  const [y, m] = parts(value), t = new Date(Date.UTC(y, m - 1 + months, 1)), year = t.getUTCFullYear(), month = t.getUTCMonth() + 1;
  return iso(year, month, day === 'last' ? lastDay(year, month) : Math.min(day, lastDay(year, month)));
}
function nthWeekday(year: number, month: number, n: number, day: number) {
  if (n === -1) { const last = lastDay(year, month), back = (weekday(iso(year, month, last)) - day + 7) % 7; return iso(year, month, last - back); }
  const first = (day - weekday(iso(year, month, 1)) + 7) % 7 + 1, date = first + (n - 1) * 7;
  if (date > lastDay(year, month)) throw new Fault(`There is no weekday number ${n} in that month`, 400);
  return iso(year, month, date);
}

/** A holiday on a Saturday is observed the Friday before, on a Sunday the Monday after (5 U.S.C. 6103, Executive Order 11582). */
const observed = (value: string) => weekday(value) === 6 ? addDays(value, -1) : weekday(value) === 0 ? addDays(value, 1) : value;
/** Federal legal holidays (5 U.S.C. 6103) and, for federal deadlines, DC Emancipation Day (26 U.S.C. 7503). */
export function holidays(year: number, federal: boolean) {
  const list: [string, string][] = [
    [observed(iso(year, 1, 1)), "New Year's Day"], [nthWeekday(year, 1, 3, 1), 'Martin Luther King Jr. Day'], [nthWeekday(year, 2, 3, 1), "Washington's Birthday"],
    [nthWeekday(year, 5, -1, 1), 'Memorial Day'], [observed(iso(year, 6, 19)), 'Juneteenth'], [observed(iso(year, 7, 4)), 'Independence Day'],
    [nthWeekday(year, 9, 1, 1), 'Labor Day'], [nthWeekday(year, 10, 2, 1), 'Columbus Day'], [observed(iso(year, 11, 11)), 'Veterans Day'],
    [nthWeekday(year, 11, 4, 4), 'Thanksgiving Day'], [observed(iso(year, 12, 25)), 'Christmas Day'],
    // New Year's Day of the next year observed on 31 December.
    ...(weekday(iso(year + 1, 1, 1)) === 6 ? [[iso(year, 12, 31), "New Year's Day (observed)"] as [string, string]] : []),
  ];
  if (federal) list.push([observed(iso(year, 4, 16)), 'DC Emancipation Day']);
  return new Map(list);
}
/** A date on a weekend or legal holiday moves to the next business day; the reasons are kept. */
export function nextBusinessDay(value: string, federal: boolean) {
  let date = value; const reasons: string[] = [];
  for (;;) {
    const day = weekday(date), holiday = holidays(parts(date)[0], federal).get(date);
    if (day === 6 || day === 0) reasons.push(`${date} is a ${day === 6 ? 'Saturday' : 'Sunday'}`);
    else if (holiday) reasons.push(`${date} is ${holiday}`);
    else return { date, note: reasons.length ? `${reasons.join('; ')}: moved to the next business day ${date}` : '' };
    date = addDays(date, 1);
  }
}
/** The latest business day on or before `value` (for internal target dates). */
export function businessDayOnOrBefore(value: string, federal: boolean) {
  let date = value;
  while (weekday(date) === 6 || weekday(date) === 0 || holidays(parts(date)[0], federal).has(date)) date = addDays(date, -1);
  return date;
}

/** The unshifted date a spec gives for the period from `start` to `end` (inclusive), the period being one of `periods` per tax year starting `yearStart`. */
export function statutoryDate(spec: DueSpec, start: string, end: string, yearStart: string) {
  switch (spec.type) {
    case 'after-period-end': return monthAfter(end, spec.months, spec.day);
    case 'installments': {
      const [sy, sm] = parts(yearStart), [py, pm] = parts(start), index = Math.floor(((py - sy) * 12 + pm - sm) / 3);
      if (index < 0 || index >= spec.offsets.length) throw new Fault('This period is outside the tax year of the obligation', 400);
      return monthAfter(yearStart, spec.offsets[index], spec.day);
    }
    case 'fixed': { const [y] = parts(end); const same = iso(y, spec.month, Math.min(spec.day, lastDay(y, spec.month))); return same > end ? same : iso(y + 1, spec.month, Math.min(spec.day, lastDay(y + 1, spec.month))); }
    case 'days-after-period-end': return addDays(end, spec.days);
    case 'nth-weekday': { const [y, m] = parts(monthAfter(end, spec.months, 1)); return nthWeekday(y, m, spec.n, spec.weekday); }
  }
}
