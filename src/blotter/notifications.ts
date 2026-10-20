// Durable native staff notices (COLLAB-001 / NOTIFY-001).
import { runtimeBindings, type Bindings } from '../auth.server';
import { sendMail } from './documents';
import { firmSettings, localClock } from './firm';
import { id, now, rows, stmt, type Actor, type Data } from './model';
import { notificationAuthority, notificationJobAuthority } from './notification-authority';
import { notificationDefaults, personalSettings } from './notification-settings';
import { syncNotificationEvents, dueNotifications } from './notification-events';
import { deliverDigests } from './notification-digest';
export type Alert = { kind: string; jobId?: string | null; threadId?: string | null; summary: string };
// Keep legacy subjects useful, but scrub every nine-digit tax identifier including SSN/EIN punctuation.
export const safeSubject = (summary:string) => `Blotter: ${summary.replace(/\d(?:[\s-]*\d){8}/g,'[tax identifier hidden]').replace(/[\r\n]/g,' ')}`;
export async function notify(env: Bindings, recipients: string[], alert: Alert, except = '') {
  const db = runtimeBindings(env).DB;
  for (const to of [...new Set(recipients)].filter(address => address && address !== except)) {
    await stmt(db, 'INSERT INTO b_notifications(id,to_email,kind,job_id,thread_id,summary,delivery,created_at) VALUES(?,?,?,?,?,?,?,?)',
      id(), to, alert.kind, alert.jobId ?? null, alert.threadId ?? null, alert.summary, 'deferred: outside firm notification hours', now()).run();
  }
  await deliverAlerts(env);
}
export async function reviewRequested(env: Bindings, jobId: string, by: string) {
  const j = await stmt(runtimeBindings(env).DB, 'SELECT j.*,c.name client FROM b_jobs j JOIN b_clients c ON c.id=j.client_id WHERE j.id=?', jobId).first<Data>();
  await notify(env, [j!.reviewer_email], { kind: 'review_requested', jobId, summary: `${by} submitted ${j!.client} ${j!.title} ${j!.period_label} for your review` });
}
export async function myNotifications(db: D1Database, actor: Actor) {
  const alerts=await rows(db, `SELECT n.*,
    (SELECT c.name||' · '||j.title||' · '||j.period_label FROM b_jobs j JOIN b_clients c ON c.id=j.client_id WHERE j.id=n.job_id AND ${notificationJobAuthority}) item_label,
    CASE WHEN ${notificationJobAuthority} THEN n.job_id ELSE NULL END authorized_job_id,
    (SELECT j.id FROM b_threads t JOIN b_jobs j ON j.client_id=t.client_id WHERE t.id=n.thread_id AND (?<>'preparer' OR j.preparer_email=?) ORDER BY j.created_at DESC LIMIT 1) linked_job_id
    FROM b_notifications n WHERE n.to_email=? AND ${notificationAuthority} ORDER BY n.created_at DESC,n.id DESC LIMIT 200`,actor.role,actor.email,actor.email);
  return alerts.map(n=>({...n,job_id:n.authorized_job_id??n.linked_job_id}));
}
export function outsideQuiet(settings:Data,at:Date) {
  const c=localClock({...settings,notificationStart:settings.quietStart,notificationEnd:settings.quietEnd},at);
  return settings.quietStart===settings.quietEnd || !c.notificationsAllowed;
}
/** Firm window still governs legacy delivery. Personal quiet hours can defer it further. */
export async function deliverAlerts(env: Bindings, at = new Date()) {
  const bindings=runtimeBindings(env),db=bindings.DB,firm=await firmSettings(db),defaults=await notificationDefaults(db);
  const pending=await rows(db,`SELECT n.* FROM b_notifications n WHERE n.delivery IN ('in-app only','deferred: outside firm notification hours') AND ${notificationAuthority} ORDER BY n.created_at LIMIT 500`);
  for(const n of pending) {
    const personal=await personalSettings(db,n.to_email,firm);
    if(!personal.emailKinds.includes(n.kind)&&!defaults.mandatoryKinds.includes(n.kind)) {
      await stmt(db,"UPDATE b_notifications SET delivery='not enabled: in-app only' WHERE id=? AND delivery IN ('in-app only','deferred: outside firm notification hours')",n.id).run();continue;
    }
    if(!localClock(firm,at).notificationsAllowed||!outsideQuiet(personal,at))continue;
    const claimed=await stmt(db,`UPDATE b_notifications AS n SET delivery='pending' WHERE n.id=? AND n.delivery IN ('in-app only','deferred: outside firm notification hours') AND ${notificationAuthority}`,n.id).run();
    if(!claimed.meta.changes)continue;
    const canOpen=n.job_id&&await stmt(db,`SELECT 1 FROM b_notifications n WHERE n.id=? AND ${notificationJobAuthority}`,n.id).first();
    const link=canOpen?`${bindings.AUTH_ORIGIN}/app?job=${encodeURIComponent(n.job_id)}`:`${bindings.AUTH_ORIGIN}/app`;
    const delivery=await sendMail(bindings,n.id,n.to_email,safeSubject(n.summary),`${n.summary}\n\nOpen Blotter: ${link}`);
    await stmt(db,'UPDATE b_notifications SET delivery=? WHERE id=?',delivery,n.id).run();
    if(n.kind!=='delivery_failed' && /^(failed|not sent|rejected)/.test(delivery)) await stmt(db,"INSERT OR IGNORE INTO b_notifications(id,to_email,kind,job_id,summary,delivery,created_at) VALUES(?,?,'delivery_failed',?,'Staff notification delivery failed','in-app only',?)",'failed:'+n.id,n.to_email,n.job_id,at.toISOString()).run();
  }
}
/** Public writes and the Cron Trigger consume native events; restores never invoke this path. */
export async function refreshNotifications(env:Bindings,at=new Date(),scheduled=false) {
  const db=runtimeBindings(env).DB;
  await syncNotificationEvents(db);
  if(scheduled)await dueNotifications(db,at);
  await deliverAlerts(env,at);
  if(scheduled)await deliverDigests(env,at);
}
