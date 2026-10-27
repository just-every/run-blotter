// Practitioner-recorded accounting observations compare with Blotter; they never post ledger entries.
import { atomic, audit, guard, id, insist, integer, now, rows, stmt, text, type Actor, type Data } from './model';
import { activeInvoiceClientSql, invoiceAuthority, invoiceAuthorityGuard, principalHuman } from './invoices-sources';

export async function recordRevenueAccounting(db:D1Database,actor:Actor,body:Data) {
  principalHuman(actor);
  const authority=await invoiceAuthority(db),invoiceId=text(body.invoiceId,'Native invoice',100);
  const invoice=await stmt(db,"SELECT * FROM b_invoices WHERE id=? AND status='issued' AND erased_at IS NULL",invoiceId).first<Data>();
  insist(invoice,'Select an issued native invoice',409);
  insist(body.currency==='USD','Accounting observations require USD');
  const source=text(body.source,'Firm accounting source',200),reference=text(body.reference,'Accounting event reference',200);
  const facts={grossCents:integer(body.grossCents,'Recorded gross cents'),receiptCents:integer(body.receiptCents,'Recorded net receipt cents',-1_000_000_000),creditCents:integer(body.creditCents,'Recorded applied credit cents'),writeoffCents:integer(body.writeoffCents,'Recorded write-off cents')};
  const reason=text(body.reason,'Observation source and reason',1000),payload=JSON.stringify(facts);
  const prior=await stmt(db,'SELECT * FROM b_revenue_accounting WHERE client_id=? AND source=? AND reference=?',invoice.client_id,source,reference).first<Data>();
  if(prior){insist(prior.invoice_id===invoiceId&&prior.facts===payload&&prior.reason===reason,'Accounting reference already records different evidence',409);return {id:prior.id,replayed:true};}
  const entry=id();
  await atomic(db,actor,[...invoiceAuthorityGuard(db,authority.revision),...guard(db,activeInvoiceClientSql,invoice.client_id),
    ...guard(db,"EXISTS(SELECT 1 FROM b_invoices WHERE id=? AND revision=? AND status='issued' AND erased_at IS NULL)",invoiceId,invoice.revision),
    stmt(db,'INSERT INTO b_revenue_accounting(id,client_id,invoice_id,source,reference,facts,reason,recorded_by,recorded_at) VALUES(?,?,?,?,?,?,?,?,?)',entry,invoice.client_id,invoiceId,source,reference,payload,reason,actor.email,now()),
    audit(db,actor,'revenue.accounting_recorded',invoice.client_id,JSON.stringify({entry,invoiceId,source,reference,reason}))]);
  return {id:entry,replayed:false};
}

export async function revenueAccounting(db:D1Database,clientId:string) {
  const observations=await rows(db,'SELECT * FROM b_revenue_accounting WHERE client_id=? ORDER BY recorded_at,rowid',clientId),latest=new Map<string,Data>();
  for(const o of observations)latest.set(JSON.stringify([o.source,o.invoice_id]),o);
  const comparisons:Data[]=[],exceptions:Data[]=[];
  for(const o of latest.values()) {
    const invoice=await stmt(db,`SELECT i.id,i.job_id,i.title,i.owner_email,i.due_date,i.subtotal_cents+i.tax_cents grossCents,
      COALESCE((SELECT sum(p.net_cents) FROM b_provider_payments p WHERE p.invoice_id=i.id),0) receiptCents,
      COALESCE((SELECT sum(u.amount_cents) FROM b_invoice_credit_uses u WHERE u.invoice_id=i.id),0) creditCents,
      COALESCE((SELECT sum(w.amount_cents) FROM b_invoice_writeoffs w WHERE w.invoice_id=i.id),0) writeoffCents
      FROM b_invoices i WHERE i.id=? AND i.status='issued' AND i.erased_at IS NULL`,o.invoice_id).first<Data>();
    if(!invoice)continue;
    const recorded=JSON.parse(o.facts),differences=Object.keys(recorded).filter(k=>recorded[k]!==invoice[k]);
    comparisons.push({observationId:o.id,invoiceId:invoice.id,recorded,native:{grossCents:invoice.grossCents,receiptCents:invoice.receiptCents,creditCents:invoice.creditCents,writeoffCents:invoice.writeoffCents},differences});
    if(differences.length)exceptions.push({id:`accounting:${o.id}`,kind:'accounting',jobId:invoice.job_id,summary:`Firm accounting mismatch: ${invoice.title}`,amountCents:recorded.receiptCents-invoice.receiptCents,currency:'USD',ownerEmail:invoice.owner_email,
      nextAction:`Review ${differences.join(', ')} against ${o.source} event ${o.reference}. Invoice due ${invoice.due_date}. No ledger or collection action is automatic.`,
      citations:[{label:`Practitioner-recorded ${o.source}: ${o.reference}`,href:`/api/blotter/revenue/accounting?clientId=${clientId}`},{label:`Native invoice: ${invoice.title}`,href:`/api/blotter/invoices/${invoice.id}`}],canPrepare:false,draftText:''});
  }
  return {observations,comparisons,exceptions};
}
export async function revenueAccountingState(db:D1Database,actor:Actor,query:Data) {
  principalHuman(actor);await invoiceAuthority(db);
  return revenueAccounting(db,text(query.clientId,'Client',100));
}
