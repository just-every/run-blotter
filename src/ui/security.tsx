import { useEffect, useState } from 'react';
import { api, Empty, Field, Form, when, type Row, type Run, ExportLink } from './common';

function Codes({ codes }: { codes: string[] }) {
  if (!codes.length) return null;
  return <div className="notice"><p>Recovery codes: each works once if you lose your authenticator. Store them somewhere safe now; they are not shown again.</p>
    <ul className="list">{codes.map(c => <li key={c}><code>{c}</code></li>)}</ul></div>;
}

const bytes = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4)), c => c.charCodeAt(0));
const text64 = (b: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const ids = (list: Row[]) => list.map(c => ({ type: 'public-key' as const, id: bytes(c.id) }));

/** Register a passkey or security key with this browser; returns recovery codes when it is the first factor. */
async function createPasskey(): Promise<string[]> {
  const o = await api('/mfa/passkey/start', {});
  const credential = await navigator.credentials.create({ publicKey: { ...o, challenge: bytes(o.challenge), user: { ...o.user, id: bytes(o.user.id) }, excludeCredentials: ids(o.excludeCredentials) } }) as PublicKeyCredential;
  const r = credential.response as AuthenticatorAttestationResponse;
  return (await api('/mfa/passkey/confirm', { id: credential.id, clientDataJSON: text64(r.clientDataJSON), attestationObject: text64(r.attestationObject), label: 'Passkey' })).recoveryCodes;
}
/** Confirm this session with a registered passkey or security key. */
async function usePasskey() {
  const o = await api('/mfa/passkey/challenge', {});
  const credential = await navigator.credentials.get({ publicKey: { ...o, challenge: bytes(o.challenge), allowCredentials: ids(o.allowCredentials) } }) as PublicKeyCredential;
  const r = credential.response as AuthenticatorAssertionResponse;
  return api('/mfa/verify', { passkey: { id: credential.id, clientDataJSON: text64(r.clientDataJSON), authenticatorData: text64(r.authenticatorData), signature: text64(r.signature) } });
}

/** Set up an authenticator app (scan or type the key, then confirm a code) or a passkey. */
function EnrollTotp({ done }: { done: (codes: string[]) => void }) {
  const [pending, setPending] = useState<Row>(), [error, setError] = useState('');
  const act = async (job: () => Promise<void>) => { setError(''); try { await job(); } catch (e) { setError((e as Error).message); } };
  return <div className="stack">
    {error && <p className="error" role="alert">{error}</p>}
    {!pending ? <div className="actions">
      <button onClick={() => act(async () => setPending(await api('/mfa/totp/start', { label: 'Authenticator app' })))}>Set up an authenticator app</button>
      <button className="quiet" onClick={() => act(async () => done(await createPasskey()))}>Use a passkey or security key</button>
    </div> : <>
      <p>Add this key to your authenticator app (Google Authenticator, 1Password, Authy or similar), or open the setup link on this device.</p>
      <p><code>{pending.secret.match(/.{1,4}/g).join(' ')}</code> · <a href={pending.uri}>Open in authenticator</a></p>
      <Form label="Confirm code" submit={async data => act(async () => done((await api('/mfa/totp/confirm', { id: pending.id, code: data.code })).recoveryCodes))}>
        <Field label="6-digit code from the app" name="code" />
      </Form>
    </>}
  </div>;
}

/** Shown instead of the workspace while this session still owes a second factor. */
export function MfaGate({ need, done }: { need: 'enroll' | 'verify'; done: () => void }) {
  const [codes, setCodes] = useState<string[]>([]), [error, setError] = useState(''), [recovery, setRecovery] = useState(false);
  const verify = async (body: Row) => { setError(''); try { await api('/mfa/verify', body); done(); } catch (e) { setError((e as Error).message); } };
  return <section className="panel">
    <h2>{need === 'enroll' ? 'Set up a second factor' : 'Confirm it is you'}</h2>
    {error && <p className="error" role="alert">{error}</p>}
    {need === 'enroll' ? (codes.length ? <><Codes codes={codes} /><button onClick={done}>I have stored my recovery codes</button></>
      : <><p className="muted">The practice requires a second factor for every sign-in before anyone sees client work.</p><EnrollTotp done={setCodes} /></>)
      : recovery ? <Form label="Use recovery code" submit={async data => verify({ recoveryCode: data.recoveryCode })}><Field label="Recovery code" name="recoveryCode" /></Form>
        : <Form label="Continue" submit={async data => verify({ code: data.code })}><Field label="6-digit code from your authenticator app" name="code" /></Form>}
    {need === 'verify' && <button className="quiet" onClick={async () => { setError(''); try { await usePasskey(); done(); } catch (e) { setError((e as Error).message); } }}>Use a passkey or security key</button>}
    {need === 'verify' && <button className="quiet" onClick={() => setRecovery(!recovery)}>{recovery ? 'Use my authenticator app' : 'Lost your authenticator? Use a recovery code'}</button>}
  </section>;
}

/** Team & safety: your own factors, and for the principal the firm policy, resets and the enrollment report. */
export function Security({ actor, run, tick }: { actor: Row; run: Run; tick: number }) {
  const [mine, setMine] = useState<Row>(), [firm, setFirm] = useState<Row>(), [codes, setCodes] = useState<string[]>([]), [adding, setAdding] = useState(false);
  const owner = actor.role === 'owner';
  useEffect(() => {
    api('/mfa').then(setMine).catch(e => run(async () => { throw e; }));
    if (owner) api('/team/mfa').then(setFirm).catch(e => run(async () => { throw e; }));
  }, [tick]);
  if (!mine) return null;
  return <section className="panel">
    <h2>Sign-in security</h2>
    <p className="muted">Second factor {firm?.required ?? mine.required ? 'required for every staff sign-in' : 'optional'}. Once you add one, every new sign-in asks for it.</p>
    {!mine.factors.length ? <Empty>You have no second factor yet.</Empty> : <ul className="list">{mine.factors.map((f: Row) => <li key={f.id}>{f.label} · added {when(f.confirmed_at)}{f.last_used_at && ` · last used ${when(f.last_used_at)}`}</li>)}</ul>}
    {mine.factors.length > 0 && <p className="muted">{mine.recoveryCodesLeft} recovery codes left.</p>}
    <Codes codes={codes} />
    <div className="actions">
      {adding ? <EnrollTotp done={c => { setAdding(false); setCodes(c); run(async () => {}, 'Authenticator added'); }} /> : <button className="quiet" onClick={() => setAdding(true)}>Add an authenticator app or passkey</button>}
      {mine.factors.length > 0 && <button className="quiet" onClick={() => run(async () => setCodes((await api('/mfa/recovery-codes', {})).recoveryCodes), 'New recovery codes; earlier ones no longer work')}>New recovery codes</button>}
    </div>
    {owner && firm && <>
      <h3>Practice policy</h3>
      <button onClick={() => run(() => api('/team/mfa-policy', { required: !firm.required }), firm.required ? 'Second factor no longer required' : 'Second factor now required for every staff sign-in')}>
        {firm.required ? 'Stop requiring a second factor' : 'Require a second factor for every staff sign-in'}</button>
      <table className="table"><thead><tr><th>Person</th><th>Second factor</th><th>Last verified</th></tr></thead>
        <tbody>{firm.people.map((p: Row) => <tr key={p.email}><td data-label="Person">{p.name} <small className="muted">{p.email} · {p.role}{p.active ? '' : ' · deactivated'}</small></td>
          <td data-label="Second factor">{p.totp_factors + p.passkey_factors > 0 ? `enrolled ${when(p.enrolled_at)}` : 'not enrolled'}</td><td data-label="Last verified">{when(p.last_verified_at) || '—'}</td></tr>)}</tbody></table>
      <p><ExportLink className="button" href="/api/blotter/team/mfa-report">Download enrollment report (CSV)</ExportLink> <small className="muted">Evidence for your WISP and the FTC Safeguards Rule MFA control; it records who is enrolled and does not certify compliance.</small></p>
      <details><summary>Session lifetime and idle timeout</summary>
        <Form label="Save session limits" submit={async data => run(() => api('/team/session-limits', { sessionMinutes: data.sessionMinutes, idleMinutes: data.idleMinutes }), 'Session limits saved')}>
          <div className="row">
            <Field label="Sign everyone out this many minutes after sign-in" name="sessionMinutes" type="number" required={false} value={firm.sessionMinutes ?? ''} hint="Empty keeps the standard sign-in limit" />
            <Field label="Sign out after this many idle minutes" name="idleMinutes" type="number" required={false} value={firm.idleMinutes ?? ''} hint="Empty means no idle timeout" />
          </div>
        </Form>
      </details>
      <details><summary>Reset someone's lost second factor</summary>
        <Form danger label="Reset and sign them out" submit={async data => run(() => api('/team/mfa-reset', { email: data.email, reason: data.reason }), 'Second factor reset; all their sessions were signed out')}>
          <Field label="Person" name="email"><select name="email">{firm.people.filter((p: Row) => p.role !== 'owner').map((p: Row) => <option key={p.email} value={p.email}>{p.name}</option>)}</select></Field>
          <Field label="Reason (recorded in the audit)" name="reason" />
        </Form>
      </details>
    </>}
  </section>;
}
