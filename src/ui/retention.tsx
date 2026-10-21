// ERASURE-002 (owner only): retention periods per class with the warning below seven years,
// holds due for review, and the Ready to erase list. Nothing here expires or deletes by itself.
import { useEffect, useState } from 'react';
import { api, day, Empty, Field, Form, when, type Row, type Run } from './common';

function Warning({ warning }: { warning: Row }) {
  return <div className="notice" role="note"><p>{warning.statute}</p><p>IRS Publication 583 periods:</p><ul>{warning.publication583.map((p: string) => <li key={p}>{p}</li>)}</ul><p>{warning.notice}</p></div>;
}

function Periods({ periods, run }: { periods: Row[]; run: Run }) {
  const [shown, setShown] = useState<Row>();
  return <section aria-label="Retention periods">
    <h3>Retention periods</h3>
    <p className="muted">Each retained class has a period in whole years (default 7, minimum 1; IRS e-file authorizations at least 3). The clock starts from the dates the records themselves carry; changing a period recomputes every record not yet erased.</p>
    <ul className="list">{periods.map(p => <li key={p.class}>
      <strong>{p.label}</strong> · {p.years} years{p.isDefault ? ' (default)' : ` · set by ${p.setBy}: ${p.reason}`}
      <Form label={`Set ${p.label} period`} submit={async data => run(async () => setShown(await api('/retention/periods', { class: p.class, years: Number(data.years), reason: data.reason })), 'Retention period saved')}>
        <Field label={`${p.label}: years (at least ${p.minimum})`} name="years" type="number" value={p.years} />
        <Field label="Reason" name="reason" />
      </Form>
      {p.warning && <Warning warning={p.warning} />}
    </li>)}</ul>
    {shown?.warning && <Warning warning={shown.warning} />}
  </section>;
}

function Holds({ holds, run }: { holds: Row[]; run: Run }) {
  return <section aria-label="Holds due for review">
    <h3>Holds</h3>
    <p className="muted">A review date shows as due here; no reminder is sent. Release is yours alone.</p>
    {!holds.length ? <Empty>No holds are in place.</Empty> : <ul className="list">{holds.map(h => <li key={h.id}>
      {h.reviewDue ? <strong>Review due · </strong> : null}{h.client_name ?? 'Whole firm'} · {h.scope === 'class' ? `class ${h.class}` : `${h.scope}${h.target_id ? ` ${String(h.target_id).slice(0, 8)}` : ''}`} · {h.reason} · owner {h.owner} · review {day(h.review_date)}
      <details><summary>Release</summary><Form label={`Release hold ${String(h.id).slice(0, 8)}`} submit={async data => run(() => api(`/retention/${h.id}/release`, data), 'Hold released')}><Field label="Release reason" name="reason" /></Form></details>
    </li>)}</ul>}
  </section>;
}

function Ready({ ready, run }: { ready: Row; run: Run }) {
  return <section aria-label="Ready to erase">
    <h3>Ready to erase</h3>
    <p className="muted">Records past their retention date. Nothing is erased until you confirm; confirming removes the record's bytes and personal fields and keeps the record, its totals, revision, sign-off attribution and SHA-256.</p>
    {!ready.ready.length ? <Empty>Nothing is past its retention date.</Empty> : <ul className="list">{ready.ready.map((r: Row) => <li key={r.kind + r.id}>
      {r.client ?? 'Client'} · {r.label} · {r.class.replaceAll('_', ' ')} · clock {day(r.clock)} + {r.years} years = {day(r.expiry)}{r.retainedUntil && ` · retained until ${day(r.retainedUntil)}`}
      <ul>{r.effects.map((e: Row) => <li key={e.table}>{e.label}: {e.count}</li>)}</ul>
      <Form danger label={`Erase ${r.label}`} submit={async data => run(() => api('/retention/ready/confirm', { kind: r.kind, id: r.id, reason: data.reason }), 'Record erased')}><Field label="Reason" name="reason" /></Form>
    </li>)}</ul>}
    {ready.held.length > 0 && <><h4>Skipped: held</h4><ul className="list">{ready.held.map((r: Row) => <li key={r.kind + r.id}>{r.label} · held by {r.heldBy.map((m: Row) => `${m.id.slice(0, 8)} (${m.reason})`).join(', ')}</li>)}</ul></>}
  </section>;
}

export function Retention({ run, tick }: { run: Run; tick: number }) {
  const [periods, setPeriods] = useState<Row[]>(), [holds, setHolds] = useState<Row>(), [ready, setReady] = useState<Row>();
  useEffect(() => { Promise.all([api('/retention/periods'), api('/retention/holds'), api('/retention/ready')]).then(([p, h, r]) => { setPeriods(p); setHolds(h); setReady(r); }).catch(e => run(async () => { throw e; })); }, [tick]);
  return <section className="panel wide" aria-label="Retention">
    <h2>Retention and erasure</h2>
    <p className="muted">Only you set periods, place holds and confirm erasure. Nothing expires, is purged or is sent automatically{holds ? ` · as of ${when(holds.today)}` : ''}.</p>
    {periods && holds && ready && <div className="stack"><Periods periods={periods} run={run} /><Holds holds={holds.holds} run={run} /><Ready ready={ready} run={run} /></div>}
  </section>;
}
