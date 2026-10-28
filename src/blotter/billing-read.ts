// API-009: native billing history, with the existing reviewer financial boundary.
import { Fault, insist, integer, need, rows, type Actor, type Data } from './model';

type Position = [string, string];
const route = 'billing/exports';
const cursorError = 'Invalid cursor; restart with the same route, filters and staff session role';
const fields = `id,title,status,total_cents,csv_sha256,revision,prepared_by,prepared_channel,prepared_at,
  approved_by,approved_at,review_note,voided_by,void_reason,snapshot,
  COALESCE(json_extract(snapshot,'$.currency'),'AUD') currency`;

function day(value: unknown, label: string) {
  insist(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value), `${label}: use a valid YYYY-MM-DD date`);
  const parsed = new Date(value + 'T00:00:00Z');
  insist(Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value, `${label}: use a valid YYYY-MM-DD date`);
  return value;
}

function encode(value: unknown) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  return btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join('')).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function position(raw: unknown, filters: Data, actor: Actor): Position | null {
  if (raw === undefined) return null;
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
  insist(Array.isArray(cursor.after) && cursor.after.length === 2 && cursor.after.every((v: unknown) => typeof v === 'string' && v.length > 0 && v.length <= 1000), cursorError);
  insist(/^\d{4}-\d{2}-\d{2}T/.test(cursor.after[0]) && Number.isFinite(Date.parse(cursor.after[0])), cursorError);
  return cursor.after as Position;
}

/** Reads retain native financial authority; cursors only identify a position. */
export async function billingExportPage(db: D1Database, actor: Actor, query: Data) {
  insist(actor.channel === 'person', 'A native staff session is required', 403);
  need(actor, 'owner', 'reviewer');
  const limit = query.limit === undefined ? 50 : integer(query.limit, 'Limit', 1, 100);
  const filters = {
    status: query.status === undefined ? '' : query.status,
    from: query.from === undefined ? '' : day(query.from, 'From'),
    to: query.to === undefined ? '' : day(query.to, 'To'),
  };
  insist(query.status === undefined || ['draft', 'approved', 'void'].includes(filters.status), 'Status must be draft, approved or void');
  insist(!filters.from || !filters.to || filters.from <= filters.to, 'From must be on or before to');
  const after = position(query.cursor, filters, actor), where: string[] = [], params: unknown[] = [];
  if (filters.status) { where.push('status=?'); params.push(filters.status); }
  if (filters.from) { where.push('substr(prepared_at,1,10)>=?'); params.push(filters.from); }
  if (filters.to) { where.push('substr(prepared_at,1,10)<=?'); params.push(filters.to); }
  if (after) {
    where.push('(prepared_at<? OR (prepared_at=? AND id<?))');
    params.push(after[0], after[0], after[1]);
  }
  const exports = await rows(db, `SELECT ${fields} FROM b_exports ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY prepared_at DESC,id DESC LIMIT ?`, ...params, limit + 1);
  const items = exports.slice(0, limit), last = items[items.length - 1];
  // Historical snapshots without a currency predate USD support and retain AUD.
  const nextCursor = exports.length > limit ? encode({ v: 1, route, filters, after: [last.prepared_at, last.id], actor: { email: actor.email, role: actor.role } }) : null;
  return { items, nextCursor };
}
