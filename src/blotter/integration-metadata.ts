// Metadata-only resource pages; no document bytes, invoice snapshots or payment authority.
import { integrationScopeSql } from './integration-policy';
import { insist, integer, optional, rows, type Actor, type Data } from './model';
const encode=(v:unknown)=>btoa(JSON.stringify(v));
export async function integrationMetadata(db:D1Database,actor:Actor,route:string,query:Data) {
 const limit=query.limit===undefined?50:integer(query.limit,'Limit',1,100);
 const filters={client:optional(query.client,'Client',100),job:optional(query.job,'Job',100)};
 let after='';
 if(query.cursor!==undefined){
  insist(typeof query.cursor==='string'&&query.cursor.length>0&&query.cursor.length<=4096,'Invalid metadata cursor');
  let c:Data={};try{c=JSON.parse(atob(query.cursor));}catch{insist(false,'Invalid metadata cursor');}
  insist(c&&c.keyId===actor.integration!.keyId&&c.route===route&&JSON.stringify(c.filters)===JSON.stringify(filters)&&typeof c.after==='string'&&c.after.length<=300&&encode(c)===query.cursor,'Invalid metadata cursor');
  after=c.after;
 }
 const documents=route==='documents',alias=documents?'f':'i',column=documents?'file_key':'id';
 const source=documents?'b_document_sources f':'b_invoices i';
 const projection=documents?'f.file_key id,f.kind,f.document_id,f.job_id,f.client_id,f.name,f.mime,f.size,f.sha256':'i.id,i.client_id,i.job_id,i.status,i.number,i.currency,i.subtotal_cents,i.tax_cents,i.credit_cents,i.total_cents,i.issue_date,i.due_date,i.pdf_sha256';
 const where=[integrationScopeSql(actor,alias+'.client_id'),`${alias}.${column}>?`],params:unknown[]=[after];
 if(!documents)where.push('i.erased_at IS NULL');
 if(filters.client){where.push(`${alias}.client_id=?`);params.push(filters.client);}
 if(filters.job){where.push(`${alias}.job_id=?`);params.push(filters.job);}
 const result=await rows(db,`SELECT ${projection} FROM ${source} JOIN b_clients c ON c.id=${alias}.client_id WHERE c.erased_at IS NULL AND c.merged_into IS NULL AND ${where.join(' AND ')} ORDER BY ${alias}.${column} LIMIT ?`,...params,limit+1);
 const items=result.slice(0,limit);
 return {items,nextCursor:result.length>limit?encode({keyId:actor.integration!.keyId,route,filters,after:items[items.length-1].id}):null};
}
