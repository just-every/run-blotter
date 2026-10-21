// Source associations own their import evidence; native work is never overwritten.
import { canonicalJson, type D1TargetAdapter, type D1Sql, type TargetRow, type D1UndoDependency } from '../../modules/import-kit/src/d1/index';
import { importedMarketing } from './marketing';
import type { Data } from '../model';
const sql=(sql:string,...params:unknown[]):D1Sql=>({sql,params});
const scope=(destination:string,kind='client-bundle')=>{if(destination!=='main'||kind!=='client-bundle')throw Error('Invalid mapped import target');};
const row=(r:Data):TargetRow=>({destination:'main',targetKind:'client-bundle',targetId:r.id,revision:r.revision,value:JSON.parse(r.value)});
const CONTACT_KEYS=['name','first_name','last_name','email','phone','roles','authorized','signer','portal','request_consent','email_consent','active','consent_note'];
/** Exact native creation footprint. Any later edit or added relationship preserves it. */
function footprint(v:Data,revision:string):D1Sql{
 const c=v.client,fields=Object.keys(c).sort(),keys=['id',...CONTACT_KEYS,'revision'].sort();
 const contactRows=v.contacts.map((x:Data)=>Object.fromEntries(keys.map(k=>[k,k==='revision'?revision:x[k]]))).sort((a:Data,b:Data)=>a.id.localeCompare(b.id));
 return sql(`EXISTS(SELECT 1 FROM b_clients WHERE id=? AND revision=? AND merged_into IS NULL AND lifecycle='active' AND partner_email='' AND team='[]' AND services='[]' AND owner_client_id IS NULL AND ssn_last4='' AND ${fields.map(k=>`${k}=?`).join(' AND ')})
 AND (SELECT json_group_array(json(value)) FROM (SELECT json_object(${keys.map(k=>`'${k}',${k}`).join(',')}) value FROM b_client_contacts WHERE client_id=? ORDER BY id))=?`,
 v.clientId,revision,...fields.map(k=>c[k]),v.clientId,canonicalJson(contactRows));
}
export const mappedTargets:D1TargetAdapter={
 async read(db,destination,kind,id){scope(destination,kind);const r=await db.prepare('SELECT * FROM b_client_import_bindings WHERE id=?').bind(id).first();return r?row(r):undefined;},
 matches(current,destination,kind,id){scope(destination,kind);return current?sql('EXISTS(SELECT 1 FROM b_client_import_bindings WHERE id=? AND revision=? AND value=?)',id,current.revision,canonicalJson(current.value)):sql('NOT EXISTS(SELECT 1 FROM b_client_import_bindings WHERE id=?)',id);},
 matchesCount(count,destination){scope(destination);return sql('(SELECT COUNT(*) FROM b_client_import_bindings)=?',count);},
 matchesMany(current,destination){return [this.matchesCount!(current.length,destination),...current.map(r=>this.matches(r,destination,r.targetKind,r.targetId))];},
 write(r){
  scope(r.destination,r.targetKind);const v=r.value as Data,at=new Date().toISOString(),c=v.client;
  if(v.mode==='match')return [sql(`INSERT INTO b_client_import_bindings(id,client_id,value,revision,created_at) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM b_clients WHERE id=? AND merged_into IS NULL AND lifecycle='active' AND revision=?)`,r.targetId,v.clientId,canonicalJson(v),r.revision,at,v.clientId,v.matchRevision),...importedMarketing(v,r.targetId,at)];
  return [sql(`INSERT INTO b_clients(id,name,abn,contact_name,contact_email,source,fields,tags,entity_type,revision,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)`,v.clientId,c.name,c.abn,c.contact_name,c.contact_email,c.source,c.fields,c.tags,c.entity_type,r.revision,at),
   ...v.contacts.map((x:Data)=>sql(`INSERT INTO b_client_contacts(id,client_id,${CONTACT_KEYS.join(',')},revision,created_by,created_at,updated_by,updated_at) VALUES(${Array(20).fill('?').join(',')})`,x.id,v.clientId,...CONTACT_KEYS.map(k=>x[k]),r.revision,'client-list import',at,'client-list import',at)),
   sql('INSERT INTO b_client_import_bindings(id,client_id,value,revision,created_at) VALUES(?,?,?,?,?)',r.targetId,v.clientId,canonicalJson(v),r.revision,at),...importedMarketing(v,r.targetId,at)];
 },
 async preparePreservedUndo(db,destination,effects){
  scope(destination);const observations=[],dependencies:D1UndoDependency[]=[],guards:D1Sql[]=[];
  // Discover all actual client FKs, so a new native record kind preserves its entity too.
  const tables=(await db.prepare("SELECT name FROM sqlite_schema WHERE type='table' AND name LIKE 'b_%' ORDER BY name").all()).results as Data[];
  const refs:{table:string;column:string}[]=[];
  for(const t of tables){if(!/^[a-z0-9_]+$/.test(t.name)||['b_client_contacts','b_client_import_bindings'].includes(t.name))continue;
   const fks=(await db.prepare(`PRAGMA foreign_key_list(${t.name})`).all()).results as Data[];
   for(const fk of fks)if(fk.table==='b_clients')refs.push({table:t.name,column:fk.from});
  }
  for(const effect of effects){
   const r=await this.read(db,destination,'client-bundle',effect.expected.targetId),v=r?.value as Data|undefined;
   observations.push({effectId:effect.provenance.id,current:r??null,entity:{table:'b_client_import_bindings',recordId:effect.expected.targetId},evidence:{reason:'Exact source association; native work and contact changes preserve creation'}});
   guards.push(this.matches(r??null,destination,'client-bundle',effect.expected.targetId));
   if(!r||!v||v.mode==='match')continue;
   const exact=footprint(v,r.revision),result=await db.prepare(`SELECT CASE WHEN (${exact.sql}) THEN 1 ELSE 0 END ok`).bind(...exact.params!).first<Data>();
   guards.push(sql(`(${exact.sql})=?`,...exact.params!,result?.ok??0));
   const retain=(reason:string,table:string,recordId:string)=>dependencies.push({requiredEffectId:effect.provenance.id,cause:{table,recordId,field:'client_id',targetId:v.clientId},evidence:{reason}});
   if(!result?.ok)retain('Entity or contact changed after import','b_clients',v.clientId);
   if(refs.length){
    const countSql=`json_array(${refs.map(ref=>`(SELECT COUNT(*) FROM ${ref.table} WHERE ${ref.column}=?)`).join(',')})`;
    const countsRow=await db.prepare(`SELECT ${countSql} counts`).bind(...refs.map(()=>v.clientId)).first<Data>(), counts=JSON.parse(countsRow?.counts??'[]') as number[];
    refs.forEach((ref,i)=>{if(counts[i])retain(`Native ${ref.table} records depend on this client`,ref.table,v.clientId);});
    guards.push(sql(`${countSql}=?`,...refs.map(()=>v.clientId),JSON.stringify(counts)));
   }
   const links=await db.prepare('SELECT COUNT(*) n FROM b_client_import_bindings WHERE client_id=?').bind(v.clientId).first<Data>();
   guards.push(sql('(SELECT COUNT(*) FROM b_client_import_bindings WHERE client_id=?)=?',v.clientId,links?.n??0));
   if((links?.n??0)>1)retain('Other source associations use this client','b_client_import_bindings',v.clientId);
  }
  if(!guards.length)guards.push(sql('(SELECT COUNT(*) FROM b_client_import_bindings)=?',(await db.prepare('SELECT COUNT(*) n FROM b_client_import_bindings').first<Data>())?.n??0));
  return {observations,dependencies,guards};
 },
 remove(destination,kind,id){scope(destination,kind);
  // Native removals use only the exact stored creation footprint, after undo's guarded dependency check.
  return [sql(`DELETE FROM b_client_contacts WHERE id IN (SELECT json_extract(c.value,'$.id') FROM b_client_import_bindings b,json_each(b.value,'$.contacts') c WHERE b.id=? AND json_extract(b.value,'$.mode')='create')`,id),
   sql(`DELETE FROM b_client_import_bindings WHERE id=? AND json_extract(value,'$.mode')='match'`,id),
   sql(`DELETE FROM b_clients WHERE id=(SELECT client_id FROM b_client_import_bindings WHERE id=? AND json_extract(value,'$.mode')='create')`,id),
   sql('DELETE FROM b_client_import_bindings WHERE id=?',id)];
 },
 async list(db,destination){scope(destination);return (await db.prepare('SELECT * FROM b_client_import_bindings ORDER BY id').all()).results.map(row);}
};
