export async function paymentFixture(h, amount=1000) {
 await h.json('/firm/settings',{name:'Cedar Practice',ein:'123456789',entity:'LLC',address:'10 Main Street',city:'Boston',state:'MA',zip:'02108',fiscalYearEnd:'12-31',services:['Bookkeeping'],currency:'USD',timeZone:'America/New_York',notificationStart:'00:00',notificationEnd:'00:00',calendars:[]},h.owner);
 await h.json('/team',{email:'preparer@example.test',name:'Preparer',role:'preparer'},h.owner);
 await h.json('/team',{email:'reviewer@example.test',name:'Reviewer',role:'reviewer'},h.owner);
 const client=await h.json('/clients',{name:'Cedar Lane LLC',contacts:[{name:'Alex Owner',email:'alex@example.test',roles:['primary','billing'],authorized:true,portal:true,requestConsent:true,emailConsent:true,consentNote:'Client authorized invoice delivery and the billing relationship'}]},h.owner);
 const contacts=await h.json(`/clients/${client.id}/contacts`,undefined,h.owner),billing=contacts[0];
 const template=await h.json('/templates',{name:'Monthly books',recurrence:'monthly',steps:'Review sources',requests:'Bank statements',feeCents:amount,currency:'USD'},h.owner);
 const job=await h.json('/jobs',{clientId:client.id,templateId:template.id,periodStart:'2026-11-01',dueDate:'2026-12-15',dueNote:'Client engagement date',preparerEmail:'preparer@example.test',reviewerEmail:'reviewer@example.test'},h.owner);
 await h.json('/invoices/authority',{authority:'blotter',reason:'Principal selected invoice authority'},h.owner);
 const entitlement=await h.json('/invoice-entitlements',{jobId:job.id,kind:'fixed',reference:'synthetic-blotter-1',description:'Monthly books',amountCents:amount,authorization:'Client signed scope for monthly books'},h.owner);
 const input={jobId:job.id,sourceKeys:[entitlement.sourceKey],contactId:billing.id,dueDate:'2026-12-15',terms:'Due on the recorded date',taxCents:0,taxTreatment:'No sales tax under supplied treatment',taxAuthorization:'Principal reviewed the client instruction'};
 const preview=await h.json('/invoices/preview',input,h.owner),draft=await h.json('/invoices',{...input,previewHash:preview.previewHash},h.owner);
 await h.json(`/invoices/${draft.id}/issue`,{revision:draft.revision,snapshotHash:draft.snapshotHash,reviewNote:'Principal checked scope and invoice recipient'},h.owner);
 const invoice=await h.json(`/invoices/${draft.id}`,undefined,h.owner),send=await h.json(`/invoices/${invoice.id}/delivery-preview`,{contactId:billing.id},h.owner);
 const delivery=await h.json(`/invoices/${invoice.id}/send`,{contactId:billing.id,previewHash:send.previewHash},h.owner);
 const token=new URL(delivery.portalUrl).pathname.split('/').at(-1);
 return {client,billing,contacts,job,invoice,token};
}
