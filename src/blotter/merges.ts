// Merging duplicate clients and undoing a merge (CRM-004). The person chooses
// which client keeps its id (the survivor) and, for every field where the two
// differ, which value survives. The other client becomes a read-only record
// pointing at the survivor, so its source IDs and import identity stay attached.
// Its jobs (with their time, documents, deliverables, tasks and upload links),
// discussions, notices, expenses, recurring rules, rate cards and group
// memberships move to the survivor; the exact ids are recorded for undo.
// Authority (ct 19 Oct 03:36Z): different non-empty EINs or contact emails need
// the principal and a recorded reason; reviewers merge only agreeing or blank ones.
// Undo: for 30 days (until the merge time plus 30 x 24 hours) while the survivor
// is unchanged: no edit to it, no later merge, and no record added to or moved
// off it since. Changes inside the moved records travel back with them.
import { client, fieldRows, linked } from './duplicates';
import { atomic, audit, guard, human, id, insist, need, now, rows, stmt, text, type Actor, type Data } from './model';

const UNDO_MS = 30 * 24 * 60 * 60 * 1000;
/** What a client has linked, by the table that links it. Groups are memberships, merged separately. */
const TABLES: Record<string, string> = { jobs: 'b_jobs', threads: 'b_threads', notices: 'b_notices', expenses: 'b_expenses', rules: 'b_recurrence_rules', rates: 'b_rate_cards', groups: 'b_client_group_members' };
const COUNTED = Object.keys(TABLES);
const ROW = ['name', 'abn', 'contact_name', 'contact_email', 'source', 'fields', 'tags', 'revision'];
const pick = (c: Data) => Object.fromEntries(ROW.map(k => [k, c[k]]));
const MOVED = COUNTED.filter(k => k !== 'groups').map(k => [k, TABLES[k]]);
const counts = (l: Data) => Object.fromEntries(COUNTED.map(k => [k, Number(l[k])]));
/** A guard that the client still has exactly these numbers of linked records. */
const sameCounts = (db: D1Database, clientId: string, c: Data) =>
  guard(db, COUNTED.map(k => `(SELECT COUNT(*) FROM ${TABLES[k]} WHERE client_id=?)=?`).join(' AND '), ...COUNTED.flatMap(k => [clientId, c[k]]));

function differs(a: string, b: string) { return Boolean(a && b && a.toLowerCase() !== b.toLowerCase()); }
/** Different non-empty EINs or contact emails mean two entities unless the principal records why they are one. */
export function needsAuthority(a: Data, b: Data) { return differs(a.abn, b.abn) || differs(a.contact_email, b.contact_email); }

