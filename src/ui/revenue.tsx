import { useEffect, useState } from 'react';
import { api, Blotter, Empty, Field, Form, MessageText, money, Status, when, type Row, type Run } from './common';

type Citation = { label: string; href: string };
type Exception = {
  id: string; kind: 'amendment' | 'duplicate' | 'collection'; summary: string;
  amountCents: number; currency: string; ownerEmail: string; nextAction: string;
  citations: Citation[]; draftText: string; canPrepare: boolean; paymentId?: string; canReconcile?: boolean;
};
type Proposal = {
  id: string; kind: string; status: string;
  payload: { summary: string; draftText: string; citations: Citation[] };
  decision_note?: string; decided_by?: string; decided_at?: string;
};
type RevenueMap = {
  fingerprint: string; clientId: string; planId: string;
  scope: {
    source: { id: string; href: string; label: string; sha256: string };
    services: { scope: { quote: string; href: string }; template: { id: string; name: string } }[];
  };
  exceptions: Exception[];
  totals: { unbilledCents: number; providerNetCents: number; openCents: number; creditCents: number; writtenOffCents: number; currency?: string };
  proposals: Proposal[];
};
type RevenueState = {
  clients: { id: string; name: string }[];
  plans: { id: string; client_id: string; source_id: string; source_title: string; status: string; decided_at: string }[];
  map?: RevenueMap;
};

const kindLabel = (kind: string) => kind === 'amendment' ? 'Scope amendment' : kind === 'duplicate' ? 'Possible duplicate' : 'Collection';

function EvidenceLinks({ citations }: { citations: Citation[] }) {
  return citations.length > 0 && <ul className="list" aria-label="Evidence">{citations.map((citation, index) => <li key={`${citation.href}:${index}`}><a href={citation.href}>{citation.label}</a></li>)}</ul>;
}

function RevenueException({ item, map, run }: { item: Exception; map: RevenueMap; run: Run }) {
  return <article className="record">
    <div className="split"><h3>{kindLabel(item.kind)}</h3><strong>{money(item.amountCents, item.currency)}</strong></div>
    <p>{item.summary}</p>
    <p className="muted">Owner: {item.ownerEmail || 'Unassigned'}<br />Next action: {item.nextAction}</p>
    <EvidenceLinks citations={item.citations} />
    {item.kind !== 'collection' && item.draftText && <details><summary>Read proposed draft</summary><MessageText>{item.draftText}</MessageText></details>}
    {item.kind === 'collection' ? item.paymentId && item.canReconcile ? <button onClick={() => run(() => api(`/payments/${encodeURIComponent(item.paymentId!)}/reconcile`, {}), 'Provider payment reconciled')}>Reconcile provider</button> : <p className="muted">No provider payment is available to reconcile.</p>
      : item.canPrepare && <button onClick={() => run(() => api('/revenue/proposals', {
        clientId: map.clientId, planId: map.planId, fingerprint: map.fingerprint, exceptionId: item.id,
      }), 'Revenue draft prepared for principal review')}>Prepare draft</button>}
  </article>;
}

function RevenueProposal({ proposal, run }: { proposal: Proposal; run: Run }) {
  const duplicate = proposal.kind === 'duplicate';
  return <article className="record">
    <div className="split"><h3>{kindLabel(proposal.kind)} draft</h3><Status value={proposal.status} /></div>
    <p>{proposal.payload.summary}</p>
    {proposal.payload.draftText && <MessageText>{proposal.payload.draftText}</MessageText>}
    <EvidenceLinks citations={proposal.payload.citations} />
    {proposal.decided_by && <p className="muted">{proposal.decided_by} · {when(proposal.decided_at)}{proposal.decision_note && <> · {proposal.decision_note}</>}</p>}
    {proposal.status === 'pending' && <>
      <p className="muted">{duplicate ? 'Approving voids the duplicate draft only.' : 'Approving records the reviewed amendment draft. Signed scope and billing stay as recorded.'}</p>
      <div className="row">
        <details><summary>Approve draft</summary><Form label={duplicate ? 'Approve and void duplicate draft' : 'Approve reviewed draft'} submit={data => run(() => api(`/revenue/proposals/${encodeURIComponent(proposal.id)}/decide`, { decision: 'approve', reason: data.reason }), duplicate ? 'Duplicate draft voided' : 'Amendment draft review recorded')}>
          <Field label="Approval reason" name="reason" />
        </Form></details>
        <details><summary>Decline draft</summary><Form danger label="Decline draft" submit={data => run(() => api(`/revenue/proposals/${encodeURIComponent(proposal.id)}/decide`, { decision: 'decline', reason: data.reason }), 'Revenue draft declined')}>
          <Field label="Decline reason" name="reason" />
        </Form></details>
      </div>
    </>}
  </article>;
}

