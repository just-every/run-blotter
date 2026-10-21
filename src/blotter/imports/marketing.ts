// MSG-002 / IMPORT-001: explicit source consent, never inferred from email permission.
import { canonicalJson, sha256, type D1Sql } from '../../modules/import-kit/src/d1/index';
import { insist, type Data } from '../model';

export const MARKETING_FIELDS = ['marketing_opt_in', 'marketing_status', 'marketing_captured_at', 'marketing_wording', 'marketing_wording_version', 'marketing_language', 'marketing_evidence'];
export const MARKETING_ATTESTATION = 'I attest that each imported marketing opt-in is the contact’s explicit email marketing consent, with the recorded capture date, exact wording and evidence.';

/** A subscribed label alone is not evidence. A withdrawal wins over a source opt-in. */
export function sourceMarketing(v: Record<string, string>, contact: Data) {
  const opted = v.marketing_opt_in ?? '', status = (v.marketing_status ?? '').toLowerCase();
  insist(['', 'true', 'false'].includes(opted), 'marketing_opt_in: use true or false');
  insist(['', 'subscribed', 'unsubscribed', 'bounced', 'complained'].includes(status), 'marketing_status: use subscribed, unsubscribed, bounced or complained');
  insist((v.marketing_wording ?? '').length <= 1000 && (v.marketing_wording_version ?? '').length <= 60 && (v.marketing_evidence ?? '').length <= 1000 && (v.marketing_language ?? '').length <= 20, 'Marketing wording/evidence/version/language is too long');
  const withdrawal = ['unsubscribed', 'bounced', 'complained'].includes(status);
  if (!withdrawal && opted !== 'true') return { kind: 'not_granted', address: contact.email, reason: status === 'subscribed' ? 'Subscribed is not an evidenced opt-in' : 'No explicit marketing opt-in' };
  insist(contact.email, 'Marketing consent needs a contact email');
  let actedAt = '';
  if (v.marketing_captured_at) {
    const input = v.marketing_captured_at;
    insist(/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d{1,3})?)?(?:Z|[+-]\d\d:\d\d)$/.test(input) && Number.isFinite(Date.parse(input)), 'marketing_captured_at: use an ISO date/time with a time zone');
    insist(new Date(input.slice(0, 10) + 'T00:00:00Z').toISOString().slice(0, 10) === input.slice(0, 10), 'marketing_captured_at: use a valid calendar day');
    actedAt = new Date(input).toISOString();
    insist(actedAt <= new Date(Date.now() + 300_000).toISOString(), 'marketing_captured_at cannot be in the future');
  }
  if (withdrawal) return { kind: 'withdraw', status, actedAt, address: contact.email, wording: '', version: '', language: v.marketing_language || 'en', evidence: v.marketing_evidence || `Source status: ${status}` };
  insist(actedAt, 'Map marketing_captured_at for every explicit opt-in');
  insist(v.marketing_wording && v.marketing_wording_version && v.marketing_evidence, 'Map the exact marketing_wording, marketing_wording_version and marketing_evidence for every opt-in');
  return { kind: 'grant', actedAt, address: contact.email, wording: v.marketing_wording, version: v.marketing_wording_version, language: v.marketing_language || 'en', evidence: v.marketing_evidence };
}

/** These statements share Base's atomic target write and live owner guard. */
export function importedMarketing(v: Data, targetId: string, at: string): D1Sql[] {
  return (v.marketing ?? []).flatMap((event: Data) => {
    const eventId = 'import-consent:' + sha256(canonicalJson([targetId, event]));
    const evidence = event.evidence + (event.kind === 'grant' ? `\nPrincipal attestation: ${MARKETING_ATTESTATION}` : '');
    return [{ sql: `INSERT INTO b_marketing_consents(id,contact_id,client_id,address,channel,kind,source,acted_at,recorded_at,actor,wording,wording_version,language,evidence) VALUES(?,?,?,?,'email',?,'import',?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING`,
      params: [eventId, event.contactId, v.clientId, event.address, event.kind, event.actedAt || at, at, v.marketingActor, event.wording, event.version, event.language, evidence] },
    { sql: 'INSERT INTO b_audit(id,actor,action,object_id,detail,at) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING', params: ['audit:' + eventId, v.marketingActor, event.kind === 'grant' ? 'consent.marketing_granted' : 'consent.marketing_withdrawn', v.clientId, `${event.address}: import (${event.status || 'explicit opt-in'}); source ${targetId}`, at] }];
  });
}
