import { useEffect, useState } from 'react';
import { api, Empty, Field, Form, today, type Row, type Run } from './common';

const monday = (day: string) => { const d = new Date(day + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10); };
const hours = (m: number) => `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}`;

/** One week's available hours against estimated remaining work and review demand (CAPACITY-001). */
export function Capacity({ state, run, tick, open }: { state: Row; run: Run; tick: number; open: (id: string) => void }) {
  const [filter, setFilter] = useState({ week: monday(today()), skill: '', service: '' }), [view, setView] = useState<Row>();
  const owner = state.actor.role === 'owner';
  useEffect(() => { api('/capacity?' + new URLSearchParams(filter)).then(setView).catch(e => run(async () => { throw e; })); }, [filter, tick]);
  const estimate = (line: Row) => <Form label="Adjust estimate" submit={async data => run(() => api(`/jobs/${line.jobId}/estimates`, line.ordinal ? { ordinal: line.ordinal, minutes: Number(data.minutes) } : { review: true, minutes: Number(data.minutes) }), 'Estimate updated')}>
    <Field label="Estimate in minutes" name="minutes" type="number" value={line.estimateMinutes ?? ''} />
  </Form>;
  return <div className="stack capacity-view">
    <section className="panel">
      <Form label="Show" submit={async data => setFilter({ week: monday(String(data.week)), skill: String(data.skill ?? ''), service: String(data.service ?? '') })}>
        <div className="row"><Field label="Week of" name="week" type="date" value={filter.week} /><Field label="Skill" name="skill" required={false} value={filter.skill} />
          <Field label="Service" name="service" required={false}><select name="service" defaultValue={filter.service}><option value="">Every work type</option>{state.statusModel.workTypes.map((w: Row) => <option key={w.id} value={w.name}>{w.name}</option>)}</select></Field></div>
      </Form>
      {!view ? <p>Opening capacity…</p> : <>
        <p className="muted">{view.weekStart} to {view.weekEnd}. Available hours are weekly hours less leave and commitments on weekdays. Demand is the estimates of open work due this week; actual time is shown beside it and never subtracted.</p>
        <p><strong>Available {hours(view.totals.availableMinutes)}</strong> · estimated demand {hours(view.totals.demandMinutes)} · actual this week {hours(view.totals.actualMinutes)}</p>
        <table className="table">
          <thead><tr><th>Person</th><th>Weekly</th><th>Leave</th><th>Commitments</th><th>Available</th><th>Estimated demand</th><th>Actual</th><th>Load</th></tr></thead>
          <tbody>{view.people.map((p: Row) => <tr key={p.email}>
            <td data-label="Person">{p.name}<small className="muted"> · {p.role}{p.skills.length > 0 && ` · ${p.skills.join(', ')}`}</small></td>
            <td data-label="Weekly">{hours(p.weeklyMinutes)}{!p.hoursSet && <small className="muted"> (default)</small>}</td>
            <td data-label="Leave">{hours(p.leaveMinutes)}</td><td data-label="Commitments">{hours(p.commitmentMinutes)}</td>
            <td data-label="Available">{hours(p.availableMinutes)}</td><td data-label="Estimated demand">{hours(p.demandMinutes)}</td><td data-label="Actual">{hours(p.actualMinutes)}</td>
            <td data-label="Load">{p.overloaded ? <strong>Over by {hours(p.overMinutes)}</strong> : 'Within capacity'}
              {(p.jobs.length > 0 || p.blocks.length > 0) && <details><summary>Jobs and time off</summary>
                <ul className="list">{p.blocks.map((b: Row) => <li key={b.id}>{b.kind}: {b.label} <small className="muted">{b.startsOn} to {b.endsOn} · {hours(b.minutes)} this week</small>
                  {owner && <button className="quiet" onClick={() => run(() => api(`/capacity/blocks/${b.id}/delete`, {}), 'Removed')}>Remove</button>}</li>)}
                  {p.jobs.map((l: Row) => <li key={l.jobId + l.label}><button className="quiet text-action" onClick={() => open(l.jobId)}>{l.work}</button> <small className="muted">{l.kind}: {l.label} · due {l.due} · estimate {hours(l.estimateMinutes)} · actual so far {hours(l.actualMinutes)}</small>{estimate(l)}</li>)}</ul>
              </details>}</td>
          </tr>)}</tbody>
        </table>
        <h3>Deadline conflicts</h3>
        {!view.conflicts.length ? <Empty>No conflicts this week.</Empty> : <ul className="list">{view.conflicts.map((c: Row) => <li key={c.jobId}><button className="quiet text-action" onClick={() => open(c.jobId)}>{c.work}</button> <small className="muted">due {c.due}</small><ul>{c.reasons.map((r: string) => <li key={r}>{r}</li>)}</ul></li>)}</ul>}
        <h3>Unscheduled work</h3>
        {!view.unscheduled.length ? <Empty>Every open item due this week has an estimate.</Empty> : <ul className="list">{view.unscheduled.map((u: Row) => <li key={u.jobId + u.label}><button className="quiet text-action" onClick={() => open(u.jobId)}>{u.work}</button> <small className="muted">{u.label} · {u.owner} · due {u.due} · {u.reason}</small>{estimate(u)}</li>)}</ul>}
        {view.pastDue.length > 0 && <><h3>Past due, not counted</h3><ul className="list">{view.pastDue.map((u: Row) => <li key={u.jobId + u.label}><button className="quiet text-action" onClick={() => open(u.jobId)}>{u.work}</button> <small className="muted">{u.label} · {u.owner} · due {u.due}</small></li>)}</ul></>}
      </>}
    </section>
    {owner && <section className="panel">
      <h2>Plan hours</h2>
      <Form label="Save hours" submit={async data => run(() => api('/capacity/people', { email: data.email, weeklyMinutes: Math.round(Number(data.weeklyHours) * 60), skills: String(data.skills ?? '').split(',').map(s => s.trim()).filter(Boolean) }), 'Hours saved')}>
        <div className="row"><Field label="Person (email)" name="email" type="email" /><Field label="Hours a week" name="weeklyHours" type="number" /><Field label="Skills (comma separated)" name="skills" required={false} /></div>
      </Form>
      <Form label="Schedule" submit={async (data, form) => run(async () => { await api('/capacity/blocks', { email: data.email, kind: data.kind, startsOn: data.startsOn, endsOn: data.endsOn || undefined, minutesPerDay: data.kind === 'leave' ? undefined : Number(data.minutesPerDay), label: data.label }); form.reset(); }, 'Scheduled')}>
        <div className="row"><Field label="Person (email)" name="email" type="email" />
          <Field label="Kind" name="kind"><select name="kind"><option value="leave">Leave (whole days)</option><option value="meeting">Client meeting</option><option value="internal">Internal commitment</option></select></Field>
          <Field label="Label" name="label" /></div>
        <div className="row"><Field label="From" name="startsOn" type="date" /><Field label="To (optional)" name="endsOn" type="date" required={false} /><Field label="Minutes each day (meetings and commitments)" name="minutesPerDay" type="number" required={false} /></div>
      </Form>
    </section>}
  </div>;
}
