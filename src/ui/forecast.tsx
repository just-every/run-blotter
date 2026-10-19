import { PipelineForecastInputs } from './pipeline-forecast';
import { useEffect, useState } from 'react';
import { api, Empty, Field, Form, money, today, when, type Row, type Run } from './common';

const monday = (day: string) => { const d = new Date(day + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10); };
const hours = (m: number) => `${Math.round(m / 6) / 10} h`;
const range = (r: Row) => `${hours(r.low)}–${hours(r.high)} (likely ${hours(r.point)})`;

/** Forecast the coming weeks from recurring work and prior actuals and compare a hiring or service scenario (CAPACITY-003). */
export function Forecast({ state, run, tick }: { state: Row; run: Run; tick: number }) {
  const [prospects, setProspects] = useState<Row[]>([]), [forecastFrom, setForecastFrom] = useState(monday(today()));
  const [request, setRequest] = useState<Row>(), [view, setView] = useState<Row>(), [saved, setSaved] = useState<Row[]>([]);
  useEffect(() => { api('/pipeline').then(p => setProspects(p.prospects.filter((p: Row) => p.stage_kind === 'open'))).catch(e => run(async () => { throw e; })); api('/capacity/scenarios').then(setSaved).catch(() => setSaved([])); }, [tick]);
  const show = (body: Row) => run(async () => { setRequest(body); setView(await api('/capacity/forecast', body)); }, 'Forecast ready');
  const changesFrom = (data: Row) => ({
    hires: data.hireName ? [{ name: data.hireName, weeklyMinutes: Math.round(Number(data.hireHours) * 60), skills: String(data.hireSkills ?? '').split(',').map(s => s.trim()).filter(Boolean), startsOn: data.hireStart }] : [],
    lostClients: data.lostClient ? [data.lostClient] : [],
    services: data.workType ? [{ workType: data.workType, percent: Number(data.percent) }] : [],
    pipeline: prospects.flatMap(p => p.services.map((service: string, n: number) => ({ prospectId: p.id, service, workTypeId: data[`pipelineWork:${p.id}:${n}`], firstDueDate: data[`pipelineDue:${p.id}`] }))),
  });
  const compared = view?.compared;
  return <section className="panel">
    <h2>Forecast and hiring plans</h2>
    <Form label="Forecast" submit={async data => show({ from: monday(String(data.from)), weeks: Number(data.weeks), changes: changesFrom(data) })}>
      <div className="row"><Field label="From week of" name="from"><input name="from" type="date" required value={forecastFrom} onChange={e => setForecastFrom(e.target.value)} /></Field><Field label="Weeks" name="weeks" type="number" value={16} /></div>
      <PipelineForecastInputs state={state} prospects={prospects} from={monday(forecastFrom)} />
      <p className="muted">Scenario (optional): nothing here changes live work.</p>
      <div className="row"><Field label="Hypothetical hire" name="hireName" required={false} /><Field label="Hours a week" name="hireHours" type="number" required={false} />
        <Field label="Skills (comma separated)" name="hireSkills" required={false} /><Field label="Starts" name="hireStart" type="date" required={false} /></div>
      <div className="row">
        <Field label="Lost client" name="lostClient" required={false}><select name="lostClient" defaultValue=""><option value="">None</option>{(state.clients ?? []).map((c: Row) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        <Field label="Service change" name="workType" required={false}><select name="workType" defaultValue=""><option value="">None</option>{state.statusModel.workTypes.map((w: Row) => <option key={w.id} value={w.name}>{w.name}</option>)}</select></Field>
        <Field label="Percent of today’s time" name="percent" type="number" required={false} value={100} />
      </div>
    </Form>
    {saved.length > 0 && <details><summary>Saved scenarios</summary><ul className="list">{saved.map(s => <li key={s.id}>
      <button className="quiet text-action" onClick={() => show({ scenarioId: s.id })}>{s.name}</button> <small className="muted">{s.weeks} weeks from {s.from} · {s.createdBy} · {when(s.createdAt)}</small></li>)}</ul></details>}
    {view && <div className="stack">
      <p className="muted">{view.scenario ? `Saved scenario “${view.scenario.name}”: ` : ''}{view.from} to {view.to}. Demand is a range with its confidence; capacity is weekly hours less leave and commitments.</p>
      <table className="table">
        <thead><tr><th>Week</th><th>Demand</th><th>Capacity</th><th>Confidence</th>{compared && <><th>Scenario demand</th><th>Scenario capacity</th></>}</tr></thead>
        <tbody>{view.baseline.weeks.map((w: Row, n: number) => <tr key={w.weekStart}>
          <td data-label="Week">{w.weekStart}</td><td data-label="Demand">{range(w.demand)}{w.shortMinutes > 0 && <strong> · short up to {hours(w.shortMinutes)}</strong>}</td>
          <td data-label="Capacity">{hours(w.capacityMinutes)}</td>
          <td data-label="Confidence">{w.confidence.level}{w.confidence.reasons.length > 0 && <ul>{w.confidence.reasons.map((r: string) => <li key={r}><small>{r}</small></li>)}</ul>}</td>
          {compared && <><td data-label="Scenario demand">{range(compared.weeks[n].demand)}</td><td data-label="Scenario capacity">{hours(compared.weeks[n].capacityMinutes)}</td></>}
        </tr>)}</tbody>
      </table>
      <h3>By skill over the forecast</h3>
      {!view.baseline.skills.length ? <Empty>No skills or recurring work in these weeks.</Empty> : <table className="table">
        <thead><tr><th>Skill</th><th>Demand</th><th>Capacity</th>{compared && <><th>Scenario demand</th><th>Scenario capacity</th></>}</tr></thead>
        <tbody>{[...new Set([...view.baseline.skills, ...(compared?.skills ?? [])].map((s: Row) => s.skill))].map(skill => {
          const b = view.baseline.skills.find((s: Row) => s.skill === skill), c = compared?.skills.find((s: Row) => s.skill === skill);
          return <tr key={skill}><td data-label="Skill">{skill}</td><td data-label="Demand">{b ? range(b.demand) : '—'}</td><td data-label="Capacity">{b ? hours(b.capacityMinutes) : '—'}</td>
            {compared && <><td data-label="Scenario demand">{c ? range(c.demand) : '—'}</td><td data-label="Scenario capacity">{c ? hours(c.capacityMinutes) : '—'}</td></>}</tr>;
        })}</tbody>
      </table>}
      {compared?.removed.length > 0 && <p className="muted">Left out for the scenario: {compared.removed.map((r: Row) => `${r.client} · ${r.workType} ${r.periodLabel} (${r.reason})`).join('; ')}.</p>}
      <h3>Open pipeline assumptions</h3>
      <p className="muted">These requested services contribute possible workload to the baseline{compared ? ' and this scenario' : ''}, with the chosen first work targets and template cadence. Each remains an unweighted assumption at its current stage. Budgets supply hours; annual fees never do.</p>
      {!view.baseline.pipeline.length ? <Empty>No open prospects.</Empty> : <ul className="list">{view.baseline.pipeline.map((p: Row) => <li key={p.prospectId + '|' + p.service}>
        {p.prospect} · {p.service} · {p.stage} <small className="muted">{p.source} · {p.ownerEmail} · {p.estimatedAnnualFeeCents === null ? 'annual fee not estimated' : `${money(p.estimatedAnnualFeeCents, p.currency)} estimated annual fee for the whole prospect`} · {p.status === 'unestimated' ? 'not estimated; choose a work type with a budget or task estimates' : `${range(p)} per engagement · ${p.basis}`} · assumed first target {p.firstDueDate}</small>
      </li>)}</ul>}
      <details><summary>Where each estimate comes from</summary><ul className="list">{view.baseline.lines.map((l: Row) => <li key={l.ruleId + l.periodStart}>
        {l.client} · {l.workType} · {l.periodLabel} <small className="muted">due {l.due} · {range(l)} · {l.basis}{l.samples.length > 0 && `: ${l.samples.map((s: Row) => `${s.periodLabel} ${hours(s.actualMinutes)}`).join(', ')}`}</small></li>)}</ul></details>
      <details><summary>Assumptions</summary><ul className="list">{view.assumptions.map((a: string) => <li key={a}><small>{a}</small></li>)}</ul></details>
      {request && !request.scenarioId && compared && <Form label="Save scenario" submit={async data => run(() => api('/capacity/scenarios', { name: data.name, from: request.from, weeks: request.weeks, changes: request.changes }), 'Scenario saved')}>
        <Field label="Scenario name" name="name" />
      </Form>}
    </div>}
  </section>;
}
