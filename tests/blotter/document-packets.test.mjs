import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { harness } from './harness.mjs';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const b64 = bytes => Buffer.from(bytes).toString('base64');
const chunkBytes = 256 * 1024;
const person = (name, email) => ({ name, email, roles: ['primary'], authorized: true, portal: true, requestConsent: true, emailConsent: true });

import { accountingPacket } from './document-packet-fixture.mjs';
async function fixture(h) {
  for (const email of ['prep@example.test', 'outside@example.test']) { await h.json('/team', { email, name: email, role: 'preparer' }, h.owner); await h.json('/team/invite', { email }, h.owner); }
  const prep = await h.login('prep@example.test'), outside = await h.login('outside@example.test');
  const client = await h.json('/clients', { name: 'Chen Holdings', contacts: [person('Mia Chen', 'mia@example.test'), person('Luis Chen', 'luis@example.test')] }, h.owner);
  const template = await h.json('/templates', { name: 'Quarterly close packet', recurrence: 'quarterly', steps: 'Reconcile', requests: 'Bank statements and receipts\nMissing tax evidence' }, h.owner);
  const job = await h.json('/jobs', { clientId: client.id, templateId: template.id, periodStart: '2026-07-01', dueDate: '2026-11-01', dueNote: 'Agreed with client', preparerEmail: 'prep@example.test', reviewerEmail: 'owner@example.test' }, h.owner);
  const request = (await h.json(`/jobs/${job.id}`, undefined, prep)).requests[0];
  return { client, job, request, prep, outside };
}
const start = (h, f, bytes, extra = {}) => h.json(`/requests/${f.request.id}/packet-uploads`, { name: 'Q3 bank receipts.pdf', mime: 'application/pdf', size: bytes.length, sha256: hash(bytes), pageCount: 24, source: 'Secure email from bank', author: 'Mia Chen', ...extra }, f.prep);
const chunk = (bytes, offset) => { const b = bytes.subarray(offset, offset + chunkBytes); return { chunkId: 'chunk-' + offset, offset, sha256: hash(b), contentBase64: b64(b) }; };
async function finish(h, f, state, bytes) {
  while (state.receivedBytes < bytes.length) state = await h.json(`/packet-uploads/${state.id}/chunks`, chunk(bytes, state.receivedBytes), f.prep);
  return h.json(`/packet-uploads/${state.id}/complete`, {}, f.prep);
}

