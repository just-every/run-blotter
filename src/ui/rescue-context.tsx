import { useEffect, useState } from 'react';
import { api, day, Empty, Field, Form, type Row, type Run } from './common';

/** Principal-selected native context; inspection never prepares or executes a plan. */
export function RescueContext({ state, week, tick, run, open }: { state: Row; week: string; tick: number; run: Run; open: (id: string) => void }) {
  const [selection, setSelection] = useState<{ week: string; clients: string }>(), [view, setView] = useState<Row>();
  useEffect(() => {
    let current = true;
    setView(undefined);
    if (selection) api('/rescue-context?' + new URLSearchParams(selection)).then(value => { if (current) setView(value); })
      .catch(error => { if (current) run(async () => { throw error; }); });
    return () => { current = false; };
  }, [selection, tick]);
  const clientName = (id: string) => view?.clients.find((c: Row) => c.id === id)?.name;
  const personName = (address: string) => view?.people.find((p: Row) => p.email === address)?.name ?? 'Assigned person unavailable';
  return <section className="panel rescue-context">
    <h2>Deadline-risk context</h2>
    <p>Inspect native sources for selected clients and one week. Ledger context is unavailable. This view does not establish a feasible rescue plan or authorize changes.</p>
    <Form label="Inspect selected week" submit={async (_data, form) => {
      const values = new FormData(form), clients = values.getAll('client').map(String);
      if (!clients.length || clients.length > 10) return run(async () => { throw Error('Select between 1 and 10 clients'); });
      setSelection({ week: String(values.get('week')), clients: clients.join(',') });
    }}>
      <Field key={week} label="Risk week starting Monday" name="week" type="date" value={week} />
      <fieldset><legend>Select clients (up to 10)</legend>
        {state.clients.filter((c: Row) => c.lifecycle === 'active' && !c.merged_into && !c.erased_at).map((c: Row) =>
          <label className="check" key={c.id}><input type="checkbox" name="client" value={c.id} />{c.name}</label>)}
      </fieldset>
    </Form>
    {!view ? <p role="status">{selection ? 'Reading current context…' : 'Choose clients and a Monday to inspect.'}</p> : <div className="stack">
      <p><strong>{day(view.weekStart)} to {day(view.weekEnd)}</strong> · {view.clients.map((c: Row) => c.name).join(', ')}</p>
      <p>{view.coverage.ledger}. {view.coverage.estimates}</p>
      {!view.jobs.length && <Empty>No open work is due in or before this week, or has a sourced date in it.</Empty>}
      {view.jobs.map((j: Row) => <article key={j.id} className="stack">
        <h3><button className="quiet text-action" onClick={() => open(j.id)}>{clientName(j.clientId)} · {j.title} · {j.period}</button></h3>
        <dl>
          <dt>Working date</dt><dd>{day(j.dates.working)} · {j.dates.workingSource}</dd>
          <dt>Statutory date</dt><dd>{j.dates.statutory ? day(j.dates.statutory) : 'Sourced obligation unavailable'}</dd>
          <dt>Original business-day date</dt><dd>{j.dates.original ? day(j.dates.original) : 'Unavailable'} {j.dates.shiftNote}</dd>
          <dt>Internal target</dt><dd>{j.dates.internal ? day(j.dates.internal) : 'Unavailable'}</dd>
          <dt>Extension</dt><dd>{j.dates.extension?.due ? `${day(j.dates.extension.due)} · ${j.dates.extension.applies ? 'applies' : 'not recorded; does not change the working date'} · ${j.dates.extension.form}` : 'Unavailable'}</dd>
          {j.dates.relief && <><dt>Relief date</dt><dd>{day(j.dates.relief)}</dd></>}
          {j.dates.override && <><dt>Recorded working-date override</dt><dd>{day(j.dates.override)} · statutory date unchanged</dd></>}
        </dl>
        {j.obligation && <p><a href={j.obligation.href}>Obligation {j.obligation.id}</a> · <a href={j.obligation.ruleHref}>{j.obligation.ruleKey} version {j.obligation.ruleVersion}</a> · <a href={j.obligation.sourceUrl}>{j.obligation.sourceTitle}</a></p>}
        <h4>Risk reasons</h4>
        {j.risks.length ? <ul>{j.risks.map((r: Row, n: number) => <li key={n}>{r.reason}
          {r.taskOrdinal && ` · task ${r.taskOrdinal}`}{r.requestId && <> · <a href={r.requestHref}>Request {r.requestId}</a></>}
          {r.blockId && ` · leave record ${r.blockId}`}</li>)}</ul> : <p>No native risk reason recorded; completeness and feasibility remain unestablished.</p>}
        <details><summary>Requests and task dependencies</summary>
          <ul>{j.requests.map((r: Row) => <li key={r.id}><a href={r.href}>{r.label}</a> · {r.state} · request {r.id}</li>)}</ul>
          <ul>{j.tasks.map((t: Row) => <li key={t.ordinal}>Task {t.ordinal}: {t.label} · {t.state} · due {day(t.due)} · {t.owner ? personName(t.owner) : 'Unassigned'} · {t.estimateMinutes ? `${t.estimateMinutes} minutes` : 'Insufficient estimates'}
            {t.blockers.length > 0 && <ul>{t.blockers.map((reason: string) => <li key={reason}>{reason}</li>)}</ul>}
            {t.dependencies.job && <a href={t.dependencies.job.href}>Prerequisite job: {t.dependencies.job.title} · {t.dependencies.job.status}</a>}
          </li>)}</ul>
        </details>
      </article>)}
      <h3>Assigned people and weekly capacity facts</h3>
      <ul className="list">{view.people.map((p: Row) => <li key={p.email}><strong>{p.name}</strong> · skills {p.skills.join(', ') || 'not recorded'}
        <p>{p.weeklyMinutes} weekly minutes {p.hoursSet ? '(recorded)' : '(default)'} · leave {p.leaveMinutes} · commitments {p.commitmentMinutes} · available {p.availableMinutes} · demand {p.demandMinutes}</p>
        <p>{p.demandScope}. <a href={p.href}>Current capacity source</a></p>
        <ul>{p.blocks.map((b: Row) => <li key={b.id}>{b.kind}: {b.label} · {day(b.startsOn)} to {day(b.endsOn)} · {b.minutes} minutes · record {b.id}</li>)}</ul>
      </li>)}</ul>
      <p>{view.coverage.readiness} {view.coverage.plan}</p>
    </div>}
  </section>;
}
