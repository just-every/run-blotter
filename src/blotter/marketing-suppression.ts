// MSG-002 / ERASURE-002: the same one-way address key and cutoff at preview and commit.
import { sha256 } from '../modules/import-kit/src/d1/index';
import { insist, stmt } from './model';

export const suppressionDigest = (address: string) => sha256('blotter-suppression:v1:' + address.trim().toLowerCase());
export const allowedMarketingGrant = (address: string, actedAt: string) => ({
  sql: 'NOT EXISTS(SELECT 1 FROM b_erased_suppressions WHERE digest=? AND at>=?)',
  params: [suppressionDigest(address), actedAt],
});
export async function erasedAddress(db: D1Database, address: string, actedAt: string) {
  const p = allowedMarketingGrant(address, actedAt);
  return !(await stmt(db, `SELECT (${p.sql}) ok`, ...p.params).first<{ok:number}>())?.ok;
}
export async function refuseErasedAddress(db: D1Database, address: string, actedAt: string) {
  insist(!await erasedAddress(db, address, actedAt), 'This address withdrew consent before a client erasure. Record a grant only for an opt-in the person made after that erasure.', 409);
}
