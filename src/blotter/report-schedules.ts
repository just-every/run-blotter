import { runtimeBindings, type Bindings } from '../auth.server';
import { reportFilters } from './reports';
import { firmSettings, localClock } from './firm';
import { shift } from './capacity';
import { deliverAlerts } from './notifications';
import { atomic,audit,date,email,guard,human,id,insist,integer,need,now,rows,stmt,text,type Actor,type Data } from './model';

export async function reportViews(db:D1Database,actor:Actor) {
  human(actor);need(actor,'owner','reviewer');
  return {views:await rows(db,'SELECT * FROM b_report_views ORDER BY created_at'),schedules:await rows(db,'SELECT * FROM b_report_schedules ORDER BY created_at'),runs:await rows(db,'SELECT * FROM b_report_runs ORDER BY at DESC LIMIT 100')};
}
export async function saveReportView(db:D1Database,actor:Actor,body:Data) {
  human(actor);need(actor,'owner','reviewer');const viewId=id(),filters=reportFilters(body),name=text(body.name,'View name',100);
  await atomic(db,actor,[stmt(db,'INSERT INTO b_report_views(id,name,filters,created_by,created_at) VALUES(?,?,?,?,?)',viewId,name,JSON.stringify(filters),actor.email,now()),audit(db,actor,'report.view_saved',viewId,name)]);
  return {id:viewId,name,filters};
}
const leadSql = `EXISTS(SELECT 1 FROM oa_operators WHERE email=? AND status='active' AND role='owner') OR EXISTS(SELECT 1 FROM b_members WHERE email=? AND active=1 AND role='reviewer')`;
export async function scheduleReport(db:D1Database,actor:Actor,body:Data) {
  human(actor);need(actor,'owner');
  const viewId=text(body.viewId,'View',100),recipient=email(body.recipient,'Partner email'),nextDate=date(body.nextDate,'First date'),everyDays=integer(body.everyDays,'Interval days',1,366),scheduleId=id();
  insist(await stmt(db,'SELECT 1 FROM b_report_views WHERE id=?',viewId).first(),'View not found',404);
  insist(await stmt(db,'SELECT 1 WHERE '+leadSql,recipient,recipient).first(),'Choose an active principal or reviewer');
  const [check,release]=guard(db,leadSql,recipient,recipient);
  await atomic(db,actor,[check,stmt(db,"INSERT INTO b_report_schedules VALUES(?,?,?,?,?,?,?,?,'active')",scheduleId,viewId,recipient,actor.id,actor.email,now(),nextDate,everyDays),release,audit(db,actor,'report.scheduled',scheduleId,`${viewId}; ${recipient}; ${nextDate}; every ${everyDays} days`)]);
  return {id:scheduleId};
}
export async function pauseReport(db:D1Database,actor:Actor,scheduleId:string) {
  human(actor);need(actor,'owner');insist(await stmt(db,'SELECT 1 FROM b_report_schedules WHERE id=?',scheduleId).first(),'Schedule not found',404);
  await atomic(db,actor,[stmt(db,"UPDATE b_report_schedules SET status='paused' WHERE id=?",scheduleId),audit(db,actor,'report.paused',scheduleId)]);return {ok:true};
}
// One durable notification per due date; catching up sends one current link, not stale attachments.
export async function runReports(env:Bindings,at=new Date()) {
  const bindings=runtimeBindings(env),db=bindings.DB,today=localClock(await firmSettings(db),at).localDate;
  const schedules=await rows(db,`SELECT s.*,v.name FROM b_report_schedules s JOIN b_report_views v ON v.id=s.view_id WHERE s.status='active' AND s.next_date<=?`,today);
  for(const s of schedules) {
    const authorized=await stmt(db,`SELECT 1 WHERE EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND status='active' AND role='owner') AND (${leadSql})`,s.principal_id,s.recipient,s.recipient).first();
    if(!authorized){await stmt(db,"UPDATE b_report_schedules SET status='paused' WHERE id=?",s.id).run();continue;}
    let next=s.next_date;while(next<=today)next=shift(next,s.every_days);
    const runId=id(),notificationId=id(),[check,release]=guard(db,`EXISTS(SELECT 1 FROM b_report_schedules WHERE id=? AND status='active' AND next_date=?) AND EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND status='active' AND role='owner') AND (${leadSql})`,s.id,s.next_date,s.principal_id,s.recipient,s.recipient);
    await db.batch([check,stmt(db,'INSERT INTO b_report_runs VALUES(?,?,?,?,?)',runId,s.id,s.next_date,at.toISOString(),notificationId),
      stmt(db,`INSERT INTO b_notifications(id,to_email,kind,summary,delivery,created_at) VALUES(?,?,'internal_report',?,'deferred: outside firm notification hours',?)`,notificationId,s.recipient,`${s.name}: live report at ${bindings.AUTH_ORIGIN}/app?report=${s.view_id}`,at.toISOString()),
      stmt(db,'UPDATE b_report_schedules SET next_date=? WHERE id=?',next,s.id),stmt(db,"INSERT INTO b_audit VALUES(?,?,'report.notification_queued',?,?,?)",id(),s.created_by,s.id,`${runId}; ${s.recipient}`,at.toISOString()),release]).catch(async error=>{if(!await stmt(db,'SELECT 1 FROM b_report_runs WHERE schedule_id=? AND due_date=?',s.id,s.next_date).first())throw error;});
  }
  await deliverAlerts(env,at);
}
