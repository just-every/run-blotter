// Provider delivery events for bulk messages (MSG-002): delivery, bounce and
// complaint only, never opens or clicks. Each event is authenticated by the
// provider's webhook signature and applied at most once. A hard bounce marks
// the address invalid for both classes; a complaint withdraws marketing for
// the address and alerts the batch owner.
import { runtimeBindings, type Bindings } from '../auth.server';
import { verifyMailWebhook } from '../mail.server.mjs';
import { withdrawStatements } from './marketing-consent';
import { deliverAlerts, notify } from './notifications';
import { Fault, id, insist, now, stmt, type Data } from './model';

const TYPES: Record<string, 'delivered' | 'bounced' | 'complained'> = { 'email.delivered': 'delivered', 'email.bounced': 'bounced', 'email.complained': 'complained' };
const NEXT: Record<string, string> = { delivered: "status='accepted'", bounced: "status IN ('accepted','delivered')", complained: "status IN ('accepted','delivered')" };

export async function providerEvent(env: Bindings, request: Request) {
  const bindings = runtimeBindings(env), db = bindings.DB, key = bindings.MAIL_WEBHOOK_SECRET;
  insist(bindings.MAIL_PROVIDER === 'resend' && key, 'Provider events are not configured for this mail provider', 404);
  insist(Number(request.headers.get('content-length') ?? 0) <= 1_048_576, 'Event too large', 413);
  const raw = new Uint8Array(await request.arrayBuffer());
  insist(raw.length > 0 && raw.length <= 1_048_576, 'Event too large', 413);
  insist(await verifyMailWebhook({ provider: 'resend', rawBody: raw, headers: request.headers, key, now: Date.now() }), 'Invalid provider signature', 401);
  const eventId = request.headers.get('svix-id')!;
  let event: Data;
  try { event = JSON.parse(new TextDecoder().decode(raw)); } catch { throw new Fault('Supply valid JSON'); }
  const name = String(event?.type), type = Object.hasOwn(TYPES, name) ? TYPES[name] : undefined;
  if (!type) return { eventId, tracked: false };
  const messageId = String(event.data?.email_id ?? ''), to: string[] = (Array.isArray(event.data?.to) ? event.data.to : []).map((a: unknown) => String(a).toLowerCase());
  const r = messageId ? await stmt(db, 'SELECT r.*,b.class,b.owner_email FROM b_bulk_recipients r JOIN b_bulk_batches b ON b.id=r.batch_id WHERE r.provider_message_id=?', messageId).first<Data>() : null;
  // Signed events for other mail (sign-in links, staff alerts) are acknowledged and not tracked here.
  if (!r || !to.includes(r.address)) return { eventId, tracked: false };
  if (await stmt(db, 'SELECT 1 FROM b_bulk_events WHERE provider_event_id=?', eventId).first()) return { eventId, duplicate: true };
  const at = now(), occurred = Number.isNaN(Date.parse(event.created_at)) ? at : new Date(event.created_at).toISOString();
  const hard = type === 'bounced' && event.data?.bounce?.type !== 'Transient';
  const detail = type === 'bounced' ? `${hard ? 'hard' : 'transient'} bounce${event.data?.bounce?.message ? `: ${String(event.data.bounce.message).slice(0, 300)}` : ''}` : type;
  const statements = [
    stmt(db, 'INSERT INTO b_bulk_events(id,provider_event_id,recipient_id,type,detail,occurred_at,recorded_at) VALUES(?,?,?,?,?,?,?)', id(), eventId, r.id, type, detail, occurred, at),
    stmt(db, `UPDATE b_bulk_recipients SET status=? WHERE id=? AND ${NEXT[type]}`, type, r.id),
    stmt(db, 'INSERT INTO b_audit(id,actor,action,object_id,detail,at) VALUES(?,?,?,?,?,?)', id(), 'mail provider', `bulk.${type}`, r.job_id ?? r.client_id, `${r.class}: ${detail} for ${r.address}`, at),
  ];
  if (hard) statements.push(stmt(db, 'INSERT OR IGNORE INTO b_mail_suppressions(address,reason,source_event,at) VALUES(?,?,?,?)', r.address, 'hard bounce', eventId, at),
    stmt(db, `INSERT OR IGNORE INTO b_notifications(id,to_email,kind,job_id,summary,delivery,created_at)
      SELECT ?,?,'delivery_failed',?,'Bulk message bounced','in-app only',?
      WHERE EXISTS(SELECT 1 FROM oa_operators WHERE email=? AND role='owner' AND status='active')
         OR EXISTS(SELECT 1 FROM b_members WHERE email=? AND active=1)`,
      'bulk-bounced:' + r.id, r.owner_email, r.job_id, at, r.owner_email, r.owner_email));
  if (type === 'complained') statements.push(...withdrawStatements(db, r.address, 'provider_complaint', 'mail provider', `provider complaint ${eventId}`, r.client_id));
  try { await db.batch(statements); }
  catch (error) { if (/UNIQUE/i.test(String(error))) return { eventId, duplicate: true }; throw error; }
  if (hard) await deliverAlerts(env);
  if (type === 'complained') await notify(env, [r.owner_email], { kind: 'delivery_failed', jobId: r.job_id, summary: `A recipient complained about your ${r.class} message; marketing is withdrawn for that address` });
  return { eventId, type, recipient: r.id };
}
