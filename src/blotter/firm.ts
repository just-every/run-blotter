// US-001: firm configuration and the local clock used by work and staff alerts.
import { createBusinessSettings } from '../modules/business-settings/index.ts';
import { currency } from './currency';
import { atomic, audit, date, human, insist, lines, need, now, stmt, text, type Actor, type Data } from './model';

export const DEFAULT_FIRM = {
  currency: 'USD', ein: '', entity: 'LLC', address: '', city: '', state: '', zip: '',
  fiscalYearEnd: '12-31', services: ['Bookkeeping', 'Tax'], timeZone: 'America/New_York',
  notificationStart: '00:00', notificationEnd: '00:00', calendars: [] as Data[],
};
export async function firmSettings(db: D1Database) {
  const f = await stmt(db, 'SELECT name,settings FROM b_firm WHERE id=1').first<Data>();
  const settings = createBusinessSettings({ db, business: { settings: 1, values: ['display_name'] } });
  return { ...DEFAULT_FIRM, ...JSON.parse(f?.settings ?? '{}'), name: await settings.resolve('display_name', f?.name ?? '') };
}
export async function readFirm(db: D1Database, actor: Actor) { need(actor, 'owner'); return firmSettings(db); }
export const firmCurrency = async (db: D1Database, value: unknown) => currency(value ?? (await firmSettings(db)).currency);
const clock = (value: unknown, label: string) => {
  const v = text(value, label, 5); insist(/^([01]\d|2[0-3]):[0-5]\d$/.test(v), `${label}: use HH:MM`); return v;
};
const US_STATES = new Set('AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY AS GU MP PR VI'.split(' '));
export async function saveFirm(db: D1Database, actor: Actor, body: Data) {
  human(actor); need(actor, 'owner');
  const name = text(body.name, 'Firm name', 200), ein = text(body.ein, 'Firm EIN', 20).replace(/[\s-]/g, '');
  insist(/^\d{9}$/.test(ein), 'Firm EIN must have nine digits');
  const entity = text(body.entity, 'Entity classification', 60);
  insist(['Sole proprietor', 'LLC', 'Partnership', 'S corporation', 'C corporation', 'Nonprofit', 'Trust'].includes(entity), 'Choose an entity classification');
  const state = text(body.state, 'State or territory', 2).toUpperCase(), zip = text(body.zip, 'ZIP code', 10);
  insist(US_STATES.has(state), 'Use a US state or territory abbreviation');
  insist(/^\d{5}(-\d{4})?$/.test(zip), 'Use a five-digit ZIP or ZIP+4');
  const fiscalYearEnd = text(body.fiscalYearEnd, 'Fiscal year end', 5);
  date('2024-' + fiscalYearEnd, 'Fiscal year end');
  const timeZone = text(body.timeZone, 'Time zone', 100);
  try { new Intl.DateTimeFormat('en-US', { timeZone }).format(); } catch { insist(false, 'Use a valid IANA time zone'); }
  const services = lines(body.services, 'Service lines', 30);
  insist(Array.isArray(body.calendars) && body.calendars.length <= 100, 'Supply at most 100 recorded filing dates');
  const calendars = body.calendars.map((c: Data) => {
    insist(c && typeof c === 'object' && !Array.isArray(c), 'Each filing date is an object');
    return ({
    name: text(c.name, 'Filing calendar name', 120), jurisdiction: text(c.jurisdiction, 'Jurisdiction', 120),
    dueDate: date(c.dueDate, 'Filing date'), source: text(c.source, 'Date source', 500),
  }); });
  const settings = { currency: currency(body.currency), ein, entity, address: text(body.address, 'Street address', 200), city: text(body.city, 'City', 100), state, zip,
    fiscalYearEnd, services, timeZone, notificationStart: clock(body.notificationStart, 'Notification start'), notificationEnd: clock(body.notificationEnd, 'Notification end'), calendars };
  await atomic(db, actor, [stmt(db, `INSERT INTO b_firm(id,name,set_by,set_at,settings) VALUES(1,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,set_by=excluded.set_by,set_at=excluded.set_at,settings=excluded.settings`,
    name, actor.email, now(), JSON.stringify(settings)), audit(db, actor, 'firm.configured', 'firm', `${timeZone}; ${settings.currency}; ${calendars.length} recorded filing dates`)]);
  return { name, ...settings };
}
/** Date-only deadlines never shift; instants use the chosen zone and its DST rules. */
export function localClock(settings: Data, at: Date) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: settings.timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZoneName: 'short' }).formatToParts(at).map(p => [p.type, p.value]));
  const localDate = `${parts.year}-${parts.month}-${parts.day}`, localTime = `${parts.hour}:${parts.minute}`;
  const start = settings.notificationStart, end = settings.notificationEnd;
  const notificationsAllowed = start === end || (start < end ? localTime >= start && localTime < end : localTime >= start || localTime < end);
  return { at: at.toISOString(), localDate, localTime, zone: parts.timeZoneName, timeZone: settings.timeZone, notificationsAllowed };
}
export async function firmClock(db: D1Database, actor: Actor, at?: string) {
  need(actor, 'owner'); const instant = at ? new Date(at) : new Date(); insist(Number.isFinite(instant.getTime()), 'Use a valid instant');
  return localClock(await firmSettings(db), instant);
}
