// Thin completion notices under the principal's explicit standing grant.
// Every outbound attempt is claimed durably; uncertain outcomes never retry automatically.
import { suspendIntegrationKey } from './integration-keys';
import { runtimeBindings, type Bindings } from '../auth.server';
import { seal, unseal } from './mfa';
import { accessActor, freshAccess } from './permissions';
import { liveIntegrationSql } from './integration-policy';
import { atomic, audit, guard, human, id, insist, need, now, rows, secret, stmt, text, type Actor, type Data } from './model';

const fields='id,key_id,label,status,created_by,created_at';
const action='webhooks:completion';
function destination(value:unknown) {
 const raw=text(value,'HTTPS destination',2000);let url:URL;
 try{url=new URL(raw);}catch{insist(false,'Supply a valid HTTPS destination');}
 insist(url.protocol==='https:' && !url.username && !url.password && !url.hash && (!url.port||url.port==='443'),'Use a public HTTPS destination on port 443 without credentials or a fragment');
 const host=url.hostname.toLowerCase();
 insist(/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(host)&&host.includes('.')&&!/^[\d.]+$/.test(host)&&!/(^|\.)(localhost|local|internal|test|invalid|example)$/.test(host),'Use a public DNS hostname');
 return url.href;
}
async function principal(db:D1Database,actor:Actor) {human(actor);need(actor,'owner');await freshAccess(db,actor);}
export async function integrationWebhooks(db:D1Database,actor:Actor) {
 human(actor);need(actor,'owner');
 return {hooks:await rows(db,`SELECT ${fields} FROM b_integration_hooks ORDER BY created_at,id`),deliveries:await rows(db,'SELECT * FROM b_integration_deliveries ORDER BY attempted_at DESC,id LIMIT 200')};
}
export async function registerWebhook(env:Bindings,actor:Actor,body:Data) {
 env=runtimeBindings(env);const db=env.DB;await principal(db,actor);
 insist(env.VAULT_KEY,'Configure the dedicated vault key before registering a webhook',409);
 const keyId=text(body.keyId,'Integration key',100),label=text(body.label,'Webhook label',100),url=destination(body.url);
 const reason=text(body.reason,'Reason',1000),hookId=id(),signingSecret=secret('blotter_webhook_');
 const [check,done]=guard(db,`${liveIntegrationSql} AND EXISTS(SELECT 1 FROM b_integration_keys k,json_each(k.actions) a WHERE k.id=? AND a.value=?)`,keyId,keyId,action);
 await atomic(db,actor,[check,stmt(db,"INSERT INTO b_integration_hooks(id,key_id,label,destination_sealed,secret_sealed,status,created_by,created_at,start_row) VALUES(?,?,?,?,?,'active',?,?,(SELECT COALESCE(max(rowid),0) FROM b_job_status_history))",hookId,keyId,label,await seal(env.VAULT_KEY,url),await seal(env.VAULT_KEY,signingSecret),actor.email,now()),audit(db,actor,'integration.webhook_registered',hookId,JSON.stringify({keyId,label,reason})),done]);
 return {id:hookId,keyId,label,signingSecret};
}
export async function revokeWebhook(db:D1Database,actor:Actor,hookId:string,body:Data) {
 await principal(db,actor);const reason=text(body.reason,'Reason',1000);
 insist(await stmt(db,'SELECT 1 FROM b_integration_hooks WHERE id=?',hookId).first(),'Webhook not found',404);
 await atomic(db,actor,[stmt(db,"UPDATE b_integration_hooks SET status='revoked',destination_sealed=NULL,secret_sealed=NULL WHERE id=?",hookId),stmt(db,"UPDATE b_integration_deliveries SET status='revoked',outcome='Webhook revoked',next_action='Register a new reviewed webhook' WHERE hook_id=? AND status='pending'",hookId),audit(db,actor,'integration.webhook_revoked',hookId,reason)]);
 return {id:hookId,status:'revoked'};
}
export async function reconcileWebhook(db:D1Database,actor:Actor,deliveryId:string,body:Data) {
 await principal(db,actor);const reason=text(body.reason,'Provider reconciliation evidence',1000);
 insist(['accepted','not_accepted'].includes(body.outcome),'Record confirmed acceptance or nonacceptance');
 const [check,done]=guard(db,"EXISTS(SELECT 1 FROM b_integration_deliveries WHERE id=? AND status IN ('held','dispatching'))",deliveryId);
 await atomic(db,actor,[check,stmt(db,'UPDATE b_integration_deliveries SET status=?,outcome=?,next_action=?,finished_at=? WHERE id=?',body.outcome==='accepted'?'delivered':'failed','Principal confirmed '+body.outcome,body.outcome==='accepted'?'Complete':'Review before explicit replay',now(),deliveryId),audit(db,actor,'integration.webhook_reconciled',deliveryId,reason),done]);
 return {id:deliveryId};
}
export async function replayWebhook(db:D1Database,actor:Actor,deliveryId:string,body:Data) {
 await principal(db,actor);const reason=text(body.reason,'Replay reason',1000);
 const [check,done]=guard(db,"EXISTS(SELECT 1 FROM b_integration_deliveries WHERE id=? AND status='failed')",deliveryId);
 await atomic(db,actor,[check,stmt(db,"UPDATE b_integration_deliveries SET status='pending',outcome='Explicit replay approved',next_action='Evaluate deliveries' WHERE id=?",deliveryId),audit(db,actor,'integration.webhook_replay_approved',deliveryId,reason),done]);
 return {id:deliveryId,status:'pending'};
}
async function signature(key:string,message:string) {
 const cryptoKey=await crypto.subtle.importKey('raw',new TextEncoder().encode(key),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 return [...new Uint8Array(await crypto.subtle.sign('HMAC',cryptoKey,new TextEncoder().encode(message)))].map(b=>b.toString(16).padStart(2,'0')).join('');
}
export async function runIntegrationWebhooks(original:Bindings) {
 const env=runtimeBindings(original),db=env.DB;
 if(!env.VAULT_KEY)return {attempted:0};
 let attempted=0;
 for(const hook of await rows(db,"SELECT h.*,k.creator_id,k.creator_email,o.display_name FROM b_integration_hooks h JOIN b_integration_keys k ON k.id=h.key_id JOIN oa_operators o ON o.id=k.creator_id WHERE h.status='active' AND h.destination_sealed IS NOT NULL AND h.secret_sealed IS NOT NULL ORDER BY h.id LIMIT 100")) {
  if(!await stmt(db,`SELECT 1 WHERE ${liveIntegrationSql}`,hook.key_id).first()){await suspendIntegrationKey(db,hook.key_id);continue;}
  const actor=await accessActor(db,{id:hook.creator_id,email:hook.creator_email,name:hook.display_name,role:'owner',channel:'integration',integration:{keyId:hook.key_id,action}});
  const [active,released]=guard(db,"EXISTS(SELECT 1 FROM b_integration_hooks WHERE id=? AND status='active')",hook.id);
  try {await atomic(db,actor,[active,stmt(db,`INSERT OR IGNORE INTO b_integration_deliveries(id,hook_id,event_id,client_id,job_id,status)
   SELECT lower(hex(randomblob(16))),?,s.id,j.client_id,j.id,'pending' FROM b_job_status_history s JOIN b_jobs j ON j.id=s.job_id JOIN b_clients c ON c.id=j.client_id
   WHERE s.rowid>? AND s.to_stage='completed' AND c.erased_at IS NULL AND c.merged_into IS NULL
   AND EXISTS(SELECT 1 FROM b_integration_clients scope WHERE scope.key_id=? AND scope.client_id=j.client_id)`,hook.id,hook.start_row,hook.key_id),released]);}
  catch(e){if(e instanceof Error&&/no longer allowed/.test(e.message))continue;throw e;}
  for(const delivery of await rows(db,"SELECT d.*,s.at event_at FROM b_integration_deliveries d JOIN b_job_status_history s ON s.id=d.event_id WHERE d.hook_id=? AND d.status='pending' ORDER BY s.rowid LIMIT 50",hook.id)) {
   const [claim,done]=guard(db,`EXISTS(SELECT 1 FROM b_integration_deliveries d JOIN b_integration_hooks h ON h.id=d.hook_id JOIN b_clients c ON c.id=d.client_id WHERE d.id=? AND d.status='pending' AND h.status='active' AND c.erased_at IS NULL AND c.merged_into IS NULL
    AND EXISTS(SELECT 1 FROM b_integration_clients scope WHERE scope.key_id=h.key_id AND scope.client_id=d.client_id))`,delivery.id);
   try {await atomic(db,actor,[claim,stmt(db,"UPDATE b_integration_deliveries SET status='dispatching',attempts=attempts+1,attempted_at=?,next_action='If interrupted, reconcile provider outcome; never retry blindly' WHERE id=?",now(),delivery.id),audit(db,actor,'integration.webhook_attempted',delivery.id,JSON.stringify({hookId:hook.id,clientId:delivery.client_id})),done]);}
   catch(e){if(e instanceof Error&&/no longer allowed/.test(e.message))continue;throw e;}
   attempted++;
   let status='held',outcome='Uncertain provider outcome',nextAction='Reconcile with provider before any replay';
   try {
    const url=destination(await unseal(env.VAULT_KEY,hook.destination_sealed));
    const key=await unseal(env.VAULT_KEY,hook.secret_sealed);
    const payload=JSON.stringify({version:1,id:delivery.event_id,type:'work.completed',clientId:delivery.client_id,workId:delivery.job_id,occurredAt:delivery.event_at});
    const timestamp=String(Math.floor(Date.now()/1000));
    // Last live grant check before the network boundary. Never follow a redirect.
    const permitted=await stmt(db,`SELECT 1 WHERE ${liveIntegrationSql} AND EXISTS(SELECT 1 FROM b_integration_hooks h JOIN b_integration_clients scope ON scope.key_id=h.key_id WHERE h.id=? AND h.status='active' AND scope.client_id=?)`,hook.key_id,hook.id,delivery.client_id).first();
    if(!permitted){status='revoked';outcome='Authority revoked before dispatch';nextAction='Review current grants';}
    else {
     const response=await fetch(url,{method:'POST',redirect:'manual',signal:AbortSignal.timeout(10000),headers:{'content-type':['application','json'].join('/'),'blotter-event-id':delivery.event_id,'blotter-signature':`t=${timestamp},v1=${await signature(key,timestamp+'.'+payload)}`},body:payload});
     if(response.ok){status='delivered';outcome='Receiver accepted HTTP '+response.status;nextAction='Complete';}
     else {status='held';outcome='Receiver returned HTTP '+response.status;nextAction='Inspect receiver history and confirm nonacceptance before explicit replay';}
     await response.body?.cancel();
    }
   }catch{/* No response body or network exception is retained: it may contain secrets. */}
   await db.batch([stmt(db,"UPDATE b_integration_deliveries SET status=?,outcome=?,next_action=?,finished_at=? WHERE id=? AND status='dispatching'",status,outcome,nextAction,now(),delivery.id),audit(db,actor,'integration.webhook_outcome',delivery.id,outcome)]);
  }
 }
 return {attempted};
}
