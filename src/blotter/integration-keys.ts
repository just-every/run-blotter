// Principal-reviewed non-person keys; no native session or agent authority is accepted.
import { accessActor, freshAccess } from './permissions';
import { liveIntegrationSql } from './integration-policy';
import { atomic, audit, digest, Fault, guard, human, id, insist, need, now, rows, secret, stmt, text, type Actor, type Data } from './model';

export const INTEGRATION_ACTIONS = ['clients:read','clients:create','work:read','time:read','tasks:create','documents:metadata','billing:metadata','webhooks:completion'] as const;
const fields = 'id,label,creator_email,status,actions,reason,created_at,revoked_at';
export async function integrationKeys(db:D1Database,actor:Actor) {
 human(actor);need(actor,'owner');
 return {keys:await rows(db,`SELECT ${fields} FROM b_integration_keys ORDER BY created_at,id`),clients:await rows(db,'SELECT * FROM b_integration_clients ORDER BY key_id,client_id')};
}
export async function mintIntegrationKey(db:D1Database,actor:Actor,body:Data) {
 human(actor);need(actor,'owner');await freshAccess(db,actor);
 insist(await stmt(db,'SELECT 1 FROM b_mfa_factors WHERE email=? AND confirmed_at IS NOT NULL',actor.email).first(),'Enroll a second factor before minting an integration key',403);
 const label=text(body.label,'Key label',100),reason=text(body.reason,'Reason',1000);
 insist(Array.isArray(body.actions) && body.actions.length>0 && body.actions.length<=INTEGRATION_ACTIONS.length,'Choose explicit actions');
 const actions=[...new Set(body.actions.map((value:unknown)=>text(value,'Action',50)))];
 insist(actions.every(a=>INTEGRATION_ACTIONS.includes(a as never)),'Unknown integration action');
 insist(Array.isArray(body.clientIds) && body.clientIds.length>0 && body.clientIds.length<=100,'Choose between 1 and 100 clients');
 const clients=[...new Set(body.clientIds.map((value:unknown)=>text(value,'Client',100)))];
 const keyId=id(),key=secret('blotter_integration_'),at=now();
 const [factor,done]=guard(db,`EXISTS(SELECT 1 FROM b_mfa_factors WHERE email=? AND confirmed_at IS NOT NULL)
 AND EXISTS(SELECT 1 FROM b_access_stepups WHERE session_id=? AND email=? AND verified_at>?)`,actor.email,actor.sessionId,actor.email,new Date(Date.now()-300000).toISOString());
 const checks=clients.flatMap(client=>guard(db,'EXISTS(SELECT 1 FROM b_clients WHERE id=? AND merged_into IS NULL AND erased_at IS NULL)',client));
 await atomic(db,actor,[factor,...checks,stmt(db,"INSERT INTO b_integration_keys(id,label,creator_id,creator_email,digest,status,actions,reason,created_at) VALUES(?,?,?,?,?,'active',?,?,?)",keyId,label,actor.id,actor.email,await digest(key),JSON.stringify(actions),reason,at),
 ...clients.map(client=>stmt(db,'INSERT INTO b_integration_clients(key_id,client_id) VALUES(?,?)',keyId,client)),audit(db,actor,'integration.key_created',keyId,JSON.stringify({label,actions,clientIds:clients,reason})),done]);
 return {id:keyId,key,label,actions,clientIds:clients};
}
export async function revokeIntegrationKey(db:D1Database,actor:Actor,keyId:string,body:Data) {
 human(actor);need(actor,'owner');await freshAccess(db,actor);
 const reason=text(body.reason,'Reason',1000);
 insist(await stmt(db,'SELECT 1 FROM b_integration_keys WHERE id=?',keyId).first(),'Key not found',404);
 await atomic(db,actor,[stmt(db,"UPDATE b_integration_keys SET status='revoked',revoked_at=COALESCE(revoked_at,?) WHERE id=?",now(),keyId),stmt(db,"UPDATE b_integration_deliveries SET status='revoked',outcome='Integration key revoked',next_action='Never replay under this key' WHERE status='pending' AND hook_id IN (SELECT id FROM b_integration_hooks WHERE key_id=?)",keyId),audit(db,actor,'integration.key_revoked',keyId,reason)]);
 return {id:keyId,status:'revoked'};
}
export async function suspendIntegrationKey(db:D1Database,keyId:string) {
 await db.batch([stmt(db,"INSERT INTO b_audit(id,actor,action,object_id,detail,at) SELECT ?,creator_email,'integration.key_suspended',id,'Observed creator authority, identity, second-factor or client-scope loss; fresh review required',? FROM b_integration_keys WHERE id=? AND status='active'",id(),now(),keyId),stmt(db,"UPDATE b_integration_keys SET status='suspended' WHERE id=? AND status='active'",keyId)]);
}
export async function integrationActor(db:D1Database,request:Request,action:string):Promise<Actor> {
 const raw=request.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1];
 insist(raw,'An integration key is required',401);
 const key=await stmt(db,`SELECT k.*,o.email,o.display_name FROM b_integration_keys k JOIN oa_operators o ON o.id=k.creator_id WHERE k.digest=?`,await digest(raw)).first<Data>();
 insist(key && key.status==='active','Invalid, revoked or suspended integration key',401);
 if (!await stmt(db,`SELECT 1 WHERE ${liveIntegrationSql}`,key.id).first()) {
  await suspendIntegrationKey(db,key.id);
  throw new Fault('Integration suspended: creator authority, second factor or client scope was removed; mint a new reviewed key',403);
 }
 insist(JSON.parse(key.actions).includes(action),'This integration key does not grant this action',403);
 // Sliding window, atomically bounded across simultaneous requests and restarts.
 const at=Date.now(),[check,release]=guard(db,'(SELECT count(*) FROM b_integration_limits WHERE key_id=? AND at>?)<60',key.id,at-60000);
 try {await db.batch([stmt(db,'DELETE FROM b_integration_limits WHERE key_id=? AND at<=?',key.id,at-60000),check,stmt(db,'INSERT INTO b_integration_limits(id,key_id,at) VALUES(?,?,?)',id(),key.id,at),release]);}
 catch(e) {if(/constraint|b_guard/i.test(String(e)))throw new Fault('Integration rate limit: 60 requests per rolling 60 seconds; retry after 60 seconds',429,{retryAfter:60});throw e;}
 return accessActor(db,{id:key.creator_id,email:key.email,name:key.display_name,role:'owner',channel:'integration',integration:{keyId:key.id,action},label:key.label});
}
