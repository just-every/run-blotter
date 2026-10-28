// Native fallback only. No connector reads, transmissions or inferred filing.
import { prepareFiling } from './deadlines';
import { documentAuthority, requireDocument } from './permissions';
import { atomic, audit, digest, Fault, guard, human, insist, integer, now, readableJob, stmt, text, visibleJobParams, visibleJobSql, type Actor, type Data } from './model';

export const TAX_STACKS = ['Lacerte', 'ProSeries', 'Drake', 'UltraTax CS', 'CCH Axcess'];
async function returnFor(db: D1Database, actor: Actor, jobId: string) {
  human(actor);
  const j = await readableJob(db, actor, jobId);
  insist(j.access === 'full', 'Job not found', 404);
  insist(await stmt(db, 'SELECT 1 FROM b_clients WHERE id=? AND erased_at IS NULL AND merged_into IS NULL', j.client_id).first(), 'Client no longer available', 404);
  const d = await stmt(db, `SELECT d.*,json_extract(r.definition,'$.form') form,json_extract(r.definition,'$.jurisdiction') jurisdiction
    FROM b_job_deadlines d JOIN b_deadline_rules r ON r.key=d.rule_key WHERE d.job_id=?`, jobId).first<Data>();
  insist(d && d.jurisdiction !== 'Firm', 'This job has no agency return obligation', 409);
  return { j, d, identity: { jobId, clientId: j.client_id, form: d.form, jurisdiction: d.jurisdiction, taxYear: Number(d.period_end.slice(0, 4)) } };
}
const savedFor = (db: D1Database, jobId: string) => stmt(db, 'SELECT * FROM b_filing_status WHERE job_id=?', jobId).first<Data>();
export async function filingStatus(db: D1Database, actor: Actor, jobId: string) {
  const { identity, d } = await returnFor(db, actor, jobId), saved = await savedFor(db, jobId);
  if (!saved) return { return: identity, stacks: TAX_STACKS, source: null, status: 'no stack status recorded' };
  await requireDocument(db, actor, saved.file_id);
  const file = await stmt(db, 'SELECT name,erased_at FROM b_files WHERE id=?', saved.file_id).first<Data>();
  const available = !saved.erased_at && file && !file.erased_at;
  const mappedReturn = { jobId: saved.job_id, clientId: saved.client_id, form: saved.form, jurisdiction: saved.jurisdiction, taxYear: saved.tax_year };
  return { return: mappedReturn, stacks: TAX_STACKS, status: available ? 'accepted' : 'acknowledgment unavailable', source: {
    kind: 'practitioner-recorded', stack: saved.stack, noStatusDeclaration: saved.no_status_declaration,
    fileId: saved.file_id, fileSha256: saved.file_sha256, fileName: file?.name ?? null, evidenceAvailable: !!available,
    submissionId: d.filing_submission_id, acceptedOn: d.filing_accepted_on,
    acknowledgmentRecordedBy: d.filing_recorded_by, acknowledgmentRecordedAt: d.filing_recorded_at,
    recordedBy: saved.recorded_by, recordedAt: saved.recorded_at,
  } };
}
export async function recordFallback(db: D1Database, actor: Actor, jobId: string, body: Data) {
  insist(actor.channel === 'person' && actor.sessionId && !actor.readOnly, 'A writable staff session is required', 403);
  insist(Object.keys(body).every(key => ['jobId','clientId','form','jurisdiction','taxYear','stack','noStatus','noStatusDeclaration','fileId','submissionId','acceptedOn'].includes(key)), 'Only the accepted acknowledgment fallback fields are supported');
  const { j, d, identity } = await returnFor(db, actor, jobId);
  insist(body.jobId === jobId && body.clientId === identity.clientId && body.form === identity.form && body.jurisdiction === identity.jurisdiction
    && integer(body.taxYear, 'Tax year', 1900, 9999) === identity.taxYear, 'The acknowledgment must identify this exact client, form, jurisdiction and tax year', 409);
  const stack = text(body.stack, 'Tax stack', 40), declaration = text(body.noStatusDeclaration, 'Declaration that this stack exposes no status for this return', 500);
  insist(TAX_STACKS.includes(stack), 'Choose the named tax stack');
  insist(body.noStatus === true, 'Explicitly confirm this stack exposes no status for this return');
  const prepared = await prepareFiling(db, actor, jobId, body, true);
  const fingerprint = await digest(JSON.stringify([identity, stack, declaration, prepared.file.id, prepared.file.sha256, prepared.submission, prepared.accepted]));
  const replay = async (saved: Data) => {
    insist(!saved.erased_at && saved.intent_sha256 === fingerprint, 'This return already has a different practitioner source mapping', 409);
    return filingStatus(db, actor, jobId);
  };
  const saved = await savedFor(db, jobId);
  if (saved) return replay(saved);
  // Current scope, session, return identity and original bytes remain required at commit time.
  const [check, release] = guard(db, `EXISTS(SELECT 1 FROM b_jobs WHERE id=? AND revision=? AND ${visibleJobSql})
    AND EXISTS(SELECT 1 FROM b_clients WHERE id=? AND erased_at IS NULL AND merged_into IS NULL)
    AND EXISTS(SELECT 1 FROM oa_sessions s JOIN oa_operators o ON o.id=s.operator_id WHERE s.id=? AND s.operator_id=? AND s.revoked_at IS NULL AND s.expires_at>? AND s.operator_version=o.version)
    AND EXISTS(SELECT 1 FROM b_job_deadlines WHERE job_id=? AND rule_key=? AND period_end=?)
    AND ${documentAuthority(actor, '?')}`, j.id, j.revision, ...visibleJobParams(actor), j.client_id, actor.sessionId, actor.id, Date.now(), jobId, d.rule_key, d.period_end, prepared.file.id, prepared.file.id);
  try {
    await atomic(db, actor, [check, ...prepared.statements,
      stmt(db, `INSERT INTO b_filing_status(job_id,client_id,form,jurisdiction,tax_year,stack,no_status_declaration,file_id,file_sha256,intent_sha256,recorded_by,recorded_at)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`, jobId, j.client_id, identity.form, identity.jurisdiction, identity.taxYear, stack, declaration, prepared.file.id, prepared.file.sha256, fingerprint, actor.email, now()),
      audit(db, actor, 'deadline.filing_source_recorded', jobId, `${stack}: practitioner-recorded acknowledgment; Form ${identity.form}, ${identity.jurisdiction}, tax year ${identity.taxYear}`), release]);
  } catch (error) {
    if (error instanceof Fault && error.status === 409) {
      const winner = await savedFor(db, jobId);
      if (winner) {
        // Re-read the live file too: erasure must never be accepted as a replay.
        await prepareFiling(db, actor, jobId, body, true);
        return replay(winner);
      }
    }
    throw error;
  }
  return filingStatus(db, actor, jobId);
}
