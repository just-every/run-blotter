// WORK-008: adopted library releases are real, editable firm templates.
import { starter, starterCatalog } from './starter-releases';
import { applyChange, changes, publicTasks, releaseState } from './starter-diff';
import { templateWork } from './tasks';
import { firmCurrency } from './firm';
import { STAGES, STAGE_LABELS } from './statuses';
import { atomic, audit, digest, guard, human, id, insist, integer, lines, need, now, rows, stmt, text, type Actor, type Data } from './model';

export async function library(db: D1Database, actor: Actor) {
  const adoptions = await rows(db, 'SELECT a.*,t.name,t.starter_content FROM b_starter_adoptions a JOIN b_templates t ON t.id=a.template_id ORDER BY a.adopted_at');
  const catalog = await starterCatalog(db);
  return { templates: catalog.map(t => ({ ...t, latestVersion: t.versions.at(-1)!.version })),
    stages: STAGES.map(key => ({ key, label: STAGE_LABELS[key] })),
    adoptions: adoptions.map(a => ({ id: a.id, templateId: a.template_id, libraryId: a.library_id, version: a.version, revision: a.revision, name: a.name, content: JSON.parse(a.starter_content), latestVersion: catalog.find(t => t.id === a.library_id)!.versions.at(-1)!.version })) };
}
/** MSG-001 edits and archive actions are firm edits too; fold them into the three-way comparison. */
async function currentState(db: D1Database, a: Data) {
  const content = JSON.parse(a.starter_content), state = content.state;
  a.messageFence = [];
  for (const ref of content.messages) {
    const message = await stmt(db, `SELECT t.name,t.version,t.deleted_at,v.subject,v.body FROM b_msg_templates t JOIN b_msg_template_versions v ON v.template_id=t.id AND v.version=t.version WHERE t.id=?`, ref.id).first<Data>();
    a.messageFence.push({ id: ref.id, message });
    if (!message || message.deleted_at) delete state.messages[ref.key];
    else state.messages[ref.key] = { name: message.name, subject: message.subject, body: message.body };
  }
  return state;
}
async function adoption(db: D1Database, adoptionId: string) {
  const a = await stmt(db, 'SELECT a.*,t.name,t.starter_content FROM b_starter_adoptions a JOIN b_templates t ON t.id=a.template_id WHERE a.id=?', adoptionId).first<Data>();
  insist(a, 'Adoption not found', 404); return a;
}
/** Changed library text gets a fresh firm message; unchanged firm edits keep their version. */
async function messageCopies(db: D1Database, actor: Actor, adoptionId: string, state: Data) {
  const previous = await stmt(db, 'SELECT t.starter_content FROM b_templates t JOIN b_starter_adoptions a ON a.template_id=t.id WHERE a.id=?', adoptionId).first<Data>();
  const refs: Data[] = previous ? JSON.parse(previous.starter_content).messages : [];
  const statements: D1PreparedStatement[] = [], messages = [];
  for (const [key, m] of Object.entries(state.messages) as [string, Data][]) {
    const ref = refs.find(r => r.key === key);
    const current = ref ? await stmt(db, `SELECT t.name,t.version,t.deleted_at,v.subject,v.body FROM b_msg_templates t JOIN b_msg_template_versions v ON v.template_id=t.id AND v.version=t.version WHERE t.id=?`, ref.id).first<Data>() : null;
    const reuse = current && !current.deleted_at && current.name === m.name && current.subject === m.subject && current.body === m.body;
    const messageId = reuse ? ref!.id : 'sl-' + id(), version = reuse ? current.version : 1;
    if (!reuse) statements.push(stmt(db, `INSERT INTO b_msg_templates(id,scope,owner_email,name,category,version,created_by,created_at) VALUES(?,'firm',NULL,?,'US starter library',1,?,?)`, messageId, m.name, actor.email, now()),
      stmt(db, 'INSERT INTO b_msg_template_versions(template_id,version,subject,body,author,created_at) VALUES(?,1,?,?,?,?)', messageId, m.subject, m.body, actor.email, now()));
    messages.push({ key, id: messageId, version, ...m });
  }
  return { statements, messages };
}

