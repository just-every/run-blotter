import { EngagementProposals } from './engagement-proposals';
import { Onboarding } from './onboarding';
import { SignatureRequests } from './signatures';
import { Authorizations } from './authorizations';
import { ClientErasure } from './client-erasure';
import { ClientObligations } from './deadlines';
import { DocumentPackets } from './document-packets';
import { useEffect, useState } from 'react';
import { api, Field, Form, money, when, type Row, type Run } from './common';

const list = (value: string) => value.split(',').map(s => s.trim()).filter(Boolean);
const FLAGS = [['authorized','Authorized for this entity'],['signer','Authorized signer'],['portal','Portal access'],['requestConsent','Document requests allowed'],['emailConsent','Email allowed'],['active','Active contact']] as const;
function ContactForm({ contact = {}, clientId, run }: { contact?: Row; clientId: string; run: Run }) {
  return <Form label={contact.id ? 'Save contact' : 'Add contact'} submit={async data => run(() => api(`/clients/${clientId}/contacts`, {
    ...data, id: contact.id, revision: contact.revision, roles: list(data.roles),
    ...Object.fromEntries(FLAGS.map(([key]) => [key, data[key] === 'true'])),
  }), 'Contact saved; links issued before an access change are revoked')}>
    <div className="row"><Field label="First name" name="firstName" value={contact.first_name ?? ''} required={false} /><Field label="Last name" name="lastName" value={contact.last_name ?? ''} required={false} /></div>
    <Field label="Display name" name="name" value={contact.name ?? ''} />
    <Field label="Email" name="email" type="email" value={contact.email ?? ''} required={false} />
    <Field label="Phone (US or international)" name="phone" value={contact.phone ?? ''} required={false} />
    <Field label="Roles, separated by commas" hint="primary, billing, tax, bookkeeping" name="roles" value={(contact.roles ?? []).join(', ')} required={false} />
    {FLAGS.map(([key,label]) => { const column = key === 'requestConsent' ? 'request_consent' : key === 'emailConsent' ? 'email_consent' : key; return <Field key={key} label={label} name={key}><select name={key} defaultValue={String(Boolean(contact[column] ?? (key === 'active')))}><option value="false">No</option><option value="true">Yes</option></select></Field>; })}
    <Field label="Authority and consent note" name="consentNote" value={contact.consent_note ?? ''} required={false} />
    <Field label="Language for this contact" name="language" hint="Portal, emails, organizers and signature screens use it; templates warn when they have no version in it."><select name="language" defaultValue={contact.language ?? 'en'}><option value="en">English</option><option value="es">Español (Spanish)</option></select></Field>
  </Form>;
}
export function ClientDetails({ clientId, state, run, tick }: { clientId: string; state: Row; run: Run; tick: number }) {
  const [detail,setDetail] = useState<Row>(), [opened,setOpened] = useState(false);
  useEffect(() => { if (opened) api(`/clients/${clientId}/detail`).then(setDetail).catch(e => run(async () => { throw e; })); }, [clientId,tick,opened]);
  return <details onToggle={e => setOpened(e.currentTarget.open)}><summary>Client details and contacts</summary>
    {detail && <div className="stack" key={detail.revision}>
      {state.actor.role === 'owner' && detail.lifecycle === 'active' && <Onboarding clientId={clientId} state={state} />}
      {!detail.erased_at&&<EngagementProposals clientId={clientId} client={detail} jobs={state.jobs.filter((j:Row)=>j.client_id===clientId)} principal={state.actor.role==='owner'} run={run} tick={tick}/>}
      <CreditHold clientId={clientId} hold={detail.creditHold} partner={state.actor.role === 'owner' || Boolean(state.actor.financial)} run={run} />
      <details><summary>Client document folders</summary><SignatureRequests clientId={clientId} run={run} tick={tick}/><DocumentPackets clientId={clientId} run={run} tick={tick} /></details>
      {state.actor.role === 'owner' && <details open={detail.erased_at ? true : undefined}><summary>Retention, holds and erasure</summary><ClientErasure clientId={clientId} client={detail} jobs={state.jobs.filter((j: Row) => j.client_id === clientId)} run={run} tick={tick} /></details>}
      <details><summary>Taxpayer authorizations</summary><Authorizations clientId={clientId} client={detail} jobs={state.jobs.filter((j: Row) => j.client_id === clientId)} lead={state.actor.role !== 'preparer'} run={run} tick={tick} /></details>
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
      {state.actor.role !== 'preparer' && <details><summary>Client portal access</summary><PortalAccess clientId={clientId} contacts={detail.contacts} owner={state.actor.role === 'owner'} run={run} tick={tick} /></details>}
      <details><summary>Add another contact</summary><ContactForm clientId={clientId} run={run} /></details>
    </div>}
  </details>;
}

