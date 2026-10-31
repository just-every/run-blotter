import { useEffect, useRef, useState } from 'react';
import { api, Field, type Row, type Run } from './common';

type PanelProps = { detail: Row; actor: Row; run: Run; tick: number };
const sourceKey = (source: Row) => `${source.kind}:${source.id}`;

export function AiAssistance({ detail, actor, run, tick }: PanelProps) {
  const [data, setData] = useState<Row>(), [opened, setOpened] = useState(false), [purpose, setPurpose] = useState('summary');
  const [selected, setSelected] = useState(''), [confirmed, setConfirmed] = useState(false), [result, setResult] = useState<Row>();
  const [busy, setBusy] = useState(false), lock = useRef(false);
  const jobId = detail.job.id, staff = ['owner', 'reviewer', 'preparer'].includes(actor.role);
  const canNotice = ['owner', 'reviewer'].includes(actor.role), writable = staff && !actor.readOnly;
  useEffect(() => {
    if (!opened || !staff) return;
    let active = true;
    api(`/jobs/${jobId}/ai`).then(value => { if (active) setData(value); }).catch(error => run(async () => { throw error; }));
    return () => { active = false; };
  }, [jobId, tick, opened, staff]);
  const act = async (work: () => Promise<void>, message: string) => {
    if (lock.current) return;
    lock.current = true; setBusy(true);
    try { await run(work, message); } finally { lock.current = false; setBusy(false); }
  };
  if (!staff) return null;
  const sources: Row[] = (data?.sources ?? []).filter((source: Row) => purpose === 'summary' || source.kind === 'document');
  const source = sources.find(item => sourceKey(item) === selected);
  const openDraft = (draft: Row) => act(async () => {
    const saved = await api(`/ai/drafts/${draft.id}`);
    setResult({ ...(saved.draft ?? saved), source: saved.source, savedId: draft.id });
  }, 'Draft opened');
  return <details onToggle={event => setOpened(event.currentTarget.open)}>
    <summary>AI assistance</summary>
    <div className="stack" aria-busy={busy}>
      {!data ? <p>Opening assistance…</p> : <>
        <details><summary>What this assistance includes</summary>
          <p>Proposals are preparation only. Verify facts and source quotes. They are not legal or tax advice and do not calculate tax, file, contact an agency or send messages.</p>
          <p>Mailbox threads and signed engagement scope are unavailable. Notice review has no wage-and-income transcript context; differences against that transcript cannot be checked here.</p>
        </details>
        {!data.enabled && <p className="muted">AI assistance is off. The principal can enable it in Team settings after recording an attestation reference.</p>}
        {writable && data.enabled && <fieldset disabled={busy}>
          <legend>Prepare from one selected source</legend>
          <Field label="Preparation" name="aiPurpose"><select value={purpose} onChange={event => { setPurpose(event.target.value); setSelected(''); setConfirmed(false); }}>
            <option value="summary">Summary and reply draft</option><option value="document">Document validation, naming and routing</option>{canNotice && <option value="notice">Notice fields and response plan</option>}
          </select></Field>
          <Field label="Source" name="aiSource"><select value={selected} onChange={event => { setSelected(event.target.value); setConfirmed(false); }}>
            <option value="">Choose a source</option>{sources.map(item => <option key={sourceKey(item)} value={sourceKey(item)}>{item.label} · {item.kind === 'portal' ? 'Portal conversation' : 'Document'}</option>)}
          </select></Field>
          {!sources.length && <p className="muted">No eligible sources on this job. Unsupported or unreadable documents cannot be processed.</p>}
          <label className="check"><input type="checkbox" checked={confirmed} disabled={!source} onChange={event => setConfirmed(event.target.checked)} /> I confirm that masked text from this selected source will be sent to the firm's AI provider for this request.</label>
          <button disabled={!source || !confirmed} onClick={() => act(async () => {
            const response = await api(`/jobs/${jobId}/ai`, { purpose, sourceKind: source!.kind, sourceId: source!.id, confirm: true });
            setResult(response); setConfirmed(false);
          }, 'Proposals ready for review')}>Process selected source</button>
        </fieldset>}
        {result && <AiReview key={result.savedId ?? result.requestId} result={result} writable={writable && (result.purpose !== 'notice' || canNotice)} targets={data.targets ?? []} busy={busy} act={act} changed={setResult} />}
        <details><summary>Saved drafts ({data.drafts.length})</summary>
          {!data.drafts.length ? <p className="muted">No saved AI drafts.</p> : <ul className="list">{data.drafts.map((draft: Row) => <li key={draft.id}><button className="quiet" disabled={busy} onClick={() => openDraft(draft)}>Open {draft.purpose === 'notice' ? 'notice' : draft.purpose === 'document' ? 'document' : 'summary'} draft · {data.sources.find((item: Row) => item.id === draft.source_id && item.kind === draft.source_kind)?.label ?? draft.id}</button></li>)}</ul>}
        </details>
      </>}
    </div>
  </details>;
}

