// Capped synthetic-only provider journey; never part of ordinary tests or CI.
import assert from 'node:assert/strict';
import {harness} from './harness.mjs';
import {aiFixture,invoiceText} from './ai-fixture.mjs';

assert.ok(process.env.AI_API_KEY,'Inject the held provider key into AI_API_KEY');
let calls=0;
const h=await harness({bindings:{AI_API_KEY:process.env.AI_API_KEY,AI_MODEL:'gpt-5-nano'},aiResponse:async(payload,request)=>{
 assert.ok(++calls<=3,'This journey permits at most three provider requests');
 assert.equal(payload.store,false);assert.equal(payload.max_completion_tokens,1200);assert.equal(payload.tools,undefined);
 const wire=JSON.stringify(payload);for(const identifier of ['123-45-6789','12-3456789','123456789012','987-65-4321','7654321','GB82 WEST'])assert.ok(!wire.includes(identifier));
 assert.ok(wire.length<12000,'Synthetic input and schema remain within the run cap');
 console.log(JSON.stringify({providerEdge:{number:calls,provider:'openai',model:payload.model,store:payload.store,maximumOutputTokens:payload.max_completion_tokens,bytes:Buffer.byteLength(wire),transmittedMessages:payload.messages,tools:payload.tools??null}}));
 let response;
 try {response=await fetch(request.url,{method:'POST',headers:{authorization:request.headers.get('authorization'),'content-type':'application/json'},body:wire,signal:AbortSignal.timeout(30_000)});}
 catch(error){console.log(JSON.stringify({providerTransportError:{name:error.name,code:error.cause?.code??error.code??'unknown'}}));throw error;}
 console.log(JSON.stringify({providerResult:{status:response.status,requestId:response.headers.get('x-request-id')}}));
 assert.equal(response.status,200,'The real provider must accept the bounded request');
 const data=await response.clone().json();console.log(JSON.stringify({usage:data.usage,finishReason:data.choices?.[0]?.finish_reason,refused:!!data.choices?.[0]?.message?.refusal}));
 return response;
}});
try {
 const s=await aiFixture(h),before=h.mails.length;
 await s.request('summary',s.prep,{},403);assert.equal(calls,0);
 await s.enable();await s.request('summary',s.prep,{confirm:false},400);assert.equal(calls,0);
 const summary=await s.request('summary');assert.ok(summary.output.summary);assert.ok(summary.output.conflicts.length);
 const invoice=await h.json(`/requests/${s.d.requests[0].id}/files`,{name:'synthetic-blotter-invoice.txt',mime:'text/plain',contentBase64:Buffer.from(invoiceText).toString('base64')},s.prep);
 const document=await s.request('document',s.prep,{sourceId:invoice.id});assert.ok(document.output.validation.length);assert.ok(document.output.suggestedName);
 const notice=await s.request('notice',s.reviewer);assert.ok(notice.output.plan.length);
 for(const field of ['CP2000','2024','$1,250.00','2027-02-28'])assert.ok(notice.output.extraction.some(item=>item.value===field),`Notice extraction retains ${field}`);
 assert.equal(calls,3);assert.equal(h.mails.length,before);
 assert.equal((await h.db.prepare('SELECT COUNT(*) n FROM b_ai_drafts').first()).n,0);
 assert.equal((await h.db.prepare("SELECT COUNT(*) n FROM b_audit WHERE action='ai.request'").first()).n,3);
 console.log(JSON.stringify({result:'PASS',calls,maximumOutputTokens:3600,syntheticOnly:true,disabledRefused:true,missingClickRefused:true,noSavedOutput:true,noSend:true,purposes:['summary','document','notice']}));
} finally {await h.close();}
