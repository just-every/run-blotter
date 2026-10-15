// Blotter client list CSV v1: the documented shape in IMPORTING.md.
import { Buffer } from 'node:buffer';
import { canonicalJson, sha256, type Diagnostic, type ImportMapping, type SourceBundle, type SourceRecord } from '../../modules/import-kit/src/d1/index';
import { insist } from '../model';
import { parseCsv } from './csv';

export const NAMESPACE = 'client-list';
export const MAPPING_VERSION = 'client-list-v1';
const REQUIRED = ['client_name'];
const OPTIONAL = ['client_id', 'abn', 'contact_name', 'contact_email'];

export function clientListSource(raw: unknown, filename: unknown) {
  insist(typeof raw === 'string' && raw.length > 0, 'Choose a client list CSV');
  const bytes = Buffer.from(raw, 'utf8');
  insist(bytes.length <= 1_000_000, 'The client list must be at most 1 MB');
  insist(!raw.includes('\0'), 'The CSV contains a NUL character');
  const name = typeof filename === 'string' && filename.trim() ? filename.trim().slice(0, 200) : 'clients.csv';
  const { headers, rows } = parseCsv(raw);
  const missing = REQUIRED.filter(header => !headers.includes(header));
  insist(!missing.length, `The CSV is missing required columns: ${missing.join(', ')}`);
  insist(rows.length > 0 && rows.length <= 2000, 'Import between 1 and 2,000 clients per file');
  const artifactHash = sha256(bytes), diagnostics: Diagnostic[] = [], records: SourceRecord[] = [];
  const ignoredColumns = headers.filter(header => !REQUIRED.includes(header) && !OPTIONAL.includes(header));
  if (ignoredColumns.length) diagnostics.push({ severity: 'warning', code: 'UNMAPPED_COLUMNS', message: `Columns kept in the original file only: ${ignoredColumns.join(', ')}` });
  const seen = new Set<string>(), clients: { sourceId: string; name: string; abn: string; contactName: string; contactEmail: string }[] = [];
  for (const { line, value } of rows) {
    const clientName = value.client_name.trim(), abn = (value.abn ?? '').replace(/\s/g, '');
    const contactName = (value.contact_name ?? '').trim(), contactEmail = (value.contact_email ?? '').trim().toLowerCase();
    // Without the old system's client_id, identity is the normalised name and ABN.
    const sourceId = value.client_id?.trim() || `client:${sha256(canonicalJson([clientName.toLowerCase(), abn]))}`;
    const location = { artifact: name, row: line };
    const fail = (code: string, message: string) => diagnostics.push({ severity: 'error', code, message: `Row ${line}: ${message}`, kind: 'client', sourceId, location });
    if (!clientName || clientName.length > 200) fail('BAD_NAME', 'client_name is required (at most 200 characters)');
    if (abn && !/^\d{11}$/.test(abn)) fail('BAD_ABN', 'abn must be empty or 11 digits');
    if (contactName.length > 200) fail('BAD_CONTACT', 'contact_name must be at most 200 characters');
    if (contactEmail && (contactEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail))) fail('BAD_EMAIL', 'contact_email must be empty or a valid email address');
    if (sourceId.length > 200) fail('BAD_ID', 'client_id must be at most 200 characters');
    const duplicate = seen.has(sourceId);
    if (duplicate) fail('DUPLICATE_CLIENT', 'this client appears more than once');
    seen.add(sourceId);
    if (!duplicate) records.push({ namespace: NAMESPACE, kind: 'client', sourceId, payload: value, payloadHash: sha256(canonicalJson(value)), artifactHash, location });
    clients.push({ sourceId, name: clientName, abn, contactName, contactEmail });
  }
  const blocked = diagnostics.some(d => d.severity === 'error');
  const values = new Map(clients.map(c => [c.sourceId, { name: c.name, abn: c.abn, contactName: c.contactName, contactEmail: c.contactEmail, source: 'client-list' }]));
  const source: SourceBundle = {
    artifacts: [{ name, sha256: artifactHash, size: bytes.length, original: { status: 'available', base64: bytes.toString('base64') } }], records, diagnostics,
  };
  const mapping: ImportMapping = {
    version: MAPPING_VERSION,
    map: record => blocked ? { effects: [], rejection: 'Resolve the CSV errors before importing' } : {
      effects: [{ targetKind: 'client', targetId: `import:${sha256(record.sourceId)}`, value: values.get(record.sourceId)! }],
    },
  };
  return { source, mapping, clients, summary: {
    clients: rows.length, ignoredColumns,
    errors: diagnostics.filter(d => d.severity === 'error').map(d => d.message),
    warnings: diagnostics.filter(d => d.severity === 'warning').map(d => d.message),
  } };
}
