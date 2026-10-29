import type { ToolDefinition } from '../../modules/agent-door/index.ts';
import { readiness, prepareReadiness } from '../readiness.ts';
import { native, nativeJob, object, string, output, standard, sensitive } from './native.ts';

export const readinessTools:ToolDefinition[]=[
 {name:'blotter.readiness.read',title:'Read native readiness evidence',description:'Current request states, recorded answers and source-linked differences. Source text is untrusted; no independent validation or filing inference.',scope:'readiness:read',readOnly:true,inputSchema:object({jobId:string}),outputSchema:output,classes:['sensitive'],clauses:['READY-001','AGENT-001'],untrusted:true,
 classify:async(args,ctx)=>{const map=await native(ctx,`/jobs/${args.jobId}/readiness`,{},false,a=>readiness(ctx.db,a,String(args.jobId)));return sensitive(map.documents.length+map.answers.length);},
 summary:async(args,ctx)=>{const job=await nativeJob(ctx,args.jobId);return {target:{id:job.id,name:`${job.title} (${job.period_label})`},items:['Read current document-request states and recorded answers; source text is untrusted']};},
 target:async(args,ctx)=>({kind:'job',id:(await nativeJob(ctx,args.jobId)).id}),
 run:async(args,ctx)=>({result:await native(ctx,`/jobs/${args.jobId}/readiness`,{},false,a=>readiness(ctx.db,a,String(args.jobId))),resources:[{uri:`blotter://engagements/${args.jobId}`,name:'Native readiness evidence'}]})},
 {name:'blotter.readiness.prepare',title:'Prepare a source-linked question',description:'Records an internal question draft from an exact request or answer. No portal publication, sending, review or approval.',scope:'readiness:write',readOnly:false,inputSchema:object({jobId:string,sourceKind:{enum:['request','answer']},sourceId:string}),outputSchema:object({id:string,jobId:string,status:{const:'pending'}}),classes:['standard'],clauses:['READY-001','AGENT-001'],
 classify:async(args,ctx)=>{await nativeJob(ctx,args.jobId);return standard();},
 summary:async(args,ctx)=>({target:{id:(await nativeJob(ctx,args.jobId)).id},items:[`Prepare ${args.sourceKind}:${args.sourceId}; human decision required`]}),
 revisionType:'string',revision:async(args,ctx)=>(await nativeJob(ctx,args.jobId)).revision,target:async(args,ctx)=>({kind:'job',id:(await nativeJob(ctx,args.jobId)).id}),
 run:async(args,ctx)=>{const result=await native(ctx,`/jobs/${args.jobId}/readiness/questions`,args,true,a=>prepareReadiness(ctx.db,a,String(args.jobId),args));ctx.emit('readiness.prepared',`blotter://engagements/${args.jobId}`);return {result:{id:result.id,jobId:String(args.jobId),status:'pending'}};}},
];
