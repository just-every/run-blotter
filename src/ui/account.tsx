import { initials, type Row } from './common';

/** The signed-in person's initials in the top bar; it opens their name, role and sign out. */
export function Account({ actor }: { actor: Row }) {
  return <details className="account">
    <summary aria-label={`${actor.name || actor.email}, ${actor.role}`}><span className="avatar">{initials(actor.name || actor.email)}</span></summary>
    <div className="account-menu">
      <p><strong>{actor.name || actor.email}</strong><br /><small className="muted">{actor.email} · {actor.role}</small></p>
      <button className="quiet signout" onClick={async () => { await fetch('/auth/signout', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: '{}' }); location.href = '/signin'; }}>Sign out</button>
    </div>
  </details>;
}
