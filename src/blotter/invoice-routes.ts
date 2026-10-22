// Native invoicing's HTTP surface. The parent adapter supplies current session,
// origin checks and ACCESS-002's export/administration gates to every staff door.
import type {Hono} from 'hono';
import type {Bindings} from '../auth.server';
import {invoiceState,selectInvoiceAuthority,previewInvoice,prepareInvoice,invoiceDetail,issueInvoice,voidInvoice,downloadInvoice} from './invoices';
import {authorizeInvoiceEntitlement} from './invoices-sources';
import {recordInvoiceCredit,allocateInvoiceCredit} from './invoices-credits';
import {createInvoiceRetainer,generateRetainerInvoice,previewRetainerAmendment,amendInvoiceRetainer,setInvoiceAutoConsent,setInvoiceRetainerStatus} from './invoices-retainers';
import {previewInvoiceDelivery,sendInvoice,reconcileInvoiceDelivery,invoicePortalView,invoicePortalPdf} from './invoices-delivery';
export function invoiceRoutes(api:Hono<{Bindings:Bindings}>,{as,body,db,param}:any){
 const P='/api/blotter';
 api.get(`${P}/invoices`,as((a:any,c:any)=>invoiceState(db(c),a)));
 api.post(`${P}/invoices/authority`,as(async(a:any,c:any)=>selectInvoiceAuthority(db(c),a,await body(c))));
 api.post(`${P}/invoice-entitlements`,as(async(a:any,c:any)=>authorizeInvoiceEntitlement(db(c),a,await body(c))));
 api.post(`${P}/invoice-credits`,as(async(a:any,c:any)=>recordInvoiceCredit(db(c),a,await body(c))));
 api.post(`${P}/invoices/preview`,as(async(a:any,c:any)=>previewInvoice(db(c),a,await body(c))));
 api.post(`${P}/invoices`,as(async(a:any,c:any)=>prepareInvoice(db(c),a,await body(c))));
 api.get(`${P}/invoices/:id`,as((a:any,c:any)=>invoiceDetail(db(c),a,param(c))));
 api.post(`${P}/invoices/:id/issue`,as(async(a:any,c:any)=>issueInvoice(db(c),a,param(c),await body(c))));
 api.post(`${P}/invoices/:id/void`,as(async(a:any,c:any)=>voidInvoice(db(c),a,param(c),await body(c))));
 api.post(`${P}/invoices/:id/credits`,as(async(a:any,c:any)=>allocateInvoiceCredit(db(c),a,param(c),await body(c))));
 api.get(`${P}/invoices/:id/pdf`,as((a:any,c:any)=>downloadInvoice(db(c),a,param(c))));
 api.post(`${P}/invoices/:id/delivery-preview`,as(async(a:any,c:any)=>previewInvoiceDelivery(db(c),a,param(c),await body(c))));
 api.post(`${P}/invoices/:id/send`,as(async(a:any,c:any)=>sendInvoice(c.env,a,param(c),await body(c))));
 api.post(`${P}/invoice-deliveries/:id/reconcile`,as(async(a:any,c:any)=>reconcileInvoiceDelivery(db(c),a,param(c),await body(c))));
 api.post(`${P}/invoice-retainers`,as(async(a:any,c:any)=>createInvoiceRetainer(db(c),a,await body(c))));
 api.post(`${P}/invoice-retainers/:id/generate`,as(async(a:any,c:any)=>generateRetainerInvoice(db(c),a,param(c),await body(c))));
 api.post(`${P}/invoice-retainers/:id/amendment-preview`,as(async(a:any,c:any)=>previewRetainerAmendment(db(c),a,param(c),await body(c))));
 api.post(`${P}/invoice-retainers/:id/amend`,as(async(a:any,c:any)=>amendInvoiceRetainer(db(c),a,param(c),await body(c))));
 api.post(`${P}/invoice-retainers/:id/auto-consent`,as(async(a:any,c:any)=>setInvoiceAutoConsent(db(c),a,param(c),await body(c))));
 api.post(`${P}/invoice-retainers/:id/status`,as(async(a:any,c:any)=>setInvoiceRetainerStatus(db(c),a,param(c),await body(c))));
 api.get(`${P}/invoice-portal/:token`,async c=>c.json(await invoicePortalView(db(c),c.req.param('token'))));
 api.get(`${P}/invoice-portal/:token/pdf`,async c=>invoicePortalPdf(db(c),c.req.param('token')));
}
