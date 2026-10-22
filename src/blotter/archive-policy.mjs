// Native data, inline and chunk-backed originals, import provenance and review history.
// Identity, sessions, second factors and credential step-ups, outboxes, agent keys, client upload links and private
// configuration stay out of every archive.
const inactive = (table, row) => {
  // VAULT-001: the principal's "exclude" choice drops credential ciphertext; "encrypt" carries it sealed.
  if (table === 'b_vault_credentials' && row.archive_mode === 'exclude') return { ...row, sealed: null };
  // PORTAL-002: accounts and grants cross; second factors never do, so a restored account sets up a new one.
  if (table === 'b_portal_accounts') return { ...row, totp_sealed: null, totp_pending_sealed: null, totp_confirmed_at: null, totp_last_step: 0 };
  if (table === 'b_notification_settings') return { ...row, settings: JSON.stringify({ ...JSON.parse(row.settings), digestEnabled: false }) };
  if (table === 'b_notification_digests' && row.delivery === 'pending') return { ...row, delivery: 'held after restore: pending' };
  if (table === 'b_report_schedules') return { ...row, status: 'paused', principal_id: null };
  if (table === 'b_automation_rules') return { ...row, status: row.status === 'revoked' ? 'revoked' : 'paused', principal_id: null };
  if (table === 'b_automation_attempts' && ['pending','running','dispatching'].includes(row.status)) return { ...row, status: 'held', next_action: 'Restored history; reconcile, never replay' };
  if (table === 'b_recurrence_rules') return { ...row, status: 'paused', restore_review: 1 };
  // MSG-002: restored consent stays off for marketing until the principal confirms; batches return paused and never replay.
  if (table === 'b_meta') return { ...row, marketing_restore_review: 1 };
  if (table === 'b_marketing_consents') return { ...row, restored: 1 };
  if (table === 'b_bulk_batches' && row.status !== 'sent') return { ...row, status: 'paused', restore_review: 1 };
  if (table === 'b_bulk_recipients' && ['pending', 'claimed'].includes(row.status)) return { ...row, status: 'held', held_reason: 'held: not sent (restored history; never replayed)' };
  if (table === 'b_notifications' && ['pending', 'in-app only', 'deferred: outside firm notification hours'].includes(row.delivery)) return { ...row, delivery: 'held after restore: ' + row.delivery };
  if(table==='b_invoice_retainers')return {...row,status:'paused',principal_id:null,auto_consent:null};
  if(table==='b_invoice_reminder_policy')return {...row,status:'paused',consenter_id:null};
  if(table==='b_invoice_reminders' && row.status==='dispatching')return {...row,status:'held',delivery:'held after restore: '+row.delivery};
  if(table==='b_invoice_deliveries')return {...row,digest:'restored:'+row.id,revoked_at:row.revoked_at??row.sent_at,status:row.status==='dispatching'?'held':row.status};
  if(table==='b_signatures' && ['draft','pending','declined'].includes(row.status))return {...row,status:'held'};
  if(table==='b_signature_deliveries' && /uncertain|pending/.test(row.delivery))return {...row,delivery:'held after restore: '+row.delivery};
  return row;
};
export default {
  product: 'accounting/blotter',
  excludeTables: ['b_access_stepups', 'b_automation_events', 'b_document_uploads', 'b_document_upload_chunks', 'b_document_shares', 'b_intake_limits', 'b_intake_tokens', 'b_agent_keys', 'b_guard', 'b_portal_links', 'b_portal_invitations', 'b_portal_signins', 'b_portal_sessions', 'b_portal_recovery', 'b_portal_failures', 'b_mfa_factors', 'b_mfa_recovery', 'b_mfa_sessions', 'b_mfa_challenges', 'b_mfa_failures', 'b_session_activity', 'b_file_text', 'b_vault_stepups', 'b_unsubscribe_tokens', 'b_marketing_confirmations'],
  // Retained rules and unsent staff alerts are history until explicitly reviewed.
  exportRow: inactive,
  importSafety: { b_meta: { marketing_restore_review: [1] }, b_recurrence_rules: { status: ['paused'], restore_review: [1] }, b_marketing_consents: { restored: [1] }, b_notifications: { delivery: ['held after restore: in-app only', 'held after restore: pending', 'held after restore: deferred: outside firm notification hours'] } },
  importRow: inactive,
  replaceableTables: ['b_meta'],
  requiredConfiguration: ['OWNER_EMAIL', 'SESSION_SECRET', 'SETUP_TOKEN', 'AUTH_ORIGIN', 'MAIL_PROVIDER', 'MAIL_FROM'],
};
