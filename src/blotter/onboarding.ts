// Native scope mapping and setup preview. This door has no execution authority.
import { documentText } from './pdf-text';
import { atomic, audit, digest, guard, human, insist, rows, stmt, text, type Actor, type Data } from './model';

const normalize = (value: string) => value.replace(/\s+/g, ' ').trim();

/** Keep the source label honest: recorded letters are not native signatures. */
async function signedSource(db: D1Database, clientId: string, body: Data) {
  const kind = body.source?.kind, sourceId = text(body.source?.id, 'Signed scope source', 100);
  insist(kind === 'engagement' || kind === 'signature', 'Choose a recorded engagement or completed signed document');
  const record = kind === 'engagement'
    ? await stmt(db, 'SELECT id,sha256,content_base64 bytes,mime,name,label FROM b_engagements WHERE id=? AND client_id=? AND erased_at IS NULL', sourceId, clientId).first<Data>()
    : await stmt(db, `SELECT s.id,s.signed_sha256 sha256,s.signed_base64 bytes,'application/pdf' mime,s.source_name name,
        'Signed through Blotter; scope mapping declared by the principal' label
        FROM b_signatures s JOIN b_jobs j ON j.id=s.job_id
        WHERE s.id=? AND j.client_id=? AND s.status='completed' AND s.erased_at IS NULL`, sourceId, clientId).first<Data>();
  insist(record?.bytes, 'Available signed scope not found on this client', 404);
  const bytes = Uint8Array.from(atob(record.bytes), c => c.charCodeAt(0));
  insist(await digest(bytes) === record.sha256, 'Signed scope integrity check failed', 409);
  const words = normalize(await documentText(record.mime, record.name, bytes));
  insist(words, 'This signed document has no readable scope text. Supply a readable signed letter; no scope is guessed.', 409);
  return { kind, record, words, href: kind === 'engagement' ? `/api/blotter/engagements/${sourceId}/file` : `/api/blotter/signatures/${sourceId}/files/signed` };
}

/** A deterministic, write-free setup proposal apart from its content-free audit event. */
export async function previewOnboarding(db: D1Database, actor: Actor, clientId: string, body: Data) {
  human(actor);
  // The source doors already reserve practitioner-recorded letters to the principal.
  insist(actor.role === 'owner' && !actor.automation, 'Only the principal can map signed scope for onboarding', 403);
  const client = await stmt(db, "SELECT id,revision FROM b_clients WHERE id=? AND lifecycle='active' AND merged_into IS NULL AND erased_at IS NULL", clientId).first<Data>();
  insist(client, 'Active client not found', 404);
  const source = await signedSource(db, clientId, body);
  insist(Array.isArray(body.services) && body.services.length > 0 && body.services.length <= 20, 'Map between 1 and 20 signed services');
  const items: Data[] = [], services: Data[] = [], templateGuards: D1PreparedStatement[] = [];
  const seen = new Set<string>();
  for (const [index, value] of body.services.entries()) {
    insist(value && typeof value === 'object' && !Array.isArray(value), 'Supply a service mapping');
    const kind = value.kind;
    insist(kind === 'tax' || kind === 'bookkeeping', 'Choose tax or bookkeeping for this setup mapping');
    const quote = normalize(text(value.quote, 'Exact signed scope quote', 2000));
    insist(source.words.includes(quote), 'Every service must cite an exact quote from the signed document', 409);
    const templateId = text(value.templateId, 'Work template', 100);
    insist(!seen.has(templateId), 'Map each work template once'); seen.add(templateId);
    const template = await stmt(db, 'SELECT id,name,recurrence,steps,requests,questions FROM b_templates WHERE id=?', templateId).first<Data>();
    insist(template, 'Work template not found', 404);
    insist(kind !== 'bookkeeping' || ['qbo', 'xero'].includes(value.ledger), 'Choose QBO or Xero for bookkeeping');
    insist(kind !== 'tax' || ['2848', '8821'].includes(value.authorization), 'Choose the authorization form to propose');
    const scope = { index, quote, sourceId: source.record.id, sourceKind: source.kind, sha256: source.record.sha256, href: source.href };
    const add = (type: string, label: string, details: Data = {}) => items.push({ id: `${index}:${type}`, type, label, scope, status: 'proposed', ...details });
    add('client', 'Review client entity against signed scope', { clientId });
    add('contacts', 'Review entity contacts and signer authority');
    add('schedule', 'Review work schedule from template', { templateId, recurrence: template.recurrence });
    if (kind === 'tax') {
      add('prior-return', 'Request prior-year return');
      add('authorization', `Prepare Form ${value.authorization}`, { form: value.authorization, requiresPractitionerReview: true });
    } else {
      add('opening-balances', 'Request opening balances');
      add('ledger', `Invite client to connect ${value.ledger === 'qbo' ? 'QBO' : 'Xero'}`, { provider: value.ledger, connection: 'unavailable: LEDGER-001' });
      add('bank', 'Invite client to arrange bank connection', { connection: 'unavailable: authorized ledger connection required' });
    }
    add('portal', 'Review portal invitation and recipient consent');
    services.push({ kind, scope, template: { ...template, steps: JSON.parse(template.steps), requests: JSON.parse(template.requests), questions: JSON.parse(template.questions) } });
    templateGuards.push(...guard(db, 'EXISTS(SELECT 1 FROM b_templates WHERE id=? AND name=? AND recurrence=? AND steps=? AND requests=? AND questions=?)', template.id, template.name, template.recurrence, template.steps, template.requests, template.questions));
  }
  const contacts = await rows(db, 'SELECT id,revision FROM b_client_contacts WHERE client_id=? AND active=1 ORDER BY id', clientId);
  const fingerprint = await digest(JSON.stringify({ clientId, clientRevision: client.revision, contacts, services, items }));
  const sourceGuard = source.kind === 'engagement'
    ? guard(db, 'EXISTS(SELECT 1 FROM b_engagements WHERE id=? AND client_id=? AND sha256=? AND content_base64 IS NOT NULL AND erased_at IS NULL)', source.record.id, clientId, source.record.sha256)
    : guard(db, "EXISTS(SELECT 1 FROM b_signatures s JOIN b_jobs j ON j.id=s.job_id WHERE s.id=? AND j.client_id=? AND s.signed_sha256=? AND s.signed_base64 IS NOT NULL AND s.status='completed' AND s.erased_at IS NULL)", source.record.id, clientId, source.record.sha256);
  await atomic(db, actor, [
    ...guard(db, "EXISTS(SELECT 1 FROM b_clients WHERE id=? AND revision=? AND lifecycle='active' AND merged_into IS NULL AND erased_at IS NULL)", clientId, client.revision),
    ...sourceGuard, ...templateGuards,
    audit(db, actor, 'onboarding.previewed', clientId, JSON.stringify({ sourceId: source.record.id, sourceKind: source.kind, fingerprint, itemCount: items.length })),
  ]);
  return { clientId, status: 'preview', fingerprint, source: { id: source.record.id, kind: source.kind, label: source.record.label, sha256: source.record.sha256, href: source.href },
    services, items, coverage: 'Principal-declared scope mapping checked against readable signed text; completeness and interpretation require human review.',
    execution: 'Unavailable: this preview sends nothing, grants no access, creates no work, changes no fee or signature and cannot approve a plan.' };
}
