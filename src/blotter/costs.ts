// COST-001. A reservation is made with the optional action in the same batch.
// Included quantities are lifetime-to-date under this price revision. Amounts
// are integer USD cents, payment percentages round up once per action.
import { atomic, audit, guard, human, id, insist, integer, now, rows, stmt, text, type Actor, type Data } from './model';
export const SERVICES: Record<string,string> = {
 subscription:'workspace month', seats:'seat month', storage:'GiB month', ai:'AI request',
 signatures:'signature envelope', kba:'identity check', email:'email', sms:'SMS segment',
 ach:'ACH payment', card:'card payment', agent_plan:'native agent plan',
};
const owner = (a:Actor) => { human(a); insist(a.role==='owner','Only the principal manages service costs',403); };
export async function costState(db:D1Database,a:Actor) {
 owner(a);
 const usage=await rows(db,'SELECT * FROM b_service_usage ORDER BY created_at DESC,action_id');
 const reserved=usage.filter(x=>x.status!=='blocked').reduce((s,x)=>s+x.estimated_cents,0);
 return {currency:'USD',services:SERVICES,prices:await rows(db,'SELECT * FROM b_service_prices ORDER BY service'),priceVersions:await rows(db,'SELECT * FROM b_service_price_versions ORDER BY updated_at,revision'),budget:await stmt(db,'SELECT * FROM b_service_budget WHERE id=1').first(),usage,reservedCents:reserved,
  notice:'Prices are firm-recorded estimates, not provider verification. Reservations include uncertain outcomes. Blocked actions remain owned exceptions; deadlines and evidence are unchanged. Increase the budget to retry the same action ID once, or export the usage history. Unbuilt providers cannot be enabled here.'};
}
export async function savePrice(db:D1Database,a:Actor,b:Data) {
 owner(a);const service=text(b.service,'Service');insist(Object.hasOwn(SERVICES,service),'Unknown service');
 const revision=id(),source=text(b.source,'Source of USD price and included quantities',1000);
 await atomic(db,a,[stmt(db,`INSERT INTO b_service_prices VALUES(?,?,?,?,?,?,?,?,?,0)
 ON CONFLICT(service) DO UPDATE SET revision=excluded.revision,unit=excluded.unit,included=excluded.included,unit_cents=excluded.unit_cents,basis_points=excluded.basis_points,source=excluded.source,updated_by=excluded.updated_by,updated_at=excluded.updated_at,enabled=0`,service,revision,SERVICES[service],integer(b.included,'Included quantity'),integer(b.unitCents,'USD cents per unit'),integer(b.basisPoints??0,'Basis points',0,10000),source,a.email,now()),stmt(db,'INSERT INTO b_service_price_versions SELECT revision,service,unit,included,unit_cents,basis_points,source,updated_by,updated_at FROM b_service_prices WHERE service=?',service),audit(db,a,'cost.price',service,source)]);
 return {service,revision};
}
export async function setService(db:D1Database,a:Actor,service:string,b:Data) {
 owner(a);insist(service==='agent_plan','This service needs its provider capability and activation evidence before it can be enabled',409);
 const p=await stmt(db,'SELECT * FROM b_service_prices WHERE service=?',service).first<Data>();
 insist(p && p.revision===b.revision,'Review the current sourced price before enabling',409);
 const reason=text(b.reason,'Approval reason',1000),[check,release]=guard(db,'EXISTS(SELECT 1 FROM b_service_prices WHERE service=? AND revision=?)',service,p.revision);
 await atomic(db,a,[check,stmt(db,'UPDATE b_service_prices SET enabled=? WHERE service=?',b.enabled===true?1:0,service),release,audit(db,a,'cost.enabled',service,reason)]);
 return {enabled:b.enabled===true};
}
export async function saveBudget(db:D1Database,a:Actor,b:Data) {
 owner(a);const reason=text(b.reason,'Budget approval reason',1000),revision=id();
 await atomic(db,a,[stmt(db,`INSERT INTO b_service_budget VALUES(1,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET revision=excluded.revision,limit_cents=excluded.limit_cents,threshold_cents=excluded.threshold_cents,reason=excluded.reason,updated_by=excluded.updated_by,updated_at=excluded.updated_at`,revision,integer(b.limitCents,'Lifetime budget in USD cents'),integer(b.thresholdCents,'Per-action approval threshold in USD cents'),reason,a.email,now()),audit(db,a,'cost.budget',revision,reason)]);
 return {revision};
}
function charge(p:Data,quantity:number,amount:number,used:number) {
 const included=Math.max(0,p.included-used),billable=Math.max(0,quantity-included);
 const cents=billable*p.unit_cents+Math.ceil(amount*p.basis_points/10000);
 insist(Number.isSafeInteger(cents),'This estimate exceeds the supported USD cents range');return cents;
}
export async function estimateCosts(db:D1Database,a:Actor,b:Data) {
 owner(a);insist(Array.isArray(b.items)&&b.items.length>0&&b.items.length<=30,'List 1 to 30 services');
 insist(new Set(b.items.map((item:Data)=>item.service)).size===b.items.length,'List each service once so included quantities are shared correctly');
 const prices=await rows(db,'SELECT * FROM b_service_prices'),items=b.items.map((item:Data)=>{
  const service=text(item.service,'Service'),p=prices.find(p=>p.service===service);insist(Object.hasOwn(SERVICES,service),'Unknown service');
  const quantity=integer(item.quantity,'Quantity'),amountCents=integer(item.amountCents??0,'Payment amount in USD cents');
  return {service,unit:SERVICES[service],quantity,amountCents,source:p?.source??'Price not supplied',included:p?.included??null,unitCents:p?.unit_cents??null,basisPoints:p?.basis_points??null,estimatedCents:p?charge(p,quantity,amountCents,0):null,enabled:!!p?.enabled,revision:p?.revision??null};
 });
 return {currency:'USD',items,totalCents:items.some((i:Data)=>i.estimatedCents===null)?null:items.reduce((s:number,i:Data)=>s+i.estimatedCents,0),note:'Estimate from the recorded price, before enabling. Included quantities are shared, not per action. No payment or provider activation occurs.'};
}
/** Prepare the statements that reserve an action's price with its product write. */
export async function costReservation(db:D1Database,a:Actor,actionId:string,service:string) {
 const old=await stmt(db,'SELECT * FROM b_service_usage WHERE action_id=?',actionId).first<Data>();
 if(old && old.status!=='blocked')return {already:true,cents:old.estimated_cents,statements:[]};
 const p=await stmt(db,'SELECT * FROM b_service_prices WHERE service=? AND enabled=1',service).first<Data>();
 insist(p,'The principal must review and enable this service price first',409);
 const budget=await stmt(db,'SELECT * FROM b_service_budget WHERE id=1').first<Data>();
 const used=await stmt(db,"SELECT COALESCE(SUM(quantity),0) quantity,COALESCE(SUM(estimated_cents),0) cents FROM b_service_usage WHERE status<>'blocked' AND service=? AND price_revision=?",service,p.revision).first<Data>();
 const cents=charge(p,1,0,used?.quantity??0),total=Number((await stmt(db,"SELECT COALESCE(SUM(estimated_cents),0) n FROM b_service_usage WHERE status<>'blocked'").first<Data>())?.n??0);
 const allowed=budget && total+cents<=budget.limit_cents && cents<=budget.threshold_cents;
 if(!allowed) {
  await atomic(db,a,[stmt(db,`INSERT INTO b_service_usage(action_id,service,price_revision,quantity,amount_cents,estimated_cents,status,outcome,owner_email,created_at) VALUES(?,?,?,1,0,?,'blocked','Budget or per-action threshold reached; principal review required',?,?) ON CONFLICT(action_id) DO NOTHING`,actionId,service,p.revision,cents,a.email,now()),stmt(db,"INSERT OR IGNORE INTO b_notifications(id,to_email,kind,summary,delivery,created_at) VALUES(?,?,'service_budget','An optional agent plan reached its service budget. Review Service costs; deadlines and evidence are unchanged.','in-app only',?)",'cost:'+actionId,a.email,now()),audit(db,a,'cost.blocked',actionId,'Principal owns the exception; no effect committed')]);
  return {blocked:true,cents,statements:[]};
 }
 const [check,release]=guard(db,`EXISTS(SELECT 1 FROM b_service_budget WHERE revision=? AND limit_cents >= ?+(SELECT COALESCE(SUM(estimated_cents),0) FROM b_service_usage WHERE status<>'blocked') AND threshold_cents>=?) AND EXISTS(SELECT 1 FROM b_service_prices WHERE service=? AND revision=? AND enabled=1) AND (SELECT COALESCE(SUM(quantity),0) FROM b_service_usage WHERE status<>'blocked' AND service=? AND price_revision=?)=?`,budget.revision,cents,cents,service,p.revision,service,p.revision,used?.quantity??0);
 return {cents,statements:[check,stmt(db,`INSERT INTO b_service_usage(action_id,service,price_revision,quantity,amount_cents,estimated_cents,status,outcome,owner_email,created_at) VALUES(?,?,?,1,0,?,'reserved','Native plan prepared; no provider charge claimed',?,?) ON CONFLICT(action_id) DO UPDATE SET price_revision=excluded.price_revision,estimated_cents=excluded.estimated_cents,status='reserved',outcome=excluded.outcome WHERE b_service_usage.status='blocked'`,actionId,service,p.revision,cents,a.email,now()),release]};
}
export async function reconcileCost(db:D1Database,a:Actor,actionId:string,b:Data) {
 owner(a);const receipt=text(b.receipt,'Provider receipt or native cost evidence',1000),cents=integer(b.cents,'Confirmed USD cents');
 const [check,release]=guard(db,"EXISTS(SELECT 1 FROM b_service_usage WHERE action_id=? AND status IN ('reserved','held'))",actionId);
 await atomic(db,a,[check,stmt(db,"UPDATE b_service_usage SET status='confirmed',confirmed_cents=?,receipt=?,confirmed_by=?,outcome='Cost reconciled by principal; no action replay' WHERE action_id=?",cents,receipt,a.email,actionId),release,audit(db,a,'cost.reconciled',actionId,receipt)]);
 return {actionId,confirmedCents:cents};
}

/** Same native fresh-proof gate as other exports; attribution commits before bytes leave. */
export async function exportCosts(db:D1Database,a:Actor) {
 const data=await costState(db,a);
 await atomic(db,a,[audit(db,a,'cost.exported','service-costs','USD quotes, reservations and reconciliation history')]);
 return new Response(JSON.stringify(data,null,2),{headers:{'content-type':'application/json','content-disposition':'attachment; filename="blotter-service-usage.json"','cache-control':'no-store'}});
}
