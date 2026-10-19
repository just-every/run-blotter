// A client's engagement history and its unresolved items (CRM-003): search and
// filter the timeline by kind, and filter open items by their owner.
import { useEffect, useState } from 'react';
import { api, Empty, Field, Form, prose, when, who, type Row, type Run, day } from './common';

/** Loads the history only once opened. */
export function ClientHistoryDetails(props: { clientId: string; people: Row[]; run: Run; open: (id: string) => void }) {
  const [shown, setShown] = useState(false);
  return <details onToggle={e => setShown((e.target as HTMLDetailsElement).open)}><summary>History and unresolved items</summary>{shown && <ClientHistory {...props} />}</details>;
}

export function ClientHistory({ clientId, people, run, open }: { clientId: string; people: Row[]; run: Run; open: (id: string) => void }) {
  const [filter, setFilter] = useState<Row>({ q: '', kind: '', owner: '' }), [data, setData] = useState<Row>(), [tick, setTick] = useState(0);
  useEffect(() => { api(`/clients/${clientId}/history?${new URLSearchParams(filter)}`).then(setData).catch(e => run(async () => { throw e; })); }, [clientId, filter, tick]);
  if (!data) return null;
  const owners = [...new Set(data.unresolved.map((i: Row) => i.owner))] as string[];
  return <div className="stack">
    <h3>Unresolved</h3>
    <Field label="Owner" name="owner"><select name="owner" value={filter.owner} onChange={e => setFilter({ ...filter, owner: e.target.value })}><option value="">Everyone</option>{owners.map(o => <option key={o} value={o}>{o}</option>)}</select></Field>
    {!data.unresolved.length ? <Empty>Nothing is waiting on anyone.</Empty> : <ul className="list">{data.unresolved.map((i: Row) => <li key={i.kind + i.id}>
      <strong>{i.nextAction}</strong> · {who(people, i.owner)} · {day(i.due)}{i.jobId && <> · <button className="quiet text-action" onClick={() => open(i.jobId)}>{i.work}</button></>}
      <select aria-label={`Hand “${i.nextAction}” to`} value="" onChange={e => { const owner = e.target.value; if (owner) run(async () => { await api(`/clients/${clientId}/unresolved/owner`, { kind: i.kind, id: i.id, owner }); setTick(tick + 1); }, `Handed to ${owner}`); }}>
        <option value="">Hand to…</option>{people.filter(p => p.email !== i.owner).map(p => <option key={p.email} value={p.email}>{p.name}</option>)}</select></li>)}</ul>}
    <h3>History</h3>
    <Form label="Search history" submit={async form => setFilter({ ...filter, q: form.q, kind: form.kind })}>
      <div className="row"><Field label="Search" name="q" required={false} value={filter.q} />
        <Field label="Kind" name="kind"><select name="kind" defaultValue={filter.kind}><option value="">Everything</option>{data.kinds.map((k: string) => <option key={k} value={k}>{k}</option>)}</select></Field></div>
    </Form>
    {!data.history.length ? <Empty>No history matches.</Empty> : <ul className="list">{data.history.map((e: Row) => <li key={e.id}>
      <small className="muted">{when(e.at)} · {who(people, e.actor)}</small> {e.action.replaceAll('.', ' ').replaceAll('_', ' ')}{e.detail && ` · ${prose(e.detail)}`}
      {e.job_id && <> · <button className="quiet text-action" onClick={() => open(e.job_id)}>open job</button></>}</li>)}</ul>}
  </div>;
}
