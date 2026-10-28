// This explicit allowlist never forwards integration bearers to person-only doors.
import { integrationMetadata } from './integration-metadata';
import { createClientOnce } from './client-writes';
import { integrationActor } from './integration-keys';
import { integrationScopeSql } from './integration-policy';
import { workPage, timePage, clientPage } from './read-pages';
import { stepInsert } from './tasks';
import { atomic, audit, digest, Fault, guard, insist, now, rows, stmt, text, type Actor, type Data } from './model';

function canonical(v:any):string {
 if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';
 if(v!==null && typeof v==='object')return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';
 return JSON.stringify(v);
}
async function createTask(db:D1Database,actor:Actor,body:Data,request:Request) {
 const key=request.headers.get('idempotency-key');
 insist(key && /^[A-Za-z0-9._:-]{1,128}$/.test(key),'Supply an Idempotency-Key of 1–128 letters, digits, dots, underscores, colons or hyphens');
 const jobId=text(body.jobId,'Job',100),label=text(body.label,'Task label',200);
 insist(Object.keys(body).every(k=>['jobId','label'].includes(k)),'Task creation accepts only jobId and label');
 const j=await stmt(db,`SELECT j.* FROM b_jobs j JOIN b_clients c ON c.id=j.client_id WHERE j.id=? AND j.status='open' AND c.lifecycle='active' AND c.erased_at IS NULL AND c.merged_into IS NULL AND ${integrationScopeSql(actor,'j.client_id')}`,jobId).first<Data>();
 insist(j,'Open job not found in the integration client scope',404);
 const kh=await digest(key),ph=await digest(canonical(body)),keyId=actor.integration!.keyId;
 const saved=()=>stmt(db,'SELECT payload_digest,job_id,ordinal FROM b_integration_writes WHERE key_id=? AND key_digest=?',keyId,kh).first<Data>();
 const replay=async(r:Data)=>{
  insist(r.payload_digest===ph,'Idempotency-Key was already used with a different request',409);
  const [check,done]=guard(db,`EXISTS(SELECT 1 FROM b_jobs j JOIN b_clients c ON c.id=j.client_id WHERE j.id=? AND j.status='open' AND c.lifecycle='active' AND c.erased_at IS NULL AND c.merged_into IS NULL AND ${integrationScopeSql(actor,'j.client_id')})`,jobId);
  await atomic(db,actor,[check,done]);
  return {jobId:r.job_id,ordinal:r.ordinal,replayed:true};
 };
 const previous=await saved();if(previous)return replay(previous);
 const count=Number((await stmt(db,'SELECT COALESCE(max(ordinal),0) n FROM b_job_steps WHERE job_id=?',jobId).first<Data>())!.n);
 insist(count<100,'This job already has 100 tasks',409);
 const [check,done]=guard(db,`EXISTS(SELECT 1 FROM b_jobs j JOIN b_clients c ON c.id=j.client_id WHERE j.id=? AND j.revision=? AND j.status='open' AND c.lifecycle='active' AND c.erased_at IS NULL AND c.merged_into IS NULL AND ${integrationScopeSql(actor,'j.client_id')}) AND (SELECT COALESCE(max(ordinal),0) FROM b_job_steps WHERE job_id=?)=?`,jobId,j.revision,jobId,count);
 try {await atomic(db,actor,[check,stepInsert(db,jobId,label,count),stmt(db,"UPDATE b_jobs SET revision=? WHERE id=?",crypto.randomUUID(),jobId),
  stmt(db,'INSERT INTO b_integration_writes(key_id,key_digest,payload_digest,client_id,job_id,ordinal,at) VALUES(?,?,?,?,?,?,?)',keyId,kh,ph,j.client_id,jobId,count+1,now()),
  audit(db,actor,'integration.task_created',jobId,JSON.stringify({keyId,clientId:j.client_id,ordinal:count+1})),done]);}
 catch(e){if(e instanceof Fault && e.status===409){const winner=await saved();if(winner)return replay(winner);}throw e;}
 return {jobId,ordinal:count+1,replayed:false};
}
export async function integrationRequest(db:D1Database,request:Request) {
 const url=new URL(request.url),route=url.pathname.replace('/api/blotter/v1/','');
 const actions:Record<string,string>=request.method==='GET'?{'clients':'clients:read','work':'work:read','time':'time:read','documents':'documents:metadata',['billing'+'/'+'invoices']:'billing:metadata'}:request.method==='POST'?{'tasks':'tasks:create','clients':'clients:create'}:{};
 const action=Object.hasOwn(actions,route)?actions[route]:undefined;
 const actor=await integrationActor(db,request,action??'unavailable');
 insist(action,'This door is unavailable to integration keys',403);
 if(action==='tasks:create'||action==='clients:create') {
  const raw=await request.text();insist(raw.length<=5000,'Request too large',413);
  const body=JSON.parse(raw);insist(body&&typeof body==='object'&&!Array.isArray(body),'Supply a JSON object');
  return action==='tasks:create'?createTask(db,actor,body,request):createClientOnce(db,actor,body,request.headers.get('idempotency-key')??undefined);
 }
 const clients=await rows(db,'SELECT client_id FROM b_integration_clients WHERE key_id=? ORDER BY client_id',actor.integration!.keyId);
 const query=Object.fromEntries(url.searchParams);
 const result=action.endsWith(':metadata')?await integrationMetadata(db,actor,route,query):route==='clients'?await clientPage(db,actor,query):route==='work'?await workPage(db,actor,query):await timePage(db,actor,query);
 const [scope,same]=guard(db,"(SELECT json_group_array(client_id) FROM (SELECT client_id FROM b_integration_clients WHERE key_id=? ORDER BY client_id))=?",actor.integration!.keyId,JSON.stringify(clients.map(c=>c.client_id))); 
 // Recheck authority after preparing the response and record possible outside copies.
 await atomic(db,actor,[scope,same,audit(db,actor,'integration.read',actor.integration!.keyId,JSON.stringify({route,clientIds:clients.map(c=>c.client_id)}))]);
 return result;
}
