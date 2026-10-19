import { Blotter, Empty, Status, type Row, type Run } from './common';
import { JobDetail } from './job';
import { ReassignBulk } from './bulk';
import { MyTimesheet } from './timesheet';
import { SuggestedTime } from './suggestions';
import { MyAlerts } from './discussions';
import { MyWeek } from './tasks';
import { Notices } from './notices';
import { useState } from 'react';
import { Board, statusLabel } from './statuses';

export function Jobs({ state, jobId, open, run, tick }: { state: Row; jobId: string; open: (id: string) => void; run: Run; tick: number }) {
  if (jobId) return <JobDetail jobId={jobId} actor={state.actor} people={state.people} back={() => open('')} open={open} run={run} tick={tick} />;
  const jobs: Row[] = state.jobs;
  if (!jobs.length) return <Blotter className="empty-sheet"><Empty>{state.actor.role === 'preparer' ? 'No jobs are assigned to you yet.' : 'No jobs yet. Add a client and a template under Clients & templates, then start a job.'}</Empty></Blotter>;
  return <JobList state={state} jobs={jobs} open={open} run={run} tick={tick} />;
}

function JobList({ state, jobs, open, run, tick }: { state: Row; jobs: Row[]; open: (id: string) => void; run: Run; tick: number }) {
  const [board, setBoard] = useState(false);
  return <><Blotter><section className="panel jobs-panel">
    <button className="quiet" aria-pressed={board} onClick={() => setBoard(!board)}>{board ? 'Show list' : 'Show board'}</button>
    {board ? <Board state={state} open={open} run={run} tick={tick} /> : <table className="table">
      <thead><tr><th>Due</th><th>Client</th><th>Job</th><th>Status</th><th>Outstanding</th><th><span className="sr-only">Open</span></th></tr></thead>
      <tbody>{jobs.map(j => <tr key={j.id}>
        <td data-label="Due">{j.due_date}</td>
        <td data-label="Client">{j.client_name}</td>
        <td data-label="Job">{j.title} · {j.period_label}</td>
        <td data-label="Status"><Status value={j.status} /> <small className="muted">{j.work_type} · {statusLabel(state.statusModel, j.stage, j.sub_status)}</small></td>
        <td data-label="Outstanding">{j.open_steps} {j.open_steps === 1 ? 'step' : 'steps'} · {j.open_requests} {j.open_requests === 1 ? 'document' : 'documents'}{j.client_questions > 0 && <strong> · {j.client_questions} client {j.client_questions === 1 ? 'question' : 'questions'}</strong>}</td>
        <td><button className="quiet text-action" onClick={() => open(j.id)}>Open <span aria-hidden="true">→</span></button></td>
      </tr>)}</tbody>
    </table>}
    {state.actor.role !== 'preparer' && <details><summary>Reassign or reschedule in bulk</summary><ReassignBulk state={state} run={run} /></details>}
  </section></Blotter><MyWeek open={open} run={run} tick={tick} /><Notices actor={state.actor} run={run} tick={tick} /><MyAlerts tick={tick} open={open} /><MyTimesheet actor={state.actor} run={run} tick={tick} /><SuggestedTime run={run} tick={tick} open={open} /></>;
}
