// SIGN-002 (ct 22 Oct): a staff representative signs through their own authenticated session,
// and a staff member records the remote-authentication attestation a Form 2848 or 8821 needs
// before a remote signer's signature is accepted.
import { canAccessClient, clientAuthority } from './permissions';
import { atomic, date, guard, human, insist, now, rows, stmt, text, type Actor, type Data } from './model';
import { CONSENT_VERSION, SIGNING_CONSENT } from './signatures-pdf';
import { recordSignature, type Connection } from './signatures-portal';
import { sameRequest, signatureEvent, signatureRecord, signerRows, staffSignature } from './signatures-store';

export const staffRef = (address: string) => 'staff:' + address;
const ITEMS = ['name', 'ssn_or_itin', 'address', 'date_of_birth'], METHODS = ['photo_id_selfie', 'photo_id_video', 'personal_knowledge'];

/** The request, and the signer row, only for the staff member named as a signer in the attempt being signed. */
async function ownTurn(db: D1Database, actor: Actor, requestId: string) {
  human(actor); insist(!actor.automation && !actor.readOnly, 'A person with working access must sign', 403);
  const r = await signatureRecord(db, requestId);
  insist(!r.erased_at && !r.client_erased_at && r.status !== 'draft', 'Signature request not found', 404);
  const signers = await signerRows(db, r), s = signers.find(x => x.signer_kind === 'staff' && x.email === actor.email);
  insist(s && await canAccessClient(db, actor.email, r.client_id), 'Signature request not found', 404);
  return { r, s: s!, signers };
}
export async function isStaffSigner(db: D1Database, actor: Actor, r: Data) {
  return actor.channel === 'person' && !!(await signerRows(db, r)).some(x => x.signer_kind === 'staff' && x.email === actor.email) && await canAccessClient(db, actor.email, r.client_id);
}
export async function awaitingSignatures(db: D1Database, actor: Actor) {
  human(actor);
  const list = await rows(db, `SELECT r.id,r.title,r.mode,r.attempt,r.revision,r.client_id_,s.ordinal FROM (SELECT b_signatures.*,j.client_id client_id_ FROM b_signatures JOIN b_jobs j ON j.id=b_signatures.job_id JOIN b_clients c ON c.id=j.client_id WHERE b_signatures.status='pending' AND b_signatures.erased_at IS NULL AND c.erased_at IS NULL) r
    JOIN b_signature_signers s ON s.request_id=r.id AND s.attempt=r.attempt WHERE s.signer_kind='staff' AND s.email=? AND s.status='pending' ORDER BY r.created_at,r.id`, actor.email);
  const out: Data[] = [];
  for (const r of list) if (await canAccessClient(db, actor.email, r.client_id_)) {
    const signers = await rows(db, 'SELECT ordinal,status FROM b_signature_signers WHERE request_id=? AND attempt=?', r.id, r.attempt);
    out.push({ id: r.id, title: r.title, mode: r.mode, attempt: r.attempt, canSign: r.mode === 'parallel' || !signers.some(x => x.ordinal < r.ordinal && x.status !== 'signed') });
  }
  return out;
}
export async function staffSigningView(db: D1Database, actor: Actor, requestId: string) {
  const { r, s, signers } = await ownTurn(db, actor, requestId), fields: Data[] = JSON.parse(r.fields), earlier = signers.some(x => x.ordinal < s.ordinal && x.status !== 'signed');
  return { id: r.id, title: r.title, status: r.status, mode: r.mode, attempt: r.attempt, revision: r.revision, contactId: s.contact_id, signerName: s.name, pages: JSON.parse(r.pages), fields: fields.filter(f => f.contactId === s.contact_id),
    signerStatus: s.status, signers: signers.map(x => ({ ordinal: x.ordinal, name: x.name, status: x.status, signedAt: x.signed_at, kind: x.signer_kind })), canSign: r.status === 'pending' && s.status === 'pending' && (r.mode === 'parallel' || !earlier),
    consentText: SIGNING_CONSENT, consentVersion: CONSENT_VERSION, hasSigned: r.status === 'completed' };
}
export async function staffSign(db: D1Database, actor: Actor, requestId: string, body: Data, connection: Connection) {
  const { r, s, signers } = await ownTurn(db, actor, requestId);
  const fence = guard(db, `EXISTS(SELECT 1 FROM b_signatures x JOIN b_jobs j ON j.id=x.job_id JOIN b_clients c ON c.id=j.client_id WHERE x.id=? AND x.revision=? AND x.erased_at IS NULL AND j.status<>'signed_off'
    AND c.lifecycle='active' AND c.merged_into IS NULL AND c.erased_at IS NULL AND ${clientAuthority(actor, 'c.id')}) AND NOT EXISTS(SELECT 1 FROM b_access_members am WHERE am.email=? AND am.read_only=1)`, r.id, r.revision, actor.email);
  return recordSignature(db, { r, s, signers, body, fence, evidence: 'session ' + (actor.sessionId ?? 'unknown'), actor: actor.email, connection });
}
/** A remote signer of Form 2848 or 8821 is accepted only after this record: how they were authenticated, by whom, when, and what was checked. */
export async function recordAttestation(db: D1Database, actor: Actor, requestId: string, body: Data) {
  const r = await staffSignature(db, actor, requestId, true);
  insist(r.attestation_required, 'This document does not need a remote-authentication attestation', 409);
  insist(['draft', 'pending'].includes(r.status), 'Record the attestation for the attempt being signed; resend a declined or restored request first', 409);
  const contactId = text(body.contactId, 'Signer'), s = (await signerRows(db, r)).find(x => x.contact_id === contactId && x.signer_kind === 'contact');
  insist(s, 'Choose a contact signer of this request', 404);
  insist(!await stmt(db, 'SELECT 1 FROM b_signature_attestations WHERE request_id=? AND attempt=? AND contact_id=?', r.id, r.attempt, contactId).first(), 'An attestation is already recorded for this signer and attempt', 409);
  insist(METHODS.includes(body.method), 'Choose photo ID by selfie, photo ID by video, or personal knowledge');
  const verifier = text(body.verifier, 'Verifier', 200), verifiedOn = date(body.verifiedOn, 'Verification date');
  insist(verifiedOn <= now().slice(0, 10), 'The verification date cannot be in the future');
  insist(Array.isArray(body.items) && body.items.every((i: unknown) => ITEMS.includes(i as string)), 'List the items checked: name, SSN or ITIN, address, date of birth');
  const items = [...new Set<string>(body.items)], photo = body.method !== 'personal_knowledge';
  insist(!photo || ITEMS.every(i => items.includes(i)), 'A photo ID check records the name, SSN or ITIN, address and date of birth checked against a secondary document');
  const secondary = photo ? text(body.secondaryDocument, 'Secondary document checked', 500) : null, note = photo ? null : text(body.note, 'How the personal knowledge was established', 1000);
  const [check, done] = sameRequest(db, r, actor);
  await atomic(db, actor, [check, stmt(db, 'INSERT INTO b_signature_attestations(request_id,attempt,contact_id,method,verifier,verified_on,items,secondary_document,note,recorded_by,recorded_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)',
    r.id, r.attempt, contactId, body.method, verifier, verifiedOn, JSON.stringify(items), secondary, note, actor.email, now()),
    ...signatureEvent(db, r, 'attested', actor.email, `${String(body.method).replaceAll('_', ' ')} attestation recorded for ${s!.name} by ${verifier}`, contactId), done]);
  return { requestId: r.id, attempt: r.attempt, contactId, method: body.method };
}
