import { useEffect, useRef, useState } from 'react';
import { api, Field, Form, Status, when, type Row, type Run } from './common';
import { DocumentAccess } from './document-access';

const sha256 = async (bytes: Uint8Array) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes as Uint8Array<ArrayBuffer>))].map(b => b.toString(16).padStart(2, '0')).join('');
const base64 = (bytes: Uint8Array) => { let s = ''; for (let i = 0; i < bytes.length; i += 32768) s += String.fromCharCode(...bytes.subarray(i, i + 32768)); return btoa(s); };
const size = (bytes: number) => `${(bytes / 1048576).toFixed(2)} MiB`;

/** Embed on a job, or in a client's history with clientId and no detail. */
export function DocumentPackets({ detail, clientId, run, tick = 0 }: { detail?: Row; clientId?: string; run: Run; tick?: number }) {
  const [catalog, setCatalog] = useState<Row>(), [pending, setPending] = useState<Row[]>([]), [query, setQuery] = useState('');
  const [current, setCurrent] = useState<Row>(), [busy, setBusy] = useState(false), [failure, setFailure] = useState('');
  const pause = useRef(false), generation = useRef(0);
  const job = detail?.job, canUpload = job?.status === 'open' && job?.access === 'full';
  const scope = job ? `/jobs/${job.id}` : `/clients/${clientId}`;
  const load = async () => {
    const request = ++generation.current;
    const [next, uploads] = await Promise.all([api(`${scope}/document-packets?q=${encodeURIComponent(query)}`), canUpload ? api(`/jobs/${job.id}/packet-uploads`) : Promise.resolve([])]);
    if(request === generation.current){setCatalog(next); setPending(uploads);}
  };
  useEffect(() => { load().catch(error => setFailure(error.message)); }, [scope, tick, query, canUpload]);
  const upload = async (file: File, data?: Row, resumeId?: string) => {
    setBusy(true); setFailure(''); pause.current = false;
    let active: Row | undefined;
    try {
      if (file.size < 1 || file.size > 20 * 1048576) throw new Error('Choose an original between 1 byte and 20 MiB. Nothing was uploaded.');
      const bytes = new Uint8Array(await file.arrayBuffer()), hash = await sha256(bytes);
      let state: Row;
      if (resumeId) {
        state = await api(`/packet-uploads/${resumeId}`);
        if (state.size !== file.size || state.sha256 !== hash) throw new Error('This is a different file. Select the exact original to resume, or cancel and start a new upload.');
      } else {
        state = await api(`/requests/${data!.requestId}/packet-uploads`, { name: file.name, mime: file.type || 'application/octet-stream', size: file.size, sha256: hash,
          pageCount: Number(data!.pageCount), source: data!.source, author: data!.author, previousFileId: data!.previousFileId || undefined });
      }
      active = state; setCurrent(state);
      while (state.receivedBytes < state.size && !pause.current) {
        const offset = state.receivedBytes, chunk = bytes.subarray(offset, Math.min(offset + state.limits.chunkBytes, state.size));
        state = await api(`/packet-uploads/${state.id}/chunks`, { offset, chunkId: `chunk-${offset}`, sha256: await sha256(chunk), contentBase64: base64(chunk) });
        active = state; setCurrent(state);
      }
      if (!pause.current) { state = await api(`/packet-uploads/${state.id}/complete`, {}); setCurrent(state); }
      await load();
      return true;
    } catch (error) {
      setFailure(`${error instanceof Error ? error.message : 'Upload failed.'}${active?.state === 'pending' ? ' Confirmed chunks remain until the upload expiry; reselect the exact original below to resume.' : ''}`);
      await load();
      return false;
    } finally { setBusy(false); }
  };
  const versions = catalog?.folders.flatMap((f: Row) => f.files) ?? [];
  return <section className="panel" style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
    <h2>Document packets</h2>
    <p className="muted">Client and period folders retain every original and corrected version. Up to 20 MiB and 2,000 pages per packet, in 256 KiB chunks. Interrupted uploads can resume for seven days with the exact original. Annotations and review notes are internal to staff with engagement access.</p>
    <Field label="Search document names and metadata" name="packetSearch" required={false}><input name="packetSearch" type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Name, source, author, period, annotation or review status" /></Field>
    {catalog && !catalog.total && <p className="muted">{query ? 'No packets match this search.' : 'No document packets filed yet.'}</p>}
    {catalog?.folders.map((folder: Row) => <details key={folder.jobId} open>
      <summary>{folder.clientName} / {folder.period} · {folder.title} ({folder.files.length})</summary>
      {folder.files.map((f: Row) => f.kind === 'file' ? <PacketVersion key={f.file_id} file={f} run={run} refresh={load} /> : <RelatedDocument key={f.file_id} file={f} />)}
    </details>)}
    {canUpload && <details><summary>Add a packet or corrected version</summary>
      <Form disabled={busy} label="Upload packet" submit={async (data, form) => {
        const file = (form.elements.namedItem('packetFile') as HTMLInputElement).files?.[0];
        if (!file) { setFailure('Choose an original file.'); return; }
        if(await upload(file, data) && !pause.current) await run(async()=>{},'Packet filed with original bytes and digest');
      }}>
        <Field label="Document request" name="requestId"><select name="requestId">{detail!.requests.map((r: Row) => <option key={r.id} value={r.id}>{r.label}</option>)}</select></Field>
        <Field label="Version relationship" name="previousFileId" required={false}><select name="previousFileId" onChange={e => { const previous = versions.find((f: Row) => f.file_id === e.target.value); const request = e.currentTarget.form?.elements.namedItem('requestId') as HTMLSelectElement | null; if (previous && request) request.value = previous.request_id; }}><option value="">New packet</option>{versions.filter((f: Row) => f.kind === 'file' && !f.has_newer_version && !f.erased_at).map((f: Row) => <option key={f.file_id} value={f.file_id}>Correct version {f.version}: {f.name}</option>)}</select></Field>
        <div className="row"><Field label="Page count" name="pageCount" type="number" value={1} /><Field label="Document author" name="author" /></div>
        <Field label="Source" name="source" hint="For example: bank statement received by secure email" />
        <Field label="Packet original (up to 20 MiB)" name="packetFile"><input type="file" name="packetFile" required disabled={busy} /></Field>
        <p className="muted">New packets start internal. Corrected versions keep exactly the preceding version's contact grants; share links are never copied. Review starts again for the new version.</p>
      </Form>
    </details>}
    {current && <div role="status" aria-live="polite"><p>{current.name}: {size(current.receivedBytes)} of {size(current.size)} confirmed · {current.state === 'completed' ? 'Filed' : busy ? 'Uploading' : 'Paused'}</p>
      <progress aria-label="Confirmed upload bytes" max={current.size} value={current.receivedBytes} />
      {busy && <button type="button" className="quiet" onClick={() => { pause.current = true; }}>Pause after this chunk</button>}
    </div>}
    {failure && <p role="alert" className="notice">{failure}</p>}
    {canUpload && pending.length > 0 && <details open><summary>Resume interrupted uploads ({pending.length})</summary>
      {pending.map(u => <article className="record" key={u.id}><p><strong>{u.name}</strong> · {size(u.receivedBytes)} of {size(u.size)} confirmed · expires {when(u.expiresAt)}</p>
        <label className="upload">Reselect the exact original to resume<input aria-label={`Resume ${u.name}`} type="file" disabled={busy} onChange={e => { const f = e.target.files?.[0]; if (f) upload(f, undefined, u.id).then(ok=>{if(ok&&!pause.current)run(async()=>{},'Packet filed');}); e.target.value = ''; }} /></label>
        <button className="quiet" disabled={busy} onClick={() => run(async () => { await api(`/packet-uploads/${u.id}/cancel`, {}); if (current?.id === u.id) setCurrent(undefined); setFailure(''); await load(); }, 'Pending upload cancelled')}>Cancel pending upload</button>
      </article>)}
    </details>}
  </section>;
}
function PacketVersion({ file: f, run, refresh }: { file: Row; run: Run; refresh: () => Promise<void> }) {
  return <article className="record">
    <div className="split"><strong>{f.erased_at ? `${f.name} (original erased)` : <a href={`/api/blotter/documents/${encodeURIComponent(f.file_id)}/file`}>{f.name}</a>} · version {f.version}{f.has_newer_version ? ' · prior version' : ' · latest'}</strong><Status value={f.review_status} /></div>
    <p className="muted">{f.page_count ? `${f.page_count} pages` : 'Page count not recorded'} · {size(f.original_size)} · {f.visibility === 'contacts' ? 'Selected contacts' : 'Internal only'} · source: {f.source} · author: {f.author || 'Not recorded'}</p>
    <p className="muted">Filed by {f.uploaded_by} · {when(f.uploaded_at)}{f.previous_file_id && <> · corrects version {f.version - 1}</>}</p>
    <details><summary>Original fingerprint</summary><p>SHA-256: <code>{f.sha256}</code></p></details>
    {f.reviewed_at && <p>Reviewed by {f.reviewed_by} · {when(f.reviewed_at)}{f.review_note && ` · ${f.review_note}`}</p>}
    <details><summary>Page annotations ({f.annotations.length}) and review</summary>
      <p className="muted">Notes refer to this exact version. Download the preserved original to read its pages.</p>
      {f.annotations.map((a: Row) => <p key={a.id}><strong>Page {a.page}:</strong> {a.note}<small className="muted"> · {a.created_by} · {when(a.created_at)}</small></p>)}
      {!!f.can_edit && <>
        <Form label="Annotate page" submit={async data => run(async () => { await api(`/document-packets/${f.file_id}/annotations`, { page: Number(data.page), pageCount: data.pageCount ? Number(data.pageCount) : undefined, note: data.note }); await refresh(); }, 'Internal page annotation saved')}>
          <Field label={f.page_count ? `Page (1–${f.page_count})` : 'Page to annotate'} name="page" type="number" value={1} />{!f.page_count && <Field label="Original page count (recorded once)" name="pageCount" type="number" />}<Field label="Internal annotation" name="note"><textarea name="note" required maxLength={4000} rows={2} /></Field>
        </Form>
        <Form label="Save packet review" submit={async data => run(async () => { await api(`/document-packets/${f.file_id}/review`, { revision: f.revision, status: data.status, note: data.note }); await refresh(); }, 'Packet review recorded')}>
          <Field label="Packet review status" name="status"><select name="status" defaultValue={f.review_status}><option value="unreviewed">Unreviewed</option><option value="in_review">In review</option><option value="accepted">Accepted</option><option value="returned">Returned</option></select></Field>
          <Field label="Review note (required for returned packets)" name="note" required={false}><textarea name="note" maxLength={2000} rows={2} /></Field>
        </Form>
      </>}
    </details>
    {!f.erased_at && <DocumentAccess fileRef={f.file_id} run={run} />}
  </article>;
}

function RelatedDocument({file:f}:{file:Row}) {
  return <article className="record">
    <strong><a href={`/api/blotter/documents/${encodeURIComponent(f.file_id)}/file`}>{f.name}</a>{f.version && ` · version ${f.version}`}</strong>
    <p className="muted">{f.source} · {size(f.original_size)} · {f.visibility === 'contacts' ? 'Selected contacts' : 'Internal only'}</p>
    <p className="muted">Filed by {f.uploaded_by} · {when(f.uploaded_at)} · {f.source_status}</p>
    <a className="button quiet" href={f.sourceHref}>Open {f.workflow}</a>
    <p className="muted">Custody, versions and approval stay with this source workflow.</p>
  </article>;
}