type Act = (work: () => Promise<void>, message: string) => Promise<void>;
function AiReview({ result, writable, targets, busy, act, changed }: { result: Row; writable: boolean; targets: Row[]; busy: boolean; act: Act; changed: (result: Row) => void }) {
  const [output, setOutput] = useState<Row>(result.output), saved = !!result.savedId;
  const [decisions, setDecisions] = useState<Row[]>(result.decisions ?? []);
  const decide = async (field: string, decision: string, value: string, targetRequestId?: string) => act(async () => {
    await api(`/ai/drafts/${result.savedId}/decisions`, { field, decision, ...(decision === 'accept' ? { value, ...(targetRequestId ? { targetRequestId } : {}) } : {}) });
    setDecisions(current => [...current.filter(item => item.field !== field), { field, decision, value }]);
  }, decision === 'accept' ? 'Proposal accepted' : 'Proposal rejected');
  const proposal = (field: string, label: string, value: string, quote?: string) => <AiProposal key={field} field={field} label={label} value={value} quote={quote} notice={result.purpose==='notice'} editable={writable} saved={saved} busy={busy} targets={targets} decision={decisions.find(item => item.field === field)} decide={decide} edit={value => setOutput(current => ({ ...current, [field === 'name' ? 'suggestedName' : field]: value }))} />;
  return <section aria-label="AI proposals">
    <h3>{saved ? 'Saved draft' : 'Unsaved proposals'}</h3>
    {result.provider && <p className="muted">Prepared by {result.provider} · {result.model}</p>}
    {!saved && <p className="muted">These proposals remain in this page until you explicitly save a draft.</p>}
    {result.review && <p>Proposed reading confidence: {Math.round(output.confidence*100)}%. Current firm threshold: {Math.round(result.review.threshold*100)}%. {result.review.needsReview?'Below threshold: needs manual review.':'At or above threshold: eligible for human review.'} This is an unverified model estimate; every proposal still needs a person.</p>}
    {result.noticeContext && <aside>
      <h3>Authorization check</h3>
      {!result.noticeContext.recordedAuthorizations.length ? <p>No recorded authorization is on file. Review the client's authority before any agency contact.</p>
        : <ul>{result.noticeContext.recordedAuthorizations.map((a:Row)=><li key={a.id}>Form {a.kind} · {a.agency}: {a.matters.map((m:Row)=>`Form ${m.form}, ${m.from}–${m.to}`).join('; ')}. Verify that the notice's form and year are covered.</li>)}</ul>}
      <p>{result.noticeContext.transcripts}. Authorization records stay in Blotter; they were not sent to the AI provider.</p>
    </aside>}
    <div className="grid">
      <div>
        <h3>Source</h3>
        {result.source?.href && <p><a href={result.source.href}>{result.source.label}</a></p>}
        {result.source?.expected && <p>Compare with {result.source.expected.client} · job period {result.source.expected.period}{result.source.expected.request && ` · requested ${result.source.expected.request}`}. Check every proposed type, client, period and legibility finding against this source.</p>}
        <pre aria-label="Original source text" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{result.source?.text ?? 'Source text is unavailable.'}</pre>
      </div>
      <div>
        <h3>Proposals for review</h3>
        {result.output.summary && proposal('summary', 'Summary', output.summary)}
        {result.output.reply && (saved ? <AiReplyReview draftId={result.savedId} value={output.reply} writable={writable} busy={busy} act={act} legacyDecision={decisions.find(item => item.field === 'reply')} /> : proposal('reply', 'Reply draft', output.reply))}
        {(output.conflicts ?? []).length > 0 && <><h3>Unresolved conflicts</h3><ul>{output.conflicts.map((text: string, index: number) => <li key={index}>{text}</li>)}</ul></>}
        {(output.questions ?? []).map((text: string, index: number) => proposal(`question:${index}`, 'Client question', text))}
        {(output.validation ?? []).map((text: string, index: number) => proposal(`validation:${index}`, 'Document validation', text))}
        {(output.extraction ?? []).map((item: Row, index: number) => proposal(`extraction:${index}`, item.field, item.value, item.quote))}
        {result.output.suggestedName && proposal('name', 'Proposed filename for a copy', output.suggestedName)}
        {output.routing && proposal('routing', 'Proposed routing', output.routing)}
        {(output.plan ?? []).map((text: string, index: number) => proposal(`plan:${index}`, 'Response plan step', text))}
        {!saved && writable && <button disabled={busy} onClick={() => act(async () => {
          const response = await api(`/ai/requests/${result.requestId}/draft`, { output });
          const draft = response.draft ?? response;
          changed({ ...result, ...draft, output: draft.output ?? output, savedId: draft.id });
        }, 'Draft saved')}>Save draft</button>}
        {saved && <p className="muted">Accept or reject each proposal. Accepting text records your review; it does not send a reply. Copies keep the original client and visibility.</p>}
      </div>
    </div>
  </section>;
}

function AiReplyReview({ draftId, value, writable, busy, act, legacyDecision }: { draftId: string; value: string; writable: boolean; busy: boolean; act: Act; legacyDecision?: Row }) {
  const [state, setState] = useState<Row>(), [wording, setWording] = useState(value), [error, setError] = useState('');
  const [recipients, setRecipients] = useState<string[]>([]), [attachments, setAttachments] = useState<string[]>([]), [confirmed, setConfirmed] = useState(false);
  useEffect(() => {
    let active = true;
    api(`/ai/drafts/${draftId}/reply-review`).then(data => { if (active) setState(data); }).catch(error => { if (active) setError(error.message); });
    return () => { active = false; };
  }, [draftId]);
  const review = state?.review;
  const toggle = (id: string, selected: string[], changed: (values: string[]) => void) => { changed(selected.includes(id) ? selected.filter(value => value !== id) : [...selected, id]); setConfirmed(false); };
  const decide = (decision: string) => act(async () => {
    const bytes = new TextEncoder().encode(wording.trim()), hash = await crypto.subtle.digest('SHA-256', bytes);
    const textSha256 = Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
    const selectedContacts = decision === 'accept' ? state!.recipients.filter((c: Row) => recipients.includes(c.id)).map((c: Row) => ({ id: c.id, revision: c.revision })) : [];
    const selectedFiles = decision === 'accept' ? state!.attachments.filter((f: Row) => attachments.includes(f.id)).map((f: Row) => ({ id: f.id, sha256: f.sha256, accessRevision: f.accessRevision })) : [];
    const result = await api(`/ai/drafts/${draftId}/reply-review`, { decision, value: wording, textSha256, sourceFingerprint: state!.sourceFingerprint, recipients: selectedContacts, attachments: selectedFiles });
    setState(current => ({ ...current, review: result.review }));
  }, decision === 'accept' ? 'Reply review recorded; nothing sent' : 'Reply rejected; nothing sent');
  return <fieldset disabled={busy}>
    <legend>Review reply recipients and attachments</legend>
    <p>This records your review only. Nothing is sent, shared or granted, and this record cannot authorize sending later.</p>
    <Field label="Reply draft" name="reviewedReply"><textarea rows={4} maxLength={1200} value={review?.value ?? wording} readOnly={!writable || !!review || !!legacyDecision} onChange={event => { setWording(event.target.value); setConfirmed(false); }} /></Field>
    {error && <p role="alert">{error}</p>}
    {!state && !error && <p>Loading review choices…</p>}
    {review ? <>
      <p>{review.decision === 'accept' ? 'Accepted' : 'Rejected'}</p>
      <p>Recorded by {review.reviewed_by} at {review.reviewed_at}.{review.historical && ' Restored historical evidence; replay is unavailable.'}</p>
      <p>Reviewed wording digest: <span style={{ overflowWrap: 'anywhere' }}>{review.text_sha256}</span></p>
      <p>Source fingerprint: <span style={{ overflowWrap: 'anywhere' }}>{review.source_fingerprint}</span></p>
      <ul>{review.recipients.map((c: Row) => <li key={c.id}>Recipient: {state.recipients.find((item: Row) => item.id === c.id)?.name ?? c.id} · revision {c.revision}</li>)}</ul>
      <ul>{review.attachments.map((f: Row) => <li key={f.id} style={{ overflowWrap: 'anywhere' }}>Attachment: {state.attachments.find((item: Row) => item.id === f.id)?.name ?? f.id} · original digest {f.sha256}</li>)}</ul>
    </> : legacyDecision ? <p>Earlier text-only decision: {legacyDecision.decision}. Prepare a fresh draft to review exact recipients and attachments.</p> : state && writable && <>
      {!state.sourceFingerprint ? <p>This older draft has no source fingerprint. Prepare and save a fresh draft before reviewing recipients.</p> : <>
        <fieldset><legend>Intended recipients</legend>
          {!state.recipients.length && <p>No current consented contacts are available.</p>}
          {state.recipients.map((c: Row) => <label className="check" key={c.id}><input type="checkbox" checked={recipients.includes(c.id)} onChange={() => toggle(c.id, recipients, setRecipients)} /> {c.name} · {c.email}</label>)}
        </fieldset>
        <fieldset><legend>Original attachments</legend>
          <p>Only originals with existing explicit contact access appear. Each intended recipient must already have access to every selected file.</p>
          {!state.attachments.length && <p>No eligible attachments. You may review a reply without attachments.</p>}
          {state.attachments.map((f: Row) => <label className="check" key={f.id} style={{ overflowWrap: 'anywhere' }}><input type="checkbox" checked={attachments.includes(f.id)} onChange={() => toggle(f.id, attachments, setAttachments)} /> {f.name} · {f.sha256}</label>)}
        </fieldset>
        <label className="check"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} /> I reviewed this exact wording, intended recipients and selected original attachments.</label>
        <div className="actions"><button className="quiet" disabled={!confirmed || !recipients.length || !wording.trim()} onClick={() => decide('accept')}>Accept reply draft</button><button className="quiet" disabled={!wording.trim()} onClick={() => decide('reject')}>Reject reply draft</button></div>
      </>}
    </>}
  </fieldset>;
}

function AiProposal({ field, label, value, quote, notice, editable, saved, busy, targets, decision, decide, edit }: {
  field: string; label: string; value: string; quote?: string; notice: boolean; editable: boolean; saved: boolean; busy: boolean; targets: Row[]; decision?: Row;
  decide: (field: string, decision: string, value: string, target?: string) => Promise<void>; edit: (value: string) => void;
}) {
  const [target, setTarget] = useState('');
  const canEdit = editable && !decision && ['summary', 'reply', 'name'].includes(field);
  return <div>
    {['summary', 'reply'].includes(field) ? <Field label={label} name={field}><textarea rows={4} maxLength={field === 'summary' ? 800 : 1200} value={decision?.decision === 'accept' ? decision.value ?? value : value} readOnly={!canEdit} disabled={busy} onChange={event => edit(event.target.value)} /></Field>
      : field === 'name' ? <Field label={label} name="aiFilename"><input value={decision?.decision === 'accept' ? decision.value ?? value : value} maxLength={160} readOnly={!canEdit} disabled={busy} onChange={event => edit(event.target.value)} /></Field>
      : <p><strong>{label}</strong>: {value}</p>}
    {quote && <blockquote>{quote}</blockquote>}
    {field.startsWith('extraction:') && (notice || /amount|deadline|due|date/i.test(label)) && <p className="muted">Proposed — verify against the notice</p>}
    {decision ? <p className="muted">{decision.decision === 'accept' ? 'Accepted' : 'Rejected'}</p> : saved && editable && <>
      {field === 'routing' && <><p className="muted">Accepting routing creates an internal copy in the selected request. Accept the filename proposal first to use that name for the copy. The original stays unchanged.</p><Field label="Destination request on this job" name="aiTarget"><select value={target} disabled={busy} onChange={event => setTarget(event.target.value)}><option value="">Choose a destination</option>{targets.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></Field></>}
      <div className="actions"><button className="quiet" disabled={busy || (field === 'routing' && !target) || !value.trim()} onClick={() => decide(field, 'accept', value, target || undefined)}>{field === 'routing' ? 'Accept routing and create copy' : `Accept ${label.toLowerCase()}`}</button><button className="quiet" disabled={busy} onClick={() => decide(field, 'reject', value)}>Reject</button></div>
    </>}
  </div>;
}
