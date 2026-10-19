import { type Row } from './common';
import { statusLabel } from './statuses';

export const PRIORITY: Record<string, string> = { low: 'Low', normal: 'Normal', high: 'High' };
export const NO_FILTERS = { workType: '', stage: '', subStatus: '', client: '', assignee: '', dueFrom: '', dueTo: '', overdue: '', blocked: '', priority: '' };

/** The work filters boards and calendars share (WORK-006): type, status, client, assignee, due dates, blocked and priority. */
export function FilterBar({ state, filter, set, client = false }: { state: Row; filter: Row; set: (next: Row) => void; client?: boolean }) {
  const model = state.statusModel, change = (key: string) => (e: { target: { value: string } }) => set({ ...filter, [key]: e.target.value });
  return <div className="row filters">
    <label>Work type<select value={filter.workType} onChange={e => set({ ...filter, workType: e.target.value, ...(e.target.value ? {} : { groupBy: 'stage' }) })}><option value="">All</option>{model.workTypes.map((w: Row) => <option key={w.id} value={w.id}>{w.name}</option>)}</select></label>
    <label>Stage<select value={filter.stage} onChange={change('stage')}><option value="">All</option>{model.stages.map((s: Row) => <option key={s.key} value={s.key}>{s.label}</option>)}</select></label>
    <label>Sub-status<select value={filter.subStatus} onChange={change('subStatus')}><option value="">All</option>{model.subStatuses.map((s: Row) => <option key={s.id} value={s.id}>{statusLabel(model, s.stage, s.name)}</option>)}</select></label>
    {client && <label>Client<select value={filter.client} onChange={change('client')}><option value="">Every client</option>{state.clients.map((c: Row) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>}
    <label>Assignee<select value={filter.assignee} onChange={change('assignee')}><option value="">Anyone</option>
      {(state.people.length ? state.people : [state.actor]).map((p: Row) => <option key={p.email} value={p.email}>{p.name}</option>)}</select></label>
    <label>Due from<input type="date" value={filter.dueFrom} onChange={change('dueFrom')} /></label>
    <label>Due to<input type="date" value={filter.dueTo} onChange={change('dueTo')} /></label>
    <label>Blocked<select value={filter.blocked} onChange={change('blocked')}><option value="">Either</option><option value="yes">Blocked</option><option value="no">Workable</option></select></label>
    <label>Priority<select value={filter.priority} onChange={change('priority')}><option value="">Any</option>{Object.entries(PRIORITY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
    <label className="check"><input type="checkbox" checked={filter.overdue === '1'} onChange={e => set({ ...filter, overdue: e.target.checked ? '1' : '' })} /> Overdue only</label>
  </div>;
}

/** Badges for a listed job: priority other than normal, overdue and blocked (with what it waits for). */
export function JobFlags({ job }: { job: Row }) {
  return <>
    {job.priority && job.priority !== 'normal' && <span className={`badge priority-${job.priority}`}>{PRIORITY[job.priority]} priority</span>}
    {job.overdue && <span className="badge overdue">Overdue</span>}
    {job.blocked && <><span className="badge blocked">Blocked</span><small className="muted"> {job.blockers.join('; ')}</small></>}
  </>;
}
