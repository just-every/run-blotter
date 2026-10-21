// Bulk scheduling and reassignment (WORK-004): preview every impacted job and
// conflict, then commit exactly that preview.
import { useEffect, useState } from 'react';
import { api, Empty, Field, Form, type Row, type Run, day } from './common';

const ACTION: Record<string, string> = { create: 'Will be created', exists: 'Already exists, kept', excluded: 'Excluded', conflict: 'Conflict', change: 'Will change', unchanged: 'No change' };

function Outcome({ plan, commit, run }: { plan: Row; commit: () => Promise<void>; run: Run }) {
  const blocked = plan.lines.some((l: Row) => l.action === 'conflict');
  return <>
    <table className="table"><thead><tr><th>Job</th><th>People and date</th><th>Outcome</th></tr></thead>
      <tbody>{plan.lines.map((l: Row) => <tr key={l.jobId ?? l.clientId}>
        <td data-label="Job">{l.client}{l.job && ` · ${l.job}`}</td>
        <td data-label="People">{l.to ? `${l.to.preparer} / ${l.to.reviewer} · due ${day(l.to.dueDate)}` : l.preparer ? `${l.preparer} (${l.preparerFrom}) / ${l.reviewer} (${l.reviewerFrom})` : ''}</td>
        <td data-label="Outcome">{ACTION[l.action]}{l.reasons.length > 0 && `: ${l.reasons.join('; ')}`}</td>
      </tr>)}</tbody></table>
    {blocked ? <p className="muted">Resolve each conflict with an override, or leave that item out, then preview again.</p>
      : <button onClick={() => run(commit, 'Bulk change committed')}>Commit this plan</button>}
  </>;
}

export function ScheduleBulk({ state, run, segment }: { state: Row; run: Run; segment?: Row[] }) {
  const [plan, setPlan] = useState<Row>(), [request, setRequest] = useState<Row>();
  useEffect(() => { setPlan(undefined); setRequest(undefined); }, [segment]);
  const people: Row[] = state.people;
  if (!state.clients.length || !state.templates.length) return <Empty>Add clients and a template first.</Empty>;
  // A filtered segment (CRM-002) narrows the table to its clients, already included.
  const shown: Row[] = segment ?? state.clients;
  const pick = (name: string, roles: string[], label?: string) => <select name={name} aria-label={label} defaultValue=""><option value="">Resolve (last period, then default)</option>{people.filter(p => roles.includes(p.role)).map(p => <option key={p.email} value={p.email}>{p.name}</option>)}</select>;
  return <>
    <Form key={`${segment ? 'segment' : 'all'}:${shown.map(c => c.id).join(',')}`} label="Preview" submit={async data => run(async () => {
      const clients = shown.filter((c: Row) => data['include:' + c.id]).map((c: Row) => ({ clientId: c.id, exclude: data['include:' + c.id] === 'exclude', preparerEmail: data['preparer:' + c.id], reviewerEmail: data['reviewer:' + c.id] }));
      const body = { templateId: data.templateId, periodStart: data.periodStart, dueDate: data.dueDate, dueNote: data.dueNote, preparerEmail: data.preparerEmail, reviewerEmail: data.reviewerEmail, clients };
      setRequest(body); setPlan(await api('/bulk/schedule/preview', body));
    })}>
      <div className="row">
        <Field label="Template" name="templateId"><select name="templateId" required>{state.templates.map((t: Row) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Field>
        <Field label="Period starts" name="periodStart" type="date" />
        <Field label="Due date (recorded, not computed)" name="dueDate" type="date" />
      </div>
      <Field label="Where the due date comes from" name="dueNote" />
      <div className="row">
        <Field label="Default preparer" name="preparerEmail">{pick('preparerEmail', ['owner', 'reviewer', 'preparer'])}</Field>
        <Field label="Default reviewer" name="reviewerEmail">{pick('reviewerEmail', ['owner', 'reviewer'])}</Field>
      </div>
      <table className="table"><thead><tr><th>Client</th><th>In this batch</th><th>Preparer</th><th>Reviewer</th></tr></thead>
        <tbody>{shown.map((c: Row) => <tr key={c.id}>
          <td data-label="Client">{c.name}</td>
          <td data-label="In this batch"><select name={'include:' + c.id} aria-label={`${c.name} in this batch`} defaultValue={segment ? 'include' : ''}><option value="">Not selected</option><option value="include">Include</option><option value="exclude">Exclude</option></select></td>
          <td data-label="Preparer">{pick('preparer:' + c.id, ['owner', 'reviewer', 'preparer'], `${c.name} preparer`)}</td>
          <td data-label="Reviewer">{pick('reviewer:' + c.id, ['owner', 'reviewer'], `${c.name} reviewer`)}</td>
        </tr>)}</tbody></table>
    </Form>
    {plan && <Outcome plan={plan} run={run} commit={async () => { await api('/bulk/schedule', { ...request, fingerprint: plan.fingerprint }); setPlan(undefined); }} />}
  </>;
}

export function ReassignBulk({ state, run }: { state: Row; run: Run }) {
  const [plan, setPlan] = useState<Row>(), [request, setRequest] = useState<Row>();
  const people: Row[] = state.people, open = state.jobs.filter((j: Row) => j.status !== 'signed_off');
  if (!open.length) return <Empty>No open jobs to change.</Empty>;
  const pick = (name: string, roles: string[]) => <select name={name} defaultValue=""><option value="">Keep</option>{people.filter(p => roles.includes(p.role)).map(p => <option key={p.email} value={p.email}>{p.name}</option>)}</select>;
  return <>
    <Form label="Preview" submit={async data => run(async () => {
      const body = { jobIds: open.filter((j: Row) => data['job:' + j.id]).map((j: Row) => j.id), preparerEmail: data.preparerEmail, reviewerEmail: data.reviewerEmail, dueDate: data.dueDate, dueNote: data.dueNote };
      setRequest(body); setPlan(await api('/bulk/reassign/preview', body));
    })}>
      <fieldset><legend>Jobs</legend>{open.map((j: Row) => <label key={j.id} className="check"><input type="checkbox" name={'job:' + j.id} /> {j.client_name} · {j.title} · {j.period_label} (due {day(j.due_date)})</label>)}</fieldset>
      <div className="row">
        <Field label="New preparer" name="preparerEmail">{pick('preparerEmail', ['owner', 'reviewer', 'preparer'])}</Field>
        <Field label="New reviewer" name="reviewerEmail">{pick('reviewerEmail', ['owner', 'reviewer'])}</Field>
      </div>
      <div className="row">
        <Field label="New due date (optional)" name="dueDate" type="date" required={false} />
        <Field label="Where the new due date comes from" name="dueNote" required={false} />
      </div>
    </Form>
    {plan && <Outcome plan={plan} run={run} commit={async () => { await api('/bulk/reassign', { ...request, fingerprint: plan.fingerprint }); setPlan(undefined); }} />}
  </>;
}
