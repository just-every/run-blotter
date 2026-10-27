import type { Bindings } from '../auth.server';
import { insist, type Data } from './model';

export function enterpriseConfiguration(env:Bindings) {
  insist(env.ENTRA_TENANT_ID && /^[a-f0-9-]{36}$/i.test(env.ENTRA_TENANT_ID) && env.ENTRA_CLIENT_ID && env.ENTRA_CLIENT_SECRET && (env.ENTRA_TRANSACTION_SECRET?.length??0)>=32,'Configure the Entra tenant, client and independent transaction secret on the server',503);
  return {tenant:env.ENTRA_TENANT_ID,clientId:env.ENTRA_CLIENT_ID,clientSecret:env.ENTRA_CLIENT_SECRET,transactionSecret:env.ENTRA_TRANSACTION_SECRET!};
}
export async function enterpriseDirectory(env:Bindings) {
  const c=enterpriseConfiguration(env);
  const response=await fetch(`https://login.microsoftonline.com/${c.tenant}/oauth2/v2.0/token`,{method:'POST',redirect:'manual',signal:AbortSignal.timeout(10000),body:new URLSearchParams({client_id:c.clientId,client_secret:c.clientSecret,grant_type:'client_credentials',scope:'https://graph.microsoft.com/.default'})});
  insist(response.ok,'Entra refused the connection; enterprise policy remains unchanged',503);
  const token=await response.json() as Data;insist(typeof token.access_token==='string','Entra did not issue a directory token',503);
  const directory=await fetch('https://graph.microsoft.com/v1.0/organization?$select=id',{redirect:'manual',signal:AbortSignal.timeout(10000),headers:{authorization:'Bearer '+token.access_token}});
  insist(directory.ok,'Entra directory permission is required; enterprise policy remains unchanged',503);
  const organizations=await directory.json() as Data;
  insist(Array.isArray(organizations.value) && organizations.value.length===1 && organizations.value[0].id===c.tenant,'The directory does not match the configured tenant',403);
  return c;
}
