// Sourced deadlines (DUE-001, DUE-003): the principal's rule catalog, firm rules and
// source revisions; a client's obligations; a job's calculated dates.
import { useEffect, useState } from 'react';
import { api, day, Empty, Field, Form, when, type Row, type Run } from './common';

const kindLabel = (r: Row) => r.jurisdiction === 'Firm' ? 'Firm-defined (not an agency deadline)' : r.jurisdiction === 'US' ? 'Federal' : r.jurisdiction;

/** The principal approves catalog rules, defines firm rules and approves imported revisions after previewing affected jobs. */
export function DeadlineRules({ run, tick }: { run: Run; tick: number }) {
  const [state, setState] = useState<Row>(), [preview, setPreview] = useState<Row>();
  useEffect(() => { api('/deadlines').then(setState).catch(e => run(async () => { throw e; })); }, [tick]);
  if (!state) return <p>Opening deadline rules…</p>;
  return <section className="panel wide">
    <h2>Deadline rules</h2>
    <p className="muted">Sourced rules calculate due dates for client obligations once approved. A weekend or legal holiday moves a date to the next business day. Dates are calculated, not filed: filing needs the agency's acknowledgment.</p>
    <table className="table"><thead><tr><th>Form</th><th>Jurisdiction</th><th>Source</th><th>Status</th></tr></thead>
      <tbody>{[...state.catalog, ...state.firmRules].map((r: Row) => <tr key={r.key}>
        <td data-label="Form">{r.form}<br /><small className="muted">{r.title} · {r.frequency}</small></td>
        <td data-label="Jurisdiction">{kindLabel(r)}</td>
        <td data-label="Source">{r.source.url ? <a href={r.source.url} rel="noreferrer" target="_blank">{r.source.title}</a> : r.source.title} <small className="muted">v{r.version}</small></td>
        <td data-label="Status">{r.approvedBy ? <small>approved by {r.approvedBy} {when(r.approvedAt)}</small>
          : <button className="quiet" onClick={() => run(() => api(`/deadlines/rules/${r.key}/approve`, {}), `${r.form} approved for the firm`)}>Approve</button>}</td>
      </tr>)}</tbody></table>
    <details><summary>Define a firm deadline</summary>
      <Form label="Save firm rule" submit={async (data, form) => run(async () => { await api('/deadlines/firm-rules', data); form.reset(); }, 'Firm rule saved')}>
        <div className="row"><Field label="Name" name="name" /><Field label="Frequency" name="frequency"><select name="frequency"><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="annual">Annual</option></select></Field></div>
        <div className="row"><Field label="Rule" name="type"><select name="type"><option value="days-after-period-end">Days after period end</option><option value="fixed">Fixed date</option><option value="nth-weekday">Nth weekday of a month</option></select></Field>
          <Field label="Days after period end" name="days" type="number" required={false} /><Field label="Month (fixed)" name="month" type="number" required={false} /><Field label="Day (fixed)" name="day" type="number" required={false} /></div>
        <div className="row"><Field label="Which weekday (1-5, -1 last)" name="n" type="number" required={false} /><Field label="Weekday (0 Sunday-6 Saturday)" name="weekday" type="number" required={false} /><Field label="Months after period end" name="months" type="number" required={false} /></div>
        <Field label="Source or label" name="source" required={false} hint="Shown as firm-defined, never as an agency deadline" />
      </Form>
    </details>
    <details><summary>Import a source revision</summary>
      <Form label="Preview affected jobs" submit={async data => run(async () => { const revision = JSON.parse(String(data.revision)); setPreview({ revision, ...await api('/deadlines/revisions/preview', { revision }) }); })}>
        <Field label="Revision (JSON with version, effective date, source and changed rules or relief)" name="revision"><textarea name="revision" rows={6} /></Field>
      </Form>
      {preview && <div className="stack">
        <p>Revision {preview.version}, effective {day(preview.effective)}, from <a href={preview.source.url} rel="noreferrer" target="_blank">{preview.source.title}</a>: {preview.rules.length} rules, {preview.relief.length} relief windows.</p>
        {preview.lines.length ? <ul>{preview.lines.map((l: Row) => <li key={l.jobId}>{l.client} · {l.job}: due {day(l.external[0])} → <strong>{day(l.external[1])}</strong>{l.relief && ` (${l.relief})`}{l.keepsWorkingDate && ' · keeps its hand-set working date'} <small className="muted">v{l.fromVersion} → v{l.toVersion}</small></li>)}</ul> : <Empty>No open job changes.</Empty>}
        <button onClick={() => run(async () => { await api('/deadlines/revisions', { revision: preview.revision, fingerprint: preview.fingerprint }); setPreview(undefined); }, 'Revision approved and jobs recalculated')}>Approve revision</button>
      </div>}
      {state.revisions.length > 0 && <ul>{state.revisions.map((r: Row) => <li key={r.id}>{r.version} effective {day(r.effective)} · {r.affected_jobs} jobs · approved by {r.approved_by} {when(r.approved_at)}</li>)}</ul>}
    </details>
  </section>;
}

