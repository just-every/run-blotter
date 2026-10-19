import { useEffect, useState } from 'react';
import { Blotter, api, Empty, type Row, type Run } from './common';

export function MoveIn({ run, tick }: { run: Run; tick: number }) {
  const [csv, setCsv] = useState(''), [filename, setFilename] = useState('clients.csv'), [preview, setPreview] = useState<Row>();
  const [jobs, setJobs] = useState<Row[]>([]), [journal, setJournal] = useState<Row>();
  useEffect(() => { api('/import').then(s => setJobs(s.jobs)).catch(e => run(async () => { throw e; })); }, [tick]);
  return <div className="grid">
    <Blotter className="wide"><section className="panel">
      <h2>Client list CSV</h2>
      <p className="muted">Bring your client list across from a spreadsheet or your previous practice tool. Columns: <code>client_name</code> (required), <code>client_id</code>, <code>abn</code>, <code>contact_name</code>, <code>contact_email</code>. Other columns are kept in the stored original only. See IMPORTING.md.</p>
      <label>Client list file<input type="file" accept=".csv,text/csv" onChange={e => { const file = e.target.files?.[0]; if (file) file.text().then(value => { setCsv(value); setFilename(file.name); setPreview(undefined); }); }} /></label>
      <label>CSV contents<textarea rows={7} value={csv} onChange={e => { setCsv(e.target.value); setPreview(undefined); }} /></label>
      <button disabled={!csv} onClick={() => run(async () => setPreview(await api('/import/preview', { csv, filename })), 'Dry run complete; nothing was changed')}>Preview (dry run)</button>
      {preview && <div className="review">
        <h3>Dry run</h3>
        <p>{preview.summary.clients} {preview.summary.clients === 1 ? 'row' : 'rows'} · {preview.counts?.create ?? preview.clients.length} to create</p>
        {preview.summary.errors.map((m: string) => <p key={m} className="error">{m}</p>)}
        {preview.summary.warnings.map((m: string) => <p key={m} className="muted">{m}</p>)}
        <ul className="list">{preview.clients.slice(0, 50).map((c: Row) => <li key={c.sourceId}>{c.name} <small className="muted">{c.abn} {c.contactEmail}{c.matches ? ` · already matches ${c.matches.name}` : ''}</small></li>)}</ul>
        <button disabled={preview.summary.errors.length > 0} onClick={() => run(() => api('/import/commit', { csv, filename, fingerprint: preview.fingerprint }), 'Import committed. The journal below shows its progress.')}>Import these clients</button>
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
