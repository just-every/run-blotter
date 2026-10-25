import type { Bindings } from '../auth.server';
import { atomic, audit, human, id, insist, integer, need, now, stmt, text, type Actor, type Data } from './model';

export const aiModel = (env: Bindings) => env.AI_MODEL || 'gpt-5-nano';
export const aiProvider = () => 'openai';
export async function aiSettings(db: D1Database, actor: Actor, env: Bindings) {
  human(actor);
  const s = await stmt(db, 'SELECT * FROM b_ai_settings WHERE id=1').first<Data>();
  return { enabled: !!s?.enabled && s.provider === aiProvider() && s.model === aiModel(env),
    attestationRef: actor.role === 'owner' ? s?.attestation_ref ?? '' : '', provider: aiProvider(), model: aiModel(env),
    requestLimit:s?.request_limit ?? 3, reviewThreshold:s?.review_threshold ?? 0.9,
    used:s ? Number((await stmt(db,'SELECT COUNT(*) n FROM b_ai_requests WHERE settings_revision=?',s.revision).first<Data>())?.n ?? 0) : 0 };
}
export async function saveAiSettings(db: D1Database, actor: Actor, env: Bindings, body: Data) {
  human(actor); need(actor, 'owner');
  insist(typeof body.enabled === 'boolean', 'Choose whether AI assistance is enabled');
  const reference = text(body.attestationRef, 'Provider no-training and no-retention attestation reference', 1000);
  const requestLimit=integer(body.requestLimit ?? 3,'Maximum requests under this approval',1,1000);
  const threshold=body.reviewThreshold ?? 0.9;
  insist(typeof threshold==='number' && Number.isFinite(threshold) && threshold>=0 && threshold<=1,'Document confidence threshold must be between zero and one');
  await atomic(db, actor, [stmt(db, `INSERT INTO b_ai_settings VALUES(1,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET enabled=excluded.enabled,attestation_ref=excluded.attestation_ref,
    provider=excluded.provider,model=excluded.model,revision=excluded.revision,enabled_by=excluded.enabled_by,updated_at=excluded.updated_at,request_limit=excluded.request_limit,review_threshold=excluded.review_threshold`,
    body.enabled ? 1 : 0, reference, aiProvider(), aiModel(env), id(), actor.email, now(),requestLimit,threshold),
    audit(db, actor, 'ai.settings', 'firm', `${body.enabled?'Enabled with recorded provider attestation':'Disabled'}; request budget ${requestLimit}; document confidence threshold ${threshold}; person required for every proposal`)]);
  return aiSettings(db, actor, env);
}