test('DOC-005 / BASE-001 realistic multi-page packets resume exactly; corrected originals, internal page annotations and review, client/period folders and metadata search preserve permissions and exact DOC-002 grants', async () => {
  const h = await harness(); let restored;
  try {
    const f = await fixture(h), bytes = accountingPacket(), corrected = accountingPacket(true);
    assert.ok(bytes.length > 1048576); assert.equal(bytes.subarray(0, 8).toString(), '%PDF-1.4');
    let u = await start(h, f, bytes);
    assert.ok(u.limits.maxBytes >= bytes.length); assert.ok(u.limits.chunkBytes <= chunkBytes);
    const first = chunk(bytes, 0);
    u = await h.json(`/packet-uploads/${u.id}/chunks`, first, f.prep);
    assert.equal(u.receivedBytes, chunkBytes);
    // Simulated interruption: no next request is sent. A fresh session discovers
    // the upload and continues using the public persisted status, without a retry loop.
    const resumedSession = await h.login('prep@example.test');
    const pending = await h.json(`/jobs/${f.job.id}/packet-uploads`, undefined, resumedSession);
    assert.equal(pending[0].id, u.id); assert.equal(pending[0].receivedBytes, chunkBytes);
    assert.equal((await h.json(`/packet-uploads/${u.id}/chunks`, first, resumedSession)).receivedBytes, chunkBytes);
    const bad = { ...first, contentBase64: b64(Buffer.alloc(chunkBytes, 1)), sha256: hash(Buffer.alloc(chunkBytes, 1)) };
    await h.json(`/packet-uploads/${u.id}/chunks`, bad, f.prep, 409);
    await h.json(`/packet-uploads/${u.id}/complete`, {}, f.prep, 409);
    u = await finish(h, f, await h.json(`/packet-uploads/${u.id}`, undefined, resumedSession), bytes);
    assert.equal((await h.json(`/packet-uploads/${u.id}/complete`, {}, f.prep)).fileId, u.fileId);
    const downloaded = await h.request(`/api/blotter/documents/${u.fileId}/file`, undefined, f.prep);
    assert.equal(downloaded.status, 200); assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()), bytes);
    const contact = f.client.contacts[0];
    let access = await h.json(`/documents/${u.fileId}/access`, undefined, h.owner); assert.equal(access.visibility, 'internal');
    access = await h.json(`/documents/${u.fileId}/access`, { revision: access.revision, visibility: 'contacts', contactIds: [contact.id] }, h.owner);
    const share = await h.json(`/documents/${u.fileId}/shares`, { revision: access.revision, contactId: contact.id, days: 7 }, h.owner);
    assert.deepEqual(Buffer.from(await (await h.request(`/api/blotter/shared-files/${share.token}`)).arrayBuffer()), bytes);
    const v2 = await finish(h, f, await start(h, f, corrected, { name: 'Q3 corrected receipts.pdf', previousFileId: u.fileId }), corrected);
    const newAccess = await h.json(`/documents/${v2.fileId}/access`, undefined, h.owner);
    assert.deepEqual(newAccess.contacts.filter(c => c.granted).map(c => c.id), [contact.id]); assert.equal(newAccess.shares.length, 0);
    assert.ok(newAccess.history.some(e => e.action === 'file.access_inherited'));
    let catalog = await h.json(`/jobs/${f.job.id}/document-packets`, undefined, f.prep), files = catalog.folders[0].files;
    assert.equal(catalog.total, 2); assert.equal(files[0].client_name, 'Chen Holdings');
    const one = files.find(x => x.file_id === u.fileId), two = files.find(x => x.file_id === v2.fileId);
    assert.equal(two.previous_file_id, one.file_id); assert.equal(two.packet_id, one.packet_id); assert.equal(two.version, one.version + 1); assert.equal(two.review_status, 'unreviewed');
    assert.equal(two.original_size, corrected.length); assert.equal(two.page_count, 24); assert.equal(two.author, 'Mia Chen'); assert.ok(two.uploaded_at);
    const indexed=await h.json('/search?q=Office%20supplier&type=document',undefined,f.prep);assert.ok(indexed.results.some(r=>r.open.fileId===v2.fileId),'SEARCH-001 indexes real packet text, not its storage manifest');assert.deepEqual((await h.json('/search?q=Office%20supplier&type=document',undefined,f.outside)).results,[]);
    await h.json(`/document-packets/${u.fileId}/annotations`, { page: 7, note: 'Receipt total differs from bank entry; corrected in next version' }, f.prep);
    await h.json(`/document-packets/${u.fileId}/review`, { revision: one.revision, status: 'returned', note: 'Correct receipt total on page seven' }, f.prep);
    await h.json(`/document-packets/${u.fileId}/review`, { revision: one.revision, status: 'accepted' }, f.prep, 409);
    await h.json(`/document-packets/${v2.fileId}/review`, { revision: two.revision, status: 'accepted', note: 'Matched corrected statement' }, h.owner);
    assert.equal((await h.json(`/document-packets/${u.fileId}/annotations`, undefined, f.prep)).annotations[0].page, 7);
    assert.equal((await h.json(`/document-packets/${v2.fileId}/annotations`, undefined, f.prep)).annotations.length, 0);
    const clientCatalog = await h.json(`/clients/${f.client.id}/document-packets`, undefined, f.prep);
    assert.equal(clientCatalog.total, 2); assert.equal(clientCatalog.folders[0].jobId, f.job.id); assert.ok(clientCatalog.folders[0].period);
    for (const q of ['corrected receipts', 'secure email', 'Mia Chen', 'receipt total differs', 'returned']) assert.ok((await h.json(`/clients/${f.client.id}/document-packets?q=${encodeURIComponent(q)}`, undefined, f.prep)).total > 0, q);
    for (const fileId of [u.fileId, v2.fileId]) {
      const original = fileId === u.fileId ? bytes : corrected;
      assert.deepEqual(Buffer.from(await (await h.request(`/api/blotter/files/${fileId}`, undefined, f.prep)).arrayBuffer()), original);
      assert.equal((await h.request(`/api/blotter/files/${fileId}`, undefined, f.outside)).status, 404);
      await h.json(`/document-packets/${fileId}/annotations`, { page: 1, note: 'Denied' }, f.outside, 404);
    }
    await h.json(`/jobs/${f.job.id}/document-packets`, undefined, f.outside, 404);
    await h.json(`/clients/${f.client.id}/document-packets`, undefined, f.outside, 404);
    await h.json(`/packet-uploads/${u.id}`, undefined, f.outside, 404);
    const portal = await h.json(`/jobs/${f.job.id}/reminders`, { contactId: contact.id }, h.owner), token = new URL(portal.portalUrl).pathname.split('/').at(-1);
    for (const fileId of [u.fileId, v2.fileId]) assert.equal((await h.request(`/api/blotter/portal/${token}/files/${fileId}`)).status, 200);
    const other = await h.json(`/jobs/${f.job.id}/reminders`, { contactId: f.client.contacts[1].id }, h.owner), otherToken = new URL(other.portalUrl).pathname.split('/').at(-1);
    assert.equal((await h.request(`/api/blotter/portal/${otherToken}/files/${v2.fileId}`)).status, 404);
    const staged = await start(h, f, bytes); await h.json(`/packet-uploads/${staged.id}/chunks`, first, f.prep);
    const archive = await (await h.request('/api/blotter/backup', undefined, h.owner)).text();
    assert.ok(!archive.includes(staged.id));
    restored = await harness(); await restored.json('/restore', { archive, confirm:'RESTORE',acknowledge: 'erasure history unverified: supply your latest erasure journal' }, restored.owner);
    assert.deepEqual(Buffer.from(await (await restored.request(`/api/blotter/files/${v2.fileId}`, undefined, restored.owner)).arrayBuffer()), corrected);
    assert.equal((await restored.json(`/clients/${f.client.id}/document-packets`, undefined, restored.owner)).total, 2);
    await h.json(`/files/${u.fileId}/erase`, { confirm: 'Q3 bank receipts.pdf', reason: 'Client retention request' }, h.owner);
    assert.equal((await h.request(`/api/blotter/files/${u.fileId}`, undefined, f.prep)).status, 404);
    await h.json(`/packet-uploads/${staged.id}`, undefined, f.prep, 404);
    assert.deepEqual(Buffer.from(await (await h.request(`/api/blotter/files/${v2.fileId}`, undefined, f.prep)).arrayBuffer()), corrected);
    const afterErase = await (await h.request('/api/blotter/backup', undefined, h.owner)).text();
    const oldParts = archive.trim().split('\n').map(JSON.parse).filter(p => p.kind === 'part').flatMap(p => p.items).filter(i => i.kind === 'row');
    const erasedParts = afterErase.trim().split('\n').map(JSON.parse).filter(p => p.kind === 'part').flatMap(p => p.items).filter(i => i.kind === 'row');
    assert.ok(oldParts.some(i => i.table === 'b_document_chunks')); assert.ok(!erasedParts.some(i => i.table === 'b_document_upload_chunks'));
    assert.ok(!erasedParts.some(i => i.table === 'b_document_chunks' && i.row.file_id === u.fileId));
    assert.ok(erasedParts.some(i => i.table === 'b_document_chunks' && i.row.file_id === v2.fileId));
    await restored.close(); restored = await harness();
    const stale = await restored.json('/restore', { archive, journal: afterErase, confirm: 'RESTORE' }, restored.owner, 409); assert.match(stale.error, /erasure/);
  } finally { await restored?.close(); await h.close(); }
});

