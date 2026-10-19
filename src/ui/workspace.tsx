import { useEffect, useState } from 'react';
import { api, type Row, type Run } from './common';
import { Jobs } from './jobs';
import { Clients } from './clients';
import { Billing } from './billing';
import { Proposals } from './proposals';
import { MoveIn } from './move-in';
import { Team } from './team';
import { Capacity } from './capacity';
import { MfaGate } from './security';

const TABS = ['Jobs', 'Capacity', 'Clients & templates', 'Time & billing', 'Preparations', 'Move in', 'Team & safety'] as const;
type Tab = typeof TABS[number];
const visible = (role: string): Tab[] => role === 'owner' ? [...TABS] : role === 'reviewer' ? TABS.filter(t => t !== 'Move in') : ['Jobs', 'Capacity', 'Preparations', 'Team & safety'];

export function Workspace() {
  const [state, setState] = useState<Row>(), [tab, setTab] = useState<Tab>('Jobs'), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false), [tick, setTick] = useState(0), [jobId, setJobId] = useState(''), [gate, setGate] = useState<'enroll' | 'verify'>();
  // A session that still owes a second factor (ACCESS-004) sees only the factor screen.
  const owed = (e: unknown) => { const need = (e as { mfa?: 'enroll' | 'verify' }).mfa; if (need) setGate(need); return !!need; };
  const reload = async () => { setState(await api('/state')); setTick(t => t + 1); };
  useEffect(() => { reload().catch(e => owed(e) || setError(e.message)); }, []);
  const run: Run = async (job, message = 'Saved') => {
    setError(''); setNotice(''); setBusy(true);
    try { await job(); await reload(); setNotice(message); } catch (e) { if (!owed(e)) setError((e as Error).message); } finally { setBusy(false); }
  };
  const actor = state?.actor;
  const open = (id: string) => { setJobId(id); setTab('Jobs'); setNotice(''); setError(''); };
  return <div className="workspace" aria-busy={busy}>
    <header className="topbar">
      <a className="brand" href="/app"><img src="/brand/mark.svg" alt="" width="28" height="28" /><span data-rer-name>Blotter</span></a>
      <span className="muted">Practice workflow</span>
      {actor ? <span className="badge">{actor.name} · {actor.role}</span> : null}
      <button className="quiet signout" onClick={async () => { await fetch('/auth/signout', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: '{}' }); location.href = '/signin'; }}>Sign out</button>
    </header>
    <div className="layout">
      <nav aria-label="Workspace">
        {(actor ? visible(actor.role) : []).map(t => <button key={t} className={t === tab ? 'selected' : ''} aria-current={t === tab ? 'page' : undefined} onClick={() => { setTab(t); setNotice(''); setError(''); if (t === 'Jobs') setJobId(''); }}>{t}</button>)}
        <p className="boundary">AUD time and fees for your own billing. No lodgement, tax calculation or advice.</p>
      </nav>
      <main>
        <h1>{tab}</h1>
        {error && <p className="error" role="alert">{error}{/Sign in/.test(error) && <> <a href="/signin">Open sign in</a></>}</p>}
        {notice && <p className="notice" role="status">{notice}</p>}
        {gate ? <MfaGate need={gate} done={() => { setGate(undefined); reload().catch(e => owed(e) || setError(e.message)); }} />
          : !state ? (!error && <p>Opening your workspace…</p>) : <fieldset disabled={busy} className="content">
          {tab === 'Jobs' && <Jobs state={state} jobId={jobId} open={setJobId} run={run} tick={tick} />}
          {tab === 'Capacity' && <Capacity state={state} run={run} tick={tick} open={open} />}
          {tab === 'Clients & templates' && <Clients state={state} run={run} open={open} tick={tick} />}
          {tab === 'Time & billing' && <Billing actor={state.actor} run={run} tick={tick} />}
          {tab === 'Preparations' && <Proposals state={state} run={run} open={open} />}
          {tab === 'Move in' && <MoveIn run={run} tick={tick} />}
          {tab === 'Team & safety' && <Team state={state} run={run} tick={tick} />}
        </fieldset>}
      </main>
    </div>
  </div>;
}
