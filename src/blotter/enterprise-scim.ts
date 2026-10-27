import type { Bindings } from '../auth.server';
import { enterpriseRefresh, enterpriseGuard } from './enterprise-lifecycle';
import { atomic, audit, digest, Fault, id, insist, rows, stmt, text, type Actor, type Data } from './model';

const schema='urn:ietf:params:scim:schemas:core:2.0:';
const user=(r:Data)=>({schemas:[schema+'User'],id:r.id,userName:r.email,externalId:r.external_id??undefined,displayName:r.display_name,active:!!r.active});
async function group(db:D1Database,r:Data){return {schemas:[schema+'Group'],id:r.id,externalId:r.id,displayName:r.display_name,members:(await rows(db,'SELECT identity_id FROM b_enterprise_group_members WHERE group_id=? ORDER BY identity_id',r.id)).map(m=>({value:m.identity_id}))};}
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'content-type':'application/scim+json','cache-control':'no-store'}});

/** This bearer may change only explicitly associated staff and provisioned groups. */
export async function enterpriseScim(request:Request,env:Bindings):Promise<Response|null> {
  const url=new URL(request.url);if(!url.pathname.startsWith('/scim/v2'))return null;
  try {
    insist(url.origin===env.AUTH_ORIGIN,'Invalid origin',403);
    const raw=request.headers.get('authorization')?.match(/^Bearer ([^\s]{32,256})$/)?.[1];insist(raw,'Provisioning authorization is required',401);
    const db=env.DB,c=await stmt(db,'SELECT * FROM b_enterprise_connection WHERE id=1 AND active=1 AND token_digest=?',await digest(raw)).first<Data>();insist(c&&c.tenant===env.ENTRA_TENANT_ID,'Invalid or revoked provisioning token',401);
    const o=await stmt(db,"SELECT * FROM oa_operators WHERE role='owner' AND status='active'").first<Data>();insist(o,'Principal authority is unavailable',403);
    const actor:Actor={id:o.id,email:o.email,name:o.display_name,role:'owner',channel:'person'};
    const parts=url.pathname.slice('/scim/v2'.length).split('/').filter(Boolean);insist(parts.length<=2,'Unknown provisioning resource',404);
    const [kind,key]=parts;
    if(kind==='ServiceProviderConfig'&&request.method==='GET')return json({schemas:[schema+'ServiceProviderConfig'],patch:{supported:true},bulk:{supported:false,maxOperations:0,maxPayloadSize:0},filter:{supported:true,maxResults:1000},changePassword:{supported:false},sort:{supported:false},etag:{supported:false},authenticationSchemes:[{type:'oauthbearertoken',name:'Principal-issued provisioning token',description:'Bearer credential scoped to this tenant',primary:true}]});
    insist(kind==='Users'||kind==='Groups','Unknown provisioning resource',404);
    const table=kind==='Users'?'b_enterprise_identities':'b_enterprise_groups';
    const item=key?await stmt(db,`SELECT * FROM ${table} WHERE id=?`,key).first<Data>():null;
    if(key)insist(item,'Provisioning resource not found',404);
    const serialize=async(r:Data)=>kind==='Users'?user(r):group(db,r);
    if(request.method==='GET'){
      if(item)return json(await serialize(item));
      let list=await rows(db,`SELECT * FROM ${table} ORDER BY id`);
      const filter=url.searchParams.get('filter');
      if(filter){const match=filter.match(/^(userName|displayName|id) eq "([^"\\]{1,254})"$/);insist(match,'Unsupported provisioning filter');const column=match[1]==='userName'?'email':match[1]==='displayName'?'display_name':'id';list=list.filter(r=>String(r[column]).toLowerCase()===match[2].toLowerCase());}
      const start=Number(url.searchParams.get('startIndex')??1),count=Number(url.searchParams.get('count')??100);insist(Number.isInteger(start)&&start>=1&&Number.isInteger(count)&&count>=0&&count<=1000,'Invalid pagination');
      return json({schemas:['urn:ietf:params:scim:api:messages:2.0:ListResponse'],totalResults:list.length,startIndex:start,itemsPerPage:Math.min(count,Math.max(0,list.length-start+1)),Resources:await Promise.all(list.slice(start-1,start-1+count).map(serialize))});
    }
    insist(['POST','PUT','PATCH','DELETE'].includes(request.method),'Unsupported provisioning method',405);
    const body=request.method==='DELETE'?{}:await request.text();insist(typeof body!=='string'||body.length<=64000,'Provisioning request is too large',413);const b:Data=typeof body==='string'?JSON.parse(body):body;
    insist(b&&typeof b==='object'&&!Array.isArray(b),'Supply a provisioning object');
    const statements:D1PreparedStatement[]=[];let resultId=key;
    if(kind==='Users'){
      const target=item??(request.method==='POST'?await stmt(db,'SELECT * FROM b_enterprise_identities WHERE email=?',String(b.userName??'').toLowerCase()).first<Data>():null);
      insist(target,'The principal must associate an invited member before provisioning',403);insist(!await stmt(db,"SELECT 1 FROM oa_operators WHERE email=? AND role='owner'",target.email).first(),'Provisioning cannot manage the principal',403);resultId=target.id;
      if(b.userName!==undefined)insist(String(b.userName).toLowerCase()===target.email,'Provisioning cannot reassign an identity',403);
      let attributes:Data={active:!!target.active,...b};
      if(request.method==='PATCH'){
        insist(Array.isArray(b.Operations)&&b.Operations.length>0&&b.Operations.length<=20,'Supply patch operations');
        for(const op of b.Operations){insist(String(op.op).toLowerCase()==='replace','Unsupported user patch');if(!op.path){insist(op.value&&typeof op.value==='object'&&!Array.isArray(op.value),'Supply patch attributes');Object.assign(attributes,op.value);}else{const path=String(op.path).toLowerCase();insist(['active','username','displayname','externalid'].includes(path),'Unsupported user attribute');attributes[({username:'userName',displayname:'displayName',externalid:'externalId'} as Record<string,string>)[path]??path]=op.value;}}
      }
      if(request.method==='DELETE')attributes.active=false;
      insist(attributes.userName===undefined||String(attributes.userName).toLowerCase()===target.email,'Provisioning cannot reassign an identity',403);
      const active=attributes.active;insist(typeof active==='boolean','Active must be a boolean');
      const external=attributes.externalId===undefined?target.external_id:text(attributes.externalId,'External identity reference',255);
      insist(!target.external_id||external===target.external_id,'Provisioning cannot reassign an external identity',403);
      const display=attributes.displayName===undefined?target.display_name:text(attributes.displayName,'Display name',100);
      statements.push(stmt(db,'UPDATE b_enterprise_identities SET external_id=?,display_name=? WHERE id=?',external,display,target.id),stmt(db,'UPDATE b_members SET name=? WHERE email=?',display,target.email),stmt(db,'UPDATE oa_operators SET display_name=? WHERE email=?',display,target.email));
      statements.push(stmt(db,'UPDATE b_enterprise_identities SET active=? WHERE id=?',Number(active),target.id));
      if(!active)statements.push(stmt(db,'DELETE FROM b_enterprise_group_members WHERE identity_id=?',target.id));
    }else{
      const groupId=item?.id??text(b.externalId??id(),'Group reference',200);resultId=groupId;
      insist(item||request.method==='POST','Choose a group',404);
      if(request.method==='DELETE')statements.push(stmt(db,'DELETE FROM b_enterprise_groups WHERE id=?',groupId));
      else {
        let name=b.displayName??item?.display_name,members=b.members;
        if(request.method==='PATCH'){
          insist(Array.isArray(b.Operations)&&b.Operations.length>0&&b.Operations.length<=100,'Supply patch operations');
          let current=(await rows(db,'SELECT identity_id FROM b_enterprise_group_members WHERE group_id=?',groupId)).map(r=>String(r.identity_id));
          for(const op of b.Operations){const verb=String(op.op).toLowerCase(),path=String(op.path??'');insist(['add','remove','replace'].includes(verb),'Unsupported group patch');
            if(path==='displayName'&&verb==='replace')name=op.value;
            else if(path==='members') {const ids=memberIds(op.value);current=verb==='replace'?ids:verb==='remove'?current.filter(x=>!ids.includes(x)):[...new Set([...current,...ids])];}
            else if(/^members\[value eq "[^"\\]+"\]$/.test(path)&&verb==='remove')current=current.filter(x=>x!==path.match(/^members\[value eq "([^"]+)"\]$/)![1]);
            else insist(false,'Unsupported group patch');
          }
          members=current.map(value=>({value}));
        }
        const nameValue=text(name,'Group name',200);
        statements.push(stmt(db,'INSERT INTO b_enterprise_groups(id,display_name) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET display_name=excluded.display_name',groupId,nameValue));
        if(members!==undefined){const ids=memberIds(members);for(const identityId of ids)insist(await stmt(db,"SELECT 1 FROM b_enterprise_identities i WHERE id=? AND active=1 AND NOT EXISTS(SELECT 1 FROM oa_operators p WHERE p.email=i.email AND p.role='owner')",identityId).first(),'Group contains an unknown or deprovisioned identity',403);
          statements.push(stmt(db,'DELETE FROM b_enterprise_group_members WHERE group_id=?',groupId),...ids.map(identityId=>stmt(db,'INSERT INTO b_enterprise_group_members(group_id,identity_id) VALUES(?,?)',groupId,identityId)));}
      }
    }
    const fence=enterpriseGuard(db,c.revision);
    await atomic(db,actor,[fence.check,...statements,...enterpriseRefresh(db,actor),audit(db,{...actor,email:actor.email+' (Entra provisioning)'},'enterprise.scim_'+request.method.toLowerCase(),resultId??'',kind),fence.release]);
    if(request.method==='DELETE')return new Response(null,{status:204,headers:{'cache-control':'no-store'}});
    const updated=await stmt(db,`SELECT * FROM ${table} WHERE id=?`,resultId).first<Data>();return json(await serialize(updated!),request.method==='POST'?201:200);
  }catch(e){const status=e instanceof Fault?e.status:e instanceof SyntaxError?400:409;return json({schemas:['urn:ietf:params:scim:api:messages:2.0:Error'],status:String(status),detail:e instanceof Fault?e.message:'Provisioning was refused; refresh before trying again'},status);}
}
function memberIds(value:unknown) {insist(Array.isArray(value)&&value.length<=1000,'Supply up to 1,000 members');return [...new Set(value.map(v=>text(v?.value,'Member reference',200)))];}
