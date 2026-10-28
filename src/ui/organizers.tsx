import { useEffect, useState } from 'react';
import { api, readFile, Status, when, type Row, type Run } from './common';
import { useT } from './i18n';

/** Uses the existing panel/form system; responsibility is always explicit. */
export function OrganizerStaff({ jobId, run, actorRole }: { jobId: string; run: Run; actorRole: string }) {
  const [view, setView] = useState<Row>(), [links, setLinks] = useState<Row[]>([]), [preview, setPreview] = useState<Row>(), [messages, setMessages] = useState<Row[]>([]), [error, setError] = useState('');
  const load = async () => setView(await api(`/jobs/${jobId}/organizers`));
  useEffect(() => { load().catch(e => setError(e.message)); api('/messages/templates').then(r => setMessages(r.templates)).catch(e => setError(e.message)); }, [jobId]);
  if (error) return <p className="error" role="alert">{error}</p>;
  if (!view?.organizers.length) return null;
  return <>{view.organizers.map((o: Row) => <section className="panel" key={o.id} id={`organizer-${o.id}`} aria-label={o.definition.name}>
    <h2>{o.definition.name}</h2><p className="muted">{o.definition.collectionForm ? `${o.definition.collectionForm} collection` : o.definition.kind} organizer · version {o.definition.version}. Submitted originals remain available when a client corrects an answer.</p>
    {o.erased_at ? <p>Answers erased {when(o.erased_at)}.</p> : <>
      {o.definition.collectionForm && !o.resolutionCaseId && <p className="notice">Create and review the resolution case before inviting contacts.</p>}
      {view.writable && (!o.definition.collectionForm || o.resolutionCaseId) && <form onSubmit={e => { e.preventDefault(); const form = e.currentTarget, data = new FormData(form), assignments = Object.fromEntries(o.definition.questions.map((q: Row) => [q.key, data.get(q.key)]));
        run(async () => { const sent = await api(`/jobs/${jobId}/organizers/send`, { revision: o.revision, assignments, templateId: data.get('templateId') || undefined }); setLinks(sent.recipients); setPreview(undefined); await load(); }, 'Organizer links created; check each contact’s mail outcome'); }}>
        <fieldset><legend>Who answers each question</legend>{o.definition.questions.map((q: Row) => <label key={q.key}>{q.label}<select name={q.key} required defaultValue={o.answers[q.key]?.contactId ?? ''}>
          <option value="">Choose a responsible contact</option>{view.contacts.filter((c: Row) => c.active && c.authorized && c.portal && c.request_consent && c.email_consent).map((c: Row) => <option value={c.id} key={c.id}>{c.name} · {c.email}</option>)}
        </select></label>)}</fieldset>
        <label>Message template<select name="templateId"><option value="">Organizer invitation</option>{messages.map(m => <option value={m.id} key={m.id}>{m.name}</option>)}</select></label>
        <div className="actions"><button type="button" onClick={e => { const data = new FormData(e.currentTarget.form!); run(async () => setPreview(await api(`/jobs/${jobId}/organizers/send/preview`, { revision: o.revision, assignments: Object.fromEntries(o.definition.questions.map((q: Row) => [q.key, data.get(q.key)])), templateId: data.get('templateId') || undefined }))); }}>Preview invitation</button><button>Send organizer</button></div>
      </form>}
      {preview?.recipients.map((p: Row) => <article className="record" key={p.contactId}><h3>{p.to}</h3><p>{p.subject}</p><p style={{ whiteSpace: 'pre-wrap' }}>{p.body}</p>{p.missing.length > 0 && <p className="error">Fill in: {p.missing.map((m: Row) => m.label).join(', ')}</p>}{p.warnings?.map((w: Row) => <p key={w.kind} className="error" role="alert">{w.message}</p>)}</article>)}
      {links.map(l => <p key={l.contactId}><a href={l.portalUrl} target="_blank" rel="noreferrer">Open {l.to}’s organizer</a> · {l.delivery}</p>)}
      <h3>Saved answers</h3><p>{o.completeness.confirmed} of {o.completeness.required} required current answers submitted and confirmed.</p>{o.completeness.unresolved.length > 0 && <p className="notice">Awaiting: {o.completeness.unresolved.map((q: Row) => q.label).join(', ')}.</p>}<dl>{o.definition.questions.map((q: Row) => <div key={q.key}><dt>{q.label}{!o.applicable.includes(q.key) && ' · outside the latest submitted branch'}</dt><dd>{o.answers[q.key]?.value || 'Not answered'}{o.answers[q.key]?.carriedFrom && ' · carried from a prior period'}{!o.answers[q.key]?.confirmed && ' · awaiting confirmation'}<small className="muted"> · {view.contacts.find((c: Row) => c.id === o.answers[q.key]?.contactId)?.name ?? 'Unassigned'}</small></dd></div>)}</dl>
      <h3>Submitted versions</h3>{o.submissions.length === 0 && <p className="muted">Nobody has submitted answers yet.</p>}
      {o.submissions.map((s: Row, n: number) => <article className="record" key={s.id}><h4>Submission {s.version} · {view.contacts.find((c: Row) => c.id === s.contact_id)?.name}</h4><p className="muted">{when(s.submitted_at)}</p>
        {s.answers && <dl>{Object.entries(s.answers).map(([key, answer]: [string, any]) => { const previous = o.submissions.slice(0, n).filter((p: Row) => p.contact_id === s.contact_id).at(-1)?.answers?.[key]; return <div key={key}><dt>{o.definition.questions.find((q: Row) => q.key === key)?.label ?? key}</dt><dd>{answer.value || 'Unanswered'}{!answer.confirmed && ' · unconfirmed'}{previous && previous.value !== answer.value && <small className="muted"> · previously: {previous.value || 'Unanswered'}</small>}</dd></div>; })}</dl>}
        {s.reviewed_at ? <p>Reviewed by {s.reviewed_by} · {when(s.reviewed_at)}<br />{s.review_note}</p> : view.writable && <form onSubmit={e => { e.preventDefault(); const data = new FormData(e.currentTarget); run(async () => { await api(`/organizers/${o.id}/review`, { submissionId: s.id, note: data.get('note') }); await load(); }, 'Review recorded'); }}><label>Review findings<textarea name="note" required maxLength={2000} /></label><button>Record review</button></form>}
      </article>)}
      {o.deliveries.map((d: Row) => <p className="muted" key={d.id}>{d.to_email} · {d.delivery} · {when(d.sent_at)}</p>)}
      {actorRole === 'owner' && <details><summary>Erase organizer answers</summary><p>Erase draft and submitted answers, review text and unconfirmed carried copies. Attribution and submission times remain. Supporting files use their own erasure action.</p><form onSubmit={e => { e.preventDefault(); const data = new FormData(e.currentTarget); run(async () => { await api(`/organizers/${o.id}/erase`, { revision: o.revision, confirm: data.get('confirm'), reason: data.get('reason') }); setLinks([]); await load(); }, 'Organizer answers erased; older archives are fenced'); }}>
        <label>Type {o.definition.name} to confirm<input name="confirm" required autoComplete="off" /></label><label>Reason<textarea name="reason" required maxLength={1000} /></label><button className="danger">Erase answers</button>
      </form></details>}
    </>}
  </section>)}</>;
}

