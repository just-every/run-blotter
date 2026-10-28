import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { PDFDocument } from 'pdf-lib';
import { harness } from './harness.mjs';
import { efileJourney } from './efile-authorizations-ui.mjs';
import { enroll } from './erasure-fixture.mjs';

const address = name => [name, 'example.test'].join(String.fromCharCode(64));
const owner = address('owner'), prepEmail = address('prep'), reviewerEmail = address('reviewer');
const door = j => `/jobs/${j.id}/efile-authorization`;
const detail = (h, j, who = h.owner) => h.json(`/jobs/${j.id}`, undefined, who);
const snapshotRows = (archive, table) => archive.trim().split('\n').map(JSON.parse).filter(p => p.kind === 'part').flatMap(p => p.items).filter(i => i.kind === 'row' && i.table === table).map(i => i.row);
async function fixture(h) {
  for (const [email, role] of [[prepEmail,'preparer'],[reviewerEmail,'reviewer'],[address('outside'),'preparer']]) {
    await h.json('/team', { email, name: email.split(String.fromCharCode(64))[0], role }, h.owner);
    await h.json('/team/invite', { email }, h.owner);
  }
  const prep = await h.login(prepEmail), reviewer = await h.login(reviewerEmail), outside = await h.login(address('outside'));
  const contact = name => ({ name, email: address(name.toLowerCase()), roles: ['tax'], authorized: true, signer: true, portal: true, requestConsent: true, emailConsent: true });
  const client = await h.json('/clients', { name: 'Synthetic married taxpayers', entityType: 'individual', contacts: [contact('Alex'),contact('Blair')] }, h.owner);
  const foreign = await h.json('/clients', { name: 'Synthetic foreign taxpayer', entityType: 'individual', contacts: [contact('Casey')] }, h.owner);
  await h.json('/deadlines/rules/us-1040/approve', {}, h.owner);
  const obligation = (await h.json(`/clients/${client.id}/obligations`, { ruleKey: 'us-1040', state: 'CA' }, h.owner)).id;
  const template = await h.json('/templates', { name: 'Synthetic 1040 return', recurrence: 'annual', steps: 'Review final return', requests: 'Practitioner originals' }, h.owner);
  const pdf = await PDFDocument.create(); pdf.addPage().drawText('Form 8879 final unsigned practitioner original');
  const bytes = Buffer.from(await pdf.save()), sha256 = createHash('sha256').update(bytes).digest('hex');
  const fileBody = { name: 'synthetic-blotter-101.pdf', mime: 'application/pdf', contentBase64: bytes.toString('base64') };
  const start = async year => {
    const j = await h.json('/jobs', { clientId: client.id, templateId: template.id, obligationId: obligation, periodStart: `${year}-01-01`, preparerEmail: prepEmail, reviewerEmail }, h.owner);
    const d = await detail(h, j), file = await h.json(`/requests/${d.requests[0].id}/files`, fileBody, prep);
    return { ...j, file, body: { jobId: j.id, clientId: client.id, taxYear: year, form: '8879', filingStatus: 'married_filing_jointly', fileId: file.id,
      spouseContactIds: client.contacts.map(c => c.id), spouseContactRevisions: client.contacts.map(c => c.revision), reviewedFinalUnsigned: true, reviewedRequiredSigners: true } };
  };
  const move = (j, sub, who = prep, expected = 200) => h.json(`/jobs/${j.id}/status`, { stage: 'in_progress', subStatusId: sub }, who, expected);
  return { client, foreign, prep, reviewer, outside, template, bytes, sha256, fileBody, start, move };
}

