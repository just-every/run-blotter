// AUTHZ-001: taxpayer authorizations. A Form 2848 (representation), Form 8821 (information) or
// state equivalent is tracked per client: representative and CAF number, the forms and years
// covered, the SIGN-002 signature that filed the signed copy, the submission and the agency's
// recorded, rejected or withdrawn status. Only a recorded authorization opens transcript
// requests (2848 or 8821) and agency contact on a notice (2848, or the state's own form).
import { firmSettings, localClock } from './firm';
import { eligible } from './jobs';
import { readableClient } from './client-contacts';
import { atomic, audit, date, human, id, insist, integer, need, now, optional, rows, stmt, text, type Actor, type Data } from './model';

type Matter = { form: string; from: number; to: number; matter: string };
const KINDS = ['2848', '8821', 'state'], METHODS = ['irs_online', 'tax_pro_account', 'fax'];
const yearOf = (period: string) => Number(String(period).match(/\b(?:19|20)\d{2}\b/)?.[0] ?? NaN);

function matters(value: unknown): Matter[] {
  insist(Array.isArray(value) && value.length > 0 && value.length <= 10, 'List 1 to 10 tax matters with their form and years');
  return value.map((m: Data) => {
    insist(m && typeof m === 'object', 'Each tax matter needs a form and years');
    const form = text(m.form, 'Tax form', 20).replace(/^Form\s+/i, ''), from = integer(m.from, 'First year', 1990, 2100), to = integer(m.to, 'Last year', 1990, 2100);
    insist(from <= to, 'The first year is after the last year');
    return { form, from, to, matter: optional(m.matter, 'Tax matter', 120) || 'Income' };
  });
}
async function record(db: D1Database, authorizationId: string) {
  const a = await stmt(db, 'SELECT a.*,c.erased_at client_erased_at FROM b_authorizations a JOIN b_clients c ON c.id=a.client_id WHERE a.id=?', authorizationId).first<Data>();
  insist(a && !a.client_erased_at, 'Authorization not found', 404);
  return a;
}
const lead = (actor: Actor) => { human(actor); need(actor, 'owner', 'reviewer'); };
const changed = (a: Data, body: Data) => insist(body.revision === a.revision, 'The authorization changed. Refresh and try again.', 409);
const step = (db: D1Database, actor: Actor, a: Data, set: string, ...values: unknown[]) =>
  stmt(db, `UPDATE b_authorizations SET ${set},revision=?,updated_by=?,updated_at=? WHERE id=? AND revision=?`, ...values, id(), actor.email, now(), a.id, a.revision);

export async function clientAuthorizations(db: D1Database, actor: Actor, clientId: string) {
  await readableClient(db, actor, clientId);
  insist(await stmt(db, 'SELECT 1 FROM b_clients WHERE id=? AND erased_at IS NULL', clientId).first(), 'Client not found', 404);
  const list: Data[] = (await rows(db, 'SELECT * FROM b_authorizations WHERE client_id=? ORDER BY created_at,id', clientId)).map(a => ({ ...a, matters: JSON.parse(a.matters) }));
  return { authorizations: list, transcripts: await rows(db, 'SELECT * FROM b_transcript_requests WHERE client_id=? ORDER BY requested_at,id', clientId) };
}

