import { readFile, type Row, day } from './common';

const ROLE: Record<string, string> = { preparer: 'Preparer', reviewer: 'Reviewer', manager: 'Manager' };
const blank = { label: '', assignee: '', dueFrom: '', dueDays: '', startFrom: '', startDays: '', estimateMinutes: '', instructions: '', sopUrl: '', requiresAttachment: false, clientFacing: false,
  after: '', afterDocuments: '', afterTemplate: '', afterGate: 'signed_off', whenQuestion: '', whenEquals: '' };

/** Template tasks (WORK-009): owner, relative dates, estimate, instructions, SOP link and flags per task. */
export function TaskEditor({ people, templates, tasks, setTasks }: { people: Row[]; templates: Row[]; tasks: Row[]; setTasks: (tasks: Row[]) => void }) {
  const set = (n: number, patch: Row) => setTasks(tasks.map((t, i) => i === n ? { ...t, ...patch } : t));
  const value = (n: number, key: string) => ({ value: tasks[n][key], onChange: (e: { target: { value: string } }) => set(n, { [key]: e.target.value }) });
  return <fieldset className="stack">
    <legend>Tasks with owners and dates (leave empty to use the checklist steps above)</legend>
    {tasks.map((t, n) => <div key={n} className="record">
      <div className="row">
        <label>Task {n + 1}<input aria-label={`Task ${n + 1} label`} {...value(n, 'label')} required /></label>
        <label>Owner<select aria-label={`Task ${n + 1} owner`} {...value(n, 'assignee')}><option value="">Unassigned</option>
          {Object.entries(ROLE).map(([k, v]) => <option key={k} value={k}>{v} (job role)</option>)}
          {people.filter(p => p.role !== 'preparer').map(p => <option key={p.email} value={p.email}>{p.name}</option>)}</select></label>
      </div>
      <div className="row">
        <label>Due, days from<select aria-label={`Task ${n + 1} due from`} {...value(n, 'dueFrom')}><option value="">No due date</option><option value="due">work's due date</option><option value="start">work's start</option></select></label>
        <label>Due days (negative = before)<input type="number" aria-label={`Task ${n + 1} due days`} {...value(n, 'dueDays')} /></label>
        <label>Start, days from<select aria-label={`Task ${n + 1} start from`} {...value(n, 'startFrom')}><option value="">No start date</option><option value="start">work's start</option><option value="due">work's due date</option></select></label>
        <label>Start days<input type="number" aria-label={`Task ${n + 1} start days`} {...value(n, 'startDays')} /></label>
        <label>Estimate (minutes)<input type="number" aria-label={`Task ${n + 1} estimate`} {...value(n, 'estimateMinutes')} /></label>
      </div>
      <label>Instructions<textarea rows={2} aria-label={`Task ${n + 1} instructions`} {...value(n, 'instructions')} /></label>
      <label>SOP link<input type="url" aria-label={`Task ${n + 1} SOP link`} placeholder="https://" {...value(n, 'sopUrl')} /></label>
      <label className="check"><input type="checkbox" checked={t.requiresAttachment} onChange={e => set(n, { requiresAttachment: e.target.checked })} /> Needs an attachment to complete</label>
      <div className="row">
        <label>Waits for tasks (numbers)<input aria-label={`Task ${n + 1} waits for tasks`} placeholder="1, 2" {...value(n, 'after')} /></label>
        <label>Waits for accepted documents (numbers)<input aria-label={`Task ${n + 1} waits for documents`} placeholder="1" {...value(n, 'afterDocuments')} /></label>
        <label>Waits for the client's job<select aria-label={`Task ${n + 1} waits for job`} {...value(n, 'afterTemplate')}><option value="">No other job</option>
          {templates.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
        <label>Until that job is<select aria-label={`Task ${n + 1} job gate`} {...value(n, 'afterGate')}><option value="signed_off">signed off</option><option value="submitted">submitted for review</option></select></label>
      </div>
      <div className="row">
        <label>Only when question (key)<input aria-label={`Task ${n + 1} condition question`} {...value(n, 'whenQuestion')} /></label>
        <label>is answered (answers, comma separated)<input aria-label={`Task ${n + 1} condition answers`} {...value(n, 'whenEquals')} /></label>
      </div>
      <label className="check"><input type="checkbox" checked={t.clientFacing} onChange={e => set(n, { clientFacing: e.target.checked })} /> Client-facing (shown on the client's link)</label>
      <button type="button" className="quiet" onClick={() => setTasks(tasks.filter((_, i) => i !== n))}>Remove task</button>
    </div>)}
    <button type="button" className="quiet" onClick={() => setTasks([...tasks, { ...blank }])}>Add a task</button>
  </fieldset>;
}
export const taskBody = (tasks: Row[]) => tasks.map(({ afterTemplate, afterGate, whenQuestion, whenEquals, ...t }) => ({
  ...t, dueDays: t.dueFrom ? Number(t.dueDays || 0) : undefined, startDays: t.startFrom ? Number(t.startDays || 0) : undefined, estimateMinutes: t.estimateMinutes ? Number(t.estimateMinutes) : undefined,
  afterJob: afterTemplate ? { templateId: afterTemplate, gate: afterGate } : undefined,
  when: whenQuestion ? { question: whenQuestion, equals: String(whenEquals).split(',').map(v => v.trim()).filter(Boolean) } : undefined }));

/** One task on the job checklist: owner, dates, estimate, instructions, SOP link and attachment. */
export function TaskInfo({ jobId, step }: { jobId: string; step: Row }) {
  const bits = [step.owner && `${step.done_at ? 'Owner was' : 'Owner'} ${step.owner}${step.assignee_role && !step.done_at ? ` (${ROLE[step.assignee_role]})` : ''}`,
    step.start_date && `starts ${day(step.start_date)}`, step.due_date && `due ${day(step.due_date)}`, step.estimate_minutes && `estimate ${step.estimate_minutes} min`,
    step.client_facing ? 'client-facing' : '', step.requires_attachment ? 'needs an attachment' : ''].filter(Boolean);
  return <>
    {bits.length > 0 && <small className="muted"> · {bits.join(' · ')}</small>}
    {step.instructions && <small className="hint">{step.instructions}</small>}
    {step.sop_url && <small><a href={step.sop_url} target="_blank" rel="noreferrer noopener">Open SOP</a></small>}
    {step.attachment_name && <small><a href={`/api/blotter/jobs/${jobId}/steps/${step.ordinal}/attachment`}>{step.attachment_name}</a></small>}
  </>;
}
export async function attachmentBody(file: File | undefined) { return file ? { attachment: await readFile(file) } : {}; }

/** Client-facing tasks on the client's link: label, due date and whether it is done. */
export function ClientTasks({ tasks }: { tasks: Row[] }) {
  if (!tasks?.length) return null;
  return <section className="panel"><h2>Progress</h2><ul className="list">{tasks.map((t: Row, n: number) => <li key={n}>{t.done ? '✓' : '○'} {t.label}{t.dueDate && <small className="muted"> · due {day(t.dueDate)}</small>}</li>)}</ul></section>;
}
