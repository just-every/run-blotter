// Timesheets (TIME-002): submit a week, correct returned entries, approve or
// return others' time, close billing periods, and read an entry's history.
import { useEffect, useState } from 'react';
import { api, aud, Empty, Field, Form, Status, today, when, type Row, type Run } from './common';

const useTimesheets = (run: Run, tick: number) => {
  const [data, setData] = useState<Row>();
  useEffect(() => { api('/timesheets').then(setData).catch(e => run(async () => { throw e; })); }, [tick]);
  return data;
};
const mondayOf = (day: string) => { const d = new Date(day + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() - (d.getUTCDay() + 6) % 7); return d.toISOString().slice(0, 10); };

export function MyTimesheet({ actor, run, tick }: { actor: Row; run: Run; tick: number }) {
  const data = useTimesheets(run, tick);
  if (!data) return null;
  const mine: Row[] = data.entries.filter((e: Row) => e.person_email === actor.email);
  const weeks = [...new Set(mine.map(e => mondayOf(e.date)))].slice(0, 6);
  return <section className="panel">
    <h2>My timesheet</h2>
    {!weeks.length ? <Empty>No time recorded yet. Record time on a job, then submit the week here.</Empty> : weeks.map(week => {
      const entries = mine.filter(e => mondayOf(e.date) === week), unsent = entries.filter(e => !e.status).length;
      return <article key={week} className="record">
        <div className="split"><strong>Week of {week}</strong>{unsent > 0 && <button onClick={() => run(() => api('/timesheets/submit', { weekStart: week }), 'Timesheet submitted for approval')}>Submit {unsent} {unsent === 1 ? 'entry' : 'entries'}</button>}</div>
        <ul className="list">{entries.map(e => <li key={e.id}>{e.date} · {e.client} · {e.description} · {e.minutes} min · {e.status ? <Status value={e.status} /> : 'not submitted'}{e.locked ? ' · period closed' : ''}
          {e.status === 'returned' && <><br /><small className="muted">Returned by {e.decided_by}: {e.reason}</small>
            <details><summary>Correct</summary><Form label="Submit correction" submit={async data => run(() => api(`/time/${e.id}/correct`, { minutes: Number(data.minutes), description: data.description }), 'Correction submitted')}>
              <Field label="Minutes" name="minutes" type="number" value={e.minutes} /><Field label="Description" name="description" value={e.description} />
            </Form></details></>}
        </li>)}</ul>
      </article>;
    })}
  </section>;
}

export function TimeApprovals({ actor, run, tick }: { actor: Row; run: Run; tick: number }) {
  const data = useTimesheets(run, tick);
  if (!data) return null;
  const waiting: Row[] = data.entries.filter((e: Row) => e.status === 'submitted' && (e.person_email !== actor.email || actor.role === 'owner'));
  return <section className="panel">
    <h2>Timesheets to approve</h2>
    <p className="muted">Only approved time is ready to bill. Return an entry with a reason and its person corrects it.</p>
    {!waiting.length ? <Empty>No submitted time is waiting.</Empty> : <ul className="list">{waiting.map(e => <li key={e.id}>
      <strong>{e.person_email}</strong> · {e.date} · {e.client} · {e.job} · {e.description} · {e.minutes} min · {aud(e.amount_cents)}
      <div className="actions">
        <button onClick={() => run(() => api(`/time/${e.id}/review`, { decision: 'approve' }), 'Time approved')}>Approve</button>
        <details><summary>Return</summary><Form label="Return entry" submit={async data => run(() => api(`/time/${e.id}/review`, { decision: 'return', reason: data.reason }), 'Returned to its person')}><Field label="Reason" name="reason" /></Form></details>
      </div>
    </li>)}</ul>}
    <h3>Billing periods</h3>
    {!data.periods.length ? <Empty>No closed periods.</Empty> : <ul className="list">{data.periods.map((p: Row) => <li key={p.id}>{p.start_date} to {p.end_date} · closed by {p.closed_by} {when(p.closed_at)} · {p.note}</li>)}</ul>}
    {actor.role === 'owner' && <details><summary>Close a billing period</summary>
      <p className="muted">Every entry in the period must be approved. Its time is then locked; correct it with an adjustment on the job.</p>
      <Form label="Close period" submit={async data => run(() => api('/periods/close', data), 'Period closed; its time is locked')}>
        <div className="row"><Field label="From" name="startDate" type="date" /><Field label="To" name="endDate" type="date" value={today()} /></div>
        <Field label="Closing note" name="note" />
      </Form>
    </details>}
  </section>;
}

export function EntryHistory({ entryId, owner, approved, run }: { entryId: string; owner: boolean; approved: boolean; run: Run }) {
  const [history, setHistory] = useState<Row>();
  return <details onToggle={e => { if ((e.target as HTMLDetailsElement).open && !history) api(`/time/${entryId}/history`).then(setHistory).catch(error => run(async () => { throw error; })); }}>
    <summary>History</summary>
    {history && <ul className="list">
      {history.review && <li>Submitted {when(history.review.submitted_at)}{history.review.decided_by && ` · ${history.review.status} by ${history.review.decided_by} ${when(history.review.decided_at)}`}{history.review.reason && `: ${history.review.reason}`}</li>}
      {history.adjustments.map((a: Row) => <li key={a.id}>Adjustment {a.minutes > 0 ? '+' : ''}{a.minutes} min ({aud(a.amount_cents)}) by {a.created_by} {when(a.created_at)}: {a.reason}</li>)}
      {history.audit.map((a: Row) => <li key={a.id}><small className="muted">{when(a.at)} {a.actor} · {a.action}{a.detail && ` · ${a.detail}`}</small></li>)}
    </ul>}
    {owner && approved && <Form label="Post adjustment" submit={async data => run(async () => { await api(`/time/${entryId}/adjust`, { minutes: Number(data.minutes), reason: data.reason }); setHistory(undefined); }, 'Adjustment posted; the original entry is unchanged')}>
      <div className="row"><Field label="Minutes to add (negative to remove)" name="minutes" type="number" /><Field label="Reason" name="reason" /></div>
    </Form>}
  </details>;
}
