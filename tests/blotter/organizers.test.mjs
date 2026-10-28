import { test } from 'node:test';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { harness } from './harness.mjs';

import { contact, tokenOf, definition, setup, answer, portal, save } from './organizers-fixture.mjs';

test('NOTIFY-001 / PORTAL-004 / WORK-003 / MSG-001 conditional organizers: explicit multi-contact responsibility, phone resume, uploads, immutable corrections, workflow answers, versioned future work and unconfirmed carry', async () => {
 const h = await harness();
 try {
  const s = await setup(h), { job, template, a, b, assignments, organizer } = s;
  const message = await h.json('/messages/templates', { scope: 'firm', name: 'Organizer request', category: 'Organizers', subject: '{{client_name}} · {{period}}', body: 'Hello {{contact_first_name}}, complete {{work_item}} using {{portal_link}}.', attachments: [{ name: 'Instructions.txt', mime: 'text/plain', contentBase64: Buffer.from('Review all carried answers.').toString('base64') }] }, h.owner);
  const preview = await h.json(`/jobs/${job.id}/organizers/send/preview`, { revision: organizer.revision, assignments, templateId: message.id }, s.prep);
  assert.deepEqual(preview.recipients.map(r => r.to).sort(), [a.email, b.email].sort());
  assert.ok(preview.recipients.every(r => !r.missing.length && r.subject.includes('Cedar Lane') && !r.body.includes('up_')));
  const missing = await h.json(`/jobs/${job.id}/organizers/send/preview`, { revision: organizer.revision, assignments, body: '{{invoice_amount}}' }, h.owner);
  assert.ok(missing.recipients.every(r => r.missing.some(f => f.key === 'invoice_amount')));
  await h.json(`/jobs/${job.id}/organizers/send`, { revision: organizer.revision, assignments, body: '{{invoice_amount}}' }, h.owner, 409);
  const sent = await h.json(`/jobs/${job.id}/organizers/send`, { revision: organizer.revision, assignments, templateId: message.id }, s.prep), ta = tokenOf(sent.recipients.find(r => r.contactId === a.id)), tb = tokenOf(sent.recipients.find(r => r.contactId === b.id));
  assert.ok(h.mails.some(m => m.to.includes(a.email) && m.attachments?.length));
  let oa = (await h.json(portal(ta))).organizers[0], ob = (await h.json(portal(tb))).organizers[0];
  assert.deepEqual(oa.questions.map(q => q.key), ['ownership']); assert.deepEqual(ob.questions.map(q => q.key), ['bookkeeping']);
  await save(h, tb, ob, { ownership: answer('Yes') }, false, 403);
  await save(h, ta, oa, { owners: answer('Unrevealed answer') }, false, 409);
  oa = await save(h, ta, oa, { ownership: answer('Yes') });
  assert.ok(oa.questions.some(q => q.key === 'owners'));
  const resumed = await h.json(`${portal(ta)}/${encodeURIComponent(oa.id)}`, undefined, undefined, 200, { 'user-agent': 'Mobile organizer acceptance' });
  assert.equal(resumed.questions.find(q => q.key === 'ownership').value, 'Yes');
  assert.equal((await h.json(`/jobs/${job.id}`, undefined, s.prep)).answers.find(q => q.key === 'ownership').value, null, 'a saved draft is not workflow evidence');
  await save(h, ta, oa, {}, true, 409);
  oa = await save(h, ta, oa, { owners: answer('Alex and Casey now share ownership') });
  const request = oa.questions.find(q => q.key === 'owners').request;
  assert.ok(request && request.label === 'Ownership change evidence');
  assert.ok(!(await h.json(`/portal/${tb}`)).requests.some(r=>r.id===request.id),'another contact does not receive the assigned evidence request');
  await h.json(`/portal/${tb}/requests/${request.id}`, {name:'Wrong.pdf',mime:'application/pdf',contentBase64:Buffer.from('other contact').toString('base64')},undefined,404);
  const supportingBytes=Buffer.from('Signed ownership evidence'),supportingHash=createHash('sha256').update(supportingBytes).digest('hex');
  const packetBody={name:'Ownership.pdf',mime:'application/pdf',size:supportingBytes.length,sha256:supportingHash,pageCount:1};
  const packetChunk={offset:0,chunkId:'chunk-0',sha256:supportingHash,contentBase64:supportingBytes.toString('base64')};
  await h.json(`/portal/${tb}/requests/${request.id}/packet-uploads`,packetBody,undefined,404);
  const packet=await h.json(`/portal/${ta}/requests/${request.id}/packet-uploads`,packetBody);
  for(const suffix of ['', '/chunks','/complete','/cancel'])await h.json(`/portal/${tb}/packet-uploads/${packet.id}${suffix}`,suffix?suffix==='/chunks'?packetChunk:{}:undefined,undefined,404);
  await h.json(`/portal/${ta}/packet-uploads/${packet.id}/chunks`,packetChunk);
  await h.json(`/portal/${ta}/packet-uploads/${packet.id}/complete`,{});
  const inactivePacket=await h.json(`/portal/${ta}/requests/${request.id}/packet-uploads`,packetBody);
  oa = (await h.json(portal(ta))).organizers[0];
  oa = await save(h, ta, oa, {}, true);
  assert.equal((await h.json('/notifications',undefined,s.prep)).filter(n=>n.kind==='organizer_submitted'&&n.job_id===job.id).length,1,'NOTIFY-001 projects a submitted organizer once');
  ob = (await h.json(portal(tb))).organizers[0]; ob = await save(h, tb, ob, { bookkeeping: answer('Reconcile the new bank account') }, true);
  let staff = (await h.json(`/jobs/${job.id}/organizers`, undefined, s.reviewer)).organizers[0];
  for (const recipient of sent.recipients) {
   const providerMail = h.mails.find(m => m.to.includes(recipient.to) && m.attachments?.length);
   const stored = staff.deliveries.find(d => d.contact_id === recipient.contactId);
   assert.ok(providerMail && stored, 'PORTAL-004 / MSG-001 retains each templated invitation alongside its provider request');
   assert.ok(stored.subject === providerMail.subject, 'PORTAL-004 / MSG-001 keeps the exact rendered subject');
   assert.ok(stored.message === providerMail.text.replaceAll(recipient.portalUrl, `${h.origin}/portal/…`), 'PORTAL-004 / MSG-001 keeps rendered text with its capability URL redacted');
  }

  assert.deepEqual(staff.completeness.unresolved,[],'staff review sees confirmed completeness across both contacts');
  const original = structuredClone(staff.submissions[0]);
  assert.equal(original.answers.owners.value, 'Alex and Casey now share ownership');
  assert.equal((await h.json(`/jobs/${job.id}`, undefined, s.prep)).answers.find(q => q.key === 'ownership').value, 'Yes');
  await h.json(`/organizers/${organizer.id}/review`, { submissionId: original.id, note: 'Reviewed ownership evidence and changed answers' }, s.reviewer);
  oa = (await h.json(portal(ta))).organizers[0];
  oa = await save(h, ta, oa, { ownership: answer('No') }, true);
  staff = (await h.json(`/jobs/${job.id}/organizers`, undefined, h.owner)).organizers[0];
  assert.deepEqual(staff.submissions[0].answers, original.answers);
  assert.equal(staff.submissions.at(-1).answers.ownership.value, 'No');
  assert.ok(!Object.hasOwn(staff.submissions.at(-1).answers, 'owners'));
  const detail = await h.json(`/jobs/${job.id}`, undefined, s.prep);
  assert.equal(detail.answers.find(q => q.key === 'ownership').value, 'No');
  assert.equal(detail.steps.find(t => t.label === 'Inspect changed ownership').state, 'not_applicable');
  assert.equal(staff.requests.find(r => r.id === request.id).organizer_active, 0);
  assert.ok(!staff.applicable.includes('owners'),'staff identifies retained answers outside the current submitted branch');
  await h.json(`/portal/${ta}/requests/${request.id}/packet-uploads`,packetBody,undefined,404);
  for(const suffix of ['', '/chunks','/complete','/cancel'])await h.json(`/portal/${ta}/packet-uploads/${inactivePacket.id}${suffix}`,suffix?suffix==='/chunks'?packetChunk:{}:undefined,undefined,404);
  assert.ok(!(await h.json(`/portal/${ta}`)).requests.some(r=>r.id===request.id));
  await h.json(`/portal/${ta}/requests/${request.id}`,{name:'Inactive.pdf',mime:'application/pdf',contentBase64:Buffer.from('inactive').toString('base64')},undefined,404);
  assert.ok(detail.requests.find(r => r.id === request.id).files.some(f => f.name === 'Ownership.pdf'), 'deactivating the request retains its evidence');
  const supporting=detail.requests.find(r=>r.id===request.id).files.find(f=>f.name==='Ownership.pdf');
  assert.equal(await(await h.request('/api/blotter/files/'+supporting.id,undefined,s.prep)).text(),'Signed ownership evidence');
  const nextDefinition = { ...definition, version: 2, questions: definition.questions.map(q => q.key === 'bookkeeping' ? { ...q, label: 'Record bookkeeping exceptions' } : q) };
  await h.json(`/templates/${template.id}/organizer`, { expectedVersion: 1, organizer: nextDefinition }, s.reviewer);
  const versions = await h.json(`/templates/${template.id}/organizer`, undefined, s.reviewer);
  assert.equal(versions.versions.find(v => v.version === 1).definition.questions.find(q => q.key === 'bookkeeping').label, definition.questions.find(q => q.key === 'bookkeeping').label);
  assert.equal(versions.versions.find(v => v.version === 2).author, 'reviewer@example.test');
  assert.equal((await h.json(`/jobs/${job.id}/organizers`, undefined, h.owner)).organizers[0].definition.version, 1);
  const next = await s.start('2026-02-01'), no = (await h.json(`/jobs/${next.id}/organizers`, undefined, h.owner)).organizers[0];
  assert.equal(no.definition.questions.find(q => q.key === 'bookkeeping').label, 'Record bookkeeping exceptions');
  assert.equal(no.answers.ownership.value, 'No'); assert.equal(no.answers.ownership.confirmed, false);
  const nextSent = await h.json(`/jobs/${next.id}/organizers/send`, { revision: no.revision, assignments }, h.owner), nt = tokenOf(nextSent.recipients.find(r => r.contactId === a.id));
  let carried = (await h.json(portal(nt))).organizers[0];
  assert.ok(carried.questions[0].carriedFrom); await save(h, nt, carried, {}, true, 409);
  assert.equal((await h.json(`/jobs/${next.id}`, undefined, h.owner)).answers.find(q => q.key === 'ownership').value, null);
  carried = await save(h, nt, carried, { ownership: answer('No') }, true);
  assert.equal((await h.json(`/jobs/${next.id}`, undefined, h.owner)).answers.find(q => q.key === 'ownership').value, 'No');
 } finally { await h.close(); }
});