export async function mergeClients(db: D1Database, actor: Actor, body: Data) {
  human(actor); need(actor, 'owner', 'reviewer');
  const [s, m] = [await client(db, body.survivor), await client(db, body.merged)];
  insist(s.id !== m.id, 'Choose two different clients');
  insist(!s.merged_into && !m.merged_into, 'One of these clients was already merged', 409);
  let authority = '';
  if (needsAuthority(s, m)) {
    insist(actor.role === 'owner', 'These clients have different EINs or contact emails; only the principal can merge them, with a recorded reason', 403);
    authority = text(body.authority, 'Why these are one client (the surviving contact is authorized for both)', 500);
  }
  // Every differing field needs a choice; the survivor keeps its own source.
  const keep = (body.keep ?? {}) as Data, choices: Record<string, string> = {}, next: Data = { ...s, fields: JSON.parse(s.fields) };
  for (const f of fieldRows(s, m).filter(f => !f.same && f.key !== 'source')) {
    insist(keep[f.key] === 'survivor' || keep[f.key] === 'merged', `Choose which ${f.label} to keep`);
    choices[f.key] = keep[f.key];
    const value = keep[f.key] === 'survivor' ? f.a : f.b;
    if (!f.key.startsWith('fields.')) next[f.key] = value;
    else if (value) next.fields[f.key.slice(7)] = value; else delete next.fields[f.key.slice(7)];
  }
  // Two jobs for one template and period, or two rules for one template, cannot share a client.
  const clash = await rows(db, `SELECT t.name,a.period_start FROM b_jobs a JOIN b_jobs b ON b.template_id=a.template_id AND b.period_start=a.period_start JOIN b_templates t ON t.id=a.template_id
    WHERE a.client_id=? AND b.client_id=? UNION SELECT t.name,'recurring rule' FROM b_recurrence_rules a JOIN b_recurrence_rules b ON b.template_id=a.template_id JOIN b_templates t ON t.id=a.template_id
    WHERE a.client_id=? AND b.client_id=?`, s.id, m.id, s.id, m.id);
  insist(!clash.length, `Both clients have ${clash.map(c => `${c.name} ${c.period_start}`).join(', ')}; resolve the overlap before merging`, 409);
  const moved: Data = {};
  for (const [key, table] of MOVED) moved[key] = (await rows(db, `SELECT id FROM ${table} WHERE client_id=? ORDER BY id`, m.id)).map(r => r.id);
  // A membership in a group the survivor already belongs to is dropped and recorded for undo.
  moved.groups = await rows(db, `SELECT g.group_id,g.relationship,g.added_by,g.added_at,EXISTS(SELECT 1 FROM b_client_group_members x WHERE x.group_id=g.group_id AND x.client_id=?) dropped
    FROM b_client_group_members g WHERE g.client_id=? ORDER BY g.group_id`, s.id, m.id);
  const [before, from] = [counts(await linked(db, s.id)), counts(await linked(db, m.id))];
  const after = Object.fromEntries(COUNTED.map(k => [k, before[k] + from[k] - (k === 'groups' ? moved.groups.filter((g: Data) => g.dropped).length : 0)]));
  // What the client-list import last recorded for the survivor, so a re-import of its source still matches it.
  const seen = await stmt(db, 'SELECT * FROM b_client_import_rows WHERE id=?', s.id).first<Data>();
  const mergeId = id(), at = new Date(), revision = id();
  const [sOk, sDone] = guard(db, 'EXISTS(SELECT 1 FROM b_clients WHERE id=? AND revision=? AND merged_into IS NULL)', s.id, s.revision);
  const [mOk, mDone] = guard(db, 'EXISTS(SELECT 1 FROM b_clients WHERE id=? AND revision=? AND merged_into IS NULL)', m.id, m.revision);
  const [sSame, sSameDone] = sameCounts(db, s.id, before), [mSame, mSameDone] = sameCounts(db, m.id, from);
  await atomic(db, actor, [sOk, sDone, mOk, mDone, sSame, sSameDone, mSame, mSameDone,
    stmt(db, `INSERT INTO b_client_merges(id,survivor_id,merged_id,choices,authority,survivor_before,survivor_seen,revision_after,moved,linked_after,merged_by,merged_at,undo_until)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`, mergeId, s.id, m.id, JSON.stringify(choices), authority, JSON.stringify(pick(s)), JSON.stringify(pick(seen!)), revision,
      JSON.stringify(moved), JSON.stringify(after), actor.email, at.toISOString(), new Date(at.getTime() + UNDO_MS).toISOString()),
    ...MOVED.map(([, table]) => stmt(db, `UPDATE ${table} SET client_id=? WHERE client_id=?`, s.id, m.id)),
    stmt(db, 'DELETE FROM b_client_group_members WHERE client_id=? AND group_id IN (SELECT group_id FROM b_client_group_members WHERE client_id=?)', m.id, s.id),
    stmt(db, 'UPDATE b_client_group_members SET client_id=? WHERE client_id=?', s.id, m.id),
    stmt(db, 'UPDATE b_clients SET name=?,abn=?,contact_name=?,contact_email=?,fields=?,tags=?,revision=? WHERE id=?', next.name, next.abn, next.contact_name, next.contact_email, JSON.stringify(next.fields), next.tags, revision, s.id),
    stmt(db, 'UPDATE b_clients SET merged_into=? WHERE id=?', s.id, m.id),
    audit(db, actor, 'client.merged', s.id, `${m.name} into ${next.name}; moved ${COUNTED.map(k => `${from[k]} ${k}`).join(', ')}${authority ? `; authority: ${authority}` : ''}`)]);
  return (await merges(db, actor)).find(x => x.id === mergeId);
}

/** Merges, newest first: who merged what, what moved, the source IDs now on the survivor, and whether undo is still open. */
export async function merges(db: D1Database, actor: Actor) {
  need(actor, 'owner', 'reviewer');
  const list = await rows(db, `SELECT m.*,s.name survivor_name,s.revision survivor_revision,s.merged_into survivor_merged,c.name merged_name FROM b_client_merges m
    JOIN b_clients s ON s.id=m.survivor_id JOIN b_clients c ON c.id=m.merged_id ORDER BY m.merged_at DESC,m.id`);
  const at = now();
  return Promise.all(list.map(async m => {
    const unchanged = m.survivor_revision === m.revision_after && !m.survivor_merged
      && JSON.stringify(counts(await linked(db, m.survivor_id))) === JSON.stringify(counts(JSON.parse(m.linked_after)));
    const moved = JSON.parse(m.moved);
    return { id: m.id, survivor: { id: m.survivor_id, name: m.survivor_name }, merged: { id: m.merged_id, name: m.merged_name }, choices: JSON.parse(m.choices),
      authority: m.authority, moved: Object.fromEntries(Object.entries(moved).map(([k, v]) => [k, (v as unknown[]).length])), mergedBy: m.merged_by, mergedAt: m.merged_at,
      undoUntil: m.undo_until, undoneBy: m.undone_by, undoneAt: m.undone_at, sourceIds: await sourceIds(db, m.survivor_id),
      undo: m.undone_at ? 'undone' : at >= m.undo_until ? 'expired' : unchanged ? 'available' : 'changed' };
  }));
}

