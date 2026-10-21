// Shared ERASURE-002 fixtures: one client with every kind of record the policy classifies,
// built only through the Worker's public doors. Fakes only the mail provider (the harness).
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';

export const b64 = text => Buffer.from(text).toString('base64');
export const contact = (name, email) => ({ name, email, roles: ['primary'], authorized: true, portal: true, requestConsent: true, emailConsent: true });
export const tokenOf = recipient => new URL(recipient.portalUrl).pathname.split('/').at(-1);
export const SENTINEL = { organizer: 'Sentinel organizer answer', thread: 'Sentinel thread text', engagement: 'Signed engagement letter bytes', intake: 'Sentinel bank statement bytes', note: 'Sentinel request note',
  credential: 'sentinel-password-1', accepted: 'Accepted return bytes', todo: 'Sentinel readiness response' };
export const IDENTITY = { name: 'Cedar Lane LLC', ein: '123456789', address: '14 Cedar Lane, Columbus OH 43004' };
const organizer = { name: 'Close organizer', kind: 'bookkeeping', version: 1, questions: [{ key: 'notes', label: 'Bookkeeper notes', type: 'text', required: true }] };

const totp = (secret, offset = 0) => {
  let bits = 0, value = 0; const key = [];
  for (const c of secret) { value = (value << 5) | 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'.indexOf(c); bits += 5; if (bits >= 8) { key.push((value >>> (bits - 8)) & 255); bits -= 8; } }
  const counter = Buffer.alloc(8); counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000) + offset));
  const mac = createHmac('sha1', Buffer.from(key)).update(counter).digest(), o = mac[19] & 15;
  return String((mac.readUInt32BE(o) & 0x7fffffff) % 1e6).padStart(6, '0');
};

export async function team(h) {
  for (const [email, role] of [['reviewer@example.test', 'reviewer'], ['prep@example.test', 'preparer']]) { await h.json('/team', { email, name: email, role }, h.owner); await h.json('/team/invite', { email }, h.owner); }
  await h.json('/team/rates', { email: 'prep@example.test', rateCents: 9000, effectiveFrom: '2026-01-01' }, h.owner);
  return { reviewer: await h.login('reviewer@example.test'), prep: await h.login('prep@example.test') };
}

/** Starts and signs off a job: upload, accept, finish the checklist, submit, review. Returns the file id. */
export async function signedOff(h, s, job, file) {
  let d = await h.json('/jobs/' + job.id, undefined, s.prep);
  const upload = await h.json(`/requests/${d.requests[0].id}/files`, file, s.prep);
  await h.json(`/requests/${d.requests[1].id}/files`, { name: 'payroll.txt', mime: 'text/plain', contentBase64: b64('Payroll register for ' + job.id) }, s.prep);
  d = await h.json('/jobs/' + job.id, undefined, s.prep);
  for (const r of d.requests) if (r.status !== 'accepted') await h.json(`/requests/${r.id}/decide`, { decision: 'accept' }, s.prep);
  for (const st of d.steps) await h.json(`/jobs/${job.id}/steps`, { ordinal: st.ordinal, done: true }, s.prep);
  d = await h.json(`/jobs/${job.id}/submit`, { revision: (await h.json('/jobs/' + job.id, undefined, s.prep)).job.revision }, s.prep);
  await h.json(`/jobs/${job.id}/review`, { revision: d.job.revision, decision: 'signoff', note: 'Signed off and filed' }, s.reviewer);
  return upload.id;
}

