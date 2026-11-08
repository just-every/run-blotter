import type { ResourceDefinition, ResourceContext, ToolContext } from '../../modules/agent-door/index.ts';
import { ToolRefusal } from '../../modules/agent-door/index.ts';
import { readiness } from '../readiness.ts';
import { stmt, preparationOwnerSql, insist, need, job } from '../model.ts';
import { nativeActor } from './people.ts';
import { redactAccess } from '../access-gate.ts';
import { standard, sensitive } from './native.ts';
const part=(uri:string)=>decodeURIComponent(new URL(uri).pathname.slice(1));
export async function proposalRecord(ctx:ResourceContext,id:string) {
 const actor=await nativeActor(ctx);
 const row=await stmt(ctx.db,`SELECT id,kind,payload,status,agent_label,for_email,decided_by,decided_at,result_id FROM b_proposals WHERE id=? AND ${preparationOwnerSql()}`,id,actor.id,actor.email).first<any>();
 if(!row)return null;
 const payload=JSON.parse(row.payload);
 if(payload.jobId)await job(ctx.db,actor,payload.jobId);
 else {need(actor,'owner','reviewer');insist(!actor.accessScoped,'Preparation not found',404);}
 return {...row,payload};
}
const unavailable = async (read:()=>Promise<unknown>) => {
 try { return {json:await read(),untrusted:true}; }
 catch(error) { if(error instanceof ToolRefusal || (error as any)?.status===404 || (error as any)?.status===403)return null; throw error; }
};
export const resources:ResourceDefinition[]=[
 {uriTemplate:'blotter://engagements/{id}',name:'Native engagement readiness',scope:'readiness:read',classes:['sensitive'],
 classify:record=>{const value=record.json as any;return sensitive(value.documents.length+value.answers.length);},
 read:async(uri,ctx)=>unavailable(async()=>{const actor=await nativeActor(ctx);return redactAccess(ctx.db,actor,await readiness(ctx.db,actor,part(uri)));})},
 {uriTemplate:'blotter://proposals/{id}',name:'Internal preparation',scope:'context:read',classes:['standard'],classify:record=>{const value=record.json as any;return standard(value.kind==='export'?value.payload.sourceKeys.length:1);},
 read:async(uri,ctx)=>{const value=await unavailable(()=>proposalRecord(ctx,part(uri)));return value?.json?value:null;}},
];
