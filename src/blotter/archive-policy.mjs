// Native data, inline and chunk-backed originals, import provenance and review history.
// Identity, sessions, second factors and credential step-ups, outboxes, agent keys, client upload links and private
// configuration stay out of every archive.
const inactive = (table, row) => {
  // VAULT-001: the principal's "exclude" choice drops credential ciphertext; "encrypt" carries it sealed.
  if (table === 'b_vault_credentials' && row.archive_mode === 'exclude') return { ...row, sealed: null };
  if (table === 'b_automation_rules') return { ...row, status: row.status === 'revoked' ? 'revoked' : 'paused', principal_id: null };
  if (table === 'b_automation_attempts' && ['pending','running','dispatching'].includes(row.status)) return { ...row, status: 'held', next_action: 'Restored history; reconcile, never replay' };
  if (table === 'b_recurrence_rules') return { ...row, status: 'paused', restore_review: 1 };
  if (table === 'b_notifications' && ['pending', 'deferred: outside firm notification hours'].includes(row.delivery)) return { ...row, delivery: 'held after restore: ' + row.delivery };
  return row;
};
export default {
  product: 'accounting/blotter',
  excludeTables: ['b_automation_events', 'b_document_uploads', 'b_document_upload_chunks', 'b_document_shares', 'b_intake_limits', 'b_intake_tokens', 'b_agent_keys', 'b_guard', 'b_portal_links', 'b_mfa_factors', 'b_mfa_recovery', 'b_mfa_sessions', 'b_mfa_challenges', 'b_mfa_failures', 'b_session_activity', 'b_file_text', 'b_vault_stepups'],
  // Retained rules and unsent staff alerts are history until explicitly reviewed.
  exportRow: inactive,
  importSafety: { b_recurrence_rules: { status: ['paused'], restore_review: [1] }, b_notifications: { delivery: ['held after restore: pending', 'held after restore: deferred: outside firm notification hours'] } },
  importRow: inactive,
  replaceableTables: ['b_meta'],
  requiredConfiguration: ['OWNER_EMAIL', 'SESSION_SECRET', 'SETUP_TOKEN', 'AUTH_ORIGIN', 'MAIL_PROVIDER', 'MAIL_FROM'],
};