/** BILL-005: staff see a credit hold on the client; a partner can override it with a recorded reason. New work still proceeds with a warning. */
function CreditHold({ clientId, hold, partner, run }: { clientId: string; hold: Row; partner: boolean; run: Run }) {
  if (!hold?.onHold && !hold?.overridden) return null;
  return <section className="notice" aria-label="Credit hold" role="status">
    <p><strong>{hold.onHold ? 'Credit hold' : 'Credit hold overridden'}</strong>{hold.overdueCents !== null && <> · overdue balance {money(hold.overdueCents)} against the firm threshold of {money(hold.thresholdCents)}</>}. New work for this client shows this warning.</p>
    {hold.override && <p>Overridden by {hold.override.approved_by} {when(hold.override.approved_at)}: {hold.override.reason}</p>}
    {!partner ? null : hold.onHold ? <details><summary>Override the credit hold</summary><Form label="Override credit hold" submit={data => run(() => api(`/clients/${clientId}/credit-hold/override`, data), 'Credit hold overridden; reason recorded')}><Field label="Override reason" name="reason" /></Form></details>
      : <Form danger label="Restore credit hold" submit={data => run(() => api(`/clients/${clientId}/credit-hold/override`, { ...data, revoke: true }), 'Credit hold restored')}><Field label="Reason to restore" name="reason" /></Form>}
  </section>;
}

/** PORTAL-002: invite a contact to the signed-in client portal for this entity, revoke that access, or (principal) reset a lost second factor. */
function PortalAccess({ clientId, contacts, owner, run, tick }: { clientId: string; contacts: Row[]; owner: boolean; run: Run; tick: number }) {
  const [access, setAccess] = useState<Row>();
  const reload = async () => setAccess(await api(`/clients/${clientId}/portal-access`));
  useEffect(() => { reload().catch(e => run(async () => { throw e; })); }, [clientId, tick]);
  if (!access) return null;
  const grantOf = (contactId: string) => access.grants.find((g: Row) => g.contactId === contactId);
  const eligible = contacts.filter((c: Row) => c.active && c.authorized && c.portal && c.email && c.email_consent);
  return <div className="stack">
    <p className="muted">Each invitation opens this entity only, for that contact's email address. The client signs in with an emailed link{access.policy.mfaRequired ? ' and a required second factor' : ''}; revoking access ends it on their next request.</p>
    {eligible.length === 0 ? <p className="muted">No contact can be invited: a contact needs entity authority, portal permission, an email address and email consent.</p>
      : <ul className="list">{eligible.map((c: Row) => { const g = grantOf(c.id); return <li key={c.id}>
        <strong>{c.name || c.email}</strong> <small className="muted">{c.email} · {g ? `${g.status}${g.acceptedAt ? ` since ${when(g.acceptedAt)}` : ` (invited ${when(g.invitedAt)})`}${g.factor ? ' · second factor set' : ''}` : 'no portal access'}</small>
        <div className="actions">
          <button className="quiet" onClick={() => run(async () => { await api(`/clients/${clientId}/contacts/${c.id}/portal-invite`, {}); await reload(); }, `Portal invitation sent to ${c.email}`)}>{g && g.status !== 'revoked' ? 'Send a new invitation' : 'Invite to the client portal'}</button>
        </div>
        {g && g.status !== 'revoked' && <Form danger label={`Revoke portal access for ${c.name || c.email}`} submit={async data => run(async () => { await api(`/clients/${clientId}/contacts/${c.id}/portal-revoke`, data); await reload(); }, 'Portal access revoked')}><Field label="Reason to revoke" name="reason" /></Form>}
        {owner && g?.factor && <Form danger label={`Reset ${c.name || c.email}'s second factor`} submit={async data => run(async () => { await api(`/portal-accounts/${g.accountId}/reset`, data); await reload(); }, 'Second factor reset; their portal sessions ended')}><Field label="Reason (recorded in the audit)" name="reason" /></Form>}
      </li>; })}</ul>}
  </div>;
}
