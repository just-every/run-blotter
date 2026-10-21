import { PortalSignatures } from './signatures';
import { PortalOrganizers } from './organizers';
import { useEffect, useState } from 'react';
import { Blotter, readFile, Status, when, type Row, day } from './common';
import { ClientTasks } from './tasks';
import { PortalDeliverables } from './deliverables';
import { PortalCredentials } from './vault';
import { PortalConversation, PortalProgress } from './client-portal';

/** The client's upload page. The link's secret is the only credential. */
export function Portal({ token }: { token: string }) {
  const [view, setView] = useState<Row>(), [error, setError] = useState(''), [notice, setNotice] = useState(''), [busy, setBusy] = useState(false);
  const path = `/api/blotter/portal/${encodeURIComponent(token)}`;
  const load = async () => { const r = await fetch(path); const b: any = await r.json(); if (!r.ok) throw new Error(b.error ?? 'This link cannot be opened'); setView(b); };
  useEffect(() => { load().catch(e => setError(e.message)); }, [token]);
  const act = async (work: () => Promise<string>) => {
    setBusy(true); setError(''); setNotice('');
    try { setNotice(await work()); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  const upload = (requestId: string, file: File) => act(async () => {
    const r = await fetch(`${path}/requests/${requestId}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(await readFile(file)) });
    const b: any = await r.json(); if (!r.ok) throw new Error(b.error ?? 'Upload failed');
    await load(); return `Uploaded ${file.name}. Thank you.`;
  });
  return <div className="portal" aria-busy={busy}>
    <header className="topbar"><span className="brand"><img src="/brand/mark-32.svg" alt="" width="28" height="28" /><span>{view?.practice ?? 'Document upload'}</span></span></header>
    <main>
      {error && <p className="error" role="alert">{error}</p>}
      {notice && <p className="notice" role="status">{notice}</p>}
      {!view ? (!error && <p>Opening your request…</p>) : <>
        <h1>Documents for {view.job}</h1>
        <p className="muted">{view.client} · {view.period} · please upload by {day(view.dueDate)}. This link expires {day(view.expiresAt)}. Files up to 1 MiB each.</p>
        <PortalProgress progress={view.progress} />
        <Blotter className="requests">{view.requests.map((r: Row) => <section key={r.id} className="panel">
          <div className="split"><h2>{r.label}</h2><Status value={r.status} /></div>
          {r.note && <p className="notice">Your accountant asks: {r.note}</p>}
          {r.files.map((f: Row) => <p key={f.uploadedAt + f.name} className="muted">Uploaded {f.name} · {when(f.uploadedAt)}</p>)}
          {view.collecting && r.status !== 'accepted' && <label className="upload">Choose a file to upload<input type="file" disabled={busy} onChange={e => { const file = e.target.files?.[0]; if (file) upload(r.id, file); e.target.value = ''; }} /></label>}
        </section>)}</Blotter>
        {view.sharedFiles?.length>0&&<section className="panel"><h2>Shared files</h2><ul>{view.sharedFiles.map((f:Row)=><li key={f.file_key}><a href={`${path}/files/${encodeURIComponent(f.file_key)}`}>{f.name}</a> · {Math.ceil(f.size/1024)} KB</li>)}</ul></section>}
        <PortalOrganizers path={path} busy={busy} act={act} reload={load} />
        <ClientTasks tasks={view.tasks} />
        <PortalConversation view={view} path={path} busy={busy} act={act} reload={load} />
        <PortalSignatures path={path} busy={busy} act={act}/><PortalDeliverables path={path} busy={busy} act={act} />
        <PortalCredentials path={path} busy={busy} act={act} />
      </>}
    </main>
  </div>;
}
