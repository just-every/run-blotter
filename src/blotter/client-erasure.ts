import { agentCustodyClearSql } from './agent-door/custody'
import { noInvoiceOpenBalanceSql } from './invoices-sources';
// ERASURE-002 whole-client erasure (ct 22 Oct 2026): preview the classes, holds and named
// exceptions; erase only what the principal approves by digest, reason and the client's name;
// record the receipt (counts, no values); fence every older archive through native portability.
import { createPortability } from '@runeditrun/rer/modules/portability';
import policy from './archive-policy.mjs';
import { carrySql, digestsOf, fingerprintSql, plan } from './erasure-plan';
import { sealIdentity, identityOf } from './retained-records';
import { steps } from './erasure-scope';
import type { VaultSite } from './vault';
import { atomic, audit, guard, human, id, insist, need, now, rows, stmt, text, type Actor, type Data } from './model';

/** Triggers that forbid rewriting history; suspended only inside one approved erasure batch and recreated verbatim. */
export const GUARDS = ['b_deliverable_versions_immutable', 'b_expenses_immutable', 'b_marketing_consents_update', 'b_notice_events_immutable', 'b_notices_closed',
  'b_portal_items_closed', 'b_thread_messages_immutable', 'b_threads_resolved', 'b_time_immutable', 'b_clients_merged', 'b_client_merges_history'];

export async function erasurePreview(db: D1Database, actor: Actor, clientId: string) {
  human(actor); need(actor, 'owner');
  return (await plan(db, actor, clientId)).preview;
}

export async function eraseClient(db: D1Database, actor: Actor, site: VaultSite, clientId: string, body: Data) {
  human(actor); need(actor, 'owner');
  const p = await plan(db, actor, clientId);
  insist(p.blockers.length === 0, p.blockers[0] ?? 'Erasure is not allowed', 409);
  insist(body.planHash === p.planHash, 'The preview changed. Review the new preview and approve again.', 409);
  insist(body.confirm === p.client.name, 'Type the client name to confirm erasing it');
  const reason = text(body.reason, 'Erasure reason', 1000), erasureId = id();
  if (body.requestId) insist(await stmt(db, "SELECT 1 FROM b_deletion_requests WHERE id=? AND client_id=? AND subject_kind='client' AND erasure_id IS NULL", body.requestId, clientId).first(), 'Deletion request not found for this client', 404);
  const x = { ...p.x, reason }, list = steps(x, p.audited), service = await createPortability({ db, policy });
  const triggers = await rows(db, `SELECT name,sql FROM sqlite_master WHERE type='trigger' AND name IN (${GUARDS.map(() => '?').join(',')})`, ...GUARDS);
  const fp = p.fingerprint, [check, release] = guard(db, `EXISTS(SELECT 1 FROM b_clients WHERE id=? AND revision=? AND erased_at IS NULL) AND ${fingerprintSql} AND ${noInvoiceOpenBalanceSql} AND ${agentCustodyClearSql}`, clientId, p.client.revision, fp.marks, fp.periods,clientId,clientId);
  const batch: D1PreparedStatement[] = [check,
    stmt(db, `INSERT INTO b_client_erasures(id,client_id,client_ref,subject_kind,subject_id,request_id,reason,plan_hash,requested_by,approved_by,approved_at,counts,retained,journal_epoch) VALUES(?,?,?,'client',?,?,?,?,?,?,?,'{}','[]',0)`,
      erasureId, clientId, clientId.slice(0, 8), clientId, body.requestId ?? null, reason, p.planHash, actor.email, actor.email, x.at),
    ...triggers.map(t => stmt(db, `DROP TRIGGER ${t.name}`)),
    stmt(db, `INSERT INTO b_marketing_consents(id,contact_id,client_id,address,channel,kind,source,acted_at,recorded_at,actor,evidence)
      SELECT lower(hex(randomblob(16))),o.id,o.client_id,o.email,'email','withdraw','staff_reply',max(w.acted_at),?,?,'withdrawal carried over another client''s erasure' ${carrySql(x).from} GROUP BY o.id`, x.at, actor.email),
  ];
  // Only an address that withdrew consent is kept, as a one-way digest; a bounced address is dropped.
  const digests = x.held.client || x.held.classes.includes('contact') ? new Map() : await digestsOf(p.withdrawn);
  for (const [d, why] of digests) batch.push(stmt(db, 'INSERT INTO b_erased_suppressions(digest,reason,erasure_id,at) VALUES(?,?,?,?) ON CONFLICT(digest) DO UPDATE SET reason=excluded.reason,erasure_id=excluded.erasure_id,at=excluded.at WHERE excluded.at>b_erased_suppressions.at', d, why, erasureId, x.at));
  // The legal name, taxpayer identifier and address a retained record needs stay sealed, never in plain rows.
  if (p.remainder) batch.push(stmt(db, 'INSERT INTO b_retained_identity(client_id,sealed,erasure_id,at) VALUES(?,?,?,?)', clientId, await sealIdentity(db, site, clientId, await identityOf(db, p.client)), erasureId, x.at));
  for (const [n, step] of list.entries()) {
    batch.push(stmt(db, `INSERT INTO b_client_erasure_steps(erasure_id,ordinal,table_name,action,label,count) SELECT ?,?,?,?,?,count(*) FROM ${step.table} WHERE ${step.where}`, erasureId, n, step.table, step.action, step.label));
    if (step.action !== 'cascade') batch.push(stmt(db, step.action === 'delete' ? `DELETE FROM ${step.table} WHERE ${step.where}` : `UPDATE ${step.table} SET ${step.set} WHERE ${step.where}`));
  }
  if (body.requestId) batch.push(stmt(db, 'UPDATE b_deletion_requests SET erasure_id=? WHERE id=?', erasureId, body.requestId));
  batch.push(...triggers.map(t => stmt(db, String(t.sql))), ...await service.redactionStatements(), ...await service.invalidateTransfersStatements(),
    audit(db, actor, 'client.erased', clientId, `${clientId.slice(0, 8)}; ${reason}`), release);
  await atomic(db, actor, batch);
  const epoch = Number((await stmt(db, 'SELECT epoch FROM rer_portability_state WHERE id=1').first<Data>())?.epoch ?? 0);
  const record = { classes: p.classes.map(({ class: c, removed, marker, retained, held }) => ({ class: c, removed, marker, retained, held })), exceptions: p.retained, held: p.heldTotal,
    holds: p.marks.map(m => ({ id: m.id, scope: m.scope, class: m.class, kind: m.kind, owner: m.owner })), records: p.records.map(r => ({ kind: r.kind, class: r.cls, clock: r.clock, years: r.years, expiry: r.expiry })),
    externalCopies: [...p.copies.map(c => ({ kind: c.kind, system: c.system, holder: c.holder, status: c.closed_at ? 'closed' : 'open', source: 'principal-recorded' })),
      ...p.observed.map(o => ({ kind: 'observed', system: o.label, holder: o.owner, count: o.count, status: 'open', source: o.source }))], suppressionDigests: digests.size, restrictedRemainder: p.remainder };
  const keySteps=await rows(db,"SELECT table_name,count FROM b_client_erasure_steps WHERE erasure_id=? AND table_name IN ('b_integration_keys','b_integration_clients')",erasureId);
  const suspended=Number(keySteps.find(s=>s.table_name==='b_integration_keys')?.count??0),removed=Number(keySteps.find(s=>s.table_name==='b_integration_clients')?.count??0);
  await stmt(db, 'UPDATE b_client_erasures SET counts=?,retained=?,journal_epoch=? WHERE id=?', JSON.stringify({ withdrawalsCarried: p.carry, keys: { rescoped: removed-suspended, suspended } }), JSON.stringify(record), epoch, erasureId).run();
  return erasureReceipt(db, actor, erasureId);
}

