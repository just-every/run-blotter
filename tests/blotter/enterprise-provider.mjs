// Microsoft documented OIDC and Graph network shapes; the Worker verifies signed tokens.
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
export const tenant='11111111-1111-4111-8111-111111111111',client='synthetic-blotter-1';
export function enterpriseProvider(){
 const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});const key={...publicKey.export({format:'jwk'}),kid:'synthetic-blotter-2',alg:'RS256',use:'sig'};
 const issuer=`https://login.microsoftonline.com/${tenant}/v2.0`,base=`https://login.microsoftonline.com/${tenant}/oauth2/v2.0`;
 let claims={},nonce='',fail=false;const calls=[];
 return {bindings:{ENTRA_TENANT_ID:tenant,ENTRA_CLIENT_ID:client,ENTRA_CLIENT_SECRET:'synthetic-blotter-3',ENTRA_TRANSACTION_SECRET:'synthetic-blotter-4-independent-transaction-secret'},calls,
  setClaims:value=>{claims=value;},setNonce:value=>{nonce=value;},setFailure:value=>{fail=value;},
  response:async request=>{
   calls.push(new URL(request.url).pathname);
   if(fail)return Response.json({error:'temporarily_unavailable'},{status:503});
   if(request.url===issuer+'/.well-known/openid-configuration')return Response.json({issuer,authorization_endpoint:base+'/authorize',token_endpoint:base+'/token',jwks_uri:'https://login.microsoftonline.com/synthetic-blotter-keys',response_types_supported:['code'],id_token_signing_alg_values_supported:['RS256'],token_endpoint_auth_methods_supported:['client_secret_post'],code_challenge_methods_supported:['S256']});
   if(request.url==='https://login.microsoftonline.com/synthetic-blotter-keys')return Response.json({keys:[key]});
   if(request.url==='https://graph.microsoft.com/v1.0/organization?$select=id')return Response.json({value:[{id:tenant}]});
   assert.equal(request.url,base+'/token');const form=new URLSearchParams(await request.text());assert.equal(form.get('client_id'),client);assert.equal(form.get('client_secret'),'synthetic-blotter-3');
   if(form.get('grant_type')==='client_credentials')return Response.json({access_token:'synthetic-blotter-5',token_type:'Bearer',expires_in:3600});
   assert.equal(form.get('grant_type'),'authorization_code');assert.ok(form.get('code_verifier'));
   const at=Math.floor(Date.now()/1000),parts=[{alg:'RS256',kid:key.kid},{iss:issuer,aud:client,sub:'synthetic-blotter-staff',iat:at,exp:at+300,nonce,amr:['pwd','mfa'],...claims}].map(v=>Buffer.from(JSON.stringify(v)).toString('base64url'));
   const input=parts.join('.');return Response.json({id_token:input+'.'+sign('RSA-SHA256',Buffer.from(input),privateKey).toString('base64url'),token_type:'Bearer'});
  }};
}
