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
  const out: Observed[] = [];
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
  const archives = await rows(db, `SELECT actor,count(*) n FROM b_audit WHERE action='archive.downloaded' AND at>=(SELECT created_at FROM b_clients WHERE id=${c}) GROUP BY actor`);
  out.push(...named(archives, who => `Owner archives downloaded (${who})`, 'archive-downloads', who => `${who} (the named downloader)`));
  const reads = await rows(db, `SELECT actor,count(*) n FROM b_audit WHERE action='agent.read' AND instr(detail,${c})>0 GROUP BY actor`);
  out.push(...named(reads, who => `Data read by an agent key (${who})`, 'agent-reads', who => `${who} (the key label and its creator)`));
  return out;
}
