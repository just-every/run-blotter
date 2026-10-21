import { useEffect, useState } from 'react';
import { api, money, Empty, Field, Form, today, type Row, type Run } from './common';

/** Prospects through the firm's stages, lost reasons, winning into a client with onboarding work, and the pipeline report (CRM-005). */
export function Pipeline({ state, run, tick, open }: { state: Row; run: Run; tick: number; open: (id: string) => void }) {
  const [data, setData] = useState<Row>();
  useEffect(() => { api('/pipeline').then(setData).catch(() => setData(undefined)); }, [tick]);
  if (!data) return null;
  const openStages = data.stages.filter((s: Row) => s.kind === 'open'), lost = data.stages.find((s: Row) => s.kind === 'lost');
  const group = (rows: Row[], key: string) => <table className="table"><thead><tr><th>{key === 'source' ? 'Source' : 'Owner'}</th><th>Prospects</th><th>Won / lost</th><th>Conversion</th><th>Open fees</th><th>Won fees</th></tr></thead>
    <tbody>{rows.map(r => <tr key={r[key] + r.currency}><td data-label={key === 'source' ? 'Source' : 'Owner'}>{r[key]}</td><td data-label="Prospects">{r.prospects} ({r.open} open)</td><td data-label="Won / lost">{r.won} / {r.lost}</td>
      <td data-label="Conversion">{r.conversionPercent === null ? '—' : `${r.conversionPercent}%`}</td><td data-label="Open fees">{money(r.openFeeCents, r.currency)}</td><td data-label="Won fees">{money(r.wonFeeCents, r.currency)}</td></tr>)}</tbody></table>;
  return <section className="panel">
    <h2>Prospects</h2><p><a href="/intake" target="_blank" rel="noreferrer">Open website intake form</a> · Embed this address in your website with an iframe.</p>
    {!data.prospects.length ? <Empty>No prospects yet.</Empty> : <ul className="list">{data.prospects.map((p: Row) => <li key={p.id}>
      <strong>{p.name}</strong> <small className="muted">{p.stage} for {p.stageAgeDays} days · {p.source} · {p.services.join(', ')} · {p.created_by === 'website' && !p.fee_cents ? 'annual fee not estimated' : <>{money(p.fee_cents, p.currency)} a year</>} · {p.owner_email}{p.lost_reason && ` · lost: ${p.lost_reason}`}</small>
      {p.answers?.consent && <details><summary>Intake answers and uploads</summary><p>{p.answers.details}</p>{p.answers.feeBand && <p>Requested annual budget: {p.answers.feeBand}</p>}<p className="muted">{p.answers.consent} · {p.answers.consentAt}</p>{p.answers.marketing && <p className="muted">Marketing opt-in ({p.answers.marketing.version}): “{p.answers.marketing.wording}” · {p.answers.marketing.at}{p.client_id ? ' · recorded for the client contact' : ' · recorded for the contact when won'}</p>}{p.files.map((f: Row) => <p key={f.id}>{f.erased_at ? <span>{f.name} · erased</span> : <a href={`/api/blotter/prospects/${p.id}/files/${f.id}`}>{f.name}</a>} · {f.size} bytes</p>)}</details>}
      {p.onboarding_job_id ? <> <button className="quiet text-action" onClick={() => open(p.onboarding_job_id)}>Open onboarding</button></> : <details><summary>Move or win</summary>
        <Form label="Move" submit={async data => run(() => api(`/prospects/${p.id}/stage`, { stageId: data.stageId, reason: data.reason || undefined }), 'Moved')}>
          <div className="row"><Field label="Stage" name="stageId"><select name="stageId">{data.stages.filter((s: Row) => s.kind !== 'won' && s.id !== p.stage_id).map((s: Row) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
            <Field label={`Reason (needed for ${lost?.name ?? 'lost'})`} name="reason" required={false} /></div>
        </Form>
        {p.stage_kind === 'open' && <Form label="Record manual win: create client and onboarding work" submit={async data => run(() => api(`/prospects/${p.id}/win`, { templateId: data.templateId, preparerEmail: data.preparerEmail, reviewerEmail: data.reviewerEmail, periodStart: data.periodStart, dueDate: data.dueDate, dueNote: data.dueNote }), 'Client created')}>
          <div className="row"><Field label="Onboarding template" name="templateId"><select name="templateId">{state.templates.map((t: Row) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Field>
            <Field label="Preparer (email)" name="preparerEmail" type="email" /><Field label="Reviewer (email)" name="reviewerEmail" type="email" /></div>
          <div className="row"><Field label="Period start" name="periodStart" type="date" value={today()} /><Field label="Due" name="dueDate" type="date" /><Field label="Where the due date comes from" name="dueNote" /></div>
        </Form>}
      </details>}</li>)}</ul>}
    <details><summary>Add a prospect</summary>
      <Form label="Add prospect" submit={async (form, el) => run(async () => { await api('/prospects', { name: form.name, contactName: form.contactName, contactEmail: form.contactEmail, source: form.source, services: String(form.services).split(',').map(s => s.trim()).filter(Boolean), estimatedFeeCents: Math.round(Number(form.fee) * 100), ownerEmail: form.ownerEmail, stageId: form.stageId, contacts:form.additionalEmail ? [{name:form.additionalName,email:form.additionalEmail,roles:['billing'],authorized:form.additionalAuthority === 'true',portal:form.additionalAuthority === 'true',requestConsent:form.additionalAuthority === 'true',emailConsent:form.additionalAuthority === 'true',consentNote:form.additionalNote}] : [] }); el.reset(); }, 'Prospect added')}>
        <div className="row"><Field label="Prospect" name="name" /><Field label="Contact name" name="contactName" /><Field label="Contact email" name="contactEmail" type="email" /></div>
        <div className="row"><Field label="Lead source" name="source" /><Field label="Requested services (comma separated)" name="services" /><Field label="Estimated annual fees" name="fee" type="number" /></div>
        <details><summary>Additional billing contact</summary><Field label="Additional contact name" name="additionalName" required={false} /><Field label="Additional contact email" name="additionalEmail" type="email" required={false} /><Field label="Entity authority, portal and email consent confirmed" name="additionalAuthority"><select name="additionalAuthority"><option value="false">No</option><option value="true">Yes, recorded by staff</option></select></Field><Field label="Authority and consent note" name="additionalNote" required={false} /></details>
        <div className="row"><Field label="Owner (email)" name="ownerEmail" type="email" value={state.actor.email} /><Field label="Stage" name="stageId"><select name="stageId">{openStages.map((s: Row) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field></div>
      </Form>
    </details>
    <h3>Pipeline report</h3>
    {group(data.report.bySource, 'source')}
    {group(data.report.byOwner, 'owner')}
    <ul className="list">{data.report.stageAge.map((s: Row) => <li key={s.stage}>{s.stage}: {s.open} open{s.open > 0 && ` · average ${s.averageDays} days, oldest ${s.oldestDays} days`}</li>)}</ul>
  </section>;
}
