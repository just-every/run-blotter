// Native-session API-002 client writes share the native validation and transaction.
import { prepareClient } from './clients';
import { clientDetail } from './client-lifecycle';
import { atomic, digest, Fault, human, insist, need, now, stmt, type Actor, type Data } from './model';

// JSON object ordering is immaterial; array order and exact scalar values matter.
function canonical(value: any): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value !== null && typeof value === 'object') return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
  return JSON.stringify(value);
}

export async function createClientOnce(db: D1Database, actor: Actor, body: Data, key: string | undefined) {
  human(actor); need(actor, 'owner', 'reviewer');
  insist(typeof key === 'string' && /^[A-Za-z0-9._:-]{1,128}$/.test(key), 'Supply an Idempotency-Key of 1–128 letters, digits, dots, underscores, colons or hyphens');
  const keyHash = await digest(key), payloadHash = await digest(canonical(body));
  const receipt = () => stmt(db, 'SELECT payload_digest,client_id FROM b_api_client_writes WHERE actor_email=? AND key_digest=?', actor.email, keyHash).first<Data>();
  const replay = async (saved: Data) => {
    insist(saved.payload_digest === payloadHash, 'Idempotency-Key was already used with a different request', 409);
    // Return current native data, never a cached response that could outlive authority.
    return { clientId: saved.client_id, replayed: true, ...await clientDetail(db, actor, saved.client_id) };
  };
  const saved = await receipt();
  if (saved) return replay(saved);
  const { client, statements } = await prepareClient(db, actor, body);
  try {
    await atomic(db, actor, [
      ...statements,
      stmt(db, 'INSERT INTO b_api_client_writes(actor_email,key_digest,payload_digest,client_id,created_at) VALUES(?,?,?,?,?)', actor.email, keyHash, payloadHash, client.id, now()),
    ]);
  } catch (error) {
    // A simultaneous request may have won the unique key; the losing batch rolled back.
    if (error instanceof Fault && error.status === 409) {
      const winner = await receipt();
      if (winner) return replay(winner);
    }
    throw error;
  }
  return { clientId: client.id, replayed: false, ...await clientDetail(db, actor, client.id) };
}
