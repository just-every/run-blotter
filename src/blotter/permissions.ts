// Principal-managed client/team scopes and document custody. No grant widens
// a preparer's job authority; a read-only member never gains a write role.
import { checkFactor, type Site } from './mfa';
import { clientGrantSql, quoted, sensitiveSql } from './access-sql';
import { atomic, audit, email, Fault, guard, human, id, insist, need, now, rows, stmt, text, type Actor, type Data } from './model';

export async function accessActor(db:D1Database,actor:Actor) {
  const member=await stmt(db,'SELECT * FROM b_access_members WHERE email=?',actor.email).first<Data>();
  actor.accessScoped=actor.role!=='owner' && !!member;
  actor.readOnly=actor.role!=='owner' && !!member?.read_only;
  actor.accessRevision=(await stmt(db,'SELECT revision FROM b_access_policy WHERE id=1').first<Data>())?.revision ?? '';
  // Delegated permissions are read live on every request; revoking one takes effect on the holder's next call.
  const held=new Set((await rows(db,'SELECT permission FROM b_access_delegations WHERE email=?',actor.email)).map(r=>r.permission));
  actor.manageAccess=actor.role==='owner' || held.has('manage_access');
  actor.financial=actor.role==='owner' || held.has('financial_authority');
  return actor;
}
/** Delegated permissions are re-read inside the write that relies on them, so a revocation cannot race it. */
export function delegated(db:D1Database,actor:Actor,permission:'manage_access'|'financial_authority',statements:D1PreparedStatement[]) {
  if(actor.role==='owner')return statements;
  const [check,release]=guard(db,"EXISTS(SELECT 1 FROM b_access_delegations d JOIN b_members m ON m.email=d.email AND m.active=1 WHERE d.email=? AND d.permission=?)",actor.email,permission);
  return [check,...statements,release];
}
export const canAccessClient = async(db:D1Database,address:string,clientId:string) => !!await stmt(db,`SELECT 1 WHERE ${clientGrantSql('?', '?', "EXISTS(SELECT 1 FROM oa_operators WHERE email=? AND role='owner' AND status='active')")}`,address,address,address,clientId).first();
// Use named SQL literals only after parameter validation; this predicate is
// also inserted inside writes so a permission change cannot race the effect.
export const clientAuthority = (actor:Actor,client:string) => clientGrantSql(client,quoted(actor.email),actor.role==='owner'?'1':'0');
export const documentAuthority = (actor:Actor,file:string) => sensitiveSql(file,quoted(actor.email),actor.role==='owner'?'1':'0');
export async function requireClient(db:D1Database,actor:Actor,clientId:string) {
  insist(await stmt(db,`SELECT 1 FROM b_clients c WHERE c.id=? AND ${clientAuthority(actor,'c.id')}`,clientId).first(),'Client not found',404);
}
export async function requireDocument(db:D1Database,actor:Actor,fileKey:string) {
  insist(await stmt(db,`SELECT 1 WHERE ${documentAuthority(actor,quoted(fileKey))}`).first(),'Document not found',404);
}
const revision = (db:D1Database) => stmt(db,'INSERT INTO b_access_policy(id,revision) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET revision=excluded.revision',id());
async function activeMembers(db:D1Database,values:unknown) {
  insist(Array.isArray(values) && values.length<=100,'Choose up to 100 staff');
  const addresses=[...new Set(values.map(v=>email(v)))];
  for(const address of addresses) {
    insist(!await stmt(db,"SELECT 1 FROM oa_operators WHERE email=? AND role='owner'",address).first(),'The principal is never scoped, delegated or revoked by access settings',403);
    insist(await stmt(db,'SELECT 1 FROM b_members WHERE email=? AND active=1',address).first(),'Choose active practice members');
  }
  return addresses;
}
async function clients(db:D1Database,values:unknown) {
  insist(Array.isArray(values) && values.length<=1000,'Choose up to 1,000 clients');
  const ids=[...new Set(values.map(v=>text(v,'Client',200)))];
  for(const clientId of ids) insist(await stmt(db,'SELECT 1 FROM b_clients WHERE id=? AND merged_into IS NULL AND erased_at IS NULL',clientId).first(),'Choose unerased clients');
  return ids;
}
const PERMISSIONS=['manage_access','financial_authority'] as const;
function manager(actor:Actor) {
  human(actor);insist(actor.role==='owner' || actor.manageAccess,'Only the principal or a manage-access holder can change access',403);
}
/** The principal is never scoped, and no holder can configure, widen or revoke the principal or itself. */
async function limits(db:D1Database,actor:Actor,addresses:string[],clientIds:string[],existing:{members:string[];clients:string[]}) {
  if(actor.role==='owner')return;
  insist(![...addresses,...existing.members].includes(actor.email),'A manage-access holder cannot grant itself or change its own client scope',403);
  for(const clientId of [...clientIds,...existing.clients]) insist(await canAccessClient(db,actor.email,clientId),'You can only grant or change clients you hold yourself',403);
}
export async function permissions(db:D1Database,actor:Actor) {
  insist(actor.role==='owner' || actor.manageAccess,'Only the principal or a manage-access holder can read access',403);
  return {delegations:await rows(db,'SELECT * FROM b_access_delegations ORDER BY email,permission'),teams:await rows(db,'SELECT * FROM b_access_teams ORDER BY name'),teamMembers:await rows(db,'SELECT * FROM b_access_team_members'),teamClients:await rows(db,'SELECT * FROM b_access_team_clients'),
    members:await rows(db,'SELECT * FROM b_access_members'),grants:await rows(db,'SELECT * FROM b_access_grants'),sensitive:await rows(db,'SELECT * FROM b_sensitive_documents'),documentGrants:await rows(db,'SELECT * FROM b_sensitive_grants')};
}
export async function saveTeamAccess(db:D1Database,actor:Actor,body:Data) {
  manager(actor);
  const teamId=body.id?text(body.id,'Team',200):id(),name=text(body.name,'Team name',100),members=await activeMembers(db,body.emails),clientIds=await clients(db,body.clientIds),at=now();
  insist(!body.id || await stmt(db,'SELECT 1 FROM b_access_teams WHERE id=?',teamId).first(),'Team not found',404);
  await limits(db,actor,members,clientIds,{members:(await rows(db,'SELECT email FROM b_access_team_members WHERE team_id=?',teamId)).map(r=>r.email),clients:(await rows(db,'SELECT client_id FROM b_access_team_clients WHERE team_id=?',teamId)).map(r=>r.client_id)});
  await atomic(db,actor,delegated(db,actor,'manage_access',[stmt(db,'INSERT INTO b_access_teams(id,name) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name',teamId,name),
    stmt(db,'DELETE FROM b_access_team_members WHERE team_id=?',teamId),stmt(db,'DELETE FROM b_access_team_clients WHERE team_id=?',teamId),
    ...members.flatMap(address=>[stmt(db,'INSERT OR IGNORE INTO b_access_members(email) VALUES(?)',address),stmt(db,'INSERT INTO b_access_team_members(team_id,email) VALUES(?,?)',teamId,address)]),
    ...clientIds.map(c=>stmt(db,'INSERT INTO b_access_team_clients(team_id,client_id) VALUES(?,?)',teamId,c)),stmt(db,'INSERT OR IGNORE INTO b_access_members(email) SELECT email FROM b_members WHERE active=1'),revision(db),
    // Shares created by a staff member whose scope changed cannot outlive the change.
    stmt(db,'UPDATE b_document_shares SET revoked_at=? WHERE revoked_at IS NULL AND created_by IN (SELECT email FROM b_access_members)',at),
    audit(db,actor,'access.team_saved',teamId,JSON.stringify({name,members,clientIds}))]));
  return {id:teamId};
}
export async function savePersonAccess(db:D1Database,actor:Actor,body:Data) {
  manager(actor);const [address]=await activeMembers(db,[body.email]),clientIds=await clients(db,body.clientIds);
  insist(typeof body.readOnly==='boolean','Choose read-only or working access');
  await limits(db,actor,[address],clientIds,{members:[],clients:(await rows(db,'SELECT client_id FROM b_access_grants WHERE email=?',address)).map(r=>r.client_id)});
  await atomic(db,actor,delegated(db,actor,'manage_access',[stmt(db,'INSERT INTO b_access_members(email,read_only) VALUES(?,?) ON CONFLICT(email) DO UPDATE SET read_only=excluded.read_only',address,body.readOnly?1:0),
    stmt(db,'DELETE FROM b_access_grants WHERE email=?',address),...clientIds.map(c=>stmt(db,'INSERT INTO b_access_grants(email,client_id) VALUES(?,?)',address,c)),stmt(db,'INSERT OR IGNORE INTO b_access_members(email) SELECT email FROM b_members WHERE active=1'),revision(db),
    stmt(db,'UPDATE b_document_shares SET revoked_at=? WHERE created_by=? AND revoked_at IS NULL',now(),address),
    audit(db,actor,'access.person_saved',address,JSON.stringify({readOnly:body.readOnly,clientIds}))]));
  return {email:address};
}
export async function saveSensitiveAccess(db:D1Database,actor:Actor,fileKey:string,body:Data) {
  manager(actor);
  const file=await stmt(db,'SELECT file_key,client_id FROM b_document_sources WHERE file_key=? AND content_base64 IS NOT NULL',fileKey).first<Data>();
  insist(file,'Document not found',404);
  await requireClient(db,actor,file.client_id);await requireDocument(db,actor,fileKey);
  const classification=text(body.classification,'Classification',100),reason=text(body.reason,'Reason',1000),members=await activeMembers(db,body.emails);
  for(const address of members) insist(await canAccessClient(db,address,file.client_id),'Every document reader must also hold the client grant',409);
  await atomic(db,actor,delegated(db,actor,'manage_access',[stmt(db,'INSERT INTO b_sensitive_documents(file_key,classification,reason,updated_by,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(file_key) DO UPDATE SET classification=excluded.classification,reason=excluded.reason,updated_by=excluded.updated_by,updated_at=excluded.updated_at',fileKey,classification,reason,actor.email,now()),
    stmt(db,'DELETE FROM b_sensitive_grants WHERE file_key=?',fileKey),...members.map(address=>stmt(db,'INSERT INTO b_sensitive_grants(file_key,email) VALUES(?,?)',fileKey,address)),
    stmt(db,"UPDATE b_document_access SET visibility='internal',revision=? WHERE file_key=?",id(),fileKey),stmt(db,'DELETE FROM b_document_grants WHERE file_key=?',fileKey),
    stmt(db,'UPDATE b_document_shares SET revoked_at=? WHERE file_key=? AND revoked_at IS NULL',now(),fileKey),stmt(db,'INSERT OR IGNORE INTO b_access_members(email) SELECT email FROM b_members WHERE active=1'),revision(db),audit(db,actor,'access.document_restricted',fileKey,JSON.stringify({classification,members,reason}))]));
  return {fileKey,classification};
}
/** Only the principal grants delegated permissions; each grant or revocation is audited and bumps the access revision. */
export async function saveDelegations(db:D1Database,actor:Actor,body:Data) {
  human(actor);need(actor,'owner');
  const [address]=await activeMembers(db,[body.email]),reason=text(body.reason,'Reason for the delegation',1000);
  insist(Array.isArray(body.permissions) && body.permissions.every((p:unknown)=>(PERMISSIONS as readonly unknown[]).includes(p)),'Choose manage access and/or financial authority');
  const wanted=[...new Set<string>(body.permissions)],before=(await rows(db,'SELECT permission FROM b_access_delegations WHERE email=?',address)).map(r=>String(r.permission)),at=now();
  await atomic(db,actor,[stmt(db,'DELETE FROM b_access_delegations WHERE email=?',address),
    ...wanted.map(p=>stmt(db,'INSERT INTO b_access_delegations(email,permission,reason,granted_by,granted_at) VALUES(?,?,?,?,?)',address,p,reason,actor.email,at)),revision(db),
    ...wanted.filter(p=>!before.includes(p)).map(p=>audit(db,actor,'access.delegation_granted',address,JSON.stringify({permission:p,reason}))),
    ...before.filter(p=>!wanted.includes(p)).map(p=>audit(db,actor,'access.delegation_revoked',address,JSON.stringify({permission:p,reason})))]);
  return {email:address,permissions:wanted};
}
export async function stepUp(db:D1Database,actor:Actor,site:Site,body:Data) {
  const {method,statements}=await checkFactor(db,actor,site,body);
  await atomic(db,actor,[...statements,stmt(db,'INSERT INTO b_access_stepups(session_id,email,method,verified_at) VALUES(?,?,?,?) ON CONFLICT(session_id) DO UPDATE SET method=excluded.method,verified_at=excluded.verified_at',actor.sessionId,actor.email,method,now()),audit(db,actor,'access.step_up',actor.sessionId!,method)]);
  return {verified:true,minutes:5};
}
/** Exports, sensitive administration and credential reveals need this from installation, whether or not scopes are configured. */
export async function freshAccess(db:D1Database,actor:Actor) {
  const since=new Date(Date.now()-5*60_000).toISOString();
  if(actor.channel!=='person' || !await stmt(db,'SELECT 1 FROM b_access_stepups WHERE session_id=? AND email=? AND verified_at>?',actor.sessionId??'',actor.email,since).first())
    throw new Fault('Confirm your second factor for sensitive administration or export (valid five minutes in this session)',403,{mfa:'step-up'});
}
