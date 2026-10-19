import { type Row } from './common';

export type ImportDecision = { action: 'create' | 'match'; clientId?: string };
export type ImportDecisions = Record<string, ImportDecision>;
export type ImportColumns = { headers: string[]; fields: string[]; defaults: Record<string, string> };

export function ImportMapping({ columns, mapping, change }: { columns: ImportColumns; mapping: Record<string, string>; change: (field: string, source: string) => void }) {
  return <details open>
    <summary>Map CSV columns</summary>
    <p className="muted">Choose the source column for each client or contact field. Repeated client IDs group contacts into one entity. Unmapped columns remain in the protected original file.</p>
    <div className="grid">{columns.fields.map(field => <label key={field}>{field}{field === 'client_name' ? ' (required)' : ''}
      <select value={mapping[field] ?? ''} onChange={event => change(field, event.target.value)}>
        <option value="">Ignore / not supplied</option>
        {columns.headers.map(header => <option key={header} value={header}>{header}</option>)}
      </select>
    </label>)}</div>
  </details>;
}

export function ImportEntityDecision({ client, decision, change }: { client: Row; decision?: ImportDecision; change: (decision: ImportDecision) => void }) {
  const candidates: Row[] = client.candidates ?? [];
  if (!candidates.length) return client.matches ? <small className="muted">Already matches {client.matches.name}</small> : <small className="muted">Create a new entity</small>;
  return <div>
    <label>Import decision for {client.name}
      <select value={!decision ? '' : decision.action === 'create' ? 'create' : `match:${decision.clientId}`} onChange={event => {
        const value = event.target.value;
        if (value) change(value === 'create' ? { action: 'create' } : { action: 'match', clientId: value.slice(6) });
      }}>
        <option value="" disabled>Choose how to handle this entity</option>
        <option value="create">Keep separate: create a new entity</option>
        {candidates.map(candidate => <option key={candidate.id} value={`match:${candidate.id}`}>Match existing: {candidate.name}</option>)}
      </select>
    </label>
    <ul>{candidates.map(candidate => <li key={candidate.id}>{candidate.name}: {candidate.reasons.join(', ')}</li>)}</ul>
  </div>;
}

export function ImportContacts({ contacts }: { contacts: Row[] }) {
  return <details><summary>{contacts.length} contacts and permissions</summary>
    <ul>{contacts.map((contact, index) => <li key={index}>
      <strong>{contact.name}</strong> {contact.email} {contact.phone}
      <p>Roles: {Array.isArray(contact.roles) ? contact.roles.join(', ') || 'None' : JSON.parse(contact.roles || '[]').join(', ') || 'None'}</p>
      <p>Entity authority: {contact.authorized ? 'Yes' : 'No'} · Signer: {contact.signer ? 'Yes' : 'No'} · Portal access: {contact.portal ? 'Yes' : 'No'}</p>
      <p>Request consent: {contact.request_consent ? 'Yes' : 'No'} · Email consent: {contact.email_consent ? 'Yes' : 'No'}</p>
      {contact.consent_note && <p>{contact.consent_note}</p>}
    </li>)}</ul>
  </details>;
}
