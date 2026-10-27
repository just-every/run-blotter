import { useEffect, useState } from 'react';
import { api, Field, Form, Status, when, type Row } from './common';

/** Review and observations only; all authority stays at the existing server doors. */
export function Onboarding({ clientId, state }: { clientId: string; state: Row }) {
  const [opened, setOpened] = useState(false), [context, setContext] = useState<Row>();
  const [draft, setDraft] = useState<Row>(), [preview, setPreview] = useState<Row>(), [plan, setPlan] = useState<Row>();
  const [selected, setSelected] = useState<string[]>([]), [services, setServices] = useState(['tax', 'bookkeeping']);
  const [failure, setFailure] = useState(''), [busy, setBusy] = useState(false);
  const path = `/clients/${clientId}/onboarding`;
  const load = async () => setContext(await api(path + '/plans'));
  const act = async (work: () => Promise<void>) => {
    setBusy(true); setFailure('');
    try { await work(); } catch (error) {
      setFailure((error as Error).message); setPreview(undefined); setPlan(undefined);
    } finally { setBusy(false); }
  };
  useEffect(() => { if (opened) void act(load); }, [opened, clientId]);
  const openPlan = (id: string) => act(async () => { setPreview(undefined); setPlan(undefined); setPlan(await api(path + '/plans/' + id)); });
  return <details onToggle={event => { if (event.target === event.currentTarget) setOpened(event.currentTarget.open); }}>
    <summary>Onboarding scope review</summary>
    {opened && <section aria-label="Onboarding scope review" style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
      <h2>Review onboarding</h2>
      <p>Map the signed scope, choose setup items and record observations. This review sends nothing and cannot connect accounts, start work or change fees or signatures.</p>
      {failure && <p role="alert">{failure}</p>}
      {context && <>
        {context.plans.length > 0 && <div><h3>Retained reviews</h3><ul className="list">{context.plans.map((record: Row) => <li key={record.id}><button className="quiet" disabled={busy} onClick={() => openPlan(record.id)}>Open review {record.id.slice(0, 8)}</button> · <Status value={record.status} /> · {record.decided_by} · {when(record.decided_at)}</li>)}</ul></div>}
        <details><summary>Map a signed source</summary>
          {context.sources.length === 0 ? <p>No available signed source. Complete a document signature or record a signed letter first.</p> : <div onChange={() => { setPreview(undefined); setPlan(undefined); }}>
            <Form label="Preview setup items" disabled={busy} submit={data => act(async () => {
              const source = context.sources.find((value: Row) => value.kind + ':' + value.id === data.source);
              const body = { source: { kind: source.kind, id: source.id }, services: services.map((kind, index) => ({ kind, quote: data['quote' + index], templateId: data['template' + index], authorization: data['authorization' + index], ledger: data['ledger' + index] })) };
              const result = await api(path + '/preview', body); setDraft(body); setPreview(result); setSelected(result.items.map((item: Row) => item.id));
            })}>
              <Field label="Signed scope source" name="source"><select name="source" required><option value="">Choose a signed document</option>{context.sources.map((source: Row) => <option key={source.kind + source.id} value={source.kind + ':' + source.id}>{source.title} — {source.label}</option>)}</select></Field>
              {services.map((kind, index) => <fieldset key={index}><legend>Service {index + 1}</legend>
                <Field label={`Service ${index + 1} kind`} name={'kind' + index}><select value={kind} onChange={event => setServices(services.map((value, at) => at === index ? event.target.value : value))}><option value="tax">Tax</option><option value="bookkeeping">Bookkeeping</option></select></Field>
                <Field label={`Service ${index + 1} exact signed quote`} name={'quote' + index} />
                <Field label={`Service ${index + 1} work template`} name={'template' + index}><select name={'template' + index} required><option value="">Choose a template</option>{state.templates.map((template: Row) => <option key={template.id} value={template.id}>{template.name} · {template.recurrence}</option>)}</select></Field>
                {kind === 'tax' ? <Field label={`Service ${index + 1} authorization`} name={'authorization' + index}><select name={'authorization' + index}><option value="8821">Form 8821</option><option value="2848">Form 2848</option></select></Field> : <Field label={`Service ${index + 1} ledger`} name={'ledger' + index}><select name={'ledger' + index}><option value="qbo">QBO</option><option value="xero">Xero</option></select></Field>}
                {services.length > 1 && <button type="button" className="quiet" onClick={() => { setServices(services.filter((_, at) => at !== index)); setPreview(undefined); }}>Remove service {index + 1}</button>}
              </fieldset>)}
              {services.length < 20 && <button type="button" className="quiet" onClick={() => { setServices([...services, 'tax']); setPreview(undefined); }}>Add another service</button>}
            </Form>
          </div>}
        </details>
      </>}
      {preview && <article aria-label="Proposed onboarding plan" className="record">
        <h3>Proposed setup</h3><p>{preview.coverage}</p><Scope source={preview.source} />
        <ul className="list">{preview.items.map((item: Row) => <li key={item.id}><label className="check"><input type="checkbox" checked={selected.includes(item.id)} onChange={event => setSelected(event.target.checked ? [...selected, item.id] : selected.filter(id => id !== item.id))} />{item.label}</label><Scope source={item.scope} />{item.connection && <p>{item.connection}</p>}</li>)}</ul>
        <Form label="Record selected items" disabled={busy || selected.length === 0} submit={data => act(async () => { const saved = await api(path + '/plans', { ...draft, fingerprint: preview.fingerprint, selectedItemIds: selected, reason: data.reason }); setPreview(undefined); setPlan(saved); await load(); })}><Field label="Review reason" name="reason" /></Form>
      </article>}
      {plan && <article className="record" aria-label="Retained onboarding plan">
        <h3>Recorded setup review</h3><p><Status value={plan.status} /> · {plan.decidedBy} · {when(plan.decidedAt)}</p><p>{plan.reason}</p><Scope source={plan.source} /><p>{plan.execution}</p>
        {plan.status === 'held' && <p role="status">Restored review is held. Observations and execution remain inactive.</p>}
        <ul className="list">{plan.items.map((item: Row) => <li key={item.id}><strong>{item.label}</strong> · {item.selected ? 'Selected' : 'Removed'}<Scope source={item.scope} />{item.connection && <p>{item.connection}</p>}{item.progress && <><Observation value={item.progress} />{item.progress.history.length > 0 && <details><summary>Earlier observations ({item.progress.history.length})</summary>{item.progress.history.map((value: Row, index: number) => <Observation key={index} value={value} />)}</details>}</>}</li>)}</ul>
        {plan.status === 'reviewed' && <Form key={plan.revision} label="Record observation" disabled={busy} submit={data => act(async () => setPlan(await api(path + '/plans/' + plan.id + '/progress', { ...data, revision: plan.revision, ownerEmail: state.actor.email })))}>
          <Field label="Setup item" name="itemId"><select name="itemId">{plan.items.filter((item: Row) => item.selected).map((item: Row) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></Field>
          <Field label="Observation state" name="state"><select name="state"><option value="blocked">Blocked</option><option value="pending">Pending</option><option value="received">Received (practitioner recorded)</option></select></Field>
          <p>Owner: {state.actor.email}. Provider connections and client responses are not independently verified.</p>
          <Field label="Observed evidence or blocker" name="note" /><Field label="Next action and due condition" name="nextAction" />
        </Form>}
      </article>}
    </section>}
  </details>;
}
function Scope({ source }: { source: Row }) {
  return <><p><a href={source.href}>Read signed scope</a>{source.quote && <> · “{source.quote}”</>}{source.label && <> · {source.label}</>}</p>{source.label && <details><summary>Signed source fingerprint</summary><code>{source.sha256}</code></details>}</>;
}
function Observation({ value }: { value: Row }) {
  return <div className="notice" style={{ borderLeftWidth: 1 }}><p><strong>{value.state}</strong> · {value.note}</p><p>Owner: {value.ownerEmail} · Recorded by {value.recordedBy} · {when(value.recordedAt)}</p><p>Next: {value.nextAction}</p><p>{value.verification}</p>{value.chaseDraft && <details><summary>Unsent chase draft</summary><p>{value.chaseDraft}</p></details>}</div>;
}