/** A client's obligations: approved rules with their state, fiscal year end and internal lead days. */
export function ClientObligations({ clientId, lead, run, tick }: { clientId: string; lead: boolean; run: Run; tick: number }) {
  const [list, setList] = useState<Row>(), [rules, setRules] = useState<Row[]>([]);
  useEffect(() => { api(`/clients/${clientId}/obligations`).then(setList).catch(e => run(async () => { throw e; })); if (lead) api('/deadlines').then(s => setRules([...s.catalog.filter((r: Row) => r.approved), ...s.firmRules])).catch(() => setRules([])); }, [clientId, tick]);
  if (!list) return null;
  return <div className="stack">
    {list.obligations.length ? <ul>{list.obligations.map((o: Row) => <li key={o.id}>{o.rule?.form} · {o.state} · year ends month {o.fiscal_year_end}{o.internal_days > 0 && ` · internal target ${o.internal_days} days earlier`} <small className="muted">obligation ID {o.id}</small></li>)}</ul> : <Empty>No obligations configured.</Empty>}
    {lead && rules.length > 0 && <Form label="Add obligation" submit={async data => run(() => api(`/clients/${clientId}/obligations`, data), 'Obligation added')}>
      <div className="row"><Field label="Rule" name="ruleKey"><select name="ruleKey">{rules.map(r => <option key={r.key} value={r.key}>{r.form} ({kindLabel(r)})</option>)}</select></Field>
        <Field label="State" name="state" value="CA" /><Field label="Fiscal year ends (month)" name="fiscalYearEnd" type="number" value={12} /><Field label="Internal lead days" name="internalDays" type="number" value={0} /></div>
    </Form>}
  </div>;
}

