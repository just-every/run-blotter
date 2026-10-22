// Staff and contact transports for native signatures. Every staff call passes
// the shared session/scope gate; contact writes require the same-origin door.
import type {Hono} from 'hono';
import type {Bindings} from '../auth.server';
import {jobSignatures,clientSignatures,createSignature,signatureDetail,sendSignature,cancelSignature} from './signatures';
import {portalSignatures,portalSignatureDetail,signSignature,declineSignature,signatureDownload,portalSignatureDownload,connectionOf} from './signatures-portal';
import {awaitingSignatures,recordAttestation,staffSign,staffSigningView} from './signatures-staff';
export function signatureRoutes(api:Hono<{Bindings:Bindings}>,{as,body,db,param,sameOrigin}:any){
 const P='/api/blotter';
 api.get(`${P}/jobs/:id/signatures`,as((a:any,c:any)=>jobSignatures(db(c),a,param(c))));
 api.get(`${P}/clients/:id/signatures`,as((a:any,c:any)=>clientSignatures(db(c),a,param(c))));
 api.post(`${P}/jobs/:id/signatures`,as(async(a:any,c:any)=>createSignature(db(c),a,param(c),await body(c))));
 api.get(`${P}/signatures/awaiting`,as((a:any,c:any)=>awaitingSignatures(db(c),a)));
 api.get(`${P}/signatures/:id`,as((a:any,c:any)=>signatureDetail(db(c),a,param(c))));
 api.get(`${P}/signatures/:id/signing`,as((a:any,c:any)=>staffSigningView(db(c),a,param(c))));
 api.post(`${P}/signatures/:id/staff-sign`,as(async(a:any,c:any)=>staffSign(db(c),a,param(c),await body(c),connectionOf(c.req.raw.headers))));
 api.post(`${P}/signatures/:id/attestations`,as(async(a:any,c:any)=>recordAttestation(db(c),a,param(c),await body(c))));
 api.post(`${P}/signatures/:id/send`,as(async(a:any,c:any)=>sendSignature(c.env,a,param(c),await body(c),new URL(c.req.url).origin)));
 api.post(`${P}/signatures/:id/void`,as(async(a:any,c:any)=>cancelSignature(db(c),a,param(c),await body(c))));
 api.get(`${P}/signatures/:id/files/:kind`,as((a:any,c:any)=>signatureDownload(db(c),a,param(c),param(c,'kind'))));
 api.get(`${P}/portal/:token/signatures`,async c=>c.json(await portalSignatures(db(c),param(c,'token'))));
 api.get(`${P}/portal/:token/signatures/:id`,async c=>c.json(await portalSignatureDetail(db(c),param(c,'token'),param(c))));
 api.post(`${P}/portal/:token/signatures/:id/sign`,async c=>{sameOrigin(c);return c.json(await signSignature(db(c),param(c,'token'),param(c),await body(c),connectionOf(c.req.raw.headers)));});
 api.post(`${P}/portal/:token/signatures/:id/decline`,async c=>{sameOrigin(c);return c.json(await declineSignature(db(c),param(c,'token'),param(c),await body(c)));});
 api.get(`${P}/portal/:token/signatures/:id/files/:kind`,async c=>portalSignatureDownload(db(c),param(c,'token'),param(c),param(c,'kind')));
}
