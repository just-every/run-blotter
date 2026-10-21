// Matching is a reviewed provenance association, never a change of authority.
import { rows, stmt, insist, text, type Data } from '../model';
import { survivorOf } from '../merges';
import { erasedAddress } from '../erasure-scope';
import { mappedSource, mappedBundle, importTargetId, bindingId } from './mapped-source';
import type { FieldDef } from '../profiles';

export async function prepareMapped(db:D1Database,body:Data,defs:FieldDef[], marketingActor = ''){
  const parsed=mappedSource(body.csv,body.filename,defs,body.mapping), choices=body.decisions??{};
  insist(choices && typeof choices==='object'&&!Array.isArray(choices),'Choose duplicate decisions');
  insist(Object.keys(choices).every(k=>parsed.groups.some(g=>g.sourceId===k)),'A duplicate decision references a client absent from the CSV');
  const native=await rows(db,'SELECT id,name,abn,entity_type FROM b_clients WHERE merged_into IS NULL'),values=new Map<string,Data>(),clients:Data[]=[];
  for(const g of parsed.groups){
    const contacts=g.contacts.map((c:Data)=>({...c,id:'csv-contact:'+bindingId(g.sourceId)+':'+bindingId(c.sourceId)}));
    const prior=await stmt(db,'SELECT value FROM b_client_import_bindings WHERE id=?',bindingId(g.sourceId)).first<Data>();
    const previous=prior?JSON.parse(prior.value):null;
    const candidates:Data[]=native.filter(n=>(!previous || n.id!==importTargetId(g.sourceId)) && (n.name.toLowerCase()===g.name.toLowerCase()||g.abn&&n.abn===g.abn)).map(n=>({...n,reasons:[...(n.name.toLowerCase()===g.name.toLowerCase()?['same name']:[]),...(g.abn&&n.abn===g.abn?['same tax id']:[])]}));
    // A prior reviewed association remains stable on re-import; it is never inferred from email.
    const decision=(Object.hasOwn(choices,g.sourceId)?choices[g.sourceId]:undefined)??(previous?{action:previous.mode, ...(previous.mode==='match'?{clientId:previous.clientId}:{})}:null);
    if(decision)insist(['create','match'].includes(decision.action)&&Object.keys(decision).every(k=>['action','clientId'].includes(k)),'Choose create or match for a duplicate');
    if(candidates.length&&!decision)parsed.diagnostics.push({severity:'error',code:'DUPLICATE_DECISION',message:`${g.name}: choose keep separate or match an existing entity`});
    let matchRevision='';
    const marketing = (g.marketing ?? []).filter((e:Data) => e.kind !== 'not_granted').map((e:Data) => ({ ...e, contactId: contacts.find((c:Data) => c.sourceId === e.sourceId)?.id }));
    // ERASURE-002: an address that withdrew consent before a client erasure takes only a later opt-in.
    for (const e of marketing) if (e.kind === 'grant' && await erasedAddress(db, e.address, e.actedAt)) parsed.diagnostics.push({ severity: 'error', code: 'ERASED_WITHDRAWAL', message: `${g.name}: a marketing grant is for an address that withdrew consent before a client erasure. Map only an opt-in captured after that erasure.` });
    const mode=decision?.action??'create',clientId=mode==='match'?text(decision.clientId,'Matching client ID',100):importTargetId(g.sourceId);
    if(mode==='create'&&!previous&&native.some(n=>n.id===clientId))parsed.diagnostics.push({severity:'error',code:'SOURCE_ID_IN_USE',message:`${g.name}: this source client ID already belongs to an earlier client import; choose a provenance-only match or reconcile it in Clients.`});
    if(mode==='match'){
      const survivor=await survivorOf(db,clientId),c=survivor&&await stmt(db,'SELECT * FROM b_clients WHERE id=?',survivor.id).first<Data>();
      if(!c||c.lifecycle!=='active'||c.entity_type!==g.entity_type||!candidates.some(n=>n.id===c.id)&&!previous)parsed.diagnostics.push({severity:'error',code:'INVALID_MATCH',message:`${g.name}: select a matching active entity of the same type`});
      else{
        matchRevision=c.revision;
        const existing=await rows(db,'SELECT * FROM b_client_contacts WHERE client_id=?',c.id);
        for(const source of contacts){
          const match=existing.find(n=>source.email?n.email===source.email:n.name===source.name);
          for (const event of marketing.filter((e:Data) => e.sourceId === source.sourceId)) {
            if (event.kind === 'grant') parsed.diagnostics.push({severity:'error',code:'MATCH_MARKETING_GRANT',message:`${g.name}: a provenance-only match never adds marketing grants. Record the contact's evidence through the native consent door.`});
            if (match) event.contactId = match.id;
          }
          const keys=Object.keys(source).filter(k=>!['id','sourceId'].includes(k));
          if(!match||keys.some(k=>match[k]!==source[k]))parsed.diagnostics.push({severity:'error',code:'CONTACT_MATCH_CONFLICT',message:`${g.name}: contact ${source.name||source.email} does not exactly match this entity. Review it in Clients or keep a separate entity; no permission is imported into the matched record.`});
        }
      }
    }
    const first=contacts.filter((c:Data)=>c.active&&c.authorized&&JSON.parse(c.roles).includes('primary')).sort((a:Data,b:Data)=>a.id.localeCompare(b.id))[0];
    const client={name:g.name,abn:g.abn,contact_name:first?.name??'',contact_email:first?.email??'',source:'client-list',fields:g.fields,tags:g.tags,entity_type:g.entity_type};
    const consent = marketing.length ? {marketing, marketingActor} : {};
    values.set(g.sourceId,previous && previous.mode===mode && previous.clientId===clientId ? {...previous,client,contacts,...consent} : {mode,clientId,client,contacts,...consent,...(mode==='match'?{matchRevision}:{})});
    clients.push({...g,contactEmail:first?.email??'',candidates,decision:decision??{action:'create'},matches:await survivorOf(db,clientId)??null});
  }
  const bundle=mappedBundle(parsed,values,choices);
  const marketingReview=clients.flatMap(g=>(g.marketing??[]).map((m:Data)=>({...m,client:g.name,contact:g.contacts.find((c:Data)=>c.sourceId===m.sourceId)?.name})));
  return {...bundle,clients,marketing:marketingReview,summary:{clients:clients.length,rows:parsed.groups.reduce((n,g)=>n+g.raw.length,0),ignoredColumns:parsed.ignoredColumns,errors:parsed.diagnostics.filter(d=>d.severity==='error').map(d=>d.message),warnings:parsed.diagnostics.filter(d=>d.severity==='warning').map(d=>d.message)}};
}
