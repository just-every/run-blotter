import { INVOICE_BILLING_TABLES, INVOICE_LINK_TABLES, INVOICE_FIRM_TABLES, INVOICE_BYTE_COLUMNS } from './invoices-registry';
// ERASURE-002 typed class registry (ct 22 Oct 2026). Every table in this installation belongs
// to exactly one record class; preview, erasure, export and restore share it. A table or a byte
// column holding client data without a class stops the preview: the registry fails closed.
import { rows, type Data } from './model';

/** Classes that hold client data. A hold may name any of them; the first five are retained and have clocks. */
export const CLIENT_CLASSES = {
  signed_work: 'Signed-off work: job, status history, checklist outcomes, accepted documents, reviewer and partner notes, sign-off, consumed organizer originals and readiness decisions',
  engagement: 'Signed engagements',
  efile_auth: 'IRS e-file authorizations (SIGN-001)',
  signed_documents: 'Signed documents (SIGN-002)',
  billing: 'Billing evidence: approved exports and the entries they snapshotted',
  contact: 'Contact personal fields and consent records',
  link: 'Portal, contact, upload and share links',
  message: 'Message, chat and notice bodies, reminders and bulk mail',
  notification: 'Staff notifications',
  organizer: 'Organizer drafts, carry and unconsumed submissions',
  prospect: 'CRM-005 prospect answers, notes and uploads',
  readiness: 'Readiness preparations and client responses',
  derived_ai: 'Derived AI data: agent plans, outputs, extracted text',
  vault: 'Vault credentials',
  api: 'API idempotency receipts',
} as const;
export type ClientClass = keyof typeof CLIENT_CLASSES;
/** Classes that hold no client data of their own: structure (ids, authors, times, markers), the firm's own configuration and staff, the audit log, this policy and Base's own stores. */
const OTHER = ['structure', 'firm', 'staff', 'audit', 'policy'] as const;
type TableClass = ClientClass | typeof OTHER[number];

