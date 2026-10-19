// Complete native data, small-file originals, import provenance and review history.
// Identity, sessions, second factors, outboxes, agent keys, client upload links and private
// configuration stay out of every archive.
export default {
  product: 'accounting/blotter',
  excludeTables: ['b_agent_keys', 'b_guard', 'b_portal_links', 'b_mfa_factors', 'b_mfa_recovery', 'b_mfa_sessions', 'b_mfa_challenges', 'b_mfa_failures', 'b_session_activity', 'b_file_text'],
  replaceableTables: ['b_meta'],
  requiredConfiguration: ['OWNER_EMAIL', 'SESSION_SECRET', 'SETUP_TOKEN', 'AUTH_ORIGIN', 'MAIL_PROVIDER', 'MAIL_FROM'],
};