const receiptOf = async (db: D1Database, r: Data) => ({ id: r.id, clientRef: r.client_ref, clientId: r.client_id, subjectKind: r.subject_kind, reason: r.reason, approvedBy: r.approved_by, approvedAt: r.approved_at, planHash: r.plan_hash, journalEpoch: r.journal_epoch,
  steps: (await rows(db, 'SELECT table_name "table",action,label,count FROM b_client_erasure_steps WHERE erasure_id=? ORDER BY ordinal', r.id)).filter(x => x.count > 0), ...JSON.parse(r.counts), retained: JSON.parse(r.retained) });

export async function erasureReceipt(db: D1Database, actor: Actor, erasureId: string) {
  human(actor); need(actor, 'owner');
  const r = await stmt(db, 'SELECT * FROM b_client_erasures WHERE id=?', erasureId).first<Data>();
  insist(r, 'Erasure receipt not found', 404);
  return receiptOf(db, r);
}

/** The latest erasure journal: every receipt plus the portability checkpoint that fences older archives. */
export async function erasureJournal(db: D1Database, actor: Actor) {
  human(actor); need(actor, 'owner');
  const state = await stmt(db, 'SELECT source_identity,epoch FROM rer_portability_state WHERE id=1').first<Data>();
  const hashes = (await rows(db, 'SELECT tombstone FROM rer_portability_journal WHERE source=? ORDER BY tombstone', state?.source_identity)).map(r => String(r.tombstone));
  return { exportedAt: now(), sourceIdentity: state?.source_identity, epoch: Number(state?.epoch ?? 0), tombstones: hashes,
    receipts: await Promise.all((await rows(db, 'SELECT * FROM b_client_erasures ORDER BY approved_at,id')).map(r => receiptOf(db, r))),
    expiries: await rows(db, 'SELECT id,kind,record_id,client_id,reason,confirmed_by,confirmed_at,counts FROM b_expiry_erasures ORDER BY confirmed_at,id'),
    note: 'Restore an older archive only together with an archive made after the newest erasure; older archives are refused.' };
}
