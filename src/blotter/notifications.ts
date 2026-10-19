// Staff alerts for review and discussion (COLLAB-001): each alert is kept for the
// person's in-app list and mailed through the operator's provider.
import { runtimeBindings, type Bindings } from '../auth.server';
import { sendMail } from './documents';
import { id, now, rows, stmt, type Actor, type Data } from './model';

export type Alert = { kind: string; jobId?: string | null; threadId?: string | null; summary: string };

/** Alerts each recipient once; the person who acted is never alerted about their own action. */
export async function notify(env: Bindings, recipients: string[], alert: Alert, except = '') {
  const bindings = runtimeBindings(env), db = bindings.DB;
  for (const to of [...new Set(recipients)].filter(address => address && address !== except)) {
    const alertId = id();
    await stmt(db, 'INSERT INTO b_notifications(id,to_email,kind,job_id,thread_id,summary,delivery,created_at) VALUES(?,?,?,?,?,?,?,?)',
      alertId, to, alert.kind, alert.jobId ?? null, alert.threadId ?? null, alert.summary, 'pending', now()).run();
    const delivery = await sendMail(bindings, alertId, to, `Blotter: ${alert.summary}`, `${alert.summary}\n\nOpen Blotter: ${bindings.AUTH_ORIGIN}/app`);
    await stmt(db, 'UPDATE b_notifications SET delivery=? WHERE id=?', delivery, alertId).run();
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
