import {signatureErasureSteps,signatureRetained} from './signatures-retention';
import { invoiceErasureSteps,invoiceRetainedRows,invoiceSnapshotIdsSql } from './invoices-erasure';
// ERASURE-002 scope (ct 22 Oct 2026): every client-linked table, with the one SQL predicate that
// both counts a step in the preview and applies it on approval. Signed-off work, signed
// engagements and billing evidence are retained whole until their clocks expire; everything else
// is removed or has its payload replaced by the erasure marker; derived AI data is deleted.
// Holds are evaluated here and nowhere else: a class, job or file under a hold is skipped and
// listed; only access revocation (the `link` class) runs under a hold.
import { digest, insist, stmt, type Data } from './model';
import { classOf, type ClientClass } from './erasure-registry';

export const lit = (value: string | number) => typeof value === 'number' ? String(value) : `'${value.replace(/'/g, "''")}'`;
export type Action = 'redact' | 'delete' | 'cascade';
export type StepClass = ClientClass | 'audit' | 'structure';
export type Step = { table: string; action: Action; label: string; where: string; set?: string; cls: StepClass; held?: boolean };
/** What the principal's active marks preserve: the whole client, record classes, jobs and files. */
export type Held = { client: boolean; classes: string[]; jobs: string[]; files: string[] };
export type Context = { client: string; today: string; at: string; who: string; reason: string; label: string; held: Held };

const MARK = '[erased]';
const list = (ids: string[]) => ids.length ? `(${ids.map(lit).join(',')})` : "('')";
/** Every selector below is a SQL fragment over literals the server itself produced. */
export function selectors(x: Context) {
  const c = lit(x.client), HJ = list(x.held.jobs), HF = list(x.held.files);
  const JALL = `(SELECT id FROM b_jobs WHERE client_id=${c})`;
  // Jobs this erasure may touch: not held. Every job is signed off by now: open work refuses erasure.
  const JE = `(SELECT id FROM b_jobs WHERE client_id=${c} AND id NOT IN ${HJ})`;
  // Accepted documents of signed-off work are retained; everything else uploaded is eligible.
  const FR = `(SELECT f.id FROM b_files f JOIN b_requests r ON r.id=f.request_id JOIN b_jobs j ON j.id=f.job_id WHERE j.client_id=${c} AND j.status='signed_off' AND r.status='accepted')`;
  const ORG = `(SELECT id FROM b_job_organizers WHERE job_id IN ${JE})`;
  // A submitted organizer original is consumed by the signed-off job when it was submitted before sign-off.
  const CONSUMED = `(SELECT s.id FROM b_organizer_submissions s JOIN b_job_organizers o ON o.id=s.organizer_id JOIN b_jobs j ON j.id=o.job_id WHERE j.status='signed_off' AND s.submitted_at<=j.signed_off_at)`;
  // Readiness decisions a signed-off job consumed.
  const RQR = `(SELECT q.id FROM b_readiness_questions q JOIN b_jobs j ON j.id=q.job_id WHERE q.status IN ('declined','resolved') AND j.status='signed_off')`;
  const snapshot = (prefix: string) => `(SELECT substr(s.source_key,${prefix.length + 1}) FROM b_export_sources s JOIN b_exports e ON e.id=s.export_id WHERE e.status='approved' AND substr(s.source_key,1,${prefix.length})='${prefix}' UNION SELECT * FROM ${invoiceSnapshotIdsSql(prefix)})`;
  return {
    c, HJ, HF, JALL, JE, FR, ORG, CONSUMED, RQR,
    K: `(SELECT id FROM b_client_contacts WHERE client_id=${c})`,
    FE: `(SELECT id FROM b_files WHERE job_id IN ${JE} AND id NOT IN ${HF} AND id NOT IN ${FR})`,
    FALL: `(SELECT id FROM b_files WHERE job_id IN ${JE} AND id NOT IN ${HF})`,
    SUBS: `(SELECT id FROM b_organizer_submissions WHERE organizer_id IN ${ORG})`,
    SUBE: `(SELECT id FROM b_organizer_submissions WHERE organizer_id IN ${ORG} AND id NOT IN ${CONSUMED})`,
    RQE: `(SELECT id FROM b_readiness_questions WHERE job_id IN ${JE} AND id NOT IN ${RQR})`,
    BR: `(SELECT id FROM b_bulk_recipients WHERE client_id=${c})`,
    P: `(SELECT id FROM b_prospects WHERE client_id=${c})`,
    TH: `(SELECT id FROM b_threads WHERE client_id=${c} AND (job_id IS NULL OR job_id IN ${JE}))`,
    NT: `(SELECT id FROM b_notices WHERE client_id=${c} AND job_id IN ${JE})`,
    TIME: `(SELECT id FROM b_time WHERE job_id IN ${JE} AND id NOT IN ${snapshot('time:')})`,
    EXPENSE: `(SELECT id FROM b_expenses WHERE client_id=${c} AND job_id IN ${JE} AND id NOT IN ${snapshot('exp:')})`,
    snapshotTime: snapshot('time:'), snapshotExpense: snapshot('exp:'),
  };
}

