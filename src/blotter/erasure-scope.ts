// ERASURE-002 scope: every client-linked table, with the one SQL predicate that
// both counts a step in the preview and applies it on approval. Retention marks
// (holds and retain-until dates) are evaluated here and nowhere else.
// Semantic adopted until ct rules (CONTRACT.md ERASURE-002): payloads, free text and
// personal values are erased or redacted; identity, authorship, times, markers,
// sign-off, amounts and hashes stay; records the principal marked are kept whole.
import { digest, insist, stmt, type Data } from './model';

export const lit = (value: string | number) => typeof value === 'number' ? String(value) : `'${value.replace(/'/g, "''")}'`;
export type Action = 'redact' | 'delete' | 'cascade';
export type Step = { table: string; action: Action; label: string; where: string; set?: string };
export type Context = { client: string; today: string; at: string; who: string; reason: string };

const MARK = '[erased]';
/** Every selector below is a SQL fragment over literals the server itself produced. */
export function selectors(x: Context) {
  const c = lit(x.client), active = `released_at IS NULL AND (kind='hold' OR until>=${lit(x.today)})`;
  const held = (scope: string) => `(SELECT target_id FROM b_retention_marks WHERE client_id=${c} AND scope='${scope}' AND ${active})`;
  const JALL = `(SELECT id FROM b_jobs WHERE client_id=${c})`;
  const JA = `(SELECT id FROM b_jobs WHERE client_id=${c} AND id NOT IN ${held('job')})`;
  const JR = `(SELECT id FROM b_jobs WHERE client_id=${c} AND id NOT IN ${held('job')} AND status<>'signed_off')`;
  const ORG = `(SELECT id FROM b_job_organizers WHERE job_id IN ${JA})`;
  return {
    c, held, JALL, JA, JR, ORG,
    K: `(SELECT id FROM b_client_contacts WHERE client_id=${c})`,
    HF: held('file'),
    // Eligible originals: not on a held job and not individually held.
    FA: `(SELECT id FROM b_files WHERE job_id IN ${JA} AND id NOT IN ${held('file')})`,
    SUBS: `(SELECT id FROM b_organizer_submissions WHERE organizer_id IN ${ORG})`,
    BR: `(SELECT id FROM b_bulk_recipients WHERE client_id=${c})`,
    P: `(SELECT id FROM b_prospects WHERE client_id=${c})`,
    TH: `(SELECT id FROM b_threads WHERE client_id=${c} AND (job_id IS NULL OR job_id IN ${JA}))`,
    NT: `(SELECT id FROM b_notices WHERE client_id=${c} AND job_id IN ${JA})`,
    TIME: `(SELECT id FROM b_time WHERE job_id IN ${JA})`,
  };
}

