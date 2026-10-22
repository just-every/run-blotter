import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { harness } from './harness.mjs';
import { languageJourney } from './language-ui.mjs';

const acknowledge = 'erasure history unverified: supply your latest erasure journal';
const person = (name, email, language, extra = {}) => ({ name, email, language, roles: ['primary'], authorized: true, signer: true, portal: true, requestConsent: true, emailConsent: true, ...extra });
const tokenOf = r => new URL(r.portalUrl).pathname.split('/').at(-1);
const organizer = {
  name: 'Ownership organizer', kind: 'bookkeeping', version: 1, es: { name: 'Cuestionario de propiedad' },
  questions: [
    { key: 'ownership', label: 'Did ownership change?', type: 'choice', options: ['Yes', 'No'], required: true, workflowQuestion: 'ownership', es: { label: '¿Cambió la propiedad?', options: ['Sí', 'No'] } },
    { key: 'owners', label: 'Describe the new owners', type: 'text', required: true, when: { question: 'ownership', values: ['Yes'] }, request: 'Ownership change evidence', es: { label: 'Describa a los nuevos propietarios', request: 'Prueba del cambio de propiedad' } },
    { key: 'bookkeeping', label: 'Bookkeeper notes', type: 'text', required: true, es: { label: 'Notas del contador' } },
  ],
};
const answer = (value, confirmed = true) => ({ value, confirmed });

