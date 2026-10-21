import { staffDownload } from './document-shares';
// Public intake and approved spam checks (CRM-005; ct 19 Oct 10:05Z).
import type { Bindings } from '../auth.server';
import { decodeFile } from './documents';
import { INTAKE_MARKETING } from './marketing-consent';
import { digest, guard, id, insist, now, rows, stmt, text, email, optional, type Actor, type Data } from './model';

const HOUR = 3_600_000, DAY = 24 * HOUR;
async function mac(secret: string, value: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return [...new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value)))].map(n => n.toString(16).padStart(2, '0')).join('');
}
export async function intakeToken(secret: string) {
  const value = `${Date.now()}.${id()}`;
  return `${value}.${await mac(secret, 'intake:' + value)}`;
}
export async function clearIntakeChecks(db: D1Database) {
  const at = Date.now();
  await db.batch([stmt(db, 'DELETE FROM b_intake_limits WHERE expires_at<=?', at), stmt(db, 'DELETE FROM b_intake_tokens WHERE expires_at<=?', at)]);
}

/** All validation precedes the single atomic insert; a refusal stores no submission or IP. */
export async function submitIntake(env: Bindings, request: Request, body: Data) {
  insist(new URL(request.url).origin === env.AUTH_ORIGIN && request.headers.get('origin') === env.AUTH_ORIGIN, 'Invalid request origin', 403);
  const token = text(body.token, 'Spam checks token', 200), [stamp, nonce, signature, extra] = token.split('.'), at = Date.now();
  insist(!extra && /^\d+$/.test(stamp) && nonce && signature === await mac(env.SESSION_SECRET, `intake:${stamp}.${nonce}`), 'Spam checks: invalid token', 400);
  insist(at - Number(stamp) >= 3000 && at - Number(stamp) <= DAY, 'Spam checks: wait at least 3 seconds; reload after 24 hours', 400);
  insist(!body.website, 'Spam checks: submission rejected', 400);
  insist(body.consent === true, 'Consent to contact about this inquiry is required');
  if (env.TURNSTILE_SITE_KEY && env.TURNSTILE_SECRET_KEY) {
    const response = text(body.turnstileToken, 'Spam checks challenge', 2048);
    const verification = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: new URLSearchParams({ secret: env.TURNSTILE_SECRET_KEY, response }) });
    insist(verification.ok, 'Spam checks: challenge service unavailable', 503);
    insist((await verification.json() as {success?: boolean}).success === true, 'Spam checks: challenge rejected');
  }
  const name = text(body.name, 'Business or individual name', 200), contact = text(body.contactName, 'Contact name', 200), contactEmail = email(body.contactEmail, 'Contact email');
  const source = optional(body.source, 'Lead source', 120) || 'Website intake', services = text(body.services, 'Requested services', 1000).split(',').map(s => s.trim()).filter(Boolean);
  insist(services.length > 0 && services.length <= 20 && services.every(s => s.length <= 120), 'List up to 20 requested services');
  const consentAt = now();
  // The optional marketing checkbox is the contact's own opt-in (MSG-002); its grant follows the contact when the prospect is won.
  const answers = { feeBand: optional(body.feeBand, 'Estimated annual budget', 120), details: optional(body.details, 'Inquiry details', 4000), consent: 'Your details go only to this practice to reply to this inquiry.', consentAt,
    ...(body.marketing === true ? { marketing: { ...INTAKE_MARKETING, at: consentAt } } : {}) };
  const recorded = body.marketing === true ? 'Website inquiry; consent and marketing opt-in recorded' : 'Website inquiry; consent recorded';
  insist(Array.isArray(body.uploads ?? []) && (body.uploads ?? []).length <= 3, 'Upload up to three files');
  const files = [];
  for (const f of body.uploads ?? []) { const decoded = decodeFile(f); files.push({ ...decoded, id: id(), hash: await digest(decoded.bytes) }); }
  const ip = request.headers.get('CF-Connecting-IP');
  insist(ip, 'Spam checks: client address unavailable', 400);
  // Domain-separated HMACs: raw addresses never enter a database, archive or audit.
  const ipDigest = await mac(env.SESSION_SECRET, 'intake-ip:' + ip), tokenDigest = await digest(token);
  const owner = await stmt(env.DB, "SELECT email FROM oa_operators WHERE role='owner' AND status='active' AND email=?", env.OWNER_EMAIL.toLowerCase()).first<{email: string}>();
  insist(owner, 'The practice is not accepting inquiries yet', 503);
  const count = await stmt(env.DB, 'SELECT COUNT(*) n FROM b_intake_limits WHERE ip_digest=? AND expires_at>?', ipDigest, at).first<{n:number}>();
  insist(Number(count?.n ?? 0) < 5, 'Spam checks: five inquiries per hour; try again later', 429);
  insist(!await stmt(env.DB, 'SELECT 1 FROM b_intake_tokens WHERE digest=? AND expires_at>?', tokenDigest, at).first(), 'Spam checks: this form was already submitted', 409);
  const prospectId = id(), time = now(), [check, release] = guard(env.DB,
    `(SELECT COUNT(*) FROM b_intake_limits WHERE ip_digest=? AND expires_at>?)<5 AND NOT EXISTS(SELECT 1 FROM b_intake_tokens WHERE digest=?) AND EXISTS(SELECT 1 FROM oa_operators WHERE email=? AND role='owner' AND status='active')`, ipDigest, at, tokenDigest, owner.email);
  try {
    await env.DB.batch([check,
      stmt(env.DB, "INSERT INTO b_prospects(id,name,contact_name,contact_email,source,services,fee_cents,owner_email,stage_id,stage_since,answers,created_by,created_at,currency) VALUES(?,?,?,?,?,?,0,?,'ps-inquiry',?,?,'website',?,'USD')", prospectId, name, contact, contactEmail, source, JSON.stringify(services), owner.email, time, JSON.stringify(answers), time),
      ...files.map(f => stmt(env.DB, 'INSERT INTO b_prospect_files(id,prospect_id,name,mime,size,sha256,content_base64,uploaded_at) VALUES(?,?,?,?,?,?,?,?)', f.id, prospectId, f.name, f.mime, f.bytes.length, f.hash, f.encoded, time)),
      stmt(env.DB, "INSERT INTO b_prospect_events(id,prospect_id,to_stage,note,by_email,at) VALUES(?,?,'ps-inquiry',?,'website',?)", id(), prospectId, recorded, time),
      stmt(env.DB, "INSERT INTO b_audit(id,actor,action,object_id,detail,at) VALUES(?,'website','prospect.intake',?,?,?)", id(), prospectId, recorded, time),
      stmt(env.DB, 'INSERT INTO b_intake_limits(id,ip_digest,expires_at) VALUES(?,?,?)', id(), ipDigest, at + HOUR),
      stmt(env.DB, 'INSERT INTO b_intake_tokens(digest,expires_at) VALUES(?,?)', tokenDigest, Number(stamp) + DAY),
      stmt(env.DB, 'DELETE FROM b_intake_limits WHERE expires_at<=?', at),
      stmt(env.DB, 'DELETE FROM b_intake_tokens WHERE expires_at<=?', at), release]);
  } catch (e) { if (/constraint|b_guard|UNIQUE/i.test(String(e))) { insist(false, 'Spam checks: already submitted or hourly limit reached', 409); } throw e; }
  return { received: true };
}

export async function intakeFile(db: D1Database, actor: Actor, prospectId: string, fileId: string) {
  insist(['owner', 'reviewer'].includes(actor.role), 'Your role cannot read intake uploads', 403);
  const f = await stmt(db, 'SELECT * FROM b_prospect_files WHERE id=? AND prospect_id=? AND erased_at IS NULL', fileId, prospectId).first<Data>();
  insist(f, 'File not found', 404);
  return staffDownload(db,actor,'intake:'+fileId);
}
export async function prospectUploads(db: D1Database) {
  return rows(db, 'SELECT p.id,p.prospect_id,p.name,p.mime,p.size,p.sha256,p.uploaded_at,coalesce(f.erased_at,p.erased_at) erased_at,p.job_file_id FROM b_prospect_files p LEFT JOIN b_files f ON f.id=p.job_file_id ORDER BY p.uploaded_at');
}