test('PORTAL-004 / WORK-008 organizers travel through starter releases, individual update choices, firm edits, job snapshots and archive restore', async () => {
 const h = await harness(); let restored;
 try {
  await h.json('/team', { email: 'reviewer@example.test', name: 'Reviewer', role: 'reviewer' }, h.owner);
  const client = await h.json('/clients', { name: 'Library organizer client', contacts: [contact('Casey Client', 'casey@example.test')] }, h.owner);
  const catalog = await h.json('/library', undefined, h.owner);
  assert.ok(catalog.templates.every(t => t.versions.at(-1).organizer?.questions.length), 'every maintained workflow includes its current organizer');
  const adopted = {};
  for (const libraryId of ['1040', 'monthly-close']) {
   const current = catalog.templates.find(t => t.id === libraryId).versions.at(-1);
   adopted[libraryId] = await h.json('/library/adopt', { libraryId, version: current.version }, h.owner);
  }
  const work = adopted['monthly-close'];
  const adoption = (await h.json('/library', undefined, h.owner)).adoptions.find(a => a.id === work.id);
  const originalDefinition = adoption.content.state.organizer;
  assert.ok(originalDefinition?.questions.length);
  const customized = { ...originalDefinition, version: originalDefinition.version + 1, questions: originalDefinition.questions.map((q, n) => n ? q : { ...q, label: 'Firm-specific question about changed records' }) };
  await h.json(`/templates/${work.templateId}/organizer`, { expectedVersion: originalDefinition.version, organizer: customized }, h.owner);
  const start = (templateId, periodStart) => h.json('/jobs', { clientId: client.id, templateId, periodStart, dueDate: '2027-04-15', dueNote: 'Firm engagement target', preparerEmail: 'owner@example.test', reviewerEmail: 'reviewer@example.test' }, h.owner);
  const oldJob = await start(work.templateId, '2026-01-01'), taxJob = await start(adopted['1040'].templateId, '2026-01-01');
  const original = (await h.json(`/jobs/${oldJob.id}/organizers`, undefined, h.owner)).organizers[0];
  assert.deepEqual(original.definition, customized);
  assert.ok((await h.json(`/jobs/${taxJob.id}/organizers`, undefined, h.owner)).organizers[0].definition.questions.length);
  const latest = catalog.templates.find(t => t.id === 'monthly-close').versions.at(-1);
  const newQuestion = { key: 'approval_evidence', label: 'Describe the approval evidence for unusual adjustments', type: 'text', required: false, options: [], when: null, request: 'Approved adjustment schedule', workflowQuestion: '' };
  const branchTask={...latest.tasks[0],label:'Review reported changes',when:{question:'changes',equals:['Yes']}};
  const release = { ...latest, version: latest.version + 1, questions:[{key:'changes',label:'Changed information',options:['Yes','No']}],tasks:[...latest.tasks,branchTask],organizer: { ...latest.organizer, version: latest.organizer.version + 1, questions: [...latest.organizer.questions.map((q, n) => n ? q : { ...q, label: 'Maintainer revised question about changed records' }), newQuestion] } };
  await h.json('/library/releases', { libraryId: 'monthly-close', source: 'Reviewed organizer library update', release }, h.owner);
  const preview = await h.json(`/library/adoptions/${work.id}/preview`, undefined, h.owner);
  const conflict = preview.changes.find(c => c.key === 'organizerQuestions:' + originalDefinition.questions[0].key), addition = preview.changes.find(c => c.key === 'organizerQuestions:' + newQuestion.key);
  assert.ok(conflict?.conflict); assert.ok(addition && !addition.conflict);
  const choices = Object.fromEntries(preview.changes.map(c => [c.key, 'ignore']));
  await h.json(`/library/adoptions/${work.id}/update`, { token: preview.token, choices: { ...choices, [conflict.key]: 'accept' } }, h.owner, 409);
  choices[addition.key] = 'accept';
  choices['workflowQuestions:changes']='accept';
  choices['tasks:review-reported-changes']='accept';
  await h.json(`/library/adoptions/${work.id}/update`, { token: preview.token, choices }, h.owner);
  await h.json(`/library/adoptions/${work.id}/update`, { token: preview.token, choices }, h.owner, 409);
  const after = (await h.json(`/templates/${work.templateId}/organizer`, undefined, h.owner)).organizer;
  assert.equal(after.questions.find(q => q.key === originalDefinition.questions[0].key).label, customized.questions[0].label);
  assert.deepEqual(after.questions.find(q => q.key === newQuestion.key), newQuestion);
  assert.deepEqual((await h.json(`/jobs/${oldJob.id}/organizers`, undefined, h.owner)).organizers[0].definition, original.definition);
  const future = await start(work.templateId, '2026-02-01');
  assert.deepEqual((await h.json(`/jobs/${future.id}/organizers`, undefined, h.owner)).organizers[0].definition, after);
  const futureOrganizer=(await h.json(`/jobs/${future.id}/organizers`,undefined,h.owner)).organizers[0], recipient=client.contacts[0];
  const invited=await h.json(`/jobs/${future.id}/organizers/send`,{revision:futureOrganizer.revision,assignments:Object.fromEntries(after.questions.map(q=>[q.key,recipient.id]))},h.owner),token=tokenOf(invited.recipients[0]);
  const form=(await h.json(portal(token))).organizers[0]; await save(h,token,form,{changes:answer('No')},true);
  const branch=await h.json(`/jobs/${future.id}`,undefined,h.owner);assert.equal(branch.answers.find(q=>q.key==='changes').value,'No');assert.equal(branch.steps.find(t=>t.label===branchTask.label).state,'not_applicable');

  const archive = await (await h.request('/api/blotter/backup', undefined, h.owner)).text();
  restored = await harness(); await restored.json('/restore', { archive, confirm:'RESTORE',acknowledge: 'erasure history unverified: supply your latest erasure journal' }, restored.owner);
  assert.deepEqual((await restored.json(`/jobs/${oldJob.id}/organizers`, undefined, restored.owner)).organizers[0].definition, original.definition);
  assert.deepEqual(await restored.json(`/templates/${work.templateId}/organizer`, undefined, restored.owner), await h.json(`/templates/${work.templateId}/organizer`, undefined, h.owner));
 } finally { await restored?.close(); await h.close(); }
});

