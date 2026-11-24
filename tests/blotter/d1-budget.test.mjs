// The hourly Cron Trigger and every successful write refresh staff notifications. On Workers Free the D1 allowance
// is 5,000,000 rows read a day for the whole account, so that refresh must cost the same with a month of history
// as with none. Real workerd and D1; rows read are counted per statement by d1-meter-worker.mjs.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {harness} from './harness.mjs';

const days = 30, auditPerDay = 100, jobCount = 300, deliveries = 150;
// Generous: a write refresh read about 18,000 rows and an hourly run about 20,000 at this history before the fix.
const writeBudget = 800, cronNotificationBudget = 2000;

const columns = async (db, table) => (await db.prepare(`PRAGMA table_info(${table})`).all()).results.map(c => c.name);
const series = count => `WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i+1 FROM n WHERE i<${count})`;
// Copy a real row `count` times; `changes` overrides columns with SQL over the series number `n.i`.
async function clone(db, table, where, count, changes) {
 const names = await columns(db, table);
 await db.prepare(`${series(count)} INSERT INTO ${table}(${names.join(',')})
  SELECT ${names.map(name => changes[name] ?? `s.${name}`).join(',')} FROM ${table} s, n WHERE ${where}`).run();
}
const drain = async h => (await (await h.send('/__d1_meter')).json());
// Statements of the notification refresh; the other scheduled jobs have their own budgets.
const notificationSql = /b_notification|b_audit a/;
const total = (log, pattern = /./) => log.filter(({sql}) => pattern.test(sql)).reduce((sum, {rows}) => sum + (rows ?? 0), 0);

test('NOTIFY-001 budget: refreshing staff notifications reads the same rows with a month of history as with none', async () => {
 const h = await harness({meter: true});
 try {
  await h.json('/team', {email: 'prep@example.test', name: 'Jordan Ellis', role: 'preparer'}, h.owner);
  await h.json('/team', {email: 'reviewer@example.test', name: 'Morgan Chen', role: 'reviewer'}, h.owner);
  const client = await h.json('/clients', {name: 'Cedar Lane LLC', contactName: 'Alex Rivera', contactEmail: 'alex@example.test'}, h.owner);
  const template = await h.json('/templates', {name: 'Monthly close', recurrence: 'monthly', tasks: [{label: 'Inspect statement', assignee: 'preparer'}, {label: 'Review'}], requests: 'Bank statement'}, h.owner);
  const job = await h.json('/jobs', {clientId: client.id, templateId: template.id, periodStart: '2026-01-01', dueDate: '2027-04-15', dueNote: 'Agreed', preparerEmail: 'prep@example.test', reviewerEmail: 'reviewer@example.test'}, h.owner);
  const db = h.db, month = new Date('2026-11-01T00:00:00Z').toISOString();

  // A month of the practice's history: jobs, their tasks, audit trail, delivered and failed sends, alerts.
  await clone(db, 'b_jobs', `s.id='${job.id}'`, jobCount, {id: `'jb'||n.i`, period_start: `date('2024-01-01','+'||n.i||' days')`, revision: `'r'||n.i`, status: `CASE WHEN n.i%5=0 THEN 'signed_off' ELSE 'open' END`, signed_off_by: `CASE WHEN n.i%5=0 THEN 'owner@example.test' END`, sign_off_note: `CASE WHEN n.i%5=0 THEN 'done' END`});
  await clone(db, 'b_job_steps', `s.job_id='${job.id}'`, jobCount, {job_id: `'jb'||n.i`});
  await clone(db, 'b_audit', `s.rowid=(SELECT MIN(rowid) FROM b_audit)`, days * auditPerDay, {id: `'hist'||n.i`, action: `'note.added'`, object_id: `'jb'||(1+n.i%${jobCount})`, at: `strftime('%Y-%m-%dT%H:%M:%fZ','${month}','-'||n.i||' minutes')`});
  await clone(db, 'b_notifications', `s.rowid=(SELECT MIN(rowid) FROM b_notifications)`, days * 10, {id: `'hn'||n.i`, delivery: `'sent'`, created_at: `strftime('%Y-%m-%dT%H:%M:%fZ','${month}','-'||n.i||' hours')`});
  await h.json(`/jobs/${job.id}/reminders`, {}, h.owner);
  const reminder = (await db.prepare('SELECT id FROM b_reminders LIMIT 1').first()).id;
  await clone(db, 'b_reminders', `s.id='${reminder}'`, deliveries, {id: `'hr'||n.i`, job_id: `'jb'||n.i`, delivery: `CASE WHEN n.i%10=0 THEN 'failed: bounced' ELSE 'sent' END`});
  await db.prepare("INSERT OR IGNORE INTO b_notification_events(source_key) SELECT 'audit:'||id FROM b_audit UNION SELECT 'reminder:'||id FROM b_reminders").run();

  // Catch up once (the first refresh after the seed is the only one allowed to be large), then measure steady state.
  await h.json('/clients', {name: 'Warm-up LLC', contactName: 'Pat Lee', contactEmail: 'pat@example.test'}, h.owner);
  await h.scheduled('2026-11-01T11:17:00Z');
  await drain(h);
  const owed = await db.prepare('SELECT (SELECT count(*) FROM b_notification_queue) queued,(SELECT count(*) FROM b_audit a WHERE NOT EXISTS(SELECT 1 FROM b_notification_events e WHERE e.source_key=\'audit:\'||a.id)) unread').first();
  assert.deepEqual({...owed}, {queued: 0, unread: 0}, 'the first refresh consumed everything the seed left to do');

  await h.json('/clients', {name: 'Second LLC', contactName: 'Sam Roe', contactEmail: 'sam@example.test'}, h.owner);
  const write = await drain(h);
  const writeRows = total(write.filter(({door}) => door.startsWith('POST')));
  console.log(`write: ${writeRows} rows read in ${write.length} statements (notifications ${total(write, notificationSql)})`);

  await h.scheduled('2026-11-01T12:17:00Z');
  const cron = await drain(h);
  const cronRows = total(cron, notificationSql);
  console.log(`hourly run: ${cronRows} rows read by notification statements, ${total(cron)} by the whole run`);

  assert.ok(writeRows < writeBudget, `a write read ${writeRows} rows; expected under ${writeBudget}`);
  assert.ok(cronRows < cronNotificationBudget, `an hourly run read ${cronRows} rows for notifications; expected under ${cronNotificationBudget}`);
 } finally { await h.close(); }
});