export async function build(h) {
  const s = await team(h);
  await h.json('/clients/fields', { key: 'street_address', label: 'Street address', type: 'text' }, h.owner);
  const client = await h.json('/clients', { name: IDENTITY.name, ein: IDENTITY.ein, contacts: [contact('Alex Owner', 'alex@example.test'), contact('Blair Bookkeeper', 'blair@example.test')] }, h.owner);
  await h.json(`/clients/${client.id}/profile`, { fields: { street_address: IDENTITY.address } }, h.owner);
  const other = await h.json('/clients', { name: 'Birch Street Cafe', contacts: [contact('Alex at Birch', 'alex@example.test')] }, h.owner);
  const [alex] = client.contacts.filter(c => c.email === 'alex@example.test');
  const template = await h.json('/templates', { name: 'Close', recurrence: 'monthly', steps: 'Reconcile', requests: 'Bank statement\nPayroll register', organizer }, h.owner);
  const start = (periodStart, clientId = client.id) => h.json('/jobs', { clientId, templateId: template.id, periodStart, dueDate: '2027-04-15', dueNote: 'Recorded target', preparerEmail: 'prep@example.test', reviewerEmail: 'reviewer@example.test' }, h.owner);
  const engagementJob = await start('2026-01-01'), signed = await start('2026-02-01'), open = await start('2026-03-01');
  const engagementFile = await signedOff(h, s, engagementJob, { name: 'engagement-job.txt', mime: 'text/plain', contentBase64: b64('Engagement job working paper') });
  const signedFile = await signedOff(h, s, signed, { name: 'signed-return.txt', mime: 'text/plain', contentBase64: b64(SENTINEL.accepted) });
  // A practitioner-recorded signed engagement: the letter, its signers and its signed date.
  const letter = await h.json(`/clients/${client.id}/engagements`, { title: 'Engagement letter 2026', signers: ['Alex Owner', 'Pat Preparer'], signedDate: '2026-01-05', file: { name: 'engagement-letter.txt', mime: 'text/plain', contentBase64: b64(SENTINEL.engagement) } }, h.owner);
  // Open work: a file, a thread, a request note, billable time and an expense, a stored credential, an organizer answer from the client, readiness preparations.
  let d = await h.json('/jobs/' + open.id, undefined, s.prep);
  const intakeFile = (await h.json(`/requests/${d.requests[0].id}/files`, { name: 'bank.txt', mime: 'text/plain', contentBase64: b64(SENTINEL.intake) }, s.prep)).id;
  await h.json(`/requests/${d.requests[1].id}/files`, { name: 'payroll-open.txt', mime: 'text/plain', contentBase64: b64('Open job payroll bytes') }, s.prep);
  await h.json(`/jobs/${open.id}/threads`, { anchor: 'request:' + d.requests[0].id, title: 'Statement query', body: SENTINEL.thread, correction: false }, s.prep);
  const time = await h.json(`/jobs/${open.id}/time`, { date: '2026-10-02', minutes: 50, description: 'Reconcile bank' }, s.prep);
  const expense = await h.json(`/jobs/${open.id}/expenses`, { kind: 'postage', date: '2026-11-03', description: 'Courier to Cedar Lane', costCents: 1200, billable: false }, s.prep);
  const credential = await h.json(`/clients/${client.id}/credentials`, { label: 'State portal', url: 'https://gateway.example.test', username: 'sentinel-user', password: SENTINEL.credential, notes: 'n' }, h.owner);
  d = await h.json(`/jobs/${open.id}/organizers`, undefined, h.owner);
  const o = d.organizers[0], sent = await h.json(`/jobs/${open.id}/organizers/send`, { revision: o.revision, assignments: { notes: alex.id }, body: 'Please complete {{portal_link}}' }, s.prep);
  const token = tokenOf(sent.recipients[0]), portal = `/portal/${token}/organizers/${encodeURIComponent(o.id)}`;
  const mine = (await h.json(`/portal/${token}/organizers`)).organizers[0];
  await h.json(portal, { revision: mine.revision, answers: { notes: { value: SENTINEL.organizer, confirmed: true } }, submit: true });
  // Readiness: one preparation nobody decided, one a reviewer declined (a decision the signed-off job consumes).
  const key = await h.json('/keys', { label: 'Practice assistant' }, h.owner), auth = { authorization: 'Bearer ' + key.key };
  d = await h.json('/jobs/' + open.id, undefined, s.prep);
  const prepare = requestId => h.json(`/agent/jobs/${open.id}/readiness/questions`, { sourceKind: 'request', sourceId: requestId }, '', 200, auth);
  const pending = await prepare(d.requests[0].id), decided = await prepare(d.requests[1].id);
  await h.json(`/jobs/${open.id}/readiness/questions/${decided.id}/decide`, { decision: 'decline', reason: 'Reviewed the cited evidence and current client response' }, s.reviewer);
  // Marketing: the contact withdrew; the same address belongs to another client's contact.
  await h.json('/marketing-consents', { contactId: alex.id, kind: 'withdraw', source: 'staff_reply', actedAt: '2026-10-01T10:00:00Z', evidence: 'Replied: please stop' }, h.owner);
  // An agent's rollforward plan for the signed job, decided by a person (its output and decision stay as ids).
  const roll = await h.json('/agent/prepare-rollforward', { jobId: signed.id, dueDate: '2027-04-28', dueNote: 'Next period' }, '', 200, auth);
  const attempted = await h.json(`/proposals/${roll.id}/decide`, { decision: 'decline', reason: 'Not needed' }, h.owner);
  // Outside copies Blotter can observe: a share-link download of the accepted return and a billing CSV the principal downloads.
  const ref = encodeURIComponent(signedFile), access = await h.json(`/documents/${ref}/access`, undefined, h.owner);
  const grant = await h.json(`/documents/${ref}/access`, { revision: access.revision, visibility: 'contacts', contactIds: [alex.id] }, h.owner);
  const share = await h.json(`/documents/${ref}/shares`, { revision: grant.revision, contactId: alex.id, days: 7 }, h.owner);
  assert.equal((await h.request('/api/blotter/shared-files/' + share.token)).status, 200);
  return { ...s, client, other, alex, template, engagementJob, signed, open, engagementFile, signedFile, intakeFile, letter, credential, time, expense, token, roll, attempted, key, auth, pending, decided, share, start };
}

/** Completes the open job (so the client has no open work), approves a billing export of its time and expense. */
export async function finishOpenWork(h, s) {
  const prep = s.prep;
  let d = await h.json('/jobs/' + s.open.id, undefined, prep);
  for (const r of d.requests) await h.json(`/requests/${r.id}/decide`, { decision: 'accept' }, prep);
  for (const st of d.steps) await h.json(`/jobs/${s.open.id}/steps`, { ordinal: st.ordinal, done: true }, prep);
  d = await h.json(`/jobs/${s.open.id}/submit`, { revision: (await h.json('/jobs/' + s.open.id, undefined, prep)).job.revision }, prep);
  await h.json(`/jobs/${s.open.id}/review`, { revision: d.job.revision, decision: 'signoff', note: 'Close signed off' }, s.reviewer);
}
export async function approvedExport(h, s) {
  await h.json('/timesheets/submit', { weekStart: '2026-09-28' }, s.prep);
  await h.json(`/time/${s.time.id}/review`, { decision: 'approve' }, s.reviewer);
  const draft = await h.json('/exports', { title: 'October billing', sourceKeys: ['time:' + s.time.id] }, s.reviewer);
  const listed = (await h.json('/billing', undefined, h.owner)).exports.find(x => x.id === draft.id);
  await h.json(`/exports/${draft.id}/approve`, { revision: listed.revision, reviewNote: 'Checked against job records' }, h.owner);
  return draft.id;
}
export const enroll = async (h, who) => { const start = await h.json('/mfa/totp/start', {}, who); const done = await h.json('/mfa/totp/confirm', { id: start.id, code: totp(start.secret, -1) }, who); return { secret: start.secret, recovery: done.recoveryCodes }; };
export { totp };

