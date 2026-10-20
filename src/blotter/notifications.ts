// Staff alerts for review and discussion (COLLAB-001): each alert is kept for the
// person's in-app list and mailed through the operator's provider.
import { runtimeBindings, type Bindings } from '../auth.server';
import { sendMail } from './documents';
import { firmSettings, localClock } from './firm';
import { id, now, rows, stmt, type Actor, type Data } from './model';

export type Alert = { kind: string; jobId?: string | null; threadId?: string | null; summary: string };

/** Alerts each recipient once; the person who acted is never alerted about their own action. */
export async function notify(env: Bindings, recipients: string[], alert: Alert, except = '') {
  const bindings = runtimeBindings(env), db = bindings.DB;
  for (const to of [...new Set(recipients)].filter(address => address && address !== except)) {
    const alertId = id();
    await stmt(db, 'INSERT INTO b_notifications(id,to_email,kind,job_id,thread_id,summary,delivery,created_at) VALUES(?,?,?,?,?,?,?,?)',
      alertId, to, alert.kind, alert.jobId ?? null, alert.threadId ?? null, alert.summary, 'pending', now()).run();
    await stmt(db, "UPDATE b_notifications SET delivery='deferred: outside firm notification hours' WHERE id=?", alertId).run();
    await deliverAlerts(env);
  }
}

/** Tells the assigned reviewer a job is waiting for them (COLLAB-001). */
export async function reviewRequested(env: Bindings, jobId: string, by: string) {
  const j = await stmt(runtimeBindings(env).DB, 'SELECT j.*,c.name client FROM b_jobs j JOIN b_clients c ON c.id=j.client_id WHERE j.id=?', jobId).first<Data>();
  await notify(env, [j!.reviewer_email], { kind: 'review_requested', jobId, summary: `${by} submitted ${j!.client} ${j!.title} ${j!.period_label} for your review` });
}

/** The signed-in person's own alerts, newest first. */
export async function myNotifications(db: D1Database, actor: Actor) {
  return rows(db, 'SELECT id,kind,job_id,thread_id,summary,delivery,created_at FROM b_notifications WHERE to_email=? ORDER BY created_at DESC LIMIT 50', actor.email);
}

// REPORT-001 links retain their scheduling principal and recipient authority at delivery.
const reportAuthority = `(n.kind<>'internal_report' OR EXISTS(
  SELECT 1 FROM b_report_runs rr JOIN b_report_schedules rs ON rs.id=rr.schedule_id
  JOIN oa_operators principal ON principal.id=rs.principal_id AND principal.status='active' AND principal.role='owner'
  WHERE rr.notification_id=n.id AND rs.status='active' AND rs.recipient=n.to_email
    AND (EXISTS(SELECT 1 FROM oa_operators WHERE email=n.to_email AND status='active' AND role='owner')
      OR EXISTS(SELECT 1 FROM b_members WHERE email=n.to_email AND active=1 AND role='reviewer'))))`;

/** Durable staff alerts wait for firm-local notification hours. In-app alerts appear immediately. */
export async function deliverAlerts(env: Bindings, at = new Date()) {
  const bindings = runtimeBindings(env), db = bindings.DB;
  if (!localClock(await firmSettings(db), at).notificationsAllowed) return;
  const pending = await rows(db, `SELECT n.* FROM b_notifications n WHERE n.delivery='deferred: outside firm notification hours'
    AND ${reportAuthority} AND (EXISTS(SELECT 1 FROM oa_operators o WHERE o.email=n.to_email AND o.status='active' AND o.role='owner')
      OR EXISTS(SELECT 1 FROM b_members m WHERE m.email=n.to_email AND m.active=1)) ORDER BY n.created_at LIMIT 100`);
  for (const n of pending) {
    const claimed = await stmt(db, `UPDATE b_notifications AS n SET delivery='pending' WHERE n.id=? AND n.delivery='deferred: outside firm notification hours' AND ${reportAuthority}`, n.id).run();
    if (!claimed.meta.changes) continue;
    const delivery = await sendMail(bindings, n.id, n.to_email, `Blotter: ${n.summary}`, `${n.summary}\n\nOpen Blotter: ${bindings.AUTH_ORIGIN}/app`);
    await stmt(db, 'UPDATE b_notifications SET delivery=? WHERE id=?', delivery, n.id).run();
  }
}
