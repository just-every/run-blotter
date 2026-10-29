// Suggested time (TIME-001): with the person's consent, their own work actions
// on a job suggest a time entry for that day; they approve it with minutes and
// a billable choice, or reject it. Nothing is recorded without approval.
import { useEffect, useState } from 'react';
import { api, Empty, Field, Form, when, type Row, type Run } from './common';

const ACTION: Record<string, string> = {
  'step.done': 'Completed a checklist task', 'timer.discarded': 'Discarded a timer', 'request.accepted': 'Accepted a document', 'request.returned': 'Returned a document',
  'thread.opened': 'Started a discussion', 'thread.correction_requested': 'Requested a correction', 'thread.replied': 'Replied in a discussion',
};
const label = (action: string) => ACTION[action] ?? 'Worked on a tax notice';

export function SuggestedTime({ run, tick, open }: { run: Run; tick: number; open: (id: string) => void }) {
  const [data, setData] = useState<Row>();
  useEffect(() => { api('/time/suggestions').then(setData).catch(e => run(async () => { throw e; })); }, [tick]);
  if (!data) return null;
  const consent = (value: boolean) => run(() => api('/time/suggestions/consent', { consent: value }), value ? 'Suggestions on: your work actions from now on suggest time' : 'Suggestions off: pending suggestions removed');
  return <section className="panel">
    <h2>Suggested time</h2>
    <MailSuggestionSettings run={run} tick={tick} />
    {!data.consentedAt ? <>
      <p className="muted">With your consent, Blotter suggests a time entry for each job and day on which you completed tasks, decided documents, posted in discussions or worked on notices but recorded no time. Only you see your suggestions, and nothing is recorded until you approve one. Email and calendar activity are not used.</p>
      <button onClick={() => consent(true)}>Turn on suggestions</button>
    </> : <>
      <p className="muted">On since {when(data.consentedAt)}. Only your own actions from then on are used; only you see these. <button className="quiet" onClick={() => consent(false)}>Turn off suggestions</button></p>
      {!data.pending.length ? <Empty>No suggestions: every day you worked on a job has time recorded.</Empty> : <ul className="list">{data.pending.map((s: Row) => <li key={s.job_id + s.day}>
        <strong>{s.day}</strong> · {s.client} · <button className="quiet text-action" onClick={() => open(s.job_id)}>{s.job} · {s.period}</button>
        <ul>{s.sources.map((a: Row) => <li key={a.id}><small className="muted">{when(a.at)} · {label(a.action)}{a.detail && ` · ${a.detail}`}</small></li>)}</ul>
        <details><summary>Approve</summary><Form label="Record suggested time" submit={async data => run(() => api('/time/suggestions/decide', { jobId: s.job_id, day: s.day, decision: 'approve', minutes: Number(data.minutes), description: data.description, billable: data.billable === 'on' }), 'Time recorded at the rate in force on that day')}>
          <div className="row"><Field label="Minutes" name="minutes" type="number" /><Field label="Description" name="description" value={`Work on ${s.job}`} /></div>
          <label className="check"><input type="checkbox" name="billable" /> Billable to the client</label>
        </Form></details>
        <details><summary>Reject</summary><Form label="Reject suggestion" submit={async data => run(() => api('/time/suggestions/decide', { jobId: s.job_id, day: s.day, decision: 'reject', reason: data.reason }), 'Suggestion rejected; no time recorded')}>
          <Field label="Reason (optional)" name="reason" required={false} />
        </Form></details>
      </li>)}</ul>}
    </>}
  </section>;
}


/** Mail is a separate, optional staff choice; it never activates a connection. */
export function MailSuggestionSettings({ run, tick }: { run: Run; tick: number }) {
  const [data, setData] = useState<Row>(), [busy, setBusy] = useState(false);
  useEffect(() => { api('/time/mail-consent').then(setData).catch(e => run(async () => { throw e; })); }, [tick]);
  if (!data) return null;
  const choose = async (choice: string) => {
    setBusy(true);
    try {
      await run(async () => { setData(await api('/time/mail-consent', { choice, requestId: crypto.randomUUID(), reviewToken: data.reviewToken, lastId: data.lastId, wordingVersion: data.wordingVersion })); }, choice === 'opt_in' ? 'Mail choice saved; mail suggestions remain unavailable' : 'Mail choice withdrawn');
    } finally { setBusy(false); }
  };
  return <details className="mail-consent-settings"><summary>Mail suggestion settings</summary>
    <p>{data.wording}</p>
    <p role="status">Mail choice: <strong>{data.optedIn ? 'On' : 'Off'}</strong>. Mail suggestions unavailable.</p>
    <button disabled={busy} onClick={() => choose(data.optedIn ? 'withdraw' : 'opt_in')}>{data.optedIn ? 'Withdraw mail consent' : 'Allow mail time suggestions'}</button>
    {data.history.length > 0 && <details><summary>My mail choice history</summary><ul className="list">{data.history.map((event: Row) => <li key={event.id}>
      <strong>{event.choice === 'opt_in' ? 'Allowed' : event.choice === 'withdraw' ? 'Withdrawn' : 'Declined'}</strong> · {when(event.at)} · {event.actor}
      {event.historical && <p>Restored historical choice; inactive. Review the wording above to make a fresh choice.</p>}
      {event.invalidatedAt && <p>{event.invalidationReason}</p>}
      <details><summary>Recorded consent wording</summary><p>{event.wording}</p><p>Version {event.wordingVersion} · Source: mail</p></details>
    </li>)}</ul></details>}
  </details>;
}