export async function createAuthorization(db: D1Database, actor: Actor, clientId: string, body: Data) {
  lead(actor);
  insist(await stmt(db, "SELECT 1 FROM b_clients WHERE id=? AND erased_at IS NULL AND merged_into IS NULL AND lifecycle='active'", clientId).first(), 'Client not found', 404);
  insist(KINDS.includes(body.kind), 'Choose Form 2848, Form 8821 or a state authorization');
  const agency = body.kind === 'state' ? text(body.agency, 'State agency', 120) : 'IRS', list = matters(body.matters);
  const email = optional(body.representativeEmail, 'Representative email', 254).toLowerCase();
  insist(!email || await eligible(db, email, ['reviewer', 'preparer']), 'A staff representative must be an active practice member');
  const caf = optional(body.cafNumber, 'CAF number', 20);
  insist(!caf || /^\d{4}-\d{5}[A-Z]$/.test(caf), 'Use the CAF number format 0000-00000R');
  const authorizationId = id();
  await atomic(db, actor, [stmt(db, `INSERT INTO b_authorizations(id,client_id,kind,agency,representative,representative_email,caf_number,matters,status,revision,created_by,created_at) VALUES(?,?,?,?,?,?,?,?,'draft',?,?,?)`,
    authorizationId, clientId, body.kind, agency, text(body.representative, 'Representative', 200), email || null, caf || null, JSON.stringify(list), id(), actor.email, now()),
    audit(db, actor, 'authorization.created', clientId, `${body.kind === 'state' ? agency : 'Form ' + body.kind}: ${list.map(m => `${m.form} ${m.from}-${m.to}`).join(', ')}`)]);
  return (await clientAuthorizations(db, actor, clientId)).authorizations.find(a => a.id === authorizationId);
}

/** The completed SIGN-002 request that holds the signed form; for 2848/8821 it carries the remote-authentication attestation. */
export async function linkAuthorizationSignature(db: D1Database, actor: Actor, authorizationId: string, body: Data) {
  lead(actor); const a = await record(db, authorizationId); changed(a, body);
  insist(a.status === 'draft', 'Only a draft authorization takes its signed form', 409);
  const s = await stmt(db, `SELECT s.id,s.status,s.completed_at,s.attestation_required,s.form_kind,j.client_id FROM b_signatures s JOIN b_jobs j ON j.id=s.job_id WHERE s.id=?`, text(body.signatureId, 'Signature request')).first<Data>();
  insist(s && s.client_id === a.client_id && s.status === 'completed', 'Choose a completed signature request for this client', 409);
  insist(a.kind === 'state' || s.attestation_required === 1, 'A Form 2848 or 8821 is signed only through its remote-authentication attestation', 409);
  insist(a.kind === 'state' || s.form_kind === a.kind, 'Choose a signature request for this authorization form', 409);
  await atomic(db, actor, [step(db, actor, a, 'signature_id=?,signed_on=?', s.id, String(s.completed_at).slice(0, 10)),
    audit(db, actor, 'authorization.signed', a.client_id, `Form ${a.kind} signed copy filed from signature request ${s.id}`)]);
  return record(db, a.id);
}

/** An electronically signed 2848 or 8821 may be submitted only online at IRS.gov/Submit2848. */
export async function recordAuthorizationSubmission(db: D1Database, actor: Actor, authorizationId: string, body: Data) {
  lead(actor); const a = await record(db, authorizationId); changed(a, body);
  insist(a.status === 'draft' && a.signature_id, 'File the signed form before recording its submission', 409);
  insist(METHODS.includes(body.method), 'Choose IRS online submission, Tax Pro Account or fax');
  insist(a.kind === 'state' || body.method === 'irs_online', 'This form was signed electronically, so it may be submitted only online at IRS.gov/Submit2848', 409);
  const on = date(body.submittedOn, 'Submission date');
  await atomic(db, actor, [step(db, actor, a, "status='submitted',submission_method=?,submitted_on=?", body.method, on),
    audit(db, actor, 'authorization.submitted', a.client_id, `Form ${a.kind} submitted ${body.method} on ${on}`)]);
  return record(db, a.id);
}

/** The agency's answer: recorded (with its CAF number) or rejected with the reason it gave. */
export async function recordAuthorizationStatus(db: D1Database, actor: Actor, authorizationId: string, body: Data) {
  lead(actor); const a = await record(db, authorizationId); changed(a, body);
  insist(a.status === 'submitted', 'Record the agency answer for a submitted authorization', 409);
  insist(body.status === 'recorded' || body.status === 'rejected', 'Choose recorded or rejected');
  const reason = body.status === 'rejected' ? text(body.reason, 'Rejection reason', 1000) : optional(body.reason, 'Note', 1000);
  const caf = optional(body.cafNumber, 'CAF number', 20) || a.caf_number || '';
  insist(!caf || /^\d{4}-\d{5}[A-Z]$/.test(caf), 'Use the CAF number format 0000-00000R');
  insist(body.status === 'rejected' || a.kind === 'state' || caf, 'Record the representative CAF number the IRS recorded', 400);
  await atomic(db, actor, [step(db, actor, a, 'status=?,status_reason=?,caf_number=?', body.status, reason || null, caf || null),
    audit(db, actor, `authorization.${body.status}`, a.client_id, `Form ${a.kind}${caf ? ` CAF ${caf}` : ''}${reason ? `: ${reason}` : ''}`)]);
  return record(db, a.id);
}

