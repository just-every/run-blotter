import { createBusinessSettings, type TeamAdapter, type ManagedMember } from '../../modules/business-settings/index.ts';
import type { Bindings } from '../../auth.server.ts';
import { nativeTrust } from './trust.ts';
import { stmt } from '../model.ts';

/** Signed Business ids bind existing native people; they never manufacture membership. */
export function businessSettings(env: Bindings) {
 const team: TeamAdapter = {
  ownerEmail: async () => (await stmt(env.DB, "SELECT email FROM oa_operators WHERE role='owner' AND status='active' ORDER BY created_at,id LIMIT 1").first<{email:string}>())?.email ?? null,
  async prepare({members, managed}) {
   const rows: ManagedMember[] = [];
   for (const member of members) {
    const prior = managed.find(row => member.id && row.businessId === member.id);
    const operator = prior?.operatorId
     ? await stmt(env.DB, 'SELECT o.id,o.email,o.status,m.role,m.active FROM oa_operators o LEFT JOIN b_members m ON m.email=o.email WHERE o.id=?', prior.operatorId).first<any>()
     : await stmt(env.DB, "SELECT o.id,o.email,o.status,m.role,m.active FROM oa_operators o JOIN b_members m ON m.email=o.email WHERE o.email=? AND o.role<>'owner'", member.email).first<any>();
    const claimed=operator&&managed.some(row=>row.operatorId===operator.id&&row.businessId&&row.businessId!==member.id);
    const admitted = !claimed && operator?.status === 'active' && operator.active === 1 && operator.role === (member.role === 'admin' ? 'reviewer' : 'preparer');
    rows.push({email:member.email,operatorId:operator?.id ?? prior?.operatorId ?? null,invite:member.invite,
     state:admitted?'active':'conflict',businessId:member.id ?? prior?.businessId ?? null,businessRole:member.role});
   }
   // Omission removes Business admission without deleting native people or rebinding ids.
   for (const prior of managed) if (!rows.some(row => row.businessId && row.businessId === prior.businessId || row.email === prior.email)) rows.push({...prior,state:'inactive'});
   return {rows,statements:[],async afterCommit(){}};
  },
 };
 const ring=nativeTrust(env);
 return createBusinessSettings({db:env.DB,trust:ring?{v:1,issuer:ring.issuer,audience:ring.appOrigin,subject:ring.installationId,keys:ring.publicKeys}:null,business:{settings:1,values:['display_name'],team:{roles:{admin:'reviewer',member:'preparer'}}},team});
}
