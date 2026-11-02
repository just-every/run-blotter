import { clientAuthority } from './permissions';
// Agent preparations: an agent key prepares a roll-forward, a client reminder
// or a billing export; a person approves or declines, and the decision is
// recorded atomically with its effect. Adapted from run-satchel (MIT).
import type { Bindings } from '../auth.server';
import { runtimeBindings } from '../auth.server';
import { atomic, audit, preparationOwnerSql, date, guard, human, id, insist, job, need, now, optional, stmt, text, type Actor, type Data } from './model';
import { rollForward } from './jobs';
import { sendReminder } from './documents';
import { prepareExport, unbilled } from './billing';

const KINDS = ['rollforward', 'reminder', 'export'] as const;

export async function payloadFor(db: D1Database, actor: Actor, kind: string, body: Data) {
  if (kind === 'rollforward') {
    const j = await job(db, actor, text(body.jobId, 'Job'));
    return { jobId: j.id, dueDate: date(body.dueDate, 'Due date'), dueNote: text(body.dueNote, 'Where the due date comes from', 300), summary: `Roll ${j.title} (${j.period_label}) forward, due ${body.dueDate}` };
  }
  if (kind === 'reminder') {
    const j = await job(db, actor, text(body.jobId, 'Job'));
    insist(j.status === 'open', 'Reminders are only for open jobs', 409);
    return { jobId: j.id, message: optional(body.message, 'Message', 1000), summary: `Remind the client about ${j.title} (${j.period_label})` };
  }
  need(actor, 'owner', 'reviewer');
  insist(Array.isArray(body.sourceKeys) && body.sourceKeys.length > 0, 'Choose billable items (sourceKeys from the agent context)');
  return { title: text(body.title, 'Export title', 120), sourceKeys: body.sourceKeys.map(String), summary: `Prepare billing export "${body.title}" with ${body.sourceKeys.length} items` };
}

export async function propose(db: D1Database, actor: Actor, kind: string, body: Data) {
  insist((KINDS as readonly string[]).includes(kind), 'Unknown preparation command. Use prepare-rollforward, prepare-reminder or prepare-export.', 404);
  if (kind !== 'reminder') need(actor, 'owner', 'reviewer');
  if(actor.agentKeyId && await stmt(db,'SELECT 1 FROM b_agent_rules WHERE key_id=?',actor.agentKeyId).first()) {
    insist(false,'Use the supervised event runner for this key; direct preparations cannot bypass its plan and service budgets',403);
  }
  const payload = await payloadFor(db, actor, kind, body), proposalId = id();
  await atomic(db, actor, [
    stmt(db, 'INSERT INTO b_proposals(id,kind,payload,for_email,agent_label,created_at,door_sponsor_id) VALUES(?,?,?,?,?,?,?)', proposalId, kind, JSON.stringify(payload), actor.email, actor.label ?? 'Prepared by a person', now(), actor.doorAgent?actor.id:null),
    audit(db, actor, 'proposal.prepared', proposalId, kind),
  ]);
  return { id: proposalId, kind, status: 'pending', payload };
}

export async function decideProposal(env: Bindings, actor: Actor, proposalId: string, body: Data) {
  human(actor);
  const db = runtimeBindings(env).DB;
  const p = await stmt(db, `SELECT * FROM b_proposals WHERE id=? AND ${preparationOwnerSql()}`, proposalId, actor.id, actor.email).first<Data>();
  insist(p, 'Proposal not found', 404);
  insist(p.status === 'pending', 'This proposal was already decided', 409);
  const payload = JSON.parse(p.payload);
  if (body.decision === 'decline') {
    const reason = text(body.reason, 'Reason', 500);
    const [check, release] = guard(db, "EXISTS(SELECT 1 FROM b_proposals WHERE id=? AND status='pending')", proposalId);
    await atomic(db, actor, [check,
      stmt(db, "UPDATE b_proposals SET status='declined',decided_by=?,decided_at=?,decision_note=? WHERE id=? AND status='pending'", actor.email, now(), reason, proposalId),
      release, audit(db, actor, 'proposal.declined', proposalId, reason)]);
    return { status: 'declined' };
  }
  insist(body.decision === 'approve', 'Choose approve or decline');
  // The effect and the approval record commit in one batch (see atomic());
  // a reminder's mail is sent after that batch commits.
  const approving: Actor = { ...actor, approval: { id: proposalId, resultId: id() } };
  if (p.kind === 'rollforward') return { status: 'approved', result: await rollForward(env, approving, payload.jobId, { dueDate: body.dueDate ?? payload.dueDate, dueNote: body.dueNote ?? payload.dueNote }) };
  if (p.kind === 'reminder') return { status: 'approved', result: await sendReminder(env, approving, payload.jobId, payload) };
  return { status: 'approved', result: await prepareExport(db, approving, payload) };
}

export async function agentContext(db: D1Database, actor: Actor) {
  const limited=actor.agentKeyId && await stmt(db,'SELECT 1 FROM b_agent_rules WHERE key_id=?',actor.agentKeyId).first();
  const visible = `((?='owner' OR ?='reviewer' OR j.preparer_email=?) AND ${clientAuthority(actor,'j.client_id')} ${limited?`AND j.client_id IN (SELECT client_id FROM b_agent_rules WHERE key_id='${String(actor.agentKeyId).replaceAll("'","''")}' AND status='active')`:''})`, params = [actor.role, actor.role, actor.email];
  // ERASURE-002 names what a key read as an outside copy: the clients in the jobs it was shown.
  await audit(db, actor, 'agent.read', 'agent-context', JSON.stringify((await db.prepare(`SELECT DISTINCT j.client_id FROM b_jobs j WHERE ${visible}`).bind(...params).all<Data>()).results.map(r => r.client_id))).run();
  return {
    jobs: (await db.prepare(`SELECT j.id,j.title,j.period_start,j.period_label,j.due_date,j.status,c.name client,c.contact_email IS NOT '' has_contact,
        (SELECT json_group_array(label) FROM b_requests r WHERE r.job_id=j.id AND r.status='requested') outstanding,
        (SELECT id FROM b_jobs n WHERE n.rolled_from=j.id) next_job_id
      FROM b_jobs j JOIN b_clients c ON c.id=j.client_id WHERE ${visible} ORDER BY j.due_date`).bind(...params).all<Data>()).results
      .map(j => ({ ...j, outstanding: JSON.parse(j.outstanding) })),
    unbilled: actor.role === 'preparer' || actor.accessScoped || limited ? [] : await unbilled(db),
    commands: limited ? [] : [...(actor.role === 'owner' ? ['POST /api/blotter/agent/learning/evidence', 'POST /api/blotter/agent/prepare-learning'] : []), 'POST /api/blotter/agent/prepare-rollforward', 'POST /api/blotter/agent/prepare-reminder', 'POST /api/blotter/agent/prepare-export'],
  };
}

// Revenue drafts have a separate derived record; all decisions remain native human actions.
export { prepareRevenue, decideRevenue } from './revenue-proposals';
