// ERASURE-002 whole-client erasure: preview the scope, retention marks and named
// exceptions; erase only what the principal approves by plan hash; record the
// receipt (counts, no values); fence every older archive through native portability.
import { createPortability } from '@runeditrun/rer/modules/portability';
import policy from './archive-policy.mjs';
import { retained, rowsOf, selectors, steps, lit, suppressionDigest, type Context, type Step } from './erasure-scope';
import { atomic, audit, digest, guard, human, id, insist, need, now, rows, stmt, text, type Actor, type Data } from './model';

/** Triggers that forbid rewriting history; suspended only inside one approved erasure batch and recreated verbatim. */
const GUARDS = ['b_deliverable_versions_immutable', 'b_expenses_immutable', 'b_marketing_consents_update', 'b_notice_events_immutable', 'b_notices_closed',
  'b_portal_items_closed', 'b_thread_messages_immutable', 'b_threads_resolved', 'b_time_immutable'];

async function count(db: D1Database, step: Step) {
  return rowsOf(await stmt(db, `SELECT count(*) n FROM ${step.table} WHERE ${step.where}`).first<Data>());
}

/** Audit values that name this client or its contacts, never staff addresses. */
async function auditedValues(db: D1Database, clientId: string) {
  const people = new Set([...await rows(db, 'SELECT email FROM b_members'), ...await rows(db, 'SELECT email FROM oa_operators')].map(r => String(r.email).toLowerCase()));
  const found = [...await rows(db, 'SELECT name v,contact_name w,contact_email x FROM b_clients WHERE id=?', clientId),
    ...await rows(db, "SELECT name v,first_name||' '||last_name w,email x,phone y FROM b_client_contacts WHERE client_id=?", clientId)].flatMap(r => Object.values(r));
  return [...new Set(found.map(v => String(v ?? '').trim()).filter(v => v.length >= 4 && !people.has(v.toLowerCase()) && v !== 'Erased contact'))].sort();
}

async function withdrawnAddresses(db: D1Database, x: Context) {
  const s = selectors(x);
  const withdrawn = await rows(db, `SELECT DISTINCT w.address a FROM b_marketing_consents w WHERE w.kind='withdraw' AND w.channel='email' AND (w.contact_id IN ${s.K} OR w.client_id=${s.c})
    AND NOT EXISTS(SELECT 1 FROM b_marketing_consents v WHERE v.corrects_id=w.id)`);
  const bounced = await rows(db, `SELECT address a FROM b_mail_suppressions WHERE address IN (SELECT email FROM b_client_contacts WHERE client_id=${s.c} AND email<>'')`);
  return { withdrawn: withdrawn.map(r => String(r.a)), bounced: bounced.map(r => String(r.a)) };
}

const carrySql = (x: Context) => {
  const s = selectors(x);
  return { from: `FROM b_client_contacts o JOIN b_marketing_consents w ON w.address=o.email AND w.kind='withdraw' AND w.channel='email' AND (w.contact_id IN ${s.K} OR w.client_id=${s.c})
    AND NOT EXISTS(SELECT 1 FROM b_marketing_consents v WHERE v.corrects_id=w.id) WHERE o.client_id<>${s.c} AND o.email<>''` };
};

