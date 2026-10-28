// Unsigned intake is a practitioner record, never provider or signing evidence.
import { documentBytes } from './document-packets';
import { openPdf, base64, unbase64 } from './signatures-pdf';
import { documentAuthority, requireDocument } from './permissions';
import { atomic, audit, digest, Fault, guard, id, insist, integer, job, now, rows, stmt, visibleJobParams, visibleJobSql, type Actor, type Data } from './model';

export const EFILE_BLOCKED = 'Required e-file signatures and KBA evidence are unavailable. Unsigned intake, checklist completion and general signatures cannot release ready to file.';

async function context(db: D1Database, actor: Actor, jobId: string) {
  insist(actor.channel === 'person' && !actor.automation && actor.sessionId, 'A native staff session is required', 403);
  const j = await job(db, actor, jobId);
  insist(await stmt(db, 'SELECT 1 FROM b_clients WHERE id=? AND erased_at IS NULL AND merged_into IS NULL', j.client_id).first(), 'Client unavailable', 404);
  const d = await stmt(db, `SELECT d.period_end FROM b_job_deadlines d JOIN b_deadline_rules r ON r.key=d.rule_key
    WHERE d.job_id=? AND json_extract(r.definition,'$.form')='1040' AND json_extract(r.definition,'$.jurisdiction')='US'`, jobId).first<Data>();
  return { j, taxYear: d ? Number(d.period_end.slice(0, 4)) : null };
}
const savedFor = (db: D1Database, jobId: string) => stmt(db, 'SELECT * FROM b_efile_authorizations WHERE job_id=?', jobId).first<Data>();
// Same current-session and completed-factor boundary as native time writes.
function sessionGuard(db: D1Database, actor: Actor) {
  return guard(db, `EXISTS(SELECT 1 FROM oa_sessions s JOIN oa_operators o ON o.id=s.operator_id
    WHERE s.id=? AND s.operator_id=? AND s.revoked_at IS NULL AND s.expires_at>? AND s.operator_version=o.version)
    AND (EXISTS(SELECT 1 FROM b_enterprise_sessions s JOIN b_enterprise_connection c ON c.id=1 AND c.active=1 AND c.revision=s.revision
      JOIN b_enterprise_identities i ON i.id=s.identity_id AND i.active=1 AND i.blocked=0 WHERE s.session_id=? AND i.email=? AND s.mfa=1)
    OR ((NOT EXISTS(SELECT 1 FROM b_mfa_policy WHERE required=1) AND NOT EXISTS(SELECT 1 FROM b_mfa_factors WHERE email=? AND confirmed_at IS NOT NULL))
      OR (EXISTS(SELECT 1 FROM b_mfa_factors WHERE email=? AND confirmed_at IS NOT NULL) AND EXISTS(SELECT 1 FROM b_mfa_sessions WHERE session_id=? AND email=?))))`,
    actor.sessionId, actor.id, Date.now(), actor.sessionId, actor.email, actor.email, actor.email, actor.sessionId, actor.email);
}
function liveGuard(db: D1Database, actor: Actor, j: Data, file: Data, roster: Data[], taxYear: number) {
  return guard(db, `EXISTS(SELECT 1 FROM b_jobs JOIN b_clients c ON c.id=b_jobs.client_id
      WHERE b_jobs.id=? AND b_jobs.revision=? AND ${visibleJobSql} AND c.id=? AND c.erased_at IS NULL AND c.merged_into IS NULL AND c.lifecycle='active')
    AND EXISTS(SELECT 1 FROM b_job_deadlines d JOIN b_deadline_rules r ON r.key=d.rule_key WHERE d.job_id=?
      AND substr(d.period_end,1,4)=? AND json_extract(r.definition,'$.form')='1040' AND json_extract(r.definition,'$.jurisdiction')='US')
    AND EXISTS(SELECT 1 FROM b_files WHERE id=? AND job_id=? AND sha256=? AND erased_at IS NULL AND content_base64 IS NOT NULL)
    AND ${documentAuthority(actor, '?')}
    AND NOT EXISTS(SELECT 1 FROM json_each(?) s WHERE NOT EXISTS(SELECT 1 FROM b_client_contacts c
      WHERE c.id=json_extract(s.value,'$.contactId') AND c.revision=json_extract(s.value,'$.revision')
      AND c.client_id=? AND c.active=1 AND c.authorized=1 AND c.signer=1))`,
    j.id, j.revision, ...visibleJobParams(actor), j.client_id, j.id, String(taxYear), file.id, j.id, file.sha256, file.id, file.id, JSON.stringify(roster), j.client_id);
}
async function sourceFile(db: D1Database, actor: Actor, jobId: string, fileId: string) {
  await requireDocument(db, actor, fileId);
  const f = await stmt(db, 'SELECT * FROM b_files WHERE id=? AND job_id=? AND erased_at IS NULL AND content_base64 IS NOT NULL', fileId, jobId).first<Data>();
  insist(f, 'Original file unavailable on this engagement', 404);
  return f;
}
export async function efileAuthorization(db: D1Database, actor: Actor, jobId: string) {
  const { j, taxYear } = await context(db, actor, jobId), saved = await savedFor(db, jobId);
  if (saved) await requireDocument(db, actor, saved.file_id);
  const signers: Data[] = saved && !saved.erased_at ? JSON.parse(saved.roster) : [];
  for (const signer of signers) {
    signer.currentAuthority = !!await stmt(db, 'SELECT 1 FROM b_client_contacts WHERE id=? AND client_id=? AND revision=? AND active=1 AND authorized=1 AND signer=1', signer.contactId, j.client_id, signer.revision).first();
    signer.signature = 'unavailable'; signer.kba = 'unavailable';
  }
  return { eligible: taxYear !== null, jobId, clientId: j.client_id, taxYear, form: '8879', filingStatus: 'married_filing_jointly',
    source: 'practitioner-recorded; tax-software provenance and identity not verified', readyToFile: false, reasons: [EFILE_BLOCKED,
      ...(saved?.restored ? ['Restored historical intake is inactive; it cannot authorize signing or readiness.'] : []),
      ...(signers.some(s => !s.currentAuthority) ? ['A reviewed contact changed or lost signer authority.'] : [])],
    record: saved && !saved.erased_at ? { id: saved.id, fileId: saved.file_id, fileName: saved.file_name, sha256: saved.file_sha256,
      recordedBy: saved.recorded_by, recordedAt: saved.recorded_at, restored: !!saved.restored, signers } : null,
    contacts: !saved && taxYear !== null ? await rows(db, 'SELECT id,name,revision FROM b_client_contacts WHERE client_id=? AND active=1 AND authorized=1 AND signer=1 ORDER BY name,id', j.client_id) : [] };
}
export async function recordEfileAuthorization(db: D1Database, actor: Actor, jobId: string, body: Data) {
  insist(!actor.readOnly, 'Writable staff access required', 403);
  insist(Object.keys(body).every(k => ['jobId','clientId','taxYear','form','filingStatus','fileId','spouseContactIds','spouseContactRevisions','reviewedFinalUnsigned','reviewedRequiredSigners'].includes(k)), 'Only unsigned intake fields are supported; no signature completion override exists');
  const { j, taxYear } = await context(db, actor, jobId);
  insist(j.status === 'open' && taxYear !== null, 'Choose an open US 1040 client-year engagement', 409);
  insist(body.jobId === jobId && body.clientId === j.client_id && integer(body.taxYear, 'Tax year', 1900, 9999) === taxYear
    && body.form === '8879' && body.filingStatus === 'married_filing_jointly', 'Identify this exact client-year 1040 engagement and Form 8879', 409);
  insist(body.reviewedFinalUnsigned === true && body.reviewedRequiredSigners === true, 'Explicitly review the final unsigned form and both required spouses');
  insist(Array.isArray(body.spouseContactIds) && body.spouseContactIds.length === 2 && new Set(body.spouseContactIds).size === 2, 'Review two distinct required spouse contacts');
  insist(Array.isArray(body.spouseContactRevisions) && body.spouseContactRevisions.length === 2, 'Supply both reviewed contact revisions in spouse order');
  const roster: Data[] = [];
  for (const contactId of body.spouseContactIds) {
    const c = await stmt(db, 'SELECT id,name,revision FROM b_client_contacts WHERE id=? AND client_id=? AND active=1 AND authorized=1 AND signer=1', contactId, j.client_id).first<Data>();
    insist(c, 'Every required spouse must be a current authorized signer for this client', 409);
    insist(c.revision === body.spouseContactRevisions[roster.length], 'A required spouse contact changed. Review the current roster again.', 409);
    roster.push({ contactId: c.id, name: c.name, revision: c.revision, requirement: 'required spouse; practitioner-recorded' });
  }
  const file = await sourceFile(db, actor, j.id, String(body.fileId)), bytes = await documentBytes(db, file);
  insist(file.mime === 'application/pdf', 'Choose a PDF'); await openPdf(bytes);
  insist(await digest(bytes) === file.sha256, 'Original digest mismatch', 409);
  const intent = await digest(JSON.stringify([jobId, j.client_id, taxYear, file.id, file.sha256, roster]));
  const replay = async (saved: Data) => {
    insist(!saved.restored && !saved.erased_at && saved.intent_sha256 === intent, 'This engagement already has different or inactive unsigned intake', 409);
    const [live, done] = liveGuard(db, actor, j, file, roster, taxYear!), [session, sessionDone] = sessionGuard(db, actor);
    await atomic(db, actor, [session, live, done, sessionDone]);
    return efileAuthorization(db, actor, jobId);
  };
  const saved = await savedFor(db, jobId); if (saved) return replay(saved);
  const recordId = id(), at = now(), [live, done] = liveGuard(db, actor, j, file, roster, taxYear), [session, sessionDone] = sessionGuard(db, actor);
  try {
    await atomic(db, actor, [session, live,
      stmt(db, `INSERT INTO b_efile_authorizations(id,job_id,client_id,tax_year,form,filing_status,file_id,file_name,file_sha256,original_base64,roster,intent_sha256,recorded_by,recorded_at)
        VALUES(?,?,?,?,'8879','married_filing_jointly',?,?,?,?,?,?,?,?)`, recordId, jobId, j.client_id, taxYear, file.id, file.name, file.sha256, base64(bytes), JSON.stringify(roster), intent, actor.email, at),
      audit(db, actor, 'efile.unsigned_recorded', jobId, `Form 8879; tax year ${taxYear}; practitioner-recorded original ${file.sha256}; two reviewed required spouses; no signing or filing evidence`), done, sessionDone]);
  } catch (error) {
    if (error instanceof Fault && error.status === 409) { const winner = await savedFor(db, jobId); if (winner) return replay(winner); }
    throw error;
  }
  return efileAuthorization(db, actor, jobId);
}
export async function downloadEfileOriginal(db: D1Database, actor: Actor, jobId: string) {
  const { j, taxYear } = await context(db, actor, jobId), saved = await savedFor(db, jobId);
  insist(taxYear !== null && saved && !saved.erased_at && saved.original_base64 && taxYear === saved.tax_year && j.client_id === saved.client_id, 'Original unavailable', 404);
  insist(!saved.restored, 'Restored intake is inactive', 409);
  const file = await sourceFile(db, actor, jobId, saved.file_id), roster = JSON.parse(saved.roster);
  const [live, done] = liveGuard(db, actor, j, file, roster, taxYear), [session, sessionDone] = sessionGuard(db, actor);
  const [original, originalDone] = guard(db, 'EXISTS(SELECT 1 FROM b_efile_authorizations WHERE id=? AND erased_at IS NULL AND restored=0 AND file_sha256=? AND original_base64 IS NOT NULL)', saved.id, saved.file_sha256);
  await atomic(db, actor, [session, live, original, audit(db, actor, 'efile.original_downloaded', jobId, `Practitioner-recorded unsigned original ${saved.file_sha256}`), originalDone, done, sessionDone]);
  return new Response(unbase64(saved.original_base64), { headers: { 'content-type': 'application/pdf', 'content-disposition': `attachment; filename="${String(saved.file_name).replace(/[^A-Za-z0-9._ -]/g, '_')}"`, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } });
}
