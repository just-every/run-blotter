import { operatorAuth, type Bindings } from '../auth.server';
import { createOidcProviders, createOidcHandler } from '../modules/operator-auth/identity/oidc/index.mjs';
import { enterpriseConfiguration } from './enterprise-directory';
import { enterpriseGuard } from './enterprise-lifecycle';
import { audit, insist, stmt, type Data, type Actor } from './model';

export function enterpriseProviders(env:Bindings) {
    const c=enterpriseConfiguration(env),db=env.DB;
    const policy=async()=>await stmt(db,"SELECT c.* FROM b_enterprise_connection c JOIN oa_operators p ON p.id=c.principal_id AND p.role='owner' AND p.status='active' WHERE c.id=1").first<Data>();
    const providers=createOidcProviders({db,config:{origin:env.AUTH_ORIGIN,local:env.AUTH_LOCAL==='true',transactionSecret:c.transactionSecret,providers:[{id:'enterprise',preset:'microsoft',tenant:c.tenant,clientId:c.clientId,clientSecret:c.clientSecret,tokenAuthMethod:'client_secret_post',label:'Firm Microsoft Entra'}]},
      clientIp:r=>r.headers.get('CF-Connecting-IP')??'',enabled:async()=>{const p=await policy();return !!(p?.active&&p.tenant===c.tenant);},
      policyVersion:async()=>Number((await stmt(db,'SELECT generation FROM oa_auth_settings WHERE singleton=1').first<Data>())?.generation??0),
      admission:{admit:async(r,principal,options)=>{
        const p=await policy();insist(p?.active&&p.tenant===c.tenant,'Enterprise connection is inactive',403);
        const identity=await stmt(db,`SELECT i.* FROM b_enterprise_identities i JOIN b_members m ON m.email=i.email AND m.active=1 WHERE i.subject=? AND i.active=1`,principal.subject).first<Data>();
        insist(identity&&principal.issuer===`https://login.microsoftonline.com/${c.tenant}/v2.0`,'This enterprise identity is not authorized',403);
        const mfa=principal.amr?.includes('mfa')===true;insist(!p.require_mfa||mfa,'The identity provider must assert MFA',403);
        const auth=operatorAuth(env),result=await auth.admission.admit(r,{...principal,email:undefined,emailVerified:false,associatedEmail:identity.email},options);
        const fence=enterpriseGuard(db,p.revision),actor:Actor={id:result.operator.id,email:identity.email,name:result.operator.displayName,role:'preparer',channel:'person'};
        try {await db.batch([fence.check,stmt(db,'INSERT INTO b_enterprise_sessions(session_id,identity_id,revision,mfa) SELECT ?,id,?,? FROM b_enterprise_identities WHERE id=? AND active=1 AND EXISTS(SELECT 1 FROM b_members WHERE email=? AND active=1)',result.session.id,p.revision,Number(mfa),identity.id,identity.email),
          stmt(db,`INSERT INTO b_guard(id,ok) VALUES(?,CASE WHEN EXISTS(SELECT 1 FROM b_enterprise_sessions WHERE session_id=?) THEN 1 ELSE 0 END)`,'enterprise:'+result.session.id,result.session.id),stmt(db,'DELETE FROM b_guard WHERE id=?','enterprise:'+result.session.id),
          audit(db,actor,'enterprise.signed_in',identity.id,mfa?'Verified provider MFA':'Blotter factor policy applies'),fence.release]);}
        catch(e){await auth.accounts.revokeSession(result.session.id);throw e;}
        return result;
      }}});
    return providers;
}
export async function enterpriseAuth(request:Request,env:Bindings):Promise<Response|null> {
  if(!new URL(request.url).pathname.startsWith('/auth/oidc/enterprise/'))return null;
  try{return await createOidcHandler(enterpriseProviders(env))(request);}
  catch{return Response.json({error:'Enterprise sign-in is unavailable; contact the principal'},{status:503,headers:{'cache-control':'no-store'}});}
}

