import type { AuditRow } from '../modules/agent-door/audit';

export interface ActivityAgent {
 id: string; name: string; specialist: string | null;
 sponsor: { id: string; name: string }; revoked: boolean;
}
export interface ActivityFilter { agent: string; class: string }
interface AuditPage { rows: AuditRow[]; cursor: string | null }

/** Read only the signed person's shared door; never cache private audit pages. */
export async function activityRead<T>(path: string, signal: AbortSignal): Promise<T> {
 const response = await fetch(path, { credentials: 'same-origin', cache: 'no-store', signal });
 if (!response.ok) throw new Error(response.status === 401 || response.status === 403
  ? 'Activity access is unavailable. Sign in with a current Business policy role.'
  : 'Activity could not be loaded. Try again.');
 return response.json() as Promise<T>;
}

/** The cursor counts raw rows, including rows hidden by the selected filters. */
export async function activityRows(filter: ActivityFilter, signal: AbortSignal): Promise<AuditRow[]> {
 const rows: AuditRow[] = [];
 let after = '0';
 for (;;) {
  signal.throwIfAborted();
  const query = new URLSearchParams({ after });
  if (filter.agent) query.set('agent', filter.agent);
  if (filter.class) query.set('class', filter.class);
  const page = await activityRead<AuditPage>('/agents/api/audit?' + query, signal);
  if (!Array.isArray(page.rows) || (page.cursor !== null && !/^\d+$/.test(page.cursor))) {
   throw new Error('Activity returned an invalid page. No file was downloaded.');
  }
  const next = page.cursor ?? after;
  if (BigInt(next) < BigInt(after) || (next === after && page.rows.length)) {
   throw new Error('Activity returned an invalid cursor. No file was downloaded.');
  }
  rows.push(...page.rows);
  if (BigInt(next) === BigInt(after)) return rows;
  after = next;
 }
}
