// PORTAL-002 signed-in views. A client opens one entity at a time, and only one its
// account holds a live grant for: an entity it never held and one revoked a moment ago
// answer the same "not found". Within it the client sees the work the firm already sent
// this contact, the documents shared with this contact, the contact's signature requests
// and the bills addressed to it. Every file is read through the audited contact door.
import { runtimeBindings, type Bindings } from '../auth.server';
import { isLanguage, type Language } from '../i18n/catalog';
import { contactDownload } from './document-downloads';
import { CONTACT_OK } from './document-source';
import { invoiceNumber } from './invoices-pdf';
import { invoiceBalanceSql } from './invoices-sources';
import { marketingGrantSql, withdrawStatements, withdrawnSql } from './marketing-consent';
import { gateRefusal } from './payment-gates';
import { clientProgress } from './portal-items';
import { id, insist, now, rows, stmt, type Data } from './model';
import { liveGrantSql } from './portal-accounts';
import type { Client } from './portal-session';

async function entityGrant(db: D1Database, client: Client, clientId: string) {
  const grant = await stmt(db, `SELECT g.contact_id,g.client_id,e.name client_name,c.name contact_name,c.email,c.language FROM b_portal_grants g JOIN b_clients e ON e.id=g.client_id
    JOIN b_client_contacts c ON c.id=g.contact_id WHERE g.account_id=? AND g.client_id=? AND ${liveGrantSql('g')}`, client.accountId, clientId).first<Data>();
  insist(grant, 'Not found', 404);
  return grant;
}
const audited = (db: D1Database, client: Client, action: string, objectId: string, detail: string) =>
  stmt(db, 'INSERT INTO b_audit(id,actor,action,object_id,detail,at) VALUES(?,?,?,?,?,?)', id(), `client portal (${client.email})`, action, objectId, detail, now());

/** One entity as this contact sees it. */
export async function clientEntity(db: D1Database, client: Client, clientId: string) {
  const g = await entityGrant(db, client, clientId), language: Language = isLanguage(g.language) ? g.language : 'en';
  // Work the firm already engaged this contact on: a link, an organizer question or a signature request was issued to them.
  const jobs = await rows(db, `SELECT j.* FROM b_jobs j WHERE j.client_id=? AND (EXISTS(SELECT 1 FROM b_portal_links l WHERE l.job_id=j.id AND l.contact_id=?)
    OR EXISTS(SELECT 1 FROM b_signatures s JOIN b_signature_signers x ON x.request_id=s.id AND x.attempt=s.attempt WHERE s.job_id=j.id AND x.contact_id=?)) ORDER BY j.period_start DESC,j.id LIMIT 40`, clientId, g.contact_id, g.contact_id);
  const work = [];
  for (const j of jobs) work.push({ id: j.id, title: j.title, period: j.period_label, dueDate: j.due_date, progress: await clientProgress(db, j, g.contact_id, language) });
  const documents = await rows(db, `SELECT f.file_key,f.kind,f.name,f.size,f.job_id FROM b_document_sources f JOIN b_document_access a ON a.file_key=f.file_key JOIN b_document_grants dg ON dg.file_key=f.file_key
    JOIN b_client_contacts c ON c.id=dg.contact_id JOIN b_clients e ON e.id=c.client_id WHERE f.client_id=? AND c.id=? AND a.visibility='contacts' AND a.sha256=f.sha256
    AND a.job_id=f.job_id AND a.client_id=f.client_id AND c.client_id=f.client_id AND ${CONTACT_OK} ORDER BY f.name,f.file_key`, clientId, g.contact_id);
  const files = [];
  for (const d of documents) files.push({ ref: d.file_key, kind: d.kind, name: d.name, size: d.size, locked: Boolean(await gateRefusal(db, d.file_key)) });
  const signatures = await rows(db, `SELECT s.id,s.title,s.status,s.completed_at,x.status signer_status,x.signed_at FROM b_signatures s JOIN b_jobs j ON j.id=s.job_id
    JOIN b_signature_signers x ON x.request_id=s.id AND x.attempt=s.attempt WHERE j.client_id=? AND x.contact_id=? AND s.status IN ('pending','completed') AND s.erased_at IS NULL ORDER BY s.created_at DESC`, clientId, g.contact_id);
  const bills = await rows(db, `SELECT i.id,i.number,i.title,i.issue_date,i.due_date,i.total_cents,${invoiceBalanceSql('i')} balance_cents FROM b_invoices i
    WHERE i.client_id=? AND i.status='issued' AND i.erased_at IS NULL AND json_extract(i.snapshot,'$.recipient.id')=? ORDER BY i.issue_date DESC,i.number DESC`, clientId, g.contact_id);
  const marketing = await stmt(db, `SELECT ${marketingGrantSql} granted,${withdrawnSql} withdrawn FROM b_client_contacts c WHERE c.id=?`, g.contact_id).first<Data>();
  return { clientId, name: g.client_name, contactName: g.contact_name, language, work, documents: files,
    signatures: signatures.map(s => ({ id: s.id, title: s.title, status: s.status, signerStatus: s.signer_status, signedAt: s.signed_at, completedAt: s.completed_at })),
    bills: bills.map(b => ({ id: b.id, number: invoiceNumber(b.number), title: b.title, issueDate: b.issue_date, dueDate: b.due_date, totalCents: b.total_cents, balanceCents: Number(b.balance_cents) })),
    preferences: { marketingEmail: Boolean(marketing?.granted) && !marketing?.withdrawn } };
}