async function plan(db: D1Database, actor: Actor, clientId: string) {
  const client = await stmt(db, 'SELECT * FROM b_clients WHERE id=?', clientId).first<Data>();
  insist(client, 'Client not found', 404);
  const at = now(), x: Context = { client: clientId, today: at.slice(0, 10), at, who: actor.email, reason: '' };
  const values = await auditedValues(db, clientId);
  const audited = values.length ? { where: values.map(v => `instr(detail,${lit(v)})>0`).join(' OR '), set: 'detail=' + values.reduce((expr, v) => `replace(${expr},${lit(v)},'[erased]')`, 'detail') } : null;
  const list = steps(x, audited);
  const counts = [];
  for (const step of list) counts.push({ table: step.table, action: step.action, label: step.label, count: await count(db, step) });
  const s = selectors(x), carry = rowsOf(await stmt(db, `SELECT count(*) n FROM (SELECT o.id ${carrySql(x).from} GROUP BY o.id)`).first<Data>());
  const addresses = await withdrawnAddresses(db, x);
  const digests = [...new Set([...addresses.withdrawn, ...addresses.bounced])];
  const keep = [];
  for (const r of retained(x)) keep.push({ key: r.key, label: r.label, reason: r.reason, owner: r.owner, count: rowsOf(await stmt(db, r.sql).first<Data>()) });
  const auditRows = rowsOf(await stmt(db, `SELECT count(*) n FROM b_audit WHERE object_id=${s.c} OR object_id IN ${s.JALL} OR object_id IN ${s.K} OR object_id IN (SELECT id FROM b_files WHERE job_id IN ${s.JALL})`).first<Data>());
  const marks = await rows(db, `SELECT id,scope,target_id,kind,until,reason,placed_by FROM b_retention_marks WHERE client_id=? AND released_at IS NULL AND (kind='hold' OR until>=?) ORDER BY placed_at,id`, clientId, x.today);
  const copies = await rows(db, 'SELECT id,kind,system,holder,note,recorded_by,closed_at FROM b_external_copies WHERE client_id=? ORDER BY recorded_at,id', clientId);
  const blockers: string[] = [];
  if (client.erased_at) blockers.push('This client was already erased');
  if (client.lifecycle !== 'archived') blockers.push('Archive the client before requesting erasure');
  if (client.merged_into || await stmt(db, 'SELECT 1 FROM b_client_merges WHERE survivor_id=? OR merged_id=?', clientId, clientId).first()) blockers.push('This client is part of a merge; its history cannot be erased until ct rules on merge history (ERASURE-002)');
  for (const m of marks.filter(m => m.scope === 'client')) blockers.push(`Client ${m.kind === 'hold' ? 'hold' : `retention until ${m.until}`} placed by ${m.placed_by}: ${m.reason}`);
  const retainedAll = [...keep.filter(k => k.count > 0), { key: 'audit_history', label: 'Audit history rows about this client (actor, action, object, time; names replaced)', reason: 'Durable attribution (AUDIT-001).', owner: 'Principal', count: auditRows },
    { key: 'suppression_digests', label: 'One-way digests of withdrawn or bounced addresses', reason: 'Prevents re-contact after the address is erased (MSG-002).', owner: 'Principal', count: digests.length }];
  const totals = { redacted: 0, deleted: 0, cascade: 0 };
  for (const c of counts) totals[c.action === 'redact' ? 'redacted' : c.action === 'delete' ? 'deleted' : 'cascade'] += c.count;
  const body = { client: { ref: clientId.slice(0, 8), revision: client.revision }, counts, carried: carry, retained: retainedAll, marks, copies, totals };
  const planHash = await digest(JSON.stringify({ body, digests: digests.length }));
  return { x, client, list, audited, counts, carry, digests, addresses, retained: retainedAll, marks, copies, blockers, totals, planHash,
    preview: { client: { id: clientId, ref: clientId.slice(0, 8), name: client.name, lifecycle: client.lifecycle }, eligible: blockers.length === 0, blockers, erase: counts.filter(c => c.count > 0), totals, withdrawalsCarried: carry,
      retained: retainedAll, holds: marks, externalCopies: copies.map(c => ({ ...c, status: c.closed_at ? 'closed' : 'open', action: c.closed_at ? 'confirmed deleted by the principal' : `Not erased by Blotter; ${c.holder} must delete it` })), planHash } };
}

export async function erasurePreview(db: D1Database, actor: Actor, clientId: string) {
  human(actor); need(actor, 'owner');
  return (await plan(db, actor, clientId)).preview;
}

