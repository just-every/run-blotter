import { useEffect, useState } from 'react';
import { api, when, type Row, type Run } from './common';
import { useT } from './i18n';

const path = (clientId: string) => `/api/blotter/client/entities/${encodeURIComponent(clientId)}/sms-consent`;
async function clientCall(clientId: string, body?: Row) {
  const response = await fetch(path(clientId), body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {});
  if (!response.ok) throw new Error('SMS choice unavailable');
  return response.json() as Promise<Row>;
}

/** A separate, optional contact choice; an unchecked box never opts anyone in. */
export function SmsConsent({ clientId }: { clientId: string }) {
  const t = useT(), [state, setState] = useState<Row>(), [explicit, setExplicit] = useState(false), [busy, setBusy] = useState(false), [notice, setNotice] = useState(''), [failed, setFailed] = useState(false);
  useEffect(() => { let live = true; setState(undefined); setExplicit(false); setNotice(''); setFailed(false);
    clientCall(clientId).then(value => { if (live) setState(value); }).catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, [clientId]);
  const save = async (choice: string) => {
    if (!state || busy) return;
    setBusy(true); setFailed(false); setNotice('');
    try {
      setState(await clientCall(clientId, { requestId: crypto.randomUUID(), contactRevision: state.contactRevision, phone: state.phone,
        wordingVersion: state.wordingVersion, language: state.language, lastId: state.lastId, choice }));
      setExplicit(false); setNotice(t('sms.saved'));
    } catch { setFailed(true); setExplicit(false); } finally { setBusy(false); }
  };
  return <section className="stack" aria-labelledby="sms-title" style={{ overflowWrap: 'anywhere' }}>
    <h3 id="sms-title">{t('sms.title')}</h3>
    <p>{t('sms.unavailable')}</p>
    {failed && <p role="alert" className="error">{t('sms.failed')}</p>}
    {notice && <p role="status" className="notice">{notice}</p>}
    {state && <>
      <p><strong>{state.contactName}</strong>{state.phone && <> · {state.phone}</>}</p>
      <p>{state.optedIn ? t('sms.on') : t('sms.off')}</p>
      <p data-sms-wording>{state.wording}</p>
      {!state.phone ? <p>{t('sms.noPhone')}</p> : <>
        <label className="check"><input type="checkbox" checked={explicit} disabled={busy} onChange={event => setExplicit(event.target.checked)} />{t('sms.explicit')}</label>
        <div className="actions">
          <button disabled={!explicit || busy} onClick={() => save('opt_in')}>{t('sms.optIn')}</button>
          <button className="quiet" disabled={busy} onClick={() => save('decline')}>{t('sms.decline')}</button>
        </div>
      </>}
      {state.history.length > 0 && <button className="quiet" disabled={busy} onClick={() => save('withdraw')}>{t('sms.withdraw')}</button>}
      {state.history.length > 0 && <details><summary>{t('sms.history')}</summary><ul className="list">{state.history.map((event: Row) => <li key={event.id} data-sms-event={event.id}>
        <strong>{t(event.choice === 'opt_in' ? 'sms.choice.opt_in' : event.choice === 'decline' ? 'sms.choice.decline' : 'sms.choice.withdraw')}</strong> · {event.phone}<br />
        {t('sms.attribution', { actor: event.actor, at: when(event.at) })}
        {(event.historical || event.invalidatedAt) && <p>{t('sms.historical')}</p>}
        <p>{event.wording}</p>
      </li>)}</ul></details>}
    </>}
  </section>;
}

/** Current authorized staff can inspect original attribution but have no choice controls. */
export function SmsConsentEvidence({ clientId, run, tick }: { clientId: string; run: Run; tick: number }) {
  const [state, setState] = useState<Row>(), [opened, setOpened] = useState(false);
  useEffect(() => { if (opened) api(`/clients/${clientId}/sms-consent`).then(setState).catch(error => run(async () => { throw error; })); }, [clientId, opened, tick]);
  return <details onToggle={event => setOpened(event.currentTarget.open)}><summary>SMS consent evidence</summary>
    <p>Only the current contact records their choice in the authenticated portal. Text delivery is unavailable and phones are not carrier-verified. These records create no sending authority.</p>
    {state && <ul className="list" style={{ overflowWrap: 'anywhere' }}>{state.events.map((event: Row) => <li key={event.id}>
      <strong>{event.choice === 'opt_in' ? 'Opted in' : event.choice === 'decline' ? 'Declined' : 'Withdrawn'}</strong> · {event.phone || 'Phone redacted'}
      <p>{event.actor} · {when(event.at)}</p><p>Original entity {event.clientId} · Contact {event.contactId} · Revision {event.contactRevision}</p>
      <p>{event.wordingVersion} · {event.language}</p><p>{event.wording}</p>
      {(event.historical || event.invalidatedAt || event.erasedAt) && <p>Historical evidence; a fresh client choice is required. {event.invalidationReason}</p>}
    </li>)}</ul>}
  </details>;
}
