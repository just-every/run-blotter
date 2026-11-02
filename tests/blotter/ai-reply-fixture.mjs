import assert from 'node:assert/strict';
import {createHash,createHmac} from 'node:crypto';
import {noticeText} from './ai-fixture.mjs';

export const sha256=value=>createHash('sha256').update(value).digest('hex');
export async function replyFixture(h,s) {
 const primary=(await h.json(`/clients/${s.client.id}/contacts`,undefined,h.owner))[0];
 const member=await h.db.prepare("SELECT email FROM b_members WHERE role='reviewer'").first();
 const second=await h.json(`/clients/${s.client.id}/contacts`,{name:'Second intended contact',email:member.email,authorized:true,portal:true,emailConsent:true,requestConsent:true,roles:['tax']},h.owner);
 const file=await h.json(`/requests/${s.d.requests[0].id}/files`,{name:'synthetic-blotter-attachment.txt',mime:'text/plain',contentBase64:Buffer.from('synthetic-blotter-8: original attachment bytes').toString('base64')},s.prep);
 const grant=async(fileId,contactIds)=>{
  const access=await h.json(`/documents/${fileId}/access`,undefined,h.owner);
  return h.json(`/documents/${fileId}/access`,{revision:access.revision,visibility:contactIds.length?'contacts':'internal',contactIds},h.owner);
 };
 await grant(s.file.id,[primary.id,second.id]);await grant(file.id,[primary.id,second.id]);
 const prepare=async(extra={})=>{const r=await s.request('summary',s.prep,extra);return h.json(`/ai/requests/${r.requestId}/draft`,{output:r.output},s.prep);};
 const intent=async(draft,extra={})=>{
  const state=await h.json(`/ai/drafts/${draft.id}/reply-review`,undefined,s.prep);
  const value='Reviewed wording for the exact intended contacts and originals.';
  return {decision:'accept',value,textSha256:sha256(value),sourceFingerprint:state.sourceFingerprint,
   recipients:[primary,second].map(c=>state.recipients.find(r=>r.id===c.id)).filter(Boolean).map(c=>({id:c.id,revision:c.revision})),
   attachments:[s.file.id,file.id].map(id=>state.attachments.find(f=>f.id===id)).filter(Boolean).map(f=>({id:f.id,sha256:f.sha256,accessRevision:f.accessRevision})),...extra};
 };
 const review=(draft,body,who=s.prep,status=200,headers={})=>h.json(`/ai/drafts/${draft.id}/reply-review`,body,who,status,headers);
 return {primary,second,file,grant,prepare,intent,review};
}

async function effects(h) {
 const tables=['b_document_grants','b_document_access','b_document_shares','b_portal_links','b_reminders','b_signature_deliveries','b_signatures','b_invoices','b_provider_payments','b_payment_mandates','b_time','b_expenses'];
 return {mails:h.mails.length,provider:h.aiCalls.length,tables:await Promise.all(tables.map(async table=>(await h.db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()).results))};
}

async function enroll(h,cookie) {
 const start=await h.json('/mfa/totp/start',{},cookie);
 let bits=0,value=0;const bytes=[];
 for(const char of start.secret){value=(value<<5)|'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'.indexOf(char);bits+=5;if(bits>=8){bytes.push((value>>>(bits-8))&255);bits-=8;}}
 const counter=Buffer.alloc(8);counter.writeBigUInt64BE(BigInt(Math.floor(Date.now()/30000)-1));
 const mac=createHmac('sha1',Buffer.from(bytes)).update(counter).digest(),offset=mac[19]&15;
 return h.json('/mfa/totp/confirm',{id:start.id,code:String((mac.readUInt32BE(offset)&0x7fffffff)%1e6).padStart(6,'0')},cookie);
}

