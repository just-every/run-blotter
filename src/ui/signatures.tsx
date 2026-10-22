import { useEffect, useState } from 'react';
import { PDFDocument } from 'pdf-lib';
import {SignaturePdfPreview} from './signature-pdf-preview';
import { api, Field, Form, readFile, Status, when, type Row, type Run } from './common';
import { useT } from './i18n';
import { hasKey, type Key } from '../i18n/catalog';

/** Reuses the existing job/client panels and forms. Frozen requests are never edited. */
export function SignatureRequests({detail,clientId,people=[],run,tick=0,readOnly=false}:{detail?:Row;clientId?:string;people?:Row[];run:Run;tick?:number;readOnly?:boolean}) {
  const job=detail?.job,client=job?.client_id??clientId,[items,setItems]=useState<Row[]>([]),[selected,setSelected]=useState<Row>(),[contacts,setContacts]=useState<Row[]>([]);
  const [chosen,setChosen]=useState<string[]>([]),[fields,setFields]=useState<Row[]>([]),[pdf,setPdf]=useState<Row>();
  const scope=job?`/jobs/${job.id}`:`/clients/${client}`;
  const load=async()=>{const [list,people]=await Promise.all([api(scope+'/signatures'),api(`/clients/${client}/contacts`)]);setItems(list);setContacts(people);if(selected)setSelected(await api(`/signatures/${selected.id}`));};
  useEffect(()=>{load().catch(error=>run(async()=>{throw error}))},[scope,tick]);
  useEffect(()=>()=>{if(pdf?.url)URL.revokeObjectURL(pdf.url)},[pdf?.url]);
  const signerContacts=contacts.filter(c=>c.active&&c.authorized&&c.signer&&c.portal&&c.request_consent&&c.email_consent&&c.email);
  const name=(contactId:string)=>contactId.startsWith('staff:')?`${people.find(p=>p.email===contactId.slice(6))?.name??contactId.slice(6)} (staff)`:contacts.find(c=>c.id===contactId)?.name??contactId;
  const open=(id:string)=>run(async()=>setSelected(await api(`/signatures/${id}`)));
  const refreshSelected=async()=>{await load();if(selected)setSelected(await api(`/signatures/${selected.id}`));};
  return <section className="panel" style={{minWidth:0,overflowWrap:'anywhere'}}><h2>Document signatures</h2>
    <p className="muted">Request electronic signatures on a PDF, with a separate consent for this document. Signer authority and portal access are checked every time. Forms requiring KBA need the signing provider and cannot be sent here.</p>
    {items.length===0&&<p>No signature requests yet.</p>}
    <ul className="list">{items.map(r=><li key={r.id}><button className="quiet" onClick={()=>open(r.id)}>{r.title}</button> · <Status value={r.status}/> · {r.mode} · requester {r.requester_email}{r.completed_at&&<> · {when(r.completed_at)}</>}</li>)}</ul>
    {selected&&<article className="record"><div className="split"><strong>{selected.title}</strong><Status value={selected.status}/></div>
      <p>Attempt {selected.attempt} · {selected.mode} signing · requested by {selected.original_requester}{selected.requester_email!==selected.original_requester&&<> · now owned by {selected.requester_email}</>}</p>
      <p><a href={`/api/blotter/signatures/${selected.id}/files/original`}>Original PDF</a>{selected.hasSigned&&<> · <a href={`/api/blotter/signatures/${selected.id}/files/signed`}>Signed PDF</a> · <a href={`/api/blotter/signatures/${selected.id}/files/certificate`}>Completion certificate</a></>}</p>
      {selected.attestation_required===1&&<p>Form 2848 or 8821: each remote (contact) signer can sign only after a staff member records how they were authenticated. The certificate states the form is electronically signed and may be submitted only online at IRS.gov/Submit2848.</p>}
      <ol>{selected.signers.map((s:Row)=><li key={s.contact_id}>{s.name}{s.signer_kind==='staff'&&' (staff, signs in their own session)'} · {s.status}{s.signed_at&&<> · {when(s.signed_at)}</>}{s.connection_ip&&<> · from {s.connection_ip}<small className="muted"> · {s.connection_user_agent}</small></>}{s.decline_reason&&<p>Declined: {s.decline_reason}</p>}
        {selected.attestation_required===1&&s.signer_kind==='contact'&&(()=>{const a=selected.attestations.find((x:Row)=>x.attempt===selected.attempt&&x.contact_id===s.contact_id);return a?<p>Remote authentication attested: {String(a.method).replaceAll('_',' ')} by {a.verifier} on {a.verified_on}</p>:!readOnly&&['draft','pending'].includes(selected.status)&&<Form label={`Record remote authentication for ${s.name}`} submit={async data=>run(async()=>{await api(`/signatures/${selected.id}/attestations`,{contactId:s.contact_id,method:data.method,verifier:data.verifier,verifiedOn:data.verifiedOn,items:['name','ssn_or_itin','address','date_of_birth'].filter(i=>data[i]==='on'),secondaryDocument:data.secondaryDocument||undefined,note:data.note||undefined});await refreshSelected()},'Remote-authentication attestation recorded')}>
          <Field label="Authentication method" name="method"><select name="method"><option value="photo_id_selfie">Government photo ID checked by selfie</option><option value="photo_id_video">Government photo ID checked by video</option><option value="personal_knowledge">Personal knowledge of the signer</option></select></Field>
          <Field label="Verified by" name="verifier"/><Field label="Verification date" name="verifiedOn" type="date"/>
          <fieldset><legend>Items checked against a secondary document</legend>{[['name','Name'],['ssn_or_itin','SSN or ITIN'],['address','Address'],['date_of_birth','Date of birth']].map(([key,label])=><label className="check" key={key}><input type="checkbox" name={key}/>{label}</label>)}</fieldset>
          <Field label="Secondary document checked" name="secondaryDocument" required={false}/><Field label="How you know the signer (personal knowledge)" name="note" required={false}/>
        </Form>;})()}</li>)}</ol>
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
      {pdf&&<><p>{pdf.file.name} · {pdf.pages.length} pages. <a href={pdf.url} target="_blank" rel="noreferrer">Open PDF to inspect placement</a></p><SignaturePdfPreview file={pdf.file} pages={pdf.pages} fields={fields}/></>}
      {people.length>0&&<fieldset><legend>Staff representatives (sign in their own session)</legend>{people.map(p=>{const ref='staff:'+p.email;return <label className="check" key={ref}><input type="checkbox" checked={chosen.includes(ref)} onChange={e=>{setChosen(e.target.checked?[...chosen,ref]:chosen.filter(id=>id!==ref));if(!e.target.checked)setFields(fields.filter(f=>f.contactId!==ref))}}/>{p.name} &lt;{p.email}&gt;</label>;})}</fieldset>}
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
  const t=useT(),[items,setItems]=useState<Row[]>([]),[selected,setSelected]=useState<Row>(),[failure,setFailure]=useState('');
  const request=async(url:string,body?:Row):Promise<any>=>{const response=await fetch(url,{...(body?{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}:{})});const result=await response.json() as Row;if(!response.ok)throw new Error(result.error);return result;};
  const load=async()=>setItems(await request(path+'/signatures'));
  useEffect(()=>{load().catch(e=>setFailure(e.message))},[path]);
  const open=async(id:string)=>{try{setSelected(await request(`${path}/signatures/${id}`));setFailure('')}catch(e){setFailure((e as Error).message)}};
  const post=(suffix:string,body:Row)=>act(async()=>{await request(`${path}/signatures/${selected!.id}/${suffix}`,body);await load();await open(selected!.id);return suffix==='sign'?t('sig.signedDone'):t('sig.declinedDone');});
  const mode=(m:string)=>m==='sequential'||m==='parallel'?t(`sig.mode.${m}` as Key):m;
  if(!items.length&&!failure)return null;
  return <section className="panel" aria-labelledby="signatures-title" style={{minWidth:0,overflowWrap:'anywhere'}}><h2 id="signatures-title">{t('sig.title')}</h2>{failure&&<p role="alert">{failure}</p>}
    <ul>{items.map(r=><li key={r.id}><button className="quiet" disabled={busy} onClick={()=>open(r.id)}>{r.title}</button> · <Status value={r.status}/></li>)}</ul>
    {selected&&<article className="record" aria-labelledby="signature-selected"><h3 id="signature-selected">{selected.title}</h3><p>{t('sig.mode',{mode:mode(selected.mode),attempt:selected.attempt,status:hasKey(`status.${selected.status}`)?t(`status.${selected.status}` as Key):selected.status})}</p><p><a href={`${path}/signatures/${selected.id}/files/original`} target="_blank" rel="noreferrer">{t('sig.read')}</a></p>
      <ol>{selected.signers.map((s:Row)=><li key={s.ordinal}>{s.name} · <Status value={s.status}/>{s.signedAt&&<> · {when(s.signedAt)}</>}</li>)}</ol>
      {selected.attestationRequired&&!selected.attested&&selected.status==='pending'&&<p>{t('sig.attest')}</p>}
      {!selected.canSign&&selected.attested!==false&&selected.status==='pending'&&selected.signerStatus==='pending'&&<p>{t('sig.waiting')}</p>}
      {selected.canSign&&<Form label={t('sig.consentAction')} disabled={busy} submit={async data=>post('sign',{revision:selected.revision,attempt:selected.attempt,consentVersion:selected.consentVersion,consent:data.consent==='on',intent:data.intent==='on',values:Object.fromEntries(selected.fields.map((f:Row)=>[f.id,data[f.id]]))})}>
        <p>{t('sig.signingAs',{name:selected.signerName})}</p>
        {selected.fields.map((f:Row)=><Field key={f.id} label={t('sig.field',{label:f.label,page:f.page})} name={f.id} type={f.type==='date'?'date':'text'}/>)}
        <p lang={selected.language}>{selected.consentText}</p><label className="check"><input name="consent" type="checkbox" required disabled={busy}/>{t('sig.consent')}</label>
        <label className="check"><input name="intent" type="checkbox" required disabled={busy}/>{t('sig.intent')}</label>
      </Form>}
      {selected.status==='pending'&&selected.signerStatus==='pending'&&<Form label={t('sig.decline')} disabled={busy} submit={async data=>post('decline',{revision:selected.revision,reason:data.reason})}><Field label={t('sig.declineReason')} name="reason"/><p className="muted">{t('sig.declineHint')}</p></Form>}
      {selected.hasSigned&&<p><a href={`${path}/signatures/${selected.id}/files/signed`}>{t('sig.downloadSigned')}</a> · <a href={`${path}/signatures/${selected.id}/files/certificate`}>{t('sig.downloadCertificate')}</a></p>}
    </article>}
  </section>;
}

/** Requests where this staff member is a named signer, signed in their own session with the same consent and intent. */
export function StaffSignatures({run,tick}:{run:Run;tick:number}) {
  const [items,setItems]=useState<Row[]>([]),[selected,setSelected]=useState<Row>();
  useEffect(()=>{api('/signatures/awaiting').then(setItems).catch(e=>run(async()=>{throw e}))},[tick]);
  if(!items.length)return null;
  const open=(id:string)=>run(async()=>setSelected(await api(`/signatures/${id}/signing`)));
  return <section className="panel" style={{minWidth:0,overflowWrap:'anywhere'}} aria-label="Documents for you to sign"><h2>Documents for you to sign</h2>
    <ul className="list">{items.map(r=><li key={r.id}><button className="quiet" onClick={()=>open(r.id)}>{r.title}</button> · {r.mode}{!r.canSign&&' · waiting for earlier signers'}</li>)}</ul>
    {selected&&<article className="record"><h3>{selected.title}</h3><p><a href={`/api/blotter/signatures/${selected.id}/files/original`} target="_blank" rel="noreferrer">Read and download the document</a></p>
      <ol>{selected.signers.map((s:Row)=><li key={s.ordinal}>{s.name} · {s.status}{s.signedAt&&<> · {when(s.signedAt)}</>}</li>)}</ol>
      {selected.canSign?<Form label="Consent and sign as representative" submit={async data=>run(async()=>{await api(`/signatures/${selected.id}/staff-sign`,{revision:selected.revision,attempt:selected.attempt,consentVersion:selected.consentVersion,consent:data.consent==='on',intent:data.intent==='on',values:Object.fromEntries(selected.fields.map((f:Row)=>[f.id,data[f.id]]))});setSelected(undefined);setItems(await api('/signatures/awaiting'))},'Signature recorded')}>
        <p>Signing as {selected.signerName}, in your own session.</p>
        {selected.fields.map((f:Row)=><Field key={f.id} label={`${f.label} (page ${f.page})`} name={f.id} type={f.type==='date'?'date':'text'}/>)}
        <p>{selected.consentText}</p><label className="check"><input name="consent" type="checkbox" required/>I consent to electronic records and signatures for this document.</label>
        <label className="check"><input name="intent" type="checkbox" required/>I am authorized and intend to sign this document.</label>
      </Form>:<p>Waiting for earlier signers. Reopen this request after they finish.</p>}
    </article>}
  </section>;
}
