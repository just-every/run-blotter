import { useEffect, useState } from 'react';
import { PDFDocument } from 'pdf-lib';
import { api, Field, Form, readFile, Status, when, type Row, type Run } from './common';

/** Reuses the existing job/client panels and forms. Frozen requests are never edited. */
export function SignatureRequests({detail,clientId,run,tick=0,readOnly=false}:{detail?:Row;clientId?:string;run:Run;tick?:number;readOnly?:boolean}) {
  const job=detail?.job,client=job?.client_id??clientId,[items,setItems]=useState<Row[]>([]),[selected,setSelected]=useState<Row>(),[contacts,setContacts]=useState<Row[]>([]);
  const [chosen,setChosen]=useState<string[]>([]),[fields,setFields]=useState<Row[]>([]),[pdf,setPdf]=useState<Row>();
  const scope=job?`/jobs/${job.id}`:`/clients/${client}`;
  const load=async()=>{const [list,people]=await Promise.all([api(scope+'/signatures'),api(`/clients/${client}/contacts`)]);setItems(list);setContacts(people);if(selected)setSelected(await api(`/signatures/${selected.id}`));};
  useEffect(()=>{load().catch(error=>run(async()=>{throw error}))},[scope,tick]);
  useEffect(()=>()=>{if(pdf?.url)URL.revokeObjectURL(pdf.url)},[pdf?.url]);
  const signerContacts=contacts.filter(c=>c.active&&c.authorized&&c.signer&&c.portal&&c.request_consent&&c.email_consent&&c.email);
  const name=(contactId:string)=>contacts.find(c=>c.id===contactId)?.name??contactId;
  const open=(id:string)=>run(async()=>setSelected(await api(`/signatures/${id}`)));
  const refreshSelected=async()=>{await load();if(selected)setSelected(await api(`/signatures/${selected.id}`));};
  return <section className="panel" style={{minWidth:0,overflowWrap:'anywhere'}}><h2>Document signatures</h2>
    <p className="muted">Request electronic signatures on a PDF, with a separate consent for this document. Signer authority and portal access are checked every time. Forms requiring KBA need the signing provider and cannot be sent here.</p>
    {items.length===0&&<p>No signature requests yet.</p>}
    <ul className="list">{items.map(r=><li key={r.id}><button className="quiet" onClick={()=>open(r.id)}>{r.title}</button> · <Status value={r.status}/> · {r.mode} · requester {r.requester_email}{r.completed_at&&<> · {when(r.completed_at)}</>}</li>)}</ul>
    {selected&&<article className="record"><div className="split"><strong>{selected.title}</strong><Status value={selected.status}/></div>
      <p>Attempt {selected.attempt} · {selected.mode} signing · requested by {selected.original_requester}{selected.requester_email!==selected.original_requester&&<> · now owned by {selected.requester_email}</>}</p>
      <p><a href={`/api/blotter/signatures/${selected.id}/files/original`}>Original PDF</a>{selected.hasSigned&&<> · <a href={`/api/blotter/signatures/${selected.id}/files/signed`}>Signed PDF</a> · <a href={`/api/blotter/signatures/${selected.id}/files/certificate`}>Completion certificate</a></>}</p>
      <ol>{selected.signers.map((s:Row)=><li key={s.contact_id}>{s.name} · {s.status}{s.signed_at&&<> · {when(s.signed_at)}</>}{s.decline_reason&&<p>Declined: {s.decline_reason}</p>}</li>)}</ol>
      {!readOnly&&['draft','declined','held'].includes(selected.status)&&<button onClick={()=>run(async()=>{await api(`/signatures/${selected.id}/send`,{revision:selected.revision});await refreshSelected()},'Signature invitations sent')}>{selected.status==='draft'?'Send signature request':'Resend as a fresh signing attempt'}</button>}
      {['declined','held'].includes(selected.status)&&<p className="muted">Resending keeps the same document and fields, creates a new attempt and asks every signer to consent and sign again. Earlier attempts remain in the timeline.</p>}
      {!readOnly&&!['completed','voided'].includes(selected.status)&&<Form label="Void signature request" danger submit={async data=>run(async()=>{await api(`/signatures/${selected.id}/void`,{reason:data.reason,revision:selected.revision});await refreshSelected()},'Request voided; further signing refused')}><Field label="Reason for voiding" name="reason"/></Form>}
      <details><summary>Placed PDF fields ({selected.fields.length})</summary><ul>{selected.fields.map((f:Row)=><li key={f.id}>{f.label} · {name(f.contactId)} · page {f.page} · left {f.x}, top {f.y}, {f.width} × {f.height} points</li>)}</ul></details>
      <details open><summary>Signature timeline</summary><ol className="list">{selected.events.map((e:Row)=><li key={e.id}>{when(e.at)} · {e.action} · {e.actor} · {e.detail}</li>)}</ol></details>
      {selected.deliveries.length>0&&<details><summary>Invitations and delivery</summary><ul>{selected.deliveries.map((d:Row)=><li key={d.id}>Attempt {d.attempt} · {name(d.contact_id)} · {d.delivery}</li>)}</ul></details>}
      {selected.hasSigned&&<details><summary>Document fingerprints</summary><p>Signed PDF SHA-256: <code>{selected.signed_sha256}</code></p><p>Certificate SHA-256: <code>{selected.certificate_sha256}</code></p></details>}
    </article>}
    {!readOnly&&job&&job.status!=='signed_off'&&job.access!=='task'&&<details><summary>Prepare a signature request</summary>
      <p>Choose a PDF up to 1 MiB and 200 pages. Place all fields before sending; a sent document cannot be changed. PDF positions use points (72 points per inch), measured from the page's upper-left corner.</p>
      <Field label="PDF to sign" name="signaturePdf"><input type="file" name="signaturePdf" accept="application/pdf" onChange={e=>{const file=e.target.files?.[0];if(file)run(async()=>{if(file.size>1048576)throw new Error('Signature PDFs must be at most 1 MiB');const doc=await PDFDocument.load(await file.arrayBuffer());setPdf({file:await readFile(file),url:URL.createObjectURL(file),pages:doc.getPages().map(p=>({width:p.getWidth(),height:p.getHeight()}))});setFields([])})}}/></Field>
      {pdf&&<><p>{pdf.file.name} · {pdf.pages.length} pages. <a href={pdf.url} target="_blank" rel="noreferrer">Open PDF to inspect placement</a></p><iframe title="Signature PDF original preview" src={pdf.url} style={{width:'100%',height:400,border:'1px solid var(--line)'}}/></>}
      <fieldset><legend>Authorized signers in signing order</legend>{signerContacts.length===0&&<p>Add contacts with signer authority, portal permission and request/email consent first.</p>}
        {signerContacts.map(c=><label className="check" key={c.id}><input type="checkbox" checked={chosen.includes(c.id)} onChange={e=>{setChosen(e.target.checked?[...chosen,c.id]:chosen.filter(id=>id!==c.id));if(!e.target.checked)setFields(fields.filter(f=>f.contactId!==c.id))}}/>{c.name} &lt;{c.email}&gt;</label>)}
        <ol>{chosen.map((id,index)=><li key={id}>{name(id)} {index>0&&<button type="button" className="quiet" onClick={()=>setChosen(chosen.map((v,i)=>i===index-1?id:i===index?chosen[index-1]:v))}>Move earlier</button>}</li>)}</ol>
      </fieldset>
      {pdf&&chosen.length>0&&<><Form label="Place field on PDF" submit={async data=>{setFields([...fields,{type:data.type,contactId:data.contactId,label:data.label,page:Number(data.page),x:Number(data.x),y:Number(data.y),width:Number(data.width),height:Number(data.height)}])}}>
        <div className="row"><Field label="Field type" name="type"><select name="type"><option value="signature">Signature</option><option value="initials">Initials</option><option value="date">Date</option><option value="text">Text</option></select></Field><Field label="Field signer" name="contactId"><select name="contactId">{chosen.map(id=><option key={id} value={id}>{name(id)}</option>)}</select></Field></div>
        <Field label="Field label" name="label"/><Field label="PDF page" name="page"><select name="page">{pdf.pages.map((p:Row,i:number)=><option key={i} value={i+1}>Page {i+1} ({Math.round(p.width)} × {Math.round(p.height)} points)</option>)}</select></Field>
        <div className="row"><Field label="Left (points)" name="x" type="number" value={60}/><Field label="Top (points)" name="y" type="number" value={500}/></div>
        <div className="row"><Field label="Width (points)" name="width" type="number" value={200}/><Field label="Height (points)" name="height" type="number" value={28}/></div>
      </Form><ul>{fields.map((f,i)=><li key={i}>{f.label} · {name(f.contactId)} · page {f.page}, left {f.x}, top {f.y}, {f.width} × {f.height} <button className="quiet" onClick={()=>setFields(fields.filter((_,n)=>n!==i))}>Remove field</button></li>)}</ul></>}
      <Form label="Save signature draft" disabled={!pdf||fields.length===0} submit={async data=>run(async()=>{const result=await api(`/jobs/${job.id}/signatures`,{title:data.title,formKind:data.formKind,requiresKba:data.requiresKba==='on',mode:data.mode,contactIds:chosen,file:pdf?.file,fields});setSelected(result);setFields([]);setChosen([]);setPdf(undefined);await load()},'Document and fields frozen; review before sending')}>
        <Field label="Document title" name="title"/><Field label="Form or document kind" name="formKind" value="General document"/>
        <Field label="Signing order" name="mode"><select name="mode"><option value="sequential">Sequential (in the order above)</option><option value="parallel">Parallel (any signer may sign first)</option></select></Field>
        <label className="check"><input type="checkbox" name="requiresKba"/>This form requires knowledge-based authentication (electronic signing will be refused until the provider is configured)</label>
      </Form>
    </details>}
  </section>;
}