/** Notices this authorization covered: same agency and a covered year. */
async function coveredNotices(db: D1Database, a: Data) {
  const list: Matter[] = JSON.parse(a.matters), open = await rows(db, "SELECT id,agency,jurisdiction,tax_period FROM b_notices WHERE client_id=? AND status='open'", a.client_id);
  return open.filter(n => (a.kind === 'state' ? n.jurisdiction === 'state' && String(n.agency).toLowerCase() === String(a.agency).toLowerCase() : n.jurisdiction === 'federal')
    && list.some(m => yearOf(n.tax_period) >= m.from && yearOf(n.tax_period) <= m.to));
}
/** Withdrawal flags each dependent open notice in its timeline and ends this authorization's transcript requests. */
export async function withdrawAuthorization(db: D1Database, actor: Actor, authorizationId: string, body: Data) {
  lead(actor); const a = await record(db, authorizationId); changed(a, body);
  insist(a.status === 'recorded' || a.status === 'submitted', 'Only a submitted or recorded authorization can be withdrawn', 409);
  const reason = text(body.reason, 'Withdrawal reason', 1000), flagged = await coveredNotices(db, a), at = now();
  await atomic(db, actor, [step(db, actor, a, "status='withdrawn',status_reason=?", reason),
    stmt(db, "UPDATE b_transcript_requests SET status='withdrawn' WHERE authorization_id=? AND status='requested'", a.id),
    ...flagged.map(n => stmt(db, "INSERT INTO b_notice_events(id,notice_id,kind,note,by_email,at) VALUES(?,?,'note',?,?,?)", id(), n.id,
      `Authorization withdrawn (Form ${a.kind}): agency contact and transcript requests for this notice are refused until a new authorization is recorded. ${reason}`, actor.email, at)),
    ...flagged.map(n => audit(db, actor, 'notice.authorization_withdrawn', n.id, `Form ${a.kind} withdrawn: ${reason}`)),
    audit(db, actor, 'authorization.withdrawn', a.client_id, `Form ${a.kind}: ${reason}`)]);
  return { ...await record(db, a.id), flaggedNotices: flagged.map(n => n.id) };
}

