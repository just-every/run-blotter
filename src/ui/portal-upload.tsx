import { useEffect, useRef, useState } from 'react';
import { type Row, when } from './common';
import { useT } from './i18n';

const hash = async (bytes: Uint8Array) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes as Uint8Array<ArrayBuffer>))].map(b => b.toString(16).padStart(2, '0')).join('');
const base64 = (bytes: Uint8Array) => { let s = ''; for (let i = 0; i < bytes.length; i += 32768) s += String.fromCharCode(...bytes.subarray(i, i + 32768)); return btoa(s); };

/** Only the server stores progress. Original bytes remain in memory until reselection. */
export function PortalUpload({ path, requestId, reload }: { path: string; requestId: string; reload: () => Promise<void> }) {
  const t = useT(), [uploads, setUploads] = useState<Row[]>([]), [current, setCurrent] = useState<Row>(), [file, setFile] = useState<File>();
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [pages, setPages] = useState('1');
  const pause = useRef(false), input = useRef<HTMLInputElement>(null);
  const requestPath = `${path}/requests/${requestId}/packet-uploads`;
  const call = async (url: string, body?: Row) => {
    const r = await fetch(url, body === undefined ? {} : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const b = await r.json() as Row; if (!r.ok) throw new Error(b.error ?? t('portal.uploadFailed')); return b;
  };
  const load = async () => { const list = await call(requestPath); setUploads(list as unknown as Row[]); return list as unknown as Row[]; };
  useEffect(() => { load().catch(e => setError(e.message)); return () => { pause.current = true; }; }, [requestPath]);
  const pending = uploads.filter(u => u.state === 'pending');
  const upload = async (resume?: Row) => {
    if (!file) return;
    setBusy(true); setError(''); pause.current = false;
    let activeId: string | undefined;
    try {
      if (file.size < 1 || file.size > 20 * 1048576) throw new Error(t('upload.sizeError'));
      const bytes = new Uint8Array(await file.arrayBuffer()), sha256 = await hash(bytes);
      let state = resume ? await call(`${path}/packet-uploads/${resume.id}`) : undefined;
      if (state && (state.size !== bytes.length || state.sha256 !== sha256)) throw new Error(t('upload.mismatch'));
      if (!state) state = await call(requestPath, { name: file.name, mime: file.type, size: bytes.length, sha256, pageCount: Number(pages) });
      activeId = state.id; setCurrent(state);
      while (state.receivedBytes < state.size && !pause.current) {
        const offset = state.receivedBytes, chunk = bytes.subarray(offset, offset + state.limits.chunkBytes);
        state = await call(`${path}/packet-uploads/${state.id}/chunks`, { offset, chunkId: `chunk-${offset}`, sha256: await hash(chunk), contentBase64: base64(chunk) });
        setCurrent(state);
      }
      if (!pause.current) {
        state = await call(`${path}/packet-uploads/${state.id}/complete`, {}); setCurrent(state); setFile(undefined);
        if (input.current) input.current.value = '';
        await reload();
      }
      await load();
    } catch (e) {
      setError(`${(e as Error).message} ${t('upload.retryHelp')}`);
      try { const list = await load(); const confirmed = list.find(u => u.id === activeId); if (confirmed) setCurrent(confirmed); if (confirmed?.state === 'completed') { setFile(undefined); if (input.current) input.current.value = ''; setError(''); await reload(); } } catch { /* Keep the refusal visible; never retry writes automatically. */ }
    } finally { setBusy(false); }
  };
  return <div style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
    <p className="muted">{t('upload.help')}</p>
    <label className="upload">{pending.length ? t('upload.reselect') : t('portal.chooseFile')}<input ref={input} type="file" disabled={busy} onChange={e => setFile(e.target.files?.[0])} /></label>
    {!pending.length && <label>{t('upload.pages')}<input type="number" min="1" max="2000" value={pages} disabled={busy} onChange={e => setPages(e.target.value)} /></label>}
    {!pending.length && <button type="button" disabled={busy || !file} onClick={() => upload()}>{t('upload.start')}</button>}
    {current && <div role="status" aria-live="polite"><p>{current.name}: {t('upload.confirmed', { received: current.receivedBytes, total: current.size })} · {current.state === 'completed' ? t('upload.filed') : busy ? t('upload.uploading') : t('upload.paused')}</p>
      <progress aria-label={t('upload.progress')} max={current.size} value={current.receivedBytes} />
    </div>}
    {busy && <button type="button" className="quiet" onClick={() => { pause.current = true; }}>{t('upload.pause')}</button>}
    {error && <p className="error" role="alert">{error}</p>}
    {pending.map(u => <div className="record" key={u.id}>
      <p><strong>{u.name}</strong> · {t('upload.confirmed', { received: u.receivedBytes, total: u.size })} · {t('upload.expires', { date: when(u.expiresAt) })}</p>
      <button type="button" disabled={busy || !file} onClick={() => upload(u)}>{t('upload.resume')}</button>{' '}
      <button type="button" className="quiet" disabled={busy} onClick={async () => {
        setBusy(true); setError('');
        try { await call(`${path}/packet-uploads/${u.id}/cancel`, {}); if (current?.id === u.id) setCurrent(undefined); await load(); }
        catch (e) { setError((e as Error).message); } finally { setBusy(false); }
      }}>{t('upload.cancel')}</button>
    </div>)}
  </div>;
}