const by = (cls: TableClass, ...tables: string[]) => tables.map(t => [t, cls] as const);
const REGISTRY = new Map<string, TableClass>([
  ...by('derived_ai', 'b_revenue_proposals', 'b_ai_drafts', 'b_ai_decisions'),
  ...by('structure', 'b_ai_requests'),
  ...by('firm', 'b_ai_settings'),
  ...by('billing',...INVOICE_BILLING_TABLES),...by('link',...INVOICE_LINK_TABLES),...by('firm',...INVOICE_FIRM_TABLES),
  ...by('signed_work', 'b_filing_status', 'b_files', 'b_document_chunks', 'b_document_packets', 'b_document_annotations', 'b_deliverables', 'b_deliverable_versions', 'b_job_answers', 'b_job_steps'),
  ...by('signed_documents','b_signatures','b_signature_signers','b_signature_attestations','b_signature_events','b_signature_deliveries','b_authorizations'),
  ...by('engagement', 'b_engagements'),
  ...by('billing', 'b_time', 'b_time_adjustments', 'b_expenses', 'b_exports', 'b_export_sources'),
  ...by('contact', 'b_client_contacts', 'b_portal_accounts', 'b_marketing_consents', 'b_marketing_confirmations', 'b_marketing_merge_holds', 'b_mail_suppressions', 'b_erased_suppressions'),
  ...by('link', 'b_portal_grants', 'b_portal_invitations', 'b_portal_signins', 'b_portal_sessions', 'b_portal_recovery', 'b_portal_failures', 'b_access_grants','b_access_team_clients','b_sensitive_documents','b_sensitive_grants', 'b_portal_links', 'b_document_access', 'b_document_grants', 'b_document_shares', 'b_document_uploads', 'b_document_upload_chunks'),
  ...by('message', 'b_portal_items', 'b_reminders', 'b_threads', 'b_thread_messages', 'b_thread_reads', 'b_notices', 'b_notice_events', 'b_bulk_batches', 'b_bulk_recipients', 'b_bulk_exclusions', 'b_bulk_events', 'b_unsubscribe_tokens', 'b_organizer_deliveries'),
  ...by('notification', 'b_notifications', 'b_notification_digests'),
  ...by('organizer', 'b_job_organizers', 'b_organizer_answers', 'b_organizer_submissions', 'b_organizer_requests'),
  ...by('prospect', 'b_prospects', 'b_prospect_events', 'b_prospect_files'),
  ...by('readiness', 'b_readiness_questions'),
  ...by('derived_ai', 'b_onboarding_plans', 'b_proposals', 'b_file_text', 'b_learning_proposals', 'b_learning_sources', 'b_learning_refs', 'b_learning_versions', 'b_learning_clients', 'b_learning_job_versions'),
  ...by('vault', 'b_vault_credentials', 'b_vault_reveals'),
  ...by('api', 'b_api_client_writes','b_api_time_writes','b_integration_writes'),
  ...by('link','b_integration_clients','b_integration_deliveries'),
  ...by('firm','b_integration_keys','b_integration_limits','b_integration_hooks'),
  ...by('structure', 'b_agent_rules', 'b_agent_runs', 'b_transcript_requests', 'b_clients', 'b_jobs', 'b_job_status_history', 'b_requests', 'b_job_deadlines', 'b_rule_periods', 'b_recurrence_rules', 'b_recurrence_imports', 'b_recurrence_import_items', 'b_client_obligations',
    'b_client_group_members', 'b_client_import_bindings', 'b_duplicate_dismissals', 'b_client_merges', 'b_timers', 'b_time_suggestions', 'b_plan_items', 'b_automation_events', 'b_automation_attempts', 'b_time_status', 'b_coverage_conflicts'),
  ...by('firm', 'b_service_prices', 'b_service_price_versions', 'b_service_budget', 'b_service_usage', 'b_firm', 'b_meta', 'b_guard', 'b_templates', 'b_msg_templates', 'b_msg_template_versions', 'b_msg_template_translations', 'b_msg_template_files', 'b_portal_policy', 'b_portal_branding', 'b_organizer_versions', 'b_starter_adoptions', 'b_starter_releases', 'b_client_fields', 'b_client_groups',
    'b_deadline_rules', 'b_deadline_revisions', 'b_deadline_relief', 'b_work_types', 'b_sub_statuses', 'b_saved_views', 'b_view_filters', 'b_rates', 'b_rate_cards', 'b_rate_cards_next', 'b_mileage_rates', 'b_periods', 'b_capacity', 'b_capacity_blocks',
    'b_capacity_scenarios', 'b_coverage_plans', 'b_automation_rules', 'b_report_views', 'b_report_schedules', 'b_report_runs', 'b_scheduler_runs', 'b_notification_settings', 'b_notification_defaults', 'b_notification_task_owners',
    'b_notification_job_owners', 'b_notification_events', 'b_intake_limits', 'b_intake_tokens', 'b_prospect_stages', 'b_vault_keys', 'b_vault_stepups', 'b_agent_keys'),
  ...by('staff', 'b_enterprise_connection','b_enterprise_identities','b_enterprise_groups','b_enterprise_group_members','b_enterprise_mappings','b_enterprise_team_grants','b_enterprise_sessions','b_staff_costs', 'b_access_policy','b_access_members','b_access_delegations','b_access_teams','b_access_team_members','b_access_stepups', 'b_members', 'b_activity_consent', 'b_session_activity', 'b_mfa_policy', 'b_mfa_factors', 'b_mfa_recovery', 'b_mfa_sessions', 'b_mfa_challenges', 'b_mfa_failures'),
  ...by('audit', 'b_audit'),
  ...by('policy', 'b_retention_marks', 'b_retention_periods', 'b_external_copies', 'b_deletion_requests', 'b_client_erasures', 'b_client_erasure_steps', 'b_retained_identity', 'b_retained_reads', 'b_expiry_erasures'),
]);
/** Columns that hold bytes or ciphertext, per table. A column of that kind not named here stops the preview. */
const BYTES: Record<string, string[]> = {b_integration_hooks:['destination_sealed','secret_sealed'],b_signatures:['source_base64','signed_base64','certificate_base64'],...INVOICE_BYTE_COLUMNS,
  b_files: ['content_base64'], b_document_chunks: ['content_base64'], b_document_upload_chunks: ['content_base64'], b_job_steps: ['attachment_base64'], b_deliverable_versions: ['content_base64'],
  b_notice_events: ['file_base64'], b_expenses: ['receipt_base64'], b_exports: ['csv'], b_prospect_files: ['content_base64'], b_vault_credentials: ['sealed'], b_engagements: ['content_base64'],
  b_msg_template_files: ['content_base64'], b_portal_accounts: ['totp_sealed', 'totp_pending_sealed'], b_portal_branding: ['logo_base64'], b_mfa_factors: ['sealed_secret'], b_retained_identity: ['sealed'],
};
const BYTE_LIKE = /base64|sealed|csv|ciphertext|blob|bytes/i, DIGEST = /sha256/i;
/** Base's own stores: identity, portability and the import kit (import originals are redacted through Base's import erasure). */
const BASE_PREFIX = /^(oa_|oc_|rer_|ik_|sqlite_|_cf_|d1_)/;

export const classOf = (table: string) => REGISTRY.get(table);

/** The classes the preview shows; the registry itself failed closed when anything is missing. */
export async function unclassified(db: D1Database) {
  const found: string[] = [];
  for (const t of await rows(db, "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")) {
    const name = String(t.name);
    if (BASE_PREFIX.test(name)) continue;
    if (!REGISTRY.has(name)) { found.push(`table ${name}`); continue; }
    const declared = new Set(BYTES[name] ?? []);
    for (const c of await rows(db, `SELECT name,type FROM pragma_table_info('${name}')`) as Data[]) if (/text|blob|^$/i.test(String(c.type)) && BYTE_LIKE.test(String(c.name)) && !DIGEST.test(String(c.name)) && !declared.has(String(c.name))) found.push(`column ${name}.${c.name}`);
  }
  return found;
}
