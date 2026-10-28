// Client answers stay drafts until a contact submits their assigned questions.
// Every submission keeps its original; workflow consumes confirmed submissions.
import { runtimeBindings, type Bindings } from '../auth.server';
import { portalJob } from './documents';
import { advance } from './flow';
import { contactGuard } from './client-recipients';
import { checkedAnswer, visibleQuestions, type OrganizerDefinition } from './organizers-definition';
import { organizerAnswers, storedOrganizer } from './organizers-store';
import { guard, id, insist, now, rows, stmt, type Data } from './model';

export async function submittedAnswers(db: D1Database, organizerId: string, current: Data): Promise<Data> {
  const answers: Data = {}, seen = new Set<string>();
  for (const s of await rows(db, 'SELECT contact_id,answers FROM b_organizer_submissions WHERE organizer_id=? AND erased_at IS NULL ORDER BY version DESC', organizerId)) {
    if (seen.has(s.contact_id)) continue;
    seen.add(s.contact_id);
    for (const [key, answer] of Object.entries(JSON.parse(s.answers ?? '{}'))) {
      if (!Object.hasOwn(answers, key) && current[key]?.contactId === s.contact_id) answers[key] = { ...(answer as Data), sourceContact: s.contact_id };
    }
  }
  return answers;
}

/** Requests retain their evidence when an answer makes them no longer needed. */
export async function organizerProjection(db: D1Database, organizer: Data, effective: Data, by: string, projectWorkflow = true): Promise<D1PreparedStatement[]> {
  const definition = organizer.definition as OrganizerDefinition, visible = visibleQuestions(definition, effective), statements: D1PreparedStatement[] = [];
  const mapped = await rows(db, 'SELECT * FROM b_organizer_requests WHERE organizer_id=?', organizer.id);
  let ordinal = Number((await stmt(db, 'SELECT COALESCE(MAX(ordinal),0) n FROM b_requests WHERE job_id=?', organizer.job_id).first<Data>())!.n);
  for (const q of definition.questions) {
    const a = effective[q.key], resolved = visible.has(q.key) && a?.confirmed && a.value !== '';
    const workflowKey = q.workflowQuestion || q.key;
    const workflow = await stmt(db, 'SELECT * FROM b_job_answers WHERE job_id=? AND key=?', organizer.job_id, workflowKey).first<Data>();
    insist(!q.workflowQuestion || workflow, `Organizer question ${q.label} names a missing workflow question`);
    if (workflow && projectWorkflow) {
      insist(q.type === 'choice' && (!resolved || JSON.parse(workflow.options).includes(a.value)), `Organizer answer for ${q.label} does not match the workflow choices`);
      statements.push(stmt(db, 'UPDATE b_job_answers SET value=?,answered_by=?,answered_at=?,organizer_source=? WHERE job_id=? AND key=?', resolved ? a.value : null, resolved ? a.sourceContact ? `contact:${a.sourceContact}` : by : null, resolved ? now() : null, organizer.id, organizer.job_id, workflowKey));
    }
    if (q.request) {
      const existing = mapped.find(m => m.key === q.key);
      if (existing) statements.push(stmt(db, 'UPDATE b_requests SET organizer_active=?,updated_by=?,updated_at=? WHERE id=?', resolved ? 1 : 0, by, now(), existing.request_id));
      else if (resolved) {
        const requestId = id();
        statements.push(stmt(db, "INSERT INTO b_requests(id,job_id,ordinal,label,status,updated_by,updated_at,organizer_active) VALUES(?,?,?,?,'requested',?,?,1)", requestId, organizer.job_id, ++ordinal, q.request, by, now()),
          stmt(db, 'INSERT INTO b_organizer_requests(organizer_id,key,request_id) VALUES(?,?,?)', organizer.id, q.key, requestId));
      }
    }
  }
  return statements;
}

async function contactOrganizer(db: D1Database, token: string, organizerId: string) {
  const portal = await portalJob(db, token), organizer = await storedOrganizer(db, organizerId);
  insist(organizer.job_id === portal.job.id && organizer.sent_at && !organizer.erased_at, 'Organizer not found', 404);
  const answers = await organizerAnswers(db, organizerId);
  insist(Object.values(answers).some(a => a.contactId === portal.contact.id), 'Organizer not found', 404);
  return { ...portal, organizer, answers };
}

