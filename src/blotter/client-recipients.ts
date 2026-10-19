// One explicit recipient per send; neither relationship nor email implies authority.
import { guard, insist, rows, stmt, type Data } from './model';
export type ContactPurpose = 'request' | 'billing' | 'tax' | 'bookkeeping' | 'signature';
export async function recipientFor(db: D1Database, clientId: string, purpose: ContactPurpose, contactId?: string): Promise<Data> {
  const client = await stmt(db, "SELECT id FROM b_clients WHERE id=? AND merged_into IS NULL AND lifecycle='active'", clientId).first();
  insist(client, 'This client is archived or unavailable', 409);
  const role = purpose === 'request' || purpose === 'signature' ? 'primary' : purpose;
  const recipients = await rows(db, `SELECT * FROM b_client_contacts WHERE client_id=? AND active=1 AND authorized=1 AND email<>'' AND email_consent=1
    AND (?<>'request' OR (request_consent=1 AND portal=1)) AND (?<>'signature' OR signer=1)
    AND (?='' OR id=?) AND (?<>'' OR EXISTS(SELECT 1 FROM json_each(roles) WHERE value=?)) ORDER BY name,id`, clientId, purpose, purpose, contactId ?? '', contactId ?? '', contactId ?? '', role);
  insist(recipients.length, 'Choose an authorized contact with consent for this message', 409);
  insist(recipients.length === 1 || !!contactId, 'Choose the recipient for this message', 409);
  return recipients[0];
}
/** Include this alongside every write that relies on a contact grant. */
export function contactGuard(db: D1Database, clientId: string, contactId: string, purpose: ContactPurpose = 'request', revision?: string) {
  return guard(db, `EXISTS(SELECT 1 FROM b_client_contacts c JOIN b_clients e ON e.id=c.client_id WHERE c.id=? AND c.client_id=? AND c.active=1 AND c.authorized=1 AND c.portal=1
    AND (? IS NULL OR c.revision=?) AND e.lifecycle='active' AND e.merged_into IS NULL AND (?<>'request' OR c.request_consent=1 AND c.email_consent=1) AND (?<>'signature' OR c.signer=1))`, contactId, clientId, revision ?? null, revision ?? null, purpose, purpose);
}