/** The recorded authorization that covers a form and year, if any: 2848 or 8821 for transcripts, 2848 for representation. */
async function covering(db: D1Database, clientId: string, kinds: string[], form: string | null, year: number, agency?: string) {
  if (!Number.isFinite(year)) return null;
  for (const a of await rows(db, "SELECT * FROM b_authorizations WHERE client_id=? AND status='recorded' ORDER BY created_at", clientId)) {
    if (!kinds.includes(a.kind) || (agency && String(a.agency).toLowerCase() !== agency.toLowerCase())) continue;
    if ((JSON.parse(a.matters) as Matter[]).some(m => (!form || m.form.toLowerCase() === form.toLowerCase()) && year >= m.from && year <= m.to)) return a;
  }
  return null;
}
/** A transcript request proceeds only inside a recorded 2848 or 8821; retrieval itself is INTEGRATE-006. */
export async function requestTranscript(db: D1Database, actor: Actor, clientId: string, body: Data) {
  human(actor); need(actor, 'owner', 'reviewer', 'preparer');
  await readableClient(db, actor, clientId);
  insist(await stmt(db, 'SELECT 1 FROM b_clients WHERE id=? AND erased_at IS NULL', clientId).first(), 'Client not found', 404);
  const form = text(body.form, 'Tax form', 20).replace(/^Form\s+/i, ''), year = integer(body.year, 'Tax year', 1990, 2100), type = optional(body.transcriptType, 'Transcript type', 60) || 'Account transcript';
  const a = await covering(db, clientId, ['2848', '8821'], form, year);
  insist(a, `No recorded Form 2848 or 8821 covers Form ${form} for ${year}; this transcript request is outside the authorization's scope`, 409);
  const requestId = id();
  await atomic(db, actor, [stmt(db, "INSERT INTO b_transcript_requests(id,client_id,authorization_id,form,year,transcript_type,status,requested_by,requested_at) VALUES(?,?,?,?,?,?,'requested',?,?)", requestId, clientId, a.id, form, year, type, actor.email, now()),
    audit(db, actor, 'authorization.transcript_requested', clientId, `${type}: Form ${form} ${year} under Form ${a.kind}`)]);
  return { id: requestId, authorizationId: a.id, form, year, status: 'requested' };
}
/** Agency contact on a notice needs a recorded 2848 (federal) or the state's authorization covering the notice year. */
export async function agencyContactAuthority(db: D1Database, notice: Data, taxForm: unknown) {
  const year = yearOf(notice.tax_period);
  const form = text(taxForm, 'Tax form for agency contact', 20).replace(/^Form\s+/i, '');
  const a = notice.jurisdiction === 'federal' ? await covering(db, notice.client_id, ['2848'], form, year) : await covering(db, notice.client_id, ['state'], form, year, notice.agency);
  insist(a, `No recorded ${notice.jurisdiction === 'federal' ? 'Form 2848' : `${notice.agency} authorization`} covers ${Number.isFinite(year) ? year : notice.tax_period}; agency contact on this notice is outside the authorization's scope`, 409);
  return a;
}

/**
 * For a continuing engagement (an open job or an active recurring rule), one alert per recorded
 * authorization from October 1 of its last covered year: to the staff representative, or else the
 * principal, through the established notification preferences, quiet hours and live authority.
 */
export async function runAuthorizationAlerts(db: D1Database, at = new Date()) {
  const today = localClock(await firmSettings(db), at).localDate, sent: string[] = [];
  for (const a of await rows(db, `SELECT a.*,c.name client_name FROM b_authorizations a JOIN b_clients c ON c.id=a.client_id
    WHERE a.status='recorded' AND c.lifecycle='active' AND c.erased_at IS NULL AND c.merged_into IS NULL
    AND NOT EXISTS(SELECT 1 FROM b_notifications n WHERE n.id='authz-expiry:'||a.id)`)) {
    const last = Math.max(...(JSON.parse(a.matters) as Matter[]).map(m => m.to));
    if (today < `${last}-10-01`) continue;
    const work = await stmt(db, "SELECT id FROM b_jobs WHERE client_id=? AND status<>'signed_off' ORDER BY due_date LIMIT 1", a.client_id).first<Data>();
    if (!work && !await stmt(db, "SELECT 1 FROM b_recurrence_rules WHERE client_id=? AND status='active'", a.client_id).first()) continue;
    const to = a.representative_email ?? (await stmt(db, "SELECT email FROM oa_operators WHERE role='owner' AND status='active' ORDER BY created_at LIMIT 1").first<Data>())?.email;
    if (!to) continue;
    const label = a.kind === 'state' ? `${a.agency} authorization` : `Form ${a.kind}`;
    await db.batch([stmt(db, `INSERT OR IGNORE INTO b_notifications(id,to_email,kind,job_id,summary,delivery,created_at) VALUES(?,?,'authorization_expiring',?,?,'deferred: outside firm notification hours',?)`,
      'authz-expiry:' + a.id, to, work?.id ?? null, `${label} for ${a.client_name} covers through ${last}; renew it for continuing work`, now()),
      stmt(db, 'INSERT INTO b_audit(id,actor,action,object_id,detail,at) VALUES(?,?,?,?,?,?)', id(), 'authorization scheduler', 'authorization.expiry_alert', a.client_id, `${label} covers through ${last}; alert to ${to}`, now())]);
    sent.push(a.id);
  }
  return sent;
}