export async function clientOrganizers(db: D1Database, token: string) {
  const { job: j, contact } = await portalJob(db, token);
  const found = await rows(db, `SELECT DISTINCT o.id FROM b_job_organizers o JOIN b_organizer_answers a ON a.organizer_id=o.id
    WHERE o.job_id=? AND o.sent_at IS NOT NULL AND o.erased_at IS NULL AND a.contact_id=?`, j.id, contact.id);
  return { organizers: await Promise.all(found.map(o => clientOrganizer(db, token, o.id))) };
}

export async function clientOrganizer(db: D1Database, token: string, organizerId: string) {
  const { job: j, contact, organizer, answers } = await contactOrganizer(db, token, organizerId);
  const visible = visibleQuestions(organizer.definition, answers), requests = await rows(db, `SELECT m.key,r.id,r.label,r.status,r.organizer_active FROM b_organizer_requests m JOIN b_requests r ON r.id=m.request_id WHERE m.organizer_id=?`, organizerId);
  const submissions = await rows(db, 'SELECT version,answers,submitted_at,reviewed_at FROM b_organizer_submissions WHERE organizer_id=? AND contact_id=? AND erased_at IS NULL ORDER BY version', organizerId, contact.id);
  // PORTAL-026: the contact's language picks the Spanish wording; recorded answers and every rule stay on the English choice values.
  const es = contact.language === 'es', definition = organizer.definition;
  const history = submissions.map(s => ({ ...s, answers: JSON.parse(s.answers ?? '{}') }));
  // Labels serve visible questions and this contact's submitted originals only. Translation
  // metadata must not expose another contact's questions or a never-revealed branch.
  const ownLabels = definition.questions.filter((q: Data) =>
    (visible.has(q.key) && answers[q.key].contactId === contact.id) || history.some(s => Object.hasOwn(s.answers, q.key)));
  const shown = (q: Data) => ({ label: es && q.es ? q.es.label : q.label, optionLabels: Object.fromEntries((q.options as string[]).map((v, n) => [v, es && q.es?.options ? q.es.options[n] : v])) });
  return { id: organizer.id, name: es && definition.es ? definition.es.name : definition.name, kind: definition.kind, version: definition.version, revision: organizer.revision, writable: j.status === 'open',
    labels: Object.fromEntries(ownLabels.map((q: Data) => [q.key, shown(q).label])), optionLabels: Object.fromEntries(ownLabels.map((q: Data) => [q.key, shown(q).optionLabels])),
    questions: definition.questions.filter((q: Data) => visible.has(q.key) && answers[q.key].contactId === contact.id)
      .map((q: Data) => ({ key: q.key, label: shown(q).label, optionLabels: shown(q).optionLabels, type: q.type, options: q.options, required: q.required, supportingUpload: !!q.request,
        value: answers[q.key].value, confirmed: answers[q.key].confirmed, carriedFrom: answers[q.key].carriedFrom,
        request: (r => r ? { ...r, label: es && q.es?.request ? q.es.request : r.label } : null)(requests.find(r => r.key === q.key && r.organizer_active)) })),
    submissions: history };
}

