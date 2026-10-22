// Runs the built Worker (dist/) in Miniflare with real D1 and migrations.
// The only fake is the paid mail-provider boundary.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp,readFile,readdir,realpath,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createServer} from 'node:net';
import {randomBytes} from 'node:crypto';
const require=createRequire(await realpath('node_modules/wrangler/package.json'));
const {Miniflare,convertV4MiniflareOptions}=require('miniflare');
const {unstable_splitSqlQuery:splitSql}=require('wrangler');
// `bindings` adds Worker bindings; with RER_DEMO the owner keeps the bootstrap session (demo mail sends nothing).
export async function harness({bindings={},mailResponse}={}){
 const socket=createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const port=socket.address().port;await new Promise(r=>socket.close(r));
 const directory=await mkdtemp(join(tmpdir(),'blotter-http-')),origin=`https://127.0.0.1:${port}`,mails=[];
 const config=JSON.parse(await readFile('dist/server/wrangler.json','utf8'));
 const vars={AUTH_LOCAL:'false',AUTH_ORIGIN:origin,OWNER_EMAIL:'owner@example.test',SESSION_SECRET:randomBytes(32).toString('hex'),VAULT_KEY:randomBytes(32).toString('hex'),SETUP_TOKEN:randomBytes(32).toString('hex'),MAIL_PROVIDER:'resend',MAIL_FROM:'auth@example.test',MAIL_API_KEY:'test-only-provider-key',...bindings};
 const options={...convertV4MiniflareOptions({
  host:'127.0.0.1',port,https:true,modulesRoot:resolve('dist/server'),modules:[config.main,...(await readdir('dist/server/assets')).filter(f=>f.endsWith('.js')).map(f=>'assets/'+f)].map(f=>({type:'ESModule',path:resolve('dist/server',f)})),
  compatibilityDate:config.compatibility_date,compatibilityFlags:config.compatibility_flags,
  assets:{directory:resolve('dist/client'),routerConfig:{has_user_worker:true}},d1Databases:{DB:'blotter-test'},bindings:vars,
  // The only fake is the paid mail-provider boundary; the built app is unchanged.
  outboundService:async request=>{if(request.url==='https://challenges.cloudflare.com/turnstile/v0/siteverify'){const data=await request.formData();return Response.json({success:data.get('response')==='test-accepted-challenge'});}assert.equal(request.url,'https://api.resend.com/emails');mails.push(await request.json());return mailResponse ? mailResponse(mails.at(-1),mails,request) : Response.json({id:'test-mail-'+mails.length});},
 }),resourcePersistencePath:join(directory,'state')};
 let mf=new Miniflare(options);
 const send=async(path,body,cookie='',extra={})=>{
  const multipart=body instanceof FormData ? new Request(origin+path,{method:'POST',body}) : null;
  return mf.dispatchFetch(origin+path,{redirect:'manual',method:body===undefined?'GET':'POST',headers:{origin,host:new URL(origin).host,'CF-Connecting-IP':'192.0.2.1',...(multipart?{'content-type':multipart.headers.get('content-type')}:body===undefined?{}:{'content-type':'application/json'}),...(cookie?{cookie}:{}),...extra},...(body===undefined?{}:{body:multipart?await multipart.arrayBuffer():JSON.stringify(body)})});
 };

 // Sensitive administration and exports need a fresh step-up from installation (ACCESS-002). Tests that are not about the factor
 // record that confirmation for the session directly; the step-up and MFA journeys use the real enrollment and confirmation doors.
 const sessions=new Map();
 const remember=async(cookie,address)=>{const row=await(await mf.getD1Database('DB')).prepare('SELECT s.id FROM oa_sessions s JOIN oa_operators o ON o.id=s.operator_id WHERE o.email=? ORDER BY s.created_at DESC,s.rowid DESC LIMIT 1').bind(address).first();sessions.set(cookie,{id:row.id,email:address});};
 const stepUp=async cookie=>{const {id,email}=sessions.get(cookie);await(await mf.getD1Database('DB')).prepare("INSERT OR REPLACE INTO b_access_stepups(session_id,email,method,verified_at) VALUES(?,?,'test harness',?)").bind(id,email,new Date().toISOString()).run();};
 // `request` confirms the step-up for a known session and retries once; `send` shows the refusal itself.
 const request=async(path,body,cookie='',extra={})=>{let r=await send(path,body,cookie,extra);
  if(r.status===403&&sessions.has(cookie)&&(await r.clone().json().catch(()=>({}))).mfa==='step-up'){await stepUp(cookie);r=await send(path,body,cookie,extra);}
  return r;};
 // Base replaces a refused upload larger than 64 KB with a plain 413, so a large archive meeting the step-up door arrives as that.
 const read=async r=>{const text=await r.text();try{return JSON.parse(text);}catch{return {error:text};}};
 const json=async(path,body,cookie,expected=200,extra={})=>{let r=await send('/api/blotter'+path,body,cookie,extra),b=await read(r);
  if((r.status===413||(r.status===403&&b.mfa==='step-up'))&&![403,413].includes(expected)&&sessions.has(cookie)){await stepUp(cookie);r=await send('/api/blotter'+path,body,cookie,extra);b=await read(r);}
  assert.equal(r.status,expected,JSON.stringify(b));return b;};
 async function login(email){
  assert.equal((await request('/auth/magic-link',{email})).status,202);
  const message=mails.toReversed().find(m=>m.to.includes(email));
  assert.ok(message,'Provider accepted a confirmation link');
  const token=(message.text??message.html).match(/\/auth\/confirm\?token=([^\s"&<]+)/)?.[1];
  assert.ok(token,'Mail includes a confirmation token');
  const result=await request('/auth/confirm',{token});assert.equal(result.status,303);
  const cookie=result.headers.getSetCookie().map(s=>s.split(';')[0]).join('; ');await remember(cookie,email);return cookie;
 }
 try{
  await mf.ready;const db=await mf.getD1Database('DB');
  for(const file of (await readdir('migrations/core')).filter(f=>f.endsWith('.sql')).sort())for(const sql of splitSql(await readFile(join('migrations/core',file),'utf8')))await db.prepare(sql).run();
  assert.equal((await request('/health')).status,200);
  const boot=await request('/auth/bootstrap',{token:vars.SETUP_TOKEN,displayName:'Principal'});assert.equal(boot.status,303,await boot.text());
  const owner=vars.RER_DEMO?boot.headers.getSetCookie().map(s=>s.split(';')[0]).join('; '):await login(vars.OWNER_EMAIL);
  if(vars.RER_DEMO)await remember(owner,vars.OWNER_EMAIL);
  // The Worker's Cron Trigger door, fired as of a chosen time.
  const scheduled=async at=>(await mf.getWorker()).scheduled({scheduledTime:new Date(at),cron:'17 * * * *'});
  return {origin,owner,request,send,json,login,stepUp,mails,scheduled,db,restart:async()=>{await mf.dispose();mf=new Miniflare(options);await mf.ready;},close:async()=>{await mf.dispose();await rm(directory,{recursive:true,force:true});}};
 }catch(e){await mf.dispose();await rm(directory,{recursive:true,force:true});throw e;}
}
