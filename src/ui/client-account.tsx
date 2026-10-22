import { useEffect, useState } from 'react';
import { Field, Form, moneyText, Status, day, type Row } from './common';
import { LanguageProvider, useT } from './i18n';
import type { Language } from '../i18n/catalog';

const BASE = '/api/blotter/client';
async function call(path: string, body?: Row) {
  const response = await fetch(BASE + path, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {});
  const result = await response.json().catch(() => ({})) as Row;
  if (!response.ok) throw Object.assign(new Error(result.error ?? 'Request failed'), { status: response.status });
  return result;
}

/** PORTAL-002: the signed-in client portal. An emailed link proves the address; a second factor follows; one entity shows at a time. */
export function ClientAccount() {
  const [me, setMe] = useState<Row | null>(), [entity, setEntity] = useState<Row>(), [chosen, setChosen] = useState(''), [link, setLink] = useState<{ kind: 'invite' | 'signin'; token: string }>();
  const [notice, setNotice] = useState(''), [failure, setFailure] = useState(''), [codes, setCodes] = useState<string[]>([]), [branding, setBranding] = useState<Row>();
  const load = async () => {
    try { const m = await call('/me'); setMe(m); const first = m.entities.find((e: Row) => e.clientId === chosen) ?? m.entities[0]; setChosen(first?.clientId ?? ''); setEntity(first ? await call(`/entities/${first.clientId}`) : undefined); }
    catch (e) { if ((e as { status?: number }).status === 401) { setMe(null); setEntity(undefined); } else setFailure((e as Error).message); }
  };
  useEffect(() => {
    const query = new URLSearchParams(window.location.search), invite = query.get('invite'), signin = query.get('signin');
    // The token leaves the address bar at once; it is spent only when the client presses the button.
    if (invite || signin) { setLink(invite ? { kind: 'invite', token: invite } : { kind: 'signin', token: signin! }); window.history.replaceState(null, '', '/client'); }
    load(); call('/branding').then(setBranding).catch(() => undefined);
  }, []);
  const act = async (work: () => Promise<string | void>) => { setFailure(''); setNotice(''); try { const message = await work(); if (message) setNotice(message); } catch (e) { setFailure((e as Error).message); } };
  const language = (entity?.language ?? me?.language ?? 'en') as Language;
  return <LanguageProvider language={language}>
    <Page branding={branding} me={me} entity={entity} chosen={chosen} link={link} notice={notice} failure={failure} codes={codes}
      spend={() => act(async () => { await call(link!.kind === 'invite' ? '/accept' : '/sign-in/confirm', { token: link!.token }); setLink(undefined); await load(); })}
      choose={clientId => act(async () => { setChosen(clientId); setEntity(await call(`/entities/${clientId}`)); })}
      act={act} load={load} setCodes={setCodes} setEntity={setEntity} setMe={setMe} />
  </LanguageProvider>;
}

type PageProps = { branding?: Row; me?: Row | null; entity?: Row; chosen: string; link?: { kind: 'invite' | 'signin'; token: string }; notice: string; failure: string; codes: string[]; spend: () => void; choose: (clientId: string) => void;
  act: (work: () => Promise<string | void>) => Promise<void>; load: () => Promise<void>; setCodes: (codes: string[]) => void; setEntity: (entity?: Row) => void; setMe: (me: Row | null) => void };

function Page(p: PageProps) {
  const t = useT();
  return <div className="portal"><main id="portal-main" className="stack" style={p.branding?.accent ? { borderTop: `6px solid ${p.branding.accent}`, paddingTop: '1rem' } : undefined}>
    {p.branding?.logo && <img src={p.branding.logo} alt={t('account.logo')} style={{ maxHeight: 64, maxWidth: 220, objectFit: 'contain', alignSelf: 'flex-start' }} />}
    {p.me?.firm && <p className="eyebrow">{p.me.firm}</p>}<h1>{t('account.title')}</h1>
    {p.notice && <p className="notice" role="status">{p.notice}</p>}{p.failure && <p className="error" role="alert">{p.failure}</p>}
    {p.link ? <section className="panel"><button onClick={p.spend}>{t(p.link.kind === 'invite' ? 'account.accept' : 'account.continue')}</button></section>
      : p.me === undefined ? null : p.me === null ? <SignIn act={p.act} />
      : p.codes.length ? <RecoveryCodes codes={p.codes} done={() => { p.setCodes([]); p.load(); }} />
      : p.me.mfa ? <Factor need={p.me.mfa} act={p.act} load={p.load} setCodes={p.setCodes} />
      : <Home {...p} me={p.me} />}
  </main></div>;
}

function SignIn({ act }: { act: PageProps['act'] }) {
  const t = useT();
  return <section className="panel" aria-labelledby="sign-in"><h2 id="sign-in">{t('account.signIn')}</h2>
    <Form label={t('account.sendLink')} submit={async (data, form) => act(async () => { await call('/sign-in', { email: data.email }); form.reset(); return t('account.linkSent'); })}>
      <Field label={t('account.email')} name="email" type="email" />
    </Form></section>;
}