test('BASE-001 / PORTAL-004 authority, revocation, attributed originals and portable organizer content exclude client credentials', async () => {
 const h = await harness(); let restored;
 try {
  const s = await setup(h), { organizer, job, assignments, a } = s;
  await h.json(`/jobs/${job.id}/organizers`, undefined, s.outside, 404);
  await h.json(`/jobs/${job.id}/organizers/send`, { revision: organizer.revision, assignments }, s.outside, 404);
  await h.json(`/templates/${s.template.id}/organizer`, { expectedVersion: 1, organizer: { ...definition, version: 2 } }, s.prep, 403);
  const key = await h.json('/keys', { label: 'Organizer preparation only' }, h.owner);
  await h.json(`/jobs/${job.id}/organizers/send`, { revision: organizer.revision, assignments }, '', 401, { authorization: 'Bearer ' + key.key });
  const unrelated = await h.json('/clients', { name: 'Other entity', contacts: [contact('Third Contact', 'third@example.test')] }, h.owner);
  await h.json(`/jobs/${job.id}/organizers/send`, { revision: organizer.revision, assignments: { ...assignments, ownership: unrelated.contacts[0].id } }, h.owner, 409);
  const sent = await h.json(`/jobs/${job.id}/organizers/send`, { revision: organizer.revision, assignments }, h.owner), token = tokenOf(sent.recipients.find(r => r.contactId === a.id));
  let own = (await h.json(portal(token))).organizers[0];
  await h.json(`${portal(token)}/${encodeURIComponent(own.id)}`, { revision: own.revision, answers: { ownership: answer('No') } }, undefined, 403, { origin: 'https://other.example.test' });
  const stale = own; own = await save(h, token, own, { ownership: answer('No') }, true);
  await save(h, token, stale, { ownership: answer('Yes') }, false, 409);
  const archive = await (await h.request('/api/blotter/backup', undefined, h.owner)).text();
  assert.ok(!archive.includes(token) && !archive.includes(key.key));
  const archivedRows = archive.trim().split('\n').map(JSON.parse).filter(p => p.kind === 'part').flatMap(p => p.items).filter(i => i.kind === 'row');
  assert.ok(archivedRows.some(i => i.table === 'b_organizer_submissions')); assert.ok(!archivedRows.some(i => i.table === 'b_portal_links'));
  restored = await harness(); await restored.json('/restore', { archive, confirm:'RESTORE',acknowledge: 'erasure history unverified: supply your latest erasure journal' }, restored.owner);
  const before = await h.json(`/jobs/${job.id}/organizers`, undefined, h.owner), after = await restored.json(`/jobs/${job.id}/organizers`, undefined, restored.owner);
  assert.deepEqual(after.organizers, before.organizers);
  await restored.json(portal(token), undefined, undefined, 404);
  const history = await h.json(`/clients/${s.client.id}/history`, undefined, h.owner);
  assert.ok(history.history.some(e => e.action === 'organizer.invitation_issued' && e.actor === 'owner@example.test'));
  assert.ok(history.history.some(e => e.action === 'organizer.submitted' && e.actor === 'contact:' + a.id));
  const survivor=await h.json('/clients',{name:'Cedar Lane consolidated entity'},h.owner);
  const compared=await h.json(`/clients/compare?a=${survivor.id}&b=${s.client.id}`,undefined,h.owner);
  const keep=Object.fromEntries(compared.fields.filter(f=>!f.same&&f.key!=='source').map(f=>[f.key,'merged']));
  const merged=await h.json('/clients/merge',{survivor:survivor.id,merged:s.client.id,keep,authority:'Principal confirmed same entity',contactAuthority:Object.fromEntries([s.a,s.b].map(c=>[c.id,'Principal recorded authority for the surviving entity']))},h.owner);
  assert.equal((await h.json('/jobs/'+job.id,undefined,h.owner)).client.id,survivor.id);
  assert.deepEqual((await h.json(`/jobs/${job.id}/organizers`,undefined,h.owner)).organizers,before.organizers,'organizer assignments and originals follow the moved job');
  await h.json(`/clients/merges/${merged.id}/undo`,{},h.owner);
  assert.equal((await h.json('/jobs/'+job.id,undefined,h.owner)).client.id,s.client.id);
  assert.deepEqual((await h.json(`/jobs/${job.id}/organizers`,undefined,h.owner)).organizers,before.organizers);
  const fresh = (await h.json(`/clients/${s.client.id}/contacts`, undefined, h.owner)).find(c => c.id === a.id);
  await h.json(`/clients/${s.client.id}/contacts`, { id: a.id, revision: fresh.revision, portal: false }, h.owner);
  await h.json(portal(token), undefined, undefined, 404);
  await save(h, token, own, { ownership: answer('Yes') }, false, 404);
  const withdrawn = await h.json(`/team`, { email: 'prep@example.test', name: 'Former preparer', role: 'preparer', active: false }, h.owner);
  assert.ok(withdrawn); await h.json(`/jobs/${job.id}/organizers`, undefined, s.prep, 401);
 } finally { await restored?.close(); await h.close(); }
});

