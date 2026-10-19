import {useEffect,useState} from 'react';
import {api,Field,Form,prose,when,type Row,type Run} from './common';

const ACTIONS:Record<string,string>={'file.uploaded':'File uploaded','file.downloaded':'File downloaded','file.access_changed':'Access changed','file.access_inherited':'Version permissions inherited','file.share_created':'Download link created','file.share_rotated':'Download link rotated','file.share_revoked':'Download link revoked'};
function historyDetail(entry:Row,contacts:Row[]) {
 if(!['file.downloaded','file.access_changed','file.access_inherited','file.share_created','file.share_rotated','file.share_revoked'].includes(entry.action))return prose(entry.detail);
 const data=JSON.parse(entry.detail);
 const name=(id:string)=>contacts.find(c=>c.id===id)?.name??'previously authorized contact';
 if(entry.action==='file.downloaded')return data.channel==='staff'?'Staff access':'Client link; personal identity not verified';
 if(entry.action==='file.access_changed')return data.visibility==='internal'?'Internal only':`Selected contacts: ${data.contactIds.map(name).join(', ')}`;
 if(entry.action==='file.access_inherited')return 'Same visibility and recipients as the preceding version';
 return `${name(data.contactId)}${data.expiresAt ? `; expires ${when(data.expiresAt)}` : ''}`;
}

/** Staff see the recipient preview before granting or issuing a download. */
export function DocumentAccess({fileRef,run}:{fileRef:string;run:Run}) {
 const [access,setAccess]=useState<Row>(),[link,setLink]=useState<Row>();
 const path=`/documents/${encodeURIComponent(fileRef)}`;
 const load=async()=>setAccess(await api(path+'/access'));
 const issue=async(action:()=>Promise<Row>)=>{setLink(await action());await load()};
 return <details onToggle={e=>{if(e.target===e.currentTarget&&e.currentTarget.open)run(load)}}><summary>Document access and shares</summary>
  {access&&<div className="stack" style={{minWidth:0,overflowWrap:'anywhere'}} key={access.revision??'internal'}>
   <p><strong>{access.file.name}</strong> · {access.visibility==='internal'?'Internal only':'Selected contacts'}</p>
   <p className="muted">Staff access follows the job's existing permissions. Contact permissions apply only to this file.</p>
   <ul>{access.contacts.map((c:Row)=><li key={c.id}>{c.name} &lt;{c.email}&gt;: {c.granted?'Granted':c.eligible?'No access':c.reason}</li>)}</ul>
   {access.canManage&&<>
    <Form label="Save document access" submit={async d=>run(async()=>{setLink(undefined);setAccess(await api(path+'/access',{revision:access.revision,visibility:d.visibility,contactIds:d.visibility==='internal'?[]:Object.keys(d).filter(k=>k.startsWith('grant:')&&d[k]==='on').map(k=>k.slice(6))}))},'Document access saved; earlier share links revoked')}>
     <Field label="Visibility" name="visibility"><select name="visibility" defaultValue={access.visibility}><option value="internal">Internal only</option><option value="contacts">Selected contacts</option></select></Field>
     {access.contacts.map((c:Row)=><label className="check" key={c.id}><input type="checkbox" name={'grant:'+c.id} defaultChecked={c.granted} disabled={!c.eligible}/>{c.name} &lt;{c.email}&gt;</label>)}
    </Form>
    {access.visibility==='contacts'&&<Form label="Create download link" submit={async d=>run(()=>issue(()=>api(path+'/shares',{revision:access.revision,contactId:d.contactId,days:Number(d.days)})),'Download link created')}>
     <Field label="Download recipient" name="contactId"><select name="contactId">{access.contacts.filter((c:Row)=>c.granted&&c.eligible).map((c:Row)=><option key={c.id} value={c.id}>{c.name} &lt;{c.email}&gt;</option>)}</select></Field>
     <Field label="Expires in days (1–30)" name="days" type="number" value={7}/>
    </Form>}
    <p className="muted">{access.bearerNotice} Links are shown once. Creating a link does not send it.</p>
    {link&&<div className="notice"><p>Link ready until {when(link.expiresAt)}.</p><input aria-label="Download link shown once" readOnly value={`${location.origin}/api/blotter/shared-files/${link.token}`} onFocus={e=>e.currentTarget.select()}/></div>}
    <ul>{access.shares.map((s:Row)=><li key={s.id}>{access.contacts.find((c:Row)=>c.id===s.contactId)?.name} · {s.state} · expires {when(s.expiresAt)}
     {!s.revokedAt&&<><button className="quiet" onClick={()=>run(()=>issue(()=>api(`${path}/shares/${s.id}/rotate`,{revision:access.revision,days:7})),'Link rotated; earlier copy revoked')}>Rotate link</button><button className="quiet" onClick={()=>run(async()=>{await api(`${path}/shares/${s.id}/revoke`,{revision:access.revision});setLink(undefined);await load()},'Share revoked')}>Revoke link</button></>}
    </li>)}</ul>
   </>}
   <details><summary>Access and download history</summary><ul>{access.history.map((e:Row,i:number)=><li key={i}>{when(e.at)} · {e.actor} · {ACTIONS[e.action]??e.action}: {historyDetail(e,access.contacts)}</li>)}</ul></details>
  </div>}
 </details>;
}

export function DocumentCustody({jobId,run,tick}:{jobId:string;run:Run;tick:number}) {
 const [files,setFiles]=useState<Row[]>([]);
 useEffect(()=>{api(`/jobs/${jobId}/documents`).then(setFiles).catch(e=>run(async()=>{throw e}))},[jobId,tick]);
 if(!files.length)return null;
 return <section className="panel"><h2>Document custody</h2><p className="muted">Uploads, deliverable versions, task attachments, receipts and notice files. Filing a file keeps it internal until explicitly shared.</p>
  <ul>{files.map(f=><li key={f.file_key}><a href={`/api/blotter/documents/${encodeURIComponent(f.file_key)}/file`}>{f.name}</a> · {f.kind} · {f.visibility==='internal'?'Internal only':'Selected contacts'}<DocumentAccess fileRef={f.file_key} run={run}/></li>)}</ul>
 </section>;
}