type PortalProps = { path: string; busy: boolean; act: (work: () => Promise<string>) => Promise<void>; reload: () => Promise<void> };
async function portalPost(path: string, body: Row, failure = 'Your answers could not be saved') {
  const response = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const result: Row = await response.json();
  if (!response.ok) throw new Error(result.error ?? failure); return result;
}

function PortalOrganizerForm({ organizer: o, path, busy, act, reload }: PortalProps & { organizer: Row }) {
  const t = useT(), [answers, setAnswers] = useState<Row>(Object.fromEntries(o.questions.map((q: Row) => [q.key, { value: q.value, confirmed: q.confirmed }])));
  const save = (submit: boolean) => act(async () => { const changed = Object.fromEntries(Object.entries(answers).filter(([key, a]) => { const q = o.questions.find((q: Row) => q.key === key); return a.value !== q.value || a.confirmed !== q.confirmed; })); await portalPost(`${path}/organizers/${encodeURIComponent(o.id)}`, { revision: o.revision, answers: changed, submit }, t('org.failed')); await reload(); return submit ? t('org.submitted') : t('org.saved'); });
  return <section className="panel" aria-labelledby={`organizer-${o.id}`}><h2 id={`organizer-${o.id}`}>{o.name}</h2><p className="muted">{t('org.version', { version: o.version })}</p>
    <form onSubmit={e => { e.preventDefault(); save(false); }}>
      {o.questions.map((q: Row) => <div className="field" key={q.key}>
        <label>{q.label}{q.required && t('org.required')}{q.type === 'choice' ? <select disabled={busy || !o.writable} value={answers[q.key].value} onChange={e => setAnswers({ ...answers, [q.key]: { value: e.target.value, confirmed: false } })}><option value="">{t('org.choose')}</option>{q.options.map((v: string) => <option key={v} value={v}>{q.optionLabels?.[v] ?? v}</option>)}</select>
          : <textarea disabled={busy || !o.writable} value={answers[q.key].value} maxLength={4000} onChange={e => setAnswers({ ...answers, [q.key]: { value: e.target.value, confirmed: false } })} />}</label>
        {q.carriedFrom && <p className="notice">{t('org.carried')}</p>}
        <label><input type="checkbox" disabled={busy || !o.writable || !answers[q.key].value} checked={answers[q.key].confirmed} onChange={e => setAnswers({ ...answers, [q.key]: { ...answers[q.key], confirmed: e.target.checked } })} /> {t('org.confirm')}</label>
        {q.request && <div><p>{q.request.label} · <Status value={q.request.status} /></p>{o.writable && q.request.status !== 'accepted' && <label>{t('org.support')}<input type="file" disabled={busy} onChange={e => { const file = e.target.files?.[0]; if (file) act(async () => { await portalPost(`${path}/requests/${q.request.id}`, await readFile(file), t('org.failed')); await reload(); return t('org.supportUploaded'); }); e.target.value = ''; }} /></label>}</div>}
        {q.supportingUpload && !q.request && <small className="muted">{t('org.supportHint')}</small>}
      </div>)}
      {o.writable && <div className="actions"><button disabled={busy}>{t('org.save')}</button><button type="button" disabled={busy} onClick={() => save(true)}>{t('org.submit')}</button></div>}
    </form>
    {o.submissions.length > 0 && <details><summary>{t('org.versions')}</summary>{o.submissions.map((s: Row) => <article key={s.version} className="record"><h3>{t('org.submission', { n: s.version, when: when(s.submitted_at) })}</h3><dl>{Object.entries(s.answers).map(([key, a]: [string, any]) => <div key={key}><dt>{o.labels?.[key] ?? key}</dt><dd>{a.value ? (o.optionLabels?.[key]?.[a.value] ?? a.value) : t('org.notConfirmed')}{!a.confirmed && t('org.unconfirmed')}</dd></div>)}</dl></article>)}</details>}
  </section>;
}