/** Steps run in this order inside one atomic batch. Predicates never read a column an earlier step rewrites. */
export function steps(x: Context, audited: { where: string; set: string } | null): Step[] {
  const s = selectors(x), at = lit(x.at), who = lit(x.who), why = lit(x.reason);
  const text = (col: string) => `${col}=CASE WHEN ${col} IS NULL OR ${col}='' THEN ${col} ELSE '${MARK}' END`;
  const list: Step[] = [
    { table: 'b_marketing_consents', action: 'redact', label: 'Marketing consent events: address, wording and evidence (actor, time and kind stay)', where: `contact_id IN ${s.K} OR client_id=${s.c}`,
      set: `address='erased+'||substr(id,1,8)||'@erased.invalid',${text('wording')},${text('evidence')},${text('reason')}` },
    { table: 'b_bulk_events', action: 'redact', label: 'Bulk message provider events', where: `recipient_id IN ${s.BR}`, set: `detail='${MARK}'` },
    { table: 'b_unsubscribe_tokens', action: 'delete', label: 'Unsubscribe tokens', where: `recipient_id IN ${s.BR}` },
    { table: 'b_bulk_recipients', action: 'redact', label: 'Bulk message recipients: address, subject, body (unsent mail is held)', where: `client_id=${s.c}`,
      set: `address='',subject=NULL,body=NULL,attachments='[]',misclassified_reason=NULL,held_reason=CASE WHEN status IN ('pending','claimed') THEN 'client erased' ELSE held_reason END,status=CASE WHEN status IN ('pending','claimed') THEN 'held' ELSE status END` },
    { table: 'b_bulk_exclusions', action: 'redact', label: 'Bulk message exclusions: address', where: `client_id=${s.c}`, set: `address=''` },
    { table: 'b_mail_suppressions', action: 'delete', label: 'Plain-text bounce suppressions (replaced by one-way digests)', where: `address IN (SELECT email FROM b_client_contacts WHERE client_id=${s.c} AND email<>'')` },
    { table: 'b_document_grants', action: 'delete', label: 'Document grants to contacts', where: `contact_id IN ${s.K}` },
    { table: 'b_document_shares', action: 'delete', label: 'Document share links', where: `contact_id IN ${s.K}` },
    { table: 'b_portal_links', action: 'redact', label: 'Client upload links (revoked)', where: `job_id IN ${s.JALL} AND revoked_at IS NULL`, set: `revoked_at=${at}` },
    { table: 'b_client_contacts', action: 'redact', label: 'Contacts: name, email, phone, roles and consent flags', where: `client_id=${s.c}`,
      set: `name='Erased contact',first_name='',last_name='',email='',phone='',roles='[]',authorized=0,signer=0,portal=0,request_consent=0,email_consent=0,active=0,consent_note='',revision=lower(hex(randomblob(16))),updated_by=${who},updated_at=${at}` },
    { table: 'b_prospect_events', action: 'redact', label: 'Prospect pipeline notes', where: `prospect_id IN ${s.P}`, set: `note=''` },
    { table: 'b_prospect_files', action: 'redact', label: 'Intake upload bytes', where: `prospect_id IN ${s.P} AND erased_at IS NULL`, set: `content_base64=NULL,erased_at=${at}` },
    { table: 'b_prospects', action: 'redact', label: 'Intake prospects: name, contacts, answers', where: `client_id=${s.c}`,
      set: `name='Erased prospect',contact_name='',contact_email='',answers='{}',lost_reason=NULL,contacts='[]'` },
    { table: 'b_document_upload_chunks', action: 'delete', label: 'Unfinished upload chunks', where: `upload_id IN (SELECT id FROM b_document_uploads WHERE job_id IN ${s.JA})` },
    { table: 'b_document_uploads', action: 'delete', label: 'Unfinished upload sessions', where: `job_id IN ${s.JA}` },
    { table: 'b_document_chunks', action: 'cascade', label: 'Chunked original bytes (removed with their file)', where: `file_id IN ${s.FA}` },
    { table: 'b_file_text', action: 'delete', label: 'Extracted document text', where: `file_id IN ${s.FA}` },
    { table: 'b_document_annotations', action: 'redact', label: 'Document annotations', where: `file_id IN ${s.FA}`, set: `note='${MARK}'` },
    { table: 'b_document_packets', action: 'redact', label: 'Document review notes', where: `file_id IN ${s.FA} AND review_note IS NOT NULL AND review_note<>''`, set: `review_note='${MARK}'` },
    { table: 'b_files', action: 'redact', label: 'Uploaded file bytes (name, hash and history stay)', where: `id IN ${s.FA} AND erased_at IS NULL`, set: `content_base64=NULL,erased_at=${at},erased_by=${who},erase_reason=${why}` },
    { table: 'b_job_answers', action: 'redact', label: 'Workflow answers and organizer projections', where: `job_id IN ${s.JA} AND value IS NOT NULL`, set: `value=NULL` },
    { table: 'b_requests', action: 'redact', label: 'Request notes', where: `job_id IN ${s.JA} AND note<>''`, set: `note=''` },
    { table: 'b_organizer_answers', action: 'redact', label: 'Organizer drafts and still-derived carry', where: `(organizer_id IN ${s.ORG} OR carried_from IN ${s.SUBS}) AND value IS NOT NULL`, set: `value=NULL,confirmed=0` },
    { table: 'b_organizer_submissions', action: 'redact', label: 'Submitted organizer originals (authors, times and review markers stay)', where: `organizer_id IN ${s.ORG} AND erased_at IS NULL`, set: `answers=NULL,review_note=NULL,erased_at=${at}` },
    { table: 'b_organizer_deliveries', action: 'redact', label: 'Organizer delivery mail: address, subject, message', where: `organizer_id IN ${s.ORG}`, set: `to_email='',subject='',message='${MARK}',attachments='[]'` },
    { table: 'b_job_organizers', action: 'redact', label: 'Organizers (erasure marker and attribution)', where: `(id IN ${s.ORG} AND erased_at IS NULL) OR id IN (SELECT organizer_id FROM b_organizer_answers WHERE carried_from IN ${s.SUBS})`,
      set: `erased_at=COALESCE(erased_at,${at}),erased_by=COALESCE(erased_by,${who}),erase_reason=COALESCE(erase_reason,${why}),revision=lower(hex(randomblob(16)))` },
    { table: 'b_portal_items', action: 'redact', label: 'Portal questions, messages and responses', where: `job_id IN ${s.JA}`,
      set: `body='${MARK}',${text('response')},${text('subject')},attachments='[]'` },
    { table: 'b_reminders', action: 'redact', label: 'Reminder mail: address, subject, message', where: `job_id IN ${s.JA}`, set: `to_email='',message='${MARK}',subject=NULL,attachments='[]',outstanding='[]'` },
    { table: 'b_readiness_questions', action: 'redact', label: 'Readiness decisions and resolutions', where: `job_id IN ${s.JA} AND (decision_note IS NOT NULL OR resolution IS NOT NULL)`, set: `decision_note=NULL,resolution=NULL` },
    { table: 'b_thread_messages', action: 'redact', label: 'Discussion messages (authors and times stay)', where: `thread_id IN ${s.TH}`, set: `body='${MARK}',mentions='[]'` },
    { table: 'b_threads', action: 'redact', label: 'Discussion titles and resolutions', where: `id IN ${s.TH}`, set: `title='${MARK}',${text('resolution')}` },
    { table: 'b_notice_events', action: 'redact', label: 'Notice notes and attachments', where: `notice_id IN ${s.NT}`, set: `note='${MARK}',file_base64=NULL` },
    { table: 'b_notices', action: 'redact', label: 'Notice plans and outcome notes', where: `id IN ${s.NT}`, set: `plan='',authorization='',${text('outcome_note')}` },
    { table: 'b_job_steps', action: 'redact', label: 'Task attachment bytes', where: `job_id IN ${s.JA} AND attachment_base64 IS NOT NULL`, set: `attachment_base64=NULL` },
    { table: 'b_jobs', action: 'redact', label: 'Open work titles and notes (signed-off jobs stay whole)', where: `id IN ${s.JR}`, set: `title='Erased work',due_note=''` },
    { table: 'b_time_adjustments', action: 'redact', label: 'Time adjustment reasons (amounts stay)', where: `entry_id IN ${s.TIME}`, set: `reason='${MARK}'` },
    { table: 'b_time', action: 'redact', label: 'Time entry descriptions (minutes, rates and amounts stay)', where: `id IN ${s.TIME}`, set: `description='${MARK}'` },
    { table: 'b_expenses', action: 'redact', label: 'Expense descriptions and receipts (amounts stay)', where: `client_id=${s.c} AND job_id IN ${s.JA}`,
      set: `description='${MARK}',receipt_name=NULL,receipt_mime=NULL,receipt_size=NULL,receipt_base64=NULL` },
    { table: 'b_timers', action: 'delete', label: 'Running timers', where: `job_id IN ${s.JA}` },
    { table: 'b_time_suggestions', action: 'delete', label: 'Time suggestions', where: `job_id IN ${s.JA}` },
    { table: 'b_plan_items', action: 'delete', label: 'Daily plan items', where: `job_id IN ${s.JA}` },
    { table: 'b_notifications', action: 'redact', label: 'Staff notification text', where: `job_id IN ${s.JA}`, set: `summary='${MARK}'` },
    { table: 'b_proposals', action: 'redact', label: 'Agent proposals for this work (derived drafts)', where: `kind IN ('rollforward','reminder') AND json_extract(payload,'$.jobId') IN ${s.JA} AND payload<>'{}'`, set: `payload='{}'` },
    { table: 'b_deliverable_versions', action: 'redact', label: 'Deliverable versions not approved by the client', where: `job_id IN ${s.JA} AND status<>'approved'`, set: `content_base64='',note='${MARK}',${text('comment')}` },
    { table: 'b_vault_credentials', action: 'redact', label: 'Stored credentials (ciphertext erased)', where: `client_id=${s.c} AND erased_at IS NULL`, set: `sealed=NULL,erased_at=${at},erased_by=${who},erase_reason=${why},revision=revision+1` },
    { table: 'b_vault_reveals', action: 'redact', label: 'Credential reveal labels', where: `client_id=${s.c}`, set: `label='${MARK}'` },
    { table: 'b_client_group_members', action: 'delete', label: 'Group memberships', where: `client_id=${s.c}` },
    { table: 'b_client_import_bindings', action: 'delete', label: 'Import source bindings', where: `client_id=${s.c}` },
    { table: 'b_api_client_writes', action: 'delete', label: 'API idempotency receipts', where: `client_id=${s.c}` },
    { table: 'b_duplicate_dismissals', action: 'delete', label: 'Duplicate-review dismissals', where: `client_a=${s.c} OR client_b=${s.c}` },
  ];
  if (audited) list.push({ table: 'b_audit', action: 'redact', label: 'Audit detail naming the client or its contacts (actor, action, object and time stay)', where: audited.where, set: audited.set });
  list.push({ table: 'b_clients', action: 'redact', label: 'Client record: name, identifiers and fields (id, dates and work links stay)', where: `id=${s.c}`,
    set: `name='Erased client '||substr(id,1,8),abn='',contact_name='',contact_email='',source='erased',fields='{}',tags='[]',ssn_last4='',lifecycle='archived',erased_at=${at},revision=lower(hex(randomblob(16)))` });
  return list;
}

