import { StatusSettings } from './statuses';
import { Blotter, api, aud, Empty, Field, Form, type Row, type Run } from './common';
import { useState } from 'react';
import { ScheduleBulk } from './bulk';
import { questionBody } from './flow';
import { RecurrencePanel } from './recurrence';
import { DuplicatesPanel } from './duplicates';
import { TaskEditor, taskBody } from './tasks';
import { MessageTemplates } from './messages';
import { ClientHistoryDetails } from './history';
import { describe, FieldsPanel, GroupsPanel, ProfileInputs, profileBody, SegmentPanel } from './profiles';

const BAS_STEPS = ['Reconcile bank accounts', 'Code transactions and review GST', 'Prepare activity statement worksheet', 'Draft BAS for review'].join('\n');
const BAS_REQUESTS = ['Bank statements for the quarter', 'Sales invoices and receipts', 'Purchase receipts and bills'].join('\n');

export function Clients({ state, run, open, tick }: { state: Row; run: Run; open: (id: string) => void; tick: number }) {
  const lead = state.actor.role !== 'preparer';
  const people: Row[] = state.people;
  const [segment, setSegment] = useState<Row[]>(), [tasks, setTasks] = useState<Row[]>([]);
  return <div className="grid">
    <Blotter className="wide"><section className="panel">
      <h2>Clients</h2>
      {!state.clients.length && <Empty>No clients yet. Add one here or bring your list in under Move in.</Empty>}
      <ul className="list">{state.clients.map((c: Row) => <li key={c.id}><strong>{c.name}</strong> <small className="muted">{c.abn && `ABN ${c.abn} · `}{c.contact_email || 'no contact email'}{c.source !== 'native' && ' · imported'}</small>{describe(c, state.fields) && <small className="muted"> · {describe(c, state.fields)}</small>}
        {lead && <ClientHistoryDetails clientId={c.id} people={state.people} run={run} open={open} />}</li>)}</ul>
      {lead && <details><summary>Add a client</summary>
        <Form label="Add client" submit={async (data, form) => run(async () => { await api('/clients', { name: data.name, abn: data.abn, contactName: data.contactName, contactEmail: data.contactEmail, ...profileBody(data) }); form.reset(); }, 'Client added')}>
          <Field label="Client name" name="name" />
          <Field label="ABN (optional)" name="abn" required={false} />
          <Field label="Contact name" name="contactName" required={false} />
          <Field label="Contact email (receives document reminders)" name="contactEmail" type="email" required={false} />
          <ProfileInputs fields={state.fields} />
        </Form>
      </details>}
    </section></Blotter>
    {lead && <DuplicatesPanel run={run} tick={tick} />}
    {lead && <FieldsPanel state={state} run={run} />}
    {lead && <GroupsPanel state={state} run={run} />}
    {lead && <SegmentPanel state={state} run={run} segment={segment} setSegment={setSegment} />}
    <section className="panel">
      <h2>Job templates</h2>
      {!state.templates.length && <Empty>No templates yet.</Empty>}
      <ul className="list">{state.templates.map((t: Row) => <li key={t.id}><strong>{t.name}</strong> <small className="muted">{t.recurrence} · {JSON.parse(t.steps).length} steps · {JSON.parse(t.requests).length} document requests{t.fee_cents > 0 && ` · fee ${aud(t.fee_cents)}`}</small></li>)}</ul>
      {lead && <details><summary>Add a template</summary>
        <Form label="Save template" submit={async (data, form) => run(async () => { await api('/templates', { ...data, feeCents: Number(data.feeCents || 0), ...(tasks.length ? { tasks: taskBody(tasks), questions: questionBody(data.questions) } : {}) }); form.reset(); setTasks([]); }, 'Template saved')}>
          <Field label="Name" name="name" value="Quarterly BAS" />
          <Field label="Repeats" name="recurrence"><select name="recurrence" defaultValue="quarterly"><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="annual">Annual</option></select></Field>
          <Field label="Checklist steps (one per line)" name="steps"><textarea name="steps" rows={4} required defaultValue={BAS_STEPS} /></Field>
          <TaskEditor people={people} templates={state.templates} tasks={tasks} setTasks={setTasks} />
          {tasks.length > 0 && <Field label="Job questions for branches, one per line: key | question | answer, answer" name="questions" required={false}><textarea name="questions" rows={2} placeholder="itemized | Itemizing deductions this year? | yes, no" /></Field>}
          <Field label="Documents to request from the client (one per line)" name="requests"><textarea name="requests" rows={3} required defaultValue={BAS_REQUESTS} /></Field>
          <Field label="Fixed fee in cents, ex GST (0 for none)" name="feeCents" type="number" value={0} />
        </Form>
      </details>}
    </section>
    {lead && <RecurrencePanel state={state} run={run} tick={tick} />}
    {lead && <section className="panel wide">
      <h2>Start a job</h2>
      {!state.clients.length || !state.templates.length ? <Empty>Add a client and a template first.</Empty> :
        <Form label="Start job" submit={async data => run(async () => { const j = await api('/jobs', data); open(j.id); }, 'Job started from the template')}>
          <div className="row">
            <Field label="Client" name="clientId"><select name="clientId" required>{state.clients.map((c: Row) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
            <Field label="Template" name="templateId"><select name="templateId" required>{state.templates.map((t: Row) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Field>
          </div>
          <div className="row">
            <Field label="Period starts" name="periodStart" type="date" />
            <Field label="Due date (recorded, not computed)" name="dueDate" type="date" />
          </div>
          <Field label="Where the due date comes from" name="dueNote" value="ATO lodgement program, checked by the principal" />
          <Field label="Time budget, minutes (optional)" name="budgetMinutes" type="number" required={false} />
          <div className="row">
            <Field label="Preparer" name="preparerEmail"><select name="preparerEmail" required>{people.map(p => <option key={p.email} value={p.email}>{p.name} ({p.role})</option>)}</select></Field>
            <Field label="Reviewer" name="reviewerEmail"><select name="reviewerEmail" required>{people.filter(p => p.role !== 'preparer').map(p => <option key={p.email} value={p.email}>{p.name} ({p.role})</option>)}</select></Field>
            <Field label="Manager" name="managerEmail"><select name="managerEmail"><option value="">Same as the reviewer</option>{people.filter(p => p.role !== 'preparer').map(p => <option key={p.email} value={p.email}>{p.name} ({p.role})</option>)}</select></Field>
          </div>
        </Form>}
    </section>}
    <MessageTemplates actor={state.actor} run={run} tick={tick} />
    {lead && <section className="panel wide">
      <h2>Schedule work in bulk</h2>
      <p className="muted">Start one period's jobs for several clients. People come from an override, else the client's last period, else the default. Existing jobs are kept.</p>
      <ScheduleBulk state={state} run={run} segment={segment} />
    </section>}
    {lead && <StatusSettings state={state} run={run} tick={tick} />}
  </div>;
}
