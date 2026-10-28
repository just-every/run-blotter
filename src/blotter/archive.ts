// Whole-practice archive and restore on Base portability, and file erasure that
// fences older archives. Adapted from just-every/run-satchel src/satchel/archive.ts (MIT).
import { ensureLegacyContacts } from './client-contacts';
import { refuseHeld } from './client-retention';
import { requireAcknowledgement, withReport } from './erasure-restore';
import { createPortability, readArchive } from '@runeditrun/rer/modules/portability';
import policy from './archive-policy.mjs';
import { atomic, audit, human, insist, job, need, now, stmt, text, type Actor, type Data } from './model';

export async function backup(db: D1Database, actor: Actor) {
  human(actor); need(actor, 'owner');
  const service = await createPortability({ db, policy }), exportId = await service.exports.create(actor.id);
  try {
    let status = await service.exports.advance(exportId);
    while (status.phase !== 'complete') status = await service.exports.advance(exportId);
    const bytes = await new Response(await service.exports.download(exportId)).arrayBuffer();
    await atomic(db, actor, [audit(db, actor, 'archive.downloaded', 'archive', `${bytes.byteLength} bytes`)]);
    return new Response(bytes, { headers: { 'content-type': 'application/x-ndjson', 'content-disposition': 'attachment; filename="blotter.rer"', 'cache-control': 'no-store' } });
  } finally { await service.exports.abort(exportId); }
}

export async function restore(db: D1Database, actor: Actor, body: Data) {
  human(actor); need(actor, 'owner');
  insist(body.confirm === 'RESTORE', 'Type RESTORE to confirm an empty-destination restore');
  const acknowledged = requireAcknowledgement(body.journal, body.acknowledge);
  const source = text(body.archive, 'Archive', 64_000_000), service = await createPortability({ db, policy });
  const records = [];
  for await (const record of readArchive(new Response(source).body!)) records.push(record);
  let laterJournal;
  if (body.journal) {
    for await (const part of readArchive(new Response(text(body.journal, 'Later archive', 64_000_000)).body!)) {
      if (part.kind === 'manifest') laterJournal = { sourceIdentity: part.sourceIdentity, epoch: part.epoch, journal: part.journal };
    }
  }
  let importId: string | undefined;
  try {
    for (const item of records) {
      if (item.kind === 'manifest') importId = await service.imports.create(item, actor.id);
      else if (item.kind === 'part') { insist(importId, 'Missing archive manifest'); await service.imports.uploadPart(importId, item.index, item); }
      else { insist(importId, 'Missing archive manifest'); const result = await service.imports.finalize(importId, { archiveHash: item.archiveHash, contentHash: item.contentHash, laterJournal }); await ensureLegacyContacts(db); return withReport(result, actor, acknowledged); }
    }
    throw new Error('Incomplete archive');
  } catch (error) { if (importId) await service.imports.abort(importId); throw error; }
}

/** Erase an uploaded file's bytes. Its name, hash and history remain; older archives are fenced. */
export async function eraseFile(db: D1Database, actor: Actor, fileId: string, body: Data) {
  human(actor); need(actor, 'owner');
  const letter = await stmt(db, 'SELECT * FROM b_engagements WHERE id=?', fileId).first<Data>();
  if (letter) return eraseLetter(db, actor, letter, body);
  const intake = await stmt(db, 'SELECT * FROM b_prospect_files WHERE id=?', fileId).first<Data>();
  const regular = await stmt(db, 'SELECT * FROM b_files WHERE id=?', intake?.job_file_id ?? fileId).first<Data>();
  const file = regular ?? intake;
  insist(file, 'File not found', 404);
  if (regular) await job(db, actor, file.job_id);
  insist(!file.erased_at, 'This file was already erased', 409);
  // ERASURE-009: inside a hold this door is refused, naming the hold.
  if (regular) await refuseHeld(db, { clientIds: [String((await stmt(db, 'SELECT client_id FROM b_jobs WHERE id=?', file.job_id).first<Data>())?.client_id)], jobId: file.job_id, fileId: file.id, cls: 'signed_work' }, 'Erasing this file');
  else {
    const owner = await stmt(db, 'SELECT client_id FROM b_prospects WHERE id=?', intake!.prospect_id).first<Data>();
    if (owner?.client_id) await refuseHeld(db, { clientIds: [String(owner.client_id)], cls: 'prospect' }, 'Erasing this intake file');
  }
  insist(body.confirm === file.name, 'Type the file name to confirm erasing its bytes');
  const reason = text(body.reason, 'Erasure reason', 1000), service = await createPortability({ db, policy });
  await atomic(db, actor, [
    regular ? stmt(db, 'UPDATE b_files SET content_base64=NULL,erased_at=?,erased_by=?,erase_reason=? WHERE id=? AND erased_at IS NULL', now(), actor.email, reason, file.id)
      : stmt(db, 'UPDATE b_prospect_files SET content_base64=NULL,erased_at=? WHERE id=? AND erased_at IS NULL', now(), file.id),
    stmt(db, 'DELETE FROM b_file_text WHERE file_id=?', file.id),
    stmt(db, "DELETE FROM b_ai_drafts WHERE request_id IN (SELECT id FROM b_ai_requests WHERE source_kind='document' AND source_id=?)", file.id),
    ...await service.redactionStatements(), ...await service.invalidateTransfersStatements(),
    audit(db, actor, 'file.erased', file.id, reason),
  ]);
  return { id: file.id, erased: true };
}

/** A practitioner-recorded signed letter's bytes (ERASURE-017): refused inside a hold; the record, signers, date and SHA-256 stay. */
async function eraseLetter(db: D1Database, actor: Actor, letter: Data, body: Data) {
  insist(!letter.erased_at, 'This file was already erased', 409);
  await refuseHeld(db, { clientIds: [letter.client_id], engagementId: letter.id, cls: 'engagement' }, 'Erasing this engagement letter');
  insist(body.confirm === letter.name, 'Type the file name to confirm erasing its bytes');
  const reason = text(body.reason, 'Erasure reason', 1000), service = await createPortability({ db, policy });
  await atomic(db, actor, [
    stmt(db, 'UPDATE b_engagements SET content_base64=NULL,erased_at=? WHERE id=? AND erased_at IS NULL', now(), letter.id),
    ...await service.redactionStatements(), ...await service.invalidateTransfersStatements(),
    audit(db, actor, 'file.erased', letter.id, reason)]);
  return { id: letter.id, erased: true };
}