/** A shared document, through the same audited contact door (payment gates and grants rechecked). */
export async function clientFile(db: D1Database, client: Client, clientId: string, ref: string) {
  const g = await entityGrant(db, client, clientId);
  return contactDownload(db, ref, g.contact_id);
}

const pdf = (bytes: string, name: string) => new Response(Uint8Array.from(atob(bytes), c => c.charCodeAt(0)), { headers: { 'content-type': 'application/pdf', 'content-disposition': `attachment; filename="${name.replace(/[^A-Za-z0-9._-]+/g, '-')}"`, 'cache-control': 'no-store' } });

/** The completed signed PDF of a request this contact signed. */
export async function clientSignedPdf(db: D1Database, client: Client, clientId: string, requestId: string) {
  const g = await entityGrant(db, client, clientId);
  const s = await stmt(db, `SELECT s.id,s.title,s.signed_base64 FROM b_signatures s JOIN b_jobs j ON j.id=s.job_id JOIN b_signature_signers x ON x.request_id=s.id AND x.attempt=s.attempt
    WHERE s.id=? AND j.client_id=? AND x.contact_id=? AND x.status='signed' AND s.status='completed' AND s.erased_at IS NULL AND s.signed_base64 IS NOT NULL`, requestId, clientId, g.contact_id).first<Data>();
  insist(s, 'Not found', 404);
  await audited(db, client, 'portal.signed_pdf_read', s.id, s.title).run();
  return pdf(s.signed_base64, `${s.title}.pdf`);
}

/** The numbered PDF of an issued bill addressed to this contact. */
export async function clientBillPdf(db: D1Database, client: Client, clientId: string, invoiceId: string) {
  const g = await entityGrant(db, client, clientId);
  const i = await stmt(db, `SELECT id,number,pdf_base64 FROM b_invoices WHERE id=? AND client_id=? AND status='issued' AND erased_at IS NULL AND pdf_base64 IS NOT NULL AND json_extract(snapshot,'$.recipient.id')=?`, invoiceId, clientId, g.contact_id).first<Data>();
  insist(i, 'Not found', 404);
  await audited(db, client, 'portal.bill_read', i.id, invoiceNumber(i.number)).run();
  return pdf(i.pdf_base64, `${invoiceNumber(i.number)}.pdf`);
}

/** Preferences: the client can stop marketing email for this address at once (MSG-002); engagement notices about their work continue. */
export async function savePreferences(env: Bindings, client: Client, clientId: string, body: Data) {
  const db = runtimeBindings(env).DB, g = await entityGrant(db, client, clientId);
  insist(body.marketingEmail === false, 'Marketing email can be stopped here; ask the practice to record a new opt-in');
  await db.batch(withdrawStatements(db, client.email, 'portal_preference', `client portal (${client.email})`, 'signed-in client portal preference', g.client_id));
  return clientEntity(db, client, clientId);
}
