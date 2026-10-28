// Import targets are the real b_clients rows, never shadow copies. Reads go
// through b_client_import_rows: a client a merge kept (CRM-015) shows the row
// its import recorded until it changes again, so its source still matches it.
// Adapted from just-every/run-satchel src/satchel/imports/target.ts (MIT).
import type { D1TargetAdapter, D1Sql, D1UndoDependency, TargetRow } from '../../modules/import-kit/src/d1/index';

const sql = (sql: string, ...params: unknown[]): D1Sql => ({ sql, params });
const row = (destination: string, client: any): TargetRow => ({
  destination, targetKind: 'client', targetId: client.id, revision: client.revision,
  value: { name: client.name, abn: client.abn, contactName: client.contact_name, contactEmail: client.contact_email, source: client.source, fields: client.fields, tags: client.tags },
});
function scope(destination: string, kind = 'client') {
  if (destination !== 'main' || kind !== 'client') throw new Error('Invalid Blotter import target');
}

export const clientTargets: D1TargetAdapter = {
  async read(db, destination, kind, id) {
    scope(destination, kind);
    const client = await db.prepare('SELECT * FROM b_client_import_rows WHERE id=?').bind(id).first();
    return client ? row(destination, client) : undefined;
  },
  matches(current, destination, kind, id) {
    scope(destination, kind);
    if (!current) return sql('NOT EXISTS(SELECT 1 FROM b_clients WHERE id=?)', id);
    const v = current.value as Record<string, string>;
    // Jobs recorded before CRM-002 carry no fields or tags; those clients have the column defaults.
    return sql('EXISTS(SELECT 1 FROM b_client_import_rows WHERE id=? AND revision=? AND name=? AND abn=? AND contact_name=? AND contact_email=? AND source=? AND fields=? AND tags=?)', id, current.revision, v.name, v.abn, v.contactName, v.contactEmail, v.source, v.fields ?? '{}', v.tags ?? '[]');
  },
  matchesCount(count, destination) { scope(destination); return sql('(SELECT COUNT(*) FROM b_clients)=?', count); },
  matchesMany(rows, destination) { return [this.matchesCount!(rows.length, destination), ...rows.map(current => this.matches(current, destination, current.targetKind, current.targetId))]; },
  async preparePreservedUndo(db, destination, effects) {
    scope(destination);
    // A client with any job, or in any merge, is preserved on undo; the job and merge history depend on it.
    const ids = JSON.stringify(effects.map(effect => effect.expected.targetId));
    const [clients, jobs, merges, contacts, relationships] = await Promise.all([
      db.prepare('SELECT * FROM b_client_import_rows WHERE id IN (SELECT value FROM json_each(?))').bind(ids).all(),
      db.prepare('SELECT id,client_id FROM b_jobs WHERE client_id IN (SELECT value FROM json_each(?)) ORDER BY id').bind(ids).all<{ id: string; client_id: string }>(),
      db.prepare('SELECT id,survivor_id,merged_id FROM b_client_merges WHERE survivor_id IN (SELECT value FROM json_each(?1)) OR merged_id IN (SELECT value FROM json_each(?1)) ORDER BY id').bind(ids).all<{ id: string; survivor_id: string; merged_id: string }>(),
      db.prepare('SELECT id,client_id,revision FROM b_client_contacts WHERE client_id IN (SELECT value FROM json_each(?)) ORDER BY id').bind(ids).all<{id:string;client_id:string;revision:string}>(),
      db.prepare('SELECT id,owner_client_id FROM b_clients WHERE owner_client_id IN (SELECT value FROM json_each(?)) ORDER BY id').bind(ids).all<{id:string;owner_client_id:string}>(),
    ]);
    const byId = new Map(clients.results.map(client => [client.id, row(destination, client)]));
    const observations = [], dependencies: D1UndoDependency[] = [], guards: D1Sql[] = [];
    for (const effect of effects) {
      const id = effect.expected.targetId, current = byId.get(id) ?? null;
      const linked = jobs.results.filter(j => j.client_id === id);
      observations.push({ effectId: effect.provenance.id, current, entity: { table: 'b_clients', recordId: id }, evidence: { reason: 'Exact client fields and revision; all jobs and merges for the client' } });
      const merged = merges.results.filter(m => m.survivor_id === id || m.merged_id === id);
      guards.push(this.matches(current, destination, 'client', id), sql('(SELECT COUNT(*) FROM b_jobs WHERE client_id=?)=?', id, linked.length),
        sql('(SELECT COUNT(*) FROM b_client_merges WHERE survivor_id=? OR merged_id=?)=?', id, id, merged.length));
      const contactRows = contacts.results.filter(c => c.client_id === id), related = relationships.results.filter(c => c.owner_client_id === id);
      guards.push(sql('(SELECT COUNT(*) FROM b_client_contacts WHERE client_id=?)=?',id,contactRows.length),sql('(SELECT COUNT(*) FROM b_clients WHERE owner_client_id=?)=?',id,related.length));
      for (const c of contactRows.filter(c => c.id !== 'legacy:'+id || c.revision !== effect.expected.revision)) {
        guards.push(sql('EXISTS(SELECT 1 FROM b_client_contacts WHERE id=? AND revision=?)',c.id,c.revision));
        dependencies.push({requiredEffectId:effect.provenance.id,cause:{table:'b_client_contacts',recordId:c.id,field:'client_id',targetId:id},evidence:{reason:'A contact was added or edited after import'}});
      }
      for (const c of related) dependencies.push({requiredEffectId:effect.provenance.id,cause:{table:'b_clients',recordId:c.id,field:'owner_client_id',targetId:id},evidence:{reason:'Another entity records this client as its owner'}});
      for (const m of merged) {
        dependencies.push({ requiredEffectId: effect.provenance.id, cause: { table: 'b_client_merges', recordId: m.id, field: m.survivor_id === id ? 'survivor_id' : 'merged_id', targetId: id }, evidence: { mergeId: m.id, reason: 'This client took part in a merge' } });
      }
      for (const j of linked) {
        dependencies.push({ requiredEffectId: effect.provenance.id, cause: { table: 'b_jobs', recordId: j.id, field: 'client_id', targetId: id }, evidence: { jobId: j.id, reason: 'A job belongs to this client' } });
      }
    }
    // A zero-effect job still requires a nonempty native observation fence.
    if (!guards.length) {
      const meta = await db.prepare('SELECT client_revision FROM b_meta WHERE id=1').first<{ client_revision: number }>();
      if (!meta) throw new Error('Blotter client revision is missing');
      guards.push(sql('(SELECT client_revision FROM b_meta WHERE id=1)=?', meta.client_revision));
    }
    return { observations, dependencies, guards };
  },
  write(current) {
    scope(current.destination, current.targetKind);
    const v = current.value as Record<string, string>;
    const at = new Date().toISOString();
    return [sql('INSERT INTO b_clients(id,name,abn,contact_name,contact_email,source,revision,created_at,fields,tags) VALUES(?,?,?,?,?,?,?,?,?,?)', current.targetId, v.name, v.abn, v.contactName, v.contactEmail, v.source, current.revision, at, v.fields ?? '{}', v.tags ?? '[]'),
      ...(v.contactName || v.contactEmail ? [sql(`INSERT INTO b_client_contacts(id,client_id,name,first_name,email,roles,authorized,portal,request_consent,email_consent,revision,created_by,created_at,updated_by,updated_at) VALUES(?,?,?,?,?,'["primary"]',1,?,?,?,?,?,?,?,?)`,
        'legacy:'+current.targetId,current.targetId,v.contactName,v.contactName.trim().split(/\s+/)[0] ?? '',v.contactEmail.toLowerCase(),v.contactEmail?1:0,v.contactEmail?1:0,v.contactEmail?1:0,current.revision,'client-list import',at,'client-list import',at)] : [])];
  },
  remove(destination, kind, id) {
    scope(destination, kind);
    return [sql("DELETE FROM b_client_contacts WHERE client_id=? AND id=? AND NOT EXISTS(SELECT 1 FROM b_jobs WHERE client_id=?) AND NOT EXISTS(SELECT 1 FROM b_client_merges WHERE survivor_id=? OR merged_id=?)", id,'legacy:'+id,id,id,id),
      sql('DELETE FROM b_client_group_members WHERE client_id=? AND NOT EXISTS(SELECT 1 FROM b_jobs WHERE client_id=?)', id, id),
      sql('DELETE FROM b_clients WHERE id=? AND NOT EXISTS(SELECT 1 FROM b_jobs WHERE client_id=?) AND NOT EXISTS(SELECT 1 FROM b_client_merges WHERE survivor_id=? OR merged_id=?)', id, id, id, id)];
  },
  async list(db, destination) {
    scope(destination);
    return (await db.prepare('SELECT * FROM b_client_import_rows ORDER BY id').all()).results.map(client => row(destination, client));
  },
};
