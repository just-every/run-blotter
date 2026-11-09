import { useEffect, useRef, useState } from 'react';
import type { AuditRow } from '../modules/agent-door/audit';
import { classIds } from '../modules/agent-door/policy/catalogue';
import { activityRead, activityRows, type ActivityAgent, type ActivityFilter } from './agent-activity-pages';
import { PageHead } from './common';

const style = `
.agent-activity{max-width:1120px;margin:auto;padding:32px 24px 64px;min-width:0;font-size:15px}
.agent-activity .page-head{margin:24px 0}.agent-activity h1{font-size:clamp(32px,5vw,56px)}
.agent-activity .activity-filters{display:flex;flex-wrap:wrap;align-items:end;gap:16px;margin:24px 0}
.agent-activity .field{flex:1;min-width:0}.agent-activity select{width:100%;min-width:0;font-size:15px}
.agent-activity .activity-list{list-style:none;padding:0;display:grid;gap:12px}
.agent-activity .activity-row{border:1px solid var(--bl-line,#d6d1e3);border-radius:12px;padding:16px;min-width:0;overflow-wrap:anywhere}
.agent-activity h2{font-size:17px;margin:0 0 8px}.agent-activity p{margin:8px 0}
.agent-activity .activity-meta{display:flex;flex-wrap:wrap;gap:8px 20px}
.agent-activity summary{font-size:15px;margin-top:12px}
.agent-activity pre{white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-word;font:14px/1.6 var(--bl-font-mono,monospace);max-width:100%}
.agent-activity .activity-empty{border:1px solid var(--bl-line,#d6d1e3);border-radius:12px;padding:24px;background:var(--bl-lilac-pale,#f6f2fc)}
@media(max-width:600px){.agent-activity{padding:24px 16px 48px}.agent-activity .activity-filters{display:grid;grid-template-columns:minmax(0,1fr)}.agent-activity .activity-filters button{width:100%}}
`;

export function AgentActivity() {
 const [agents, setAgents] = useState<ActivityAgent[]>([]), [rows, setRows] = useState<AuditRow[]>([]);
 const [filter, setFilter] = useState<ActivityFilter>({ agent: '', class: '' });
 const [busy, setBusy] = useState(true), [exporting, setExporting] = useState(false);
 const [error, setError] = useState(''), [notice, setNotice] = useState(''), [reload, setReload] = useState(0);
 const exportingRequest = useRef<AbortController | null>(null);
 useEffect(() => {
  const controller = new AbortController();
  exportingRequest.current?.abort();
  setRows([]); setAgents([]); setError(''); setNotice(''); setBusy(true);
  (async () => {
   const people = await activityRead<{ agents: ActivityAgent[] }>('/agents/api/agents', controller.signal);
   const matching = await activityRows(filter, controller.signal);
   if (!controller.signal.aborted) { setAgents(people.agents); setRows(matching); }
  })().catch(reason => { if (!controller.signal.aborted) setError((reason as Error).message); })
   .finally(() => { if (!controller.signal.aborted) setBusy(false); });
  return () => { controller.abort(); exportingRequest.current?.abort(); };
 }, [filter, reload]);
 const exportRows = async () => {
  const controller = new AbortController(); exportingRequest.current = controller;
  setExporting(true); setError(''); setNotice('');
  try {
   const matching = await activityRows(filter, controller.signal);
   controller.signal.throwIfAborted();
   const url = URL.createObjectURL(new Blob([JSON.stringify(matching, null, 2) + '\n'], { type: 'application/json' }));
   const link = Object.assign(document.createElement('a'), { href: url, download: 'agent-activity.json' });
   link.click(); setTimeout(() => URL.revokeObjectURL(url), 10_000);
   setRows(matching); setNotice(`Downloaded ${matching.length} matching actions.`);
  } catch (reason) {
   if (!controller.signal.aborted) { setRows([]); setAgents([]); setError((reason as Error).message + ' No file was downloaded.'); }
  } finally { if (exportingRequest.current === controller) { exportingRequest.current = null; setExporting(false); } }
 };
 return <main className="agent-activity">
  <style>{style}</style><a href="/app">Back to workspace</a>
  <PageHead eyebrow="Shared agent door" title="Agent activity" />
  <p>Inspect recorded actions with your current Business policy access. Agent names are retained with each action. Approval and review attribution is current when loaded.</p>
  <p>Downloads contain all matching authorized audit fields. Private decision evidence and saved results are not included.</p>
  <div className="activity-filters">
   <div className="field"><label htmlFor="activity-agent">Agent</label><select id="activity-agent" value={filter.agent} disabled={busy || exporting || !!error} onChange={e => setFilter({ ...filter, agent: e.target.value })}>
    <option value="">All agents</option>{agents.map(agent => <option key={agent.id} value={agent.id}>{agent.name} for {agent.sponsor.name}{agent.revoked ? ' (revoked)' : ''}</option>)}
   </select></div>
   <div className="field"><label htmlFor="activity-class">Class</label><select id="activity-class" value={filter.class} disabled={busy || exporting || !!error} onChange={e => setFilter({ ...filter, class: e.target.value })}>
    <option value="">All classes</option>{classIds.map(id => <option key={id} value={id}>{id}</option>)}
   </select></div>
   <button type="button" disabled={busy || exporting} onClick={() => setReload(value => value + 1)}>Refresh activity</button>
   <button type="button" disabled={busy || exporting || !!error} onClick={exportRows}>{exporting ? 'Preparing download…' : 'Download matching JSON'}</button>
  </div>
  {error && <p role="alert" className="error">{error} <a href="/signin">Open sign in</a></p>}
  <p role="status" aria-live="polite">{busy ? 'Loading matching actions…' : error ? '' : notice || `${rows.length} matching actions`}</p>
  <section aria-label="Matching actions" aria-busy={busy || exporting}>
   {!busy && !error && !rows.length && <p className="activity-empty">No matching actions. Try another agent or class.</p>}
   <ol className="activity-list">{rows.map(row => <li key={row.sequence ?? row.id} className="activity-row" data-audit-id={row.id}>
    <h2>{row.label}</h2><div className="activity-meta"><span>Sequence {row.sequence}</span><time dateTime={row.at}>{row.at}</time><span>{row.door}</span></div>
    <p>{row.tool}</p><p>Classes: {row.classes.map(item => item.class).join(', ') || 'None recorded'} · Decision: {row.decision} · Outcome: {row.outcome}</p>
    {row.approval && <p>Approval {row.approval.id}: {row.approval.by.join(', ') || 'No approver recorded'}</p>}
    {row.review && <p>Review {row.review.id}: {row.review.by || 'Not marked reviewed'}</p>}
    <details><summary>All audit fields for sequence {row.sequence}</summary><pre tabIndex={0} role="region" aria-label={`Audit fields for sequence ${row.sequence}`} data-audit-fields>{JSON.stringify(row, null, 2)}</pre></details>
   </li>)}</ol>
  </section>
 </main>;
}
