import { api, clock, day, initials, when, type Row, type Run } from './common';

export const workOf = (j: Row) => j.work_type || j.title;
const first = (name: string) => name.split(/[\s@]/)[0];

/** The card's tape strip: client, work type and the preparer's initials; it opens the job. */
function Tape({ job, open, due = false }: { job: Row; open: (id: string) => void; due?: boolean }) {
  return <h3 className="tape"><button onClick={() => open(job.id)} title={`Open ${job.client_name} · ${job.title} ${job.period_label}`}>
    <b>{job.client_name}</b> · {workOf(job)} · <abbr title={job.preparer_name}>{initials(job.preparer_name)}</abbr>{due && <small> · due {day(job.due_date)}</small>}
  </button></h3>;
}

/** One requested document: an empty box while asked, "in" once the client sent it, a green check once accepted. */
function Ask({ job, request: r, run }: { job: Row; request: Row; run: Run }) {
  const state = r.status === 'accepted' ? 'ok' : r.status === 'received' ? 'in' : 'asked';
  return <li className={`ask ask-${state}`}>
    <span className="box" aria-label={state === 'ok' ? 'accepted' : state === 'in' ? 'received' : 'requested'} />
    <span className="ask-text">{r.label}{state === 'ok' && <span className="ok" aria-hidden="true"> ✓</span>}
      {state === 'asked' && <span className="sub">{r.note ? `asked again: ${r.note}` : `asked ${day(job.created_at)}`}</span>}
      {state === 'in' && <span className="sub">in {when(r.received_at)}</span>}
      {state === 'in' && job.status === 'open' && <button className="quiet mini" onClick={() => run(() => api(`/requests/${r.id}/decide`, { decision: 'accept' }), 'Document accepted')}>Accept</button>}
    </span>
  </li>;
}

/** The reminders sent for the job, oldest first, each dated; a reminder the agent prepared and nobody approved yet is grey. */
function Trail({ job, prepared }: { job: Row; prepared: boolean }) {
  const sent: Row[] = job.reminders, last = sent.at(-1);
  return <div className="trail">
    <p className="trail-title">Reminder trail</p>
    {sent.length || prepared ? <ol className="steps">
      {sent.length > 4 && <li className="step more">+{sent.length - 4}</li>}
      {sent.slice(-4).map(r => <li key={r.at} className="step" title={`${when(r.at)} by ${r.by}: ${r.delivery}`}><i className="dot" />{day(r.at)}</li>)}
      {prepared && <li className="step off" title="Prepared by the agent; sent once you approve it under Preparations"><i className="dot" />prepared</li>}
    </ol> : <p className="trail-none">No reminder sent yet</p>}
    {last && <p className="note">last sent {day(last.at)} · {clock(last.at)} by {first(last.by)}{last.prepared ? ', agent-prepared' : ''}</p>}
  </div>;
}

export function RequestCard({ job, tone, prepared, run, open }: { job: Row; tone: 'lilac' | 'marigold'; prepared: boolean; run: Run; open: (id: string) => void }) {
  return <article className={`wall-card tone-${tone}`}>
    <Tape job={job} open={open} />
    <ul className="asks">{job.requests.map((r: Row) => <Ask key={r.id} job={job} request={r} run={run} />)}</ul>
    <Trail job={job} prepared={prepared} />
  </article>;
}

/** A job the reviewer returned: lifted and enlarged, the return ringed, the reviewer's note and the next actions on the card itself. */
export function LiftedCard({ job, run, open }: { job: Row; run: Run; open: (id: string) => void }) {
  const back = job.returned, reqs: Row[] = job.requests, allIn = reqs.every(r => r.status === 'accepted');
  return <article className="wall-card tone-lilac lifted">
    <Tape job={job} open={open} due />
    <ul className="asks">
      {allIn ? <li className="ask ask-ok"><span className="box" aria-label="accepted" /><span className="ask-text">all documents in<span className="ok" aria-hidden="true"> ✓</span></span></li>
        : reqs.map(r => <Ask key={r.id} job={job} request={r} run={run} />)}
      <li className="ask ask-x ringed">
        <span className="box" aria-hidden="true">×</span>
        <span className="ask-text">Returned by {first(back.by)}<span className="sub">{clock(back.at)} · {day(back.at)}</span></span>
        <svg className="ring" viewBox="0 0 300 80" preserveAspectRatio="none" aria-hidden="true"><path d="M150 6C70 4 10 18 8 42c-2 24 60 34 140 33 82-1 146-10 144-36C290 16 220 4 120 9" /></svg>
      </li>
    </ul>
    <div className="note-card">
      <span className="avatar" aria-hidden="true">{initials(back.by)}</span>
      <div><p className="note-by">{back.by} · {clock(back.at)}</p><p>{back.note}</p></div>
    </div>
    <div className="card-actions">
      <button className="primary" onClick={() => open(job.id)}>Open the job</button>
      <button className="secondary" onClick={() => run(() => api(`/jobs/${job.id}/submit`, { revision: job.revision }), 'Submitted for review')}>Submit for review</button>
    </div>
    <p className="pill"><b>Returned</b> · in progress · due {day(job.due_date)}</p>
  </article>;
}

export function DoneCard({ job, open }: { job: Row; open: (id: string) => void }) {
  const reqs: Row[] = job.requests, at = job.signed_off_at || reqs.reduce((m, r) => r.updated_at > m ? r.updated_at : m, '');
  return <article className="done-card">
    <h3 className="tape"><span className="ok" aria-hidden="true">✓</span><button onClick={() => open(job.id)}><b>{job.client_name}</b> · {workOf(job)}</button></h3>
    <div className="done-body">
      <p className="ask ask-ok"><span className="box" aria-label="accepted" /><span className="ask-text">{reqs.length === 1 ? reqs[0].label : `All ${reqs.length} documents in`}<span className="ok" aria-hidden="true"> ✓</span></span></p>
      <p className="completed">{job.signed_off_at ? 'Signed off' : 'All in'}<span>{day(at)}</span></p>
    </div>
  </article>;
}
