import { useEffect, useState } from 'react';
import { api, Field, Form, type Row, type Run } from './common';
import { archiveFile } from './archive-transfer-file';

export function ArchiveTransfers({ run, tick }: { run: Run; tick: number }) {
  const [list, setList] = useState<Row[]>([]), [file, setFile] = useState<File>(), [journal, setJournal] = useState<File>(), [busy, setBusy] = useState(false), [progress, setProgress] = useState('');
  const load = async () => setList((await api('/portability')).transfers);
  useEffect(() => { load().catch(e => run(async () => { throw e; })); }, [tick]);
  const work = (fn: () => Promise<void>) => run(async () => { setBusy(true); try { await fn(); } finally { setBusy(false); await load(); } });
  const advance = async (id: string) => { let status = await api(`/portability/exports/${id}`); while (status.phase === 'building') { setProgress(`Export: ${status.completed} parts confirmed · ${status.bytes ?? 0} bytes`); status = await api(`/portability/exports/${id}/advance`, { expectedPart: status.completed }); } setProgress(`Export ${status.phase}: ${status.completed} confirmed parts`); };
  const restore = async (confirm: string) => {
    if (!file) throw new Error('Choose an archive file');
    let laterJournal: Row | undefined;
    if (journal) { const reader = archiveFile(journal); try { const first = await reader.next(); if (first.value?.kind !== 'manifest') throw new Error('Choose a complete newer archive'); const m = first.value; laterJournal = { sourceIdentity: m.sourceIdentity, epoch: m.epoch, journal: m.journal }; } finally { await reader.return(undefined); } }
    let transfer = list.find(t => t.kind === 'import' && t.phase !== 'complete'), seen = 0, complete = false;
    for await (const part of archiveFile(file)) {
      if (part.kind === 'manifest') {
        if (!transfer) transfer = await api('/portability/imports', { manifest: part, confirm });
        else if (confirm !== 'RESTORE') throw new Error('Type RESTORE to resume');
      } else if (part.kind === 'part') {
        if (!transfer) throw new Error('Archive manifest missing');
        const status = await api(`/portability/imports/${transfer.id}/parts`, { part });
        setProgress(`Restore: ${++seen} parts read · ${status.completed} confirmed`);
      } else if (part.kind === 'closing') {
        if (!transfer) throw new Error('Archive manifest missing');
        const status = await api(`/portability/imports/${transfer.id}/finalize`, { archiveHash: part.archiveHash, contentHash: part.contentHash, laterJournal });
        complete = status.phase === 'complete';
        setProgress(`Restore ${status.phase}. Review recurring rules before resuming them; re-enter private configuration and issue fresh client links.`);
      }
    }
    if (!complete) throw new Error('Archive is incomplete; confirmed parts remain available to resume.');
  };
  return <section className="panel wide" aria-busy={busy}>
    <h2>Practice archives</h2>
    <p className="muted">All native records and original file bytes travel in verified parts of at most 16 MiB. Each advance confirms one part. Close this page at any point; reopen it to resume. Keep the original file to resume a restore. The destination must be empty.</p>
    <p className="muted">Sign-in accounts, sessions, keys, second factors, upload/share links and unfinished uploads stay out. Recurring rules restore paused. Unsent historical notifications stay held and are never replayed. Review the schedule under Clients & templates before resuming a rule. Future connected providers require fresh authorization.</p>
    <button disabled={busy} onClick={() => work(async () => { const t = await api('/portability/exports', {}); await advance(t.id); })}>Create practice archive</button>
    {progress && <p className="notice" role="status">{progress}</p>}
    {list.map(t => <article className="record" key={t.id}><strong>{t.kind === 'export' ? 'Export' : 'Restore'} · {t.phase}</strong><p className="muted">{t.completed}{t.total !== null && ` of ${t.total}`} confirmed parts{t.bytes !== undefined && ` · ${t.bytes.toLocaleString()} bytes`}</p>
      {t.kind === 'export' && t.phase === 'building' && <button disabled={busy} onClick={() => work(() => advance(t.id))}>Resume export</button>}
      {t.kind === 'export' && t.phase === 'complete' && <><p><a className="button" href={`/api/blotter/portability/exports/${t.id}/download`}>Download complete archive</a></p><SelectiveArchive id={t.id} /></>}
      {t.kind === 'import' && t.phase !== 'complete' && <p>Choose the same original archive below and type RESTORE to resume. Already confirmed parts are checked and retained.</p>}
      {(t.kind === 'export' || t.phase !== 'complete') && <button className="quiet" disabled={busy} onClick={() => work(async () => { await api(`/portability/${t.kind === 'export' ? 'exports' : 'imports'}/${t.id}/abort`, {}); })}>Remove transfer staging</button>}
    </article>)}
    <details><summary>Restore or resume into this empty installation</summary>
      <label>Complete archive file<input type="file" accept=".rer" onChange={e => setFile(e.target.files?.[0])} /></label>
      <label>Newer archive carrying the latest erasure journal (when restoring an older archive)<input type="file" accept=".rer" onChange={e => setJournal(e.target.files?.[0])} /></label>
      <Form danger disabled={busy} label="Restore or resume" submit={async data => work(() => restore(data.confirm))}><Field label="Type RESTORE" name="confirm" /></Form>
    </details>
  </section>;
}

function SelectiveArchive({ id }: { id: string }) {
  const [inventory,setInventory]=useState<Row>(), [table,setTable]=useState('b_clients'), [error,setError]=useState('');
  useEffect(()=>{api(`/portability/exports/${id}/inventory`).then(setInventory).catch(e=>setError(e.message));},[id]);
  return <>{error && <p className="error" role="alert">{error}</p>}{inventory && <><Field label="Records to export separately" name={`selection-${id}`}><select value={table} onChange={e=>setTable(e.target.value)}>{inventory.tables.map((t:Row)=><option value={t.name} key={t.name}>{t.name.replace(/^b_/,'').replaceAll('_',' ')} · {t.count} records</option>)}</select></Field><p><a href={`/api/blotter/portability/exports/${id}/download?table=${encodeURIComponent(table)}`}>Download selected records as NDJSON</a> · for analysis; use the complete archive to restore</p></>}</>;
}
