import type { ToolDefinition } from '../../modules/agent-door/index.ts';
import { rows, insist, type Actor, type Data } from '../model.ts';
import { unbilled } from '../billing.ts';
import { agentContext, payloadFor, propose } from '../proposals.ts';
import { native, nativeJob, object, string, output, standard } from './native.ts';

async function preparation(db:D1Database,actor:Actor,kind:string,args:Data){
 const payload=await payloadFor(db,actor,kind,args);
 if(kind==='export'){
  const available=await unbilled(db),keys=args.sourceKeys as string[];
  insist(new Set(keys).size===keys.length&&keys.every(key=>available.some(item=>item.source_key===key)),'Billable sources changed; read current context before preparing an export',409);
 }
 return payload;
}

export const proposalTools: ToolDefinition[] = [
 {name:'blotter.context.read',title:'Read practice coordination context',description:'Visible job metadata and outstanding request labels; no document bytes, vault credentials or execution authority.',scope:'context:read',readOnly:true,inputSchema:object({}),outputSchema:object({jobs:{type:'array'},unbilled:{type:'array'},commands:{type:'array'},preparations:{type:'array'}}),classes:['standard'],clauses:['AGENT-001','ACCESS-001'],
  classify:async(_,ctx)=>{await native(ctx,'/context',{},false,async()=>null);return standard();},
  run:async(_,ctx)=>({result:await native(ctx,'/context',{},false,async a=>({...await agentContext(ctx.db,a),preparations:a.agentKeyId?[]:await rows(ctx.db,`SELECT id,kind,status FROM b_proposals WHERE for_email=? UNION ALL SELECT id,'learning',status FROM b_learning_proposals WHERE for_email=? UNION ALL SELECT q.id,'readiness',q.status FROM b_readiness_questions q WHERE q.prepared_by=? ORDER BY id`,a.email,a.email,a.email)}))})},
 ...(['rollforward','reminder','export'] as const).map((kind):ToolDefinition=>({
  name:`blotter.proposals.${kind}`,title:`Prepare ${kind}`,description:'Creates an internal proposal only. The native named person separately decides any work, outbound reminder or billing export.',scope:'proposals:write',readOnly:false,
  inputSchema:kind==='export'?object({title:string,sourceKeys:{type:'array',items:string,minItems:1,maxItems:500}}):object({jobId:string,...(kind==='rollforward'?{dueDate:string,dueNote:string}:{message:{type:'string'}})},kind==='rollforward'?['jobId','dueDate','dueNote']:['jobId']),
  outputSchema:object({id:string,kind:{const:kind},status:{const:'pending'},payload:{type:'object'}}),classes:['standard'],clauses:['AGENT-001',kind==='rollforward'?'WORK-002':kind==='reminder'?'PORTAL-001':'BILL-001'],
  classify:async(args,ctx)=>{await native(ctx,`/prepare-${kind}`,args,true,a=>preparation(ctx.db,a,kind,args));return standard();},
  summary:async(args,ctx)=>({items:[(await native(ctx,`/prepare-${kind}`,args,true,a=>preparation(ctx.db,a,kind,args))).summary],target:{id:String(args.jobId??'billing-export'),name:'Internal preparation; separate native human decision required'}}),
  ...(kind==='export'?{}:{revisionType:'string' as const,revision:async(args,ctx)=>(await nativeJob(ctx,args.jobId)).revision,target:async(args,ctx)=>({kind:'job',id:(await nativeJob(ctx,args.jobId)).id})}),
  run:async(args,ctx)=>{const result=await native(ctx,`/prepare-${kind}`,args,true,a=>propose(ctx.db,a,kind,args));ctx.emit('proposal.prepared',`blotter://proposals/${result.id}`);return {result,resources:[{uri:`blotter://proposals/${result.id}`,name:'Internal preparation'}]};},
 })),
];
