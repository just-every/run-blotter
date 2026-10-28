import { useEffect, useState } from 'react';
import { api, day, Empty, Field, Form, Status, type Row, type Run } from './common';
import { PrepareAuthorization } from './authorization-prepare';

const METHOD: Record<string, string> = { irs_online: 'IRS online submission', tax_pro_account: 'Tax Pro Account', fax: 'Fax' };
const title = (a: Row) => a.kind === 'state' ? `${a.agency} authorization` : `Form ${a.kind}`;

/** AUTHZ-002: the client's 2848, 8821 and state authorizations, their lifecycle and the transcript requests they scope. */
export function Authorizations({ clientId, client, jobs, lead, run, tick }: { clientId: string; client: Row; jobs: Row[]; lead: boolean; run: Run; tick: number }) {
  const [data, setData] = useState<Row>(), [signatures, setSignatures] = useState<Row[]>([]), [kind, setKind] = useState('2848');
  const load = async () => { const [list, signed] = await Promise.all([api(`/clients/${clientId}/authorizations`), api(`/clients/${clientId}/signatures`)]); setData(list); setSignatures(signed.filter((s: Row) => s.status === 'completed')); };
  useEffect(() => { load().catch(e => run(async () => { throw e; })); }, [clientId, tick]);
  if (!data) return null;
  const act = (path: string, a: Row, body: Row, message: string) => run(async () => { await api(`/authorizations/${a.id}/${path}`, { ...body, revision: a.revision }); await load(); }, message);
  return <section className="panel stack" style={{ minWidth: 0, overflowWrap: 'anywhere' }} aria-label="Taxpayer authorizations"><h2>Taxpayer authorizations</h2>
    <p className="muted">A recorded Form 2848 lets the practice contact the agency for the covered forms and years; a recorded 2848 or 8821 lets it request transcripts for them. Anything outside a recorded authorization is refused.</p>
    {!data.authorizations.length && <Empty>No authorizations recorded.</Empty>}
    {data.authorizations.map((a: Row) => <article className="record" key={a.id}>
      <div className="split"><strong>{title(a)} · {a.representative}{a.caf_number && ` · CAF ${a.caf_number}`}</strong><Status value={a.status} /></div>
      <p>{a.matters.map((m: Row) => `${m.matter}: Form ${m.form}, ${m.from}–${m.to}`).join('; ')}</p>
      <p>{a.signed_on ? `Signed ${day(a.signed_on)}` : 'Not signed yet'}{a.submitted_on && ` · submitted ${day(a.submitted_on)} by ${METHOD[a.submission_method]}`}{a.status_reason && ` · ${a.status_reason}`}</p>
      {lead && a.status === 'draft' && !a.signature_id && <PrepareAuthorization authorization={a} client={client} jobs={jobs} run={run} />}
      {lead && a.status === 'draft' && !a.signature_id && <Form label="File the signed form" submit={data => act('signature', a, { signatureId: data.signatureId }, 'Signed form filed')}>
        <Field label="Completed signature request" name="signatureId"><select name="signatureId">{signatures.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}</select></Field>
      </Form>}
      {lead && a.status === 'draft' && a.signature_id && <Form label="Record submission" submit={data => act('submission', a, { method: data.method, submittedOn: data.submittedOn }, 'Submission recorded')}>
        <Field label="Submission method" name="method"><select name="method">{Object.entries(METHOD).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field>
        <Field label="Submitted on" name="submittedOn" type="date" />
        {a.kind !== 'state' && <p className="muted">An electronically signed 2848 or 8821 may be submitted only online at IRS.gov/Submit2848.</p>}
      </Form>}
      {lead && a.status === 'submitted' && <Form label="Record agency answer" submit={data => act('status', a, { status: data.status, cafNumber: data.cafNumber || undefined, reason: data.reason || undefined }, 'Agency answer recorded')}>
        <Field label="Agency answer" name="status"><select name="status"><option value="recorded">Recorded</option><option value="rejected">Rejected</option></select></Field>
        <Field label="Representative CAF number" name="cafNumber" required={false} value={a.caf_number ?? ''} /><Field label="Reason or note" name="reason" required={false} />
      </Form>}
      {lead && ['submitted', 'recorded'].includes(a.status) && <details><summary>Withdraw</summary><Form danger label="Withdraw authorization" submit={data => act('withdraw', a, { reason: data.reason }, 'Authorization withdrawn; dependent notices flagged')}><Field label="Withdrawal reason" name="reason" /></Form></details>}
    </article>)}
    {lead && <details><summary>Add an authorization</summary>
      <Form label="Save authorization" submit={data => run(async () => { await api(`/clients/${clientId}/authorizations`, { kind: data.kind, agency: data.agency || undefined, representative: data.representative, representativeEmail: data.representativeEmail || undefined, cafNumber: data.cafNumber || undefined, matters: [{ form: data.form, from: data.from, to: data.to, matter: data.matter || undefined }] }); await load(); }, 'Authorization saved as a draft')}>
        <Field label="Authorization" name="kind"><select name="kind" value={kind} onChange={e => setKind(e.target.value)}><option value="2848">Form 2848 power of attorney</option><option value="8821">Form 8821 tax information authorization</option><option value="state">State authorization</option></select></Field>
        {kind === 'state' && <Field label="State agency" name="agency" />}
        <Field label="Representative" name="representative" /><Field label="Staff representative email" name="representativeEmail" required={false} /><Field label="CAF number" name="cafNumber" required={false} />
        <div className="row"><Field label="Tax form" name="form" value="1040" /><Field label="First year" name="from" type="number" /><Field label="Last year" name="to" type="number" /></div>
        <Field label="Tax matter" name="matter" value="Income" required={false} />
      </Form>
    </details>}
    <h3>Transcript requests</h3>
    {!data.transcripts.length ? <Empty>No transcript requests.</Empty> : <ul className="list">{data.transcripts.map((t: Row) => <li key={t.id}>{t.transcript_type} · Form {t.form} {t.year} · {t.status} · {t.requested_by}</li>)}</ul>}
    <Form label="Request transcript" submit={data => run(async () => { await api(`/clients/${clientId}/transcript-requests`, { form: data.form, year: data.year, transcriptType: data.transcriptType }); await load(); }, 'Transcript request recorded; retrieval follows INTEGRATE-006')}>
      <div className="row"><Field label="Transcript form" name="form" value="1040" /><Field label="Transcript year" name="year" type="number" /></div>
      <Field label="Transcript type" name="transcriptType" value="Account transcript" />
    </Form>
  </section>;
}
