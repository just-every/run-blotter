// A live projection of recorded document downloads, never document contents or audit detail.
import { atomic, guard, id, insist, need, stmt, type Actor, type Data } from './model';
import { freshAccess } from './permissions';

const COVERAGE = 'Recorded successful document downloads only: staff, contact portal and document bearer. Not a complete access history; excludes sign-ins, other reads, failed attempts and activity before recording began. Bearers do not verify a person.';
function boundary(value: unknown, label: string) {
  insist(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value), `${label}: use YYYY-MM-DD`);
  const at = Date.parse(value + 'T00:00:00.000Z');
  insist(Number.isFinite(at) && new Date(at).toISOString().slice(0, 10) === value, `${label}: use a valid calendar date`);
  return at;
}
// Quote every field and neutralize spreadsheet formulas, including leading whitespace.
const cell = (value: unknown) => {
  let text = String(value ?? '');
  if (/^[\s\u0000-\u001f]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
};

export async function exportAccessLog(db: D1Database, actor: Actor, query: Data) {
  need(actor, 'owner');
  insist(actor.channel === 'person', 'Only the principal can export access logs', 403);
  await freshAccess(db, actor);
  const from = boundary(query.from, 'Start date'), through = boundary(query.to, 'End date');
  insist(through >= from && through < Date.parse('9999-12-31T00:00:00Z'), 'Choose an end date on or after the start, before 9999-12-31');
  const start = new Date(from).toISOString(), end = new Date(through + 86_400_000).toISOString();
  const filter = "action='file.downloaded' AND julianday(at)>=julianday(?) AND julianday(at)<julianday(?)";
  const since = new Date(Date.now() - 5 * 60_000).toISOString();
  const [confirmed, done] = guard(db, 'EXISTS(SELECT 1 FROM b_access_stepups WHERE session_id=? AND email=? AND verified_at>?)', actor.sessionId ?? '', actor.email, since);
  // Selection, current principal authority, fresh confirmation and export attribution share a snapshot.
  const result = await atomic(db, actor, [confirmed,
    stmt(db, `SELECT id,at,actor,action,object_id,
      CASE WHEN json_valid(detail) THEN CASE json_extract(detail,'$.channel')
        WHEN 'staff' THEN 'staff' WHEN 'contact_portal' THEN 'contact_portal' WHEN 'bearer' THEN 'bearer' ELSE 'not recorded' END
      ELSE 'not recorded' END channel FROM b_audit WHERE ${filter} ORDER BY julianday(at),id`, start, end),
    stmt(db, `INSERT INTO b_audit(id,actor,action,object_id,detail,at)
      SELECT ?,?,'security.access_log_exported','access-log',json_object('from',?,'endExclusive',?,'rows',count(*),'eventIds',json_group_array(id)),? FROM b_audit WHERE ${filter}`,
      id(), actor.email, start, end, new Date().toISOString(), start, end), done]);
  const header = ['event_id','occurred_at_utc','actor','action','resource_id','channel','identity','range_start_utc','range_end_exclusive_utc','recorded_coverage'];
  const body = (result[1].results as Data[]).map(row => [row.id,new Date(row.at).toISOString(),row.actor,row.action,row.object_id,row.channel,
    row.channel === 'staff' ? 'authenticated staff session' : row.channel === 'not recorded' ? 'not recorded' : 'bearer; identity not verified',start,end,COVERAGE]);
  return new Response([header,...body].map(row => row.map(cell).join(',')).join('\r\n') + '\r\n', {headers:{
    'content-type':'text/csv; charset=utf-8', 'content-disposition':`attachment; filename="access-log-${query.from}-through-${query.to}-UTC.csv"`,
    'cache-control':'no-store', 'x-content-type-options':'nosniff', 'referrer-policy':'no-referrer',
    'x-access-log-coverage':COVERAGE, 'x-access-log-start':start, 'x-access-log-end-exclusive':end,
  }});
}
