import { useEffect, useState } from 'react';
import { api, Field, Form, type Row, type Run } from './common';

/** US-001 extends the existing Team & safety settings with the firm's practice details. */
export function FirmSettings({ run, tick }: { run: Run; tick: number }) {
  const [firm, setFirm] = useState<Row>(), [preview, setPreview] = useState<Row>();
  useEffect(() => { api('/firm/settings').then(setFirm).catch(e => run(async () => { throw e; })); }, [tick]);
  if (!firm) return null;
  return <section className="panel wide">
    <h2>US firm settings</h2>
    <p className="muted">Dates and activity times use {firm.timeZone}. Filing dates are recorded by your practice with their source; they are not calculated or verified agency deadlines.</p>
    <Form key={JSON.stringify(firm)} label="Save firm settings" submit={async data => run(async () => {
      const calendars = String(data.calendars).split('\n').filter(s => s.trim()).map(line => {
        const [name, jurisdiction, dueDate, ...source] = line.split('|').map(s => s.trim());
        return { name, jurisdiction, dueDate, source: source.join('|').trim() };
      });
      await api('/firm/settings', { ...data, calendars });
    }, 'Firm settings saved')}>
      <div className="row"><Field label="Firm name" name="name" value={firm.name} /><Field label="Firm EIN" name="ein" value={firm.ein} /></div>
      <div className="row"><Field label="Entity classification" name="entity"><select name="entity" defaultValue={firm.entity}>{['Sole proprietor', 'LLC', 'Partnership', 'S corporation', 'C corporation', 'Nonprofit', 'Trust'].map(v => <option key={v}>{v}</option>)}</select></Field>
        <Field label="Default currency" name="currency"><select name="currency" defaultValue={firm.currency}><option>USD</option><option>AUD</option></select></Field></div>
      <Field label="Street address" name="address" value={firm.address} />
      <div className="row"><Field label="City" name="city" value={firm.city} /><Field label="State or territory" name="state" value={firm.state} /><Field label="ZIP code" name="zip" value={firm.zip} /></div>
      <div className="row"><Field label="Fiscal year end (MM-DD)" name="fiscalYearEnd" value={firm.fiscalYearEnd} /><Field label="IANA time zone" name="timeZone" value={firm.timeZone} /></div>
      <Field label="Service lines (one per line)" name="services"><textarea name="services" rows={3} required defaultValue={firm.services.join('\n')} /></Field>
      <div className="row"><Field label="Staff email notification start" name="notificationStart" type="time" value={firm.notificationStart} /><Field label="Staff email notification end" name="notificationEnd" type="time" value={firm.notificationEnd} /></div>
      <p className="muted">Start included, end excluded, in the firm time zone. An end before the start spans midnight; equal times allow all day. In-app alerts appear immediately. Deferred staff emails are released by the hourly scheduler during these hours. Client sends and sign-in emails keep their existing behavior.</p>
      <Field label="Recorded filing calendar" name="calendars" hint="One per line: name | jurisdiction | YYYY-MM-DD | source or firm-defined label"><textarea name="calendars" rows={5} defaultValue={firm.calendars.map((c: Row) => `${c.name} | ${c.jurisdiction} | ${c.dueDate} | ${c.source}`).join('\n')} /></Field>
    </Form>
    <details><summary>Check a date and notification window</summary>
      <Form label="Check firm time" submit={async data => setPreview(await api('/firm/time?at=' + encodeURIComponent(data.at)))}>
        <Field label="Instant with UTC offset" name="at" value="2026-11-01T06:30:00Z" />
      </Form>
      {preview && <p role="status">{preview.localDate} {preview.localTime} {preview.zone} · staff email {preview.notificationsAllowed ? 'within notification hours' : 'deferred'}</p>}
    </details>
  </section>;
}
