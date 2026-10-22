import { useState } from 'react';
import { api, Field, Form, type Row, type Run } from './common';

/** Prepare an official form as a SIGN-002 draft; the existing signer workflow owns sending and execution. */
export function PrepareAuthorization({ authorization: a, client, jobs, run }: { authorization: Row; client: Row; jobs: Row[]; run: Run }) {
  const [prepared, setPrepared] = useState<Row>();
  if (a.kind === 'state') return <p className="muted">Prepare the agency's state form, sign it through Document signatures, then file the completed request here.</p>;
  return <details><summary>Prepare IRS Form {a.kind}</summary>
    <p>Prepare the official January 2021 IRS form with this authorization's tax matters and periods. Review the PDF before sending it for signatures. Each spouse needs a separate authorization.</p>
    <Form label="Prepare form and signature draft" submit={data => run(async () => {
      setPrepared(await api(`/authorizations/${a.id}/prepare`, { ...data, revision: a.revision, reviewed: data.reviewed === 'yes' }));
    }, 'IRS form prepared as a signature draft; review it before sending')}>
      <Field label="Authorization work item" name="jobId"><select name="jobId" required>{jobs.filter(j => j.status !== 'signed_off').map(j => <option key={j.id} value={j.id}>{j.client_name ?? client.name} · {j.period_start} · {j.template_name ?? j.service ?? 'Work'}</option>)}</select></Field>
      <Field label="Taxpayer signer" name="contactId"><select name="contactId" required>{(client.contacts ?? []).filter((c: Row) => c.active && c.authorized && c.signer && c.portal && c.request_consent).map((c: Row) => <option key={c.id} value={c.id}>{c.name} &lt;{c.email}&gt;</option>)}</select></Field>
      <Field label="Taxpayer legal name" name="taxpayerName" value={client.name} />
      <Field label="Taxpayer mailing address" name="taxpayerAddress"><textarea name="taxpayerAddress" required rows={3} /></Field>
      <Field label="Taxpayer identification type" name="tinType"><select name="tinType"><option value="ein">EIN</option><option value="ssn">SSN</option><option value="itin">ITIN</option></select></Field>
      <Field label="Taxpayer identification number" name="taxpayerTin" value={client.abn || ''} hint="Kept only in the prepared document, under signed-document retention." />
      <Field label="Taxpayer telephone" name="taxpayerPhone" required={false} />
      <Field label="Taxpayer signer title or capacity" name="taxpayerTitle" required={false} />
      <Field label="Representative mailing address" name="representativeAddress"><textarea name="representativeAddress" required rows={3} /></Field>
      <Field label="Representative telephone" name="representativePhone" />
      <Field label="Representative PTIN" name="ptin" required={false} />
      {a.kind === '2848' && <>
        <p>{a.representative} signs the representative declaration through their own staff session ({a.representative_email || 'record a staff representative email on a new authorization first'}).</p>
        <Field label="Representative designation" name="designation"><select name="designation"><option value="a">a — Attorney</option><option value="b">b — Certified Public Accountant</option><option value="c">c — Enrolled Agent</option><option value="d">d — Officer</option><option value="e">e — Full-Time Employee</option><option value="f">f — Family Member</option><option value="g">g — Enrolled Actuary</option><option value="h">h — Unenrolled Return Preparer</option><option value="k">k — Student Attorney or CPA</option><option value="r">r — Enrolled Retirement Plan Agent</option></select></Field>
        <Field label="Licensing jurisdiction or other authority" name="jurisdiction" />
        <Field label="License, bar or enrollment number" name="licenseNumber" required={false} />
      </>}
      <Field label="Scope and representative review" name="reviewed"><select name="reviewed" required defaultValue=""><option value="" disabled>Confirm after review</option><option value="yes">I reviewed the scope, signer authority, representative eligibility and replacement of prior authorizations</option></select></Field>
    </Form>
    {prepared && <p role="status">Form {a.kind} prepared. <a href={`/api/blotter/signatures/${prepared.id}/files/original`} target="_blank" rel="noreferrer">Review prepared IRS PDF</a> · <a href={`/app?job=${prepared.job_id}`}>Open signature draft</a>. Send only after reviewing its fields and scope.</p>}
  </details>;
}
