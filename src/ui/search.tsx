import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { api, Empty, prose, type Row, type Run, ExportLink } from './common';
import { ClientHistory } from './history';

const TYPES = ['client', 'contact', 'job', 'task', 'portal message', 'note', 'document','invoice'];

/**
 * Firm-wide search (SEARCH-001): "/" focuses the box, arrow keys move through
 * the results and Enter opens the chosen one; filter by type. Only what the
 * signed-in person may read is returned, and tax ids show masked. The box sits in
 * the top bar; its results open at the head of the screen, above the page.
 */
export function Search({ state, run, open }: { state: Row; run: Run; open: (id: string) => void }) {
  const box = useRef<HTMLInputElement>(null), [q, setQ] = useState(''), [type, setType] = useState(''), [found, setFound] = useState<Row>(), [at, setAt] = useState(0), [client, setClient] = useState('');
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === '/' && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement)) { e.preventDefault(); box.current?.focus(); } };
    addEventListener('keydown', key); return () => removeEventListener('keydown', key);
  }, []);
  // The workspace disables its controls while a request runs, so focus returns to the box for the arrow keys and Enter.
  const find = (query: string, kind: string) => run(async () => { setClient(''); setAt(0); setFound(query.trim() ? await api('/search?' + new URLSearchParams({ q: query, ...(kind ? { type: kind } : {}) })) : undefined); }, 'Search done')
    .then(() => setTimeout(() => box.current?.focus()));
  const choose = (r: Row) => {
    if (r.open.kind === 'client' || (r.open.kind === 'thread' && !r.open.jobId)) setClient(r.clientId);
    else { open(r.open.jobId); setFound(undefined); }
  };
  const results: Row[] = found?.results ?? [];
  const close = () => { setFound(undefined); setClient(''); };
  return <div className="topsearch">
    <form role="search" onSubmit={e => { e.preventDefault(); find(q, type); }}>
      <label htmlFor="search-box" className="sr-only">Search everything (press /)</label>
      <button type="submit" className="search-go" aria-label="Search"><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="6" /><path d="M13 13l5 5" /></svg></button>
      <input id="search-box" ref={box} type="search" placeholder="Search clients, jobs…" value={q} onChange={e => setQ(e.target.value)} aria-controls="search-results"
        onKeyDown={e => { if (e.key === 'Escape') close(); if (!results.length) return; if (e.key === 'ArrowDown') { e.preventDefault(); setAt(n => Math.min(results.length - 1, n + 1)); } else if (e.key === 'ArrowUp') { e.preventDefault(); setAt(n => Math.max(0, n - 1)); } else if (e.key === 'Enter' && found?.q === q) { e.preventDefault(); choose(results[at]); } }} />
    </form>
    {(found || client) && document.getElementById('search-slot') && createPortal(<section className="panel search-results" aria-label="Search results panel">
      <div className="split">
        <div className="field"><label htmlFor="search-type">Type</label><select id="search-type" value={type} onChange={e => { setType(e.target.value); if (q.trim()) find(q, e.target.value); }}><option value="">Everything</option>{TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
        <button type="button" className="quiet" onClick={close}>Close</button>
      </div>
      {found && (!results.length ? <Empty>Nothing you can see matches “{found.q}”.</Empty> : <ul className="list" id="search-results" role="listbox" aria-label="Search results">{results.map((r, n) => <li key={r.type + r.id} role="option" aria-selected={n === at}>
        <button className={`quiet text-action${n === at ? ' selected' : ''}`} onClick={() => choose(r)}>{prose(r.title)}</button> <small className="muted">{r.type}{r.detail && ` · ${prose(r.detail)}`}{r.taxId && ` · ${r.taxIdType || 'tax id'} ${r.taxId}`}{r.snippet && ` · ${prose(r.snippet)}`}</small>
        {r.open.kind==='invoice' && <ExportLink href={`/api/blotter/invoices/${r.open.invoiceId}/pdf`}>Open invoice PDF</ExportLink>}
        {r.open.kind === 'file' && <> <a href={`/api/blotter/files/${r.open.fileId}`}>Download</a></>}</li>)}</ul>)}
      {client && <ClientHistory clientId={client} people={state.people} run={run} open={open} />}
    </section>, document.getElementById('search-slot')!)}
  </div>;
}
