import { OrganizerTemplateEditor } from './organizers';
import { ClientDetails } from './client-details';
import { VaultDetails } from './vault';
import { StarterLibrary } from './starter-library';
import { StatusSettings } from './statuses';
import { Blotter, api, money, taxId, Empty, Field, Form, type Row, type Run } from './common';
import { useState } from 'react';
import { ScheduleBulk } from './bulk';
import { questionBody } from './flow';
import { RecurrencePanel } from './recurrence';
import { DuplicatesPanel } from './duplicates';
import { TaskEditor, taskBody } from './tasks';
import { MessageTemplates } from './messages';
import { Pipeline } from './pipeline';
import { ClientHistoryDetails } from './history';
import { describe, FieldsPanel, GroupsPanel, ProfileInputs, profileBody, SegmentPanel } from './profiles';

const SALES_TAX_STEPS = ['Reconcile bank accounts', 'Review taxable sales and exemptions', 'Prepare state sales-tax workpapers', 'Draft sales-tax return for review'].join('\n');
const SALES_TAX_REQUESTS = ['Bank statements for the quarter', 'Sales invoices and receipts', 'Purchase receipts and bills'].join('\n');

export function Clients({ state, run, open, tick }: { state: Row; run: Run; open: (id: string) => void; tick: number }) {
  const lead = state.actor.role !== 'preparer';
  const people: Row[] = state.people;
  const [segment, setSegment] = useState<Row[]>(), [tasks, setTasks] = useState<Row[]>([]);
  return <div className="grid">
    <Blotter className="wide"><section className="panel">
      <h2>Clients</h2>
      {!state.clients.length && <Empty>No clients yet. Add one here or bring your list in under Move in.</Empty>}
      <ul className="list">{state.clients.map((c: Row) => <li key={c.id}><strong>{c.name}</strong> <small className="muted">{c.abn && `${taxId(c.abn)} · `}{c.contact_email || 'no contact email'}{c.source !== 'native' && ' · imported'}</small>{describe(c, state.fields) && <small className="muted"> · {describe(c, state.fields)}</small>}
        {lead && <ClientDetails clientId={c.id} state={state} run={run} tick={tick} />}<VaultDetails clientId={c.id} run={run} tick={tick} owner={state.actor.role === 'owner'} />{lead && <ClientHistoryDetails clientId={c.id} people={state.people} run={run} open={open} />}</li>)}</ul>
      {lead && <details><summary>Add a client</summary>
        <Form label="Add client" submit={async (data, form) => run(async () => { await api('/clients', { name: data.name, ein: data.ein, contactName: data.contactName, contactEmail: data.contactEmail, ...profileBody(data) }); form.reset(); }, 'Client added')}>
          <Field label="Client name" name="name" />
          <Field label="EIN (optional, 9 digits)" name="ein" required={false} />
          <Field label="Contact name" name="contactName" required={false} />
          <Field label="Contact email (receives document reminders)" name="contactEmail" type="email" required={false} />
          <ProfileInputs fields={state.fields} />
        </Form>
      </details>}
    </section></Blotter>
    {lead && <Pipeline state={state} run={run} tick={tick} open={open} />}
    {lead && <DuplicatesPanel run={run} tick={tick} />}
    {lead && <FieldsPanel state={state} run={run} />}
    {lead && <GroupsPanel state={state} run={run} />}
    {lead && <SegmentPanel state={state} run={run} segment={segment} setSegment={setSegment} />}
    <section className="panel">
      <h2>Job templates</h2>
      {!state.templates.length && <Empty>No templates yet.</Empty>}
      <ul className="list">{state.templates.map((t: Row) => <li key={t.id}><strong>{t.name}</strong> <small className="muted">{t.recurrence} · {JSON.parse(t.steps).length} steps · {JSON.parse(t.requests).length} document requests{t.fee_cents > 0 && <> · fee {money(t.fee_cents, t.currency)}</>}</small></li>)}</ul>
      {lead && <details><summary>Add a template</summary>
        <Form label="Save template" submit={async (data, form) => run(async () => { await api('/templates', { ...data, feeCents: Number(data.feeCents || 0), ...(tasks.length ? { tasks: taskBody(tasks), questions: questionBody(data.questions) } : {}) }); form.reset(); setTasks([]); }, 'Template saved')}>
          <Field label="Name" name="name" value="Quarterly sales-tax return" />
          <Field label="Repeats" name="recurrence"><select name="recurrence" defaultValue="quarterly"><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="annual">Annual</option></select></Field>
          <Field label="Checklist steps (one per line)" name="steps"><textarea name="steps" rows={4} required defaultValue={SALES_TAX_STEPS} /></Field>
          <TaskEditor people={people} templates={state.templates} tasks={tasks} setTasks={setTasks} />
          {tasks.length > 0 && <Field label="Job questions for branches, one per line: key | question | answer, answer" name="questions" required={false}><textarea name="questions" rows={2} placeholder="itemized | Itemizing deductions this year? | yes, no" /></Field>}
          <Field label="Documents to request from the client (one per line)" name="requests"><textarea name="requests" rows={3} required defaultValue={SALES_TAX_REQUESTS} /></Field>
          <Field label="Currency" name="currency"><select name="currency" defaultValue={state.firm?.currency ?? 'USD'}><option value="USD">USD</option>{(state.firm?.currency === 'AUD' || state.templates.some((t: Row) => t.currency === 'AUD')) && <option value="AUD">AUD</option>}</select></Field>
          <Field label="Fixed fee in cents (0 for none)" name="feeCents" type="number" value={0} />
        </Form>
      </details>}
    </section>
    {lead && <OrganizerTemplateEditor templates={state.templates} run={run} />}
    {lead && <StarterLibrary state={state} run={run} tick={tick} />}
    {lead && <RecurrencePanel state={state} run={run} tick={tick} />}
    {lead && <section className="panel wide">
      <h2>Start a job</h2>
      {!state.clients.length || !state.templates.length ? <Empty>Add a client and a template first.</Empty> :
        <Form label="Start job" submit={async data => run(async () => { const j = await api('/jobs', data); open(j.id); return j.warnings?.length ? `Job started. Warning: ${j.warnings.map((w: Row) => w.message).join(' ')}` : undefined; }, 'Job started from the template')}>
          <div className="row">
            <Field label="Client" name="clientId"><select name="clientId" required>{state.clients.map((c: Row) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
            <Field label="Template" name="templateId"><select name="templateId" required>{state.templates.map((t: Row) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Field>
            <Field label="Work type" name="workTypeId" required={false}><select name="workTypeId"><option value="">The template's own</option>{state.statusModel.workTypes.map((w: Row) => <option key={w.id} value={w.id}>{w.name}{w.roles.length > 0 && ` (needs ${w.roles.join(' and ')})`}</option>)}</select></Field>
          </div>
          <div className="row">
            <Field label="Period starts" name="periodStart" type="date" />
            <Field label="Obligation ID (calculates the due date)" name="obligationId" required={false} hint="From the client's deadline obligations; leave blank to record a date" />
            <Field label="Due date (recorded when no obligation is given)" name="dueDate" type="date" required={false} />
          </div>
          <Field label="Where a recorded due date comes from" name="dueNote" required={false} value="Federal or state agency notice, checked by the principal" />
          <Field label="Time budget, minutes (optional)" name="budgetMinutes" type="number" required={false} />
          <div className="row">
            <Field label="Preparer" name="preparerEmail"><select name="preparerEmail" required>{people.map(p => <option key={p.email} value={p.email}>{p.name} ({p.role})</option>)}</select></Field>
            <Field label="Reviewer" name="reviewerEmail"><select name="reviewerEmail" required>{people.filter(p => p.role !== 'preparer').map(p => <option key={p.email} value={p.email}>{p.name} ({p.role})</option>)}</select></Field>
            <Field label="Manager" name="managerEmail"><select name="managerEmail"><option value="">Same as the reviewer</option>{people.filter(p => p.role !== 'preparer').map(p => <option key={p.email} value={p.email}>{p.name} ({p.role})</option>)}</select></Field>
            <Field label="Partner sign-off" name="partnerEmail" required={false}><select name="partnerEmail"><option value="">Not needed</option>{people.filter(p => p.role !== 'preparer').map(p => <option key={p.email} value={p.email}>{p.name} ({p.role})</option>)}</select></Field>
          </div>
        </Form>}
    </section>}
    <MessageTemplates actor={state.actor} run={run} tick={tick} />
    {lead && <section className="panel wide">
      <h2>Schedule work in bulk</h2>
      <p className="muted">Start one period's jobs for several clients. People come from an override, else the client's last period, else the default. Existing jobs are kept.</p>
      <ScheduleBulk key={`${segment ? 'segment' : 'all'}:${(segment ?? state.clients).map((c: Row) => c.id).join(',')}`} state={state} run={run} segment={segment} />
    </section>}
    {lead && <StatusSettings state={state} run={run} tick={tick} />}
  </div>;
}