test('Unsigned 8879 intake through HTTP and browser: immutable original and reviewed spouses, once-only replay, live authority and protected readiness across direct, board, renamed, bulk and automation moves', async () => {
  const h = await harness(), copies = [];
  try {
    const s = await fixture(h), j = await s.start(2025), uiJob = await s.start(2024), raceJob = await s.start(2023);
    const read = (job = j, who = s.prep) => h.json(door(job), undefined, who);
    const before = await read(); assert.equal(before.record, null); assert.equal(before.readyToFile, false);
    for (const patch of [{clientId:s.foreign.id},{taxYear:2024},{jobId:uiJob.id},{form:'8878'},{fileId:uiJob.file.id}])
      await h.json(door(j), {...j.body,...patch}, s.prep, patch.fileId ? 404 : 409);
    await h.json(door(j), {...j.body,spouseContactIds:[s.client.contacts[0].id,s.foreign.contacts[0].id]}, s.prep, 409);
    await h.json(door(j), {...j.body,spouseContactIds:[s.client.contacts[0].id,s.client.contacts[0].id]}, s.prep, 400);
    await h.json(door(j), {...j.body,reviewedRequiredSigners:false}, s.prep, 400);
    await h.json(door(j), {...j.body,completed:true}, s.prep, 400);
    await h.json(door(j), j.body, s.outside, 404);
    const key = await h.json('/keys', {label:'Synthetic unsigned intake exclusion'}, h.owner);
    await h.json(door(j), j.body, '', 401, {authorization:'Bearer '+key.key});
    const mailCount=h.mails.length;
    const [one,two] = await Promise.all([h.json(door(j),j.body,s.prep),h.json(door(j),j.body,s.prep)]);
    assert.equal(h.mails.length,mailCount,'Unsigned intake creates no delivery or remote signing request');
    assert.deepEqual(one,two); assert.equal(one.record.sha256,s.sha256);
    assert.deepEqual(one.record.signers.map(c=>[c.contactId,c.name,c.signature,c.kba,c.currentAuthority]),s.client.contacts.map(c=>[c.id,c.name,'unavailable','unavailable',true]));
    assert.equal(one.record.recordedBy,prepEmail); assert.ok(one.record.recordedAt);
    const download = await h.request('/api/blotter'+door(j)+'/original',undefined,s.prep);
    assert.equal(download.status,200); assert.deepEqual(Buffer.from(await download.arrayBuffer()),s.bytes);
    assert.equal((await detail(h,j)).deadline.filing_recorded_at,null);
    await h.json(door(j),{...j.body,spouseContactIds:[...j.body.spouseContactIds].reverse(),spouseContactRevisions:[...j.body.spouseContactRevisions].reverse()},s.prep,409);
    const race = await Promise.all([h.request('/api/blotter'+door(raceJob),raceJob.body,s.prep),h.request('/api/blotter'+door(raceJob),{...raceJob.body,spouseContactIds:[...raceJob.body.spouseContactIds].reverse(),spouseContactRevisions:[...raceJob.body.spouseContactRevisions].reverse()},s.prep)]);
    assert.deepEqual(race.map(r=>r.status).sort(),[200,409]);
    const history = (await h.json(`/clients/${s.client.id}/history?kind=documents`,undefined,h.owner)).history.filter(e=>e.action==='efile.unsigned_recorded');
    for (const job of [j,raceJob]) assert.equal(history.filter(e=>e.object_id===job.id && e.actor===prepEmail).length,1);
    const protectedStatus = await h.json('/sub-statuses',{stage:'in_progress',name:'Ready to file',efileReady:true},h.owner);
    await s.move(j,protectedStatus.id,s.prep,409);
    await h.json(`/sub-statuses/${protectedStatus.id}`,{name:'Final preparation complete',clientLabel:'Prepared'},h.owner);
    await s.move(j,protectedStatus.id,s.prep,409);
    await h.json(`/sub-statuses/${protectedStatus.id}`,{efileReady:false},h.owner,409);
    await h.json(`/sub-statuses/${protectedStatus.id}/delete`,{},h.owner,409);
    await h.json(`/jobs/${j.id}/steps`,{ordinal:1,done:true},s.prep);
    await s.move(j,protectedStatus.id,s.prep,409);
    await h.json(`/jobs/${j.id}/status`,{stage:'completed'},s.prep,409);
    const signer = s.client.contacts[0], fields = [{type:'signature',contactId:signer.id,page:1,x:40,y:80,width:240,height:28,label:'Signature'}];
    await h.json(`/jobs/${j.id}/signatures`,{title:'Ordinary title',formKind:'general',mode:'parallel',contactIds:[signer.id],fields,file:s.fileBody},s.prep,409);
    const generalPdf=await PDFDocument.create();generalPdf.addPage().drawText('Synthetic general approval');
    const generalFile={...s.fileBody,name:'synthetic-blotter-102.pdf',contentBase64:Buffer.from(await generalPdf.save()).toString('base64')};
    await h.json(`/jobs/${j.id}/signatures`,{title:'Form 8879',formKind:'8879',mode:'parallel',contactIds:[signer.id],fields,file:generalFile},s.prep,409);
    const draft=await h.json(`/jobs/${j.id}/signatures`,{title:'Synthetic general approval',formKind:'general',mode:'parallel',contactIds:[signer.id],fields,file:generalFile},s.prep);
    const sent=await h.json(`/signatures/${draft.id}/send`,{revision:draft.revision},s.prep), token=new URL(sent.invitations[0].portalUrl).pathname.split('/').at(-1);
    const signing=await h.json(`/portal/${token}/signatures/${draft.id}`);
    await h.json(`/portal/${token}/signatures/${draft.id}/sign`,{revision:signing.revision,attempt:signing.attempt,consent:true,intent:true,consentVersion:signing.consentVersion,values:{[signing.fields[0].id]:signing.signerName}});
    assert.equal((await h.json(`/signatures/${draft.id}`,undefined,s.prep)).status,'completed');
    await s.move(j,protectedStatus.id,s.prep,409);
    const ordinary=await h.json('/sub-statuses',{stage:'in_progress',name:'Ready to file label only'},h.owner);
    await s.move(j,ordinary.id);await s.move(raceJob,ordinary.id);
    const plan=await h.json(`/sub-statuses/${ordinary.id}/delete/preview`,{toStage:'in_progress',toSubStatusId:protectedStatus.id},h.owner);
    assert.equal(plan.jobs.length,2);assert.match(plan.problems.join(' '),/KBA/);
    const priorJobs=await Promise.all([detail(h,j),detail(h,raceJob)]);
    await h.json(`/sub-statuses/${ordinary.id}/delete`,{toStage:'in_progress',toSubStatusId:protectedStatus.id,fingerprint:plan.fingerprint},h.owner,409);
    for(const [i,job] of [j,raceJob].entries())assert.deepEqual((await detail(h,job)).statusHistory,priorJobs[i].statusHistory);
    await h.json(`/sub-statuses/${ordinary.id}`,{efileReady:true},h.owner,409);
    const ruleBody={name:'Synthetic guarded readiness',clientIds:[s.client.id],trigger:{kind:'status',stage:'waiting'},action:{kind:'status',stage:'in_progress',subStatusId:protectedStatus.id},budget:5};
    const preview=await h.json('/automation/preview',ruleBody,h.owner);
    const rule=await h.json('/automation',{...ruleBody,fingerprint:preview.fingerprint},h.owner);
    await h.json(`/automation/${rule.id}/activate`,{},h.owner);
    await h.json(`/jobs/${j.id}/status`,{stage:'waiting'},s.prep);
    await h.json('/automation/run',{},h.owner);
    const attempts=(await h.json('/automation',undefined,h.owner)).attempts.filter(a=>a.rule_id===rule.id);
    assert.equal(attempts.length,1);assert.equal(attempts[0].status,'failed');assert.match(attempts[0].outcome,/KBA/);
    assert.equal((await detail(h,j)).job.open_stage,'waiting');
    // A designation racing a move cannot wrap an already-entered job or admit
    // a job through a target that became protected after its first read.
    const racingStatus=await h.json('/sub-statuses',{stage:'in_progress',name:'Synthetic designation race'},h.owner);
    const effects=await Promise.all([
      h.request(`/api/blotter/jobs/${j.id}/status`,{stage:'in_progress',subStatusId:racingStatus.id},s.prep),
      h.request(`/api/blotter/sub-statuses/${racingStatus.id}`,{efileReady:true},h.owner),
    ]);
    assert.deepEqual(effects.map(result=>result.status).sort(),[200,409]);
    const designation=(await h.json('/work-types',undefined,h.owner)).subStatuses.find(sub=>sub.id===racingStatus.id);
    const finalJob=(await detail(h,j)).job;
    assert.ok(designation.efile_ready ? finalJob.sub_status_id!==racingStatus.id : finalJob.sub_status_id===racingStatus.id);
    await efileJourney(h,{...s,job:uiJob,protectedStatus});
    for(const email of [prepEmail,reviewerEmail])await h.json('/access/people',{email,readOnly:false,clientIds:[s.client.id]},h.owner);
    await h.json(`/access/documents/${j.file.id}`,{classification:'Tax return',reason:'Current custodian only',emails:[reviewerEmail]},h.owner);
    await h.json(door(j),undefined,s.prep,404);
    await h.json(door(j),j.body,s.prep,404);
    assert.equal((await h.request('/api/blotter'+door(j)+'/original',undefined,s.prep)).status,404);
    assert.ok((await h.json(`/clients/${s.client.id}/history?kind=documents`,undefined,s.prep)).history.every(event=>event.object_id!==j.id||!event.action.startsWith('efile.')));
    await h.json(`/access/documents/${j.file.id}`,{classification:'Tax return',reason:'Restored staff custody',emails:[prepEmail,reviewerEmail]},h.owner);
    await h.json('/access/people',{email:prepEmail,readOnly:true,clientIds:[s.client.id]},h.owner);
    await h.json(door(j),j.body,s.prep,403);
    await h.json('/access/people',{email:prepEmail,readOnly:false,clientIds:[s.foreign.id]},h.owner);
    await h.json(door(j),undefined,s.prep,404);
    await h.json('/access/people',{email:prepEmail,readOnly:false,clientIds:[s.client.id]},h.owner);
    const staleJob=await s.start(2022);
    let current=(await h.json(`/clients/${s.client.id}/contacts`,undefined,h.owner)).find(c=>c.id===signer.id);
    const corrected=await h.json(`/clients/${s.client.id}/contacts`,{id:current.id,revision:current.revision,name:'Alex Corrected'},h.owner);
    await h.json(door(staleJob),staleJob.body,s.prep,409);
    assert.equal((await h.json(door(staleJob),undefined,s.prep)).record,null);
    const freshBody={...staleJob.body,spouseContactRevisions:[corrected.revision,staleJob.body.spouseContactRevisions[1]]};
    assert.equal((await h.json(door(staleJob),freshBody,s.prep)).record.signers[0].name,'Alex Corrected');
    current=corrected;
    await h.json(`/clients/${s.client.id}/contacts`,{id:current.id,revision:current.revision,signer:false},h.owner);
    assert.equal((await read()).record.signers[0].currentAuthority,false);
    await h.json(door(j),j.body,s.prep,409);
    assert.equal((await h.request('/api/blotter'+door(j)+'/original',undefined,s.prep)).status,409);
    const codes=await enroll(h,h.owner),fresh=await h.login(owner);
    const refused=await h.send('/api/blotter'+door(uiJob),uiJob.body,fresh);
    assert.equal(refused.status,403);assert.equal((await refused.json()).mfa,'verify');
    await h.json('/mfa/verify',{recoveryCode:codes.recovery[0]},fresh);
    await h.json(door(uiJob),uiJob.body,fresh,409);
    await h.json('/team',{email:prepEmail,name:'Prep',role:'preparer',active:false},h.owner);
    assert.ok([401,403].includes((await h.send('/api/blotter'+door(j),undefined,s.prep)).status));
  } finally { await h.close(); for (const copy of copies) await copy.close(); }
});

