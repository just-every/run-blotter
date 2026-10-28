import { useEffect, useState } from 'react';
import { api, Field, Form, readFile, when, type Row, type Run } from './common';

/** Intake never offers signature completion, provider delivery or a readiness override. */
export function EfileAuthorizations({ detail, actor, run, tick }: { detail: Row; actor: Row; run: Run; tick: number }) {
  const [view, setView] = useState<Row>();
  const job = detail.job, path = `/jobs/${job.id}/efile-authorization`;
  useEffect(() => { setView(undefined); api(path).then(setView).catch(() => setView(undefined)); }, [job.id, tick]);
  if (!view?.eligible) return null;
  const files = detail.requests.flatMap((r: Row) => r.files ?? []).filter((f: Row) => !f.erased_at && f.mime === 'application/pdf');
  return <section className="panel" aria-label="Unsigned e-file authorization">
    <h2>Form 8879 intake</h2>
    <p>1040 · tax year {view.taxYear} · married filing jointly</p>
    <p>Practitioner-recorded final unsigned PDF and required spouse roster. Tax-software provenance and signer identity are not verified.</p>
    <p className="notice">Ready to file is blocked. No signature, KBA, transmission, acceptance or filing is established here.</p>
    <ul>{view.reasons.map((reason: string) => <li key={reason}>{reason}</li>)}</ul>
    {view.record ? <>
      <p>{view.record.restored ? 'Historical intake restored inactive' : <a href={`/api/blotter${path}/original`}>Download unsigned original</a>} · {view.record.fileName}</p>
      <details><summary>Original digest and attribution</summary><p style={{ overflowWrap: 'anywhere' }}>SHA-256 {view.record.sha256}</p><p>Recorded by {view.record.recordedBy} · {when(view.record.recordedAt)}</p></details>
      <ul>{view.record.signers.map((signer: Row) => <li key={signer.contactId}><strong>{signer.name}</strong> · required spouse, practitioner-recorded
        <p>Signature: unavailable. KBA: unavailable.{!signer.currentAuthority && ' Current contact authority changed or was revoked.'}</p></li>)}</ul>
    </> : !actor.readOnly && job.status === 'open' && <details><summary>Review unsigned 8879 intake</summary>
      <p>First add the final PDF to this job’s Client documents. Then review that exact original and select both required spouses. This does not send the form.</p>
      {detail.requests.length > 0 && <label className="upload">Add final PDF<input aria-label="Final unsigned 8879 PDF" type="file" accept="application/pdf" onChange={e => {
        const file = e.target.files?.[0]; if (file) run(async () => api(`/requests/${detail.requests[0].id}/files`, await readFile(file)), 'Original added; review it below');
      }} /></label>}
      {files.length > 0 && <Form label="Record unsigned Form 8879" submit={async data => run(() => api(path, {
        jobId: job.id, clientId: view.clientId, taxYear: view.taxYear, form: view.form, filingStatus: view.filingStatus,
        fileId: data.fileId, spouseContactIds: [data.firstSpouse, data.secondSpouse],
        reviewedFinalUnsigned: data.reviewedFinalUnsigned === 'on', reviewedRequiredSigners: data.reviewedRequiredSigners === 'on',
      }), 'Unsigned original and reviewed spouse roster recorded')}>
        <Field label="Final unsigned original" name="fileId"><select name="fileId">{files.map((f: Row) => <option key={f.id} value={f.id}>{f.name}</option>)}</select></Field>
        <div className="row">{[['firstSpouse','First required spouse'],['secondSpouse','Second required spouse']].map(([name,label]) => <Field key={name} label={label} name={name}><select name={name} defaultValue="" required><option value="" disabled>Choose a current authorized signer</option>{view.contacts.map((c: Row) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>)}</div>
        <Field label="I reviewed this exact final PDF as unsigned Form 8879" name="reviewedFinalUnsigned" type="checkbox" />
        <Field label="I reviewed both contacts as the required spouses for this client and tax year" name="reviewedRequiredSigners" type="checkbox" />
      </Form>}
    </details>}
  </section>;
}
