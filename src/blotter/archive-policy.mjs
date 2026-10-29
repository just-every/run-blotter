// Native data, inline and chunk-backed originals, import provenance and review history.
// Identity, sessions, second factors and credential step-ups, outboxes, agent keys, client upload links and private
// configuration stay out of every archive.
const inactive = (table, row) => {
  if (table === 'b_efile_authorizations') return {...row,restored:1};
  if(table==='b_enterprise_connection')return {...row,active:0,principal_id:null,token_digest:null};
  if(table==='b_enterprise_identities')return {...row,active:0,blocked:1};
  if(table==='b_integration_hooks')return {...row,status:'inactive',destination_sealed:null,secret_sealed:null};
  if(table==='b_integration_deliveries' && ['pending','dispatching'].includes(row.status))return {...row,status:'held',next_action:'Restored history; never replay; register a fresh endpoint'};
  if(table==='b_integration_keys')return {...row,digest:null,status:row.status==='revoked'?'revoked':'suspended'};
  if (table === 'b_ai_settings') return {...row,enabled:0};
  if (table === 'b_ai_requests' && row.status === 'requested') return {...row,status:'held'};
  // VAULT-001: the principal's "exclude" choice drops credential ciphertext; "encrypt" carries it sealed.
  if (table === 'b_revenue_proposals' && row.status === 'pending') return {...row,status:'held'};
  if (table === 'b_onboarding_plans') return {...row,status:'held'};
  if (table === 'b_agent_rules') return {...row,status:row.status==='revoked'?'revoked':'paused'};
  if (table === 'b_agent_runs' && ['pending','blocked','awaiting_agent'].includes(row.status)) return {...row,status:'held',outcome:'Restored history; never replay'};
  if (table === 'b_service_prices') return {...row,enabled:0};
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
  if (table === 'b_sms_consents') return { ...row, restored: 1 };
  if (table === 'b_marketing_consents') return { ...row, restored: 1 };
  if (table === 'b_bulk_batches' && row.status !== 'sent') return { ...row, status: 'paused', restore_review: 1 };
  if (table === 'b_bulk_recipients' && ['pending', 'claimed'].includes(row.status)) return { ...row, status: 'held', held_reason: 'held: not sent (restored history; never replayed)' };
  if (table === 'b_notifications' && ['pending', 'in-app only', 'deferred: outside firm notification hours'].includes(row.delivery)) return { ...row, delivery: 'held after restore: ' + row.delivery };
  if(table==='b_invoice_retainers')return {...row,status:'paused',principal_id:null,auto_consent:null};
  if(table==='b_invoice_reminder_policy')return {...row,status:'paused',consenter_id:null};
  if(table==='b_invoice_reminders' && row.status==='dispatching')return {...row,status:'held',delivery:'held after restore: '+row.delivery};
  if(table==='b_invoice_deliveries')return {...row,digest:'restored:'+row.id,revoked_at:row.revoked_at??row.sent_at,status:row.status==='dispatching'?'held':row.status};
  // Restored payment outcomes remain evidence; references cannot authorize collection.
  if(table==='b_provider_payments')return {...row,restored:1,session_id:null,customer_id:null};
  if(table==='b_payment_mandates')return {...row,status:'held',method_id:null,customer_id:null};
  if(table==='b_signatures' && ['draft','pending','declined'].includes(row.status))return {...row,status:'held'};
  if(table==='b_signature_deliveries' && /uncertain|pending/.test(row.delivery))return {...row,delivery:'held after restore: '+row.delivery};
  return row;
};
export default {
  product: 'accounting/blotter',
  excludeTables: ['b_agent_door_custody','bs_settings','bs_team','bs_overrides','bs_logo','bs_audit','bs_assert','agent_door_state','agent_door_agents','agent_door_calls','agent_door_approvals','agent_door_reviews','agent_door_audit','agent_door_events','agent_door_usage', 'b_enterprise_sessions', 'b_integration_limits', 'b_access_stepups', 'b_automation_events', 'b_document_uploads', 'b_document_upload_chunks', 'b_document_shares', 'b_intake_limits', 'b_intake_tokens', 'b_agent_keys', 'b_guard', 'b_portal_links', 'b_portal_invitations', 'b_portal_signins', 'b_portal_sessions', 'b_portal_recovery', 'b_portal_failures', 'b_mfa_factors', 'b_mfa_recovery', 'b_mfa_sessions', 'b_mfa_challenges', 'b_mfa_failures', 'b_session_activity', 'b_file_text', 'b_vault_stepups', 'b_unsubscribe_tokens', 'b_marketing_confirmations'],
  // Practitioner filing sources travel as evidence with the deadline acknowledgment; no connection authority exists.
  // Resolution case ids, job and organizer links, version and practitioner review attribution travel
  // by table discovery. They grant no portal or agency authority and contain no answer copies.
  // Native client and time replay receipts travel by table discovery; they contain no session authority.
  // Retained rules and unsent staff alerts are history until explicitly reviewed.
  exportRow: inactive,
  importSafety: { b_efile_authorizations: { restored: [1] }, b_sms_consents: { restored: [1] }, b_enterprise_connection:{active:[0],principal_id:[null],token_digest:[null]}, b_enterprise_identities:{active:[0],blocked:[1]}, b_revenue_proposals: { status: ['held','approved','declined'] }, b_integration_hooks: { status: ['inactive'], destination_sealed: [null], secret_sealed: [null] }, b_integration_keys: { digest: [null], status: ['revoked','suspended'] }, b_provider_payments: { restored: [1], session_id: [null], customer_id: [null] }, b_payment_mandates: { status: ['held'], method_id: [null], customer_id: [null] }, b_onboarding_plans: { status: ['held'] }, b_meta: { marketing_restore_review: [1] }, b_recurrence_rules: { status: ['paused'], restore_review: [1] }, b_marketing_consents: { restored: [1] }, b_notifications: { delivery: ['held after restore: in-app only', 'held after restore: pending', 'held after restore: deferred: outside firm notification hours'] } },
  importRow: inactive,
  replaceableTables: ['b_meta'],
  requiredConfiguration: ['OWNER_EMAIL', 'SESSION_SECRET', 'SETUP_TOKEN', 'AUTH_ORIGIN', 'MAIL_PROVIDER', 'MAIL_FROM'],
};
