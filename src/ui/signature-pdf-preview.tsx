import {useEffect, useRef, useState} from 'react';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type {Row} from './common';

/** Render the original PDF itself; overlays use the same point geometry as signing. */
export function SignaturePdfPreview({file,pages,fields}:{file:Row;pages:Row[];fields:Row[]}) {
  const canvas=useRef<HTMLCanvasElement>(null),[page,setPage]=useState(1),[ready,setReady]=useState(false),[error,setError]=useState('');
  useEffect(()=>{
    let cancelled=false,task:ReturnType<typeof import('pdfjs-dist')['getDocument']>|undefined;
    setReady(false);setError('');
    (async()=>{
      const pdfjs=await import('pdfjs-dist');if(cancelled)return;
      pdfjs.GlobalWorkerOptions.workerSrc=workerUrl;
      task=pdfjs.getDocument({data:Uint8Array.from(atob(file.contentBase64),c=>c.charCodeAt(0))});
      const doc=await task.promise,original=await doc.getPage(page);if(cancelled)return;
      const target=canvas.current!,viewport=original.getViewport({scale:1.5});
      target.width=viewport.width;target.height=viewport.height;
      await original.render({canvas:target,viewport}).promise;if(!cancelled)setReady(true);
    })().catch(e=>{if(!cancelled)setError(e.message)});
    return ()=>{cancelled=true;void task?.destroy()};
  },[file.contentBase64,page]);
  const dimensions=pages[page-1];
  return <div>
    <label>Preview PDF page <select aria-label="Preview PDF page" value={page} onChange={e=>setPage(Number(e.target.value))}>{pages.map((_,i)=><option key={i} value={i+1}>Page {i+1}</option>)}</select></label>
    {error&&<p role="alert">PDF preview failed: {error}</p>}
    {!ready&&!error&&<p role="status">Rendering the original PDF…</p>}
    <div style={{position:'relative',maxWidth:720,margin:'1rem auto',border:'1px solid var(--line)'}} aria-busy={!ready}>
      <canvas ref={canvas} role="img" aria-label={`PDF page ${page}`} style={{display:ready?'block':'none',width:'100%',height:'auto'}}/>
      {ready&&fields.filter(f=>f.page===page).map((f,i)=><span key={i} style={{position:'absolute',left:`${100*f.x/dimensions.width}%`,top:`${100*f.y/dimensions.height}%`,width:`${100*f.width/dimensions.width}%`,height:`${100*f.height/dimensions.height}%`,border:'1px solid var(--accent)',background:'rgba(126,67,246,.12)',fontSize:10,overflow:'hidden'}}>{f.label}</span>)}
    </div>
  </div>;
}
