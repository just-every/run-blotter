// Principal-invoked revenue assistance over native evidence; findings confer no execution authority.
import { signedSource } from './onboarding';
import { revenueWork } from './billing';
import { revenueCollections } from './invoices-collections';
import { invoiceAuthority, principalHuman } from './invoices-sources';
import { digest, insist, rows, stmt, text, type Actor, type Data } from './model';

// The same snapshot predicate is checked again in the decision batch.
export const revenueStampSql = `WITH target AS (SELECT ? id) SELECT json_array(
 (SELECT json_group_array(json_array(id,revision,status,fee_cents,budget_minutes)) FROM (SELECT j.* FROM b_jobs j,target WHERE j.client_id=target.id ORDER BY j.id)),
 (SELECT json_group_array(json_array(id,amount_cents,description,billable,status)) FROM (SELECT t.*,s.status FROM b_time t JOIN b_jobs j ON j.id=t.job_id LEFT JOIN b_time_status s ON s.entry_id=t.id,target WHERE j.client_id=target.id ORDER BY t.id)),
 (SELECT json_group_array(json_array(id,revision,status,collection_hold,collection_note)) FROM (SELECT i.* FROM b_invoices i,target WHERE i.client_id=target.id ORDER BY i.id)),
 (SELECT json_group_array(json_array(id,revision,state,net_cents)) FROM (SELECT p.* FROM b_provider_payments p,target WHERE p.client_id=target.id ORDER BY p.id)),
 (SELECT json_group_array(json_array(id,revision,status)) FROM (SELECT p.* FROM b_onboarding_plans p,target WHERE p.client_id=target.id ORDER BY p.id)),
 (SELECT json_group_array(json_array(id,revision,status)) FROM (SELECT r.* FROM b_invoice_retainers r,target WHERE r.client_id=target.id ORDER BY r.id)),
 (SELECT revision FROM b_invoice_settings WHERE id=1),
 (SELECT json_group_array(json_array(id,amount_cents,source_key)) FROM (SELECT e.* FROM b_invoice_entitlements e,target WHERE e.client_id=target.id ORDER BY e.id)),
 (SELECT json_group_array(json_array(id,amount_cents)) FROM (SELECT w.* FROM b_invoice_writeoffs w JOIN b_invoices i ON i.id=w.invoice_id,target WHERE i.client_id=target.id ORDER BY w.id)),
 (SELECT json_group_array(json_array(id,amount_cents)) FROM (SELECT c.* FROM b_invoice_credits c,target WHERE c.client_id=target.id ORDER BY c.id)),
 (SELECT json_group_array(json_array(id,invoice_id,amount_cents)) FROM (SELECT u.* FROM b_invoice_credit_uses u JOIN b_invoices i ON i.id=u.invoice_id,target WHERE i.client_id=target.id ORDER BY u.id)),
 (SELECT json_group_array(json_array(source_key,invoice_id)) FROM (SELECT s.* FROM b_invoice_sources s JOIN b_jobs j ON j.id=s.job_id,target WHERE j.client_id=target.id ORDER BY s.source_key)),
 (SELECT json_group_array(json_array(source_key,export_id)) FROM (SELECT s.* FROM b_export_sources s JOIN b_exports e ON e.id=s.export_id,json_each(e.snapshot,'$.lines') l,target WHERE json_extract(l.value,'$.source_key')=s.source_key AND json_extract(l.value,'$.job_id') IN (SELECT id FROM b_jobs WHERE client_id=target.id) ORDER BY s.source_key)),
 (SELECT json_group_array(json_array(id,charge_cents,status,billable)) FROM (SELECT e.* FROM b_expenses e,target WHERE e.client_id=target.id ORDER BY e.id)),
 (SELECT json_group_array(json_array(id,amount_cents)) FROM (SELECT a.* FROM b_time_adjustments a JOIN b_time t ON t.id=a.entry_id JOIN b_jobs j ON j.id=t.job_id,target WHERE j.client_id=target.id ORDER BY a.id)),
 (SELECT json_group_array(json_array(b_clients.id,revision,lifecycle,erased_at,merged_into)) FROM b_clients,target WHERE b_clients.id=target.id)
 )`;

