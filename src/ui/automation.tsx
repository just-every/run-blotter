import { useEffect, useState } from 'react';
import { api, Empty, Field, Form, prose, Status, when, who, type Row, type Run, day } from './common';

const TRIGGERS: Record<string, string> = { tasks_complete: 'All tasks complete', status: 'Job reaches a status', file: 'File received', request_complete: 'Document requests complete', organizer_complete: 'Organizer complete', proposal: 'Preparation decided', due: 'At a recorded time' };
const ACTIONS: Record<string, string> = { status: 'Change status', reminder: 'Send a templated reminder', assign: 'Assign a person', request: 'Create a document request', rollforward: 'Roll work forward' };
const INITIAL: Row = { name: '', clientIds: [], triggerKind: 'tasks_complete', triggerStage: 'waiting', triggerSub: '', at: '', actionKind: 'status', actionStage: 'in_review', actionSub: '', templateId: '', role: 'preparer', email: '', label: '', dueDate: '', dueNote: '', budget: '1' };

function StatusFields({ model, stage, sub, change, prefix }: { model: Row; stage: string; sub: string; change: (stage: string, sub: string) => void; prefix: string }) {
  return <div className="row">
    <Field label={`${prefix} stage`} name={`${prefix}-stage`}><select required value={stage} onChange={e => change(e.target.value, '')}>{model.stages.map((s: Row) => <option key={s.key} value={s.key}>{s.label}</option>)}</select></Field>
    <Field label={`${prefix} sub-status (optional)`} name={`${prefix}-sub`}><select value={sub} onChange={e => change(stage, e.target.value)}><option value="">{prefix === 'Trigger' ? 'Any sub-status' : 'No sub-status'}</option>{model.subStatuses.filter((s: Row) => s.stage === stage).map((s: Row) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
  </div>;
}

function Definition({ definition, model, templates, state }: { definition: Row; model: Row; templates: Row[]; state: Row }) {
  const { trigger, action } = definition;
  const status = (v: Row) => [model.stages.find((s: Row) => s.key === v.stage)?.label ?? v.stage, model.subStatuses.find((s: Row) => s.id === v.subStatusId)?.name].filter(Boolean).join(' · ');
  return <>
    <p>Clients: {definition.clientIds.map((id: string) => state.clients.find((c: Row) => c.id === id)?.name ?? id).join(', ')}</p>
    <p>When: {TRIGGERS[trigger.kind]}{trigger.kind === 'status' && ` · ${status(trigger)}`}{trigger.at && <> · <time dateTime={trigger.at}>{when(trigger.at)}</time> <small className="muted">({trigger.at})</small></>}</p>
    <p>Then: {ACTIONS[action.kind]}{action.kind === 'status' && ` · ${status(action)}`}{action.templateId && ` · ${templates.find(t => t.id === action.templateId)?.name ?? action.templateId}`}{action.email && ` · ${action.role}: ${who(state.people, action.email)}`}{action.label && ` · ${action.label}`}{action.dueDate && ` · due ${day(action.dueDate)}`}{action.dueNote && ` · ${action.dueNote}`}</p>
  </>;
}

/** Principal-approved standing rules, reviewed against concrete jobs before saving. */
export function Automation({ state, run, open }: { state: Row; run: Run; open: (id: string) => void }) {
  const [data, setData] = useState<Row>(), [model, setModel] = useState<Row>(), [templates, setTemplates] = useState<Row[]>();
  const [draft, setDraft] = useState<Row>(INITIAL), [review, setReview] = useState<Row>(), [error, setError] = useState('');
  useEffect(() => {
    let current = true;
    Promise.all([api('/automation'), api('/work-types'), api('/messages/templates')]).then(([rules, statuses, messages]) => {
      if (current) { setData(rules); setModel(statuses); setTemplates(messages.templates); setError(''); }
    }).catch(e => { if (current) setError(e.message); });
    return () => { current = false; };
  }, [state]);
  if (state.actor.role !== 'owner') return null;
  const change = (values: Row) => { setDraft(d => ({ ...d, ...values })); setReview(undefined); };
  const mutate = (path: string, body: Row, message: string) => run(async () => { await api(path, body); setData(await api('/automation')); }, message);
  const body = () => ({
    name: draft.name, clientIds: draft.clientIds, budget: Number(draft.budget),
    trigger: { kind: draft.triggerKind, ...(draft.triggerKind === 'status' ? { stage: draft.triggerStage, ...(draft.triggerSub ? { subStatusId: draft.triggerSub } : {}) } : {}), ...(draft.triggerKind === 'due' ? { at: new Date(draft.at).toISOString() } : {}) },
    action: { kind: draft.actionKind,
      ...(draft.actionKind === 'status' ? { stage: draft.actionStage, ...(draft.actionSub ? { subStatusId: draft.actionSub } : {}) } : {}),
      ...(draft.actionKind === 'reminder' ? { templateId: draft.templateId } : {}),
      ...(draft.actionKind === 'assign' ? { role: draft.role, email: draft.email } : {}),
      ...(draft.actionKind === 'request' ? { label: draft.label } : {}),
      ...(draft.actionKind === 'rollforward' ? { dueDate: draft.dueDate, dueNote: draft.dueNote } : {}),
    },
  });
  return <section className="panel">
    <h2>Automation</h2>
    <p className="muted">Review the clients, jobs and lifetime attempt budget, save a draft, then approve it separately. Active rules act under your standing principal approval until you pause or revoke them. Normal job review gates still apply. Uncertain mail delivery is held for human reconciliation and is never automatically retried.</p>
    {error && <p className="error" role="alert">{error} <button className="quiet" onClick={() => run(async () => {
      const [rules, statuses, messages] = await Promise.all([api('/automation'), api('/work-types'), api('/messages/templates')]);
      setData(rules); setModel(statuses); setTemplates(messages.templates); setError('');
    }, 'Automation refreshed')}>Reload automation</button></p>}
    {!data || !model || !templates ? <p>Opening automation…</p> : <>
      {!data.rules.length && <Empty>No automation rules yet.</Empty>}
      {data.rules.map((r: Row) => <article className="record" key={r.id}>
        <div className="split"><strong>{r.name}</strong><Status value={r.status} /></div>
        <small className="muted">Version {r.version} · lifetime budget {r.budget} attempts · {r.used} used{r.approved_by && ` · approved by ${who(state.people, r.approved_by)} ${when(r.approved_at)}`}</small>
        <Definition definition={r.definition} model={model} templates={templates} state={state} />
        <div className="actions">
          {(r.status === 'draft' || r.status === 'paused') && <button onClick={() => mutate(`/automation/${r.id}/activate`, {}, 'Standing automation approval recorded')}>{r.status === 'paused' ? 'Approve and resume rule' : 'Approve and activate rule'}</button>}
          {r.status === 'active' && <button className="quiet" onClick={() => mutate(`/automation/${r.id}/pause`, {}, 'Automation paused')}>Pause rule</button>}
          {r.status !== 'revoked' && <button className="danger" onClick={() => mutate(`/automation/${r.id}/revoke`, {}, 'Automation revoked')}>Revoke rule</button>}
        </div>
      </article>)}
      <button className="quiet" onClick={() => mutate('/automation/run', {}, 'Active automation evaluated; review the recorded outcomes')}>Evaluate active rules now</button>
      <details><summary>New automation rule</summary>
        <p className="muted">For example, all tasks complete can move work to In review; a Waiting sub-status can send a chosen message template. Choose the clients explicitly. Previewing and saving a draft do not activate a rule.</p>
        <Form label="Preview rule" disabled={!draft.clientIds.length} submit={async () => run(async () => {
          if (!draft.clientIds.length) throw new Error('Choose at least one client');
          if (!Number.isSafeInteger(Number(draft.budget)) || Number(draft.budget) < 1) throw new Error('The lifetime attempt budget must be a positive whole number');
          if (draft.triggerKind === 'due' && (!/^\d{4}-\d{2}-\d{2}T.+(Z|[+-]\d{2}:\d{2})$/.test(draft.at) || Number.isNaN(new Date(draft.at).getTime()))) throw new Error('Enter a valid ISO 8601 time including Z or a timezone offset');
          const submitted = body(); setReview(undefined); setReview({ ...await api('/automation/preview', submitted), body: submitted });
        }, 'Automation preview ready; review it before saving')}>
          <Field label="Rule name" name="name"><input required value={draft.name} onChange={e => change({ name: e.target.value })} /></Field>
          <fieldset><legend>Clients this rule may act for (required)</legend>
            {!state.clients.length && <p className="muted">Add a client before creating a rule.</p>}
            {state.clients.map((c: Row) => <label key={c.id} className="check"><input type="checkbox" checked={draft.clientIds.includes(c.id)} onChange={e => change({ clientIds: e.target.checked ? [...draft.clientIds, c.id] : draft.clientIds.filter((id: string) => id !== c.id) })} />{c.name}</label>)}
          </fieldset>
          <Field label="When" name="trigger"><select value={draft.triggerKind} onChange={e => change({ triggerKind: e.target.value })}>{Object.entries(TRIGGERS).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></Field>
          {draft.triggerKind === 'status' && <StatusFields model={model} stage={draft.triggerStage} sub={draft.triggerSub} prefix="Trigger" change={(stage, sub) => change({ triggerStage: stage, triggerSub: sub })} />}
          {draft.triggerKind === 'due' && <Field label="Recorded time (ISO 8601)" name="at" hint="Include a timezone, for example 2026-11-01T09:00:00-05:00. Preview shows the exact instant."><input required value={draft.at} placeholder="2026-11-01T09:00:00-05:00" onChange={e => change({ at: e.target.value })} /></Field>}
          <Field label="Then" name="action"><select value={draft.actionKind} onChange={e => change({ actionKind: e.target.value })}>{Object.entries(ACTIONS).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></Field>
          {draft.actionKind === 'status' && <StatusFields model={model} stage={draft.actionStage} sub={draft.actionSub} prefix="Target" change={(stage, sub) => change({ actionStage: stage, actionSub: sub })} />}
          {draft.actionKind === 'reminder' && <Field label="Message template" name="templateId" hint="Create message templates under Clients & templates."><select required value={draft.templateId} onChange={e => change({ templateId: e.target.value })}><option value="">Choose a message template…</option>{templates.map(t => <option key={t.id} value={t.id}>{t.name} · {t.scope === 'firm' ? 'Firm' : 'Personal'} · version {t.version}</option>)}</select></Field>}
          {draft.actionKind === 'assign' && <div className="row">
            <Field label="Job role" name="role"><select value={draft.role} onChange={e => change({ role: e.target.value })}>{['preparer', 'reviewer', 'manager', 'partner'].map(role => <option key={role} value={role}>{role}</option>)}</select></Field>
            <Field label="Person" name="email"><select required value={draft.email} onChange={e => change({ email: e.target.value })}><option value="">Choose a person…</option>{state.people.map((p: Row) => <option key={p.email} value={p.email}>{who(state.people, p.email)}</option>)}</select></Field>
          </div>}
          {draft.actionKind === 'request' && <Field label="Document request" name="label"><input required value={draft.label} onChange={e => change({ label: e.target.value })} /></Field>}
          {draft.actionKind === 'rollforward' && <>
            <Field label="New job due date" name="dueDate"><input type="date" required value={draft.dueDate} onChange={e => change({ dueDate: e.target.value })} /></Field>
            <Field label="Where the due date comes from" name="dueNote"><input required value={draft.dueNote} onChange={e => change({ dueNote: e.target.value })} /></Field>
          </>}
          <Field label="Lifetime attempt budget" name="budget" hint="A positive whole number limiting this rule's attempts across all selected clients, for its lifetime."><input type="number" required min="1" step="1" value={draft.budget} onChange={e => change({ budget: e.target.value })} /></Field>
        </Form>
        {review && <section className="notice" aria-label="Automation preview">
          <h3>Review {review.body.name}</h3><p>{prose(review.description)}</p>
          <Definition definition={review.definition} model={model} templates={templates} state={state} />
          <p>Lifetime budget: {review.body.budget} attempts. These {review.jobs.length} jobs match now; later matching jobs for the selected clients may also be acted on while the rule is active.</p>
          {!review.jobs.length ? <p>No jobs match now.</p> : <ul className="list">{review.jobs.map((j: Row) => <li key={j.id}><button className="quiet text-action" onClick={() => open(j.id)}>{j.client} · {j.title}</button></li>)}</ul>}
          {review.previews?.map((p: Row) => <article className="record" key={p.jobId}><h4>Message for {state.jobs.find((j: Row) => j.id === p.jobId)?.title ?? p.jobId}</h4>{p.error ? <p className="error">{prose(p.error)}</p> : <><p>To: {p.to}</p><p>Subject: {prose(p.subject)}</p><p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{prose(p.body)}</p>{p.missing?.length > 0 && <p className="error">Unresolved: {p.missing.map((v: Row) => v.label).join(', ')}</p>}</>}</article>)}
          <button onClick={() => run(async () => { await api('/automation', { ...review.body, fingerprint: review.fingerprint }); setReview(undefined); setData(await api('/automation')); }, 'Draft saved; approve and activate it separately')}>Save draft</button>
        </section>}
      </details>
      <h3>Retained attempts</h3>
      {!data.attempts.length && <Empty>No automation attempts yet.</Empty>}
      {data.attempts.map((a: Row) => <article className="record" key={a.id}>
        <div className="split"><strong>{data.rules.find((r: Row) => r.id === a.rule_id)?.name ?? a.rule_id} · version {a.version}</strong><Status value={a.status} /></div>
        <small className="muted">{when(a.created_at)} · attempt {a.id}</small>
        <p><button className="quiet text-action" onClick={() => open(a.job_id)}>Open job {state.jobs.find((j: Row) => j.id === a.job_id)?.title ?? a.job_id}</button></p>
        {a.outcome && <p>Outcome: {prose(a.outcome)}</p>}{a.next_action && <p>Next action: {prose(a.next_action)}</p>}
        {a.status === 'held' && <details><summary>Reconcile uncertain delivery</summary>
          <p>Check whether the mail provider accepted this message before recording the result. Neither outcome retries or resends the message.</p>
          <Form label="Record reconciliation" submit={async values => mutate(`/automation/attempts/${a.id}/reconcile`, values, 'Reconciliation recorded; no retry or resend')}>
            <Field label="Verified provider outcome" name="outcome"><select name="outcome" required defaultValue=""><option value="" disabled>Choose verified outcome…</option><option value="accepted">Provider accepted the message</option><option value="not_accepted">Provider did not accept the message</option></select></Field>
            <Field label="Evidence and reason" name="reason" />
          </Form>
        </details>}
      </article>)}
    </>}
  </section>;
}
