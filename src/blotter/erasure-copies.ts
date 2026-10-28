import { integrationFamilySql } from './integration-policy';
import {signatureOutsideCopies} from './signatures-retention';
import { invoiceObservedCopies } from './invoices-erasure';
// ERASURE-002 observed outside copies (ct 22 Oct 2026). Blotter names every copy of a client's
// data it can observe leaving the installation, with its owner, and never claims to delete one:
// mail through the platform relay, files downloaded through share links, the portal or by staff,
// billing exports and owner archives downloaded by staff, and data read by agent or API keys.
// Copies Blotter cannot observe are recorded by the principal (b_external_copies).
import { lit } from './erasure-scope';
import { rows, type Data } from './model';

export type Observed = { source: string; label: string; owner: string; count: number; kind: 'observed' };

const named = (rowsOf: Data[], label: (owner: string) => string, source: string, own?: (actor: string) => string): Observed[] =>
  rowsOf.map(r => ({ source, label: label(String(r.actor)), owner: own ? own(String(r.actor)) : String(r.actor), count: Number(r.n), kind: 'observed' as const }));

export async function observedCopies(db: D1Database, clientId: string): Promise<Observed[]> {
  const c = lit(clientId), jobs = `(SELECT id FROM b_jobs WHERE client_id=${c})`, files = `(SELECT file_key FROM b_document_sources WHERE client_id=${c})`;
  const out: Observed[] = [...await signatureOutsideCopies(db,clientId) as Observed[],...await invoiceObservedCopies(db,clientId)];
  for (const r of await rows(db, 'SELECT provider actor,count(*) n FROM b_ai_requests WHERE client_id=? GROUP BY provider', clientId))
    out.push({source:'ai-provider',label:'Masked selected source processing; owner-recorded no-training and no-retention attestation',owner:String(r.actor)+' (provider; attestation recorded by firm owner, not deletion verified by Blotter)',count:Number(r.n),kind:'observed'});
  const relay = Number((await rows(db, `SELECT
    (SELECT count(*) FROM b_reminders WHERE job_id IN ${jobs} AND delivery LIKE 'accepted by %')
    +(SELECT count(*) FROM b_organizer_deliveries WHERE organizer_id IN (SELECT id FROM b_job_organizers WHERE job_id IN ${jobs}) AND delivery LIKE 'accepted by %')
    +(SELECT count(*) FROM b_bulk_recipients WHERE client_id=${c} AND delivery LIKE 'accepted by %')
    +(SELECT count(*) FROM b_portal_items WHERE job_id IN ${jobs} AND status='sent') n`))[0].n);
  if (relay) {
    out.push({ source: 'relay-mail', label: 'Mail delivered through the platform relay', owner: 'The mail provider (provider-retained)', count: relay, kind: 'observed' });
    out.push({ source: 'relay-mail-recipients', label: 'The same mail in recipients\' mailboxes', owner: 'The recipients (recipient-controlled)', count: relay, kind: 'observed' });
  }
  const bearer = await rows(db, `SELECT 'bearer' actor,count(*) n FROM b_audit WHERE action='file.downloaded' AND object_id IN ${files} AND json_extract(detail,'$.channel')='bearer' HAVING count(*)>0`);
  out.push(...named(bearer, () => 'Files downloaded through share links or the portal', 'file-downloads', () => 'The recipients of the links (recipient-controlled; identity not verified)'));
  const staff = await rows(db, `SELECT actor,count(*) n FROM b_audit WHERE action='file.downloaded' AND object_id IN ${files} AND json_extract(detail,'$.channel')='staff' GROUP BY actor`);
  out.push(...named(staff, who => `Files downloaded by staff (${who})`, 'file-downloads', who => `${who} (the named downloader)`));
  const csvs = await rows(db, `SELECT actor,count(*) n FROM b_audit WHERE action='export.downloaded' AND object_id IN
    (SELECT s.export_id FROM b_export_sources s WHERE s.source_key IN (SELECT 'time:'||id FROM b_time WHERE job_id IN ${jobs}) OR s.source_key IN (SELECT 'exp:'||id FROM b_expenses WHERE client_id=${c}) OR s.source_key IN (SELECT 'fee:'||id FROM b_jobs WHERE client_id=${c})) GROUP BY actor`);
  out.push(...named(csvs, who => `Billing CSVs downloaded by staff (${who})`, 'billing-downloads', who => `${who} (the named downloader)`));
  const reports=await rows(db,`SELECT actor,count(*) n FROM b_audit WHERE action='report.client_downloaded' AND object_id=${c} GROUP BY actor`);
  out.push(...named(reports,who=>`Client data in report CSVs/PDFs downloaded by staff (${who})`,'report-downloads',who=>`${who} (the named downloader)`));
  const logs = await rows(db, `SELECT e.actor,count(*) n FROM b_audit e WHERE e.action='security.access_log_exported'
    AND json_valid(e.detail) AND EXISTS(SELECT 1 FROM b_audit d WHERE d.action='file.downloaded' AND d.object_id IN ${files}
      AND julianday(d.at)>=julianday(json_extract(e.detail,'$.from')) AND julianday(d.at)<julianday(json_extract(e.detail,'$.endExclusive')))
    GROUP BY e.actor`);
  out.push(...named(logs, who => `Access-log CSVs downloaded (${who})`, 'access-log-downloads', who => `${who} (the named downloader; erase external copies independently)`));
  const archives = await rows(db, `SELECT actor,count(*) n FROM b_audit WHERE action='archive.downloaded' AND at>=(SELECT created_at FROM b_clients WHERE id=${c}) GROUP BY actor`);
  out.push(...named(archives, who => `Owner archives downloaded (${who})`, 'archive-downloads', who => `${who} (the named downloader)`));
  const deliveries=await rows(db,`SELECT h.label,k.creator_email,count(*) n FROM b_integration_deliveries d JOIN b_integration_hooks h ON h.id=d.hook_id JOIN b_integration_keys k ON k.id=h.key_id WHERE d.client_id IN ${integrationFamilySql(c)} AND d.attempts>0 AND d.status IN ('delivered','held','dispatching') GROUP BY h.id`);
  out.push(...deliveries.map(r=>({source:'integration-webhooks',label:`Thin completion notices to webhook (${r.label})`,owner:`${r.creator_email} (creator; owner-configured external receiver)`,count:Number(r.n),kind:'observed' as const})));
  const integrations=await rows(db,`SELECT k.label,k.creator_email,count(*) n FROM b_audit a JOIN b_integration_keys k ON k.id=a.object_id WHERE a.action='integration.read' AND EXISTS(SELECT 1 FROM json_each(a.detail,'$.clientIds') j WHERE j.value IN ${integrationFamilySql(c)}) GROUP BY k.id`);
  out.push(...integrations.map(r=>({source:'integration-reads',label:`Data read by integration key (${r.label})`,owner:`${r.creator_email} (key creator; external recipient-controlled)`,count:Number(r.n),kind:'observed' as const})));
  const reads = await rows(db, `SELECT actor,count(*) n FROM b_audit WHERE action='agent.read' AND instr(detail,${c})>0 GROUP BY actor`);
  out.push(...named(reads, who => `Data read by an agent key (${who})`, 'agent-reads', who => `${who} (the key label and its creator)`));
  return out;
}
