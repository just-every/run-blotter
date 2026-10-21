// MIGRATE-006: reviewed native mappings, not an incumbent export parser.
import { eligible } from './jobs';
import { periods, ruleBody, ruleInsert } from './recurrence';
import { atomic, audit, digest, Fault, guard, human, id, insist, need, now, rows, stmt, text, type Actor, type Data } from './model';

const sources = ['karbon', 'taxdome', 'canopy', 'financial-cents', 'double'];
const fields = ['clientId', 'templateId', 'frequency', 'firstPeriod', 'endPeriod', 'months', 'leadMonths', 'dueDays', 'dueNote', 'preparerEmail', 'reviewerEmail', 'managerEmail', 'budgetMinutes'];
const canonical = (value: any): string => JSON.stringify(value, (_, v) => v && typeof v === 'object' && !Array.isArray(v)
  ? Object.fromEntries(Object.keys(v).sort().map(k => [k, v[k]])) : v);
const authority = (actor: Actor) => { human(actor); need(actor, 'owner'); };

function input(body: Data) {
  const source = text(body.source, 'Source', 30);
  insist(sources.includes(source), 'Choose Karbon, TaxDome, Canopy, Financial Cents or Double');
  insist(body.mapping && typeof body.mapping === 'object' && !Array.isArray(body.mapping), 'Provide the reviewed native mapping');
  insist(Array.isArray(body.items) && body.items.length <= 12, 'Map at most twelve existing future jobs per series');
  const items = body.items.map((item: Data) => ({ sourceItemId: text(item.sourceItemId, 'Source item ID', 200), jobId: text(item.jobId, 'Existing native job ID', 100) }))
    .sort((a: Data, b: Data) => a.sourceItemId.localeCompare(b.sourceItemId));
  insist(new Set(items.map((i: Data) => i.sourceItemId)).size === items.length && new Set(items.map((i: Data) => i.jobId)).size === items.length, 'Source item IDs and native job IDs must each be unique');
  return { source, practiceId: text(body.practiceId, 'Source practice ID', 200), seriesId: text(body.seriesId, 'Source series ID', 200),
    sourceNote: text(body.sourceNote, 'Where the source definition was checked', 1000), ownerEmail: text(body.ownerEmail, 'Review owner', 254).toLowerCase(), mapping: body.mapping, items };
}
async function stored(db: D1Database, value: Data) {
  return stmt(db, 'SELECT * FROM b_recurrence_imports WHERE source=? AND practice_id=? AND series_id=?', value.source, value.practiceId, value.seriesId).first<Data>();
}

async function inspect(db: D1Database, value: ReturnType<typeof input>) {
  const previous = await stored(db, value), problems: string[] = [], snapshots: { table: string; key: string; row: Data }[] = [];
  let rule: Data | undefined;
  const items: Data[] = [];
  insist(await eligible(db, value.ownerEmail, ['preparer', 'reviewer']), 'Choose an active practice member as the review owner');
  try {
    insist(Object.keys(value.mapping).every(k => fields.includes(k)), 'Mapping contains unsupported fields; retain the series for review');
    // Obligation remapping and source carry-forward content are intentionally outside this native slice.
    rule = await ruleBody(db, value.mapping);
    insist(value.mapping.frequency === rule.recurrence, 'Source frequency must exactly match the mapped template cadence');
    const template = (await stmt(db, 'SELECT * FROM b_templates WHERE id=?', rule.template_id).first<Data>())!;
    const client = (await stmt(db, 'SELECT * FROM b_clients WHERE id=?', rule.client_id).first<Data>())!;
    snapshots.push({ table: 'b_templates', key: 'id', row: template }, { table: 'b_clients', key: 'id', row: client });
    const conflicting = await stmt(db, 'SELECT id FROM b_recurrence_rules WHERE client_id=? AND template_id=?', rule.client_id, rule.template_id).first<Data>();
    insist(!conflicting || conflicting.id === previous?.rule_id, 'Another rule already owns this client/template; the source series cannot be merged into it');
    for (const item of value.items) {
      const j = await stmt(db, 'SELECT * FROM b_jobs WHERE id=?', item.jobId).first<Data>();
      insist(j && j.client_id === rule.client_id && j.template_id === rule.template_id, `Source item ${item.sourceItemId} must map to this client and template`);
      insist(periods(rule, rule.recurrence, j.period_start).at(-1) === j.period_start, `Source item ${item.sourceItemId} is outside the rule's periods`);
      const held = await stmt(db, 'SELECT * FROM b_rule_periods WHERE job_id=?', j.id).first<Data>();
      insist(!held || held.rule_id === previous?.rule_id, `Source item ${item.sourceItemId} is already held by another rule`);
      const bound = await stmt(db, 'SELECT * FROM b_recurrence_import_items WHERE (source=? AND practice_id=? AND item_id=?) OR job_id=?', value.source, value.practiceId, item.sourceItemId, j.id).first<Data>();
      insist(!bound || bound.import_id === previous?.id, `Source item ${item.sourceItemId} or its native job already belongs to another source series`);
      snapshots.push({ table: 'b_jobs', key: 'id', row: j });
      items.push({ ...item, periodStart: j.period_start, title: j.title, status: j.status, preparerEmail: j.preparer_email, reviewerEmail: j.reviewer_email, dueDate: j.due_date });
    }
  } catch (error) {
    if (!(error instanceof Fault) || ![400, 404].includes(error.status)) throw error;
    problems.push(error.message);
  }
  const people = await rows(db, `SELECT email,role,active FROM b_members WHERE email IN (SELECT value FROM json_each(?)) ORDER BY email`,
    JSON.stringify([value.ownerEmail, value.mapping.preparerEmail, value.mapping.reviewerEmail, value.mapping.managerEmail].filter(Boolean)));
  return { previous, problems, rule, items, snapshots, people };
}

