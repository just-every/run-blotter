import { useEffect, useState } from 'react';
import { Security } from './security';
import { Blotter, api, aud, Empty, Field, Form, SOURCE, today, when, type Row, type Run } from './common';

export function Team({ state, run, tick }: { state: Row; run: Run; tick: number }) {
  const [team, setTeam] = useState<Row>(), [key, setKey] = useState<Row>(), [archive, setArchive] = useState(''), [journal, setJournal] = useState('');
  const owner = state.actor.role === 'owner';
  useEffect(() => { api('/team').then(setTeam).catch(e => run(async () => { throw e; })); }, [tick]);
  if (!team) return <p>Opening team…</p>;
  const ownRate = team.ownRateCents;
  return <div className="grid">
    {owner && <Blotter className="wide"><section className="panel">
      <h2>People and rates</h2>
      <table className="table"><thead><tr><th>Name</th><th>Role</th><th>Hourly rate</th><th>Status</th></tr></thead>
        <tbody>
          <tr><td data-label="Name">{state.actor.name} (you)</td><td data-label="Role">principal</td><td data-label="Rate">{ownRate === null ? 'not set' : aud(ownRate)}</td><td data-label="Status">active</td></tr>
          {team.members.map((m: Row) => <tr key={m.email}><td data-label="Name">{m.name}<br /><small className="muted">{m.email}</small></td><td data-label="Role">{m.role}</td><td data-label="Rate">{m.rate_cents === null ? 'not set' : aud(m.rate_cents)}</td><td data-label="Status">{m.active ? 'active' : 'deactivated'}</td></tr>)}
        </tbody></table>
      <details><summary>Add or change a person</summary>
        <Form label="Save person" submit={async (data, form) => run(async () => { await api('/team', { ...data, active: data.active !== 'false' }); form.reset(); }, 'Person saved')}>
          <Field label="Email" name="email" type="email" />
          <Field label="Name" name="name" />
          <Field label="Role" name="role"><select name="role"><option value="preparer">Preparer</option><option value="reviewer">Reviewer</option></select></Field>
          <Field label="Access" name="active"><select name="active"><option value="true">Active</option><option value="false">Deactivated (removes access now)</option></select></Field>
        </Form>
      </details>
      <details><summary>Send an invitation</summary>
        <Form label="Send invitation" submit={async data => run(() => api('/team/invite', data), 'Invitation sent')}>
          <Field label="Email of a saved person" name="email" type="email" />
        </Form>
      </details>
      <h3>Rate cards</h3>
      <p className="muted">Time uses the first rate in force on its date: client and service, then client, then service, then staff member, then role. Recorded time keeps its rate.</p>
      {!team.rates.length ? <Empty>No rate cards yet.</Empty> : <table className="table"><thead><tr><th>Applies to</th><th>Hourly rate</th><th>From</th></tr></thead>
        <tbody>{team.rates.map((r: Row) => <tr key={r.id}><td data-label="Applies to">{SOURCE[r.scope]}: {[r.client_name, r.template_name, r.person_email, r.role].filter(Boolean).join(' · ')}</td><td data-label="Rate">{aud(r.rate_cents)}</td><td data-label="From">{r.effective_from}</td></tr>)}</tbody></table>}
      <details><summary>Set an hourly rate</summary>
        <Form label="Set rate" submit={async data => run(() => api('/team/rates', { ...data, rateCents: Number(data.rateCents) }), 'Rate saved; time from its date uses it')}>
          <Field label="Applies to" name="scope"><select name="scope"><option value="staff">Staff member</option><option value="role">Role</option><option value="service">Service</option><option value="client">Client</option><option value="client_service">Client and service</option></select></Field>
          <Field label="Person (staff member rates)" name="email"><select name="email"><option value={state.actor.email}>{state.actor.name} (you)</option>{team.members.map((m: Row) => <option key={m.email} value={m.email}>{m.name}</option>)}</select></Field>
          <Field label="Role (role rates)" name="role"><select name="role"><option value="preparer">Preparer</option><option value="reviewer">Reviewer</option><option value="owner">Principal</option></select></Field>
          <Field label="Service (service rates)" name="templateId"><select name="templateId">{state.templates.map((t: Row) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Field>
          <Field label="Client (client rates)" name="clientId"><select name="clientId">{state.clients.map((c: Row) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
          <Field label="Hourly rate in cents, ex GST (15000 = $150.00)" name="rateCents" type="number" />
          <Field label="Effective from" name="effectiveFrom" type="date" value={today()} />
        </Form>
      </details>
    </section></Blotter>}
    {!owner && <Blotter className="wide"><section className="panel"><h2>Your rate</h2><p>{ownRate === null ? 'The principal has not set your hourly rate yet.' : `${aud(ownRate)} per hour, unless a client or service rate applies`}</p></section></Blotter>}
    {state.actor.role !== 'preparer' && <section className="panel">
      <h2>Agent keys</h2>
      <p className="muted">A key lets an agent read context and prepare work for your approval. It cannot approve anything.</p>
      {key && <div className="notice"><p>Copy this key now; it is not shown again.</p><input readOnly value={key.key} aria-label="Agent key" onFocus={e => e.currentTarget.select()} /></div>}
      {team.keys.map((k: Row) => <p key={k.id}>{k.label} · {when(k.created_at)} {k.revoked ? '(revoked)' : <button className="quiet" onClick={() => run(() => api(`/keys/${k.id}/revoke`, {}), 'Key revoked')}>Revoke</button>}</p>)}
      <Form label="Create agent key" submit={async data => run(async () => setKey(await api('/keys', data)), 'Agent key created')}><Field label="Agent name" name="label" value="Practice assistant" /></Form>
    </section>}
    {owner && <section className="panel">
      <h2>Backup and restore</h2>
      <p className="muted">The archive holds clients, jobs, documents, time, exports, imports and history. Sign-in accounts, sessions, agent keys and client upload links are not included.</p>
      <p><a className="button" href="/api/blotter/backup">Download practice archive</a></p>
      <details><summary>Restore into this empty installation</summary>
        <label>Archive file<input type="file" accept=".rer" onChange={e => e.target.files?.[0]?.text().then(setArchive)} /></label>
        <label>Newer archive with the erasure journal (only if restoring an older archive)<input type="file" accept=".rer" onChange={e => e.target.files?.[0]?.text().then(setJournal)} /></label>
        <Form danger label="Restore" submit={async data => run(() => api('/restore', { archive, journal: journal || undefined, confirm: data.confirm }), 'Archive restored')}><Field label="Type RESTORE" name="confirm" /></Form>
      </details>
    </section>}
    {owner && <section className="panel">
      <h2>Erase a client file</h2>
      <p className="muted">Removes the file's bytes permanently. Its name, hash and history remain, and older archives can no longer be restored without this erasure's journal.</p>
      <EraseFile state={state} run={run} />
    </section>}
    {owner && <section className="panel wide">
      <h2>Audit log</h2>
      {!team.audit.length ? <Empty>No activity yet.</Empty> : <ul className="list">{team.audit.map((a: Row) => <li key={a.id}><small className="muted">{when(a.at)}</small> {a.actor} · {a.action} {a.detail && `· ${a.detail}`}</li>)}</ul>}
    </section>}
    <Security actor={state.actor} run={run} tick={tick} />
  </div>;
}

function EraseFile({ state, run }: { state: Row; run: Run }) {
  const [jobId, setJobId] = useState(''), [files, setFiles] = useState<Row[]>([]);
  useEffect(() => { if (jobId) api('/jobs/' + jobId).then(d => setFiles(d.requests.flatMap((r: Row) => r.files).filter((f: Row) => !f.erased_at))); else setFiles([]); }, [jobId]);
  return <>
    <Field label="Job" name="job"><select value={jobId} onChange={e => setJobId(e.target.value)}><option value="">Choose a job</option>{state.jobs.map((j: Row) => <option key={j.id} value={j.id}>{j.client_name} · {j.title} · {j.period_label}</option>)}</select></Field>
    {jobId && (!files.length ? <Empty>No stored files on this job.</Empty> :
      <Form danger label="Erase file" submit={async data => run(async () => { await api(`/files/${data.fileId}/erase`, { confirm: data.confirm, reason: data.reason }); setJobId(''); }, 'File bytes erased')}>
        <Field label="File" name="fileId"><select name="fileId">{files.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select></Field>
        <Field label="Type the file name to confirm" name="confirm" />
        <Field label="Reason" name="reason" />
      </Form>)}
  </>;
}
