// One claimed delivery per user-local calendar day, including repeated DST hours.
import { runtimeBindings, type Bindings } from '../auth.server';
import { sendMail } from './documents';
import { firmSettings, localClock } from './firm';
import { rows, stmt, type Data } from './model';
import { notificationAuthority } from './notification-authority';
import { personalSettings } from './notification-settings';
import { outsideQuiet } from './notifications';
export async function deliverDigests(env:Bindings,at:Date) {
  const bindings=runtimeBindings(env),db=bindings.DB,firm=await firmSettings(db);
  if(!localClock(firm,at).notificationsAllowed)return;
  const users=await rows(db,"SELECT email FROM oa_operators WHERE status='active' AND (role='owner' OR EXISTS(SELECT 1 FROM b_members m WHERE m.email=oa_operators.email AND m.active=1))");
  for(const user of users) {
    const p=await personalSettings(db,user.email,firm),clock=localClock({...p,notificationStart:'00:00',notificationEnd:'00:00'},at);
    if(!p.digestEnabled||clock.localTime<p.digestTime||!outsideQuiet(p,at))continue;
    const items=await rows(db,`SELECT DISTINCT n.job_id,j.due_date FROM b_notifications n JOIN b_jobs j ON j.id=n.job_id
      WHERE n.to_email=? AND n.kind IN ('due_soon','overdue') AND j.status<>'signed_off' AND ${notificationAuthority}
      AND j.due_date<=? AND n.id NOT LIKE 'held:%' ORDER BY j.due_date,n.job_id`,user.email,
      new Date(Date.parse(clock.localDate+'T00:00:00Z')+p.leadDays*86400000).toISOString().slice(0,10));
    if(!items.length)continue;
    const claimed=await stmt(db,"INSERT OR IGNORE INTO b_notification_digests VALUES(?,?,'pending',?)",user.email,clock.localDate,at.toISOString()).run();
    if(!claimed.meta.changes)continue;
    const text=items.map((j:Data)=>`${j.due_date<clock.localDate?'Overdue':'Due soon'} · ${j.due_date}\n${bindings.AUTH_ORIGIN}/app?job=${encodeURIComponent(j.job_id)}`).join('\n\n');
    const delivery=await sendMail(bindings,`digest:${user.email}:${clock.localDate}`,user.email,'Blotter: daily work digest',text);
    await stmt(db,'UPDATE b_notification_digests SET delivery=? WHERE email=? AND local_date=?',delivery,user.email,clock.localDate).run();
  }
}
