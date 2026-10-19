import { useState } from 'react';
import { api, Field, Form, type Row, type Run } from './common';

/** Inputs for each firm-defined field and the tags, named field:<key> and tags. */
export function ProfileInputs({ fields }: { fields: Row[] }) {
  return <>
    {fields.map(f => <Field key={f.key} label={`${f.label}${f.required ? '' : ' (optional)'}`} name={'field:' + f.key} required={!!f.required}>
      {f.type === 'choice'
        ? <select name={'field:' + f.key} required={!!f.required} defaultValue=""><option value="">—</option>{JSON.parse(f.choices).map((c: string) => <option key={c}>{c}</option>)}</select>
        : <input name={'field:' + f.key} type={f.type === 'date' ? 'date' : 'text'} inputMode={f.type === 'number' ? 'decimal' : undefined} required={!!f.required} />}
    </Field>)}
    <Field label="Tags (optional, separated by commas)" name="tags" required={false} />
  </>;
}
export const profileBody = (data: Row) => ({
  fields: Object.fromEntries(Object.entries(data).filter(([k, v]) => k.startsWith('field:') && v !== '').map(([k, v]) => [k.slice(6), v])),
  tags: String(data.tags ?? ''),
});
export const describe = (client: Row, fields: Row[]) => {
  const values = JSON.parse(client.fields ?? '{}'), tags: string[] = JSON.parse(client.tags ?? '[]');
  return [...fields.filter(f => values[f.key]).map(f => `${f.label}: ${values[f.key]}`), ...tags.map(t => '#' + t)].join(' · ');
};

export function FieldsPanel({ state, run }: { state: Row; run: Run }) {
  return <section className="panel">
    <h2>Client fields</h2>
    {state.fields.length === 0 ? <p className="muted">No firm-defined fields yet.</p>
      : <ul className="list">{state.fields.map((f: Row) => <li key={f.key}><strong>{f.label}</strong> <small className="muted">{f.key} · {f.type}{f.type === 'choice' && `: ${JSON.parse(f.choices).join(', ')}`}{f.required ? ' · required' : ''}</small></li>)}</ul>}
    <details><summary>Add a field</summary>
      <Form label="Add field" submit={async (data, form) => run(async () => { await api('/clients/fields', { ...data, required: data.required === 'on' }); form.reset(); }, 'Field added')}>
        <div className="row"><Field label="Name" name="label" /><Field label="Key (lowercase, used in imports as field:key)" name="key" /></div>
        <Field label="Type" name="type"><select name="type"><option value="text">Text</option><option value="number">Number</option><option value="date">Date</option><option value="choice">Choice</option></select></Field>
        <Field label="Choices (for a choice field, separated by commas)" name="choices" required={false} />
        <label className="check"><input type="checkbox" name="required" /> Every new or changed client must have a value</label>
      </Form>
    </details>
  </section>;
}

export function GroupsPanel({ state, run }: { state: Row; run: Run }) {
  return <section className="panel">
    <h2>Client groups</h2>
    {state.groups.length === 0 ? <p className="muted">No groups yet.</p>
      : <ul className="list">{state.groups.map((g: Row) => <li key={g.id}><strong>{g.name}</strong> <small className="muted">{g.members.map((m: Row) => `${m.client} (${m.relationship})`).join(' · ')}</small></li>)}</ul>}
    <details><summary>Group related clients</summary>
      <Form label="Save group" submit={async (data, form) => run(async () => {
        const members = state.clients.filter((c: Row) => data['rel:' + c.id]).map((c: Row) => ({ clientId: c.id, relationship: data['rel:' + c.id] }));
        await api('/groups', { name: data.name, members }); form.reset();
      }, 'Group saved')}>
        <Field label="Group name" name="name" />
        <table className="table"><thead><tr><th>Client</th><th>Relationship</th></tr></thead>
          <tbody>{state.clients.map((c: Row) => <tr key={c.id}><td data-label="Client">{c.name}</td><td data-label="Relationship">
            <select name={'rel:' + c.id} aria-label={`${c.name} relationship`} defaultValue=""><option value="">Not in group</option><option value="parent">Parent</option><option value="subsidiary">Subsidiary</option><option value="household">Household</option><option value="member">Member</option></select>
          </td></tr>)}</tbody></table>
      </Form>
    </details>
  </section>;
}

/** Filter a segment, then schedule its work or change one field for it with a preview. */
export function SegmentPanel({ state, run, segment, setSegment }: { state: Row; run: Run; segment: Row[] | undefined; setSegment: (clients: Row[] | undefined) => void }) {
  const [plan, setPlan] = useState<Row>(), [request, setRequest] = useState<Row>();
  return <section className="panel wide">
    <h2>Segments</h2>
    <Form label="Filter clients" submit={async data => run(async () => { setPlan(undefined); setSegment(await api('/clients/segment?' + new URLSearchParams(data as Record<string, string>))); }, 'Segment filtered')}>
      <div className="row">
        <Field label="Group" name="groupId" required={false}><select name="groupId" defaultValue=""><option value="">Any</option>{state.groups.map((g: Row) => <option key={g.id} value={g.id}>{g.name}</option>)}</select></Field>
        <Field label="Tag" name="tag" required={false} />
        <Field label="Field" name="field" required={false}><select name="field" defaultValue=""><option value="">Any</option>{state.fields.map((f: Row) => <option key={f.key} value={f.key}>{f.label}</option>)}</select></Field>
        <Field label="Field value" name="value" required={false} />
      </div>
    </Form>
    {segment && <>
      <p>{segment.length} {segment.length === 1 ? 'client' : 'clients'} in this segment: {segment.map(c => c.name).join(', ')}. They are preselected under <strong>Schedule work in bulk</strong>. <button className="quiet" onClick={() => setSegment(undefined)}>Clear</button></p>
      {segment.length > 0 && state.fields.length > 0 && <details><summary>Change a field for this segment</summary>
        <Form label="Preview change" submit={async data => run(async () => {
          // A blank input leaves that client out of the change.
          const body = { key: data.key, lines: segment.filter(c => String(data['value:' + c.id] ?? '').trim()).map(c => ({ clientId: c.id, value: data['value:' + c.id] })) };
          setRequest(body); setPlan(await api('/clients/bulk-fields/preview', body));
        })}>
          <Field label="Field" name="key"><select name="key">{state.fields.map((f: Row) => <option key={f.key} value={f.key}>{f.label}</option>)}</select></Field>
          {segment.map(c => <Field key={c.id} label={`New value for ${c.name}`} name={'value:' + c.id} required={false} hint="Leave blank to keep this client's value" />)}
        </Form>
        {plan && <>
          <table className="table"><thead><tr><th>Client</th><th>Now</th><th>New</th><th>Outcome</th></tr></thead>
            <tbody>{plan.lines.map((l: Row) => <tr key={l.clientId}><td data-label="Client">{l.client}</td><td data-label="Now">{l.from || '—'}</td><td data-label="New">{l.to || '—'}</td><td data-label="Outcome">{l.action}{l.reason && `: ${l.reason}`}</td></tr>)}</tbody></table>
          <button onClick={() => run(async () => { await api('/clients/bulk-fields', { ...request, fingerprint: plan.fingerprint }); setPlan(undefined); setSegment(undefined); }, 'Changed the previewed clients only')}>Apply the changes shown</button>
        </>}
      </details>}
    </>}
  </section>;
}