test('PORTAL-005 / MSG-001 / PORTAL-004 / SIGN-002 / MSG-002 / BASE-001: a Spanish-speaking contact gets Spanish requests, portal, organizer, signature, deliverable mail and unsubscribe page; templates warn when they lack a Spanish version; the English contact is unchanged', async () => {
  const h = await harness({ bindings: { MAIL_API_KEY: 'synthetic-blotter-15' } }); let restored;
  try {
    for (const [email, role] of [['reviewer@example.test', 'reviewer'], ['prep@example.test', 'preparer']]) { await h.json('/team', { email, name: email.split('@')[0], role }, h.owner); await h.json('/team/invite', { email }, h.owner); }
    const prep = await h.login('prep@example.test'), reviewer = await h.login('reviewer@example.test');
    const client = await h.json('/clients', { name: 'Cedar Lane LLC', contacts: [person('María Gómez', 'maria@example.test', 'es'), person('Tom Baker', 'tom@example.test', 'en')] }, h.owner);
    const maria = client.contacts.find(c => c.email === 'maria@example.test'), tom = client.contacts.find(c => c.email === 'tom@example.test');
    assert.deepEqual([maria.language, tom.language], ['es', 'en']);
    const template = await h.json('/templates', { name: 'Monthly close', recurrence: 'monthly', tasks: [{ label: 'Prepare close' }, { label: 'Inspect changed ownership', when: { question: 'ownership', equals: ['Yes'] } }], requests: ['Bank statement'], questions: [{ key: 'ownership', label: 'Did ownership change?', options: ['Yes', 'No'] }], organizer }, h.owner);
    const job = await h.json('/jobs', { clientId: client.id, templateId: template.id, periodStart: '2026-01-01', dueDate: '2027-04-15', dueNote: 'Recorded engagement target', preparerEmail: 'prep@example.test', reviewerEmail: 'reviewer@example.test' }, h.owner);

    // A contact's language is staff-set; an invalid one and a preparer are refused, and a language-only edit keeps an issued link working.
    const contactsPath = `/clients/${client.id}/contacts`, contactsOf = async () => h.json(contactsPath, undefined, h.owner);
    await h.json(contactsPath, { id: tom.id, revision: tom.revision, language: 'fr' }, h.owner, 400);
    await h.json(contactsPath, { id: tom.id, revision: tom.revision, language: 'es' }, prep, 403);
    const tomLink = tokenOf(await h.json(`/jobs/${job.id}/reminders`, { contactId: tom.id }, h.owner));
    const switched = await h.json(contactsPath, { id: tom.id, revision: tom.revision, language: 'es' }, h.owner);
    assert.deepEqual([switched.language, switched.revision], ['es', tom.revision], 'A language-only edit keeps the contact revision');
    assert.equal((await h.json(`/portal/${tomLink}`)).language, 'es');
    await h.json(contactsPath, { id: tom.id, revision: tom.revision, language: 'en' }, h.owner);
    assert.equal((await h.json(`/portal/${tomLink}`)).language, 'en');
    await h.json(contactsPath, { id: tom.id, revision: tom.revision, phone: '+15555550123' }, h.owner);
    await h.json(`/portal/${tomLink}`, undefined, '', 404);

    // Firm templates keep a version per language; the Spanish one is added to the current version.
    const body = { scope: 'firm', category: 'Requests', subject: 'Documents for {{client_name}}', body: 'Hello {{contact_first_name}}, please upload {{outstanding_requests}} at {{portal_link}}.' };
    const withSpanish = await h.json('/messages/templates', { ...body, name: 'Request with Spanish' }, h.owner), englishOnly = await h.json('/messages/templates', { ...body, name: 'Request English only' }, h.owner);
    const spanish = { language: 'es', subject: 'Documentos para {{client_name}}', body: 'Hola {{contact_first_name}}, cargue {{outstanding_requests}} en {{portal_link}}.' };
    await h.json(`/messages/templates/${withSpanish.id}/translations`, spanish, prep, 403);
    await h.json(`/messages/templates/${withSpanish.id}/translations`, { ...spanish, language: 'en' }, h.owner, 400);
    await h.json(`/messages/templates/${withSpanish.id}/translations`, { ...spanish, body: 'Hola {{unknown_field}}' }, h.owner, 400);
    await h.json(`/messages/templates/${withSpanish.id}/translations`, spanish, h.owner);
    await h.json(`/messages/templates/${withSpanish.id}/translations`, spanish, h.owner, 409);
    const listed = (await h.json('/messages/templates', undefined, h.owner)).templates;
    assert.deepEqual([listed.find(t => t.id === withSpanish.id).translations.map(x => x.language), listed.find(t => t.id === englishOnly.id).translations], [['es'], []]);

    // A templated request to the Spanish contact uses the Spanish version; a template without one warns staff before the send.
    const maria2 = (await contactsOf()).find(c => c.id === maria.id);
    const preview = await h.json(`/jobs/${job.id}/reminders/preview`, { templateId: withSpanish.id, contactId: maria.id }, h.owner);
    assert.deepEqual([preview.language, preview.translated, preview.warnings], ['es', true, []]); assert.match(preview.subject, /^Documentos para Cedar Lane LLC$/); assert.match(preview.body, /^Hola María, cargue /);
    const noSpanish = await h.json(`/jobs/${job.id}/reminders/preview`, { templateId: englishOnly.id, contactId: maria.id }, h.owner);
    assert.deepEqual([noSpanish.translated, noSpanish.warnings.map(w => w.kind)], [false, ['no_translation']]); assert.match(noSpanish.warnings[0].message, /Request English only has no Spanish version/);
    assert.deepEqual((await h.json(`/jobs/${job.id}/reminders/preview`, { templateId: englishOnly.id, contactId: tom.id }, h.owner)).warnings, [], 'The English contact is never warned');
    // The same warning precedes a portal message and a bulk batch; with a Spanish version the batch renders it for her.
    assert.deepEqual((await h.json(`/jobs/${job.id}/portal/messages/preview`, { templateId: englishOnly.id, contactId: maria.id }, h.owner)).warnings.map(w => w.kind), ['no_translation']);
    assert.deepEqual((await h.json(`/jobs/${job.id}/portal/messages/preview`, { templateId: withSpanish.id, contactId: maria.id }, h.owner)).warnings, []);
    const kickoff = await h.json('/messages/templates', { scope: 'firm', name: 'Kickoff', subject: '{{work_item}} kickoff for {{client_name}}', body: '{{work_item}}: hello {{contact_first_name}}.' }, h.owner);
    const batch = key => h.json('/bulk-messages/preview', { class: 'engagement', templateId: kickoff.id, entityType: 'business', reason: 'Season kickoff for open engagements', idempotencyKey: key }, h.owner);
    assert.deepEqual((await batch('kickoff-1')).untranslated.map(u => [u.address, u.language]), [['maria@example.test', 'es']]);
    await h.json(`/messages/templates/${kickoff.id}/translations`, { language: 'es', subject: '{{work_item}}: inicio para {{client_name}}', body: '{{work_item}}: hola {{contact_first_name}}.' }, h.owner);
    const kicked = await batch('kickoff-2');
    assert.deepEqual(kicked.untranslated, []); assert.match(kicked.samples.find(x => x.to === 'maria@example.test').subject, /: inicio para Cedar Lane LLC$/);
    const sentSpanish = await h.json(`/jobs/${job.id}/reminders`, { templateId: withSpanish.id, contactId: maria.id }, h.owner), mailTo = (address, n = -1) => h.mails.filter(m => m.to.includes(address)).at(n);
    assert.match(mailTo('maria@example.test').subject, /^Documentos para Cedar Lane LLC$/); assert.match(mailTo('maria@example.test').text, /^Hola María, cargue /);
    await h.json(`/jobs/${job.id}/reminders`, { templateId: englishOnly.id, contactId: maria.id }, h.owner);
    assert.match(mailTo('maria@example.test').subject, /^Documents for Cedar Lane LLC$/, 'Without a Spanish version the English text is what is sent');
    await h.json(`/jobs/${job.id}/reminders`, { contactId: maria.id }, h.owner);
    assert.match(mailTo('maria@example.test').subject, /^Documentos necesarios: /); assert.match(mailTo('maria@example.test').text, /^Hola María Gómez,\n\nNecesitamos los siguientes documentos/);
    await h.json(`/jobs/${job.id}/reminders`, { contactId: tom.id }, h.owner);
    assert.match(mailTo('tom@example.test').subject, /^Documents needed: /);

    // The portal speaks Spanish to her and English to him; recorded values never change.
    const mariaToken = tokenOf(await h.json(`/jobs/${job.id}/reminders`, { contactId: maria.id }, h.owner)), tomToken = tokenOf(await h.json(`/jobs/${job.id}/reminders`, { contactId: tom.id }, h.owner));
    const view = await h.json(`/portal/${mariaToken}`), english = await h.json(`/portal/${tomToken}`);
    assert.equal(view.language, 'es'); assert.match(view.progress.nextAction, /^Por favor, cargue \d+ documentos?\./); assert.equal(view.progress.milestones[0].label, 'Documentos'); assert.equal(view.progress.status, 'Planeado');
    assert.equal(english.language, 'en'); assert.match(english.progress.nextAction, /^Please upload \d+ documents?\./); assert.equal(english.progress.status, 'Planned');

    // Organizers: the Spanish questions, choices and document request; answers are stored in the recorded values.
    const org = (await h.json(`/jobs/${job.id}/organizers`, undefined, h.owner)).organizers[0], assignments = { ownership: maria.id, owners: maria.id, bookkeeping: tom.id };
    const invite = await h.json(`/jobs/${job.id}/organizers/send/preview`, { revision: org.revision, assignments }, h.owner);
    assert.match(invite.recipients.find(r => r.contactId === maria.id).subject, /^Cuestionario: /); assert.match(invite.recipients.find(r => r.contactId === tom.id).subject, /^Organizer: /);
    const templatedInvite = await h.json(`/jobs/${job.id}/organizers/send/preview`, { revision: org.revision, assignments, templateId: englishOnly.id }, h.owner);
    assert.deepEqual([maria.id, tom.id].map(id => templatedInvite.recipients.find(r => r.contactId === id).warnings.map(w => w.kind)), [['no_translation'], []], 'An organizer invitation warns before the send too');
    const sentOrg = await h.json(`/jobs/${job.id}/organizers/send`, { revision: org.revision, assignments }, h.owner), mo = tokenOf(sentOrg.recipients.find(r => r.contactId === maria.id)), to = tokenOf(sentOrg.recipients.find(r => r.contactId === tom.id));
    const portal = token => `/portal/${token}/organizers`;
    let a = (await h.json(portal(mo))).organizers[0], b = (await h.json(portal(to))).organizers[0];
    assert.deepEqual([a.name, a.questions.map(q => q.label), a.questions[0].optionLabels], ['Cuestionario de propiedad', ['¿Cambió la propiedad?'], { Yes: 'Sí', No: 'No' }]);
    assert.deepEqual([b.name, b.questions.map(q => q.label)], ['Ownership organizer', ['Bookkeeper notes']]);
    const put = (token, o, answers, submit, expected = 200) => h.json(`${portal(token)}/${encodeURIComponent(o.id)}`, { revision: o.revision, answers, submit }, undefined, expected);
    // Per-contact isolation, hidden questions, required answers and the recorded choice values hold in Spanish as in English.
    await put(to, b, { ownership: answer('Yes') }, false, 403);
    await put(mo, a, { owners: answer('Respuesta oculta') }, false, 409);
    a = await put(mo, a, { ownership: answer('Yes') }, false);
    assert.deepEqual(a.questions.map(q => q.label), ['¿Cambió la propiedad?', 'Describa a los nuevos propietarios'], 'The conditional question appears in Spanish');
    assert.equal((await h.json(`/jobs/${job.id}`, undefined, prep)).answers.find(q => q.key === 'ownership').value, null, 'A saved draft is not workflow evidence');
    await put(mo, a, {}, true, 409);
    await put(mo, a, { ownership: answer('Sí') }, false, 400);
    a = await put(mo, a, { owners: answer('Dos hermanas') }, false);
    const evidence = a.questions.find(q => q.key === 'owners').request;
    assert.equal(a.questions.find(q => q.key === 'ownership').value, 'Yes'); assert.equal(evidence.label, 'Prueba del cambio de propiedad');
    await h.json(`/portal/${to}/requests/${evidence.id}`, { name: 'Otro.pdf', mime: 'application/pdf', contentBase64: Buffer.from('otro').toString('base64') }, undefined, 404);
    await h.json(`/portal/${mo}/requests/${evidence.id}`, { name: 'Propiedad.pdf', mime: 'application/pdf', contentBase64: Buffer.from('Prueba firmada').toString('base64') });
    a = await put(mo, (await h.json(portal(mo))).organizers[0], {}, true);
    b = (await h.json(portal(to))).organizers[0];
    b = await put(to, b, { bookkeeping: answer('Reconciled') }, true);
    let staff = (await h.json(`/jobs/${job.id}/organizers`, undefined, reviewer)).organizers[0];
    assert.deepEqual([staff.completeness.confirmed, staff.completeness.required, staff.completeness.unresolved, staff.answers.ownership.value], [3, 3, [], 'Yes']);
    // Staff review the submission; a later correction is a new version and the original stays.
    const original = structuredClone(staff.submissions.find(x => x.answers?.owners));
    await h.json(`/organizers/${org.id}/review`, { submissionId: original.id, note: 'Revisado con la evidencia' }, reviewer);
    a = await put(mo, (await h.json(portal(mo))).organizers[0], { ownership: answer('No') }, true);
    staff = (await h.json(`/jobs/${job.id}/organizers`, undefined, h.owner)).organizers[0];
    assert.deepEqual(staff.submissions.find(x => x.id === original.id).answers, original.answers); assert.equal(staff.submissions.at(-1).answers.ownership.value, 'No');
    // Next period: the Spanish contact sees the carried answer marked, and must confirm it before it counts.
    const next = await h.json('/jobs', { clientId: client.id, templateId: template.id, periodStart: '2026-02-01', dueDate: '2027-05-15', dueNote: 'Recorded engagement target', preparerEmail: 'prep@example.test', reviewerEmail: 'reviewer@example.test' }, h.owner);
    const nextOrg = (await h.json(`/jobs/${next.id}/organizers`, undefined, h.owner)).organizers[0];
    const nextSent = await h.json(`/jobs/${next.id}/organizers/send`, { revision: nextOrg.revision, assignments }, h.owner), nt = tokenOf(nextSent.recipients.find(r => r.contactId === maria.id));
    let carried = (await h.json(portal(nt))).organizers[0];
    assert.ok(carried.questions[0].carriedFrom); assert.equal(carried.questions[0].label, '¿Cambió la propiedad?'); await put(nt, carried, {}, true, 409);
    assert.equal((await h.json(`/jobs/${next.id}`, undefined, h.owner)).answers.find(q => q.key === 'ownership').value, null);
    carried = await put(nt, carried, { ownership: answer('No') }, true);
    assert.equal((await h.json(`/jobs/${next.id}`, undefined, h.owner)).answers.find(q => q.key === 'ownership').value, 'No');

    // A signature in Spanish: the consent she reads and records is Spanish; the English version is not accepted from her.
    const pdf = await PDFDocument.create(), font = await pdf.embedFont(StandardFonts.Helvetica); pdf.addPage([612, 792]).drawText('Management representation', { x: 40, y: 740, font, size: 12 });
    const file = { name: 'rep.pdf', mime: 'application/pdf', contentBase64: Buffer.from(await pdf.save()).toString('base64') };
    const fields = (c) => ['signature', 'initials', 'date', 'text'].map((type, i) => ({ type, contactId: c.id, page: 1, x: 40, y: 100 + i * 50, width: 240, height: 28, label: `${type}` }));
    const draft = await h.json(`/jobs/${job.id}/signatures`, { title: 'Carta de representación', formKind: 'management representation', requiresKba: false, mode: 'parallel', contactIds: [maria.id, tom.id], fields: [...fields(maria), ...fields(tom)], file }, prep);
    const sig = await h.json(`/signatures/${draft.id}/send`, { revision: draft.revision }, prep);
    assert.match(mailTo('maria@example.test').subject, /^Solicitud de firma de documento$/); assert.equal(mailTo('tom@example.test').subject, 'Document signature request');
    assert.match(mailTo('maria@example.test').text, /^Por favor, revise y firme Carta de representación\.\n/); assert.match(mailTo('tom@example.test').text, /^Please review and sign Carta de representación\.\n/);
    const mine = [sig.invitations[0], sig.invitations[1]].map(i => tokenOf(i));
    const detailOf = async token => h.json(`/portal/${token}/signatures/${draft.id}`);
    const details = await Promise.all(mine.map(detailOf)), spanishDetail = details.find(d => d.signerName === 'María Gómez'), englishDetail = details.find(d => d.signerName === 'Tom Baker'), spanishToken = mine[details.indexOf(spanishDetail)], englishToken = mine[details.indexOf(englishDetail)];
    assert.deepEqual([spanishDetail.language, spanishDetail.consentVersion, /^Acepto usar registros/.test(spanishDetail.consentText)], ['es', 'esign-ueta-v1-es', true]);
    assert.deepEqual([englishDetail.consentVersion, /^I consent to use electronic records/.test(englishDetail.consentText)], ['esign-ueta-v1', true]);
    const values = d => Object.fromEntries(d.fields.map(f => [f.id, f.type === 'date' ? '2026-10-22' : f.type === 'initials' ? 'MG' : f.type === 'signature' ? d.signerName : 'Revisado']));
    const signBody = d => ({ revision: d.revision, attempt: d.attempt, consent: true, intent: true, consentVersion: d.consentVersion, values: values(d) });
    await h.json(`/portal/${spanishToken}/signatures/${draft.id}/sign`, { ...signBody(spanishDetail), consentVersion: 'esign-ueta-v1' }, '', 400, { 'user-agent': 'synthetic-blotter-browser/1' });
    await h.json(`/portal/${spanishToken}/signatures/${draft.id}/sign`, signBody(spanishDetail), '', 200, { 'user-agent': 'synthetic-blotter-browser/1' });
    await h.json(`/portal/${englishToken}/signatures/${draft.id}/sign`, signBody(await detailOf(englishToken)), '', 200, { 'user-agent': 'synthetic-blotter-browser/1' });
    const done = await h.json(`/signatures/${draft.id}`, undefined, prep);
    assert.equal(done.status, 'completed'); assert.deepEqual(done.signers.map(s => [s.name, s.consent_version]).sort(), [['María Gómez', 'esign-ueta-v1-es'], ['Tom Baker', 'esign-ueta-v1']]);
    assert.match(done.signers.find(s => s.name === 'María Gómez').consent_text, /^Acepto usar registros y firmas electrónicos/);

    // The deliverable mail and the unsubscribe page follow the contact's language.
    await h.json(`/jobs/${job.id}/deliverables`, { title: 'Estados financieros', name: 'fs.pdf', mime: 'application/pdf', contentBase64: Buffer.from('FS').toString('base64'), contactId: maria.id }, prep);
    assert.match(mailTo('maria@example.test').subject, /^Para su aprobación: Estados financieros v1$/); assert.match(mailTo('maria@example.test').text, /^Hola María Gómez,\n\nPor favor, revise Estados financieros \(versión 1\)/);
    // A marketing email to her (MSG-002): its Spanish version and a Spanish footer whose unsubscribe link opens the Spanish page.
    await h.json('/firm/settings', { name: 'Cardinal Tax & Books', ein: '12-3456789', entity: 'LLC', address: '100 Main Street', city: 'Raleigh', state: 'NC', zip: '27601', fiscalYearEnd: '12-31', services: 'Individual tax', currency: 'USD', timeZone: 'America/New_York', notificationStart: '08:00', notificationEnd: '18:00', calendars: [] }, h.owner);
    const news = await h.json('/messages/templates', { scope: 'firm', name: 'Seminar news', class: 'marketing', subject: 'News from {{firm_name}}', body: 'Hi {{contact_first_name}}, our spring seminar is open.' }, h.owner);
    await h.json(`/messages/templates/${news.id}/translations`, { language: 'es', subject: 'Novedades de {{firm_name}}', body: 'Hola {{contact_first_name}}, nuestro seminario de primavera está abierto.' }, h.owner);
    await h.json('/marketing-consents', { contactId: maria.id, kind: 'grant', actedAt: '2026-10-01T15:00:00Z', wording: 'Sí, envíenme invitaciones a seminarios y novedades por correo electrónico.', wordingVersion: 'v1-es', evidence: 'Signed Spanish sign-up sheet at the October seminar' }, h.owner);
    const newsBatch = await h.json('/bulk-messages/preview', { class: 'marketing', templateId: news.id, entityType: 'business', topic: 'other', idempotencyKey: 'news-es' }, h.owner);
    assert.deepEqual([newsBatch.recipients.map(r => r.address), newsBatch.untranslated], [['maria@example.test'], []]);
    await h.json(`/bulk-messages/${newsBatch.batch.id}/approve`, { fingerprint: newsBatch.batch.fingerprint }, h.owner);
    await h.json(`/bulk-messages/${newsBatch.batch.id}/schedule`, { fingerprint: newsBatch.batch.fingerprint }, h.owner);
    await h.json(`/bulk-messages/${newsBatch.batch.id}/run`, {}, h.owner);
    const newsMail = mailTo('maria@example.test'); assert.equal(newsMail.subject, 'Novedades de Cardinal Tax & Books'); assert.match(newsMail.text, /^Hola María, nuestro seminario de primavera está abierto\./);
    const unsubscribeLink = newsMail.text.match(/\nRecibe correo de mercadeo de Cardinal Tax & Books porque lo aceptó\. Cancelar la suscripción: https:\/\/[^/\s]+(\/unsubscribe\?t=us_[0-9a-f]{64})&lang=es\n/)?.[1];
    assert.ok(unsubscribeLink, 'The marketing footer is Spanish and its unsubscribe link carries the language');
    const page = async (path, form) => (await h.request(path, form)).text();
    for (const path of [unsubscribeLink + '&lang=es', unsubscribeLink]) { const html = await page(path); assert.match(html, /<html lang="es">/); assert.match(html, /Cancelar el correo de mercadeo/); }
    // The page's forms keep its language. A typed address is never looked up for it: a Spanish contact's address and an unknown one get the same reply.
    const typed = (address, query = '') => { const form = new FormData(); form.set('address', address); return page('/unsubscribe' + query, form); };
    const blank = await page('/unsubscribe?lang=es'); assert.match(blank, /Cancelar esta dirección/); assert.match(blank, /action="\/unsubscribe\?lang=es"/);
    assert.match(await typed('maria@example.test', '?lang=es'), /maria@example\.test no recibirá más correo de mercadeo de Cardinal Tax &amp; Books/);
    const unknown = await typed('nobody@example.test'), known = await typed('maria@example.test');
    assert.match(known, /<html lang="en">/); assert.equal(known.replace('maria@example.test', '{address}'), unknown.replace('nobody@example.test', '{address}'));
    assert.match(await page('/unsubscribe'), /Unsubscribe this address/);

    // The keyboard-only journey needs a pending Spanish signature request on the contact's newest link.
    const kbDraft = await h.json(`/jobs/${job.id}/signatures`, { title: 'Carta de firma por teclado', formKind: 'management representation', requiresKba: false, mode: 'parallel', contactIds: [maria.id], fields: fields(maria), file }, prep);
    const kb = await h.json(`/signatures/${kbDraft.id}/send`, { revision: kbDraft.revision }, prep);
    await languageJourney(h, { job, kbToken: tokenOf(kb.invitations[0]), kbId: kb.id });

    // A restore carries each contact's language and the Spanish template versions.
    await h.stepUp(h.owner);
    const archive = await (await h.request('/api/blotter/backup', undefined, h.owner)).text();
    restored = await harness({ bindings: { MAIL_API_KEY: 'synthetic-blotter-16' } });
    await restored.json('/restore', { archive, confirm: 'RESTORE', acknowledge }, restored.owner);
    assert.deepEqual((await restored.json(contactsPath, undefined, restored.owner)).map(c => [c.email, c.language]).sort(), [['maria@example.test', 'es'], ['tom@example.test', 'en']]);
    assert.equal((await restored.json('/messages/templates', undefined, restored.owner)).templates.find(t => t.id === withSpanish.id).translations[0].subject, 'Documentos para {{client_name}}');
  } finally { await restored?.close(); await h.close(); }
});