test('DOC-001 / BASE-001 published packet limits, offset/hash failures, cancellation and invalid page/review input leave recoverable originals', async () => {
  const h = await harness();
  try {
    const f = await fixture(h), bytes = accountingPacket();
    await h.json(`/requests/${f.request.id}/packet-uploads`, { name: 'Too large.pdf', mime: 'application/pdf', size: 20 * 1048576 + 1, sha256: hash(bytes), pageCount: 24, source: 'Bank', author: 'Mia' }, f.prep, 400);
    let u = await start(h, f, bytes);
    await h.json(`/packet-uploads/${u.id}/chunks`, chunk(bytes, chunkBytes), f.prep, 409);
    await h.json(`/packet-uploads/${u.id}/chunks`, { ...chunk(bytes, 0), sha256: '0'.repeat(64) }, f.prep, 409);
    assert.equal((await h.json(`/packet-uploads/${u.id}`, undefined, f.prep)).receivedBytes, 0);
    await h.json(`/packet-uploads/${u.id}/cancel`, {}, f.prep);
    await h.json(`/packet-uploads/${u.id}`, undefined, f.prep, 404);
    u = await finish(h, f, await start(h, f, bytes), bytes);
    await h.json(`/document-packets/${u.fileId}/annotations`, { page: 25, note: 'Outside the original' }, f.prep, 400);
    const c = await h.json(`/jobs/${f.job.id}/document-packets`, undefined, f.prep), file = c.folders[0].files[0];
    await h.json(`/document-packets/${u.fileId}/review`, { revision: file.revision, status: 'returned' }, f.prep, 400);
    assert.deepEqual(Buffer.from(await (await h.request(`/api/blotter/files/${u.fileId}`, undefined, f.prep)).arrayBuffer()), bytes);
    const wrong = await start(h, f, Buffer.from('short original'), { sha256: hash(Buffer.from('different bytes')) });
    await h.json(`/packet-uploads/${wrong.id}/chunks`, chunk(Buffer.from('short original'), 0), f.prep);
    const result = await h.json(`/packet-uploads/${wrong.id}/complete`, {}, f.prep, 409); assert.match(result.error, /Cancel this upload/);
    await h.json(`/packet-uploads/${wrong.id}/cancel`, {}, f.prep);
    const expires = await start(h, f, bytes); await h.json(`/packet-uploads/${expires.id}/chunks`, chunk(bytes, 0), f.prep);
    await h.scheduled(new Date(Date.now() + 8 * 86400000).toISOString());
    await h.json(`/packet-uploads/${expires.id}`, undefined, f.prep, 404);
    assert.deepEqual(Buffer.from(await (await h.request(`/api/blotter/files/${u.fileId}`, undefined, f.prep)).arrayBuffer()), bytes);
    const revoked = await start(h, f, bytes), entity = await h.json(`/clients/${f.client.id}/detail`, undefined, h.owner);
    await h.json(`/clients/${f.client.id}/lifecycle`, { lifecycle: 'archived', revision: entity.revision }, h.owner);
    await h.json(`/packet-uploads/${revoked.id}/chunks`, chunk(bytes, 0), f.prep, 409);
    assert.equal((await h.json(`/jobs/${f.job.id}/document-packets`, undefined, f.prep)).total, 1);
  } finally { await h.close(); }
});

