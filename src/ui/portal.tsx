import { PortalUpload } from './portal-upload';
import { PortalSignatures } from './signatures';
import { AiDisclosure } from './ai-disclosure';
import { PortalOrganizers } from './organizers';
import { useEffect, useState } from 'react';
import { Blotter, Status, when, type Row, day } from './common';
import { ClientTasks } from './tasks';
import { PortalDeliverables } from './deliverables';
import { PortalCredentials } from './vault';
import { PortalConversation, PortalProgress } from './client-portal';
import { LanguageProvider, useT } from './i18n';
import type { Language } from '../i18n/catalog';

/** The client's upload page. The link's secret is the only credential; the page speaks the contact's language (PORTAL-024). */
export function Portal({ token }: { token: string }) {
  const [view, setView] = useState<Row>(), [error, setError] = useState('');
  const path = `/api/blotter/portal/${encodeURIComponent(token)}`;
  const load = async () => { const r = await fetch(path); const b: any = await r.json(); if (!r.ok) throw new Error(b.error ?? 'This link cannot be opened'); setView(b); };
  useEffect(() => { load().catch(e => setError(e.message)); }, [token]);
  return <LanguageProvider language={(view?.language ?? 'en') as Language}><PortalPage view={view} error={error} setError={setError} path={path} load={load} /></LanguageProvider>;
}

function PortalPage({ view, error, setError, path, load }: { view?: Row; error: string; setError: (message: string) => void; path: string; load: () => Promise<void> }) {
  const t = useT(), [notice, setNotice] = useState(''), [busy, setBusy] = useState(false);
  const act = async (work: () => Promise<string>) => {
    setBusy(true); setError(''); setNotice('');
    try { setNotice(await work()); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  return <div className="portal" aria-busy={busy}>
    <a className="skip-link" href="#portal-main">{t('portal.skip')}</a>
    <header className="topbar"><span className="brand"><img src="/brand/mark-32.svg" alt="" width="28" height="28" /><span>{view?.practice ?? t('portal.title')}</span></span></header>
    <main id="portal-main" tabIndex={-1}>
      {error && <p className="error" role="alert">{error}</p>}
      {notice && <p className="notice" role="status">{notice}</p>}
      {!view ? (!error && <p>{t('portal.opening')} / Abriendo su solicitud…</p>) : <>
        <h1>{t('portal.heading', { job: view.job })}</h1>
        <p className="muted">{t('portal.intro', { client: view.client, period: view.period, due: day(view.dueDate), expires: day(view.expiresAt) })}</p>
        <PortalProgress progress={view.progress} />
        <Blotter className="requests">{view.requests.map((r: Row) => <section key={r.id} className="panel" aria-labelledby={`request-${r.id}`}>
          <div className="split"><h2 id={`request-${r.id}`}>{r.label}</h2><Status value={r.status} /></div>
          {r.note && <p className="notice">{t('portal.asks', { note: r.note })}</p>}
          {r.files.map((f: Row) => <p key={f.uploadedAt + f.name} className="muted">{t('portal.uploadedFile', { name: f.name, when: when(f.uploadedAt) })}</p>)}
          {view.collecting && r.status !== 'accepted' && <PortalUpload path={path} requestId={r.id} reload={load} />}
        </section>)}</Blotter>
        {view.sharedFiles?.length > 0 && <section className="panel" aria-labelledby="shared-files"><h2 id="shared-files">{t('portal.sharedFiles')}</h2><ul>{view.sharedFiles.map((f: Row) => <li key={f.file_key}><a href={`${path}/files/${encodeURIComponent(f.file_key)}`}>{f.name}</a> · {Math.ceil(f.size / 1024)} KB</li>)}</ul></section>}
        <PortalOrganizers path={path} busy={busy} act={act} reload={load} />
        <ClientTasks tasks={view.tasks} />
        <PortalConversation view={view} path={path} busy={busy} act={act} reload={load} />
        <PortalSignatures path={path} busy={busy} act={act} /><PortalDeliverables path={path} busy={busy} act={act} />
        <PortalCredentials path={path} busy={busy} act={act} />
        <AiDisclosure />
      </>}
    </main>
  </div>;
}
