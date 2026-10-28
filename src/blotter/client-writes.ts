// Native-session API-006 client writes share the native validation and transaction.
import { prepareClient } from './clients';
import { clientDetail } from './client-lifecycle';
import { atomic, digest, Fault, guard, human, insist, need, now, stmt, type Actor, type Data } from './model';

// JSON object ordering is immaterial; array order and exact scalar values matter.
function canonical(value: any): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value !== null && typeof value === 'object') return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
  return JSON.stringify(value);
}

export async function createClientOnce(db: D1Database, actor: Actor, body: Data, key: string | undefined) {
  if (actor.integration?.action !== 'clients:create') human(actor);
  need(actor, 'owner', 'reviewer');
  if(actor.integration) insist(Object.keys(body).every(k=>['name','ein','entityType','services','fields','tags'].includes(k)),'Integration client creation accepts entity fields only; contacts, grants and relationships require human review');
  const namespace=actor.integration ? 'integration:'+actor.integration.keyId : actor.email;
  insist(typeof key === 'string' && /^[A-Za-z0-9._:-]{1,128}$/.test(key), 'Supply an Idempotency-Key of 1–128 letters, digits, dots, underscores, colons or hyphens');
  const keyHash = await digest(key), payloadHash = await digest(canonical(body));
  const receipt = () => stmt(db, 'SELECT payload_digest,client_id FROM b_api_client_writes WHERE actor_email=? AND key_digest=?', namespace, keyHash).first<Data>();
  const replay = async (saved: Data) => {
    insist(saved.payload_digest === payloadHash, 'Idempotency-Key was already used with a different request', 409);
    // Return current native data, never a cached response that could outlive authority.
    if(actor.integration) {
      insist(await stmt(db,'SELECT 1 FROM b_integration_clients s JOIN b_clients c ON c.id=s.client_id WHERE s.key_id=? AND c.id=? AND c.erased_at IS NULL AND c.merged_into IS NULL',actor.integration.keyId,saved.client_id).first(),'Client no longer in integration scope',404);
      const [check,done]=guard(db,'EXISTS(SELECT 1 FROM b_integration_clients s JOIN b_clients c ON c.id=s.client_id WHERE s.key_id=? AND c.id=? AND c.erased_at IS NULL AND c.merged_into IS NULL)',actor.integration.keyId,saved.client_id);
      await atomic(db,actor,[check,done]);return {clientId:saved.client_id,replayed:true};
    }
    return { clientId: saved.client_id, replayed: true, ...await clientDetail(db, actor, saved.client_id) };
  };
  const saved = await receipt();
  if (saved) return replay(saved);
  const { client, statements } = await prepareClient(db, actor, body);
  try {
    await atomic(db, actor, [
      ...statements,
      ...(actor.integration ? [stmt(db,'INSERT INTO b_integration_clients(key_id,client_id) VALUES(?,?)',actor.integration.keyId,client.id)] : []),
      stmt(db, 'INSERT INTO b_api_client_writes(actor_email,key_digest,payload_digest,client_id,created_at) VALUES(?,?,?,?,?)', namespace, keyHash, payloadHash, client.id, now()),
    ]);
  } catch (error) {
    // A simultaneous request may have won the unique key; the losing batch rolled back.
    if (error instanceof Fault && error.status === 409) {
      const winner = await receipt();
      if (winner) return replay(winner);
    }
    throw error;
  }
  if(actor.integration)return {clientId:client.id,replayed:false};
  return { clientId: client.id, replayed: false, ...await clientDetail(db, actor, client.id) };
}