export function PortalOrganizers(props: PortalProps) {
  const t = useT(), [view, setView] = useState<Row>(), [error, setError] = useState('');
  const load = async () => { const r = await fetch(`${props.path}/organizers`); const body: Row = await r.json(); if (!r.ok) throw new Error(body.error ?? t('org.unavailable')); setView(body); };
  useEffect(() => { load().catch(e => setError(e.message)); }, [props.path]);
  return <>{error && <p className="error" role="alert">{error}</p>}{view?.organizers.map((o: Row) => <PortalOrganizerForm key={o.id + o.revision} {...props} organizer={o} reload={async () => { await load(); await props.reload(); }} />)}</>;
}

const blankQuestion = (): Row => ({ key: '', label: '', type: 'text', options: [], required: true, when: null, request: '', workflowQuestion: '' });
/** Publish definitions onto an existing work template; each job keeps its version. */
export function OrganizerTemplateEditor({ templates, run }: { templates: Row[]; run: Run }) {
  const [selected, setSelected] = useState(''), [definition, setDefinition] = useState<Row>({ name: '', kind: 'tax', version: 1, questions: [blankQuestion()] }), [expected, setExpected] = useState(0);
  const patchQuestion = (index: number, patch: Row) => setDefinition({ ...definition, questions: definition.questions.map((q: Row, n: number) => n === index ? { ...q, ...patch } : q) });
  return <section className="panel"><h2>Organizer versions</h2><p className="muted">Publish tax or bookkeeping questions for future work. Existing jobs retain their organizer version.</p>
    <label>Work template<select value={selected} onChange={e => { setSelected(e.target.value); const raw = templates.find(t => t.id === e.target.value)?.organizer, prior = raw ? typeof raw === 'string' ? JSON.parse(raw) : raw : null; setExpected(prior?.version ?? 0); setDefinition(prior ? { ...prior, version: prior.version + 1 } : { name: '', kind: 'tax', version: 1, questions: [blankQuestion()] }); }}><option value="">Choose a template</option>{templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
    {selected && <form onSubmit={e => { e.preventDefault(); run(async () => { const saved = await api(`/templates/${selected}/organizer`, { expectedVersion: expected, organizer: definition }); setExpected(saved.organizer.version); setDefinition({ ...saved.organizer, version: saved.organizer.version + 1 }); }, 'Organizer version published for future jobs'); }}>
      <label>Organizer name<input required maxLength={120} value={definition.name} onChange={e => setDefinition({ ...definition, name: e.target.value })} /></label><label>Spanish organizer name (optional)<input maxLength={120} value={definition.es?.name ?? ''} onChange={e => setDefinition({ ...definition, es: e.target.value ? { name: e.target.value } : undefined })} /></label><label>Kind<select value={definition.kind} onChange={e => setDefinition({ ...definition, kind: e.target.value, collectionForm: undefined })}><option value="tax">Tax</option><option value="bookkeeping">Bookkeeping</option></select></label>
      {definition.kind === 'tax' && <label>Collection form<select value={definition.collectionForm ?? ''} onChange={e => setDefinition({ ...definition, collectionForm: e.target.value || undefined })}><option value="">General tax organizer</option><option value="433-A">433-A financial collection</option></select></label>}
      {definition.questions.map((q: Row, n: number) => <fieldset key={n}><legend>Question {n + 1}</legend>
        <label>Key<input required maxLength={40} pattern="[a-z][a-z0-9_-]*" value={q.key} onChange={e => patchQuestion(n, { key: e.target.value })} /></label>
        <label>Question<input required maxLength={200} value={q.label} onChange={e => patchQuestion(n, { label: e.target.value })} /></label>
        <label>Spanish question (optional)<input maxLength={200} value={q.es?.label ?? ''} onChange={e => patchQuestion(n, { es: e.target.value ? { ...q.es, label: e.target.value } : undefined })} /></label>
        {q.es?.label && q.type === 'choice' && <label>Spanish choices, one per line in the same order<textarea value={(q.es.options ?? []).join('\n')} onChange={e => patchQuestion(n, { es: { ...q.es, options: e.target.value ? e.target.value.split('\n') : undefined } })} /></label>}
        {q.es?.label && q.request && <label>Spanish document request<input maxLength={200} value={q.es.request ?? ''} onChange={e => patchQuestion(n, { es: { ...q.es, request: e.target.value || undefined } })} /></label>}
        <label>Answer type<select value={q.type} onChange={e => patchQuestion(n, { type: e.target.value, options: e.target.value === 'choice' ? ['Yes', 'No'] : [], workflowQuestion: '' })}><option value="text">Text</option><option value="choice">Choice</option></select></label>
        {q.type === 'choice' && <label>Choices, one per line<textarea required value={q.options.join('\n')} onChange={e => patchQuestion(n, { options: e.target.value.split('\n') })} /></label>}
        <label><input type="checkbox" checked={q.required} onChange={e => patchQuestion(n, { required: e.target.checked })} /> Required</label>
        <label>Show when an earlier question has a chosen answer<select value={q.when?.question ?? ''} onChange={e => patchQuestion(n, { when: e.target.value ? { question: e.target.value, values: [] } : null })}><option value="">Always</option>{definition.questions.slice(0, n).filter((p: Row) => p.type === 'choice').map((p: Row) => <option key={p.key} value={p.key}>{p.label || p.key}</option>)}</select></label>
        {q.when && <fieldset><legend>Answers that reveal this question</legend>{definition.questions.find((p: Row) => p.key === q.when.question)?.options.map((value: string) => <label key={value}><input type="checkbox" checked={q.when.values.includes(value)} onChange={e => patchQuestion(n, { when: { ...q.when, values: e.target.checked ? [...q.when.values, value] : q.when.values.filter((v: string) => v !== value) } })} /> {value}</label>)}</fieldset>}
        <label>Supporting document request (optional)<input maxLength={200} value={q.request} onChange={e => patchQuestion(n, { request: e.target.value })} /></label>
        {q.type === 'choice' && <label>Workflow question key (optional)<input maxLength={40} value={q.workflowQuestion} onChange={e => patchQuestion(n, { workflowQuestion: e.target.value })} /></label>}
        {definition.questions.length > 1 && <button type="button" onClick={() => setDefinition({ ...definition, questions: definition.questions.filter((_: Row, i: number) => i !== n) })}>Remove question</button>}
      </fieldset>)}
      <div className="actions"><button type="button" disabled={definition.questions.length >= 60} onClick={() => setDefinition({ ...definition, questions: [...definition.questions, blankQuestion()] })}>Add question</button><button>Publish version {definition.version}</button></div>
    </form>}
  </section>;
}
