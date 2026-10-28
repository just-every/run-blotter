// NOTIFY-002: native channels and explicit user/firm choices.
import { firmSettings } from './firm';
import { notificationAuthority } from './notification-authority';
import { atomic, audit, human, insist, integer, need, now, stmt, text, type Actor, type Data } from './model';

export const kinds = [
  ['signature','Signature request updated',false],
  ['work_assigned','Work assigned',false],['task_assigned','Task assigned',false],
  ['review_requested','Review requested',true],['review_returned','Review returned',true],
  ['mention','Mention',true],['correction','Correction requested',true],['reply','Discussion reply',true],['resolved','Discussion resolved',true],
  ['client_question','Client reply',true],['client_todo_done','Client to-do completed',true],
  ['upload','Client upload',false],['organizer_submitted','Organizer submitted',false],
  ['payment_settled','Payment settled',false],['payment_failed','Payment failed',false],
  ['payment_refunded','Payment refunded',false],['payment_returned','Payment returned',false],
  ['due_soon','Work due soon',false],['overdue','Overdue work',false],['status_changed','Work status changed',false],
  ['delivery_failed','Delivery failed',false],['task_ready','Task ready',true],['partner_sign_off','Partner sign-off',true],
  ['coverage','Coverage changed',true],['internal_report','Scheduled report',true],['authorization_expiring','Authorization coverage ending',false],
].map(([id,label,legacyEmail])=>({id:String(id),label:String(label),legacyEmail:Boolean(legacyEmail)}));
const legacy = kinds.filter(k=>k.legacyEmail).map(k=>k.id);
export async function notificationDefaults(db:D1Database) {
  const row=await stmt(db,'SELECT settings FROM b_notification_defaults WHERE id=1').first<Data>();
  return row ? JSON.parse(row.settings) : {emailKinds:legacy,mandatoryKinds:[]};
}
export async function personalSettings(db:D1Database,email:string,firm?:Data) {
  const defaults=await notificationDefaults(db), row=await stmt(db,'SELECT settings FROM b_notification_settings WHERE email=?',email).first<Data>();
  return {timeZone:(firm??await firmSettings(db)).timeZone,quietStart:'00:00',quietEnd:'00:00',digestTime:'07:00',digestEnabled:false,leadDays:1,emailKinds:defaults.emailKinds.filter((k:string)=>legacy.includes(k)),...JSON.parse(row?.settings??'{}'),configured:!!row};
}
export async function notificationSettings(db:D1Database,actor:Actor) {
  return {personal:await personalSettings(db,actor.email),firm:await notificationDefaults(db),kinds,role:actor.role};
}
const clock=(value:unknown,label:string)=>{const v=text(value,label,5);insist(/^([01]\d|2[0-3]):[0-5]\d$/.test(v),`${label}: use HH:MM`);return v;};
const list=(value:unknown)=>{insist(Array.isArray(value)&&value.every(v=>kinds.some(k=>k.id===v)),'Choose known notification events');return [...new Set(value)];};
export async function saveNotificationSettings(db:D1Database,actor:Actor,body:Data) {
  human(actor);
  const timeZone=text(body.timeZone,'Time zone',100);
  try {new Intl.DateTimeFormat('en-US',{timeZone}).format();}catch{insist(false,'Use a valid IANA time zone');}
  const settings={timeZone,quietStart:clock(body.quietStart,'Quiet hours start'),quietEnd:clock(body.quietEnd,'Quiet hours end'),digestTime:clock(body.digestTime,'Digest time'),digestEnabled:body.digestEnabled===true,leadDays:integer(body.leadDays,'Due-soon lead days',0,365),emailKinds:list(body.emailKinds)};
  await atomic(db,actor,[stmt(db,'INSERT INTO b_notification_settings VALUES(?,?) ON CONFLICT(email) DO UPDATE SET settings=excluded.settings',actor.email,JSON.stringify(settings)),audit(db,actor,'notifications.settings',actor.email)]);
  return notificationSettings(db,actor);
}
export async function saveNotificationDefaults(db:D1Database,actor:Actor,body:Data) {
  human(actor);need(actor,'owner');
  const settings={emailKinds:list(body.emailKinds),mandatoryKinds:list(body.mandatoryKinds)};
  await atomic(db,actor,[stmt(db,'INSERT INTO b_notification_defaults VALUES(1,?) ON CONFLICT(id) DO UPDATE SET settings=excluded.settings',JSON.stringify(settings)),audit(db,actor,'notifications.defaults','firm')]);
  return notificationSettings(db,actor);
}
export async function markNotification(db:D1Database,actor:Actor,notificationId:string,body:Data) {
  human(actor);insist(typeof body.read==='boolean','Choose read or unread');
  const n=await stmt(db,`SELECT n.id FROM b_notifications n WHERE n.id=? AND n.to_email=? AND ${notificationAuthority}`,notificationId,actor.email).first();
  insist(n,'Notification not found',404);
  await atomic(db,actor,[stmt(db,'UPDATE b_notifications SET read_at=? WHERE id=? AND to_email=?',body.read?now():null,notificationId,actor.email),audit(db,actor,body.read?'notification.read':'notification.unread',notificationId)]);
  return {ok:true};
}
