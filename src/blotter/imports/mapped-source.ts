// Explicit CSV field mapping and entity-scoped contact groups (IMPORT-002).
import { Buffer } from 'node:buffer';
import { canonicalJson, sha256, type Diagnostic, type SourceBundle, type ImportMapping } from '../../modules/import-kit/src/d1/index';
import { contactValues } from '../client-contacts';
import { fieldValue, type FieldDef } from '../profiles';
import { insist, type Data } from '../model';
import { MARKETING_FIELDS, sourceMarketing } from './marketing';
import { parseCsv } from './csv';
import { importTargetId, NAMESPACE } from './client-list';

export const MAPPED_VERSION = 'client-list-v2';
export const MAPPED_FIELDS = ['client_name','client_id','entity_type','ein','abn','contact_id','contact_name','contact_email','contact_phone','contact_roles','authorized','signer','portal','request_consent','email_consent','consent_note','tags',...MARKETING_FIELDS];
export const bindingId = (sourceId: string) => 'csv:' + sha256(sourceId);
export function importColumns(csv: unknown, defs: FieldDef[]) {
  insist(typeof csv === 'string' && Buffer.byteLength(csv) <= 1_000_000, 'Choose a CSV of at most 1 MB');
  const { headers } = parseCsv(csv), fields = [...MAPPED_FIELDS,...defs.map(d=>'field:'+d.key)];
  return { headers, fields, defaults:Object.fromEntries(fields.filter(f=>!MARKETING_FIELDS.includes(f) && headers.includes(f)).map(f=>[f,f])) };
}
export function mappedSource(raw: unknown, filename: unknown, defs: FieldDef[], choices: unknown) {
  const { headers, fields } = importColumns(raw, defs), csv = raw as string;
  insist(choices && typeof choices==='object' && !Array.isArray(choices), 'Choose a field mapping');
  const selected = Object.entries(choices as Data).filter(([,v])=>v!=='');
  insist(selected.every(([k,v])=>fields.includes(k) && typeof v==='string' && headers.includes(v)), 'Mapping must use known fields and CSV headers');
  insist(new Set(selected.map(([,v])=>v)).size===selected.length, 'Map each source column only once');
  const columns = Object.fromEntries(selected) as Record<string,string>;
  insist(columns.client_name, 'Map the client name column');
  const parsed = parseCsv(csv), name = typeof filename==='string' && filename.trim() ? filename.trim().slice(0,200) : 'clients.csv';
  insist(parsed.rows.length>0 && parsed.rows.length<=2000, 'Import between 1 and 2,000 rows per file');
  insist(!csv.includes('\0'), 'The CSV contains a NUL character');
  const diagnostics: Diagnostic[] = [], groups = new Map<string,Data>();
  const fail = (line:number,message:string,code='BAD_ROW')=>diagnostics.push({severity:'error',code,message:`Row ${line}: ${message}`,location:{artifact:name,row:line}});
  const ignoredColumns = headers.filter(h=>!Object.values(columns).includes(h));
  if(ignoredColumns.length)diagnostics.push({severity:'warning',code:'UNMAPPED_COLUMNS',message:`Columns kept in the original file only: ${ignoredColumns.join(', ')}`});
  for(const {line,value} of parsed.rows){
    const v = Object.fromEntries(selected.map(([k,h])=>[k,value[h as string].trim()]));
    const clientName=v.client_name, ein=(v.ein??'').replace(/[\s-]/g,''), legacy=(v.abn??'').replace(/\s/g,''), tax=ein||legacy;
    const sourceId=v.client_id||`client:${sha256(canonicalJson([clientName.toLowerCase(),tax]))}`;
    if(!clientName||clientName.length>200)fail(line,'client_name is required (at most 200 characters)');
    if(sourceId.length>200)fail(line,'client_id must be at most 200 characters');
    if(ein&&!/^\d{9}$/.test(ein))fail(line,'ein must be empty or nine digits');
    if(legacy&&!/^\d{11}$/.test(legacy))fail(line,'abn is legacy and must have eleven digits');
    if(ein&&legacy)fail(line,'Supply EIN or legacy ABN, not both');
    const type=v.entity_type||'business'; if(!['individual','business','trust'].includes(type))fail(line,'entity_type must be individual, business or trust');
    const custom:Data={};for(const def of defs){const result=fieldValue(def,v['field:'+def.key]);if('error'in result)fail(line,result.error);else if(result.value)custom[def.key]=result.value;}
    const tags=[...new Set((v.tags??'').split(';').map(t=>t.trim().toLowerCase()).filter(Boolean))].sort();
    if(tags.length>20||tags.some(t=>t.length>40))fail(line,'tags: at most twenty tags of forty characters');
    const entity={name:clientName,abn:tax,entity_type:type,fields:JSON.stringify(custom),tags:JSON.stringify(tags)};
    let group=groups.get(sourceId);
    if(!group){group={sourceId,...entity,contacts:[],raw:[],line};groups.set(sourceId,group);}
    else if(canonicalJson(entity)!==canonicalJson(Object.fromEntries(Object.keys(entity).map(k=>[k,group![k]]))))fail(line,'Rows for the same client_id have conflicting entity fields','ENTITY_CONFLICT');
    group.raw.push({line,value});
    if(v.contact_name||v.contact_email){
      try{
        const flag=(key:string)=>{const x=v[key]??'';insist(x===''||x==='true'||x==='false',`${key}: use true or false`);return x==='true';};
        const c=contactValues({name:v.contact_name,email:v.contact_email,phone:v.contact_phone,roles:(v.contact_roles??'').split(';').map(r=>r.trim()).filter(Boolean),authorized:flag('authorized'),signer:flag('signer'),portal:flag('portal'),requestConsent:flag('request_consent'),emailConsent:flag('email_consent'),consentNote:v.consent_note});
        const contactSource=v.contact_id||c.email||'';insist(contactSource && contactSource.length<=200,'Supply contact_id or email for each contact');
        const contact={sourceId:contactSource,...c};
        const previous=group.contacts.find((x:Data)=>x.sourceId===contactSource || c.email&&x.email===c.email);
        if(previous){insist(canonicalJson(previous)===canonicalJson(contact),'Repeated contact identity has conflicting values');}
        else group.contacts.push(contact);
        if (MARKETING_FIELDS.some(k => columns[k])) {
          const marketing = { sourceId: contactSource, ...sourceMarketing(v, c) };
          group.marketing ??= [];
          const prior = group.marketing.find((m:Data) => m.sourceId === contactSource);
          insist(!prior || canonicalJson(prior) === canonicalJson(marketing), 'Repeated contact has conflicting marketing consent');
          if (!prior) group.marketing.push(marketing);
        }
      }catch(error){fail(line,error instanceof Error?error.message:'Invalid contact');}
    }else if(Object.keys(v).some(k=>['contact_id','contact_roles','authorized','signer','portal','request_consent','email_consent','consent_note',...MARKETING_FIELDS].includes(k)&&v[k]))fail(line,'Contact flags require a contact name or email');
  }
  for(const g of groups.values())if(g.contacts.length>30)fail(g.line,'At most thirty contacts per entity');
  return {csv,name,columns,diagnostics,groups:[...groups.values()],ignoredColumns};
}
export function mappedBundle(parsed:ReturnType<typeof mappedSource>, values: Map<string,Data>, decisions:Data) {
  const bytes=Buffer.from(parsed.csv),artifactHash=sha256(bytes), blocked=parsed.diagnostics.some(d=>d.severity==='error');
  const source: SourceBundle={artifacts:[{name:parsed.name,sha256:artifactHash,size:bytes.length,original:{status:'available',base64:bytes.toString('base64')}}],diagnostics:parsed.diagnostics,records:parsed.groups.map(g=>{
    const payload={rows:g.raw,mapping:parsed.columns,decision:decisions[g.sourceId]??null};
    return {namespace:NAMESPACE,kind:'entity-contacts',sourceId:g.sourceId,payload,payloadHash:sha256(canonicalJson(payload)),artifactHash,location:{artifact:parsed.name,row:g.line}};
  })};
  const mapping:ImportMapping={version:MAPPED_VERSION,map:r=>blocked?{effects:[],rejection:'Resolve the CSV errors and duplicate decisions before importing'}:{effects:[{targetKind:'client-bundle',targetId:bindingId(r.sourceId),value:values.get(r.sourceId)!}]}};
  return {source,mapping};
}
export { importTargetId };