/** A client and every client merged into it (not undone), each with the import source IDs it carries. */
export async function sourceIds(db: D1Database, clientId: string) {
  return rows(db, `WITH RECURSIVE tree(id) AS (SELECT ? UNION SELECT c.id FROM b_clients c JOIN tree ON c.merged_into=tree.id)
    SELECT p.target_id client_id,json_extract(p.record_json,'$.sourceId') source_id FROM ik_provenance p JOIN tree ON tree.id=p.target_id
    WHERE p.target_kind='client' AND p.reversed=0 ORDER BY 2`, clientId);
}

/** The client a record now lives on: itself, or the survivor it was merged into. */
export async function survivorOf(db: D1Database, clientId: string) {
  return stmt(db, `WITH RECURSIVE up(id,next,depth) AS (SELECT id,merged_into,0 FROM b_clients WHERE id=? UNION ALL
    SELECT c.id,c.merged_into,up.depth+1 FROM b_clients c JOIN up ON c.id=up.next WHERE up.depth<50)
    SELECT c.id,c.name FROM up JOIN b_clients c ON c.id=up.id WHERE up.next IS NULL`, clientId).first<Data>();
}

export async function undoMerge(db: D1Database, actor: Actor, mergeId: string) {
  human(actor); need(actor, 'owner', 'reviewer');
  const m = await stmt(db, 'SELECT * FROM b_client_merges WHERE id=?', mergeId).first<Data>();
  insist(m, 'Merge not found', 404);
  insist(!m.authority || actor.role === 'owner', 'Only the principal can undo a merge made on their authority', 403);
  const state = (await merges(db, actor)).find(x => x.id === m.id)!;
  insist(state.undo !== 'undone', 'This merge was already undone', 409);
  insist(state.undo !== 'expired', 'The 30-day undo window for this merge has passed', 409);
  insist(state.undo === 'available', 'The surviving client changed after the merge, so it can no longer be undone', 409);
  const moved = JSON.parse(m.moved), before = JSON.parse(m.survivor_before), at = now();
  const [ok, done] = guard(db, 'EXISTS(SELECT 1 FROM b_clients WHERE id=? AND revision=? AND merged_into IS NULL) AND EXISTS(SELECT 1 FROM b_clients WHERE id=? AND merged_into=?) AND ?<?',
    m.survivor_id, m.revision_after, m.merged_id, m.survivor_id, at, m.undo_until);
  const [same, sameDone] = sameCounts(db, m.survivor_id, JSON.parse(m.linked_after));
  await atomic(db, actor, [ok, done, same, sameDone,
    // Records move back while the merge is still active; the triggers allow only that.
    ...MOVED.map(([key, table]) => stmt(db, `UPDATE ${table} SET client_id=? WHERE client_id=? AND id IN (SELECT value FROM json_each(?))`, m.merged_id, m.survivor_id, JSON.stringify(moved[key]))),
    ...moved.groups.map((g: Data) => g.dropped
      ? stmt(db, 'INSERT INTO b_client_group_members(group_id,client_id,relationship,added_by,added_at) VALUES(?,?,?,?,?)', g.group_id, m.merged_id, g.relationship, g.added_by, g.added_at)
      : stmt(db, 'UPDATE b_client_group_members SET client_id=? WHERE group_id=? AND client_id=?', m.merged_id, g.group_id, m.survivor_id)),
    stmt(db, 'UPDATE b_clients SET name=?,abn=?,contact_name=?,contact_email=?,fields=?,tags=?,revision=? WHERE id=?', before.name, before.abn, before.contact_name, before.contact_email, before.fields, before.tags, before.revision, m.survivor_id),
    stmt(db, 'UPDATE b_clients SET merged_into=NULL WHERE id=?', m.merged_id),
    stmt(db, 'UPDATE b_client_merges SET undone_by=?,undone_at=? WHERE id=? AND undone_at IS NULL', actor.email, at, m.id),
    audit(db, actor, 'client.merge_undone', m.survivor_id, `${state.merged.name} restored from ${state.survivor.name}`)]);
  return { ...state, undo: 'undone', undoneBy: actor.email, undoneAt: at };
}

