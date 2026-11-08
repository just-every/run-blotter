import { ToolRefusal, type ToolContext, type JsonSchemaObject } from '../../modules/agent-door/index.ts';
import { Fault, job, stmt, type Data } from '../model.ts';
import { accessGate, redactAccess } from '../access-gate.ts';
import { nativeActor } from './people.ts';

export const string = {type:'string', minLength:1};
export const object = (properties:Record<string,any>,required=Object.keys(properties)):JsonSchemaObject => ({type:'object',properties,required,additionalProperties:false});
export const output = {type:'object'};
export const standard = (measure=1) => [{class:'standard' as const,facts:{measure}}];
export const sensitive = (measure:number) => [{class:'sensitive' as const,facts:{measure,kind:'accounting'}}];
export async function native<T>(ctx: ToolContext, path:string, args:Data, write:boolean, run:(actor:Awaited<ReturnType<typeof nativeActor>>)=>Promise<T>):Promise<T> {
 try {
  const actor=await nativeActor(ctx);
  if(actor.doorAgent)actor.doorAgent.approvers=ctx.approvers;
  const snapshot=await stmt(ctx.db,'SELECT envelope,local_document,local_revision FROM agent_door_state WHERE id=1').first<any>();
  if(snapshot){
   const binding=ctx.consent?await stmt(ctx.db,'SELECT rev FROM bs_settings WHERE singleton=1 AND stopped=0').first<{rev:number}>():null;
   if(ctx.consent&&!binding)throw new ToolRefusal('unauthenticated');
   actor.doorAuthority={envelope:snapshot.envelope,localDocument:snapshot.local_document,revision:snapshot.local_revision,...(binding?{businessRevision:binding.rev}:{})};
  }
  const request=new Request(ctx.origin+'/api/blotter/agent'+path,{method:write?'POST':'GET',...(write?{headers:{'content-type':'application/json'},body:JSON.stringify(args)}:{})});
  await accessGate(ctx.db,actor,request);
  // Match the production HTTP JSON projection (native views omit undefined fields).
  return JSON.parse(JSON.stringify(await redactAccess(ctx.db,actor,await run(actor)))) as T;
 } catch(error) {
  if(error instanceof Fault) throw new ToolRefusal(error.status===404?'resource_unavailable':error.status===403?'native_forbidden':error.status===409?'native_conflict':'invalid_arguments',error.message,{native_status:error.status,...error.detail});
  throw error;
 }
}
export const nativeJob = (ctx:ToolContext,id:unknown) => native(ctx,`/jobs/${id}/readiness`,{},false,a=>job(ctx.db,a,String(id)));
