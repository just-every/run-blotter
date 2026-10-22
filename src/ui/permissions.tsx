import { useEffect, useState } from 'react';
import { api, Empty, Field, Form, type Row, type Run } from './common';

const values=(form:HTMLFormElement,key:string)=>new FormData(form).getAll(key).map(String).filter(Boolean);
/** Principal's existing Team & safety screen, using the established forms. */
export function Permissions({state,run,tick}:{state:Row;run:Run;tick:number}) {
  const [policy,setPolicy]=useState<Row>(),[teamId,setTeamId]=useState('');
  useEffect(()=>{api('/access').then(setPolicy).catch(e=>run(async()=>{throw e;}));},[tick]);
  if(!policy)return null;
  const clientNames=(ids:string[])=>ids.map(id=>state.clients.find((c:Row)=>c.id===id)?.name??id).join(', ')||'No clients';
  const grantable=state.clients.filter((c:Row)=>!c.erased_at);
  const staff=state.people.filter((p:Row)=>p.role!=='owner');
  const principal=state.actor.role==='owner',named=(address:string)=>state.people.find((p:Row)=>p.email===address)?.name??address;
  const selectedTeam=policy.teams.find((t:Row)=>t.id===teamId);
  return <section className="panel wide" aria-label="Client and document permissions">
    <h2>Client and document permissions</h2>
    <p>Teams may overlap. A scoped person with no client grants cannot read any client, even through an old session, API or assignment. A grant preserves their existing work role. Read-only access refuses changes.</p>
    <h3>Confirm sensitive access</h3>
    <p className="muted">Use a fresh authenticator or recovery code before changing access or downloading an export. Confirmation lasts five minutes in this session.</p>
    <Form label="Confirm sensitive access" submit={async data=>run(()=>api('/access/step-up',data),'Sensitive access confirmed for five minutes')}>
      <Field label="Authenticator code" name="code" required={false}/><Field label="Or one unused recovery code" name="recoveryCode" required={false}/>
    </Form>
    <h3>Delegated permissions</h3>
    <p>The principal may grant a named member <strong>manage access</strong> (teams, individual grants and restricted documents for clients the holder also holds, never for itself or the principal) and <strong>financial authority</strong> (firm financial reports and invoices for the clients the holder holds). Each grant is audited, needs confirmation and can be revoked at any time; revoking applies to the holder's next request.</p>
    {!policy.delegations.length?<Empty>No delegated permissions.</Empty>:<ul className="list">{policy.delegations.map((d:Row)=><li key={d.email+d.permission}><strong>{named(d.email)}</strong> · {d.permission==='manage_access'?'Manage access':'Financial authority'} · {d.reason}</li>)}</ul>}
    {principal&&<Form label="Save delegated permissions" submit={async(data,form)=>run(()=>api('/access/delegations',{email:data.email,permissions:values(form,'permissions'),reason:data.reason}),'Delegated permissions saved')}>
      <Field label="Staff member" name="email"><select name="email">{staff.map((m:Row)=><option key={m.email} value={m.email}>{m.name} · {m.email}</option>)}</select></Field>
      <Field label="Permissions (select none to revoke both)" name="permissions"><select multiple name="permissions"><option value="manage_access">Manage access</option><option value="financial_authority">Financial authority</option></select></Field>
      <Field label="Reason recorded in audit" name="reason"/>
    </Form>}
    <h3>Teams</h3>
    {!policy.teams.length?<Empty>No access teams configured.</Empty>:<ul className="list">{policy.teams.map((t:Row)=><li key={t.id}><strong>{t.name}</strong><p>{policy.teamMembers.filter((m:Row)=>m.team_id===t.id).map((m:Row)=>m.email).join(', ')||'No staff'} · {clientNames(policy.teamClients.filter((c:Row)=>c.team_id===t.id).map((c:Row)=>c.client_id))}</p><small>Team reference: {t.id}</small></li>)}</ul>}
    <details><summary>Add or replace a team's grants</summary>
      <Field label="Team to change" name="team"><select value={teamId} onChange={e=>setTeamId(e.target.value)}><option value="">Create a team</option>{policy.teams.map((t:Row)=><option key={t.id} value={t.id}>{t.name}</option>)}</select></Field>
      <Form key={teamId} label="Save access team" submit={async(data,form)=>run(()=>api('/access/teams',{...data,id:teamId||undefined,emails:values(form,'emails'),clientIds:values(form,'clientIds')}),'Team grants saved')}>
        <Field label="Team name" name="name" value={selectedTeam?.name}/>
        <Field label="Team staff (select all who belong)" name="emails"><select multiple name="emails" defaultValue={policy.teamMembers.filter((m:Row)=>m.team_id===teamId).map((m:Row)=>m.email)}>{staff.map((m:Row)=><option key={m.email} value={m.email}>{m.name} · {m.email}</option>)}</select></Field>
        <Field label="Team clients (select all grants)" name="clientIds"><select multiple name="clientIds" defaultValue={policy.teamClients.filter((c:Row)=>c.team_id===teamId).map((c:Row)=>c.client_id)}>{grantable.map((c:Row)=><option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
      </Form>
    </details>
    <h3>Individual access</h3>
    <ul className="list">{policy.members.map((m:Row)=><li key={m.email}><strong>{m.email}</strong> · {m.read_only?'Read-only':'Existing work role'} · {clientNames(policy.grants.filter((g:Row)=>g.email===m.email).map((g:Row)=>g.client_id))} (plus team grants)</li>)}</ul>
    <Form label="Save individual access" submit={async(data,form)=>run(()=>api('/access/people',{email:data.email,readOnly:data.readOnly==='true',clientIds:values(form,'clientIds')}),'Individual grants saved')}>
      <Field label="Staff member" name="email"><select name="email">{staff.map((m:Row)=><option key={m.email} value={m.email}>{m.name} · {m.email}</option>)}</select></Field><Field label="Permission" name="readOnly"><select name="readOnly"><option value="false">Existing work role</option><option value="true">Read-only</option></select></Field>
      <Field label="Direct client grants (select none to revoke)" name="clientIds"><select multiple name="clientIds">{grantable.map((c:Row)=><option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
    </Form>
    <details><summary>Client references</summary><ul className="list">{grantable.map((c:Row)=><li key={c.id}>{c.name}: <code>{c.id}</code></li>)}</ul></details>
    <h3>Sensitive workpapers</h3>
    <p>Restricted documents are internal. Only the principal and the named staff who also hold client and job access can read them. Restricting revokes existing contact grants and share links.</p>
    <ul className="list">{policy.sensitive.map((d:Row)=><li key={d.file_key}>{d.classification} · {d.file_key} · {policy.documentGrants.filter((g:Row)=>g.file_key===d.file_key).map((g:Row)=>g.email).join(', ')||'Principal only'}</li>)}</ul>
    <Form label="Restrict document" submit={async(data,form)=>run(()=>api('/access/documents/'+encodeURIComponent(data.fileKey),{classification:data.classification,reason:data.reason,emails:values(form,'emails')}),'Document restricted; old shares revoked')}>
      <Field label="Document reference" name="fileKey"/><Field label="Classification" name="classification" value="Sensitive workpaper"/>
      <Field label="Permitted staff (select none for principal only)" name="emails"><select multiple name="emails">{staff.map((m:Row)=><option key={m.email} value={m.email}>{m.name} · {m.email}</option>)}</select></Field><Field label="Reason recorded in audit" name="reason"/>
    </Form>
  </section>;
}
