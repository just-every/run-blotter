import { api, clock, day, initials, prose, when, type Row, type Run } from './common';

export const workOf = (j: Row) => j.work_type || j.title;
/**
 * A work type's short label for tapes and chips: the form number when it names one, else the name
 * without its cadence ("Quarterly"), jurisdiction ("Federal and state") or closing noun ("return",
 * "review", "filing"), with "compliance and" as "+": "Sales tax", "Payroll + W-2", "Form 1040".
 */
export const shortWork = (name: string) => {
  const form = name.match(/\bForm \d[\w-]*/);
  if (form) return form[0];
  const bare = name.replace(/\s*\([^)]*\)/g, '').replace(/^(?:(?:quarterly|monthly|annual|yearly|weekly|year-end|federal and state|federal|state)\s+)+/i, '');
  const noun = bare.replace(/\s+(?:return|review|filing|reporting|response|work)$/i, '');
  // A compound that modified the dropped noun opens up: "sales-tax return" reads "sales tax".
  const short = (noun === bare ? noun : noun.replace(/-(?=[a-z]+$)/, ' ')).replace(/\s+compliance and\s+|\s+and\s+/gi, ' + ').trim();
  return short ? short[0].toUpperCase() + short.slice(1) : name;
};
/** A tape's separator: never at a line start or end. */
export const SEP = '\u00a0·\u00a0';
const first = (name: string) => name.split(/[\s@]/)[0];

/** The card's tape strip: client, work type and the preparer's initials; it opens the job. */
function Tape({ job, open, due = false }: { job: Row; open: (id: string) => void; due?: boolean }) {
  return <h3 className="tape"><button onClick={() => open(job.id)} title={`Open ${job.client_name} · ${job.title} ${job.period_label}`}>
    <b>{job.client_name}</b>{SEP}<span title={workOf(job)}>{shortWork(workOf(job))}</span>{SEP}<abbr title={job.preparer_name}>{initials(job.preparer_name)}</abbr>{due && <small>{SEP}due {day(job.due_date)}</small>}
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
    {(sent.length > 0 || prepared) && <ol className="steps">
      {sent.length > 4 && <li className="step more">+{sent.length - 4}</li>}
      {sent.slice(-4).map(r => <li key={r.at} className="step" title={`${when(r.at)} by ${r.by}: ${r.delivery}`}><i className="dot" />{day(r.at)}</li>)}
      {prepared && <li className="step off" title="Prepared by the agent; sent once you approve it under Preparations"><i className="dot" />prepared</li>}
    </ol>}
    {last ? <p className="note">last sent {day(last.at)} · {clock(last.at)} by {first(last.by)}{last.prepared ? ', agent-prepared' : ''}</p>
      : <p className="note">asked {day(job.created_at)} · {prepared ? 'a reminder is prepared, not sent yet' : 'no reminder sent yet'}</p>}
  </div>;
}

/** A job submitted with every document in: the reviewer's decision is what it waits for. */
function InReview({ job }: { job: Row }) {
  return <p className="note in-review">submitted {day(job.submitted_at)} · waiting on {first(job.reviewer_name)}'s review</p>;
}

export function RequestCard({ job, tone, prepared, run, open }: { job: Row; tone: 'lilac' | 'marigold'; prepared: boolean; run: Run; open: (id: string) => void }) {
  return <article className={`wall-card tone-${tone}`}>
    <Tape job={job} open={open} />
    <ul className="asks">{job.requests.map((r: Row) => <Ask key={r.id} job={job} request={r} run={run} />)}</ul>
    {job.status === 'review' ? <InReview job={job} /> : <Trail job={job} prepared={prepared} />}
  </article>;
}

const PREPARED: Record<string, string> = { reminder: 'Approve the reminder', rollforward: 'Approve the roll-forward', export: 'Approve the export' };

/**
 * A job the reviewer returned: lifted and enlarged, the return ringed, the reviewer's note and the next actions on the card itself.
 * When the agent prepared something for the job, its finding sits on the card and approving it is the primary action.
 */
export function LiftedCard({ job, preparation, run, open }: { job: Row; preparation?: Row; run: Run; open: (id: string) => void }) {
  const prep = preparation && JSON.parse(preparation.payload);
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
    {preparation && <div className="note-card agent">
      <img className="avatar" src="/brand/tile.svg" alt="" width="36" height="36" />
      <div><p className="note-by">Agent · {clock(preparation.created_at)}</p><p>{prose(prep.summary)}</p></div>
    </div>}
    <div className="card-actions">
      {preparation ? <>
        <button className="primary" onClick={() => run(() => api(`/proposals/${preparation.id}/decide`, { decision: 'approve' }), 'Approved and carried out')}>{PREPARED[preparation.kind] ?? 'Approve'}</button>
        <button className="secondary" onClick={() => open(job.id)}>Open the job</button>
      </> : <>
        <button className="primary" onClick={() => open(job.id)}>Open the job</button>
        <button className="secondary" onClick={() => run(() => api(`/jobs/${job.id}/submit`, { revision: job.revision }), 'Submitted for review')}>Submit for review</button>
      </>}
    </div>
    <p className="pill"><b>Returned</b> · in progress · due {day(job.due_date)}</p>
  </article>;
}

export function DoneCard({ job, open }: { job: Row; open: (id: string) => void }) {
  const reqs: Row[] = job.requests;
  return <article className="done-card">
    <h3 className="tape"><span className="ok" aria-hidden="true">✓</span><button onClick={() => open(job.id)}><b>{job.client_name}</b>{SEP}<span title={workOf(job)}>{shortWork(workOf(job))}</span></button></h3>
    <div className="done-body">
      <p className="ask ask-ok"><span className="box" aria-label="accepted" /><span className="ask-text">{reqs.length === 1 ? reqs[0].label : `All ${reqs.length} documents in`}<span className="ok" aria-hidden="true"> ✓</span></span></p>
      <p className="completed">{job.status === 'signed_off' ? 'Signed off' : 'All in'}<span>{day(job.done_at)}</span></p>
    </div>
  </article>;
}
