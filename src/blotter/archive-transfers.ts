// ARCHIVE-002: bounded, durable transfers through the same owner-only archive policy.
import { createPortability, readArchive } from '@runeditrun/rer/modules/portability';
import policy from './archive-policy.mjs';
import { ensureLegacyContacts } from './client-contacts';
import { atomic, audit, human, insist, need, now, rows, stmt, text, type Actor, type Data } from './model';

const owner = (actor: Actor) => { human(actor); need(actor, 'owner'); };
const serviceFor = (db: D1Database) => createPortability({ db, policy });
async function owned(db: D1Database, actor: Actor, transferId: string, kind: 'export' | 'import') {
  owner(actor);
  const service = await serviceFor(db);
  insist(await service.actor(transferId) === actor.id, 'Transfer not found', 404);
  const status = await service.status(transferId);
  insist(status.kind === kind, 'Transfer not found', 404);
  return { service, status };
}
export async function transfers(db: D1Database, actor: Actor) {
  owner(actor); const service = await serviceFor(db);
  const list = await rows(db, "SELECT id,kind FROM rer_portability_jobs WHERE actor=? AND phase<>'aborted' ORDER BY rowid DESC LIMIT 20", actor.id);
  return { transfers: await Promise.all(list.map(t => service.status(t.id))), limits: { partBytes: 16 * 1024 * 1024, partsPerAdvance: 1, maxInlineRestoreCharacters: 64_000_000 },
    excluded: policy.excludeTables, requiredConfiguration: policy.requiredConfiguration };
}
export async function createTransfer(db: D1Database, actor: Actor, kind: 'export' | 'import', body: Data) {
  owner(actor); const service = await serviceFor(db);
  if (kind === 'export') {
    const id = await service.exports.create(actor.id);
    await atomic(db, actor, [audit(db,actor,'archive.export_created',id,'Frozen owner-only practice snapshot')]);
    return { id };
  }
  insist(body.confirm === 'RESTORE', 'Type RESTORE to confirm an empty-destination restore');
  return { id: await service.imports.create(body.manifest, actor.id) };
}
export async function transferStatus(db: D1Database, actor: Actor, kind: 'export' | 'import', transferId: string) {
  return (await owned(db, actor, transferId, kind)).status;
}
export async function advanceTransfer(db: D1Database, actor: Actor, transferId: string, body: Data) {
  const { service } = await owned(db, actor, transferId, 'export');
  insist(Number.isSafeInteger(body.expectedPart) && body.expectedPart >= 0, 'Supply the last confirmed part number');
  return service.exports.advance(transferId, { expectedPart: body.expectedPart, maxParts: 1 });
}
export async function uploadTransferPart(db: D1Database, actor: Actor, transferId: string, body: Data) {
  const { service } = await owned(db, actor, transferId, 'import');
  insist(body.part?.kind === 'part' && Number.isSafeInteger(body.part.index), 'Supply an archive part');
  return service.imports.uploadPart(transferId, body.part.index, body.part);
}
export async function finalizeTransfer(db: D1Database, actor: Actor, transferId: string, body: Data) {
  const { service } = await owned(db, actor, transferId, 'import');
  const result = await service.imports.finalize(transferId, { archiveHash: text(body.archiveHash, 'Archive hash', 64), contentHash: text(body.contentHash, 'Content hash', 64), laterJournal: body.laterJournal });
  await ensureLegacyContacts(db);
  await atomic(db, actor, [stmt(db, "INSERT OR IGNORE INTO b_audit(id,actor,action,object_id,detail,at) VALUES(?,?,'archive.restored',?,'Verified archive restored; schedules paused and credentials excluded',?)",'archive:'+transferId,actor.email,transferId,now())]);
  return result;
}
export async function abortTransfer(db: D1Database, actor: Actor, kind: 'export' | 'import', transferId: string) {
  const { service } = await owned(db, actor, transferId, kind);
  return (kind === 'export' ? service.exports : service.imports).abort(transferId);
}
export async function transferInventory(db: D1Database, actor: Actor, transferId: string) {
  const { service } = await owned(db, actor, transferId, 'export');
  const records = readArchive(await service.exports.download(transferId));
  try { const first = await records.next(); insist(first.value?.kind === 'manifest', 'Archive manifest missing', 409);
    return { exportedAt: first.value.exportedAt, tables: first.value.tables.map((t: {name:string;count:number}) => ({ name:t.name, count:t.count })) };
  } finally { await records.return(undefined); }
}
export async function downloadTransfer(db: D1Database, actor: Actor, transferId: string, table?: string) {
  const { service } = await owned(db, actor, transferId, 'export');
  const source = await service.exports.download(transferId);
  if (!table) return new Response(source, { headers: { 'content-type': 'application/x-ndjson', 'content-disposition': 'attachment; filename="blotter.rer"', 'cache-control': 'no-store' } });
  const records = readArchive(source), first = await records.next();
  insist(first.value?.kind === 'manifest' && first.value.tables.some((t: { name: string }) => t.name === table), 'Choose an included archive table', 404);
  const iterator = (async function* () {
    yield JSON.stringify({ kind: 'selection', table, exportedAt: first.value!.kind === 'manifest' ? first.value!.exportedAt : '', restorable: false }) + '\n';
    for await (const part of records) if (part.kind === 'part') for (const item of part.items) if (item.kind === 'row' && item.table === table) yield JSON.stringify(item.row) + '\n';
  })();
  const encoder = new TextEncoder();
  return new Response(new ReadableStream({ async pull(controller) { try { const n = await iterator.next(); if (n.done) controller.close(); else controller.enqueue(encoder.encode(n.value)); } catch (e) { controller.error(e); } }, async cancel() { await iterator.return(undefined); } }),
    { headers: { 'content-type': 'application/x-ndjson', 'content-disposition': `attachment; filename="${table}.ndjson"`, 'cache-control': 'no-store' } });
}