/** Named exceptions: what stays, why, and who owns it. Counts only. */
export function retained(x: Context) {
  const s = selectors(x);
  return [
    { key: 'signed_off_jobs', label: 'Signed-off job records (sign-off, attribution, dates, fees)', reason: 'Required signed evidence; the principal may hold or release it, nothing deletes it automatically.', owner: 'Principal', sql: `SELECT count(*) n FROM b_jobs WHERE client_id=${s.c} AND status='signed_off' AND id NOT IN ${s.held('job')}` },
    { key: 'held_jobs', label: 'Held jobs and everything attached to them', reason: 'Principal hold or retain-until date.', owner: 'Principal', sql: `SELECT count(*) n FROM b_jobs WHERE client_id=${s.c} AND id IN ${s.held('job')}` },
    { key: 'held_files', label: 'Held uploaded files', reason: 'Principal hold or retain-until date.', owner: 'Principal', sql: `SELECT count(*) n FROM b_files WHERE (job_id IN ${s.held('job')} OR id IN ${s.HF}) AND job_id IN ${s.JALL}` },
    { key: 'billing_time', label: 'Billed and billable time entries (minutes, rates, amounts)', reason: 'Billing evidence.', owner: 'Principal', sql: `SELECT count(*) n FROM b_time WHERE job_id IN ${s.JALL}` },
    { key: 'billing_expenses', label: 'Expense amounts, dates and approvals', reason: 'Billing evidence.', owner: 'Principal', sql: `SELECT count(*) n FROM b_expenses WHERE client_id=${s.c}` },
    { key: 'billing_exports', label: 'Billing exports containing this client\'s lines', reason: 'Approved exports are immutable billing evidence.', owner: 'Principal',
      sql: `SELECT count(DISTINCT export_id) n FROM b_export_sources WHERE source_key IN (SELECT 'time:'||id FROM b_time WHERE job_id IN ${s.JALL}) OR source_key IN (SELECT 'exp:'||id FROM b_expenses WHERE client_id=${s.c}) OR source_key IN (SELECT 'fee:'||id FROM b_jobs WHERE client_id=${s.c})` },
    { key: 'approved_deliverables', label: 'Deliverable versions the client approved', reason: 'Signed client approval evidence.', owner: 'Principal', sql: `SELECT count(*) n FROM b_deliverable_versions WHERE job_id IN ${s.JALL} AND status='approved'` },
    { key: 'work_structure', label: 'Job steps, status history and deadline records without client payload', reason: 'Work history and attribution.', owner: 'Principal', sql: `SELECT count(*) n FROM b_jobs WHERE client_id=${s.c}` },
  ];
}
export const rowsOf = (result: Data | null) => Number(result?.n ?? 0);

/** One-way digest of an address; the address itself is erased with its client. */
export const suppressionDigest = (address: string) => digest('blotter-suppression:v1:' + address.trim().toLowerCase());
/** True when the address withdrew or bounced before an erasure and the person has not acted since. */
export async function erasedAddress(db: D1Database, address: string, actedAt: string) {
  const row = await stmt(db, 'SELECT at FROM b_erased_suppressions WHERE digest=?', await suppressionDigest(address)).first<Data>();
  return !!row && actedAt <= String(row.at);
}
export async function refuseErasedAddress(db: D1Database, address: string, actedAt: string) {
  insist(!await erasedAddress(db, address, actedAt), 'This address withdrew consent or bounced before a client erasure. Record a grant only for an opt-in the person made after that erasure.', 409);
}
