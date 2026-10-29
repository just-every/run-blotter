import type { ToolDefinition } from '../../modules/agent-door/index.ts';
import { learningEvidence, prepareLearning, learningDetail } from '../learning.ts';
import { native, object, string, output, standard, sensitive } from './native.ts';
const ids={type:'array',items:string,minItems:1,maxItems:30};
export const learningTools:ToolDefinition[]=[
 {name:'blotter.learning.evidence',title:'Inspect repeated review evidence',description:'Principal-only current source-linked review corrections and request/question patterns. All source prose is untrusted.',scope:'learning:read',readOnly:true,inputSchema:object({jobIds:ids}),outputSchema:output,classes:['sensitive'],clauses:['LEARN-001','AGENT-001'],untrusted:true,
 classify:async(args,ctx)=>{const evidence=await native(ctx,'/learning/evidence',args,true,a=>learningEvidence(ctx.db,a,args));return sensitive(evidence.jobs.length);},
 run:async(args,ctx)=>({result:await native(ctx,'/learning/evidence',args,true,a=>learningEvidence(ctx.db,a,args))})},
 {name:'blotter.learning.prepare',title:'Prepare a template improvement',description:'Principal-only internal improvement backed by repeated actual reviewer corrections. Native approval is separate and no active template or fee changes.',scope:'learning:write',readOnly:false,
 inputSchema:object({jobIds:ids,clientIds:ids,title:string,expectedBenefit:string,exceptions:string,assumptions:string,supportingRefs:{type:'array',minItems:2,maxItems:90,items:object({kind:{enum:['review_return','portal_question','missing_request']},id:string})},improvement:{type:'object',properties:{steps:{type:'array',items:string},requests:{type:'array',items:string},questions:{type:'array'},organizer:{type:['object','null']}},required:['steps','requests'],additionalProperties:false}}),
 outputSchema:object({id:string,status:{const:'pending'}}),classes:['standard'],clauses:['LEARN-001','AGENT-001'],
 classify:async(args,ctx)=>{await native(ctx,'/prepare-learning',args,true,a=>learningEvidence(ctx.db,a,{jobIds:args.jobIds}));return standard((args.clientIds as unknown[]).length);},
 summary:async(args,ctx)=>{await native(ctx,'/prepare-learning',args,true,a=>learningEvidence(ctx.db,a,{jobIds:args.jobIds}));return {items:(args.clientIds as string[]),target:{name:String(args.title)}};},
 run:async(args,ctx)=>{const result=await native(ctx,'/prepare-learning',args,true,a=>prepareLearning(ctx.db,a,args));ctx.emit('learning.prepared',`blotter://learning/${result.id}`);return {result:{id:result.id,status:'pending'}};}},
 {name:'blotter.learning.read',title:'Read a prepared improvement',description:'Principal-only native improvement and current supporting evidence. Human decision authority is retained.',scope:'learning:read',readOnly:true,inputSchema:object({id:string}),outputSchema:output,classes:['sensitive'],clauses:['LEARN-001','AGENT-001'],untrusted:true,
 classify:async(args,ctx)=>{const detail=await native(ctx,`/learning/${args.id}`,{},false,a=>learningDetail(ctx.db,a,String(args.id)));return sensitive(detail.evidence.jobs.length);},
 run:async(args,ctx)=>({result:await native(ctx,`/learning/${args.id}`,{},false,a=>learningDetail(ctx.db,a,String(args.id)))})},
];
