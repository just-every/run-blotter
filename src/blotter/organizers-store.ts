import { organizerTemplate, validateOrganizerWorkflow, visibleQuestions, type OrganizerDefinition } from './organizers-definition';
import { atomic, audit, guard, human, id, insist, job, need, now, rows, stmt, text, visibleJobParams, visibleJobSql, type Actor, type Data } from './model';

export { organizerTemplate } from './organizers-definition';

/** Called inside the same atomic batch that starts or rolls a job forward. */
export function organizerJobStatements(db: D1Database, actor: Actor, template: Data, values: Data): D1PreparedStatement[] {
  const definition = organizerTemplate(template.organizer);
  if (!definition) return [];
  const organizerId = 'organizer:' + values.id;
  const statements = [stmt(db, 'INSERT INTO b_job_organizers(id,job_id,definition,revision,created_by,created_at) VALUES(?,?,?,?,?,?)', organizerId, values.id, JSON.stringify(definition), id(), actor.email, now())];
  for (const q of definition.questions) {
    // Only submitted originals supply carry-forward. Drafts never become
    // prior-period evidence and every carried answer starts unconfirmed.
    const source = `FROM b_organizer_submissions s JOIN b_job_organizers o ON o.id=s.organizer_id JOIN b_jobs j ON j.id=o.job_id, json_each(s.answers) a
      WHERE j.client_id=? AND j.template_id=? AND j.period_start<? AND o.erased_at IS NULL AND s.erased_at IS NULL AND a.key=?
      AND s.version=(SELECT MAX(s2.version) FROM b_organizer_submissions s2 WHERE s2.organizer_id=o.id AND s2.contact_id=s.contact_id AND s2.erased_at IS NULL)
      AND json_extract(a.value,'$.confirmed')=1 AND (?='text' OR json_extract(a.value,'$.value') IN(SELECT value FROM json_each(?)))
      ORDER BY j.period_start DESC,s.version DESC LIMIT 1`;
    const params = [values.clientId, template.id, values.periodStart, q.key, q.type, JSON.stringify(q.options)];
    statements.push(stmt(db, `INSERT INTO b_organizer_answers(organizer_id,key,value,carried_from)
      VALUES(?,?,(SELECT json_extract(a.value,'$.value') ${source}),(SELECT s.id ${source}))`, organizerId, q.key, ...params, ...params));
  }
  return statements;
}

export async function storedOrganizer(db: D1Database, organizerId: string): Promise<Data & { definition: OrganizerDefinition }> {
  const organizer = await stmt(db, 'SELECT * FROM b_job_organizers WHERE id=?', organizerId).first<Data>();
  insist(organizer, 'Organizer not found', 404);
  return { ...organizer, definition: JSON.parse(organizer.definition) as OrganizerDefinition };
}
export async function organizerAnswers(db: D1Database, organizerId: string): Promise<Data> {
  return Object.fromEntries((await rows(db, 'SELECT * FROM b_organizer_answers WHERE organizer_id=?', organizerId)).map(a => [a.key,
    { value: a.value ?? '', confirmed: !!a.confirmed, contactId: a.contact_id, carriedFrom: a.carried_from, updatedBy: a.updated_by, updatedAt: a.updated_at }]));
}
export function organizerStaffGuard(db: D1Database, actor: Actor, jobId: string) {
  return guard(db, `EXISTS(SELECT 1 FROM b_jobs WHERE id=? AND status='open' AND ${visibleJobSql})`, jobId, ...visibleJobParams(actor));
}
export async function writableOrganizer(db: D1Database, actor: Actor, organizerId: string) {
  human(actor);
  const organizer = await storedOrganizer(db, organizerId), j = await job(db, actor, organizer.job_id);
  insist(j.status === 'open' && !organizer.erased_at, 'This organizer is closed', 409);
  return { organizer, job: j };
}