export async function previewRecurrenceImport(db: D1Database, actor: Actor, body: Data) {
  authority(actor);
  const value = input(body), state = await inspect(db, value);
  const changed = state.previous?.disposition === 'mapped' && state.previous.definition !== canonical(value);
  return { source: value.source, practiceId: value.practiceId, seriesId: value.seriesId, ownerEmail: value.ownerEmail,
    disposition: changed || state.problems.length ? 'held' : 'ready', problems: changed ? ['This source series is already mapped; changed replays cannot alter its rule or native work'] : state.problems,
    rule: state.problems.length ? null : state.rule, items: state.items,
    replayed: state.previous?.disposition === 'mapped' && !changed,
    previewToken: await digest(canonical({ value, state })) };
}

/** Compare complete native rows again inside the same batch as the claims. */
function sameRow(db: D1Database, table: string, row: Data) {
  const columns = Object.keys(row);
  return guard(db, `EXISTS(SELECT 1 FROM ${table} WHERE ${columns.map(k => `"${k}" IS ?`).join(' AND ')})`, ...columns.map(k => row[k]));
}
function personGuard(db: D1Database, address: string, roles: string[]) {
  return guard(db, `EXISTS(SELECT 1 FROM b_members WHERE email=? AND active=1 AND role IN (SELECT value FROM json_each(?)))
    OR EXISTS(SELECT 1 FROM oa_operators WHERE email=? AND role='owner' AND status='active')`, address, JSON.stringify(roles), address);
}

export async function commitRecurrenceImport(db: D1Database, actor: Actor, body: Data) {
  authority(actor);
  const value = input(body), definition = canonical(value), state = await inspect(db, value), previous = state.previous;
  if (previous?.disposition === 'mapped') {
    insist(previous.definition === definition, 'This source series is already mapped; changed replays cannot alter native work', 409);
    return { id: previous.id, ruleId: previous.rule_id, disposition: 'mapped', replayed: true };
  }
  insist(body.previewToken === await digest(canonical({ value, state })), 'Review the current source mapping and native work before committing', 409);
  const importId = previous?.id ?? id(), ruleId = state.problems.length ? null : id(), at = now();
  const statements: D1PreparedStatement[] = [];
  const checks = [previous ? sameRow(db, 'b_recurrence_imports', previous) : guard(db,
    'NOT EXISTS(SELECT 1 FROM b_recurrence_imports WHERE source=? AND practice_id=? AND series_id=?)', value.source, value.practiceId, value.seriesId),
    personGuard(db, value.ownerEmail, ['preparer', 'reviewer'])];
  if (ruleId && state.rule) {
    const r = state.rule;
    checks.push(...state.snapshots.map(s => sameRow(db, s.table, s.row)), personGuard(db, r.preparer_email, ['preparer', 'reviewer']), personGuard(db, r.reviewer_email, ['reviewer']));
    if (r.manager_email) checks.push(personGuard(db, r.manager_email, ['reviewer']));
    statements.push(ruleInsert(db, actor, ruleId, r, true));
  }
  statements.push(stmt(db, `INSERT INTO b_recurrence_imports(id,source,practice_id,series_id,definition,owner_email,disposition,reason,rule_id,revision,created_by,created_at,updated_by,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(source,practice_id,series_id) DO UPDATE SET definition=excluded.definition,owner_email=excluded.owner_email,
    disposition=excluded.disposition,reason=excluded.reason,rule_id=excluded.rule_id,revision=excluded.revision,updated_by=excluded.updated_by,updated_at=excluded.updated_at`,
    importId, value.source, value.practiceId, value.seriesId, definition, value.ownerEmail, ruleId ? 'mapped' : 'held', state.problems.join('; '), ruleId, id(), actor.email, at, actor.email, at));
  if (ruleId) for (const item of state.items) statements.push(
    stmt(db, "INSERT INTO b_rule_periods(rule_id,period_start,kind,job_id,note,by_email,at) VALUES(?,?,'claimed',?,?,?,?)", ruleId, item.periodStart, item.jobId, `Source ${value.source}: ${item.sourceItemId}`, actor.email, at),
    stmt(db, 'INSERT INTO b_recurrence_import_items(import_id,source,practice_id,item_id,job_id,period_start) VALUES(?,?,?,?,?,?)', importId, value.source, value.practiceId, item.sourceItemId, item.jobId, item.periodStart));
  await atomic(db, actor, [...checks.map(c => c[0]), ...statements,
    audit(db, actor, ruleId ? 'recurrence.import_mapped' : 'recurrence.import_held', importId, canonical({ source: value.source, practiceId: value.practiceId, seriesId: value.seriesId, ruleId, ownerEmail: value.ownerEmail, items: state.items, problems: state.problems })), ...checks.map(c => c[1])]);
  return { id: importId, ruleId, disposition: ruleId ? 'mapped' : 'held', replayed: false };
}

export async function recurrenceImports(db: D1Database, actor: Actor) {
  authority(actor);
  return { series: await rows(db, 'SELECT * FROM b_recurrence_imports ORDER BY source,practice_id,series_id'),
    items: await rows(db, 'SELECT * FROM b_recurrence_import_items ORDER BY source,practice_id,item_id') };
}
