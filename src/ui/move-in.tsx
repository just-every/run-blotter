import { useEffect, useRef, useState } from 'react';
import { ImportContacts, ImportEntityDecision, ImportMapping, type ImportColumns, type ImportDecisions } from './import-mapping';
import { Blotter, api, taxId, Empty, type Row, type Run } from './common';

export function MoveIn({ run, tick }: { run: Run; tick: number }) {
  const [csv, setCsv] = useState(''), [filename, setFilename] = useState('clients.csv'), [preview, setPreview] = useState<Row>();
  const [review, setReview] = useState<Row>(), [columns, setColumns] = useState<ImportColumns>();
  const [columnError, setColumnError] = useState(''), [mappedCsv, setMappedCsv] = useState('');
  const [mapping, setMapping] = useState<Record<string, string>>({}), [decisions, setDecisions] = useState<ImportDecisions>({});
  const revision = useRef(0);
  const [marketingAttested, setMarketingAttested] = useState(false);
  const [jobs, setJobs] = useState<Row[]>([]), [journal, setJournal] = useState<Row>();
  useEffect(() => { api('/import').then(s => setJobs(s.jobs)).catch(e => run(async () => { throw e; })); }, [tick]);
  useEffect(() => {
    let active = true;
    setColumns(undefined); setColumnError(''); setMappedCsv('');
    if (!csv) return;
    const timer = setTimeout(() => {
      api('/import/columns', { csv }).then(result => {
        if (!active) return;
        setColumns(result); setMapping(result.defaults); setMappedCsv(csv);
      }).catch(error => { if (active) setColumnError(error.message); });
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [csv]);
  const invalidate = () => { revision.current++; setPreview(undefined); setMarketingAttested(false); };
  const changeCsv = (value: string) => {
    invalidate(); setReview(undefined); setDecisions({}); if (value !== csv) setMapping({}); setCsv(value);
  };
  const unresolved = review?.clients.some((client: Row) => client.candidates?.length && !decisions[client.sourceId]);
  const dryRun = () => run(async () => {
    const current = revision.current;
    const result = await api('/import/preview', { csv, filename, mapping, decisions });
    if (revision.current === current) { setPreview(result); setReview(result); }
  }, 'Dry run complete; nothing was changed');
  return <div className="grid">
    <Blotter className="wide"><section className="panel">
      <h2>Client list CSV</h2>
      <p className="muted">Bring your client and contact list across from a spreadsheet or your previous practice tool. Map its columns, review entity matches and contact permissions, then commit the exact preview. See IMPORTING.md.</p>
      <label>Client list file<input type="file" accept=".csv,text/csv" onChange={e => { const file = e.target.files?.[0]; if (file) { invalidate(); const current = revision.current; run(async () => { const value = await file.text(); if (revision.current === current) { setFilename(file.name); changeCsv(value); } }); } }} /></label>
      <label>CSV contents<textarea rows={7} value={csv} onChange={e => changeCsv(e.target.value)} /></label>
      {columnError && <p className="error" role="alert">{columnError}</p>}
      {csv && !columns && !columnError && <p role="status">Reading CSV columns…</p>}
      {columns && mappedCsv === csv && <ImportMapping columns={columns} mapping={mapping} change={(field, source) => {
        invalidate(); setReview(undefined); setDecisions({}); setMapping(previous => ({ ...previous, [field]: source }));
      }} />}
      <button disabled={!csv || !columns || mappedCsv !== csv} onClick={dryRun}>Preview (dry run)</button>
      {review && <div className="review">
        <h3>Dry run</h3>
        {!preview && <p role="status">Import decisions changed. Preview again before committing.</p>}
        <p>{review.summary.rows ?? review.summary.clients} {(review.summary.rows ?? review.summary.clients) === 1 ? 'row' : 'rows'} · {review.clients.length} entities</p>
        {review.summary.errors.map((m: string) => <p key={m} className="error">{m}</p>)}
        {review.summary.warnings.map((m: string) => <p key={m} className="muted">{m}</p>)}
        {unresolved && <p className="error">Review each possible duplicate and explicitly choose whether to keep it separate or match an existing entity.</p>}
        <ul className="list">{review.clients.map((c: Row) => <li key={c.sourceId}>
          <strong>{c.name}</strong> <small className="muted">{taxId(c.abn)} {c.contactEmail}</small>
          {!!c.contacts?.length && <ImportContacts contacts={c.contacts} />}
          <ImportEntityDecision client={c} decision={decisions[c.sourceId]} change={decision => {
            invalidate(); setDecisions(previous => ({ ...previous, [c.sourceId]: decision }));
          }} />
        </li>)}</ul>
        {!!review.marketing?.length && <section aria-label="Imported marketing consent">
          <h3>Imported marketing consent</h3>
          <p className="muted">Email permission does not grant marketing consent. A subscribed label alone imports as not granted. Withdrawals apply across the firm; without a capture date they take effect when imported.</p>
          <ul className="list">{review.marketing.map((m: Row, i: number) => <li key={i}><strong>{m.client} · {m.contact}</strong><p>{m.address}</p><p>{m.kind === 'grant' ? 'Explicit opt-in' : m.kind === 'withdraw' ? `Withdrawal (${m.status})` : 'Not granted'}{m.actedAt && ` · ${m.actedAt}`}</p>{m.wording && <p>{m.wording} · {m.version} · {m.language}</p>}{m.evidence && <p>Evidence: {m.evidence}</p>}{m.reason && <p>{m.reason}</p>}</li>)}</ul>
          {review.marketing.some((m: Row) => m.kind === 'grant') && <label><input type="checkbox" checked={marketingAttested} onChange={e => setMarketingAttested(e.target.checked)} />{review.marketingAttestation}</label>}
        </section>}
        <button disabled={!preview || (review.marketing?.some((m: Row) => m.kind === 'grant') && !marketingAttested) || review.summary.errors.length > 0 || unresolved} onClick={() => run(() => api('/import/commit', { csv, filename, mapping, decisions, fingerprint: preview!.fingerprint, marketingAttested }), 'Import committed. The journal below shows its progress.')}>Import these clients</button>
      </div>}
    </section></Blotter>
    <section className="panel">
      <h2>Import journal</h2>
      {!jobs.length && <Empty>No imports yet.</Empty>}
      {jobs.map(j => <article key={j.id} className="record">
        <strong>{j.state}</strong> <small className="muted">{j.checkpoint} / {j.total} entries · {j.id}</small>
        <div className="actions">
          <button className="quiet" onClick={() => run(async () => setJournal(await api('/import/status', { id: j.id })), 'Journal opened')}>View journal</button>
          {!['completed', 'undone', 'undoing'].includes(j.state) && <button onClick={() => run(() => api('/import/resume', { id: j.id }), 'Import resumed')}>Resume</button>}
          {['completed', 'undoing'].includes(j.state) && <button className="quiet" onClick={() => run(() => api('/import/undo', { id: j.id }), 'Undo processed. Clients that already have jobs are kept.')}>Undo import</button>}
        </div>
      </article>)}
      {journal && <details open><summary>Journal and undo report</summary><pre>{JSON.stringify({ job: journal.job, undo: journal.undo, originals: journal.originals?.map?.((o: Row) => ({ name: o.name, sha256: o.sha256 })) }, null, 2)}</pre></details>}
    </section>
  </div>;
}
