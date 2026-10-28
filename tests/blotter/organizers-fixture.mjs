export const address = name => name + String.fromCharCode(64) + 'example.test';
export const contact = (name, email) => ({ name, email, roles: ['primary'], authorized: true, portal: true, requestConsent: true, emailConsent: true });
export const tokenOf = recipient => new URL(recipient.portalUrl).pathname.split('/').at(-1);
export const definition = {
 name: 'Ownership and bookkeeping organizer', kind: 'bookkeeping', version: 1,
 questions: [
  { key: 'ownership', label: 'Did ownership change?', type: 'choice', options: ['Yes', 'No'], required: true, workflowQuestion: 'ownership' },
  { key: 'owners', label: 'Describe the new owners', type: 'text', required: true, when: { question: 'ownership', values: ['Yes'] }, request: 'Ownership change evidence' },
  { key: 'bookkeeping', label: 'Bookkeeper notes', type: 'text', required: true },
 ],
};
export async function setup(h, options = {}) {
 for (const [email, role] of [[address('reviewer'), 'reviewer'], [address('prep'), 'preparer'], [address('outside'), 'preparer']]) {
  await h.json('/team', { email, name: email, role }, h.owner); await h.json('/team/invite', { email }, h.owner);
 }
 const reviewer = await h.login(address('reviewer')), prep = await h.login(address('prep')), outside = await h.login(address('outside'));
 const client = await h.json('/clients', { name: 'Cedar Lane LLC', contacts: [contact('Alex Owner', address('alex')), contact('Blair Bookkeeper', address('blair'))] }, h.owner);
 const a = client.contacts.find(c => c.email === address('alex')), b = client.contacts.find(c => c.email === address('blair'));
 const template = await h.json('/templates', { name: options.templateName ?? 'Monthly close with organizer', recurrence: 'monthly',
  tasks: [{ label: 'Prepare close' }, { label: 'Inspect changed ownership', when: { question: 'ownership', equals: ['Yes'] } }],
  questions: [{ key: 'ownership', label: 'Did ownership change?', options: ['Yes', 'No'] }], requests: ['Bank statement'], organizer: options.definition ?? definition }, h.owner);
 const start = periodStart => h.json('/jobs', { clientId: client.id, templateId: template.id, periodStart, dueDate: '2027-04-15', dueNote: 'Recorded engagement target', preparerEmail: address('prep'), reviewerEmail: address('reviewer') }, h.owner);
 const job = await start('2026-01-01');
 const assignments = { ownership: a.id, owners: a.id, bookkeeping: b.id };
 const organizer = (await h.json(`/jobs/${job.id}/organizers`, undefined, h.owner)).organizers[0];
 return { reviewer, prep, outside, client, a, b, template, start, job, assignments, organizer };
}
export const answer = (value, confirmed = true) => ({ value, confirmed });
export const portal = token => `/portal/${token}/organizers`;
export const save = (h, token, o, answers, submit = false, expected = 200) => h.json(`${portal(token)}/${encodeURIComponent(o.id)}`, { revision: o.revision, answers, submit }, undefined, expected);