export async function listOrganizers(db: D1Database, actor: Actor, jobId: string) {
  const j = await job(db, actor, jobId);
  const organizers = [];
  for (const row of await rows(db, 'SELECT id FROM b_job_organizers WHERE job_id=?', j.id)) {
    const organizer = await storedOrganizer(db, row.id);
    const answers = await organizerAnswers(db, row.id);
    const submissions = (await rows(db, 'SELECT * FROM b_organizer_submissions WHERE organizer_id=? ORDER BY version', row.id)).map(s => ({ ...s, answers: s.answers ? JSON.parse(s.answers) : null })) as Data[];
    const submitted: Data = {}, contactsSeen = new Set<string>();
    for (const s of submissions.toReversed()) {
      if (contactsSeen.has(s.contact_id)) continue;
      contactsSeen.add(s.contact_id);
      for (const [key, answer] of Object.entries(s.answers ?? {})) if (answers[key]?.contactId === s.contact_id) submitted[key] = answer;
    }
    const visible = visibleQuestions(organizer.definition, submitted);
    const required = organizer.definition.questions.filter(q => q.required && visible.has(q.key));
    const unresolved = required.filter(q => !submitted[q.key]?.confirmed || !submitted[q.key]?.value).map(q => ({ key: q.key, label: q.label, contactId: answers[q.key]?.contactId }));
    organizers.push({ ...organizer, answers, submissions,
      applicable: [...visible], completeness: { required: required.length, confirmed: required.length - unresolved.length, unresolved },
      requests: await rows(db, 'SELECT m.key,r.* FROM b_organizer_requests m JOIN b_requests r ON r.id=m.request_id WHERE m.organizer_id=? ORDER BY r.ordinal', row.id),
      deliveries: await rows(db, 'SELECT * FROM b_organizer_deliveries WHERE organizer_id=? ORDER BY sent_at,id', row.id) });
  }
  const contacts = await rows(db, 'SELECT id,name,email,active,authorized,portal,request_consent,email_consent FROM b_client_contacts WHERE client_id=? ORDER BY name,id', j.client_id);
  return { organizers, contacts, writable: j.status === 'open' };
}

/** Editing a definition creates a new version; already-started work keeps its snapshot. */
export async function saveOrganizerVersion(db: D1Database, actor: Actor, templateId: string, body: Data) {
  human(actor); need(actor, 'owner', 'reviewer');
  const template = await stmt(db, 'SELECT * FROM b_templates WHERE id=?', templateId).first<Data>();
  insist(template, 'Work template not found', 404);
  const prior = organizerTemplate(template.organizer), definition = organizerTemplate(body.organizer);
  insist(definition, 'Supply an organizer');
  const workflow = JSON.parse(template.questions ?? '[]') as Data[];
  validateOrganizerWorkflow(definition,workflow);
  insist(Number(body.expectedVersion ?? 0) === (prior?.version ?? 0), 'Organizer changed; refresh before publishing', 409);
  insist(definition.version === (prior?.version ?? 0) + 1, 'Publish the next organizer version', 409);
  const [check, release] = guard(db, 'EXISTS(SELECT 1 FROM b_templates WHERE id=? AND organizer IS ?)', templateId, template.organizer);
  await atomic(db, actor, [check,
    ...(prior ? [stmt(db, 'INSERT OR IGNORE INTO b_organizer_versions(template_id,version,definition,author,created_at) VALUES(?,?,?,?,?)', templateId, prior.version, JSON.stringify(prior), template.created_by, template.created_at)] : []),
    stmt(db, 'INSERT INTO b_organizer_versions(template_id,version,definition,author,created_at) VALUES(?,?,?,?,?)', templateId, definition.version, JSON.stringify(definition), actor.email, now()),
    stmt(db, 'UPDATE b_templates SET organizer=? WHERE id=?', JSON.stringify(definition), templateId), release,
    audit(db, actor, 'organizer.version_published', templateId, `version ${definition.version}`)]);
  return { templateId, organizer: definition };
}

export async function organizerVersions(db: D1Database, actor: Actor, templateId: string) {
  need(actor, 'owner', 'reviewer');
  const template = await stmt(db, 'SELECT * FROM b_templates WHERE id=?', templateId).first<Data>();
  insist(template, 'Work template not found', 404);
  const current = organizerTemplate(template.organizer);
  const versions: Data[] = (await rows(db, 'SELECT version,definition,author,created_at FROM b_organizer_versions WHERE template_id=? ORDER BY version', templateId)).map(v => ({ ...v, definition: JSON.parse(v.definition) }));
  return { templateId, organizer: current, versions: versions.sort((a, b) => a.version - b.version) };
}

export async function organizerReview(db: D1Database, actor: Actor, organizerId: string, body: Data) {
  const { job: j } = await writableOrganizer(db, actor, organizerId);
  const submission = await stmt(db, 'SELECT * FROM b_organizer_submissions WHERE id=? AND organizer_id=? AND erased_at IS NULL', text(body.submissionId, 'Submitted version'), organizerId).first<Data>();
  insist(submission, 'Submitted version not found', 404);
  insist(!submission.reviewed_at, 'This version was already reviewed', 409);
  const note = text(body.note, 'Review findings', 2000), [check, release] = organizerStaffGuard(db, actor, j.id);
  const [fresh, done] = guard(db, 'EXISTS(SELECT 1 FROM b_organizer_submissions WHERE id=? AND reviewed_at IS NULL)', submission.id);
  await atomic(db, actor, [check, fresh, stmt(db, 'UPDATE b_organizer_submissions SET reviewed_by=?,reviewed_at=?,review_note=? WHERE id=?', actor.email, now(), note, submission.id), done, release,
    audit(db, actor, 'organizer.reviewed', j.id, `${organizerId}; submission ${submission.version}`)]);
  return { ok: true };
}
