import type { Trust } from '../../modules/agent-door/index.ts';
import type { Bindings } from '../../auth.server.ts';
/** The native owner-claim ring is the sole installation authority. */
export function nativeTrust(env:Bindings):Trust|null {
 const {RER_OWNER_CLAIM_ISSUER:issuer,RER_OWNER_CLAIM_INSTALLATION_ID:installationId,RER_OWNER_CLAIM_PUBLIC_KEYS:keys}=env;
 if(!issuer&&!installationId&&!keys){if(env.RER_BUSINESS_TRUST)throw new Error('Business settings require native owner trust');return null;}
 if(!issuer||!installationId||!keys)throw new Error('Incomplete native owner-claim trust');
 const publicKeys=JSON.parse(keys);
 if(env.RER_BUSINESS_TRUST){const business=JSON.parse(env.RER_BUSINESS_TRUST);
  if(business.issuer!==issuer||business.subject!==installationId||business.audience!==env.AUTH_ORIGIN||JSON.stringify(business.keys)!==JSON.stringify(publicKeys))throw new Error('Business settings and owner-claim trust differ');
 }
 return {issuer,installationId,appOrigin:env.AUTH_ORIGIN,publicKeys};
}
