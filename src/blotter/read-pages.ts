// API-002's native-session read pages. Cursors carry position, never authority.
import { listJobs, parseFilters } from './filters';
import { email, Fault, insist, integer, rows, type Actor, type Data } from './model';
import { timeEntryFields, timeEntryFrom } from './timesheets';

type Position = [string, string, string];
type Route = 'work' | 'time';
const cursorError = 'Invalid cursor; restart with the same route, filters and staff session role';
const limitFor = (query: Data) => query.limit === undefined ? 50 : integer(query.limit, 'Limit', 1, 100);

function checkedDate(value: unknown, label: string) {
  insist(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value), `${label}: use a valid YYYY-MM-DD date`);
  const parsed = new Date(value + 'T00:00:00Z');
  insist(Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value, `${label}: use a valid YYYY-MM-DD date`);
  return value;
}

function encode(value: unknown) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  return btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join('')).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function position(query: Data, route: Route, filters: Data, actor: Actor): Position | null {
  if (query.cursor === undefined) return null;
  const raw = query.cursor;
  insist(typeof raw === 'string' && raw.length > 0 && raw.length <= 8192 && /^[A-Za-z0-9_-]+$/.test(raw), cursorError);
  let cursor: Data;
  try {
    const binary = atob(raw.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - raw.length % 4) % 4));
    cursor = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(binary, char => char.charCodeAt(0))));
  } catch { throw new Fault(cursorError); }
  insist(cursor && typeof cursor === 'object' && !Array.isArray(cursor) && encode(cursor) === raw, cursorError);
  insist(Object.keys(cursor).sort().join(',') === 'actor,after,filters,route,v' && cursor.v === 1 && cursor.route === route, cursorError);
  insist(cursor.actor?.email === actor.email && cursor.actor?.role === actor.role, cursorError);
  insist(JSON.stringify(cursor.filters) === JSON.stringify(filters), cursorError);
  insist(Array.isArray(cursor.after) && cursor.after.length === 3 && cursor.after.every((part: unknown) => typeof part === 'string' && part.length > 0 && part.length <= 1000), cursorError);
  checkedDate(cursor.after[0], 'Cursor date');
  if (route === 'time') insist(Number.isFinite(Date.parse(cursor.after[1])) && /^\d{4}-\d{2}-\d{2}T/.test(cursor.after[1]), cursorError);
  return cursor.after as Position;
}

const next = (route: Route, filters: Data, after: Position, actor: Actor) => encode({ v: 1, route, filters, after, actor: { email: actor.email, role: actor.role } });
const workPosition = (item: Data): Position => [item.due_date, item.client_name, item.id];
const compare = (left: Position, right: Position) => {
  for (let i = 0; i < left.length; i++) {
    if (left[i] < right[i]) return -1;
    if (left[i] > right[i]) return 1;
  }
  return 0;
};

/** Current authorized queue, with an explicit id tie-break and a bounded response. */
export async function workPage(db: D1Database, actor: Actor, query: Data) {
  for (const key of ['dueFrom', 'dueTo']) if (query[key]) checkedDate(typeof query[key] === 'string' ? query[key].trim() : query[key], key);
  const limit = limitFor(query), filters = parseFilters(query), after = position(query, 'work', filters, actor);
  // listJobs re-runs readableJobSql, including named-task access, on every page.
  const jobs = (await listJobs(db, actor, filters)).sort((a, b) => compare(workPosition(a), workPosition(b)));
  const remaining = after ? jobs.filter(item => compare(workPosition(item), after) > 0) : jobs;
  const items = remaining.slice(0, limit);
  return { items, nextCursor: remaining.length > limit ? next('work', filters, workPosition(items[items.length - 1]), actor) : null };
}

/** SQL keyset pagination preserves timesheets' lead/all and preparer/own scope. */
export async function timePage(db: D1Database, actor: Actor, query: Data) {
  const limit = limitFor(query);
  const filters = {
    from: query.from === undefined ? '' : checkedDate(query.from, 'From'),
    to: query.to === undefined ? '' : checkedDate(query.to, 'To'),
    person: query.person === undefined ? '' : email(query.person, 'Person'),
  };
  insist(!filters.from || !filters.to || filters.from <= filters.to, 'From must be on or before to');
  const after = position(query, 'time', filters, actor);
  const where = ['(? OR t.person_email=?)'], params: unknown[] = [actor.role !== 'preparer' ? 1 : 0, actor.email];
  if (filters.from) { where.push('t.date>=?'); params.push(filters.from); }
  if (filters.to) { where.push('t.date<=?'); params.push(filters.to); }
  if (filters.person) { where.push('t.person_email=?'); params.push(filters.person); }
  if (after) {
    where.push('(t.date<? OR (t.date=? AND t.created_at<?) OR (t.date=? AND t.created_at=? AND t.id<?))');
    params.push(after[0], after[0], after[1], after[0], after[1], after[2]);
  }
  const entries = await rows(db, `SELECT ${timeEntryFields},t.created_at ${timeEntryFrom}
    WHERE ${where.join(' AND ')} ORDER BY t.date DESC,t.created_at DESC,t.id DESC LIMIT ?`, ...params, limit + 1);
  const items = entries.slice(0, limit), last = items[items.length - 1];
  return { items, nextCursor: entries.length > limit ? next('time', filters, [last.date, last.created_at, last.id], actor) : null };
}
