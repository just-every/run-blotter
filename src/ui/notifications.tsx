import { useEffect, useState } from 'react';
import { api, Field, Form, prose, when, type Row } from './common';

type Kind = { id: string; label: string; legacyEmail: boolean };
type Personal = {
  timeZone: string; quietStart: string; quietEnd: string; digestTime: string;
  digestEnabled: boolean; leadDays: number; emailKinds: string[]; configured: boolean;
};
type Defaults = { emailKinds: string[]; mandatoryKinds: string[] };
type Settings = { personal: Personal; firm: Defaults; kinds: Kind[]; role: string };
type Save = (path: string, body: unknown, message: string) => Promise<void>;
const message = (error: unknown) => error instanceof Error ? error.message : 'The request could not be completed';

/** The signed-in staff member's notification center and delivery preferences (NOTIFY-001). */
export function MyAlerts({ tick, open }: { tick: number; open: (id: string) => void }) {
  const [alerts, setAlerts] = useState<Row[]>(), [settings, setSettings] = useState<Settings>();
  const [alertsError, setAlertsError] = useState(''), [settingsError, setSettingsError] = useState('');
  const [error, setError] = useState(''), [notice, setNotice] = useState(''), [busy, setBusy] = useState('');
  const [filter, setFilter] = useState('all'), [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    setAlertsError(''); setSettingsError('');
    void api('/notifications').then(data => { if (active) setAlerts(data); })
      .catch(e => { if (active) setAlertsError(message(e)); });
    void api('/notifications/settings').then(data => { if (active) setSettings(data); })
      .catch(e => { if (active) setSettingsError(message(e)); });
    return () => { active = false; };
  }, [tick, refresh]);
  const save: Save = async (path, body, success) => {
    setBusy(path); setError(''); setNotice('');
    try {
      await api(path, body);
      if (path.endsWith('/read')) setAlerts(await api('/notifications'));
      else setSettings(await api('/notifications/settings'));
      setNotice(success);
    } catch (e) { setError(message(e)); }
    finally { setBusy(''); }
  };
  const unread = alerts?.filter(a => !a.read_at).length ?? 0;
  const visible = alerts?.filter(a => filter === 'all' || (filter === 'unread' ? !a.read_at : !!a.read_at));
  return <section className="panel">
    <h2>Notifications{alerts && ` · ${unread} unread`}</h2>
    <p className="muted">In-app notifications appear here. Choose email events and your daily digest below.</p>
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p className="notice" role="status">{notice}</p>}
    {alertsError && <p className="error" role="alert">Could not load notifications: {alertsError}</p>}
    <div className="row">
      <Field label="Show notifications" name="notificationFilter"><select value={filter} onChange={e => setFilter(e.target.value)}>
        <option value="all">All</option><option value="unread">Unread</option><option value="read">Read</option>
      </select></Field>
      <p><button className="quiet" disabled={!!busy} onClick={() => setRefresh(n => n + 1)}>Refresh notifications</button></p>
    </div>
    {!alerts && !alertsError && <p role="status">Loading notifications…</p>}
    {visible?.length === 0 && !alertsError && <p className="muted">{filter === 'all' ? 'No notifications yet.' : `No ${filter} notifications.`}</p>}
    <ul className="list">{visible?.map(a => <li key={a.id}>
      <p>{!a.read_at && <strong>Unread · </strong>}
        {a.job_id ? <button className="text-action" onClick={() => open(a.job_id)}>{prose(a.summary)}</button> : prose(a.summary)}
        {a.item_label && <><br /><small>{a.item_label}</small></>}
        <br /><small className="muted">{when(a.created_at)} · Email: {a.delivery}</small>
      </p>
      <button className="quiet" disabled={!!busy} onClick={() => void save(`/notifications/${encodeURIComponent(a.id)}/read`, { read: !a.read_at }, a.read_at ? 'Marked unread' : 'Marked read')}>
        Mark {a.read_at ? 'unread' : 'read'}
      </button>
    </li>)}</ul>
    <details>
      <summary>Notification settings</summary>
      {settingsError && <p className="error" role="alert">Could not load settings: {settingsError}</p>}
      {!settings && !settingsError && <p role="status">Loading settings…</p>}
      {settings && <PersonalSettings key={JSON.stringify(settings)} settings={settings} save={save} busy={!!busy} />}
      <p className="muted">Mobile push is planned under MOBILE-001.</p>
    </details>
    {settings?.role === 'owner' && <details>
      <summary>Firm notification defaults</summary>
      <FirmDefaults key={JSON.stringify(settings.firm)} settings={settings} save={save} busy={!!busy} />
    </details>}
  </section>;
}

