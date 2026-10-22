import { useT } from './i18n';
import { useEffect, useState } from 'react';
import { api, day, Field, Form, when, type Row, type Run } from './common';

/** The credential fields a client or staff member enters; the stored values are never shown back. */
export function CredentialFields({ credential = {} }: { credential?: Row }) {
  const t = useT();
  return <>
    <Field label={t('cred.name')} name="label" value={credential.label ?? ''} hint={t('cred.nameHint')} />
    <Field label={t('cred.url')} name="url" type="url" required={false} value={credential.url ?? ''} />
    <Field label={t('cred.username')} name="username" />
    <Field label={t('cred.password')} name="password" type="password" />
    <Field label={t('cred.notes')} name="notes" required={false} />
    <Field label={t('cred.rotate')} name="rotateBy" type="date" required={false} value={credential.rotate_by ?? ''} />
  </>;
}

/** Staff list a client's credentials by name; each reveal asks for a fresh second-factor code (VAULT-001). */
export function ClientVault({ clientId, run, tick, owner }: { clientId: string; run: Run; tick: number; owner: boolean }) {
  const [vault, setVault] = useState<Row>(), [shown, setShown] = useState<Row>();
  useEffect(() => { api(`/clients/${clientId}/credentials`).then(setVault).catch(e => run(async () => { throw e; })); }, [clientId, tick]);
  if (!vault) return null;
  return <div className="stack">
    <p className="muted">Stored encrypted. Revealing asks for a new code from your authenticator (or a recovery code), which lasts 5 minutes in this session; every reveal is logged. Rotation dates are reminders on this list only; no message is sent.</p>
    {vault.credentials.map((c: Row) => <details key={c.id}><summary>{c.label}{c.url && ` · ${c.url}`} · updated {when(c.updated_at)} by {c.updated_by}{c.rotationDue && ` · rotation due ${day(c.rotate_by)}`}{c.excluded && ' · not in the restored archive'}{c.erased_at && ` · erased ${day(c.erased_at)} by ${c.erased_by}: ${c.erase_reason}`}</summary>
      {c.erased_at ? null : shown && shown.id === c.id ? <dl>
        <dt>Portal address</dt><dd>{shown.url || '—'}</dd><dt>Username</dt><dd>{shown.username}</dd><dt>Password</dt><dd><code>{shown.password}</code></dd>{shown.notes && <><dt>Notes</dt><dd>{shown.notes}</dd></>}
        <dd><button className="quiet" onClick={() => setShown(undefined)}>Hide</button></dd>
      </dl> : <Form label="Reveal" submit={async data => run(async () => setShown(await api(`/credentials/${c.id}/reveal`, !data.code ? {} : data.code.length > 6 ? { recoveryCode: data.code } : { code: data.code })), 'Revealed; this reveal was logged')}>
        <Field label="Second-factor code" name="code" required={false} hint="A new 6-digit authenticator code or a recovery code. Leave blank within 5 minutes of your last code in this session." />
      </Form>}
      {owner && !c.erased_at && <details><summary>Erase this credential</summary><Form label="Erase credential" danger submit={async data => run(() => api(`/credentials/${c.id}/erase`, data), 'Credential erased; its name and log remain')}>
        <Field label={`Type ${c.label} to confirm`} name="confirm" /><Field label="Reason" name="reason" />
      </Form></details>}
      <details><summary>Replace this credential</summary><Form label="Save credential" submit={async data => run(() => api(`/clients/${clientId}/credentials`, { ...data, id: c.id, revision: c.revision }), 'Credential replaced')}><CredentialFields credential={c} /></Form></details>
    </details>)}
    <details><summary>Add a credential</summary><Form label="Save credential" submit={async data => run(() => api(`/clients/${clientId}/credentials`, data), 'Credential saved')}><CredentialFields /></Form></details>
    {owner && <Form label="Save archive choice" submit={async data => run(() => api('/credentials/archive-mode', data), 'Archive choice saved')}>
      <Field label="Credentials in archives" name="mode"><select name="mode" defaultValue={vault.archiveMode}><option value="encrypt">Include, still encrypted</option><option value="exclude">Leave out</option></select></Field>
    </Form>}
    {vault.reveals.length > 0 && <details><summary>Reveal log</summary><ul className="list">{vault.reveals.map((r: Row, n: number) => <li key={n}>{when(r.at)} · {r.actor} · {r.label} · {r.outcome}</li>)}</ul></details>}
  </div>;
}

/** Opens the client's credentials only when asked, so a client list makes no vault requests. */
export function VaultDetails(props: { clientId: string; run: Run; tick: number; owner: boolean }) {
  const [open, setOpen] = useState(false);
  return <details onToggle={e => setOpen(e.currentTarget.open)}><summary>Client credentials</summary>{open && <ClientVault {...props} />}</details>;
}

/** On the client's link: add or replace logins for the firm; stored secrets are never shown again. */
export function PortalCredentials({ path, busy, act }: { path: string; busy: boolean; act: (work: () => Promise<string>) => Promise<void> }) {
  const t = useT(), [list, setList] = useState<Row[]>();
  const load = async () => { const r = await fetch(`${path}/credentials`); const b: any = await r.json(); if (r.ok) setList(b.credentials); };
  useEffect(() => { load(); }, [path]);
  const save = (body: Row, done: string) => act(async () => {
    const r = await fetch(`${path}/credentials`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const b: any = await r.json(); if (!r.ok) throw new Error(b.error ?? t('cred.failed'));
    await load(); return done;
  });
  if (!list) return null;
  return <section className="panel" aria-labelledby="credentials-title">
    <h2 id="credentials-title">{t('cred.title')}</h2>
    <p className="muted">{t('cred.intro')}</p>
    <ul className="list">{list.map(c => <li key={c.id}><details><summary>{t('cred.updated', { label: c.label, when: when(c.updatedAt) })}</summary>
      <Form label={t('cred.replace')} disabled={busy} submit={async data => save({ ...data, id: c.id, revision: c.revision }, t('cred.updatedDone', { label: c.label }))}><CredentialFields credential={{ label: c.label, url: c.url }} /></Form>
    </details></li>)}</ul>
    <details><summary>{t('cred.add')}</summary><Form label={t('cred.save')} disabled={busy} submit={async data => save(data, t('cred.saved'))}><CredentialFields /></Form></details>
  </section>;
}
