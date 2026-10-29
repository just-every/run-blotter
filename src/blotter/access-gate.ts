// Every authenticated HTTP door passes this gate. Scoped staff use only doors
// with an explicit client resource or a query known to intersect live scopes.
// Firm-wide financial/administrative reads remain principal-only for them.
import { documentAuthority, freshAccess, requireClient, requireDocument } from './permissions';
import { insist, rows, stmt, type Actor, type Data } from './model';

const lists = new Set(['/state','/inbox','/search','/board','/calendar','/queue','/plan','/v1/work','/v1/clients','/context','/views','/work-types','/messages/templates','/team','/notifications','/notifications/settings','/signatures/awaiting']);
const resources:Record<string,string>={
  jobs:'SELECT client_id FROM b_jobs WHERE id=?',
  requests:'SELECT j.client_id FROM b_requests r JOIN b_jobs j ON j.id=r.job_id WHERE r.id=?',
  files:'SELECT j.client_id FROM b_files f JOIN b_jobs j ON j.id=f.job_id WHERE f.id=?',
  documents:'SELECT client_id FROM b_document_sources WHERE file_key=?',
  'document-packets':'SELECT j.client_id FROM b_files f JOIN b_jobs j ON j.id=f.job_id WHERE f.id=?',
  'packet-uploads':'SELECT j.client_id FROM b_document_uploads u JOIN b_jobs j ON j.id=u.job_id WHERE u.id=?',
  threads:'SELECT client_id FROM b_threads WHERE id=?',
  time:'SELECT j.client_id FROM b_time t JOIN b_jobs j ON j.id=t.job_id WHERE t.id=?',
  expenses:'SELECT client_id FROM b_expenses WHERE id=?',
  organizers:'SELECT j.client_id FROM b_job_organizers o JOIN b_jobs j ON j.id=o.job_id WHERE o.id=?',
  notices:'SELECT client_id FROM b_notices WHERE id=?',
  credentials:'SELECT client_id FROM b_vault_credentials WHERE id=?',
  rules:'SELECT client_id FROM b_recurrence_rules WHERE id=?',
  'engagement-proposals':'SELECT j.client_id FROM b_signatures s JOIN b_jobs j ON j.id=s.job_id WHERE s.id=?',
  signatures:'SELECT j.client_id FROM b_signatures s JOIN b_jobs j ON j.id=s.job_id WHERE s.id=?',
  invoices:'SELECT client_id FROM b_invoices WHERE id=?',
  payments:'SELECT client_id FROM b_provider_payments WHERE id=?',
  'payment-mandates':'SELECT client_id FROM b_payment_mandates WHERE id=?',
  'invoice-retainers':'SELECT client_id FROM b_invoice_retainers WHERE id=?',
  authorizations:'SELECT client_id FROM b_authorizations WHERE id=?',
  'invoice-deliveries':'SELECT i.client_id FROM b_invoice_deliveries d JOIN b_invoices i ON i.id=d.invoice_id WHERE d.id=?',
};
// Financial authority opens these firm-wide doors to a scoped holder; each reads or writes only the clients the holder holds.
const financialReads = new Set(['/invoices','/invoices/reminders','/reports/performance','/reports/performance/csv','/reports/performance/pdf']);
const financialCreates = ['/invoices/preview','/invoices','/invoice-entitlements','/invoice-credits','/invoice-retainers'];
const sensitiveAdmin = (path:string) => /^\/(costs|agent-rules|access\/(teams|people|documents|delegations)|team($|\/)|keys($|\/)|firm($|\/)|credentials\/archive-mode|retention($|\/)|invoices\/authority|invoices\/reminders|invoice-retainers\/[^/]+\/auto-consent)/.test(path);
const exporting = (path:string) => /^\/(security\/access-log\.csv$|costs\/export|backup|portability\/exports|erasure-journal|exports($|\/)|reports\/.*\/(csv|pdf)$|team\/mfa-report|invoices\/[^/]+\/pdf$|clients\/[^/]+\/statement\/csv$)/.test(path);
export async function accessGate(db:D1Database,actor:Actor,request:Request) {
  const path=new URL(request.url).pathname.replace(/^\/api\/blotter/,'').replace(/^\/agent/,'');
  const write=!['GET','HEAD'].includes(request.method),factor=/^\/mfa($|\/)/.test(path)||path==='/access/step-up';
  if(actor.readOnly && write && !factor) insist(false,'Read-only staff cannot change practice records',403);
  if((write && sensitiveAdmin(path)) || exporting(path)) await freshAccess(db,actor);
  if (write && (/^\/(payments|payment-mandates)\//.test(path) || /\/quick-collect$/.test(path))) await freshAccess(db,actor);
  if (write && path === '/ai/settings') await freshAccess(db,actor);
  if (path.startsWith('/ai/')) {
    if (path === '/ai/settings') return;
    const match = path.match(/^\/ai\/(requests|drafts)\/([^/]+)/);
    insist(match, 'AI resource not found', 404);
    const table = match[1] === 'requests' ? 'b_ai_requests' : 'b_ai_drafts';
    const resource = await stmt(db, `SELECT client_id FROM ${table} WHERE id=?`, decodeURIComponent(match[2])).first<Data>();
    insist(resource, 'AI resource not found', 404); await requireClient(db,actor,resource.client_id); return;
  }
  const parts=path.split('/');
  let fileKey=['documents','files','document-packets'].includes(parts[1])&&parts[2]?decodeURIComponent(parts[2]):'';
  if(parts[1]==='deliverables' && parts[2]==='versions')fileKey='deliverable:'+parts[3];
  if(parts[1]==='expenses' && parts[3]==='receipt')fileKey='expense:'+parts[2];
  if(parts[1]==='jobs' && parts[3]==='steps' && parts[5]==='attachment')fileKey='task:'+parts[2]+':'+parts[4];
  if(parts[1]==='notices' && parts[3]==='events' && parts[5]==='file')fileKey='notice:'+parts[4];
  if(fileKey)await requireDocument(db,actor,fileKey);
  if (write && parts[1] === 'jobs' && ['filing-status','efile-authorization'].includes(parts[3])) {
    const body = await request.clone().json() as Data;
    if (body.fileId) await requireDocument(db, actor, String(body.fileId));
  }
  if(!actor.accessScoped || factor)return;
  if(/^\/access($|\/)/.test(path)) {
    insist(actor.manageAccess && !path.startsWith('/access/delegations'),'Only the principal or a manage-access holder manages access',403);
    if(parts[2]==='documents' && parts[3]) {
      const value=await stmt(db,'SELECT client_id FROM b_document_sources WHERE file_key=?',decodeURIComponent(parts[3])).first<Data>();
      insist(value,'Not found',404);await requireClient(db,actor,value.client_id);
    }
    return;
  }
  if(!write && lists.has(path))return;
  if(actor.financial && !write && financialReads.has(path))return;
  const [,kind,key]=path.split('/');
  if(kind==='clients' && key && !['fields'].includes(key)) {await requireClient(db,actor,decodeURIComponent(key));return;}
  if(kind==='deliverables' && key==='versions') {
    const value=await stmt(db,'SELECT j.client_id FROM b_deliverable_versions v JOIN b_jobs j ON j.id=v.job_id WHERE v.id=?',path.split('/')[3]).first<Data>();
    insist(value,'Not found',404);await requireClient(db,actor,value.client_id);return;
  }
  // Bulk resend names its invoices in the body; the door rechecks each one's client for the holder.
  if(actor.financial && write && (path==='/invoices/resend-preview'||path==='/invoices/resend'))return;
  if(Object.hasOwn(resources,kind) && key && !(write && actor.financial && financialCreates.includes(path))) {
    const value=await stmt(db,resources[kind],decodeURIComponent(key)).first<Data>();
    insist(value,'Not found',404);await requireClient(db,actor,value.client_id);return;
  }
  // New writes often carry their target in the body. Only these established
  // resource-creation doors accept that authority; unknown doors fail closed.
  if(write && (['/v1/time','/jobs','/plan','/notices','/rules','/prepare-reminder','/prepare-rollforward'].includes(path) || (actor.financial && financialCreates.includes(path)))) {
    const body=await request.clone().json() as Data;
    if(body.clientId) {await requireClient(db,actor,String(body.clientId));return;}
    if(body.jobId) {const j=await stmt(db,'SELECT client_id FROM b_jobs WHERE id=?',String(body.jobId)).first<Data>();insist(j,'Not found',404);await requireClient(db,actor,j.client_id);return;}
  }
  // Settings for one's own notifications never read client records.
  if(/^\/notifications\/(settings|[^/]+\/read)$/.test(path))return;
  insist(false,'This firm-wide door requires the principal while client scopes are configured',403);
}

/** Remove sensitive document metadata, snippets and bytes from nested views too. */
export async function redactAccess(db:D1Database,actor:Actor,value:unknown):Promise<unknown> {
  if(actor.role==='owner' || value instanceof Response)return value;
  const forbidden=new Set((await rows(db,`SELECT sd.file_key FROM b_sensitive_documents sd WHERE NOT ${documentAuthority(actor,'sd.file_key')}`)).map(r=>String(r.file_key)));
  const walk=(v:any):any=>{
    if(Array.isArray(v))return v.filter(item=>!item || typeof item!=='object' || ![item.file_key,item.file_id,item.fileId,item.open?.fileId,item.id].some(key=>forbidden.has(String(key)))).map(walk);
    if(v && typeof v==='object')return Object.fromEntries(Object.entries(v).map(([key,item])=>[key, (actor.readOnly||actor.role==='preparer')&&(key==='abn'||key==='ssn_last4') ? (typeof item==='string'&&item? '•••••'+item.replace(/\D/g,'').slice(-4):item) :walk(item)]));
    return v;
  };
  return walk(value);
}
