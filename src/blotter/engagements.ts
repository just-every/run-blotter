// ERASURE-002 signed engagements (ct 22 Oct 2026). Until ENGAGE-001 signs letters natively, the
// principal files a signed letter to the client with its signers and signed date. The record says
// so on its face ("practitioner-recorded, not signed through Blotter") and carries its SHA-256.
// It belongs to the signed-engagement class: kept through client erasure, with its own clock.
import { decodeFile } from './documents';
import { atomic, audit, date, digest, human, id, insist, need, now, rows, stmt, text, type Actor, type Data } from './model';

export const ENGAGEMENT_LABEL = 'practitioner-recorded, not signed through Blotter';

export async function engagements(db: D1Database, actor: Actor, clientId: string) {
  human(actor); need(actor, 'owner');
  return rows(db, 'SELECT id,title,signers,signed_date,label,name,mime,size,sha256,recorded_by,recorded_at,erased_at FROM b_engagements WHERE client_id=? ORDER BY signed_date,id', clientId);
}

export async function recordEngagement(db: D1Database, actor: Actor, clientId: string, body: Data) {
  human(actor); need(actor, 'owner');
  const client = await stmt(db, 'SELECT erased_at FROM b_clients WHERE id=?', clientId).first<Data>();
  insist(client, 'Client not found', 404);
  insist(!client.erased_at, 'This client was already erased', 409);
  const signers = (Array.isArray(body.signers) ? body.signers : String(body.signers ?? '').split('\n')).map((v: unknown) => String(v).trim()).filter(Boolean);
  insist(signers.length > 0 && signers.length <= 20 && signers.every((v: string) => v.length <= 200), 'Name the signers (up to 20)');
  const file = decodeFile(body.file ?? {}), engagementId = id();
  await atomic(db, actor, [
    stmt(db, 'INSERT INTO b_engagements(id,client_id,title,signers,signed_date,label,name,mime,size,sha256,content_base64,recorded_by,recorded_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)',
      engagementId, clientId, text(body.title, 'Title', 200), JSON.stringify(signers), date(body.signedDate, 'Signed date'), ENGAGEMENT_LABEL, file.name, file.mime, file.bytes.length, await digest(file.bytes), file.encoded, actor.email, now()),
    audit(db, actor, 'engagement.recorded', clientId, `${engagementId.slice(0, 8)}; ${ENGAGEMENT_LABEL}`)]);
  return { id: engagementId, label: ENGAGEMENT_LABEL };
}

export async function downloadEngagement(db: D1Database, actor: Actor, engagementId: string) {
  human(actor); need(actor, 'owner');
  const e = await stmt(db, 'SELECT * FROM b_engagements WHERE id=?', engagementId).first<Data>();
  insist(e, 'Engagement not found', 404);
  insist(e.content_base64, 'The bytes of this engagement were erased at the end of its retention period', 404);
  return new Response(Uint8Array.from(atob(e.content_base64), c => c.charCodeAt(0)), { headers: { 'content-type': e.mime, 'content-disposition': `attachment; filename="${String(e.name).replace(/"/g, '')}"`, 'cache-control': 'no-store' } });
}
