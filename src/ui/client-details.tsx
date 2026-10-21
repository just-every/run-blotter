import { SignatureRequests } from './signatures';
import { ClientErasure } from './client-erasure';
import { ClientObligations } from './deadlines';
import { DocumentPackets } from './document-packets';
import { useEffect, useState } from 'react';
import { api, Field, Form, type Row, type Run } from './common';

const list = (value: string) => value.split(',').map(s => s.trim()).filter(Boolean);
const FLAGS = [['authorized','Authorized for this entity'],['signer','Authorized signer'],['portal','Portal access'],['requestConsent','Document requests allowed'],['emailConsent','Email allowed'],['active','Active contact']] as const;
function ContactForm({ contact = {}, clientId, run }: { contact?: Row; clientId: string; run: Run }) {
  return <Form label={contact.id ? 'Save contact' : 'Add contact'} submit={async data => run(() => api(`/clients/${clientId}/contacts`, {
    ...data, id: contact.id, revision: contact.revision, roles: list(data.roles),
    ...Object.fromEntries(FLAGS.map(([key]) => [key, data[key] === 'true'])),
  }), 'Contact saved; previous links revoked')}>
    <div className="row"><Field label="First name" name="firstName" value={contact.first_name ?? ''} required={false} /><Field label="Last name" name="lastName" value={contact.last_name ?? ''} required={false} /></div>
    <Field label="Display name" name="name" value={contact.name ?? ''} />
    <Field label="Email" name="email" type="email" value={contact.email ?? ''} required={false} />
    <Field label="Phone (US or international)" name="phone" value={contact.phone ?? ''} required={false} />
    <Field label="Roles, separated by commas" hint="primary, billing, tax, bookkeeping" name="roles" value={(contact.roles ?? []).join(', ')} required={false} />
    {FLAGS.map(([key,label]) => { const column = key === 'requestConsent' ? 'request_consent' : key === 'emailConsent' ? 'email_consent' : key; return <Field key={key} label={label} name={key}><select name={key} defaultValue={String(Boolean(contact[column] ?? (key === 'active')))}><option value="false">No</option><option value="true">Yes</option></select></Field>; })}
    <Field label="Authority and consent note" name="consentNote" value={contact.consent_note ?? ''} required={false} />
  </Form>;
}
export function ClientDetails({ clientId, state, run, tick }: { clientId: string; state: Row; run: Run; tick: number }) {
  const [detail,setDetail] = useState<Row>(), [opened,setOpened] = useState(false);
  useEffect(() => { if (opened) api(`/clients/${clientId}/detail`).then(setDetail).catch(e => run(async () => { throw e; })); }, [clientId,tick,opened]);
  return <details onToggle={e => setOpened(e.currentTarget.open)}><summary>Client details and contacts</summary>
    {detail && <div className="stack" key={detail.revision}>
      <details><summary>Client document folders</summary><SignatureRequests clientId={clientId} run={run} tick={tick}/><DocumentPackets clientId={clientId} run={run} tick={tick} /></details>
      {state.actor.role === 'owner' && <details open={detail.erased_at ? true : undefined}><summary>Retention, holds and erasure</summary><ClientErasure clientId={clientId} client={detail} jobs={state.jobs.filter((j: Row) => j.client_id === clientId)} run={run} tick={tick} /></details>}
      <details><summary>Deadline obligations</summary><ClientObligations clientId={clientId} lead={state.actor.role !== 'preparer'} run={run} tick={tick} /></details>
      <p>{detail.entity_type} · {detail.lifecycle}{detail.ssn_last4 && ` · SSN ${detail.ssn_last4}`}</p>
      <p className="muted">Contact permissions apply only to this entity. A job link proves possession of the link; it does not verify a person's identity.</p>
      <details><summary>Edit client</summary><Form label="Save client" submit={async data => run(() => api(`/clients/${clientId}/edit`, {
        ...data, revision:detail.revision, team:list(data.team), services:list(data.services), ...(data.ssnLast4 ? {} : {ssnLast4:undefined}),
      }), 'Client saved')}>
        <Field label="Client name" name="name" value={detail.name} />
        <Field label="Entity type" name="entityType"><select name="entityType" defaultValue={detail.entity_type}><option value="business">Business</option><option value="individual">Individual</option><option value="trust">Trust</option></select></Field>
        <Field label="Responsible partner" name="partnerEmail" required={false}><select name="partnerEmail" defaultValue={detail.partner_email}><option value="">Unassigned</option>{state.people.filter((p: Row) => p.role !== 'preparer').map((p: Row) => <option key={p.email} value={p.email}>{p.name}</option>)}</select></Field>
        <Field label="Assigned team emails, separated by commas" name="team" value={detail.team.join(', ')} required={false} />
        <Field label="Services, separated by commas" name="services" value={detail.services.join(', ')} required={false} />
        <Field label="Related owner or household client" name="ownerClientId" required={false}><select name="ownerClientId" defaultValue={detail.owner_client_id ?? ''}><option value="">None</option>{state.clients.filter((c: Row) => c.id !== clientId).map((c: Row) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        <Field label="Replace last four SSN digits (individuals only)" name="ssnLast4" required={false} hint="Only four digits are stored. Leave blank to keep the current value." />
      </Form></details>
      <button className="quiet" onClick={() => run(() => api(`/clients/${clientId}/lifecycle`, {revision:detail.revision,lifecycle:detail.lifecycle === 'active' ? 'archived' : 'active'}), detail.lifecycle === 'active' ? 'Client archived; history retained' : 'Client reactivated')}>{detail.lifecycle === 'active' ? 'Archive client' : 'Reactivate client'}</button>
      {detail.contacts.map((c: Row) => <details key={c.id}><summary>{c.name || c.email} · {c.roles.join(', ') || 'no routing role'}{!c.authorized && ' · no entity authority'}{!c.active && ' · inactive'}</summary><ContactForm contact={c} clientId={clientId} run={run} /></details>)}
      <details><summary>Add another contact</summary><ContactForm clientId={clientId} run={run} /></details>
    </div>}
  </details>;
}