// A sanity journey through authenticated HTTP, including unsafe paths that must leave no effects.
export async function replyReviewJourney(h,s) {
 await s.enable(true,30);
 const f=await replyFixture(h,s),draft=await f.prepare(),body=await f.intent(draft);
 const before=await effects(h);
 await h.json(`/ai/drafts/${draft.id}/decisions`,{field:'reply',decision:'accept',value:body.value},s.prep,400);
 await f.review(draft,{...body,textSha256:sha256('Different wording')},s.prep,409);
 await f.review(draft,{...body,sourceFingerprint:sha256('Different source')},s.prep,409);
 await f.review(draft,{...body,recipients:[]},s.prep,400);
 await f.review(draft,{...body,attachments:[{...body.attachments[0],sha256:sha256('Different original')}]},s.prep,409);
 const [one,two]=await Promise.all([f.review(draft,body),f.review(draft,{...body,recipients:[...body.recipients].reverse(),attachments:[...body.attachments].reverse()})]);
 assert.equal(one.review.id,two.review.id);assert.deepEqual([one.replayed,two.replayed].sort(),[false,true]);
 const saved=one.review,actor=await h.db.prepare("SELECT id,email FROM oa_operators WHERE id=?").bind(saved.actor_id).first();
 assert.equal(saved.reviewed_by,actor.email);assert.ok(saved.reviewed_at);
 assert.deepEqual(saved.recipients,[...body.recipients].sort((a,b)=>a.id.localeCompare(b.id)));
 assert.deepEqual(saved.attachments,[...body.attachments].sort((a,b)=>a.id.localeCompare(b.id)));
 assert.equal(saved.text_sha256,sha256(body.value));assert.equal(saved.value,body.value);assert.equal(saved.source_fingerprint,sha256(draft.source.text));
 assert.equal((await h.db.prepare("SELECT COUNT(*) n FROM b_ai_decisions WHERE draft_id=? AND field='reply'").bind(draft.id).first()).n,1);
 assert.equal((await h.db.prepare("SELECT COUNT(*) n FROM b_audit WHERE action='ai.reply_reviewed' AND object_id=?").bind(saved.id).first()).n,1);
 await f.review(draft,{...body,value:'Changed wording',textSha256:sha256('Changed wording')},s.prep,409);
 await f.review(draft,{...body,recipients:body.recipients.slice(0,1)},s.prep,409);
 await f.review(draft,{...body,attachments:body.attachments.slice(0,1)},s.prep,409);
 await f.review(draft,body,s.reviewer,409);
 assert.deepEqual(await effects(h),before,'Review and replay never send, grant, sign or bill');

 // Live revocation also fences an otherwise identical replay of a completed review.
 await f.grant(f.file.id,[f.primary.id]);const revoked=await effects(h),revokedIntent=await f.intent(draft);
 await f.review(draft,revokedIntent,s.prep,409);assert.deepEqual(await effects(h),revoked);
 await f.grant(f.file.id,[f.primary.id,f.second.id]);
 const changed=await h.json(`/clients/${s.client.id}/contacts`,{id:f.second.id,revision:f.second.revision,emailConsent:false},h.owner);
 const contactEffects=await effects(h);await f.review(draft,body,s.prep,409);assert.deepEqual(await effects(h),contactEffects);
 f.second=await h.json(`/clients/${s.client.id}/contacts`,{id:changed.id,revision:changed.revision,emailConsent:true},h.owner);

 const pending=await f.prepare(),intent=await f.intent(pending),outside=await s.start(s.outside.id,'2027-01-01'),request=(await s.detail(outside.id)).requests[0];
 const foreign=await h.json(`/requests/${request.id}/files`,{name:'synthetic-blotter-foreign.txt',mime:'text/plain',contentBase64:Buffer.from('synthetic-blotter-9').toString('base64')},s.prep);
 const foreignContact=await h.json(`/clients/${s.outside.id}/contacts`,{name:'Foreign contact',email:f.primary.email,authorized:true,portal:true,emailConsent:true,requestConsent:true},h.owner);
 await f.review(pending,{...intent,recipients:[{id:foreignContact.id,revision:foreignContact.revision}]},s.prep,409);
 await f.review(pending,{...intent,attachments:[{id:foreign.id,sha256:sha256('synthetic-blotter-9'),accessRevision:'synthetic-blotter-10'}]},s.prep,404);
 await f.grant(f.file.id,[]);await f.review(pending,intent,s.prep,409);
 await f.grant(f.file.id,[f.primary.id,f.second.id]);
 const updated=await f.intent(pending);
 await h.json('/access/people',{email:actor.email,readOnly:false,clientIds:[s.client.id,s.outside.id]},h.owner);
 await h.json(`/access/documents/${f.file.id}`,{classification:'Private working material',reason:'Restrict this original',emails:[]},h.owner);
 await f.review(pending,updated,s.prep,404);
 await h.json(`/files/${f.file.id}/erase`,{confirm:'synthetic-blotter-attachment.txt',reason:'Remove this attachment'},h.owner);
 await f.review(pending,updated,s.prep,404);
 const otherAddress=(await h.db.prepare("SELECT email FROM b_members WHERE role='preparer' AND email<>?").bind(actor.email).first()).email;
 const other=await h.login(otherAddress);await f.review(pending,updated,other,404);
 const key=await h.json('/keys',{label:'No reply-review authority'},h.owner);
 await f.review(pending,updated,'',401,{authorization:'Bearer '+key.key});

 // A changed selected conversation cannot be approved or rejected against its old source.
 await h.json(`/jobs/${s.j.id}/portal/messages`,{body:noticeText},s.prep);
 const conversation=await f.prepare({sourceKind:'portal',sourceId:s.j.id}),old=await f.intent(conversation);
 await h.json(`/jobs/${s.j.id}/portal/messages`,{body:'synthetic-blotter-12: newly supplied context'},s.prep);
 await f.review(conversation,{...old,attachments:[]},s.prep,409);

 // Rejection retains wording and attribution but creates no intended delivery or effects.
 const rejected=await f.prepare(),rejection=await f.intent(rejected,{decision:'reject',recipients:[],attachments:[]}),rejectionEffects=await effects(h);
 const no=await f.review(rejected,rejection);assert.equal(no.review.decision,'reject');assert.deepEqual(no.review.recipients,[]);assert.deepEqual(no.review.attachments,[]);
 assert.deepEqual(await effects(h),rejectionEffects);

 const authorityDraft=await f.prepare(),authorityBody=await f.intent(authorityDraft,{attachments:[]});
 await h.json('/access/people',{email:actor.email,readOnly:true,clientIds:[s.client.id,s.outside.id]},h.owner);
 await f.review(authorityDraft,authorityBody,s.prep,403);
 await h.json('/access/people',{email:actor.email,readOnly:false,clientIds:[]},h.owner);
 await f.review(authorityDraft,authorityBody,s.prep,404);
 await h.json('/access/people',{email:actor.email,readOnly:false,clientIds:[s.client.id,s.outside.id]},h.owner);
 await enroll(h,h.owner);
 await h.json('/team/mfa-policy',{required:true},h.owner);
 assert.equal((await f.review(authorityDraft,authorityBody,s.prep,403)).mfa,'enroll');
 const factor=await enroll(h,s.prep);await h.json('/team/mfa-policy',{required:false},h.owner);
 const fresh=await h.login(actor.email);assert.equal((await f.review(authorityDraft,authorityBody,fresh,403)).mfa,'verify');
 await h.json('/mfa/verify',{recoveryCode:factor.recoveryCodes[0]},fresh);
 const valid=await f.review(authorityDraft,authorityBody,fresh);assert.equal(valid.review.reviewed_by,actor.email);
 await h.send('/auth/signout',{},fresh);await f.review(authorityDraft,authorityBody,fresh,401);
 await h.json('/team',{email:actor.email,name:'Inactive staff member',role:'preparer',active:false},h.owner);
 await f.review(authorityDraft,authorityBody,s.prep,401);
 assert.equal((await h.db.prepare('SELECT COUNT(*) n FROM b_ai_reply_reviews WHERE draft_id=?').bind(pending.id).first()).n,0,'Invalid intentions never consume the review');
 return saved;
}