/** Accounts whose every unrevoked grant is on this client (portal accounts span entities by address). */
const portalOnly = (c: string) => `(SELECT a.id FROM b_portal_accounts a WHERE a.id IN (SELECT account_id FROM b_portal_grants WHERE client_id=${c})
  AND NOT EXISTS(SELECT 1 FROM b_portal_grants o WHERE o.account_id=a.id AND o.client_id<>${c} AND o.revoked_at IS NULL))`;

/** Steps run in this order inside one atomic batch. Predicates never read a column an earlier step rewrites. */
export function steps(x: Context, audited: { where: string; set: string } | null): Step[] {
  const s = selectors(x), at = lit(x.at), who = lit(x.who), why = lit(x.reason);
  const text = (col: string) => `${col}=CASE WHEN ${col} IS NULL OR ${col}='' THEN ${col} ELSE '${MARK}' END`;
  const opaque = (prefix: string) => `${lit(prefix)}||lower(hex(randomblob(4)))`;
  const aiDrafts = `(SELECT d.id FROM b_ai_drafts d JOIN b_ai_requests r ON r.id=d.request_id WHERE d.job_id IN ${s.JE}
    AND NOT (r.source_kind='document' AND r.source_id IN ${s.HF}))`;
  const all: Step[] = [
    {cls:'derived_ai',table:'b_ai_decisions',action:'cascade',label:'AI proposal decisions and reviewed values',where:`draft_id IN ${aiDrafts}`},
    {cls:'derived_ai',table:'b_ai_drafts',action:'delete',label:'Saved AI drafts and extracted values with source references',where:`id IN ${aiDrafts}`},
    {cls:'link',table:'b_agent_rules',action:'redact',label:'Scheduled agent grants revoked',where:`client_id=${s.c} AND status<>'revoked'`,set:`status='revoked'`},
    {cls:'derived_ai',table:'b_agent_rules',action:'redact',label:'Agent rule names and due-date notes',where:`client_id=${s.c}`,set:`name='[erased]',due_note='[erased]',provider_name='[erased]',model_name='[erased]',data_use='[erased]',provider_retention='[erased]',model_policy='[erased]'`},...signatureErasureSteps(x),...invoiceErasureSteps(x),
    {cls:'signed_documents',table:'b_authorizations',action:'redact',label:'Taxpayer authorizations: representative, CAF number and reasons (form, years, dates and status stay)',where:`client_id=${s.c}`,set:`representative='${MARK}',representative_email=NULL,caf_number=NULL,status_reason=NULL`},
    {cls:'link',table:'b_access_grants',action:'delete',label:'Staff client grants',where:`client_id=${s.c}`},
    {cls:'link',table:'b_access_team_clients',action:'delete',label:'Team client grants',where:`client_id=${s.c}`},
    {cls:'link',table:'b_sensitive_grants',action:'delete',label:'Sensitive-document staff grants',where:`file_key IN (SELECT file_key FROM b_document_sources WHERE client_id=${s.c})`},
    {cls:'link',table:'b_sensitive_documents',action:'redact',label:'Sensitive-document classification reasons',where:`file_key IN (SELECT file_key FROM b_document_sources WHERE client_id=${s.c})`,set:`reason='[erased]'`},
    { cls: 'contact', table: 'b_marketing_consents', action: 'redact', label: 'Marketing consent events: address, wording and evidence (actor, time and kind stay)', where: `contact_id IN ${s.K} OR client_id=${s.c}`,
      set: `address='erased+'||substr(id,1,8)||'@erased.invalid',${text('wording')},${text('evidence')},${text('reason')}` },
    { cls: 'message', table: 'b_bulk_events', action: 'redact', label: 'Bulk message provider events', where: `recipient_id IN ${s.BR}`, set: `detail='${MARK}'` },
    { cls: 'message', table: 'b_unsubscribe_tokens', action: 'delete', label: 'Unsubscribe tokens', where: `recipient_id IN ${s.BR}` },
    { cls: 'message', table: 'b_bulk_recipients', action: 'redact', label: 'Bulk message recipients: address, subject, body and language review metadata (unsent mail is held)', where: `client_id=${s.c}`,
      set: `address='',subject=NULL,body=NULL,preview_language='en',template_wording_hash=NULL,attachments='[]',misclassified_reason=NULL,held_reason=CASE WHEN status IN ('pending','claimed') THEN 'client erased' ELSE held_reason END,status=CASE WHEN status IN ('pending','claimed') THEN 'held' ELSE status END` },
    { cls: 'message', table: 'b_bulk_exclusions', action: 'redact', label: 'Bulk message exclusions: address', where: `client_id=${s.c}`, set: `address=''` },
    { cls: 'contact', table: 'b_mail_suppressions', action: 'delete', label: 'Plain-text bounce suppressions (a bounced address is dropped, not digested)', where: `address IN (SELECT email FROM b_client_contacts WHERE client_id=${s.c} AND email<>'')` },
    // PORTAL-002: an account that opens no other entity goes with this one; one that does keeps its other entities.
    ...(['b_portal_sessions', 'b_portal_signins', 'b_portal_recovery', 'b_portal_failures'] as const).map((table): Step => ({ cls: 'link', table, action: 'delete', label: `Client portal ${table.slice(9)} of accounts that open no other entity`, where: `account_id IN ${portalOnly(s.c)}` })),
    { cls: 'contact', table: 'b_portal_accounts', action: 'redact', label: 'Client portal accounts that open no other entity: address and second factor (disabled)', where: `id IN ${portalOnly(s.c)}`,
      set: `email='erased+'||id||'@erased.invalid',status='disabled',totp_sealed=NULL,totp_pending_sealed=NULL,totp_confirmed_at=NULL` },
    { cls: 'link', table: 'b_portal_invitations', action: 'delete', label: 'Client portal invitations', where: `contact_id IN ${s.K}` },
    { cls: 'link', table: 'b_portal_grants', action: 'redact', label: 'Client portal grants (revoked; who invited and when stay)', where: `client_id=${s.c}`,
      set: `revoked_at=COALESCE(revoked_at,${at}),revoked_by=COALESCE(revoked_by,${who}),revoke_reason=CASE WHEN revoke_reason IS NULL THEN 'client erased' ELSE '[erased]' END` },
    { cls: 'link', table: 'b_document_grants', action: 'delete', label: 'Document grants to contacts', where: `contact_id IN ${s.K}` },
    { cls: 'link', table: 'b_document_shares', action: 'delete', label: 'Document share links', where: `contact_id IN ${s.K}` },
    { cls: 'link', table: 'b_portal_links', action: 'redact', label: 'Client upload links (revoked)', where: `job_id IN ${s.JALL} AND revoked_at IS NULL`, set: `revoked_at=${at}` },
    { cls: 'contact', table: 'b_client_contacts', action: 'redact', label: 'Contacts: name, email, phone, roles, consent flags and language preference (a random Erased contact label)', where: `client_id=${s.c}`,
      set: `name=${opaque('Erased contact ')},first_name='',last_name='',email='',phone='',roles='[]',authorized=0,signer=0,portal=0,request_consent=0,email_consent=0,active=0,consent_note='',language='en',revision=lower(hex(randomblob(16))),updated_by=${who},updated_at=${at}` },
    { cls: 'prospect', table: 'b_prospect_events', action: 'redact', label: 'Prospect pipeline notes', where: `prospect_id IN ${s.P}`, set: `note=''` },
    { cls: 'prospect', table: 'b_prospect_files', action: 'redact', label: 'Intake upload bytes', where: `prospect_id IN ${s.P} AND erased_at IS NULL`, set: `content_base64=NULL,erased_at=${at}` },
    { cls: 'prospect', table: 'b_prospects', action: 'redact', label: 'Intake prospects: name, contacts, answers', where: `client_id=${s.c}`,
      set: `name='Erased prospect',contact_name='',contact_email='',answers='{}',lost_reason=NULL,contacts='[]'` },
    { cls: 'link', table: 'b_document_upload_chunks', action: 'delete', label: 'Unfinished upload chunks', where: `upload_id IN (SELECT id FROM b_document_uploads WHERE job_id IN ${s.JALL})` },
    { cls: 'link', table: 'b_document_uploads', action: 'delete', label: 'Unfinished upload sessions', where: `job_id IN ${s.JALL}` },
    { cls: 'signed_work', table: 'b_document_chunks', action: 'cascade', label: 'Chunked original bytes of unaccepted files (removed with their file)', where: `file_id IN ${s.FE}` },
    { cls: 'derived_ai', table: 'b_file_text', action: 'delete', label: 'Extracted document text (derived search data; nothing is rebuilt)', where: `file_id IN ${s.FALL}` },
    { cls: 'signed_work', table: 'b_document_annotations', action: 'redact', label: 'Annotations on unaccepted documents', where: `file_id IN ${s.FE}`, set: `note='${MARK}'` },
    { cls: 'signed_work', table: 'b_document_packets', action: 'redact', label: 'Review notes on unaccepted documents', where: `file_id IN ${s.FE} AND review_note IS NOT NULL AND review_note<>''`, set: `review_note='${MARK}'` },
    { cls: 'signed_work', table: 'b_files', action: 'redact', label: 'Unaccepted uploaded file bytes (name, hash and history stay)', where: `id IN ${s.FE} AND erased_at IS NULL`, set: `content_base64=NULL,erased_at=${at},erased_by=${who},erase_reason=${why}` },
    { cls: 'message', table: 'b_requests', action: 'redact', label: 'Request notes', where: `job_id IN ${s.JE} AND note<>''`, set: `note=''` },
    // The marker comes before the payloads it describes are replaced.
    { cls: 'organizer', table: 'b_job_organizers', action: 'redact', label: 'Organizers with erased content (erasure marker and attribution)',
      where: `(id IN ${s.ORG} AND erased_at IS NULL AND (EXISTS(SELECT 1 FROM b_organizer_answers a WHERE a.organizer_id=b_job_organizers.id AND a.value IS NOT NULL) OR EXISTS(SELECT 1 FROM b_organizer_submissions u WHERE u.organizer_id=b_job_organizers.id AND u.id IN ${s.SUBE} AND u.erased_at IS NULL)))
        OR id IN (SELECT organizer_id FROM b_organizer_answers WHERE carried_from IN ${s.SUBS} AND value IS NOT NULL)`,
      set: `erased_at=COALESCE(erased_at,${at}),erased_by=COALESCE(erased_by,${who}),erase_reason=COALESCE(erase_reason,${why}),revision=lower(hex(randomblob(16)))` },
    { cls: 'organizer', table: 'b_organizer_answers', action: 'redact', label: 'Organizer drafts and still-derived carry', where: `(organizer_id IN ${s.ORG} OR carried_from IN ${s.SUBS}) AND value IS NOT NULL`, set: `value=NULL,confirmed=0` },
    { cls: 'organizer', table: 'b_organizer_submissions', action: 'redact', label: 'Organizer submissions no signed-off job consumed (authors, times and review markers stay)', where: `id IN ${s.SUBE} AND erased_at IS NULL`, set: `answers=NULL,review_note=NULL,erased_at=${at}` },
    { cls: 'message', table: 'b_organizer_deliveries', action: 'redact', label: 'Organizer delivery mail: address, subject, message', where: `organizer_id IN ${s.ORG}`, set: `to_email='',subject='',message='${MARK}',attachments='[]'` },
    { cls: 'message', table: 'b_portal_items', action: 'redact', label: 'Portal questions, messages and responses no signed-off decision consumed', where: `job_id IN ${s.JE} AND id NOT IN (SELECT todo_id FROM b_readiness_questions WHERE todo_id IS NOT NULL AND id IN ${s.RQR})`,
      set: `body='${MARK}',${text('response')},${text('subject')},attachments='[]'` },
    { cls: 'message', table: 'b_reminders', action: 'redact', label: 'Reminder mail: address, subject, message and language', where: `job_id IN ${s.JE}`, set: `to_email='',message='${MARK}',subject=NULL,attachments='[]',outstanding='[]',language=NULL` },
    { cls: 'readiness', table: 'b_readiness_questions', action: 'delete', label: 'Readiness preparations no signed-off job consumed', where: `id IN ${s.RQE}` },
    { cls: 'message', table: 'b_thread_messages', action: 'redact', label: 'Discussion messages (authors and times stay)', where: `thread_id IN ${s.TH}`, set: `body='${MARK}',mentions='[]'` },
    { cls: 'message', table: 'b_threads', action: 'redact', label: 'Discussion titles and resolutions', where: `id IN ${s.TH}`, set: `title='${MARK}',${text('resolution')}` },
    { cls: 'message', table: 'b_notice_events', action: 'redact', label: 'Notice notes and attachments', where: `notice_id IN ${s.NT}`, set: `note='${MARK}',file_base64=NULL` },
    { cls: 'message', table: 'b_notices', action: 'redact', label: 'Notice plans and outcome notes', where: `id IN ${s.NT}`, set: `plan='',authorization='',${text('outcome_note')}` },
    { cls: 'billing', table: 'b_time_adjustments', action: 'redact', label: 'Adjustment reasons on unbilled time (amounts stay)', where: `entry_id IN ${s.TIME} AND id NOT IN ${invoiceSnapshotIdsSql('adj:')}`, set: `reason='${MARK}'` },
    { cls: 'billing', table: 'b_time', action: 'redact', label: 'Unbilled time descriptions (minutes, rates and amounts stay)', where: `id IN ${s.TIME}`, set: `description='${MARK}'` },
    { cls: 'billing', table: 'b_expenses', action: 'redact', label: 'Unbilled expense descriptions and receipts (amounts stay)', where: `id IN ${s.EXPENSE}`,
      set: `description='${MARK}',receipt_name=NULL,receipt_mime=NULL,receipt_size=NULL,receipt_base64=NULL` },
    { cls: 'structure', table: 'b_timers', action: 'delete', label: 'Running timers', where: `job_id IN ${s.JE}` },
    { cls: 'structure', table: 'b_time_suggestions', action: 'delete', label: 'Time suggestions', where: `job_id IN ${s.JE}` },
    { cls: 'structure', table: 'b_plan_items', action: 'delete', label: 'Daily plan items', where: `job_id IN ${s.JE}` },
    { cls: 'notification', table: 'b_notifications', action: 'redact', label: 'Staff notification text (alerts, not evidence; held jobs too)', where: `job_id IN ${s.JALL}`, set: `summary='${MARK}'` },
    { cls: 'derived_ai', table: 'b_onboarding_plans', action: 'delete', label: 'Onboarding scope reviews and derived setup observations', where: `client_id=${s.c}` },
    {cls:'derived_ai',table:'b_agent_runs',action:'redact',label:'Agent preparation fingerprints',where:`job_id IN ${s.JE} AND preparation_hash IS NOT NULL`,set:`preparation_hash=NULL`},
    {cls:'derived_ai',table:'b_proposals',action:'redact',label:'Scheduled agent labels and decision notes (ids and decision attribution stay)',where:`id IN (SELECT proposal_id FROM b_agent_runs WHERE job_id IN ${s.JE})`,set:`agent_label='[erased]',decision_note=CASE WHEN decision_note IS NULL THEN NULL ELSE '[erased]' END`},
    { cls: 'derived_ai', table: 'b_proposals', action: 'redact', label: 'Agent plans and outputs for this work (derived drafts; run and decision ids stay)', where: `kind IN ('rollforward','reminder') AND json_extract(payload,'$.jobId') IN ${s.JE} AND payload<>'{}'`, set: `payload='{}'` },
    { cls: 'signed_work', table: 'b_deliverable_versions', action: 'redact', label: 'Deliverable versions the client did not approve', where: `job_id IN ${s.JE} AND status<>'approved'`, set: `content_base64='',note='${MARK}',${text('comment')}` },
    { cls: 'vault', table: 'b_vault_credentials', action: 'redact', label: 'Stored credentials (ciphertext erased)', where: `client_id=${s.c} AND erased_at IS NULL`, set: `sealed=NULL,erased_at=${at},erased_by=${who},erase_reason=${why},revision=revision+1` },
    { cls: 'vault', table: 'b_vault_reveals', action: 'redact', label: 'Credential reveal labels (the log stays under opaque labels)', where: `client_id=${s.c}`, set: `label=${opaque('Credential ')}` },
    { cls: 'structure', table: 'b_client_group_members', action: 'delete', label: 'Group memberships', where: `client_id=${s.c}` },
    { cls: 'structure', table: 'b_client_import_bindings', action: 'delete', label: 'Import source bindings', where: `client_id=${s.c}` },
    { cls: 'api', table: 'b_api_client_writes', action: 'delete', label: 'API idempotency receipts', where: `client_id=${s.c}` },
    // Erasure covers the survivor and every record merged into it; the merge journal keeps ids and times with the personal values replaced.
    { cls: 'structure', table: 'b_client_merges', action: 'redact', label: 'Merge history: chosen and prior values replaced (ids, authors and times stay)', where: `survivor_id=${s.c} AND (choices<>'{}' OR survivor_before<>'{}' OR survivor_seen<>'{}' OR authority<>'')`, set: `choices='{}',authority='',survivor_before='{}',survivor_seen='{}'` },
    { cls: 'structure', table: 'b_clients', action: 'redact', label: 'Clients merged into this one: name, identifiers and fields (a random Erased client label)', where: `merged_into=${s.c} AND erased_at IS NULL`,
      set: `name=${opaque('Erased client ')},abn='',contact_name='',contact_email='',source='erased',fields='{}',tags='[]',ssn_last4='',erased_at=${at}` },
    { cls: 'structure', table: 'b_duplicate_dismissals', action: 'delete', label: 'Duplicate-review dismissals', where: `client_a=${s.c} OR client_b=${s.c}` },
  ];
  if (audited) all.push({ cls: 'audit', table: 'b_audit', action: 'redact', label: 'Audit detail naming the client or its contacts (actor, action, object and time stay)', where: audited.where, set: audited.set });
  all.push({ cls: 'structure', table: 'b_clients', action: 'redact', label: 'Client record: name, identifiers and fields (a random Erased client label; id, dates and work links stay)', where: `id=${s.c} AND erased_at IS NULL`,
    set: `name=${lit(x.label)},abn='',contact_name='',contact_email='',source='erased',fields='{}',tags='[]',ssn_last4='',lifecycle='archived',erased_at=${at},revision=lower(hex(randomblob(16)))` });
  // A held class, the whole client under a hold, or a held record is skipped; links are always revoked.
  return all.map(step => {
    const held = step.cls !== 'link' && (x.held.client || x.held.classes.includes(step.cls));
    return held ? { ...step, held: true, where: '0' } : step;
  });
}