/** A job's calculated dates, kept apart: original, extended, relief, internal and any override; filing only from an acknowledgment. */
export function JobDeadline({ detail, actor, run }: { detail: Row; actor: Row; run: Run }) {
  const d = detail.deadline, job = detail.job, base = `/jobs/${job.id}/deadline`;
  const [filing, setFiling] = useState<Row>();
  useEffect(() => {
    setFiling(undefined);
    if (d && d.kind !== 'firm' && job.access === 'full') api(`/jobs/${job.id}/filing-status`).then(setFiling).catch(() => setFiling(undefined));
  }, [job.id, detail]);
  if (!d) return null;
  const files = (detail.requests as Row[]).flatMap(r => r.files ?? []).filter(f => !f.erased_at), open = job.status !== 'signed_off';
  return <div className="stack">
    <h3>Deadline</h3>
    <p className="muted">{d.kind === 'firm' ? `Firm-defined deadline (${d.source_title}), not an agency deadline` : <><a href={d.source_url} rel="noreferrer" target="_blank">{d.source_title}</a> · rule {d.rule_key} v{d.rule_version}</>} · period ends {day(d.period_end)}</p>
    <ul>
      <li>Original due {day(d.original_due)}{d.shift_note && <small className="muted"> · {d.shift_note}</small>}</li>
      {d.extension_form && <li>Extended due {day(d.extension_due)} (Form {d.extension_form}) · {d.extension_automatic ? 'automatic' : d.extension_recorded_at ? `requested, recorded by ${d.extension_recorded_by} ${when(d.extension_recorded_at)}` : 'not requested'}</li>}
      {d.relief_due && <li>Postponed to {day(d.relief_due)} by {d.relief_title}</li>}
      <li>Internal target {day(d.internal_due)}</li>
      {d.override_due && <li>Overridden to {day(d.override_due)} by {d.override_by}: {d.override_reason}</li>}
      <li>Filing: {d.filing}{d.filing_submission_id && ` · ${d.filing_submission_id} accepted ${day(d.filing_accepted_on)} (${d.filing_file_name})`}</li>
    </ul>
    {open && d.extension_form && !d.extension_automatic && !d.extension_recorded_at && <button className="quiet" onClick={() => run(() => api(base + '/extension', {}), 'Extension recorded; the job stays open until filing is acknowledged')}>Record extension request (Form {d.extension_form})</button>}
    {open && actor.role !== 'preparer' && <details><summary>Override the working due date</summary>
      <Form label="Override" submit={async data => run(() => api(base + '/override', data), 'Override recorded')}><div className="row"><Field label="Working due date" name="date" type="date" /><Field label="Reason" name="reason" /></div></Form>
    </details>}
    {filing && <section aria-label="Practitioner filing source" className="stack">
      <h3>Return filing source</h3>
      <p>Form {filing.return.form} · {filing.return.jurisdiction} · tax year {filing.return.taxYear}</p>
      {filing.source ? <>
        <p><strong>{filing.status} · practitioner-recorded</strong> · {filing.source.stack}</p>
        <p>{filing.source.noStatusDeclaration}</p>
        <p>Submission {filing.source.submissionId} · accepted {day(filing.source.acceptedOn)}</p>
        <p>{filing.source.evidenceAvailable ? <a href={`/api/blotter/files/${filing.source.fileId}`}>{filing.source.fileName}</a> : 'Acknowledgment file erased or unavailable'}</p>
        <p className="muted">Acknowledgment recorded by {filing.source.acknowledgmentRecordedBy} {when(filing.source.acknowledgmentRecordedAt)}. Source mapped by {filing.source.recordedBy} {when(filing.source.recordedAt)}.</p>
      </> : <>
        <p>No stack status recorded. Checklist completion, signatures and job sign-off do not establish filing.</p>
        {!actor.readOnly && files.length > 0 && <details><summary>Record a no-status fallback</summary>
          <p>Use only when the named stack exposes no status for this return. This records an accepted agency acknowledgment, with practitioner provenance.</p>
          <Form label="Save practitioner source" submit={async data => run(async () => {
            await api(`/jobs/${job.id}/filing-status`, { ...data, ...filing.return, noStatus: data.noStatus === 'on' });
          }, 'Practitioner filing source recorded')}>
            <Field label="Tax stack" name="stack"><select name="stack">{filing.stacks.map((stack: string) => <option key={stack}>{stack}</option>)}</select></Field>
            <Field label="This stack exposes no status for this return" name="noStatus" type="checkbox" />
            <Field label="No-status declaration" name="noStatusDeclaration"><textarea name="noStatusDeclaration" required maxLength={500} /></Field>
            <div className="row"><Field label="Fallback acknowledgment file" name="fileId"><select name="fileId" defaultValue={d.filing_file_id ?? files[0]?.id}>{files.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select></Field>
              <Field label="Fallback submission ID" name="submissionId" value={d.filing_submission_id ?? ''} /><Field label="Fallback accepted on" name="acceptedOn" type="date" value={d.filing_accepted_on ?? ''} /></div>
          </Form>
        </details>}
      </>}
    </section>}
    {!actor.readOnly && !d.filing_recorded_at && files.length > 0 && <details><summary>Record the agency's filing acknowledgment</summary>
      <Form label="Record acknowledgment" submit={async data => run(() => api(base + '/filing', data), 'Filing acknowledgment recorded')}>
        <div className="row"><Field label="Acknowledgment file" name="fileId"><select name="fileId">{files.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select></Field>
          <Field label="Submission ID" name="submissionId" /><Field label="Accepted on" name="acceptedOn" type="date" /></div>
      </Form>
    </details>}
  </div>;
}
