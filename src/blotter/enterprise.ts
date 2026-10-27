import { createPortability } from '@runeditrun/rer/modules/portability';
import archivePolicy from './archive-policy.mjs';
import type { Bindings } from '../auth.server';
import { enterpriseDirectory, enterpriseConfiguration } from './enterprise-directory';
import { enterpriseRefresh } from './enterprise-lifecycle';
import { freshAccess } from './permissions';
import { atomic, audit, digest, email, human, id, insist, need, rows, secret, stmt, text, type Actor, type Data } from './model';

async function admin(db:D1Database,actor:Actor,write=false) {human(actor);need(actor,'owner');if(write)await freshAccess(db,actor);}
export async function enterpriseState(env:Bindings,actor:Actor) {
  await admin(env.DB,actor);
  return {configured:!!(env.ENTRA_TENANT_ID&&env.ENTRA_CLIENT_ID&&env.ENTRA_CLIENT_SECRET&&env.ENTRA_TRANSACTION_SECRET),
    connection:await stmt(env.DB,'SELECT tenant,required,require_mfa,active FROM b_enterprise_connection WHERE id=1').first(),
    identities:await rows(env.DB,'SELECT * FROM b_enterprise_identities ORDER BY email'),mappings:await rows(env.DB,'SELECT * FROM b_enterprise_mappings ORDER BY group_id'),teams:await rows(env.DB,'SELECT * FROM b_access_teams ORDER BY name')};
}
export async function connectEnterprise(env:Bindings,actor:Actor,body:Data) {
  const db=env.DB;await admin(db,actor,true);const reason=text(body.reason,'Reason');
  insist(typeof body.required==='boolean'&&typeof body.requireMfa==='boolean','Choose the required sign-in and MFA policies');
  const c=await enterpriseDirectory(env),old=await stmt(db,'SELECT tenant FROM b_enterprise_connection WHERE id=1').first<Data>();
  insist(!old||old.tenant===c.tenant,'Disconnect and erase the existing enterprise associations before changing tenant',409);
  await atomic(db,actor,[stmt(db,`INSERT INTO b_enterprise_connection(id,tenant,required,require_mfa,active,principal_id) VALUES(1,?,?,?,1,?) ON CONFLICT(id) DO UPDATE SET required=excluded.required,require_mfa=excluded.require_mfa,active=1,principal_id=excluded.principal_id,revision=revision+1,token_digest=NULL`,c.tenant,Number(body.required),Number(body.requireMfa),actor.id),
    stmt(db,'UPDATE oa_auth_settings SET idp_sign_in=1,generation=generation+1 WHERE singleton=1'),...enterpriseRefresh(db,actor),audit(db,actor,'enterprise.connected','enterprise',reason)]);
  return enterpriseState(env,actor);
}
export async function mapEnterprise(env:Bindings,actor:Actor,body:Data) {
  const db=env.DB;await admin(db,actor,true);const group=text(body.groupId,'Group reference',200),reason=text(body.reason,'Reason');
  insist(body.role==='preparer'||body.role==='reviewer','Choose preparer or reviewer');
  const team=body.teamId?text(body.teamId,'Team',200):null;
  if(team)insist(await stmt(db,'SELECT 1 FROM b_access_teams WHERE id=?',team).first(),'Choose an existing client team',404);
  insist(await stmt(db,'SELECT 1 FROM b_enterprise_connection WHERE id=1 AND active=1').first(),'Connect the enterprise tenant first',409);
  await atomic(db,actor,[stmt(db,'INSERT INTO b_enterprise_mappings(group_id,role,team_id) VALUES(?,?,?) ON CONFLICT(group_id) DO UPDATE SET role=excluded.role,team_id=excluded.team_id',group,body.role,team),...enterpriseRefresh(db,actor),audit(db,actor,'enterprise.group_mapped',group,reason)]);
  return {ok:true};
}
export async function bindEnterprise(env:Bindings,actor:Actor,body:Data) {
  const db=env.DB;await admin(db,actor,true);const address=email(body.email),subject=text(body.subject,'OIDC subject',255),reason=text(body.reason,'Reason');
  insist(address!==env.OWNER_EMAIL.toLowerCase()&&!await stmt(db,"SELECT 1 FROM oa_operators WHERE email=? AND role='owner'",address).first(),'Enterprise provisioning cannot manage the principal',403);
  insist(await stmt(db,"SELECT 1 FROM b_members m JOIN oa_operators o ON o.email=m.email WHERE m.email=? AND m.active=1 AND o.status IN('active','invited')",address).first(),'Save and invite the practice member first',404);
  insist(await stmt(db,'SELECT 1 FROM b_enterprise_connection WHERE id=1 AND active=1').first(),'Connect the enterprise tenant first',409);
  await atomic(db,actor,[stmt(db,'INSERT INTO b_enterprise_identities(id,email,subject,display_name,active) SELECT ?,?,?,name,1 FROM b_members WHERE email=?',id(),address,subject,address),...enterpriseRefresh(db,actor),audit(db,actor,'enterprise.identity_associated',address,reason)]);
  return {ok:true};
}
export async function enterpriseToken(env:Bindings,actor:Actor,body:Data) {
  const db=env.DB;await admin(db,actor,true);const reason=text(body.reason,'Reason'),token=secret('');
  enterpriseConfiguration(env);
  insist(await stmt(db,'SELECT 1 FROM b_enterprise_connection WHERE id=1 AND active=1').first(),'Connect the enterprise tenant first',409);
  await atomic(db,actor,[stmt(db,'UPDATE b_enterprise_connection SET token_digest=?,principal_id=?,revision=revision+1 WHERE id=1',await digest(token),actor.id),...enterpriseRefresh(db,actor),audit(db,actor,'enterprise.scim_token_rotated','enterprise',reason)]);
  return {token};
}
export async function disconnectEnterprise(env:Bindings,actor:Actor,body:Data) {
  const db=env.DB;await admin(db,actor,true);const reason=text(body.reason,'Reason');
  await atomic(db,actor,[stmt(db,'UPDATE b_enterprise_connection SET active=0,revision=revision+1,token_digest=NULL WHERE id=1'),...enterpriseRefresh(db,actor),audit(db,actor,'enterprise.disconnected','enterprise',reason)]);
  return {ok:true};
}