export async function revenueOptions(db: D1Database, actor: Actor) {
  principalHuman(actor);
  return { clients: await rows(db, "SELECT id,name FROM b_clients WHERE lifecycle='active' AND erased_at IS NULL AND merged_into IS NULL ORDER BY name,id"),
    plans: await rows(db, "SELECT p.id,p.client_id,p.source_id,p.status,p.decided_at,CASE p.source_kind WHEN 'engagement' THEN (SELECT title FROM b_engagements e WHERE e.id=p.source_id) ELSE (SELECT title FROM b_signatures s WHERE s.id=p.source_id) END source_title FROM b_onboarding_plans p JOIN b_clients c ON c.id=p.client_id WHERE c.lifecycle='active' AND c.erased_at IS NULL AND c.merged_into IS NULL ORDER BY p.decided_at DESC,p.id") };
}

export async function revenueMap(db: D1Database, actor: Actor, clientId: string, planId: string) {
  principalHuman(actor);
  const authority = await invoiceAuthority(db);
  const client = await stmt(db, "SELECT id,name,revision FROM b_clients WHERE id=? AND lifecycle='active' AND erased_at IS NULL AND merged_into IS NULL", clientId).first<Data>();
  insist(client, 'Active client not found', 404);
  const record = await stmt(db, "SELECT * FROM b_onboarding_plans WHERE id=? AND client_id=? AND status='reviewed'", planId, clientId).first<Data>();
  insist(record, 'Select a current reviewed signed scope; restored reviews are held', 409);
  const plan = JSON.parse(record.plan), source = await signedSource(db, clientId, { source: { id: record.source_id, kind: record.source_kind } });
  insist(source.record.sha256 === plan.source.sha256, 'Signed scope changed; review it again', 409);
  const jobs = await rows(db, 'SELECT * FROM b_jobs WHERE client_id=? ORDER BY id', clientId), jobIds = new Set(jobs.map(j => j.id));
  const lines = await revenueWork(db, jobIds);
  const invoices = await rows(db, "SELECT id,job_id,title,status,number,snapshot,total_cents,subtotal_cents,tax_cents,revision,currency,owner_email FROM b_invoices WHERE client_id=? AND status<>'void' AND erased_at IS NULL ORDER BY CASE status WHEN 'issued' THEN 0 ELSE 1 END,prepared_at,id", clientId);
  const collections = await revenueCollections(db, clientId);
  const covered = new Set(plan.services.map((s: Data) => s.template.id)), exceptions: Data[] = [];
  for (const j of jobs) {
    const work = lines.filter(l => l.job_id === j.id), amountCents = work.reduce((n,l) => n + l.amount_cents, 0);
    const time = await rows(db, 'SELECT t.id,t.minutes,t.amount_cents,t.description,s.status FROM b_time t LEFT JOIN b_time_status s ON s.entry_id=t.id WHERE t.job_id=? ORDER BY t.id', j.id);
    const minutes = time.reduce((n,t) => n + t.minutes,0), outside = !covered.has(j.template_id);
    if (work.length && (outside || (j.budget_minutes > 0 && minutes > j.budget_minutes))) {
      const summary = outside ? `Unbilled work outside mapped scope: ${j.title}` : `Unbilled work exceeds the recorded budget: ${j.title}`;
      exceptions.push({ id: `amendment:${j.id}`, kind:'amendment', jobId:j.id, summary, amountCents, currency:j.currency, ownerEmail:actor.email,
        nextAction:'Review scope and the draft with the client before any additional fee is authorized',
        citations:[{label:plan.source.label,href:source.href}, {label:j.title,href:`/app?job=${j.id}`}, ...work.map(l=>({label:`${l.source_key}: ${l.description} (${l.amount_cents} ${l.currency} cents)`,href:`/app?job=${j.id}`}))],
        draftText:`Proposed scope amendment for ${j.title} (${j.period_label}). ${outside ? 'This work template is absent from the selected principal-declared signed-scope mapping; the finding requires human interpretation.' : `${minutes} recorded minutes exceed the ${j.budget_minutes} minute budget.`} Review the unbilled ${j.currency} ${(amountCents/100).toFixed(2)} and agree the additional scope and fee. This draft does not change the signed agreement or authorize an invoice or charge.`, canPrepare:true });
    }
  }
  const groups = new Map<string, Data[]>();
  for (const i of invoices) {
    const key = JSON.stringify([i.job_id,i.title.trim().toLowerCase(),i.currency,i.subtotal_cents,i.tax_cents]);
    groups.set(key,[...(groups.get(key)??[]),i]);
  }
  for (const group of groups.values()) for (const duplicate of group.slice(1)) {
    const original=group[0];
    exceptions.push({ id:`duplicate:${duplicate.id}`,kind:'duplicate',jobId:duplicate.job_id,summary:`Suspected duplicate invoice: ${duplicate.title}`,amountCents:duplicate.total_cents,currency:duplicate.currency,ownerEmail:duplicate.owner_email,
      invoiceId:duplicate.id,invoiceRevision:duplicate.revision,originalId:original.id,originalRevision:original.revision,
      nextAction:duplicate.status==='draft'?'Review both invoices and void the duplicate draft if confirmed':'Review issued invoices; any credit requires its separate explicit financial approval',
      citations:[original,duplicate].map(i=>({label:`${i.status==='issued'?`Invoice ${i.number}`:'Draft'}: ${i.title} (${i.total_cents} ${i.currency} cents)`,href:`/api/blotter/invoices/${i.id}`})),
      draftText:`Suspected duplicate of ${original.id}: same work item, title, currency and gross amount. Distinct source entitlements do not establish distinct work. Principal review must confirm duplication.${duplicate.status==='draft'?' Approving this correction voids only the identified draft and retains its billing-source reservations to prevent rebilling.':' No issued invoice is changed by this finding.'}`,canPrepare:duplicate.status==='draft' });
  }
  exceptions.push(...collections.exceptions);
  const retainers=await rows(db,'SELECT id,title,status,start_month,definition,revision FROM b_invoice_retainers WHERE client_id=? ORDER BY id',clientId);
  const amendments=await rows(db,'SELECT a.id,a.retainer_id,a.effective_month,a.before_snapshot,a.after_snapshot,a.reason FROM b_invoice_amendments a JOIN b_invoice_retainers r ON r.id=a.retainer_id WHERE r.client_id=? ORDER BY a.id',clientId);
  const stamp=(await stmt(db,revenueStampSql,clientId).first<Data>())!;
  const stampValue=String(Object.values(stamp)[0]);
  const evidence={clientId,planId,scope:{source:plan.source,services:plan.services},exceptions,lines,retainers,amendments,collections,stamp:stampValue,authorityRevision:authority.revision};
  const fingerprint=await digest(JSON.stringify(evidence));
  return {...evidence,fingerprint,totals:{unbilledCents:lines.filter(l=>l.currency==='USD').reduce((n,l)=>n+l.amount_cents,0),...collections.totals},
    proposals:(await rows(db,'SELECT * FROM b_revenue_proposals WHERE client_id=? ORDER BY created_at,id',clientId)).map(p=>({...p,payload:JSON.parse(p.payload)}))};
}
export async function revenueState(db: D1Database,actor:Actor,query:Data) {
  const options=await revenueOptions(db,actor);
  if (!query.clientId && !query.planId) return options;
  return {...options,map:await revenueMap(db,actor,text(query.clientId,'Client',100),text(query.planId,'Reviewed scope',100))};
}