test('BASE-001 / PORTAL-004 typed owner erasure removes answer content and derived carry, preserves authors and sign-off, and refuses stale archive restore', async () => {
 const h = await harness(); let target;
 try {
  const s = await setup(h), { organizer, job, assignments, a, b } = s;
  const sent = await h.json(`/jobs/${job.id}/organizers/send`, { revision: organizer.revision, assignments }, h.owner);
  const ta = tokenOf(sent.recipients.find(r => r.contactId === a.id)), tb = tokenOf(sent.recipients.find(r => r.contactId === b.id));
  let own = (await h.json(portal(ta))).organizers[0];
  own = await save(h, ta, own, { ownership: answer('Yes') });
  own = await save(h, ta, own, { owners: answer('Personal ownership information to erase') }, true);
  const book = (await h.json(portal(tb))).organizers[0];
  await save(h, tb, book, { bookkeeping: answer('Private source bookkeeping notes') }, true);
  let source = (await h.json(`/jobs/${job.id}/organizers`, undefined, h.owner)).organizers[0];
  await h.json(`/organizers/${organizer.id}/review`, { submissionId: source.submissions[0].id, note: 'Personal ownership information to erase' }, s.reviewer);
  // A review completion is retained; erasing answer content never rewrites it.
  for (const r of (await h.json(`/jobs/${job.id}`, undefined, s.prep)).requests) {
   await h.json(`/requests/${r.id}/files`, { name: 'Retained evidence.txt', mime: 'text/plain', contentBase64: Buffer.from('Independent supporting file').toString('base64') }, s.prep);
   await h.json(`/requests/${r.id}/decide`, { decision: 'accept' }, s.prep);
  }
  for (const step of (await h.json(`/jobs/${job.id}`, undefined, s.prep)).steps) await h.json(`/jobs/${job.id}/steps`, { ordinal: step.ordinal, done: true }, s.prep);
  let detail = await h.json(`/jobs/${job.id}`, undefined, s.prep);
  detail = await h.json(`/jobs/${job.id}/submit`, { revision: detail.job.revision }, s.prep);
  detail = await h.json(`/jobs/${job.id}/review`, { revision: detail.job.revision, decision: 'signoff', note: 'Independent work review complete' }, s.reviewer);
  const signoff = structuredClone(detail.job);
  const nextJob = await s.start('2026-02-01');
  const nextOrganizer = (await h.json(`/jobs/${nextJob.id}/organizers`, undefined, h.owner)).organizers[0];
  assert.equal(nextOrganizer.answers.owners.value, 'Personal ownership information to erase');
  const nextSent = await h.json(`/jobs/${nextJob.id}/organizers/send`, { revision: nextOrganizer.revision, assignments }, h.owner), nt = tokenOf(nextSent.recipients.find(r => r.contactId === a.id));
  const pendingCarry = (await h.json(portal(nt))).organizers[0];
  const oldArchive = await (await h.request('/api/blotter/backup', undefined, h.owner)).text();
  source = (await h.json(`/jobs/${job.id}/organizers`, undefined, h.owner)).organizers[0];
  const body = { revision: source.revision, confirm: source.definition.name, reason: 'Principal approved erasure of organizer answer content' };
  await h.json(`/organizers/${organizer.id}/erase`, body, s.reviewer, 403);
  await h.json(`/organizers/${organizer.id}/erase`, { ...body, confirm: 'wrong name' }, h.owner, 400);
  await h.json(`/organizers/${organizer.id}/erase`, { ...body, reason: '' }, h.owner, 400);
  await h.json(`/organizers/${organizer.id}/erase`, body, h.owner);
  await h.json(`/organizers/${organizer.id}/erase`, body, h.owner, 409);
  const erased = (await h.json(`/jobs/${job.id}/organizers`, undefined, h.owner)).organizers[0];
  assert.ok(erased.erased_at && erased.erased_by === 'owner@example.test');
  assert.ok(Object.values(erased.answers).every(a => a.value === '' && !a.confirmed));
  assert.ok(erased.submissions.every(s => s.answers === null && s.erased_at && s.review_note === null));
  assert.deepEqual(erased.submissions.map(s => [s.id, s.contact_id, s.submitted_at, s.reviewed_by, s.reviewed_at]), source.submissions.map(s => [s.id, s.contact_id, s.submitted_at, s.reviewed_by, s.reviewed_at]));
  assert.deepEqual((await h.json(`/jobs/${job.id}`, undefined, h.owner)).job, signoff);
  assert.equal((await h.json(`/jobs/${job.id}`, undefined, h.owner)).answers.find(q => q.key === 'ownership').value, null);
  assert.ok((await h.json(`/jobs/${job.id}`, undefined, h.owner)).requests.every(r => r.files.length), 'supporting files retain their separate erasure custody');
  const future = (await h.json(`/jobs/${nextJob.id}/organizers`, undefined, h.owner)).organizers[0];
  assert.equal(future.answers.owners.value, ''); assert.equal(future.answers.ownership.value, '');
  await save(h, nt, pendingCarry, { ownership: answer('Yes') }, false, 409);
  const latest = await (await h.request('/api/blotter/backup', undefined, h.owner)).text();
  const history = await h.json(`/clients/${s.client.id}/history`, undefined, h.owner);
  assert.ok(history.history.some(e => e.action === 'organizer.erased' && e.actor === 'owner@example.test'));
  target = await harness();
  await target.json('/restore', { archive: oldArchive, journal: latest, confirm: 'RESTORE' }, target.owner, 409);
  await target.json('/restore', { archive: latest, confirm:'RESTORE',acknowledge: 'erasure history unverified: supply your latest erasure journal' }, target.owner);
  const restored = (await target.json(`/jobs/${job.id}/organizers`, undefined, target.owner)).organizers[0];
  assert.ok(restored.erased_at); assert.ok(restored.submissions.every(s => s.answers === null));
  assert.equal((await target.json(`/jobs/${nextJob.id}/organizers`, undefined, target.owner)).organizers[0].answers.owners.value, '');
  assert.deepEqual((await target.json(`/jobs/${job.id}`, undefined, target.owner)).job, signoff);
 } finally { await target?.close(); await h.close(); }
});