/** Erasure removes provider associations; the portability epoch fences old copies. */
export async function eraseEnterprise(env:Bindings,actor:Actor,body:Data) {
  const db=env.DB;await admin(db,actor,true);insist(body.confirm==='ERASE ENTERPRISE','Type ERASE ENTERPRISE to confirm');const reason=text(body.reason,'Reason');
  const service=await createPortability({db,policy:archivePolicy});
  const connection=await stmt(db,'SELECT tenant FROM b_enterprise_connection WHERE id=1').first<Data>();insist(connection,'No enterprise connection to erase',404);
  await atomic(db,actor,[...enterpriseRefresh(db,actor),
    stmt(db,'UPDATE b_members SET active=0 WHERE email IN(SELECT email FROM b_enterprise_identities)'),
    stmt(db,'DELETE FROM b_access_team_members WHERE EXISTS(SELECT 1 FROM b_enterprise_team_grants g WHERE g.team_id=b_access_team_members.team_id AND g.email=b_access_team_members.email)'),
    stmt(db,'DELETE FROM oa_external_identities WHERE issuer=?',`https://login.microsoftonline.com/${connection.tenant}/v2.0`),
    ...['b_enterprise_sessions','b_enterprise_team_grants','b_enterprise_group_members','b_enterprise_mappings','b_enterprise_groups','b_enterprise_identities','b_enterprise_connection'].map(table=>stmt(db,`DELETE FROM ${table}`)),
    stmt(db,'UPDATE oa_auth_settings SET generation=generation+1 WHERE singleton=1'),...await service.redactionStatements(),...await service.invalidateTransfersStatements(),audit(db,actor,'enterprise.erased','enterprise',reason)]);
  return {erased:true};
}
