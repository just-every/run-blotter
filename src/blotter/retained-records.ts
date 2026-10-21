// ERASURE-002 restricted retained remainder (ct 22 Oct 2026). When a client is erased while a
// retained record still needs them, the legal name, taxpayer identifier and address stay sealed
// under the firm's vault key, never in plain rows. Ordinary surfaces show `Erased client <8 hex>`.
// The principal reads and exports the remainder only through this audited door.
import { clocks } from './retention-clock';
import { firmToday } from './client-retention';
import { openRemainder, sealRemainder, type VaultSite } from './vault';
import { atomic, audit, human, id, insist, need, now, rows, stmt, text, type Actor, type Data } from './model';

const ADDRESS = /address|street|suburb|city|state|postcode|zip|country/i;
/** The identity the remainder keeps: legal name, taxpayer identifier and address fields. Nothing else about the client survives. */
export async function identityOf(db: D1Database, client: Data) {
  const defs = await rows(db, 'SELECT key,label FROM b_client_fields'), values = JSON.parse(client.fields ?? '{}') as Data;
  const address = Object.fromEntries(defs.filter(d => ADDRESS.test(`${d.key} ${d.label}`) && values[d.key] != null && values[d.key] !== '').map(d => [d.label, String(values[d.key])]));
  return { legalName: String(client.name), taxpayerId: String(client.abn ?? ''), ssnLast4: String(client.ssn_last4 ?? ''), address };
}
export const sealIdentity = (db: D1Database, site: VaultSite, clientId: string, identity: Data) => sealRemainder(db, site, 'retained:' + clientId, identity);

/** Retained and held records a client erasure left, with their clocks. */
export async function remainder(db: D1Database, clientId: string) {
  const today = await firmToday(db), all = (await clocks(db)).filter(c => c.clientIds.includes(clientId));
  const files = await rows(db, `SELECT f.id,f.name,f.size,f.sha256,f.erased_at FROM b_files f JOIN b_jobs j ON j.id=f.job_id WHERE j.client_id=? ORDER BY f.uploaded_at,f.id`, clientId);
  return { today, records: all.map(c => ({ ...c, status: c.expiry < today ? 'past its date: ready to erase unless held or retained further' : `kept until ${c.expiry}` })), files };
}

/** Read or export the sealed remainder. A reason is required; every use is logged. */
export async function retainedRecords(db: D1Database, actor: Actor, site: VaultSite, clientId: string, body: Data) {
  human(actor); need(actor, 'owner');
  const row = await stmt(db, 'SELECT sealed,erasure_id,at FROM b_retained_identity WHERE client_id=?', clientId).first<Data>();
  insist(row, 'This client has no restricted retained remainder', 404);
  const action = body.action === 'export' ? 'export' : 'read', reason = text(body.reason, 'Reason for reading retained records', 1000);
  const identity = await openRemainder<Data>(db, site, 'retained:' + clientId, row.sealed);
  await atomic(db, actor, [
    stmt(db, 'INSERT INTO b_retained_reads(id,client_id,action,actor,reason,at) VALUES(?,?,?,?,?,?)', id(), clientId, action, actor.email, reason, now()),
    audit(db, actor, `retained.${action}`, clientId, reason)]);
  return { clientId, erasureId: row.erasure_id, erasedAt: row.at, identity, ...await remainder(db, clientId),
    reads: await rows(db, 'SELECT action,actor,reason,at FROM b_retained_reads WHERE client_id=? ORDER BY at,id', clientId) };
}
