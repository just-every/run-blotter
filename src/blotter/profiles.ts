// Client groups, tags and firm-defined fields (CRM-002). Field values are typed
// and validated the same way for the app, the HTTP API and the client CSV import;
// a required field must have a value on every client created or changed after it
// exists. A segment (group, tag or field value) feeds bulk scheduling and a
// previewed bulk field change that only touches the clients it lists.
import { atomic, audit, date, digest, guard, human, id, insist, need, now, rows, stmt, text, type Actor, type Data } from './model';

export type FieldDef = { key: string; label: string; type: 'text' | 'number' | 'date' | 'choice'; choices: string; required: number };
const RELATIONSHIPS = ['parent', 'subsidiary', 'household', 'member'];
const MAX_LINES = 200;

export const fieldDefs = async (db: D1Database) => rows(db, 'SELECT * FROM b_client_fields ORDER BY label') as Promise<FieldDef[]>;

/** One field's value as stored (always a string), or a message saying why it is invalid. */
export function fieldValue(def: FieldDef, raw: unknown): { value: string } | { error: string } {
  const value = raw === undefined || raw === null ? '' : String(raw).trim();
  if (!value) return def.required ? { error: `${def.label} is required` } : { value: '' };
  if (value.length > 200) return { error: `${def.label} must be at most 200 characters` };
  if (def.type === 'number') return /^-?\d+(\.\d+)?$/.test(value) ? { value: String(Number(value)) } : { error: `${def.label} must be a number` };
  if (def.type === 'date') { try { return { value: date(value, def.label) }; } catch { return { error: `${def.label}: use a valid YYYY-MM-DD date` }; } }
  if (def.type === 'choice') { const choices: string[] = JSON.parse(def.choices); return choices.includes(value) ? { value } : { error: `${def.label} must be one of: ${choices.join(', ')}` }; }
  return { value };
}

/** Merges submitted values into a client's fields; every required field must end up with a value. */
export function profileFields(defs: FieldDef[], input: unknown, current: Record<string, string> = {}) {
  insist(input === undefined || (input && typeof input === 'object' && !Array.isArray(input)), 'Fields must be an object of field keys and values');
  const submitted = (input ?? {}) as Data, merged: Record<string, string> = { ...current };
  for (const key of Object.keys(submitted)) insist(defs.some(d => d.key === key), `Unknown client field: ${key}`);
  for (const def of defs) {
    const result = fieldValue(def, def.key in submitted ? submitted[def.key] : merged[def.key]);
    insist(!('error' in result), 'error' in result ? result.error : '');
    if (result.value) merged[def.key] = result.value; else delete merged[def.key];
  }
  return merged;
}
export function tagList(input: unknown) {
  const list = (Array.isArray(input) ? input : typeof input === 'string' ? input.split(/[;,]/) : []).map(t => String(t).trim().toLowerCase()).filter(Boolean);
  insist(list.length <= 20 && list.every(t => t.length <= 40), 'Use at most 20 tags of up to 40 characters');
  return [...new Set(list)].sort();
}

export async function defineField(db: D1Database, actor: Actor, body: Data) {
  human(actor); need(actor, 'owner', 'reviewer');
  const key = text(body.key, 'Field key', 40).toLowerCase();
  insist(/^[a-z][a-z0-9_]*$/.test(key), 'Field key: start with a letter; use lowercase letters, digits and underscores');
  insist(['text', 'number', 'date', 'choice'].includes(body.type), 'Choose text, number, date or choice');
  const choices = body.type !== 'choice' ? [] : (Array.isArray(body.choices) ? body.choices : String(body.choices ?? '').split(/[;,]/)).map((c: unknown) => String(c).trim()).filter(Boolean);
  insist(body.type !== 'choice' || (choices.length > 0 && choices.length <= 30 && choices.every((c: string) => c.length <= 100)), 'List between 1 and 30 choices');
  insist(!await stmt(db, 'SELECT 1 FROM b_client_fields WHERE key=?', key).first(), 'A field with that key already exists', 409);
  await atomic(db, actor, [
    stmt(db, 'INSERT INTO b_client_fields(key,label,type,choices,required,created_by,created_at) VALUES(?,?,?,?,?,?,?)', key, text(body.label, 'Field name', 100), body.type, JSON.stringify(choices), body.required === true ? 1 : 0, actor.email, now()),
    audit(db, actor, 'client_field.defined', key, body.type)]);
  return fieldDefs(db);
}

/** Changes one client's fields and tags; the same validation as creation. */
export async function saveProfile(db: D1Database, actor: Actor, clientId: string, body: Data) {
  human(actor); need(actor, 'owner', 'reviewer');
  const client = await stmt(db, 'SELECT * FROM b_clients WHERE id=?', clientId).first<Data>();
  insist(client, 'Client not found', 404);
  insist(body.revision === undefined || body.revision === client.revision, 'The client changed. Refresh and try again.', 409);
  const fields = profileFields(await fieldDefs(db), body.fields, JSON.parse(client.fields));
  const tags = body.tags === undefined ? JSON.parse(client.tags) : tagList(body.tags);
  const [check, release] = guard(db, 'EXISTS(SELECT 1 FROM b_clients WHERE id=? AND revision=?)', client.id, client.revision);
  await atomic(db, actor, [check, stmt(db, 'UPDATE b_clients SET fields=?,tags=?,revision=? WHERE id=?', JSON.stringify(fields), JSON.stringify(tags), id(), client.id), release,
    audit(db, actor, 'client.profile_saved', client.id, JSON.stringify({ fields, tags }))]);
  return stmt(db, 'SELECT * FROM b_clients WHERE id=?', client.id).first<Data>();
}

