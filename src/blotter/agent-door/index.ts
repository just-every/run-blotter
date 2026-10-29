import { createAgentDoor } from '../../modules/agent-door/index.ts';
import { runtimeBindings, type Bindings } from '../../auth.server.ts';
import { people, localCredential, keyScopes } from './people.ts';
import { proposalTools } from './proposals.ts';
import { readinessTools } from './readiness.ts';
import { learningTools } from './learning.ts';
import { resources } from './resources.ts';
import { businessSettings } from './business.ts';
import { nativeTrust } from './trust.ts';

export function blotterAgentDoor(original:Bindings) {
 const env=runtimeBindings(original);
 return createAgentDoor({seed:'blotter',name:'Blotter',specialist:'practice coordinator',db:env.DB,origin:env.AUTH_ORIGIN,trust:nativeTrust(env),people:people(env),
  capabilities:['tools','policy','pause','audit','idempotency'],
  tools:[...proposalTools,...readinessTools,...learningTools],resources,
  localCredentials:request=>localCredential(request,env),
  currentScopes:principal=>principal.clientId?.startsWith('blotter-key:')?keyScopes(env.DB,principal.clientId.slice(12)):Promise.resolve(principal.scopes),
  notTools:[{clauses:['MOBILE-001'],reason:'device'},{clauses:['IMPORT-001'],reason:'import-door'},{clauses:['BASE-001','PORTAL-006'],reason:'installation'},
   {clauses:['INTEGRATE-001','INTEGRATE-002','INTEGRATE-003','INTEGRATE-004','INTEGRATE-005','INTEGRATE-006','INTEGRATE-007','INTEGRATE-008'],reason:'connector'}],
 });
}
export async function agentResponse(request:Request,original:Bindings) {
 const path=new URL(request.url).pathname;
 if(!['/mcp','/api/rer/agent-policy','/api/rer/business-settings','/agents','/.well-known/oauth-protected-resource','/.well-known/oauth-protected-resource/mcp'].includes(path)&&!path.startsWith('/agents/'))return null;
 try {
  const settings=await businessSettings(runtimeBindings(original)).handle(request);
  return settings??await blotterAgentDoor(original).handle(request);
 } catch {return Response.json({code:'agent_door_unavailable'},{status:503,headers:{'cache-control':'no-store'}});}
}
