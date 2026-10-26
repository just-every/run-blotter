// The same predicate fences request admission and the effect transaction.
import type { Actor } from './model';
export const liveIntegrationSql = `EXISTS(SELECT 1 FROM b_integration_keys k JOIN oa_operators o ON o.id=k.creator_id
 WHERE k.id=? AND k.status='active' AND k.digest IS NOT NULL AND o.status='active' AND o.role='owner' AND o.email=k.creator_email
 AND EXISTS(SELECT 1 FROM b_mfa_factors f WHERE f.email=o.email AND f.confirmed_at IS NOT NULL)
 AND EXISTS(SELECT 1 FROM b_integration_clients s JOIN b_clients c ON c.id=s.client_id WHERE s.key_id=k.id AND c.erased_at IS NULL AND c.merged_into IS NULL))`;
export function integrationScopeSql(actor: Actor, client: string) {
 return actor.integration ? `EXISTS(SELECT 1 FROM b_integration_clients ikc WHERE ikc.key_id='${actor.integration.keyId.replaceAll("'", "''")}' AND ikc.client_id=${client})` : '1';
}

/** A surviving client and its full merge ancestry; grants never widen on merge. */
export const integrationFamilySql=(client:string)=>`(WITH RECURSIVE family(id) AS (SELECT ${client} UNION SELECT c.id FROM b_clients c JOIN family f ON c.merged_into=f.id) SELECT id FROM family)`;
