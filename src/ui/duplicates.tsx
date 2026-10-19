// Possible duplicate clients (CRM-004): why each pair was proposed, the two
// records side by side, merging with a choice for every differing field, recording
// that a pair is not a duplicate, and the merge history with undo.
import { useEffect, useState } from 'react';
import { api, Empty, Field, Form, when, type Row, type Run } from './common';

function Compare({ a, b, run }: { a: string; b: string; run: Run }) {
  const [data, setData] = useState<Row>();
  useEffect(() => { api(`/clients/compare?a=${a}&b=${b}`).then(setData); }, [a, b]);
  if (!data) return <p>Comparing…</p>;
  const counts = (l: Row) => `${l.jobs} jobs (${l.open_jobs} open) · ${l.threads} discussions · ${l.notices} notices · ${l.expenses} expenses · ${l.rules} recurring rules · ${l.rates} rate cards · ${l.groups} groups`;
  const choose = data.fields.filter((f: Row) => !f.same && f.key !== 'source');
  return <>
    <table className="table"><thead><tr><th>Field</th><th>{data.a.name}</th><th>{data.b.name}</th></tr></thead>
      <tbody>{data.fields.map((f: Row) => <tr key={f.key}><td data-label="Field">{f.label}{f.same ? '' : ' ≠'}</td><td data-label={data.a.name}>{String(f.a ?? '') || '—'}</td><td data-label={data.b.name}>{String(f.b ?? '') || '—'}</td></tr>)}
        <tr><td data-label="Field">Linked</td><td data-label={data.a.name}>{counts(data.a.linked)}</td><td data-label={data.b.name}>{counts(data.b.linked)}</td></tr></tbody></table>
    <Form label="Merge" submit={async d => {
      const survivor = d.survivor === 'b' ? data.b.id : data.a.id, merged = survivor === data.a.id ? data.b.id : data.a.id;
      const keep = Object.fromEntries(choose.map((f: Row) => [f.key, (d['keep:' + f.key] === 'b') === (survivor === data.b.id) ? 'survivor' : 'merged']));
      await run(() => api('/clients/merge', { survivor, merged, keep, ...(d.authority ? { authority: d.authority } : {}) }), 'Clients merged. Undo is available for 30 days while the survivor is unchanged.');
    }}>
      <Field label="Client that keeps its records and id" name="survivor"><select name="survivor"><option value="a">{data.a.name}</option><option value="b">{data.b.name}</option></select></Field>
      {choose.map((f: Row) => <Field key={f.key} label={`Keep ${f.label}`} name={'keep:' + f.key}>
        <select name={'keep:' + f.key}><option value="a">{String(f.a ?? '') || '(blank)'}</option><option value="b">{String(f.b ?? '') || '(blank)'}</option></select></Field>)}
      <Field label="Authority (principal only, when EINs or contact emails differ)" name="authority" required={false} hint="Why these are one client and the surviving contact is authorized for both" />
    </Form>
  </>;
}

function Merges({ run, tick }: { run: Run; tick: number }) {
  const [list, setList] = useState<Row[]>();
  useEffect(() => { api('/clients/merges').then(setList).catch(() => setList([])); }, [tick]);
  if (!list?.length) return null;
  const label: Record<string, string> = { available: 'Undo available', changed: 'Survivor changed since; undo closed', expired: 'Undo window passed', undone: 'Undone' };
  return <><h3>Merged clients</h3><ul className="list">{list.map(m => <li key={m.id}>
    {m.merged.name} → {m.survivor.name} <small className="muted">{when(m.mergedAt)} by {m.mergedBy} · moved {Object.entries(m.moved).map(([k, n]) => `${n} ${k}`).join(', ')}
      {m.sourceIds.length ? ` · source IDs ${m.sourceIds.map((s: Row) => s.source_id).join(', ')}` : ''}{m.authority ? ` · authority: ${m.authority}` : ''} · {label[m.undo]}{m.undo === 'available' ? ` until ${when(m.undoUntil)}` : ''}</small>
    {m.undo === 'available' && <button onClick={() => run(() => api(`/clients/merges/${m.id}/undo`, {}), 'Merge undone; both clients and their records are restored')}>Undo merge</button>}
  </li>)}</ul></>;
}

export function DuplicatesPanel({ run, tick }: { run: Run; tick: number }) {
  const [pairs, setPairs] = useState<Row[]>();
  useEffect(() => { api('/clients/duplicates').then(setPairs).catch(e => run(async () => { throw e; })); }, [tick]);
  if (!pairs) return null;
  return <section className="panel wide">
    <h2>Possible duplicate clients</h2>
    <p className="muted">Proposed from a shared contact email, EIN or name. Compare the records and merge them, or record that a pair is two different clients.</p>
    {!pairs.length ? <Empty>No likely duplicates.</Empty> : pairs.map(p => <details key={p.a.id + p.b.id} className="record">
      <summary>{p.a.name} · {p.b.name} <small className="muted">({p.reasons.join(', ')})</small></summary>
      <Compare a={p.a.id} b={p.b.id} run={run} />
      <Form label="Not a duplicate" submit={async data => run(() => api('/clients/duplicates/dismiss', { a: p.a.id, b: p.b.id, reason: data.reason }), 'Recorded as different clients')}>
        <Field label="Why these are different clients" name="reason" />
      </Form>
    </details>)}
    <Merges run={run} tick={tick} />
  </section>;
}
