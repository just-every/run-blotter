// Explicit live sandbox journey. Secret bindings come only from the fleet injector.
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {harness} from './harness.mjs';
const bindings=Object.fromEntries(['ENTRA_TENANT_ID','ENTRA_CLIENT_ID','ENTRA_CLIENT_SECRET'].map(name=>{assert.ok(process.env[name],name+' is required');return [name,process.env[name]];}));
bindings.ENTRA_TRANSACTION_SECRET=randomBytes(32).toString('hex');
const operations=[];
const h=await harness({bindings,identityResponse:async request=>{const response=await fetch(request.url,{method:request.method,headers:request.headers,...(request.method==='POST'?{body:await request.text()}:{}),redirect:'manual',signal:AbortSignal.timeout(10000)});operations.push({operation:new URL(request.url).hostname==='graph.microsoft.com'?'tenant-directory':'client-credentials',status:response.status,requestId:response.headers.get('request-id')??response.headers.get('x-ms-request-id')});return response;}});
try{
 const connected=await h.json('/enterprise',{required:true,requireMfa:true,reason:'Authorized sandbox connection proof'},h.owner);
 assert.equal(connected.connection.active,1);assert.equal(connected.connection.tenant,bindings.ENTRA_TENANT_ID);
 const credential=await h.json('/enterprise/token',{reason:'Authorized sandbox provisioning transport proof'},h.owner);
 const list=await h.send('/scim/v2/Users',undefined,'',{authorization:'Bearer '+credential.token});assert.equal(list.status,200);assert.deepEqual((await list.json()).Resources,[]);
 await h.json('/enterprise/disconnect',{reason:'Sandbox proof cleanup'},h.owner);
 assert.equal((await h.send('/scim/v2/Users',undefined,'',{authorization:'Bearer '+credential.token})).status,401);
 await h.json('/state',undefined,await h.login('owner@example.test'));
 await h.json('/enterprise/erase',{confirm:'ERASE ENTERPRISE',reason:'Sandbox proof cleanup'},h.owner);
 console.log(JSON.stringify({journey:'enterprise-live',commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),operations,connection:true,scimEmptyDirectory:true,revokedTokenDenied:true,nativeOwnerRecovery:true,erasure:true,interactiveSignIn:'not exercised',providerProvisioning:'not exercised'}));
}finally{await h.close();}
