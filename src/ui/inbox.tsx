import { useEffect, useState } from 'react';
import { api, clock, day, Empty, PageHead, type Row, type Run } from './common';
import { DoneCard, LiftedCard, RequestCard, workOf } from './inbox-card';
import type { Tab } from './workspace';

type Band = 'look' | 'waiting' | 'done';
const WEEK = 7 * 86_400_000;

/** Which band a job's requests put it in, if any: a returned job or a received document needs a look first. */
function bandOf(j: Row, now: number): Band | null {
  const open = j.status !== 'signed_off', reqs: Row[] = j.requests;
  if (j.returned) return 'look';
  if (open && reqs.some(r => r.status === 'received')) return 'look';
  if (open && reqs.some(r => r.status === 'requested')) return 'waiting';
  const last = reqs.reduce((m, r) => r.updated_at > m ? r.updated_at : m, '');
  return reqs.every(r => r.status === 'accepted') && Date.parse(last) >= now - WEEK ? 'done' : null;
}

/**
 * The home screen: what clients still owe the firm, in three bands of cards
 * (waiting on client, in and needing a look, done this week). A job a reviewer
 * returned is lifted at the head of "needs a look"; the agent's line shows the
 * preparations waiting for approval.
 */
export function Inbox({ state, run, open, go, tick }: { state: Row; run: Run; open: (id: string) => void; go: (t: Tab) => void; tick: number }) {
  const [wall, setWall] = useState<Row>(), [chip, setChip] = useState(''), [doneOpen, setDoneOpen] = useState<boolean>();
  useEffect(() => { api('/inbox').then(setWall).catch(e => run(async () => { throw e; })); }, [tick]);
  useEffect(() => { setDoneOpen(matchMedia('(min-width: 1100px)').matches); }, []);
  const proposals: Row[] = state.proposals;
  const pending = proposals.filter(p => p.status === 'pending' && p.kind === 'reminder');
  const head = <PageHead title="What we're waiting on" mark="waiting"
    eyebrow={wall ? `Requests · ${wall.asked} asked since ${day(wall.monthStart)} · ${day(wall.now)}` : 'Requests'}>
    <AgentLine proposals={proposals} people={state.people} go={go} />
  </PageHead>;
  if (!wall) return <>{head}<p className="opening">Opening the wall…</p></>;
  const now = Date.parse(wall.now), jobs: Row[] = wall.jobs.map((j: Row) => ({ ...j, band: bandOf(j, now) })).filter((j: Row) => j.band);
  if (!jobs.length) return <>{head}<div className="wall-empty"><Empty>{state.actor.role === 'preparer'
    ? 'Nothing to chase yet: none of your jobs has a document request open.'
    : <>Nothing to chase yet. Start a job with document requests, then send the client a reminder from the job. <button className="quiet" onClick={() => go('Clients & templates')}>Start a job</button></>}</Empty></div></>;
  const kinds = [...new Set(jobs.map(workOf))].sort((a, b) => jobs.filter(j => workOf(j) === b).length - jobs.filter(j => workOf(j) === a).length);
  const shown = chip ? jobs.filter(j => workOf(j) === chip) : jobs;
  const of = (b: Band) => shown.filter(j => j.band === b);
  const prepared = (j: Row) => pending.some(p => JSON.parse(p.payload).jobId === j.id);
  const card = (j: Row) => j.returned ? <LiftedCard key={j.id} job={j} run={run} open={open} />
    : <RequestCard key={j.id} job={j} tone={j.band === 'look' ? 'marigold' : 'lilac'} prepared={prepared(j)} run={run} open={open} />;
  const look = of('look').sort((a, b) => Number(!!b.returned) - Number(!!a.returned)), waiting = of('waiting'), done = of('done');
  return <>
    {head}
    <div className="chips" role="group" aria-label="Filter by work type">
      <button aria-pressed={!chip} onClick={() => setChip('')}>All work</button>
      {kinds.map(k => <button key={k} aria-pressed={chip === k} onClick={() => setChip(chip === k ? '' : k)}>{k}</button>)}
    </div>
    <div className="wall">
      <section className="band band-waiting" aria-labelledby="band-waiting">
        <h2 id="band-waiting">Waiting on client · {waiting.length}</h2>
        {waiting.length ? <div className="band-cards">{waiting.map(card)}</div> : <p className="band-empty">No client owes a document right now.</p>}
      </section>
      <section className="band band-look" aria-labelledby="band-look">
        <h2 id="band-look">In · needs a look · {look.length}</h2>
        {look.length ? <div className="band-cards">{look.map(card)}</div> : <p className="band-empty">Nothing in to check.</p>}
      </section>
      <section className="band band-done" aria-labelledby="band-done">
        <h2 id="band-done"><span>Done this week · {done.length} <span className="tick" aria-hidden="true">✓</span></span>
          <button className="fold" aria-expanded={!!doneOpen} aria-controls="done-stack" aria-label={doneOpen ? 'Collapse done this week' : 'Show done this week'} onClick={() => setDoneOpen(!doneOpen)}><svg viewBox="0 0 20 20" aria-hidden="true"><path d={doneOpen ? 'M4 7l6 6 6-6' : 'M7 4l6 6-6 6'} /></svg></button></h2>
        <div id="done-stack" className={`done-stack${doneOpen ? '' : ' folded'}`}>
          {done.length ? done.map(j => <DoneCard key={j.id} job={j} open={open} />) : <p className="band-empty">Nothing finished in the last seven days.</p>}
        </div>
        {!doneOpen && done.length > 0 && <button className="quiet unfold" onClick={() => setDoneOpen(true)}>Show all {done.length}</button>}
      </section>
    </div>
  </>;
}

/** The agent's place: preparations waiting for this person, and the last one they approved. */
function AgentLine({ proposals, people, go }: { proposals: Row[]; people: Row[]; go: (t: Tab) => void }) {
  const name = (email: string) => people.find(p => p.email === email)?.name?.split(' ')[0] || email;
  const pending = proposals.filter(p => p.status === 'pending'), approved = proposals.filter(p => p.status === 'approved').sort((a, b) => b.decided_at.localeCompare(a.decided_at))[0];
  const latest = pending[0];
  return <div className="agent-line">
    <img src="/brand/tile.svg" alt="" width="40" height="40" />
    <p>{latest ? <><b>Agent {clock(latest.created_at)}:</b> {pending.length} {pending.length === 1 ? 'preparation' : 'preparations'} waiting for your approval</>
      : <><b>Agent:</b> nothing waiting for your approval</>}
      {approved && <> · {name(approved.decided_by)} approved {day(approved.decided_at) === day(new Date().toISOString()) ? clock(approved.decided_at) : day(approved.decided_at)} <span className="ok" aria-label="approved">✓</span></>}
      {' '}<button className="link" onClick={() => go('Preparations')}>{pending.length ? 'Review' : 'Preparations'}</button></p>
  </div>;
}
