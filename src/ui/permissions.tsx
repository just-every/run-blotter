import { useEffect, useState } from 'react';
import { api, Empty, Field, Form, type Row, type Run } from './common';

const values=(data:Row,key:string)=>String(data[key]??'').split(/[\n,]+/).map(s=>s.trim()).filter(Boolean);
/** Principal's existing Team & safety screen, using the established forms. */
export function Permissions({state,run,tick}:{state:Row;run:Run;tick:number}) {
  const [policy,setPolicy]=useState<Row>();
  useEffect(()=>{api('/access').then(setPolicy).catch(e=>run(async()=>{throw e;}));},[tick]);
  if(!policy)return null;
  const clientNames=(ids:string[])=>ids.map(id=>state.clients.find((c:Row)=>c.id===id)?.name??id).join(', ')||'No clients';
  return <section className="panel wide" aria-label="Client and document permissions">
    <h2>Client and document permissions</h2>
    <p>Teams may overlap. A scoped person with no client grants cannot read any client, even through an old session, API or assignment. A grant preserves their existing work role. Read-only access refuses changes.</p>
    <h3>Confirm sensitive access</h3>
    <p className="muted">Use a fresh authenticator or recovery code before changing access or downloading an export. Confirmation lasts five minutes in this session.</p>
    <Form label="Confirm sensitive access" submit={async data=>run(()=>api('/access/step-up',data),'Sensitive access confirmed for five minutes')}>
      <Field label="Authenticator code" name="code" required={false}/><Field label="Or one unused recovery code" name="recoveryCode" required={false}/>
    </Form>
    <h3>Teams</h3>
    {!policy.teams.length?<Empty>No access teams configured.</Empty>:<ul className="list">{policy.teams.map((t:Row)=><li key={t.id}><strong>{t.name}</strong><p>{policy.teamMembers.filter((m:Row)=>m.team_id===t.id).map((m:Row)=>m.email).join(', ')||'No staff'} · {clientNames(policy.teamClients.filter((c:Row)=>c.team_id===t.id).map((c:Row)=>c.client_id))}</p><small>Team reference: {t.id}</small></li>)}</ul>}
    <details><summary>Add or replace a team's grants</summary>
      <Form label="Save access team" submit={async data=>run(()=>api('/access/teams',{...data,emails:values(data,'emails'),clientIds:values(data,'clientIds')}),'Team grants saved')}>
        <Field label="Existing team reference (empty creates a team)" name="id" required={false}/><Field label="Team name" name="name"/>
        <Field label="Staff emails, one per line" name="emails"><textarea name="emails"/></Field>
        <Field label="Client references, one per line" name="clientIds"><textarea name="clientIds"/></Field>
      </Form>
    </details>
    <h3>Individual access</h3>
    <ul className="list">{policy.members.map((m:Row)=><li key={m.email}><strong>{m.email}</strong> · {m.read_only?'Read-only':'Existing work role'} · {clientNames(policy.grants.filter((g:Row)=>g.email===m.email).map((g:Row)=>g.client_id))} (plus team grants)</li>)}</ul>
    <Form label="Save individual access" submit={async data=>run(()=>api('/access/people',{email:data.email,readOnly:data.readOnly==='true',clientIds:values(data,'clientIds')}),'Individual grants saved')}>
      <Field label="Person's email" name="email" type="email"/><Field label="Permission" name="readOnly"><select name="readOnly"><option value="false">Existing work role</option><option value="true">Read-only</option></select></Field>
      <Field label="Direct client references, one per line (empty revokes direct grants)" name="clientIds"><textarea name="clientIds"/></Field>
    </Form>
    <details><summary>Client references</summary><ul className="list">{state.clients.map((c:Row)=><li key={c.id}>{c.name}: <code>{c.id}</code></li>)}</ul></details>
    <h3>Sensitive workpapers</h3>
    <p>Restricted documents are internal. Only the principal and the named staff who also hold client and job access can read them. Restricting revokes existing contact grants and share links.</p>
    <ul className="list">{policy.sensitive.map((d:Row)=><li key={d.file_key}>{d.classification} · {d.file_key} · {policy.documentGrants.filter((g:Row)=>g.file_key===d.file_key).map((g:Row)=>g.email).join(', ')||'Principal only'}</li>)}</ul>
    <Form label="Restrict document" submit={async data=>run(()=>api('/access/documents/'+encodeURIComponent(data.fileKey),{classification:data.classification,reason:data.reason,emails:values(data,'emails')}),'Document restricted; old shares revoked')}>
      <Field label="Document reference" name="fileKey"/><Field label="Classification" name="classification" value="Sensitive workpaper"/>
      <Field label="Permitted staff emails, one per line (empty means principal only)" name="emails"><textarea name="emails"/></Field><Field label="Reason recorded in audit" name="reason"/>
    </Form>
  </section>;
}
