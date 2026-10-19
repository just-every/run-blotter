// Possible duplicate clients (CRM-004 slice): why each pair was proposed, the
// two records side by side, and recording that a pair is not a duplicate.
import { useEffect, useState } from 'react';
import { api, Empty, Field, Form, type Row, type Run } from './common';

function Compare({ a, b }: { a: string; b: string }) {
  const [data, setData] = useState<Row>();
  useEffect(() => { api(`/clients/compare?a=${a}&b=${b}`).then(setData); }, [a, b]);
  if (!data) return <p>Comparing…</p>;
  const counts = (l: Row) => `${l.jobs} jobs (${l.open_jobs} open) · ${l.threads} discussions · ${l.notices} notices · ${l.expenses} expenses · ${l.rules} recurring rules · ${l.groups} groups`;
  return <table className="table"><thead><tr><th>Field</th><th>{data.a.name}</th><th>{data.b.name}</th></tr></thead>
    <tbody>{data.fields.map((f: Row) => <tr key={f.key}><td data-label="Field">{f.label}{f.same ? '' : ' ≠'}</td><td data-label={data.a.name}>{String(f.a ?? '') || '—'}</td><td data-label={data.b.name}>{String(f.b ?? '') || '—'}</td></tr>)}
      <tr><td data-label="Field">Linked</td><td data-label={data.a.name}>{counts(data.a.linked)}</td><td data-label={data.b.name}>{counts(data.b.linked)}</td></tr></tbody></table>;
}

export function DuplicatesPanel({ run, tick }: { run: Run; tick: number }) {
  const [pairs, setPairs] = useState<Row[]>();
  useEffect(() => { api('/clients/duplicates').then(setPairs).catch(e => run(async () => { throw e; })); }, [tick]);
  if (!pairs) return null;
  return <section className="panel wide">
    <h2>Possible duplicate clients</h2>
    <p className="muted">Proposed from a shared contact email, tax id or name. Merging is not available yet; compare the records, or record that a pair is two different clients.</p>
    {!pairs.length ? <Empty>No likely duplicates.</Empty> : pairs.map(p => <details key={p.a.id + p.b.id} className="record">
      <summary>{p.a.name} · {p.b.name} <small className="muted">({p.reasons.join(', ')})</small></summary>
      <Compare a={p.a.id} b={p.b.id} />
      <Form label="Not a duplicate" submit={async data => run(() => api('/clients/duplicates/dismiss', { a: p.a.id, b: p.b.id, reason: data.reason }), 'Recorded as different clients')}>
        <Field label="Why these are different clients" name="reason" />
      </Form>
    </details>)}
  </section>;
}