export async function eraseClient(db: D1Database, actor: Actor, clientId: string, body: Data) {
  human(actor); need(actor, 'owner');
  const p = await plan(db, actor, clientId);
  insist(p.blockers.length === 0, p.blockers[0] ?? 'Erasure is not allowed', 409);
  insist(body.planHash === p.planHash, 'The preview changed. Review the new preview and approve again.', 409);
  insist(body.confirm === p.client.name, 'Type the client name to confirm erasing it');
  const reason = text(body.reason, 'Erasure reason', 1000), erasureId = id();
  const x: Context = { ...p.x, reason }, list = steps(x, p.audited), service = await createPortability({ db, policy });
  const triggers = await rows(db, `SELECT name,sql FROM sqlite_master WHERE type='trigger' AND name IN (${GUARDS.map(() => '?').join(',')})`, ...GUARDS);
  const [check, release] = guard(db, 'EXISTS(SELECT 1 FROM b_clients WHERE id=? AND revision=? AND erased_at IS NULL)', clientId, p.client.revision);
  const batch: D1PreparedStatement[] = [check,
    stmt(db, `INSERT INTO b_client_erasures(id,client_id,client_ref,reason,plan_hash,requested_by,approved_by,approved_at,counts,retained,journal_epoch) VALUES(?,?,?,?,?,?,?,?,'{}','[]',0)`, erasureId, clientId, clientId.slice(0, 8), reason, p.planHash, actor.email, actor.email, x.at),
    ...triggers.map(t => stmt(db, `DROP TRIGGER ${t.name}`)),
    stmt(db, `INSERT INTO b_marketing_consents(id,contact_id,client_id,address,channel,kind,source,acted_at,recorded_at,actor,evidence)
      SELECT lower(hex(randomblob(16))),o.id,o.client_id,o.email,'email','withdraw','staff_reply',max(w.acted_at),?,?,'withdrawal carried over another client''s erasure' ${carrySql(x).from} GROUP BY o.id`, x.at, actor.email),
  ];
  const digests = new Map<string, string>();
  for (const a of p.addresses.withdrawn) digests.set(await suppressionDigest(a), 'withdrawn marketing consent');
  for (const a of p.addresses.bounced) if (!digests.has(await suppressionDigest(a))) digests.set(await suppressionDigest(a), 'hard bounce');
  for (const [d, why] of digests) batch.push(stmt(db, 'INSERT OR IGNORE INTO b_erased_suppressions(digest,reason,erasure_id,at) VALUES(?,?,?,?)', d, why, erasureId, x.at));
  for (const [n, step] of list.entries()) {
    batch.push(stmt(db, `INSERT INTO b_client_erasure_steps(erasure_id,ordinal,table_name,action,label,count) SELECT ?,?,?,?,?,count(*) FROM ${step.table} WHERE ${step.where}`, erasureId, n, step.table, step.action, step.label));
    if (step.action !== 'cascade') batch.push(stmt(db, step.action === 'delete' ? `DELETE FROM ${step.table} WHERE ${step.where}` : `UPDATE ${step.table} SET ${step.set} WHERE ${step.where}`));
  }
  batch.push(...triggers.map(t => stmt(db, String(t.sql))), ...await service.redactionStatements(), ...await service.invalidateTransfersStatements(),
    audit(db, actor, 'client.erased', clientId, `${p.client.id.slice(0, 8)}; ${reason}`), release);
  await atomic(db, actor, batch);
  const epoch = Number((await stmt(db, 'SELECT epoch FROM rer_portability_state WHERE id=1').first<Data>())?.epoch ?? 0);
  const retainedRecord = { exceptions: p.retained, holds: p.marks, externalCopies: p.copies.map(c => ({ kind: c.kind, system: c.system, holder: c.holder, status: c.closed_at ? 'closed' : 'open' })), suppressionDigests: digests.size };
  await stmt(db, 'UPDATE b_client_erasures SET counts=?,retained=?,journal_epoch=? WHERE id=?', JSON.stringify({ withdrawalsCarried: p.carry }), JSON.stringify(retainedRecord), epoch, erasureId).run();
  return erasureReceipt(db, actor, erasureId);
}

const receiptOf = async (db: D1Database, r: Data) => ({ id: r.id, clientRef: r.client_ref, clientId: r.client_id, reason: r.reason, approvedBy: r.approved_by, approvedAt: r.approved_at, planHash: r.plan_hash, journalEpoch: r.journal_epoch,
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
    note: 'Restore an older archive only together with an archive made after the newest erasure; older archives are refused.' };
}
