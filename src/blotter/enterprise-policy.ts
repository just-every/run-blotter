import type { Session } from '../modules/operator-auth/index.mjs';
import { insist, stmt, type Data } from './model';

/** Read live policy for every Base session, including account administration. */
export async function enterpriseSessionGate(db:D1Database,session:Session) {
  if(session.operator.role==='owner')return;
  const c=await stmt(db,'SELECT * FROM b_enterprise_connection WHERE id=1').first<Data>();
  if(!c)return;
  const identity=await stmt(db,'SELECT * FROM b_enterprise_identities WHERE email=?',session.operator.email).first<Data>();
  if((identity&&c.active)||c.required)insist(await stmt(db,"SELECT 1 FROM oa_operators WHERE id=? AND role='owner' AND status='active'",c.principal_id).first(),'The enterprise grant needs the principal to authorize it again',403);
  if(identity)insist(identity.active && !identity.blocked && await stmt(db,'SELECT 1 FROM b_members WHERE email=? AND active=1',identity.email).first(),'Enterprise access was revoked',403);
  const proof=await stmt(db,'SELECT * FROM b_enterprise_sessions WHERE session_id=?',session.id).first<Data>();
  if(c.required || proof)insist(c.active && proof && proof.revision===c.revision && identity && proof.identity_id===identity.id,'Use the required enterprise sign-in; ask the principal for recovery',403);
  if(proof && c.require_mfa)insist(proof.mfa,'The identity provider must assert MFA',403);
}
