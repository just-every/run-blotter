import { runtimeBindings, type Bindings } from '../auth.server';
import { accessActor } from './permissions';
import { aiModel, aiProvider, aiSettings } from './ai-settings';
import { aiJob, aiScope, aiSource, aiSources } from './ai-sources';
import { maskAiText } from './ai-masking';
import { runAiProvider, validateAiOutput } from './ai-provider';
import { atomic, audit, digest, Fault, guard, human, id, insist, need, now, rows, stmt, text, type Actor, type Data } from './model';

export async function aiState(db: D1Database, actor: Actor, env: Bindings, jobId: string) {
  await aiJob(db, actor, jobId);
  const list = await rows(db, 'SELECT d.*,r.purpose,r.source_id,r.source_kind FROM b_ai_drafts d JOIN b_ai_requests r ON r.id=d.request_id WHERE d.job_id=? ORDER BY d.saved_at DESC', jobId);
  const drafts = [];
  for (const d of list) {
    if (d.purpose === 'notice' && actor.role === 'preparer') continue;
    try { await aiSource(db, actor, jobId, d.source_kind, d.source_id); drafts.push({ ...d, output: JSON.parse(d.output), decisions: await rows(db, 'SELECT * FROM b_ai_decisions WHERE draft_id=?', d.id) }); }
    catch (error) { if (!(error instanceof Fault && [403,404,409,422].includes(error.status))) throw error; }
  }
  return { ...await aiSettings(db, actor, env), sources: await aiSources(db, actor, jobId), drafts,
    targets: await rows(db, 'SELECT id,label FROM b_requests WHERE job_id=? AND organizer_active=1 ORDER BY ordinal', jobId) };
}
export async function requestAi(env: Bindings, actor: Actor, jobId: string, body: Data) {
  human(actor);
  const db = runtimeBindings(env).DB;
  const purpose = text(body.purpose, 'Purpose', 20);
  insist(['summary','document','notice'].includes(purpose), 'Choose a supported assistance task');
  if (purpose === 'notice') need(actor, 'owner', 'reviewer');
  insist(purpose === 'summary' || body.sourceKind === 'document', 'This task requires an uploaded document');
  const source = await aiSource(db, actor, jobId, text(body.sourceKind, 'Source kind', 20), text(body.sourceId, 'Source', 250));
  const settings = await stmt(db, 'SELECT * FROM b_ai_settings WHERE id=1').first<Data>();
  const enabled = settings?.enabled && settings.provider === aiProvider() && settings.model === aiModel(env);
  if (body.confirm !== true || !enabled) {
    await atomic(db,actor,[audit(db,actor,'ai.refused',id(),JSON.stringify({sourceIds:source.ids,provider:aiProvider(),model:aiModel(env),bytes:0,at:now(),reason:body.confirm!==true?'Explicit click missing':'Firm approval missing'}))]);
    insist(body.confirm === true, 'Explicitly click to process the selected source; nothing has been sent', 400);
    insist(enabled, 'The firm owner has not enabled AI assistance for this provider and model', 403);
  }
  insist(env.AI_API_KEY, 'The AI provider is not configured', 503);
  const masked = maskAiText(source.text), requestId = id(), at = now(), inputBytes = new TextEncoder().encode(masked).length;
  const used=Number((await stmt(db,'SELECT COUNT(*) n FROM b_ai_requests WHERE settings_revision=?',settings.revision).first<Data>())?.n ?? 0);
  insist(used<settings.request_limit,'The approved AI request budget is exhausted; the principal must review and approve a new budget',409);
  const [live, release] = guard(db, 'EXISTS(SELECT 1 FROM b_ai_settings s WHERE id=1 AND enabled=1 AND revision=? AND request_limit>(SELECT COUNT(*) FROM b_ai_requests r WHERE r.settings_revision=s.revision))', settings.revision);
  const [scope, scopeDone] = aiScope(db,actor,jobId,source.kind,source.id);
  await atomic(db, actor, [live, scope, stmt(db, `INSERT INTO b_ai_requests VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    requestId, jobId, source.clientId, purpose, source.kind, source.id, JSON.stringify(source.ids), await digest(masked),
    aiProvider(), aiModel(env), inputBytes, actor.email, at, settings.attestation_ref, settings.revision, 'requested'),
    audit(db, actor, 'ai.request', requestId, JSON.stringify({ sourceIds: source.ids, provider: aiProvider(), model: aiModel(env), bytes: inputBytes, at })), scopeDone, release]);
  try {
    const result = await runAiProvider({ ...env, AI_MODEL: aiModel(env), AI_ENABLED: 'true' }, purpose as 'summary'|'document'|'notice', masked);
    actor = await accessActor(db, actor);
    const current = await aiSource(db, actor, jobId, source.kind, source.id);
    insist(current.hash === source.hash, 'The source changed during processing. The output was discarded.', 409);
    const [enabled, done] = guard(db, 'EXISTS(SELECT 1 FROM b_ai_settings WHERE id=1 AND enabled=1 AND revision=?)', settings.revision);
    const [readable,readDone] = aiScope(db,actor,jobId,source.kind,source.id);
    await atomic(db, actor, [enabled, readable, stmt(db, "UPDATE b_ai_requests SET status='completed' WHERE id=?", requestId), readDone, done]);
    return { requestId, purpose, output: result.output, source, provider: result.provider, model: result.model };
  } catch (error) {
    await stmt(db, "UPDATE b_ai_requests SET status='failed' WHERE id=?", requestId).run();
    throw error;
  }
}

export async function aiRequest(db: D1Database, actor: Actor, requestId: string) {
  human(actor);
  const r = await stmt(db, 'SELECT * FROM b_ai_requests WHERE id=?', requestId).first<Data>();
  insist(r, 'AI request not found', 404);
  if (r.purpose === 'notice') need(actor, 'owner', 'reviewer');
  const source = await aiSource(db, actor, r.job_id, r.source_kind, r.source_id);
  insist(await digest(maskAiText(source.text)) === r.input_hash, 'The source changed; process it again before using the draft', 409);
  return { r, source };
}
export async function saveAiDraft(db: D1Database, actor: Actor, requestId: string, body: Data) {
  const { r, source } = await aiRequest(db, actor, requestId);
  insist(r.status === 'completed' && r.requested_by === actor.email, 'Only the requester can save a completed request', 403);
  insist(body.output && typeof body.output === 'object' && !Array.isArray(body.output), 'Supply the draft you reviewed');
  const output = JSON.stringify(validateAiOutput(body.output, maskAiText(source.text)));
  insist(output.length <= 30_000, 'Draft is too long');
  const draftId = id();
  const [scope,done] = aiScope(db,actor,r.job_id,r.source_kind,r.source_id);
  await atomic(db, actor, [scope,stmt(db, 'INSERT INTO b_ai_drafts VALUES(?,?,?,?,?,?,?)', draftId, r.id, r.job_id, r.client_id, output, actor.email, now()),
    audit(db, actor, 'ai.draft_saved', draftId, r.id),done]);
  return readAiDraft(db, actor, draftId);
}
export async function readAiDraft(db: D1Database, actor: Actor, draftId: string): Promise<Data> {
  const d = await stmt(db, 'SELECT * FROM b_ai_drafts WHERE id=?', draftId).first<Data>();
  insist(d, 'AI draft not found', 404);
  const { r, source } = await aiRequest(db, actor, d.request_id);
  return { ...d, output: JSON.parse(d.output), purpose: r.purpose, source_id: r.source_id, source_kind: r.source_kind,
    source, provider: r.provider, model: r.model, decisions: await rows(db, 'SELECT * FROM b_ai_decisions WHERE draft_id=? ORDER BY decided_at', draftId) };
}