/** The unheld form of a step list: what each class would do with no hold at all, to count what the holds preserve. */
export const unheld = (x: Context, audited: { where: string; set: string } | null) => steps({ ...x, held: { client: false, classes: [], jobs: x.held.jobs, files: x.held.files } }, audited);

/** Named exceptions: what stays, why, and who owns it. Counts only; the clock lists come from retention-clock. */
export function retained(x: Context): { key: string; cls: ClientClass; label: string; reason: string; owner: string; sql: string }[] {
  const s = selectors(x), keep = x.held.client ? '0' : '1';
  const principal = 'Principal';
  return [signatureRetained(x),...invoiceRetainedRows(x.client,principal),
    { key: 'signed_off_jobs', cls: 'signed_work', label: 'Signed-off jobs (status history, checklist outcomes, reviewer and partner notes, sign-off)', reason: 'Signed-off work is kept whole until its clock expires.', owner: principal, sql: `SELECT count(*) n FROM b_jobs WHERE client_id=${s.c} AND status='signed_off' AND ${keep} AND id IN ${s.JE}` },
    { key: 'accepted_documents', cls: 'signed_work', label: 'Accepted documents on signed-off jobs', reason: 'Accepted documents are part of signed-off work.', owner: principal, sql: `SELECT count(*) n FROM b_files WHERE id IN ${s.FR} AND job_id IN ${s.JE} AND ${keep}` },
    { key: 'consumed_originals', cls: 'signed_work', label: 'Submitted organizer originals a signed-off job consumed', reason: 'Consumed originals are part of signed-off work.', owner: principal, sql: `SELECT count(*) n FROM b_organizer_submissions WHERE id IN ${s.CONSUMED} AND organizer_id IN ${s.ORG} AND ${keep}` },
    { key: 'readiness_decisions', cls: 'signed_work', label: 'Readiness decisions a signed-off job consumed', reason: 'Consumed decisions are part of signed-off work.', owner: principal, sql: `SELECT count(*) n FROM b_readiness_questions WHERE id IN ${s.RQR} AND job_id IN ${s.JE} AND ${keep}` },
    { key: 'approved_deliverables', cls: 'signed_work', label: 'Deliverable versions the client approved', reason: 'Signed client approval evidence.', owner: principal, sql: `SELECT count(*) n FROM b_deliverable_versions WHERE job_id IN ${s.JALL} AND status='approved' AND ${keep}` },
    { key: 'billing_time', cls: 'billing', label: 'Time entries snapshotted by approved billing exports', reason: 'Billing evidence is kept until its clock expires.', owner: principal, sql: `SELECT count(*) n FROM b_time WHERE job_id IN ${s.JALL} AND id IN ${s.snapshotTime}` },
    { key: 'billing_expenses', cls: 'billing', label: 'Expense entries snapshotted by approved billing exports', reason: 'Billing evidence is kept until its clock expires.', owner: principal, sql: `SELECT count(*) n FROM b_expenses WHERE client_id=${s.c} AND id IN ${s.snapshotExpense}` },
    { key: 'billing_exports', cls: 'billing', label: 'Approved billing exports containing this client\'s lines', reason: 'Approved exports are immutable billing evidence.', owner: principal,
      sql: `SELECT count(DISTINCT s.export_id) n FROM b_export_sources s JOIN b_exports e ON e.id=s.export_id WHERE e.status='approved' AND (s.source_key IN (SELECT 'time:'||id FROM b_time WHERE job_id IN ${s.JALL}) OR s.source_key IN (SELECT 'exp:'||id FROM b_expenses WHERE client_id=${s.c}) OR s.source_key IN (SELECT 'fee:'||id FROM b_jobs WHERE client_id=${s.c}))` },
    { key: 'engagements', cls: 'engagement', label: 'Signed engagements (practitioner-recorded, not signed through Blotter)', reason: 'Signed engagements are kept until their clock expires.', owner: principal, sql: `SELECT count(*) n FROM b_engagements WHERE client_id=${s.c} AND erased_at IS NULL AND ${keep}` },
  ];
}
export const rowsOf = (result: Data | null) => Number(result?.n ?? 0);
export const stepClass = (table: string) => classOf(table);

export { suppressionDigest, erasedAddress, refuseErasedAddress } from './marketing-suppression';
