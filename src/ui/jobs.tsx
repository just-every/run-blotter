import { Empty, Status, type Row, type Run } from './common';
import { JobDetail } from './job';

export function Jobs({ state, jobId, open, run, tick }: { state: Row; jobId: string; open: (id: string) => void; run: Run; tick: number }) {
  if (jobId) return <JobDetail jobId={jobId} actor={state.actor} back={() => open('')} open={open} run={run} tick={tick} />;
  const jobs: Row[] = state.jobs;
  if (!jobs.length) return <Empty>{state.actor.role === 'preparer' ? 'No jobs are assigned to you yet.' : 'No jobs yet. Add a client and a template under Clients & templates, then start a job.'}</Empty>;
  return <section className="panel">
    <table className="table">
      <thead><tr><th>Due</th><th>Client</th><th>Job</th><th>Status</th><th>Outstanding</th><th><span className="sr-only">Open</span></th></tr></thead>
      <tbody>{jobs.map(j => <tr key={j.id}>
        <td data-label="Due">{j.due_date}</td>
        <td data-label="Client">{j.client_name}</td>
        <td data-label="Job">{j.title} · {j.period_label}</td>
        <td data-label="Status"><Status value={j.status} /></td>
        <td data-label="Outstanding">{j.open_steps} steps · {j.open_requests} documents</td>
        <td><button className="quiet" onClick={() => open(j.id)}>Open</button></td>
      </tr>)}</tbody>
    </table>
  </section>;
}