test('DOC-004 / BASE-001 legacy originals join client folders and corrected version grants without invented metadata; named-task readers cannot annotate or review', async () => {
  const h = await harness();
  try {
    const f = await fixture(h), original = accountingPacket(false, 3), corrected = accountingPacket(true, 3);
    const legacy = await h.json(`/requests/${f.request.id}/files`, { name: 'Legacy bank packet.pdf', mime: 'application/pdf', contentBase64: b64(original) }, f.prep);
    let catalog = await h.json(`/clients/${f.client.id}/document-packets`, undefined, f.prep), file = catalog.folders[0].files.find(x => x.file_id === legacy.id);
    assert.ok(file); assert.equal(file.page_count, null); assert.equal(file.author, null); assert.equal(file.original_size, original.length);
    const access = await h.json(`/documents/${legacy.id}/access`, { revision: null, visibility: 'contacts', contactIds: [f.client.contacts[0].id] }, h.owner);
    const v2 = await finish(h, f, await start(h, f, corrected, { name: 'Corrected legacy packet.pdf', pageCount: 3, previousFileId: legacy.id }), corrected);
    const granted = await h.json(`/documents/${v2.fileId}/access`, undefined, h.owner);
    assert.deepEqual(granted.contacts.filter(c => c.granted).map(c => c.id), access.contacts.filter(c => c.granted).map(c => c.id));
    catalog = await h.json(`/clients/${f.client.id}/document-packets`, undefined, f.prep);
    file = catalog.folders[0].files.find(x => x.file_id === legacy.id);
    assert.equal(file.page_count, null); assert.equal(file.version, 1);
    const newer = catalog.folders[0].files.find(x => x.file_id === v2.fileId); assert.equal(newer.previous_file_id, legacy.id); assert.equal(newer.version, 2);
    await h.json(`/document-packets/${legacy.id}/annotations`, { page: 2, note: 'Legacy page evidence' }, f.prep, 400);
    await h.json(`/document-packets/${legacy.id}/annotations`, { pageCount: 3, page: 2, note: 'Legacy page evidence' }, f.prep);
    assert.equal((await h.json(`/document-packets/${legacy.id}/annotations`, undefined, f.prep)).pageCount, 3);
    assert.deepEqual(Buffer.from(await (await h.request(`/api/blotter/files/${legacy.id}`, undefined, f.prep)).arrayBuffer()), original);
    const template = await h.json('/templates', { name: 'Named-task reader scope', recurrence: 'annual', tasks: [{ label: 'Assigned evidence task', assignee: 'outside@example.test' }], requests: 'Evidence' }, h.owner);
    const job = await h.json('/jobs', { clientId: f.client.id, templateId: template.id, periodStart: '2026-01-01', dueDate: '2027-04-15', dueNote: 'Agreed', preparerEmail: 'prep@example.test', reviewerEmail: 'owner@example.test' }, h.owner);
    const request = (await h.json(`/jobs/${job.id}`, undefined, f.prep)).requests[0];
    const attachment = await h.json(`/requests/${request.id}/files`, { name: 'Read permitted.pdf', mime: 'application/pdf', contentBase64: b64(original) }, f.prep);
    const readable = await h.json(`/jobs/${job.id}/document-packets`, undefined, f.outside); assert.equal(readable.total, 1); assert.equal(readable.folders[0].files[0].can_edit, 0);
    await h.json(`/document-packets/${attachment.id}/annotations`, undefined, f.outside);
    await h.json(`/document-packets/${attachment.id}/annotations`, { pageCount: 3, page: 1, note: 'No widening' }, f.outside, 404);
    await h.json(`/document-packets/${attachment.id}/review`, { revision: null, status: 'accepted' }, f.outside, 404);
    const doc=(name)=>({name,mime:'application/pdf',contentBase64:b64(original)});
    const taskTemplate=await h.json('/templates',{name:'Task attachment catalog',recurrence:'annual',tasks:[{label:'File task evidence',assignee:'outside@example.test',requiresAttachment:true}],requests:'Evidence'},h.owner);
    const taskJob=await h.json('/jobs',{clientId:f.client.id,templateId:taskTemplate.id,periodStart:'2026-01-01',dueDate:'2027-04-15',dueNote:'Agreed',preparerEmail:'prep@example.test',reviewerEmail:'owner@example.test'},h.owner);
    await h.json(`/jobs/${taskJob.id}/steps`,{ordinal:1,done:true,attachment:doc('Task evidence.pdf')},f.outside);
    const expense=await h.json(`/jobs/${f.job.id}/expenses`,{kind:'filing_fee',date:'2026-10-19',description:'Filing receipt',costCents:2500,billable:true,receipt:doc('Filing receipt.pdf')},f.prep);
    const deliverable=await h.json(`/jobs/${f.job.id}/deliverables`,{title:'Final client packet',...doc('Client deliverable.pdf'),contactId:f.client.contacts[0].id},f.prep);
    const notice=await h.json('/notices',{fileId:legacy.id,agency:'IRS',jurisdiction:'federal',noticeType:'CP14',taxPeriod:'2025',noticeDate:'2026-10-01',responseDue:'2026-11-20',assigneeEmail:'outside@example.test'},h.owner);
    const event=await h.json(`/notices/${notice.notice.id}/events`,{kind:'transcript',note:'Account evidence',file:doc('Notice transcript.pdf')},f.outside);
    const all=(await h.json(`/clients/${f.client.id}/document-packets`,undefined,h.owner)).folders.flatMap(x=>x.files);
    for(const kind of ['file','task','expense','deliverable','notice'])assert.ok(all.some(x=>x.kind===kind),kind);
    const expected=[['expense:'+expense.id,'job-expenses'],['deliverable:'+deliverable.id,'job-deliverables'],['notice:'+event.id,'notice-'],['task:'+taskJob.id+':1','job-checklist']];
    for(const [ref,section]of expected){const entry=all.find(x=>x.file_id===ref);assert.ok(entry);assert.match(entry.sourceHref,new RegExp(section));assert.ok(entry.uploaded_by&&entry.uploaded_at);assert.deepEqual(Buffer.from(await(await h.request('/api/blotter/documents/'+encodeURIComponent(ref)+'/file',undefined,h.owner)).arrayBuffer()),original);}
    const noticeOnly=(await h.json(`/jobs/${f.job.id}/document-packets`,undefined,f.outside)).folders.flatMap(x=>x.files);
    assert.deepEqual(noticeOnly.map(x=>x.file_id),['notice:'+event.id],'A notice assignee sees its own evidence, not other job files, receipts or deliverables');
    const noticeAccess=await h.json('/documents/'+encodeURIComponent('notice:'+event.id)+'/access',{revision:null,visibility:'contacts',contactIds:[f.client.contacts[0].id]},h.owner);
    assert.equal((await h.json(`/clients/${f.client.id}/document-packets?q=Notice%20transcript`,undefined,h.owner)).folders[0].files[0].visibility,noticeAccess.visibility);

  } finally { await h.close(); }
});