/** Principal review ties each revenue exception to a deliberately selected signed scope. */
export function RevenueReview({ actor, run, tick }: { actor: Row; run: Run; tick: number }) {
  const [data, setData] = useState<RevenueState>(), [clientId, setClientId] = useState(''), [planId, setPlanId] = useState('');
  const [loading, setLoading] = useState(true), [failed, setFailed] = useState(false), [refresh, setRefresh] = useState(0);
  useEffect(() => {
    if (actor.role !== 'owner') return;
    let current = true;
    setLoading(true); setFailed(false);
    const query = clientId && planId ? `?${new URLSearchParams({ clientId, planId })}` : '';
    api(`/revenue${query}`).then((result: RevenueState) => { if (current) { setData(result); setLoading(false); } }).catch(error => {
      if (current) { setLoading(false); setFailed(true); void run(async () => { throw error; }); }
    });
    return () => { current = false; };
  }, [actor.role, clientId, planId, tick, refresh]);
  if (actor.role !== 'owner') return null;
  const plans = data?.plans.filter(plan => plan.client_id === clientId && plan.status === 'reviewed') ?? [];
  const map = !loading && !failed && data?.map?.clientId === clientId && data.map.planId === planId ? data.map : undefined;
  return <Blotter><section className="panel" aria-label="Revenue review" aria-busy={loading}>
    <div className="split"><div><h2>Revenue review</h2><p className="muted">Review signed scope, unbilled work and payment exceptions with their source evidence.</p></div><span className="status">Principal only</span></div>
    <p className="muted">Approval records review; signing, sending and collection require their own explicit authority.</p>
    <div className="row">
      <Field label="Revenue client" name="revenueClient"><select name="revenueClient" value={clientId} disabled={loading || !data?.clients.length} onChange={event => { setClientId(event.target.value); setPlanId(''); }}>
        <option value="">Choose a client</option>{data?.clients.map(client => <option key={client.id} value={client.id}>{client.name}</option>)}
      </select></Field>
      <Field label="Signed scope review" name="revenuePlan"><select name="revenuePlan" value={planId} disabled={loading || !clientId || !plans.length} onChange={event => setPlanId(event.target.value)}>
        <option value="">Choose a signed scope review</option>{plans.map(plan => <option key={plan.id} value={plan.id}>{plan.source_title} · {when(plan.decided_at)}</option>)}
      </select></Field>
    </div>
    {loading ? <p role="status">Opening revenue review…</p> : failed ? <div className="error"><p>Revenue review could not be loaded.</p><button className="quiet" onClick={() => setRefresh(value => value + 1)}>Reload revenue review</button></div>
      : !data?.clients.length ? <Empty>No clients are available for revenue review.</Empty>
      : !clientId ? <Empty>Choose a client and a signed scope review to inspect revenue.</Empty>
      : !plans.length ? <Empty>This client has no signed scope reviews. Review signed scope in Intake first.</Empty>
      : !planId ? <Empty>Choose the signed scope review to use as evidence.</Empty>
      : !map ? <p className="error" role="alert">The selected signed scope review has no revenue map. Reload revenue review to inspect current evidence.</p>
      : <div className="stack">
        <section className="review">
          <h3>Signed scope evidence</h3>
          <p className="file"><a href={map.scope.source.href}>{map.scope.source.label}</a></p>
          <details><summary>Source integrity</summary><p className="file">SHA-256: <code>{map.scope.source.sha256}</code></p></details>
          {!map.scope.services.length ? <Empty>No services were mapped in this scope review.</Empty> : map.scope.services.map((service, index) => <article className="record" key={`${service.template.id}:${index}`}>
            <strong>{service.template.name}</strong><blockquote>{service.scope.quote}</blockquote><a href={service.scope.href}>Read signed scope evidence for {service.template.name}</a>
          </article>)}
        </section>
        <section className="review">
          <h3>Revenue position</h3>
          <table className="table"><thead><tr><th>Position</th><th className="amount">Amount</th></tr></thead><tbody>
            {([['Unbilled work', map.totals.unbilledCents], ['Provider net', map.totals.providerNetCents], ['Open balance', map.totals.openCents], ['Credits', map.totals.creditCents], ['Written off', map.totals.writtenOffCents]] as const).map(([label, cents]) => <tr key={label}><td data-label="Position">{label}</td><td className="amount" data-label="Amount">{money(cents, map.totals.currency ?? 'USD')}</td></tr>)}
          </tbody></table>
        </section>
        <section className="review"><h3>Exceptions to review</h3>{!map.exceptions.length ? <Empty>No revenue exceptions were found for this signed scope review.</Empty> : map.exceptions.map(item => <RevenueException key={item.id} item={item} map={map} run={run} />)}</section>
        <section className="review"><h3>Prepared drafts and decisions</h3>{!map.proposals.length ? <Empty>No revenue drafts have been prepared for this signed scope review.</Empty> : map.proposals.map(proposal => <RevenueProposal key={proposal.id} proposal={proposal} run={run} />)}</section>
      </div>}
  </section></Blotter>;
}
