import { Invoices } from './invoices';
import { Reports } from './reports';
import { useEffect, useState } from 'react';
import { api, day, PageHead, type Row, type Run } from './common';
import { Inbox } from './inbox';
import { Jobs } from './jobs';
import { Clients } from './clients';
import { Billing } from './billing';
import { Proposals } from './proposals';
import { MoveIn } from './move-in';
import { Team } from './team';
import { Capacity } from './capacity';
import { MfaGate } from './security';
import { Search } from './search';
import { Account } from './account';

const TABS = ['Inbox', 'Jobs', 'Capacity', 'Clients & templates', 'Time & billing', 'Preparations', 'Move in', 'Team & safety'] as const;
export type Tab = typeof TABS[number];
const visible = (role: string): Tab[] => role === 'owner' ? [...TABS] : role === 'reviewer' ? TABS.filter(t => t !== 'Move in') : ['Inbox', 'Jobs', 'Capacity', 'Preparations', 'Team & safety'];

/** Each screen's tracked eyebrow, from what the workspace already holds. */
function eyebrow(tab: Tab, state: Row) {
  const jobs: Row[] = state.jobs, open = jobs.filter(j => j.status === 'open').length, review = jobs.filter(j => j.status === 'review').length;
  const pending = (state.proposals as Row[]).filter(p => p.status === 'pending').length;
  const parts: Record<Tab, string[]> = {
    'Inbox': [],
    'Jobs': [`${open} open`, `${review} in review`],
    'Capacity': ['hours, leave and demand'],
    'Clients & templates': [`${state.clients.length} ${state.clients.length === 1 ? 'client' : 'clients'}`, `${state.templates.length} ${state.templates.length === 1 ? 'template' : 'templates'}`],
    'Time & billing': ['time, expenses and exports'],
    'Preparations': [`${pending} waiting for you`],
    'Move in': ['bring your client list'],
    'Team & safety': [state.actor.role === 'owner' ? 'people, rates, keys and archive' : 'your rate and sign-in'],
  };
  return [tab, ...parts[tab], day(new Date().toISOString())].join(' · ');
}

export function Workspace() {
  const [state, setState] = useState<Row>(), [tab, setTab] = useState<Tab>('Inbox'), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false), [tick, setTick] = useState(0), [jobId, setJobId] = useState(''), [gate, setGate] = useState<'enroll' | 'verify'>();
  // A session that still owes a second factor (ACCESS-004) sees only the factor screen.
  const owed = (e: unknown) => { const need = (e as { mfa?: 'enroll' | 'verify' }).mfa; if (need==='enroll'||need==='verify') setGate(need); return need==='enroll'||need==='verify'; };
  const reload = async () => { setState(await api('/state')); setTick(t => t + 1); };
  useEffect(() => { const destination=new URLSearchParams(window.location.search); if(destination.has('report'))setTab('Time & billing'); if(destination.has('job')||destination.has('notice')){setTab('Jobs');setJobId(destination.get('job')??'');} reload().catch(e => owed(e) || setError(e.message)); }, []);
  const run: Run = async (job, message = 'Saved') => {
    setError(''); setNotice(''); setBusy(true);
    try { const result = await job(); await reload(); setNotice(typeof result === 'string' ? result : message); } catch (e) { if (!owed(e)) setError((e as Error).message); } finally { setBusy(false); }
  };
  const actor = state?.actor;
  const go = (t: Tab) => { setTab(t); setNotice(''); setError(''); if (t === 'Jobs') setJobId(''); };
  const open = (id: string) => { setJobId(id); setTab('Jobs'); setNotice(''); setError(''); };
  return <div className="workspace" aria-busy={busy}>
    <header className="topbar">
      <a className="brand" href="/app"><img src="/brand/mark-32.svg" alt="" width="30" height="30" /><span data-rer-name>Blotter</span></a>
      <nav aria-label="Workspace" className="tabs">
        {(actor && !gate ? (actor.readOnly || actor.accessScoped ? ['Inbox','Jobs',...(actor.financial&&!actor.readOnly?['Time & billing']:[]),'Team & safety'] as Tab[] : visible(actor.role)) : []).map(t => <button key={t} className={t === tab ? 'selected' : ''} aria-current={t === tab ? 'page' : undefined} onClick={() => go(t)}>{t}</button>)}
      </nav>
      {state && !gate && <Search state={state} run={run} open={open} />}
      {actor && <Account actor={actor} />}
    </header>
    <main className={`screen screen-${tab === 'Inbox' ? 'inbox' : 'page'}`}>
      <div id="search-slot" />
      {error && <p className="error" role="alert">{error}{/Sign in/.test(error) && <> <a href="/signin">Open sign in</a></>}</p>}
      {actor?.readOnly && <p className="notice">Read-only access. You can inspect granted client work; changes require a working role.</p>}
      {notice && <p className="notice" role="status">{notice}</p>}
      {gate ? <MfaGate need={gate} done={() => { setGate(undefined); reload().catch(e => owed(e) || setError(e.message)); }} />
        : !state ? (!error && <p className="opening">Opening your workspace…</p>) : <fieldset disabled={busy} className="content">
        {tab === 'Inbox' ? <Inbox state={state} run={run} open={open} go={go} tick={tick} /> : <PageHead eyebrow={eyebrow(tab, state)} title={tab} />}
        {tab === 'Jobs' && <Jobs state={state} jobId={jobId} open={setJobId} run={run} tick={tick} />}
        {tab === 'Capacity' && <Capacity state={state} run={run} tick={tick} open={open} />}
        {tab === 'Clients & templates' && <Clients state={state} run={run} open={open} tick={tick} />}
        {tab === 'Time & billing' && <><Invoices actor={state.actor} jobs={state.jobs} clients={state.clients} run={run} tick={tick}/><Reports state={state} run={run} tick={tick} open={open}/><Billing actor={state.actor} people={state.people} run={run} tick={tick} /></>}
        {tab === 'Preparations' && <Proposals state={state} run={run} open={open} tick={tick} />}
        {tab === 'Move in' && <MoveIn run={run} tick={tick} />}
        {tab === 'Team & safety' && <Team state={state} run={run} tick={tick} />}
      </fieldset>}
      <p className="boundary">Time and fees in their stored currency, USD by default. No filing, tax calculation or advice.</p>
    </main>
  </div>;
}