export async function saveGroup(db: D1Database, actor: Actor, body: Data) {
  human(actor); need(actor, 'owner', 'reviewer');
  const existing = body.groupId ? await stmt(db, 'SELECT * FROM b_client_groups WHERE id=?', String(body.groupId)).first<Data>() : null;
  insist(!body.groupId || existing, 'Group not found', 404);
  const groupId = existing?.id ?? id(), at = now();
  const name = existing ? existing.name : text(body.name, 'Group name', 120);
  if (!existing) insist(!await stmt(db, 'SELECT 1 FROM b_client_groups WHERE name=?', name).first(), 'A group with that name already exists', 409);
  insist(Array.isArray(body.members) && body.members.length > 0 && body.members.length <= 50, 'Add between 1 and 50 clients');
  const members: D1PreparedStatement[] = [];
  for (const m of body.members as Data[]) {
    insist(await stmt(db, 'SELECT 1 FROM b_clients WHERE id=?', text(m?.clientId, 'Client')).first(), 'Client not found', 404);
    insist(RELATIONSHIPS.includes(m.relationship), 'Relationship must be parent, subsidiary, household or member');
    members.push(stmt(db, 'INSERT INTO b_client_group_members(group_id,client_id,relationship,added_by,added_at) VALUES(?,?,?,?,?) ON CONFLICT(group_id,client_id) DO UPDATE SET relationship=excluded.relationship', groupId, m.clientId, m.relationship, actor.email, at));
  }
  await atomic(db, actor, [
    ...(existing ? [] : [stmt(db, 'INSERT INTO b_client_groups(id,name,created_by,created_at) VALUES(?,?,?,?)', groupId, name, actor.email, at)]),
    ...members, audit(db, actor, 'client_group.saved', groupId, name)]);
  return groups(db);
}
export async function groups(db: D1Database) {
  const [list, members] = await Promise.all([rows(db, 'SELECT * FROM b_client_groups ORDER BY name'),
    rows(db, 'SELECT m.*,c.name client FROM b_client_group_members m JOIN b_clients c ON c.id=m.client_id ORDER BY c.name')]);
  return list.map(g => ({ ...g, members: members.filter(m => m.group_id === g.id) }));
}

/** Clients in a group, with a tag, and/or with one field value. */
export async function segment(db: D1Database, actor: Actor, query: Data) {
  need(actor, 'owner', 'reviewer');
  const groupId = String(query.groupId ?? ''), tag = String(query.tag ?? '').trim().toLowerCase(), field = String(query.field ?? ''), value = String(query.value ?? '');
  insist(groupId || tag || field, 'Choose a group, a tag or a field');
  if (field) insist(/^[a-z][a-z0-9_]*$/.test(field), 'Unknown client field');
  return rows(db, `SELECT * FROM b_clients c WHERE (?='' OR c.id IN (SELECT client_id FROM b_client_group_members WHERE group_id=?))
    AND (?='' OR EXISTS(SELECT 1 FROM json_each(c.tags) WHERE value=?)) AND (?='' OR json_extract(c.fields,'$.'||?)=?) ORDER BY c.name`,
    groupId, groupId, tag, tag, field, field, value);
}

/** Each listed client's current and new value, with invalid values rejected line by line. */
export async function previewFields(db: D1Database, actor: Actor, body: Data) {
  human(actor); need(actor, 'owner', 'reviewer');
  const def = (await fieldDefs(db)).find(d => d.key === body.key);
  insist(def, 'Unknown client field', 404);
  insist(Array.isArray(body.lines) && body.lines.length > 0 && body.lines.length <= MAX_LINES, `Choose between 1 and ${MAX_LINES} clients`);
  const seen = new Set<string>(), lines: Data[] = [];
  for (const line of body.lines as Data[]) {
    const clientId = text(line?.clientId, 'Client');
    insist(!seen.has(clientId), 'Each client can appear once'); seen.add(clientId);
    const client = await stmt(db, 'SELECT id,name,fields,revision FROM b_clients WHERE id=?', clientId).first<Data>();
    insist(client, 'Client not found', 404);
    const from = JSON.parse(client.fields)[def.key] ?? '', result = fieldValue(def, line.value);
    const base = { clientId, client: client.name, revision: client.revision, from };
    lines.push('error' in result ? { ...base, to: String(line.value ?? ''), action: 'rejected', reason: result.error }
      : { ...base, to: result.value, action: result.value === from ? 'unchanged' : 'change', reason: '' });
  }
  const plan = { key: def.key, label: def.label, lines };
  return { ...plan, fingerprint: await digest(JSON.stringify(plan)) };
}

/** Applies the previewed changes only; rejected and unchanged lines, and every other client, stay as they were. */
export async function commitFields(db: D1Database, actor: Actor, body: Data) {
  const plan = await previewFields(db, actor, body);
  insist(body.fingerprint === plan.fingerprint, 'The clients changed since the preview. Preview again before applying.', 409);
  const changes = plan.lines.filter(l => l.action === 'change');
  insist(changes.length > 0, 'Nothing to change', 409);
  const statements = changes.flatMap(l => {
    const [check, release] = guard(db, 'EXISTS(SELECT 1 FROM b_clients WHERE id=? AND revision=?)', l.clientId, l.revision);
    return [check, stmt(db, `UPDATE b_clients SET fields=CASE WHEN ?='' THEN json_remove(fields,'$.'||?) ELSE json_set(fields,'$.'||?,?) END,revision=? WHERE id=?`, l.to, plan.key, plan.key, l.to, id(), l.clientId), release];
  });
  await atomic(db, actor, [...statements, audit(db, actor, 'client_field.bulk_changed', plan.key, `${changes.length} clients; ${plan.lines.length - changes.length} unchanged or rejected`)]);
  return { ...plan, changed: changes.map(l => l.clientId) };
}
