import {useEffect,useState} from 'react';
import {api,Field,Form,money,Status,when,type Row,type Run} from './common';

/** Native proposals use the same client fields, lists and signature downloads. */
export function EngagementProposals({clientId,client,jobs,principal,run,tick}:{clientId:string;client:Row;jobs:Row[];principal:boolean;run:Run;tick:number}) {
  const [opened,setOpened]=useState(false),[records,setRecords]=useState<Row[]>([]),[current,setCurrent]=useState<Row>(),[amending,setAmending]=useState(false);
  const load=async()=>setRecords(await api(`/clients/${clientId}/engagement-proposals`));
  useEffect(()=>{if(opened)load().catch(e=>run(async()=>{throw e;}));},[clientId,tick,opened]);
  const select=async(id:string)=>{setCurrent(await api(`/engagement-proposals/${id}`));setAmending(false);};
  const save=async(data:Row)=>run(async()=>{
    const body={...data,currency:'USD',feeCents:Number(data.feeCents),contactIds:[data.signer1,data.signer2],...(amending?{revision:current!.revision}:{})};
    const result=await api(amending?`/engagement-proposals/${current!.id}/amend`:`/jobs/${data.jobId}/engagement-proposals`,body);
    setCurrent(result);setAmending(false);await load();
  },'Proposal version frozen; review the PDF before sending');
  const terms=amending?current?.proposal.terms:undefined,eligible=client.contacts.filter((c:Row)=>c.active&&c.authorized&&c.signer&&c.portal&&c.request_consent);
  return <details onToggle={event=>{if(event.target===event.currentTarget)setOpened(event.currentTarget.open);}}><summary>Engagement proposals</summary>
    {opened&&<section aria-label="Engagement proposals" className="stack" style={{minWidth:0,overflowWrap:'anywhere'}}>
      <h3>Engagement proposals</h3><p>Only the principal can author, amend or send proposal terms. </p><p>Author the terms, review a frozen version and send it to two authorized contacts. Signing records the agreement; billing and onboarding require separate approval. Marketing consent stays separate.</p>
      <ul className="list">{records.map(r=><li key={r.id}><button className="quiet" onClick={()=>run(()=>select(r.id))}>{r.title}</button> · <Status value={r.superseded_by?'superseded':r.status}/></li>)}</ul>
      {current&&<article aria-label="Proposal version" className="record">
        <h3>{current.title}</h3><p><Status value={current.proposal.superseded_by?'superseded':current.status}/> · Version {current.proposal.version} · {current.requester_email} · {when(current.created_at)}</p>
        {current.proposal.terms&&<><p>{current.proposal.terms.scope}</p><p>Exclusions: {current.proposal.terms.exclusions}</p><p>Fee: {money(current.proposal.terms.feeCents,'USD')}</p><p>Retainer: {current.proposal.terms.retainerTerms}</p><p>Renewal: {current.proposal.terms.renewalRules}</p><p>Amendment: {current.proposal.terms.amendmentRules}</p></>}
        <div className="actions"><a href={`/api/blotter/signatures/${current.id}/files/original`}>Frozen letter</a>{current.hasSigned&&<><a href={`/api/blotter/signatures/${current.id}/files/signed`}>Signed letter</a><a href={`/api/blotter/signatures/${current.id}/files/certificate`}>Completion certificate</a></>}</div>
        <ul className="list">{current.signers.map((s:Row)=><li key={s.contact_id}>{s.name} · {s.status}{s.signed_at&&` · ${when(s.signed_at)}`}</li>)}</ul>
        {principal&&!current.proposal.superseded_by&&!['completed','voided'].includes(current.status)&&<div className="actions">
          {['draft','held','declined'].includes(current.status)&&<button onClick={()=>run(async()=>{await api(`/signatures/${current.id}/send`,{revision:current.revision});await select(current.id);await load();},'Signer invitations issued')}>Send proposal for signatures</button>}
          <button className="quiet" onClick={()=>setAmending(true)}>Amend this version</button>
        </div>}
        {current.proposal.superseded_by&&<p>This version cannot accept signatures. Its source and earlier signatures remain in the history.</p>}
        <details><summary>Version history</summary><ul className="list">{current.versions.map((v:Row)=><li key={v.id}><button className="quiet" onClick={()=>run(()=>select(v.id))}>Open version {v.version}</button> · <Status value={v.superseded_by?'superseded':v.status}/></li>)}</ul></details>
        <details><summary>Signing history</summary><ul className="list">{current.events.map((e:Row)=><li key={e.id}>{e.action} · {e.actor} · {when(e.at)} · {e.detail}</li>)}</ul></details>
      </article>}
      {principal&&<details key={amending?current?.id:'new'} open={amending||undefined}><summary>{amending?'Amend proposal terms':'Prepare a proposal'}</summary>
        <Form key={amending?current?.id:'new'} label={amending?'Freeze replacement version':'Freeze proposal version'} submit={save}>
          {amending?<p>The current version and its signing authority will be superseded atomically. Both contacts must sign the replacement.</p>:<Field label="Proposal work" name="jobId"><select name="jobId" required><option value="">Choose authorized work</option>{jobs.filter(j=>j.status!=='signed_off').map(j=><option key={j.id} value={j.id}>{j.title} · {j.period_label}</option>)}</select></Field>}
          <Field label="Proposal title" name="title" value={terms?.title}/>
          {([['scope','Scope'],['exclusions','Exclusions'],['retainerTerms','Retainer terms'],['renewalRules','Renewal rules'],['amendmentRules','Amendment rules']] as const).map(([name,label])=><Field key={name} label={label} name={name}><textarea name={name} required rows={3} defaultValue={terms?.[name]??''}/></Field>)}
          <Field label="Fee in USD cents" name="feeCents" type="number" value={terms?.feeCents}/>
          {[1,2].map(n=><Field key={n} label={`Authorized signer ${n}`} name={`signer${n}`}><select name={`signer${n}`} required defaultValue={amending?current?.signers[n-1]?.contact_id:''}><option value="">Choose a contact</option>{eligible.map((c:Row)=><option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>)}
        </Form>
        {amending&&<button className="quiet" onClick={()=>setAmending(false)}>Cancel amendment</button>}
      </details>}
    </section>}
  </details>;
}