function PersonalSettings({ settings: { personal, firm, kinds }, save, busy }: { settings: Settings; save: Save; busy: boolean }) {
  return <Form label="Save notification settings" disabled={busy} submit={async data => save('/notifications/settings', {
    timeZone: String(data.timeZone).trim(), quietStart: data.quietStart, quietEnd: data.quietEnd,
    digestTime: data.digestTime, digestEnabled: data.digestEnabled === 'on', leadDays: Number(data.leadDays),
    emailKinds: kinds.filter(k => firm.mandatoryKinds.includes(k.id) || data[`email:${k.id}`] === 'on').map(k => k.id),
  }, 'Notification settings saved')}>
    <fieldset disabled={busy}>
      <legend>Email events</legend>
      <p className="muted">Every event remains available in-app. Firm-mandatory email events cannot be turned off. New event defaults are suggestions until you save your own email choices.</p>
      {kinds.map(k => <label className="check" key={k.id}>
        <input type="checkbox" name={`email:${k.id}`} defaultChecked={personal.emailKinds.includes(k.id) || firm.mandatoryKinds.includes(k.id) || (!personal.configured && firm.emailKinds.includes(k.id))} disabled={firm.mandatoryKinds.includes(k.id)} />
        {k.label}{firm.mandatoryKinds.includes(k.id) && ' (mandatory)'}
      </label>)}
    </fieldset>
    <fieldset disabled={busy}>
      <legend>Schedule</legend>
      <Field label="IANA time zone" name="timeZone" value={personal.timeZone} hint="For example, America/New_York or Australia/Brisbane" />
      <label className="check"><input type="checkbox" name="digestEnabled" defaultChecked={personal.digestEnabled} /> Email me a daily digest of due-soon and overdue work</label>
      <div className="row">
        <Field label="Daily digest time" name="digestTime" type="time" value={personal.digestTime} />
        <Field label="Due-soon lead time (days)" name="leadDays"><input name="leadDays" type="number" min="0" step="1" required defaultValue={personal.leadDays} /></Field>
      </div>
      <div className="row">
        <Field label="Quiet hours start" name="quietStart" type="time" value={personal.quietStart} />
        <Field label="Quiet hours end" name="quietEnd" type="time" value={personal.quietEnd} />
      </div>
      <p className="muted">Times use your time zone, including daylight saving. Quiet hours may span midnight. Equal start and end times disable quiet hours. Email also respects the firm's notification hours.</p>
    </fieldset>
  </Form>;
}

function FirmDefaults({ settings: { firm, kinds }, save, busy }: { settings: Settings; save: Save; busy: boolean }) {
  const [emailKinds, setEmailKinds] = useState(firm.emailKinds), [mandatoryKinds, setMandatoryKinds] = useState(firm.mandatoryKinds);
  return <Form label="Save firm notification defaults" disabled={busy} submit={async () => save('/notifications/defaults', {
    emailKinds: kinds.filter(k => emailKinds.includes(k.id) || mandatoryKinds.includes(k.id)).map(k => k.id), mandatoryKinds,
  }, 'Firm notification defaults saved')}>
    <p className="muted">Choose default email events and events every staff member must receive by email. New event defaults are suggested on each person’s first settings form; email starts after they save their choices, unless the event is mandatory.</p>
    <fieldset disabled={busy}>
      <legend>Default email events</legend>
      {kinds.map(k => <label className="check" key={k.id}>
        <input type="checkbox" checked={emailKinds.includes(k.id) || mandatoryKinds.includes(k.id)} disabled={mandatoryKinds.includes(k.id)} onChange={e => setEmailKinds(e.target.checked ? [...emailKinds, k.id] : emailKinds.filter(id => id !== k.id))} />
        {k.label}
      </label>)}
    </fieldset>
    <fieldset disabled={busy}>
      <legend>Mandatory email events</legend>
      {kinds.map(k => <label className="check" key={k.id}>
        <input type="checkbox" checked={mandatoryKinds.includes(k.id)} onChange={e => setMandatoryKinds(e.target.checked ? [...mandatoryKinds, k.id] : mandatoryKinds.filter(id => id !== k.id))} />
        {k.label}
      </label>)}
    </fieldset>
  </Form>;
}
