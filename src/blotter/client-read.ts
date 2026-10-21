import { clientScopeSql, clientScopeParams } from './access-sql';
// Native client-list fields and visibility, shared by the workspace and API pages.
import { readableJobParams, readableJobSql, rows, type Actor, type Data } from './model';

export type ClientPosition = [string, string];

/** Leads see every unmerged client; preparers need a currently readable job. */
export async function readClients(db: D1Database, actor: Actor, options: { client?: string; after?: ClientPosition | null; limit?: number } = {}): Promise<Data[]> {
  const where = ['c.merged_into IS NULL',clientScopeSql('c.id')], params: unknown[] = [...clientScopeParams(actor)];
  if (actor.role === 'preparer') {
    where.push(`EXISTS(SELECT 1 FROM b_jobs WHERE b_jobs.client_id=c.id AND ${readableJobSql})`);
    params.push(...readableJobParams(actor));
  }
  if (options.client) { where.push('c.id=?'); params.push(options.client); }
  if (options.after) {
    where.push('(c.name>? OR (c.name=? AND c.id>?))');
    params.push(options.after[0], options.after[0], options.after[1]);
  }
  if (options.limit !== undefined) params.push(options.limit);
  const clients = await rows(db, `SELECT c.* FROM b_clients c WHERE ${where.join(' AND ')}
    ORDER BY c.name,c.id${options.limit === undefined ? '' : ' LIMIT ?'}`, ...params);
  return clients.map((c: Data) => ({ ...c, ssn_last4: c.ssn_last4 ? '•••••' + c.ssn_last4 : '' }));
}