export async function saveOrganizer(env: Bindings, token: string, organizerId: string, body: Data) {
  const db = runtimeBindings(env).DB, { link, job: j, contact, organizer, answers } = await contactOrganizer(db, token, organizerId);
  insist(j.status === 'open', 'This organizer is closed for answers', 409);
  insist(body.revision === organizer.revision, 'Organizer changed; refresh before saving', 409);
  insist(body.answers && typeof body.answers === 'object' && !Array.isArray(body.answers), 'Supply your answers');
  insist(body.submit === undefined || typeof body.submit === 'boolean', 'Submit must be true or false');
  const patches = Object.entries(body.answers), statements: D1PreparedStatement[] = [];
  // Validate the whole payload before any write. Conditions use the proposed
  // parent answer, but an answer assigned to somebody else never crosses over.
  for (const [key, raw] of patches) {
    const q = organizer.definition.questions.find((q: Data) => q.key === key);
    insist(q && answers[key]?.contactId === contact.id, 'You cannot answer this question', 403);
    const next = checkedAnswer(q, raw); answers[key] = { ...answers[key], ...next };
    statements.push(stmt(db, 'UPDATE b_organizer_answers SET value=?,confirmed=?,carried_from=CASE WHEN ?=1 OR value IS NOT ? THEN NULL ELSE carried_from END,updated_by=?,updated_at=? WHERE organizer_id=? AND key=? AND contact_id=?', next.value || null, next.confirmed ? 1 : 0, next.confirmed ? 1 : 0, next.value || null, contact.id, now(), organizerId, key, contact.id));
  }
  const visible = visibleQuestions(organizer.definition, answers);
  for (const [key] of patches) insist(visible.has(key), 'A hidden organizer question cannot be answered', 409);
  let version: number | null = null;
  if (body.submit) {
    const own = organizer.definition.questions.filter((q: Data) => answers[q.key].contactId === contact.id && visible.has(q.key));
    insist(own.length, 'No current questions are assigned to you', 409);
    const missing = own.filter((q: Data) => q.required && (!answers[q.key].confirmed || !answers[q.key].value));
    insist(!missing.length, `Confirm the current answers for: ${missing.map((q: Data) => q.label).join(', ')}`, 409);
    const submitted = Object.fromEntries(own.map((q: Data) => [q.key, { value: answers[q.key].confirmed ? answers[q.key].value : '', confirmed: answers[q.key].confirmed }]));
    version = Number((await stmt(db, 'SELECT COALESCE(MAX(version),0)+1 n FROM b_organizer_submissions WHERE organizer_id=?', organizerId).first<Data>())!.n);
    statements.push(stmt(db, 'INSERT INTO b_organizer_submissions(id,organizer_id,version,contact_id,answers,submitted_at) VALUES(?,?,?,?,?,?)', id(), organizerId, version, contact.id, JSON.stringify(submitted), now()));
    const effective = await submittedAnswers(db, organizerId, answers);
    // Replace this contact's entire submitted set, so a newly hidden answer
    // cannot survive from one of their earlier versions.
    for (const key of Object.keys(effective)) if (answers[key]?.contactId === contact.id) delete effective[key];
    Object.assign(effective, Object.fromEntries(Object.entries(submitted).map(([key, answer]) => [key, { ...(answer as Data), sourceContact: contact.id }])));
    statements.push(...await organizerProjection(db, organizer, effective, `contact:${contact.id}`));
  } else statements.push(...await organizerProjection(db, organizer, answers, `contact:${contact.id}`, false));
  const [fresh, freshDone] = guard(db, 'EXISTS(SELECT 1 FROM b_job_organizers WHERE id=? AND revision=? AND erased_at IS NULL)', organizerId, organizer.revision);
  const [access, accessDone] = guard(db, `EXISTS(SELECT 1 FROM b_portal_links l JOIN b_jobs j ON j.id=l.job_id WHERE l.id=? AND l.revoked_at IS NULL AND l.expires_at>? AND j.id=? AND j.status='open')`, link.id, now(), j.id);
  const [authorized, authorizedDone] = contactGuard(db, j.client_id, contact.id);
  const revision = id();
  try {
    await db.batch([fresh, access, authorized, ...statements,
      stmt(db, 'UPDATE b_job_organizers SET revision=? WHERE id=?', revision, organizerId),
      stmt(db, 'UPDATE b_jobs SET revision=? WHERE id=?', id(), j.id),
      stmt(db, 'INSERT INTO b_audit(id,actor,action,object_id,detail,at) VALUES(?,?,?,?,?,?)', id(), `contact:${contact.id}`, body.submit ? 'organizer.submitted' : 'organizer.saved', j.id, `${organizerId}${version ? `; version ${version}` : ''}`, now()),
      authorizedDone, accessDone, freshDone]);
  } catch (error) {
    if (/b_guard|constraint|UNIQUE/i.test(String(error))) insist(false, 'Organizer or your access changed; refresh before saving', 409);
    throw error;
  }
  if (body.submit) await advance(env, [j.id], `contact:${contact.id}`);
  return clientOrganizer(db, token, organizerId);
}