/** Client UI only receives this contact's fields, never another signer's answers or IP. */
export function PortalSignatures({path,busy,act}:{path:string;busy:boolean;act:(work:()=>Promise<string>)=>Promise<void>}) {
  const [items,setItems]=useState<Row[]>([]),[selected,setSelected]=useState<Row>(),[failure,setFailure]=useState('');
  const request=async(url:string,body?:Row):Promise<any>=>{const response=await fetch(url,{...(body?{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}:{})});const result=await response.json() as Row;if(!response.ok)throw new Error(result.error);return result;};
  const load=async()=>setItems(await request(path+'/signatures'));
  useEffect(()=>{load().catch(e=>setFailure(e.message))},[path]);
  const open=async(id:string)=>{try{setSelected(await request(`${path}/signatures/${id}`));setFailure('')}catch(e){setFailure((e as Error).message)}};
  const post=(suffix:string,body:Row)=>act(async()=>{await request(`${path}/signatures/${selected!.id}/${suffix}`,body);await load();await open(selected!.id);return suffix==='sign'?'Signature recorded.':'Decline recorded. Your practice can arrange another way to sign.';});
  if(!items.length&&!failure)return null;
  return <section className="panel" style={{minWidth:0,overflowWrap:'anywhere'}}><h2>Your signature requests</h2>{failure&&<p role="alert">{failure}</p>}
    <ul>{items.map(r=><li key={r.id}><button className="quiet" disabled={busy} onClick={()=>open(r.id)}>{r.title}</button> · {r.status}</li>)}</ul>
    {selected&&<article className="record"><h3>{selected.title}</h3><p>{selected.mode} · attempt {selected.attempt} · {selected.status}</p><p><a href={`${path}/signatures/${selected.id}/files/original`} target="_blank" rel="noreferrer">Read and download the document</a></p>
      <ol>{selected.signers.map((s:Row)=><li key={s.ordinal}>{s.name} · {s.status}{s.signedAt&&<> · {when(s.signedAt)}</>}</li>)}</ol>
      {!selected.canSign&&selected.status==='pending'&&selected.signerStatus==='pending'&&<p>Waiting for earlier signers. Reopen this request after they finish.</p>}
      {selected.canSign&&<Form label="Consent and sign document" disabled={busy} submit={async data=>post('sign',{revision:selected.revision,attempt:selected.attempt,consentVersion:selected.consentVersion,consent:data.consent==='on',intent:data.intent==='on',values:Object.fromEntries(selected.fields.map((f:Row)=>[f.id,data[f.id]]))})}>
        <p>Signing as {selected.signerName}. Review the complete PDF before signing.</p>
        {selected.fields.map((f:Row)=><Field key={f.id} label={`${f.label} (page ${f.page})`} name={f.id} type={f.type==='date'?'date':'text'}/>)}
        <p>{selected.consentText}</p><label className="check"><input name="consent" type="checkbox" required disabled={busy}/>I consent to electronic records and signatures for this document.</label>
        <label className="check"><input name="intent" type="checkbox" required disabled={busy}/>I am authorized for this client and intend to sign this document.</label>
      </Form>}
      {selected.status==='pending'&&selected.signerStatus==='pending'&&<Form label="Decline electronic signing" disabled={busy} submit={async data=>post('decline',{revision:selected.revision,reason:data.reason})}><Field label="Reason for declining" name="reason"/><p className="muted">You can ask the practice for a paper copy or another way to sign. Declining does not withdraw any marketing consent.</p></Form>}
      {selected.hasSigned&&<p><a href={`${path}/signatures/${selected.id}/files/signed`}>Download signed PDF</a> · <a href={`${path}/signatures/${selected.id}/files/certificate`}>Download certificate</a></p>}
    </article>}
  </section>;
}