function Factor({ need, act, load, setCodes }: { need: 'enroll' | 'verify'; act: PageProps['act']; load: () => Promise<void>; setCodes: (codes: string[]) => void }) {
  const t = useT(), [setup, setSetup] = useState<Row>(), [recovery, setRecovery] = useState(false);
  if (need === 'enroll') return <section className="panel stack" aria-labelledby="enroll"><h2 id="enroll">{t('account.enrollTitle')}</h2><p>{t('account.enrollIntro')}</p>
    {!setup ? <button onClick={() => act(async () => setSetup(await call('/factor/start', {})))}>{t('account.start')}</button> : <>
      <p>{t('account.key')}: <code>{setup.secret}</code></p><p className="muted" style={{ overflowWrap: 'anywhere' }}><a href={setup.uri}>{setup.uri}</a></p>
      <Form label={t('account.confirm')} submit={async data => act(async () => { setCodes((await call('/factor/confirm', { code: data.code })).recoveryCodes); })}><Field label={t('account.code')} name="code" /></Form>
    </>}</section>;
  return <section className="panel stack" aria-labelledby="verify"><h2 id="verify">{t('account.verifyTitle')}</h2>
    {recovery ? <Form label={t('account.useRecovery')} submit={async data => act(async () => { await call('/verify', { recoveryCode: data.recoveryCode }); await load(); return t('account.recovered'); })}><Field label={t('account.recoveryCode')} name="recoveryCode" /></Form>
      : <><Form label={t('account.confirm')} submit={async data => act(async () => { await call('/verify', { code: data.code }); await load(); })}><Field label={t('account.code')} name="code" /></Form>
        <button className="quiet" onClick={() => setRecovery(true)}>{t('account.recovery')}</button></>}
  </section>;
}

function RecoveryCodes({ codes, done }: { codes: string[]; done: () => void }) {
  const t = useT();
  return <section className="panel stack" aria-labelledby="codes"><h2 id="codes">{t('account.codesTitle')}</h2><p>{t('account.codesIntro')}</p>
    <ul className="list">{codes.map(c => <li key={c}><code>{c}</code></li>)}</ul><button onClick={done}>{t('account.codesDone')}</button></section>;
}

function Home(p: PageProps & { me: Row }) {
  const t = useT(), e = p.entity, path = e ? `${BASE}/entities/${e.clientId}` : '';
  const signOut = () => p.act(async () => { await call('/sign-out', {}); p.setMe(null); p.setEntity(undefined); return t('account.signedOut'); });
  if (!p.me.entities.length || !e) return <section className="panel"><p>{t('account.noEntities')}</p><button className="quiet" onClick={signOut}>{t('account.signOut')}</button></section>;
  return <>
    <section className="panel split">
      {p.me.entities.length > 1 ? <Field label={t('account.switch')} name="entity"><select name="entity" value={p.chosen} onChange={event => p.choose(event.target.value)}>{p.me.entities.map((x: Row) => <option key={x.clientId} value={x.clientId}>{x.name}</option>)}</select></Field>
        : <p><strong>{e.name}</strong></p>}
      <button className="quiet" onClick={signOut}>{t('account.signOut')}</button>
    </section>
    <section className="panel" aria-labelledby="work"><h2 id="work">{t('account.work')}</h2>
      {e.work.length ? <ul className="list">{e.work.map((w: Row) => <li key={w.id}>{t('account.workLine', { title: w.title, period: w.period, status: w.progress.status })}<br /><small className="muted">{w.progress.nextAction}</small></li>)}</ul> : <p className="muted">{t('account.none')}</p>}
    </section>
    <section className="panel" aria-labelledby="documents"><h2 id="documents">{t('account.documents')}</h2>
      {e.documents.length ? <ul className="list">{e.documents.map((d: Row) => <li key={d.ref}>{d.locked ? t('account.lockedFile', { name: d.name }) : <a href={`${path}/files/${encodeURIComponent(d.ref)}`}>{t('account.download', { name: d.name })}</a>}</li>)}</ul> : <p className="muted">{t('account.none')}</p>}
    </section>
    <section className="panel" aria-labelledby="signatures"><h2 id="signatures">{t('account.signatures')}</h2>
      {e.signatures.length ? <ul className="list">{e.signatures.map((s: Row) => <li key={s.id}>{s.status === 'completed' && s.signerStatus === 'signed' ? <a href={`${path}/signatures/${s.id}/pdf`}>{t('account.download', { name: s.title })}</a> : s.title} · <Status value={s.status} /></li>)}</ul> : <p className="muted">{t('account.none')}</p>}
    </section>
    <section className="panel" aria-labelledby="bills"><h2 id="bills">{t('account.bills')}</h2>
      {e.bills.length ? <ul className="list">{e.bills.map((b: Row) => <li key={b.id}><a href={`${path}/bills/${b.id}/pdf`}>{t('account.billLine', { number: b.number, title: b.title, due: day(b.dueDate), balance: moneyText(b.balanceCents) })}</a></li>)}</ul> : <p className="muted">{t('account.none')}</p>}
    </section>
    <section className="panel" aria-labelledby="preferences"><h2 id="preferences">{t('account.preferences')}</h2>
      {e.preferences.marketingEmail ? <><p>{t('account.marketingOn', { email: p.me.email })}</p><button className="quiet" onClick={() => p.act(async () => { p.setEntity(await call(`/entities/${e.clientId}/preferences`, { marketingEmail: false })); })}>{t('account.stopMarketing')}</button></>
        : <p>{t('account.marketingOff')}</p>}
    </section>
  </>;
}
