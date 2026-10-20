import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, randomBytes } from 'node:crypto';
import { harness } from './harness.mjs';

const key = randomBytes(24), contact = (name, email, extra = {}) => ({ name, email, roles: ['primary'], authorized: true, portal: true, requestConsent: true, emailConsent: true, ...extra });
// The provider edge is faked: events are signed exactly as Resend (Svix) signs them.
const signed = (event, id) => {
  const ts = String(Math.floor(Date.now() / 1000));
  return { 'svix-id': id, 'svix-timestamp': ts, 'svix-signature': 'v1,' + createHmac('sha256', key).update(`${id}.${ts}.${JSON.stringify(event)}`).digest('base64') };
};
const firm = { name: 'Cardinal Tax & Books', ein: '12-3456789', entity: 'LLC', address: '100 Main Street', city: 'Raleigh', state: 'NC', zip: '27601', fiscalYearEnd: '12-31', services: 'Individual tax', currency: 'USD', timeZone: 'America/New_York', notificationStart: '08:00', notificationEnd: '18:00', calendars: [] };

test('MSG-002 / BASE-001 bulk engagement and marketing messages: segment preview, exclusions, approval, throttled rechecked dispatch, provider events, unsubscribe, corrections and restore hold', async () => {
  const h = await harness({ bindings: { MAIL_WEBHOOK_SECRET: 'whsec_' + key.toString('base64') } }); let restored;
  try {
    for (const [email, role] of [['reviewer@example.test', 'reviewer'], ['prep@example.test', 'preparer']]) { await h.json('/team', { email, name: email.split('@')[0], role }, h.owner); await h.json('/team/invite', { email }, h.owner); }
    const review = await h.login('reviewer@example.test'), prep = await h.login('prep@example.test');
    await h.json('/firm', { name: 'Cardinal Tax & Books' }, h.owner);
    const t = await h.json('/templates', { name: '1040', recurrence: 'annual', steps: 'Prepare return', requests: 'W-2' }, h.owner), workTypeId = 'wt-' + t.id;
    const clients = [];
    for (let n = 0; n < 40; n++) {
      const tag = String(n).padStart(2, '0');
      clients.push(await h.json('/clients', { name: `Client ${tag}`, entityType: 'individual', contacts: [n === 34 ? { name: 'No Address', roles: ['primary'], authorized: true } : contact(`Pat${tag} Lee`, `p${tag}@example.test`)] }, h.owner));
      const rule = await h.json('/rules', { clientId: clients[n].id, templateId: t.id, firstPeriod: '2026-01-01', endPeriod: '2026-01-01', leadMonths: 0, dueDays: 100, dueNote: 'Firm target', preparerEmail: 'owner@example.test', reviewerEmail: 'reviewer@example.test' }, h.owner);
      // Three 1040 clients have no current engagement: their rules are paused.
      if (n >= 37) await h.json(`/rules/${rule.id}/status`, { status: 'paused' }, h.owner);
    }
    for (const n of [35, 36]) { const c = clients[n].contacts[0]; await h.json(`/clients/${clients[n].id}/contacts`, { id: c.id, revision: c.revision, emailConsent: false }, h.owner); }
    // Client 21 also lists client 00's address as its tax contact: marketing goes once per address.
    const shared = await h.json(`/clients/${clients[21].id}/contacts`, contact('Pat00 Lee', 'p00@example.test', { roles: ['tax'] }), h.owner);

    // Template classes (MSG-001 carrier): marketing refuses engagement placeholders; only the principal changes a class.
    await h.json('/messages/templates', { scope: 'firm', name: 'Bad newsletter', class: 'marketing', subject: 'News', body: 'Due {{due_date}}' }, h.owner, 409);
    const kickoff = await h.json('/messages/templates', { scope: 'firm', name: 'Kickoff', subject: '{{work_type}} kickoff for {{client_name}}', body: 'Your {{work_type}} engagement with {{firm_name}} starts now.\nHi {{contact_first_name}}, your organizer follows.' }, h.owner);
    const news = await h.json('/messages/templates', { scope: 'firm', name: 'Spring newsletter', class: 'marketing', subject: 'News from {{firm_name}}', body: 'Hi {{contact_first_name}},\nOur spring seminar is open to {{client_name}}.' }, h.owner);
    assert.equal(kickoff.message_class, 'engagement'); assert.equal(news.message_class, 'marketing');
    const personal = await h.json('/messages/templates', { scope: 'personal', name: 'Mine', subject: '{{work_type}} note', body: '{{work_type}} update' }, review);
    await h.json(`/messages/templates/${personal.id}`, { subject: 'Offer', body: 'Offer', class: 'marketing' }, review, 403);

    // Engagement batch: preview, refusals and the six listed exclusions.
    const engagement = { class: 'engagement', templateId: kickoff.id, workTypeId, reason: 'Tax-season kickoff for active 1040 engagements', chunkSize: 20 };
    await h.json('/bulk-messages/preview', { ...engagement, templateId: news.id, idempotencyKey: 'x1' }, h.owner, 409);
    await h.json('/bulk-messages/preview', { ...engagement, idempotencyKey: 'x2' }, prep, 403);
    const preview = await h.json('/bulk-messages/preview', { ...engagement, idempotencyKey: 'kick-1' }, review);
    assert.equal(preview.recipients.length, 34); assert.equal(preview.samples.length, 3);
    assert.equal(preview.samples[0].subject, '1040 kickoff for Client 00'); assert.match(preview.samples[0].body, /Hi Pat00, your organizer follows/);
    assert.deepEqual(preview.exclusions.map(x => `${x.client}: ${x.reason}`).sort(), ['Client 34: no email address', 'Client 35: email consent withdrawn', 'Client 36: email consent withdrawn',
      ...[37, 38, 39].map(n => `Client ${n}: no current engagement basis (open job or active recurring rule)`)]);
    assert.ok(preview.recipients.every(r => r.basis === 'active recurring rule: 1040' && r.status === 'pending'));
    // Resubmitting the preview (even asking for another class) returns the same batch: class is fixed at preview.
    const again = await h.json('/bulk-messages/preview', { ...engagement, class: 'marketing', topic: 'tax', idempotencyKey: 'kick-1' }, h.owner);
    assert.equal(again.batch.id, preview.batch.id); assert.equal(again.batch.class, 'engagement'); assert.ok(again.resubmitted);

    // Withdraw one more contact's email consent before dispatch: that recipient is held, never sent or retried.
    const c10 = (await h.json(`/clients/${clients[10].id}/contacts`, undefined, h.owner))[0];
    await h.json(`/clients/${clients[10].id}/contacts`, { id: c10.id, revision: c10.revision, emailConsent: false }, h.owner);
    await h.json(`/bulk-messages/${preview.batch.id}/schedule`, { fingerprint: 'stale' }, review, 409);
    await h.json(`/bulk-messages/${preview.batch.id}/schedule`, { fingerprint: preview.batch.fingerprint }, review);
    const before = h.mails.length;
    await h.scheduled(Date.now() + 60_000);
    let detail = await h.json(`/bulk-messages/${preview.batch.id}`, undefined, h.owner);
    assert.equal(h.mails.length - before, 19, 'The first throttled chunk claims 20 recipients and holds one');
    assert.equal(detail.recipients.find(r => r.client_id === clients[10].id).status, 'held');
    assert.match(detail.recipients.find(r => r.client_id === clients[10].id).held_reason, /email consent withdrawn/);
    assert.equal(detail.batch.status, 'sending');
    detail = await h.json(`/bulk-messages/${preview.batch.id}/run`, {}, review);
    assert.equal(detail.batch.status, 'sent'); assert.equal(detail.counts.accepted, 33); assert.equal(detail.counts.held, 1);
    const kickoffMails = h.mails.slice(before);
    assert.equal(kickoffMails.length, 33); assert.ok(kickoffMails.every(m => !m.headers?.['List-Unsubscribe']));
    assert.equal(new Set(kickoffMails.map(m => m.to[0])).size, 33);
    // Resubmitting the schedule and running again sends no duplicate.
    assert.ok((await h.json(`/bulk-messages/${preview.batch.id}/schedule`, { fingerprint: preview.batch.fingerprint }, review)).resubmitted);
    await h.json(`/bulk-messages/${preview.batch.id}/run`, {}, review); await h.scheduled(Date.now() + 120_000);
    assert.equal(h.mails.length - before, 33);

    // Provider events: signed delivery and hard bounce, once each, filed to that client's history.
    const sent0 = detail.recipients.find(r => r.client_id === clients[0].id), sent1 = detail.recipients.find(r => r.client_id === clients[1].id);
    const delivered = { type: 'email.delivered', created_at: new Date().toISOString(), data: { email_id: sent0.provider_message_id, to: ['p00@example.test'] } };
    const bounce = { type: 'email.bounced', created_at: new Date().toISOString(), data: { email_id: sent1.provider_message_id, to: ['p01@example.test'], bounce: { type: 'Permanent', message: 'Mailbox does not exist' } } };
    assert.equal((await h.request('/api/blotter/mail/events', delivered, '', { ...signed(delivered, 'evt-1'), 'svix-signature': 'v1,' + randomBytes(32).toString('base64') })).status, 401);
    assert.equal((await (await h.request('/api/blotter/mail/events', delivered, '', signed(delivered, 'evt-1'))).json()).type, 'delivered');
    assert.equal((await (await h.request('/api/blotter/mail/events', bounce, '', signed(bounce, 'evt-2'))).json()).type, 'bounced');
    assert.ok((await (await h.request('/api/blotter/mail/events', bounce, '', signed(bounce, 'evt-2'))).json()).duplicate);
    detail = await h.json(`/bulk-messages/${preview.batch.id}`, undefined, h.owner);
    assert.equal(detail.recipients.find(r => r.id === sent0.id).status, 'delivered'); assert.equal(detail.recipients.find(r => r.id === sent1.id).status, 'bounced');
    const history1 = await h.json(`/clients/${clients[1].id}/history?kind=messages`, undefined, h.owner);
    assert.ok(history1.history.some(e => e.action === 'bulk.sent' && /^engagement: "1040 kickoff for Client 01"/.test(e.detail)));
    assert.ok(history1.history.some(e => e.action === 'bulk.bounced' && e.actor === 'mail provider' && /hard bounce/.test(e.detail)));
    assert.ok(!(await h.json(`/clients/${clients[2].id}/history?kind=messages`, undefined, h.owner)).history.some(e => e.action === 'bulk.bounced'));

    // Marketing consent: staff-recorded grants with evidence; preparers cannot record; a typed unsubscribe withdraws an address.
    const grant = (contactId, extra = {}) => ({ contactId, kind: 'grant', actedAt: '2026-10-01T15:00:00Z', wording: 'Yes, send me seminar invitations and newsletters by email.', wordingVersion: 'v1', evidence: 'Signed sign-up sheet at the October seminar', ...extra });
    await h.json('/marketing-consents', grant(clients[0].contacts[0].id), prep, 403);
    await h.json('/marketing-consents', grant(clients[0].contacts[0].id, { evidence: '' }), h.owner, 400);
    const grants = [];
    for (const n of [0, 1, 2, 3, 4]) grants.push(await h.json('/marketing-consents', grant(clients[n].contacts[0].id), n % 2 ? review : h.owner));
    await h.json('/marketing-consents', grant(shared.id), h.owner); await h.json('/marketing-consents', grant(clients[5].contacts[0].id), h.owner);
    const page = await h.request('/unsubscribe', undefined); assert.equal(page.status, 200); assert.match(await page.text(), /Unsubscribe from marketing email/);
    const typedForm = new FormData(); typedForm.set('address', 'p05@example.test'); const typed = await h.request('/unsubscribe', typedForm); assert.match(await typed.text(), /p05@example.test will receive no more marketing email/);

    // Marketing refusals: section 7216 topic guard, no postal address, no approval.
    const marketing = { class: 'marketing', templateId: news.id, entityType: 'individual', topic: 'other' };
    await h.json('/bulk-messages/preview', { ...marketing, workTypeId, idempotencyKey: 'm0' }, h.owner, 409);
    await h.json('/bulk-messages/preview', { ...marketing, templateId: kickoff.id, idempotencyKey: 'm0' }, h.owner, 409);
    await h.json('/bulk-messages/preview', { ...marketing, idempotencyKey: 'm0' }, h.owner, 409);
    await h.json('/firm/settings', firm, h.owner);
    const m1 = await h.json('/bulk-messages/preview', { ...marketing, idempotencyKey: 'spring-1' }, review);
    assert.match(m1.notice, /301\.7216-3/);
    assert.deepEqual(m1.recipients.map(r => r.address).sort(), ['p00@example.test', 'p02@example.test', 'p03@example.test', 'p04@example.test'], 'p01 bounced hard; p00 appears once');
    const reasons = Object.fromEntries(m1.exclusions.map(x => [`${x.client}/${x.address}`, x.reason]));
    assert.equal(reasons['Client 21/p00@example.test'], 'address already included once in this batch');
    assert.equal(reasons['Client 01/p01@example.test'], 'address invalid after a hard bounce');
    assert.equal(reasons['Client 05/p05@example.test'], 'marketing withdrawn for this address');
    assert.equal(reasons['Client 06/p06@example.test'], 'no marketing opt-in');
    assert.equal(reasons['Client 35/p35@example.test'], 'email consent withdrawn');
    await h.json(`/bulk-messages/${m1.batch.id}/schedule`, { fingerprint: m1.batch.fingerprint }, review, 409);
    await h.json(`/bulk-messages/${m1.batch.id}/approve`, { fingerprint: m1.batch.fingerprint }, review, 403);
    await h.json(`/bulk-messages/${m1.batch.id}/approve`, { fingerprint: m1.batch.fingerprint }, h.owner);
    await h.json(`/bulk-messages/${m1.batch.id}/schedule`, { fingerprint: m1.batch.fingerprint }, review);
    const m1Start = h.mails.length; await h.json(`/bulk-messages/${m1.batch.id}/run`, {}, h.owner);
    const newsletters = h.mails.slice(m1Start);
    assert.equal(newsletters.length, 4);
    for (const m of newsletters) {
      assert.match(m.headers['List-Unsubscribe'], /^<https:\/\/127\.0\.0\.1:\d+\/unsubscribe\?t=us_[0-9a-f]{64}>$/); assert.equal(m.headers['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click');
      assert.match(m.text, /Unsubscribe: https:\/\/\S+\/unsubscribe\?t=us_/); assert.match(m.text, /Cardinal Tax & Books, 100 Main Street, Raleigh, NC 27601/);
    }
    const stored = (await h.json(`/bulk-messages/${m1.batch.id}`, undefined, h.owner)).recipients;
    assert.ok(stored.every(r => r.body.includes('/unsubscribe?t=…') && !/us_[0-9a-f]{64}/.test(r.body)), 'Stored text never keeps the unsubscribe secret');

    // One-click unsubscribe from p00: immediate, firm-wide, marketing only.
    const p00 = newsletters.find(m => m.to[0] === 'p00@example.test'), link = p00.headers['List-Unsubscribe'].slice(1, -1);
    const oneClickForm = new FormData(); oneClickForm.set('List-Unsubscribe', 'One-Click');
    assert.equal((await h.request(new URL(link).pathname + new URL(link).search, oneClickForm, '', { origin: 'https://mail.example' })).status, 200);
    const log = await h.json(`/marketing-consents?clientId=${clients[0].id}`, undefined, h.owner);
    const oneClick = log.events.find(e => e.kind === 'withdraw' && e.source === 'one_click');
    assert.ok(oneClick && oneClick.address === 'p00@example.test' && oneClick.client_id === null, 'Two clients share the address, so the withdrawal files to the address');
    assert.equal(log.contacts[0].marketing, false); assert.equal(log.contacts[0].withdrawn, true);
    await h.json(`/marketing-consents/${oneClick.id}/correct`, { reason: 'Try to undo' }, review, 403);
    await h.json(`/marketing-consents/${oneClick.id}/correct`, { reason: 'Try to undo' }, h.owner, 409);

    // Complaint: marketing withdrawn for the address and the batch owner alerted.
    const m1Detail = await h.json(`/bulk-messages/${m1.batch.id}`, undefined, h.owner), p02 = m1Detail.recipients.find(r => r.address === 'p02@example.test');
    const complaint = { type: 'email.complained', created_at: new Date().toISOString(), data: { email_id: p02.provider_message_id, to: ['p02@example.test'] } };
    assert.equal((await (await h.request('/api/blotter/mail/events', complaint, '', signed(complaint, 'evt-3'))).json()).type, 'complained');
    assert.ok((await h.json('/notifications', undefined, review)).some(n => /complained about your marketing message/.test(n.summary)));

    // The principal's review list and correction: void one mistaken staff-recorded grant.
    const reviewed = await h.json('/bulk-messages/review', undefined, h.owner); await h.json('/bulk-messages/review', undefined, review, 403);
    assert.ok(reviewed.notices.some(n => n.address === 'p10@example.test') === false && reviewed.notices.some(n => n.address === 'p20@example.test'));
    const misfiled = reviewed.notices.find(n => n.address === 'p20@example.test');
    await h.json(`/bulk-messages/recipients/${misfiled.id}/misclassified`, { reason: 'Seminar invitation sent as engagement' }, h.owner);
    await h.json(`/bulk-messages/recipients/${misfiled.id}/misclassified`, { reason: 'Again' }, h.owner, 409);
    await h.json(`/marketing-consents/${grants[3].id}/correct`, { reason: 'Recorded against the wrong contact' }, review, 403);
    await h.json(`/marketing-consents/${grants[3].id}/correct`, { reason: 'Recorded against the wrong contact' }, h.owner);
    const m2 = await h.json('/bulk-messages/preview', { ...marketing, idempotencyKey: 'spring-2' }, h.owner);
    assert.deepEqual(m2.recipients.map(r => r.address), ['p04@example.test'], 'Unsubscribed, complained and voided addresses are excluded on every client');
    const m2Reasons = m2.exclusions.filter(x => x.address === 'p00@example.test').map(x => `${x.client}: ${x.reason}`).sort();
    assert.deepEqual(m2Reasons, ['Client 00: marketing withdrawn for this address', 'Client 21: marketing withdrawn for this address']);
    assert.equal(m2.exclusions.find(x => x.address === 'p03@example.test').reason, 'no marketing opt-in');
    // The next engagement notice still reaches the unsubscribed address.
    const next = await h.json('/bulk-messages/preview', { ...engagement, idempotencyKey: 'kick-2' }, h.owner);
    assert.ok(next.recipients.some(r => r.address === 'p00@example.test')); assert.equal(next.exclusions.find(x => x.client === 'Client 01').reason, 'address invalid after a hard bounce');
    const audit = (await h.json(`/clients/${clients[3].id}/history?kind=messages`, undefined, h.owner)).history;
    assert.ok(audit.some(e => e.action === 'consent.marketing_granted' && e.actor === 'reviewer@example.test') && audit.some(e => e.action === 'consent.corrected' && e.actor === 'owner@example.test'));

    // Reminders, organizer invitations and automation send engagement class only.
    await h.json('/automation/preview', { name: 'Marketing rule', clientIds: [clients[0].id], trigger: { kind: 'due', at: '2027-01-04T00:00:00Z' }, action: { kind: 'reminder', templateId: news.id }, budget: 1 }, h.owner, 409);

    // Archive: consent travels, tokens do not, batches return paused, and marketing stays off until the principal confirms.
    const archive = await (await h.request('/api/blotter/backup', undefined, h.owner)).text();
    restored = await harness(); await restored.json('/restore', { archive, confirm: 'RESTORE' }, restored.owner);
    const restoredLog = await restored.json(`/marketing-consents?clientId=${clients[0].id}`, undefined, restored.owner);
    assert.deepEqual(restoredLog.events.map(e => [e.kind, e.source]), log.events.map(e => [e.kind, e.source])); assert.ok(restoredLog.events.every(e => e.restored === 1));
    assert.match(restoredLog.hold, /off after a restore/);
    const p04 = newsletters.find(m => m.to[0] === 'p04@example.test').headers['List-Unsubscribe'].slice(1, -1), stale = new FormData(); stale.set('List-Unsubscribe', 'One-Click');
    assert.equal((await restored.request(new URL(p04).pathname + new URL(p04).search, stale)).status, 404, 'Unsubscribe tokens never travel with archives');
    await restored.json('/firm/settings', firm, restored.owner);
    const back = await restored.json(`/bulk-messages/${next.batch.id}`, undefined, restored.owner);
    assert.equal(back.batch.status, 'paused'); await restored.json(`/bulk-messages/${next.batch.id}/schedule`, { fingerprint: next.batch.fingerprint }, restored.owner, 409);
    await restored.json('/bulk-messages/preview', { ...marketing, idempotencyKey: 'restored' }, restored.owner, 409);
    await restored.json('/marketing-consents/confirm', { note: 'Checked the consent log against the source practice' }, restored.owner);
    assert.deepEqual((await restored.json('/bulk-messages/preview', { ...marketing, idempotencyKey: 'restored' }, restored.owner)).recipients.map(r => r.address), ['p04@example.test']);
  } finally { await h.close(); if (restored) await restored.close(); }
});
