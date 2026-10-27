// Native scope mapping and setup preview. This door has no execution authority.
import { documentText } from './pdf-text';
import { atomic, audit, digest, guard, human, insist, rows, stmt, text, type Actor, type Data } from './model';

const normalize = (value: string) => value.replace(/\s+/g, ' ').trim();

/** Keep the source label honest: recorded letters are not native signatures. */
export async function signedSource(db: D1Database, clientId: string, body: Data) {
  const kind = body.source?.kind, sourceId = text(body.source?.id, 'Signed scope source', 100);
  insist(kind === 'engagement' || kind === 'signature', 'Choose a recorded engagement or completed signed document');
  const record = kind === 'engagement'
    ? await stmt(db, 'SELECT id,sha256,content_base64 bytes,mime,name,label FROM b_engagements WHERE id=? AND client_id=? AND erased_at IS NULL', sourceId, clientId).first<Data>()
    : await stmt(db, `SELECT s.id,s.signed_sha256 sha256,s.signed_base64 bytes,'application/pdf' mime,s.source_name name,
        'Signed through Blotter; identity not verified; scope mapping declared by the principal' label
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
  return { clientId, clientRevision: client.revision, contactStamp: contacts.map(contact => contact.id + ':' + contact.revision).join(','), status: 'preview', fingerprint, source: { id: source.record.id, kind: source.kind, label: source.record.label, sha256: source.record.sha256, href: source.href },
    services, items, coverage: 'Principal-declared scope mapping checked against readable signed text; completeness and interpretation require human review.',
    execution: 'Unavailable: this preview sends nothing, grants no access, creates no work, changes no fee or signature and cannot approve a plan.' };
}

/** Review records selected items; it confers no permission to send or connect. */
export async function reviewOnboarding(db: D1Database, actor: Actor, clientId: string, body: Data) {
  const preview = await previewOnboarding(db, actor, clientId, body);
  insist(body.fingerprint === preview.fingerprint, 'The scope, client or template changed. Preview again before reviewing.', 409);
  const reason = text(body.reason, 'Review reason', 1000);
  insist(Array.isArray(body.selectedItemIds) && body.selectedItemIds.length > 0 && new Set(body.selectedItemIds).size === body.selectedItemIds.length, 'Select distinct setup items');
  const selected: string[] = body.selectedItemIds;
  insist(selected.every(value => typeof value === 'string' && preview.items.some(item => item.id === value)), 'Only items in the current preview may be selected');
  const selection = preview.items.filter(item => selected.includes(item.id)).map(item => item.id);
  const existing = await stmt(db, 'SELECT * FROM b_onboarding_plans WHERE client_id=? AND source_kind=? AND source_id=?', clientId, preview.source.kind, preview.source.id).first<Data>();
  if (existing) {
    insist(existing.status === 'reviewed' && existing.fingerprint === preview.fingerprint && existing.selection === JSON.stringify(selection), 'This signed scope already has a different or held review; it cannot be replayed.', 409);
    return onboardingPlan(db, actor, clientId, existing.id);
  }
  const planId = crypto.randomUUID(), at = new Date().toISOString();
  await atomic(db, actor, [
    ...livePlanSource(db, clientId, preview.source),
    ...guard(db, 'EXISTS(SELECT 1 FROM b_clients WHERE id=? AND revision=?)', clientId, preview.clientRevision),
    ...guard(db, "COALESCE((SELECT group_concat(stamp,',') FROM (SELECT id||':'||revision stamp FROM b_client_contacts WHERE client_id=? AND active=1 ORDER BY id)),'')=?", clientId, preview.contactStamp),
    ...preview.services.flatMap(service => { const t = service.template; return [...guard(db, 'EXISTS(SELECT 1 FROM b_templates WHERE id=? AND name=? AND recurrence=? AND steps=? AND requests=? AND questions=?)', t.id, t.name, t.recurrence, JSON.stringify(t.steps), JSON.stringify(t.requests), JSON.stringify(t.questions))]; }),
    stmt(db, `INSERT INTO b_onboarding_plans(id,client_id,source_kind,source_id,fingerprint,plan,selection,decided_by,decision_reason,decided_at,revision) VALUES(?,?,?,?,?,?,?,?,?,?,?)`,
      planId, clientId, preview.source.kind, preview.source.id, preview.fingerprint, JSON.stringify(preview), JSON.stringify(selection), actor.email, reason, at, crypto.randomUUID()),
    audit(db, actor, 'onboarding.reviewed', clientId, JSON.stringify({ planId, selected: selection, removed: preview.items.filter(item => !selected.includes(item.id)).map(item => item.id) })),
  ]);
  return onboardingPlan(db, actor, clientId, planId);
}

function livePlanSource(db: D1Database, clientId: string, source: Data) {
  return [...guard(db, "EXISTS(SELECT 1 FROM b_clients WHERE id=? AND lifecycle='active' AND merged_into IS NULL AND erased_at IS NULL)", clientId),
    ...(source.kind === 'engagement'
      ? guard(db, 'EXISTS(SELECT 1 FROM b_engagements WHERE id=? AND client_id=? AND sha256=? AND content_base64 IS NOT NULL AND erased_at IS NULL)', source.id, clientId, source.sha256)
      : guard(db, "EXISTS(SELECT 1 FROM b_signatures s JOIN b_jobs j ON j.id=s.job_id WHERE s.id=? AND j.client_id=? AND s.signed_sha256=? AND s.signed_base64 IS NOT NULL AND s.status='completed' AND s.erased_at IS NULL)", source.id, clientId, source.sha256))];
}

export async function onboardingPlan(db: D1Database, actor: Actor, clientId: string, planId: string) {
  human(actor); insist(actor.role === 'owner' && !actor.automation, 'Only the principal can read onboarding scope reviews', 403);
  const record = await stmt(db, `SELECT p.* FROM b_onboarding_plans p JOIN b_clients c ON c.id=p.client_id WHERE p.id=? AND p.client_id=? AND c.lifecycle='active' AND c.erased_at IS NULL AND c.merged_into IS NULL`, planId, clientId).first<Data>();
  insist(record, 'Onboarding plan not found', 404);
  const plan = JSON.parse(record.plan), selection: string[] = JSON.parse(record.selection), progress = JSON.parse(record.progress);
  // No retained scope is disclosed after the source has been erased.
  await signedSource(db, clientId, {source:{kind:record.source_kind,id:record.source_id}});
  return { id: record.id, status: record.status, revision: record.revision, fingerprint: record.fingerprint, source: plan.source,
    decidedBy: record.decided_by, decidedAt: record.decided_at, reason: record.decision_reason,
    items: plan.items.map((item: Data) => ({ ...item, selected: selection.includes(item.id), progress: progress[item.id] ?? null })),
    execution: 'Review record only. No invitation, request, access grant, work schedule, signature, connection or billing action is executed.' };
}

/** Human-entered progress is an observation, never provider verification. */
export async function recordOnboardingProgress(db: D1Database, actor: Actor, clientId: string, planId: string, body: Data) {
  const plan = await onboardingPlan(db, actor, clientId, planId);
  insist(plan.status === 'reviewed', 'Restored plans are held; no execution or progress replay is allowed', 409);
  insist(body.revision === plan.revision, 'Plan changed; refresh before recording progress', 409);
  const itemId = text(body.itemId, 'Setup item', 100), item = plan.items.find((item: Data) => item.id === itemId);
  insist(item?.selected, 'Only selected setup items can receive progress', 409);
  insist(['received','blocked','pending'].includes(body.state), 'Choose received, blocked or pending');
  const note = text(body.note, 'Observed evidence or blocker', 1000), nextAction = text(body.nextAction, 'Next action and due condition', 1000);
  // ct approved principal custody for this native subset on 25 October 2026.
  insist(body.ownerEmail === actor.email, 'The principal owns onboarding observations in this native subset', 403);
  const progress = Object.fromEntries(plan.items.filter((value: Data) => value.progress).map((value: Data) => [value.id, value.progress]));
  const previous = progress[itemId];
  const history = previous ? [...(previous.history ?? []), Object.fromEntries(Object.entries(previous).filter(([key]) => key !== 'history'))] : [];
  progress[itemId] = { history, state: body.state, note, nextAction, ownerEmail: actor.email, recordedBy: actor.email, recordedAt: new Date().toISOString(),
    verification: 'Practitioner-recorded observation; no provider connection or client response is independently verified',
    chaseDraft: body.state === 'received' ? null : `Please complete the setup item: ${item.label}. Your accountant will review the response.` };
  await atomic(db, actor, [
    ...livePlanSource(db, clientId, plan.source),
    ...guard(db, "EXISTS(SELECT 1 FROM b_onboarding_plans WHERE id=? AND client_id=? AND revision=? AND status='reviewed')", planId, clientId, plan.revision),
    stmt(db, 'UPDATE b_onboarding_plans SET progress=?,revision=? WHERE id=?', JSON.stringify(progress), crypto.randomUUID(), planId),
    audit(db, actor, 'onboarding.progress_recorded', clientId, JSON.stringify({ planId, itemId, state: body.state, ownerEmail: actor.email })),
  ]);
  return onboardingPlan(db, actor, clientId, planId);
}
