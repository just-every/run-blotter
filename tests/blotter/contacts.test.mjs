import { test } from 'node:test';
import assert from 'node:assert/strict';
import { harness } from './harness.mjs';
const contact = (name,email,extra={}) => ({name,email,roles:['primary'],authorized:true,portal:true,requestConsent:true,emailConsent:true,...extra});
const token = r => new URL(r.portalUrl).pathname.split('/').at(-1);

test('CRM-001 entities, contact-specific authority, routing, editing, archive/reactivation, phone/SSN matches, merge/undo, prospect conversion and portable history', async () => {
 const h=await harness(); let restored;
 try {
  for(const [email,role] of [['reviewer@example.test','reviewer'],['prep@example.test','preparer'],['other@example.test','preparer']]) { await h.json('/team',{email,name:email.split('@')[0],role},h.owner); await h.json('/team/invite',{email},h.owner); }
  const prep=await h.login('prep@example.test'), other=await h.login('other@example.test'), review=await h.login('reviewer@example.test');
  const c=await h.json('/clients',{name:'Chen Cafe LLC',entityType:'business',partnerEmail:'reviewer@example.test',team:['prep@example.test'],services:['Sales tax'],contacts:[contact('Mia Chen','mia@example.test',{phone:'(919) 555-0101',signer:true}),contact('Luis Garcia','luis@example.test',{roles:['billing','bookkeeping']}),contact('No Authority','visitor@example.test',{authorized:false,portal:false})]},h.owner);
  assert.equal(c.contacts.length,3); assert.equal(c.contacts[0].client_id,c.id); assert.deepEqual(c.team,['prep@example.test']);assert.deepEqual(c.services,['Sales tax']);assert.equal(c.partner_email,'reviewer@example.test');
  const individual=await h.json('/clients',{name:'Mia Chen',entityType:'individual',ownerClientId:c.id,ssnLast4:'7438'},h.owner);
  const trust=await h.json('/clients',{name:'Chen Family Trust',entityType:'trust',ownerClientId:individual.id},h.owner);assert.equal(trust.entity_type,'trust');assert.equal(individual.owner_client_id,c.id);assert.equal(individual.ssn_last4,'•••••7438');
  const template=await h.json('/templates',{name:'Sales tax',recurrence:'monthly',steps:'Reconcile',requests:'Final statements'},h.owner);
  const start={clientId:c.id,templateId:template.id,periodStart:'2026-10-01',dueDate:'2026-11-20',dueNote:'Recorded engagement date',preparerEmail:'prep@example.test',reviewerEmail:'reviewer@example.test'};
  const job=await h.json('/jobs',start,h.owner);
  await h.json(`/clients/${c.id}/detail`,undefined,other,404);await h.json(`/clients/${c.id}/contacts`,{name:'Denied'},prep,403);
  const lu=c.contacts.find(x=>x.email==='luis@example.test'), unauthorized=c.contacts.find(x=>x.email==='visitor@example.test');
  await h.json(`/jobs/${job.id}/reminders`,{contactId:unauthorized.id},h.owner,409);
  const sent=await h.json(`/jobs/${job.id}/reminders`,{contactId:lu.id},h.owner); assert.ok(h.mails.some(m=>m.to.includes('luis@example.test')));
  assert.equal((await h.json(`/portal/${token(sent)}`,undefined)).client,'Chen Cafe LLC');
  const updated=await h.json(`/clients/${c.id}/contacts`,{id:lu.id,revision:lu.revision,name:'Luis Garcia CPA',portal:false},h.owner);assert.equal(updated.name,'Luis Garcia CPA');
  await h.json(`/portal/${token(sent)}`,undefined,undefined,404);
  const cross=await h.json('/clients',{name:'Garcia LLC',contacts:[contact('Luis Garcia','luis@example.test',{authorized:false,portal:false})]},h.owner);
  const crossjob=await h.json('/jobs',{...start,clientId:cross.id},h.owner);await h.json(`/jobs/${crossjob.id}/reminders`,{},h.owner,409);
  let detail=await h.json(`/clients/${c.id}/detail`,undefined,h.owner);
  detail=await h.json(`/clients/${c.id}/edit`,{revision:detail.revision,name:'Chen Cafe and Bakery LLC',team:['prep@example.test','other@example.test'],services:['Sales tax','Payroll']},h.owner);assert.equal(detail.name,'Chen Cafe and Bakery LLC');
  await h.json(`/jobs/${job.id}`,undefined,other,404); // responsibility never grants new job visibility
  await h.json('/rules',{...start,firstPeriod:'2026-09-01',endPeriod:'2026-09-01',dueDays:20,leadMonths:0},h.owner);
  detail=await h.json(`/clients/${c.id}/lifecycle`,{revision:detail.revision,lifecycle:'archived'},h.owner);assert.equal(detail.lifecycle,'archived');assert.equal((await h.json('/rules/run',{},h.owner)).created,0);
  await h.json('/jobs',{...start,periodStart:'2026-11-01',dueDate:'2026-12-20'},h.owner,404);await h.json(`/jobs/${job.id}/reminders`,{},h.owner,409);
  assert.equal((await h.json(`/jobs/${job.id}`,undefined,prep)).job.id,job.id);
  detail=await h.json(`/clients/${c.id}/lifecycle`,{revision:detail.revision,lifecycle:'active'},review);assert.equal(detail.lifecycle,'active');assert.equal((await h.json('/rules/run',{},h.owner)).created,1);
  const history=await h.json(`/clients/${c.id}/history`,undefined,h.owner);for(const action of ['client.contact_changed','client.edited','client.archived','client.reactivated']) assert.ok(history.history.some(e=>e.action===action),action);
  const phone=await h.json('/search?q=9195550101',undefined,h.owner);assert.ok(phone.results.some(r=>r.clientId===c.id));
  const ssn=await h.json('/search?q=7438',undefined,h.owner);assert.ok(ssn.results.some(r=>r.id===individual.id&&r.taxId==='•••••7438'));assert.equal((await h.json('/search?q=7438',undefined,prep)).results.length,0);
  const duplicate=await h.json('/clients',{name:'Second Individual',entityType:'individual',ssnLast4:'7438',contacts:[contact('Mia Chen','another@example.test',{phone:'+1 919 555 0101'})]},h.owner);
  const pairs=await h.json('/clients/duplicates',undefined,h.owner);assert.ok(pairs.some(p=>[p.a.id,p.b.id].includes(c.id)&&[p.a.id,p.b.id].includes(duplicate.id)&&p.reasons.includes('same phone')));assert.ok(pairs.some(p=>[p.a.id,p.b.id].includes(individual.id)&&[p.a.id,p.b.id].includes(duplicate.id)&&p.reasons.includes('same last four SSN digits')));
  const compare=await h.json(`/clients/compare?a=${individual.id}&b=${duplicate.id}`,undefined,h.owner);
  const keep=Object.fromEntries(compare.fields.filter(f=>!f.same&&f.key!=='source').map(f=>[f.key,'survivor']));
  const merge={survivor:individual.id,merged:duplicate.id,keep,authority:'Principal confirmed same individual'};
  await h.json('/clients/merge',merge,review,403);await h.json('/clients/merge',merge,h.owner,400);
  const merged=await h.json('/clients/merge',{...merge,contactAuthority:Object.fromEntries(duplicate.contacts.map(x=>[x.id,'Principal checked this contact represents the same individual']))},h.owner);assert.equal((await h.json(`/clients/${individual.id}/contacts`,undefined,h.owner)).length,1);assert.equal(merged.undo,'available');
  await h.json(`/clients/merges/${merged.id}/undo`,{},h.owner);assert.equal((await h.json(`/clients/${duplicate.id}/contacts`,undefined,h.owner))[0].email,'another@example.test');
  const prospect=await h.json('/prospects',{name:'Nguyen LLC',contactName:'Linh Nguyen',contactEmail:'linh@example.test',source:'Referral',ownerEmail:'owner@example.test',services:['Payroll'],estimatedFeeCents:120000,contacts:[contact('Billing Nguyen','billing@example.test',{roles:['billing']})]},h.owner);
  const won=await h.json(`/prospects/${prospect.id}/win`,{...start,clientId:undefined},h.owner);const again=await h.json(`/prospects/${prospect.id}/win`,{...start,clientId:undefined},h.owner);assert.equal(won.clientId,again.clientId);assert.equal((await h.json(`/clients/${won.clientId}/contacts`,undefined,h.owner)).length,2);
  const offboard = await h.json('/team/offboard/preview',{email:'reviewer@example.test',workSuccessor:'other@example.test',reviewSuccessor:'owner@example.test'},h.owner);assert.ok(offboard.clients.some(x=>x.id===c.id));
  await h.json('/team/offboard',{email:'reviewer@example.test',workSuccessor:'other@example.test',reviewSuccessor:'owner@example.test',fingerprint:offboard.fingerprint},h.owner);
  detail=await h.json(`/clients/${c.id}/detail`,undefined,h.owner);assert.equal(detail.partner_email,'owner@example.test');
  const archive=await (await h.request('/api/blotter/backup',undefined,h.owner)).text();restored=await harness();await restored.json('/restore',{archive,confirm:'RESTORE'},restored.owner);
  const copy=await restored.json(`/clients/${c.id}/detail`,undefined,restored.owner);assert.equal(copy.contacts.length,3);assert.equal(copy.revision,detail.revision);assert.equal(copy.contacts.find(x=>x.id===lu.id).portal,0);assert.deepEqual(copy.services,['Sales tax','Payroll']);assert.equal((await restored.json(`/clients/${c.id}/history`,undefined,restored.owner)).jobs.length,2);
 } finally {await restored?.close();await h.close()}
});