test('Unsigned 8879 custody: classified previews, no invented signed clock, holds, original erasure receipts, exact inactive archive history and stale-restore refusal',async()=>{
  const h=await harness(),copies=[];
  try {
    const s=await fixture(h),j=await s.start(2025);
    const protectedStatus=await h.json('/sub-statuses',{stage:'in_progress',name:'Protected return release',efileReady:true},h.owner);
    await h.json(door(j),j.body,s.prep);
    const read=await h.json(door(j),undefined,s.prep);
    assert.equal((await h.request('/api/blotter'+door(j)+'/original',undefined,s.prep)).status,200);
    const archive=await(await h.request('/api/blotter/backup',undefined,h.owner)).text();
    const archived=snapshotRows(archive,'b_efile_authorizations');assert.equal(archived.length,1);
    assert.deepEqual(Buffer.from(archived[0].original_base64,'base64'),s.bytes);
    assert.deepEqual([archived[0].id,archived[0].file_sha256,archived[0].recorded_by,archived[0].recorded_at,archived[0].restored],[read.record.id,s.sha256,prepEmail,read.record.recordedAt,1]);
    assert.deepEqual(JSON.parse(archived[0].roster).map(c=>[c.contactId,c.name]),s.client.contacts.map(c=>[c.id,c.name]));
    const restored=await harness();copies.push(restored);
    await restored.json('/restore',{archive,confirm:'RESTORE',acknowledge:'erasure history unverified: supply your latest erasure journal'},restored.owner);
    const historical=await restored.json(door(j),undefined,restored.owner);
    assert.equal(historical.record.restored,true);assert.equal(historical.record.sha256,s.sha256);assert.equal(historical.readyToFile,false);
    assert.equal((await restored.json('/work-types',undefined,restored.owner)).subStatuses.find(row=>row.id===protectedStatus.id).efile_ready,1);
    await restored.json(`/jobs/${j.id}/status`,{stage:'in_progress',subStatusId:protectedStatus.id},restored.owner,409);
    await restored.json(door(j),j.body,restored.owner,409);
    assert.equal((await restored.request('/api/blotter'+door(j)+'/original',undefined,restored.owner)).status,409);
    let preview=await h.json(`/clients/${s.client.id}/erasure/preview`,undefined,h.owner);
    assert.ok(!preview.blockers.some(b=>/Unclassified/.test(b)));
    assert.equal(preview.classes.find(c=>c.class==='efile_auth').marker,1);
    assert.ok(!preview.records.some(r=>r.class==='efile_auth'),'Unsigned intake starts no signed-record retention clock');
    assert.ok(preview.externalCopies.some(c=>c.source==='efile-downloads'&&c.holder.includes(prepEmail)));
    const mark={kind:'hold',reason:'Practitioner original dispute',owner,reviewDate:'2999-01-01'};
    for(const scope of [{scope:'class',class:'efile_auth'},{scope:'job',targetId:j.id},{scope:'file',targetId:j.file.id}]) {
      const hold=await h.json(`/clients/${s.client.id}/retention`,{...mark,...scope},h.owner);
      preview=await h.json(`/clients/${s.client.id}/erasure/preview`,undefined,h.owner);
      assert.equal(preview.classes.find(c=>c.class==='efile_auth').held,1);
      await h.json(`/files/${j.file.id}/erase`,{confirm:s.fileBody.name,reason:'Held attempt'},h.owner,409);
      assert.equal((await h.json(door(j),undefined,h.owner)).record.sha256,s.sha256);
      await h.json(`/retention/${hold.id}/release`,{reason:'Reviewed and released'},h.owner);
    }
    await h.json(`/files/${j.file.id}/erase`,{confirm:s.fileBody.name,reason:'Practitioner requests original erasure'},h.owner);
    assert.equal((await h.json(door(j),undefined,h.owner)).record,null);
    assert.equal((await h.request('/api/blotter'+door(j)+'/original',undefined,h.owner)).status,404);
    await h.json(door(j),j.body,s.prep,404);
    const second=await s.start(2024);await h.json(door(second),second.body,s.prep);
    // Close through the existing independent review and explicit practitioner
    // acknowledgment doors, never by the unsigned record or a readiness override.
    for(const work of [j,second]) {
      let d=await detail(h,work);
      const ack=await h.json(`/requests/${d.requests[0].id}/files`,{name:'synthetic-blotter-103.txt',mime:'text/plain',contentBase64:Buffer.from('Synthetic practitioner agency acknowledgment').toString('base64')},s.prep);
      await h.json(`/requests/${d.requests[0].id}/decide`,{decision:'accept'},s.prep);
      await h.json(`/jobs/${work.id}/steps`,{ordinal:1,done:true},s.prep);
      assert.equal((await detail(h,work)).deadline.filing_recorded_at,null);
      await h.json(`/jobs/${work.id}/deadline/filing`,{fileId:ack.id,submissionId:'synthetic-blotter-104',acceptedOn:'2026-04-15'},s.prep);
      d=await detail(h,work);d=await h.json(`/jobs/${work.id}/submit`,{revision:d.job.revision},s.prep);
      await h.json(`/jobs/${work.id}/review`,{revision:d.job.revision,decision:'signoff',note:'Independent practitioner review'},s.reviewer);
    }
    const client=await h.json(`/clients/${s.client.id}/detail`,undefined,h.owner);
    await h.json(`/clients/${s.client.id}/lifecycle`,{lifecycle:'archived',revision:client.revision},h.owner);
    preview=await h.json(`/clients/${s.client.id}/erasure/preview`,undefined,h.owner);
    assert.equal(preview.eligible,true,preview.blockers.join(' '));
    assert.equal(preview.classes.find(c=>c.class==='efile_auth').marker,1);
    assert.ok(!preview.records.some(r=>r.class==='efile_auth'));
    const receipt=await h.json(`/clients/${s.client.id}/erasure`,{planHash:preview.planHash,confirm:s.client.name,reason:'Client requested whole-client erasure'},h.owner);
    assert.ok(receipt.steps.some(step=>step.table==='b_efile_authorizations'&&step.count===1));
    assert.ok((await h.json(`/erasures/${receipt.id}`,undefined,h.owner)).steps.some(step=>step.table==='b_efile_authorizations'&&step.count===1));
    await h.json(door(second),undefined,h.owner,404);
    const later=await(await h.request('/api/blotter/backup',undefined,h.owner)).text();
    const redacted=snapshotRows(later,'b_efile_authorizations').find(row=>row.id===read.record.id);
    assert.equal(redacted.original_base64,null);assert.equal(redacted.intent_sha256,null);assert.equal(redacted.roster,'[]');assert.equal(redacted.file_sha256,s.sha256);assert.ok(redacted.erased_at);
    const fenced=await harness();copies.push(fenced);
    await fenced.json('/restore',{archive,journal:later,confirm:'RESTORE'},fenced.owner,409);
  } finally {await h.close();for(const copy of copies)await copy.close();}
});