async function stored(db: D1Database, actor: Actor, adoptionId: string, libraryId: string, version: number, state: Data) {
  const work = await templateWork(db, { tasks: publicTasks(state), requests: Object.values(state.requests) });
  const copies = await messageCopies(db, actor, adoptionId, state);
  return { work, statements: copies.statements, content: JSON.stringify({ libraryId, libraryName: (await starter(db, libraryId, version)).item.name, version, state, messages: copies.messages }) };
}
export async function adoptStarter(db: D1Database, actor: Actor, body: Data) {
  human(actor); need(actor, 'owner');
  const { item, release } = await starter(db, text(body.libraryId, 'Library template'), body.version === undefined ? undefined : Number(body.version));
  const adoptionId = id(), templateId = id(), revision = id(), at = now(), state = releaseState(release), name = text(body.name ?? item.name, 'Template name', 120);
  const built = await stored(db, actor, adoptionId, item.id, release.version, state), currency = await firmCurrency(db, body.currency);
  await atomic(db, actor, [...built.statements,
    stmt(db, 'INSERT INTO b_templates(id,name,recurrence,steps,requests,questions,fee_cents,created_by,created_at,currency,starter_content) VALUES(?,?,?,?,?,?,0,?,?,?,?)', templateId, name, item.recurrence, JSON.stringify(built.work.steps), JSON.stringify(built.work.requests), '[]', actor.email, at, currency, built.content),
    stmt(db, 'INSERT INTO b_work_types(id,name,template_id,budget_minutes,created_by,created_at) VALUES(?,?,?,?,?,?)', 'wt-' + templateId, name, templateId, state.budgetMinutes, actor.email, at),
    stmt(db, 'INSERT INTO b_starter_adoptions(id,library_id,version,template_id,baseline,revision,adopted_by,adopted_at) VALUES(?,?,?,?,?,?,?,?)', adoptionId, item.id, release.version, templateId, JSON.stringify(state), revision, actor.email, at),
    audit(db, actor, 'library.adopted', templateId, `${item.id} version ${release.version}`)]);
  return { id: adoptionId, templateId, revision };
}
async function save(db: D1Database, actor: Actor, a: Data, state: Data, version: number, baseline: Data, action: string) {
  const built = await stored(db, actor, a.id, a.library_id, version, state), revision = id();
  const [check, release] = guard(db, 'EXISTS(SELECT 1 FROM b_starter_adoptions WHERE id=? AND revision=?) AND EXISTS(SELECT 1 FROM b_templates WHERE id=? AND starter_content=?)', a.id, a.revision, a.template_id, a.starter_content);
  const messageGuards: D1PreparedStatement[] = [];
  for (const { id: messageId, message: m } of a.messageFence ?? []) {
    messageGuards.push(...(m
      ? guard(db, 'EXISTS(SELECT 1 FROM b_msg_templates WHERE id=? AND version=? AND deleted_at IS ? AND name=?)', messageId, m.version, m.deleted_at, m.name)
      : guard(db, 'NOT EXISTS(SELECT 1 FROM b_msg_templates WHERE id=?)', messageId)));
  }
  await atomic(db, actor, [check, ...messageGuards, ...built.statements,
    stmt(db, 'UPDATE b_templates SET steps=?,requests=?,starter_content=? WHERE id=?', JSON.stringify(built.work.steps), JSON.stringify(built.work.requests), built.content, a.template_id),
    stmt(db, 'UPDATE b_work_types SET budget_minutes=? WHERE id=?', state.budgetMinutes, 'wt-' + a.template_id),
    stmt(db, 'UPDATE b_starter_adoptions SET version=?,baseline=?,revision=? WHERE id=?', version, JSON.stringify(baseline), revision, a.id),
    audit(db, actor, action, a.template_id, `${a.library_id} version ${version}`), release]);
  return { id: a.id, templateId: a.template_id, revision, version };
}
export async function editStarterTask(db: D1Database, actor: Actor, adoptionId: string, body: Data) {
  human(actor); need(actor, 'owner'); const a = await adoption(db, adoptionId);
  insist(a.revision === body.revision, 'Template changed; refresh before editing', 409);
  const content = { state: await currentState(db, a) }, key = text(body.key, 'Task');
  insist(Object.hasOwn(content.state.tasks, key), 'Task not found', 404);
  insist(body.task && typeof body.task === 'object' && !Array.isArray(body.task), 'Supply a task');
  content.state.tasks[key] = body.task;
  return save(db, actor, a, content.state, a.version, JSON.parse(a.baseline), 'library.task_edited');
}
async function updatePreview(db: D1Database, a: Data, state: Data) {
  const { release } = await starter(db, a.library_id), diff = changes(JSON.parse(a.baseline), state, releaseState(release));
  return { id: a.id, fromVersion: a.version, toVersion: release.version, changes: diff,
    token: await digest(JSON.stringify({ revision: a.revision, content: a.starter_content, current: state, version: release.version, diff })) };
}
export async function previewStarter(db: D1Database, actor: Actor, adoptionId: string) {
  need(actor, 'owner'); const a = await adoption(db, adoptionId);
  return updatePreview(db, a, await currentState(db, a));
}

export async function updateStarter(db: D1Database, actor: Actor, adoptionId: string, body: Data) {
  human(actor); need(actor, 'owner'); const a = await adoption(db, adoptionId), state = await currentState(db, a), preview = await updatePreview(db, a, state);
  insist(body.token === preview.token, 'Library or firm template changed; preview again', 409);
  insist(preview.changes.length, 'No library changes are available', 409);
  const choices = body.choices ?? {};
  insist(Object.keys(choices).length === preview.changes.length, 'Choose accept or ignore for every change');
  for (const change of preview.changes) {
    insist(['accept', 'ignore'].includes(choices[change.key]), 'Choose accept or ignore for every change');
    if (choices[change.key] === 'accept') { insist(!change.conflict, 'This change conflicts with a firm edit; keep the firm edit', 409); applyChange(state, change.key, change.after); }
  }
  return save(db, actor, a, state, preview.toVersion, releaseState((await starter(db, a.library_id, preview.toVersion)).release), 'library.updated');
}

/** Firm-owned requests and budget are editable independently of library releases. */
export async function editStarterDetails(db: D1Database, actor: Actor, adoptionId: string, body: Data) {
  human(actor); need(actor, 'owner'); const a = await adoption(db, adoptionId);
  insist(a.revision === body.revision, 'Template changed; refresh before editing', 409);
  const state = await currentState(db, a), requested = lines(body.requests, 'Client requests');
  state.requests = Object.fromEntries(requested.map((value, n) => {
    const existing = Object.entries(state.requests).find(([, text]) => text === value);
    return [existing?.[0] ?? 'firm-' + n + '-' + id(), value];
  }));
  state.budgetMinutes = integer(body.budgetMinutes, 'Budget minutes', 1, 100_000);
  return save(db, actor, a, state, a.version, JSON.parse(a.baseline), 'library.details_edited');
}
