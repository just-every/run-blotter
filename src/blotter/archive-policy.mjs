// Complete native data, small-file originals, import provenance and review history.
// Identity, sessions, outboxes, agent keys, client upload links and private
// configuration stay out of every archive.
export default {
  product: 'accounting/blotter',
  excludeTables: ['b_agent_keys', 'b_guard', 'b_portal_links'],
  replaceableTables: ['b_meta'],
  requiredConfiguration: ['OWNER_EMAIL', 'SESSION_SECRET', 'SETUP_TOKEN', 'AUTH_ORIGIN', 'MAIL_PROVIDER', 'MAIL_FROM'],
};
