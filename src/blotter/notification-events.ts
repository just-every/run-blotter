// NOTIFY-004: native events project safe summaries, never client names, file
// names, audit detail, provider errors or identifiers from client content.
import { firmSettings, localClock } from './firm';
import { id, rows, stmt } from './model';
import { ownerSql } from './tasks';

const statusActions = "'job.status','job.signed_off'";
const activeRecipient = (email: string) => `(EXISTS(SELECT 1 FROM oa_operators o WHERE o.email=${email} AND o.role='owner' AND o.status='active')
  OR EXISTS(SELECT 1 FROM b_members m WHERE m.email=${email} AND m.active=1))`;
const insertColumns = 'INSERT OR IGNORE INTO b_notifications(id,to_email,kind,job_id,thread_id,summary,delivery,created_at)';

/** All projections and their consumption markers commit together. Stable IDs
 * also deduplicate competing sync calls before either caller sees a marker. */
function auditProjection(db: D1Database, ids: string, kind: string, summary: string, source: string, recipient: string, where: string, task = 'NULL') {
  return stmt(db, `${insertColumns}
    SELECT 'native:'||json_array('audit',a.id,?,${recipient},${task}),${recipient},?,j.id,NULL,?,'in-app only',a.at
    FROM b_audit a ${source}
    WHERE a.id IN (SELECT value FROM json_each(?)) AND ${where}
      AND ${recipient} IS NOT NULL AND ${recipient}<>'' AND ${activeRecipient(recipient)}
      AND NOT EXISTS(SELECT 1 FROM b_notification_events e WHERE e.source_key='audit:'||a.id)`, kind, kind, summary, ids);
}

const failureSources = [
  { key: 'reminder:', table: 'b_reminders', join: '', job: 'd.job_id' },
  { key: 'deliverable:', table: 'b_deliverable_versions', join: '', job: 'd.job_id' },
  { key: 'organizer-delivery:', table: 'b_organizer_deliveries', join: 'JOIN b_job_organizers g ON g.id=d.organizer_id', job: 'g.job_id' },
];
// Suppression in development, acceptance and pending/uncertain sends are not
// reported as failures. An uncertain submission must be reconciled, not retried.
const failed = `(d.delivery LIKE 'failed%' OR d.delivery LIKE 'rejected%' OR d.delivery LIKE 'rate_limited%'
  OR d.delivery LIKE 'not sent:%' OR d.delivery LIKE 'bounced%')`;

async function projectFailures(db: D1Database) {
  // reminder.sent names the job, not the reminder. Delivery IDs distinguish
  // concurrent sends and catch a provider result written after another sync.
  for (;;) {
    const groups = await Promise.all(failureSources.map(async source => ({ source, events: await rows(db,
      `SELECT d.id FROM ${source.table} d WHERE ${failed}
        AND NOT EXISTS(SELECT 1 FROM b_notification_events e WHERE e.source_key=?||d.id)
        ORDER BY d.sent_at,d.id LIMIT 100`, source.key) })));
    const statements: D1PreparedStatement[] = [];
    for (const { source, events } of groups) {
      if (!events.length) continue;
      const ids = JSON.stringify(events.map(e => e.id));
      statements.push(stmt(db, `${insertColumns}
        SELECT 'native:'||json_array(?,d.id,'delivery_failed',d.sent_by),d.sent_by,'delivery_failed',j.id,NULL,'Delivery failed','in-app only',d.sent_at
        FROM ${source.table} d ${source.join} JOIN b_jobs j ON j.id=${source.job}
        WHERE d.id IN (SELECT value FROM json_each(?)) AND ${failed} AND ${activeRecipient('d.sent_by')}
          AND NOT EXISTS(SELECT 1 FROM b_notification_events e WHERE e.source_key=?||d.id)`, source.key, ids, source.key),
      stmt(db, `INSERT OR IGNORE INTO b_notification_events(source_key) SELECT ?||id FROM ${source.table} WHERE id IN (SELECT value FROM json_each(?))`, source.key, ids));
    }
    if (!statements.length) return;
    await db.batch(statements);
    if (groups.every(g => g.events.length < 100)) return;
  }
}

// A person already holding another job role is not alerted twice. Revoked
// assignments leave the portable snapshot; assigning the person again is new.
async function projectWork(db:D1Database) {
  const source=`SELECT DISTINCT j.id,j.revision,p.value email FROM b_jobs j JOIN json_each(json_array(j.preparer_email,j.reviewer_email,j.manager_email,j.partner_email)) p WHERE p.value IS NOT NULL`;
  await db.batch([
    stmt(db,`${insertColumns} SELECT 'native-work:'||json_array(j.id,j.email,j.revision),j.email,'work_assigned',j.id,NULL,'Work assigned to you','in-app only',?
      FROM (${source}) j WHERE ${activeRecipient('j.email')} AND NOT EXISTS(SELECT 1 FROM b_notification_job_owners p WHERE p.job_id=j.id AND p.email=j.email)`,new Date().toISOString()),
    stmt(db,`DELETE FROM b_notification_job_owners WHERE NOT EXISTS(SELECT 1 FROM (${source}) j WHERE j.id=b_notification_job_owners.job_id AND j.email=b_notification_job_owners.email)`),
    stmt(db,`INSERT OR IGNORE INTO b_notification_job_owners SELECT id,email FROM (${source})`),
  ]);
}

// Compare the actual resolved task owner after every mutation, so named-task
// handovers, role changes and offboarding share the same transactional producer.
async function projectTasks(db:D1Database) {
  const changed=await rows(db,`SELECT j.id job_id,s.ordinal,${ownerSql} owner FROM b_job_steps s JOIN b_jobs j ON j.id=s.job_id
    LEFT JOIN b_notification_task_owners p ON p.job_id=j.id AND p.ordinal=s.ordinal
    WHERE s.done_at IS NULL AND (p.job_id IS NULL OR p.email IS NOT ${ownerSql})`);
  for(const task of changed) await db.batch([
    stmt(db,`${insertColumns} SELECT ?,?, 'task_assigned',?,NULL,'Task assigned to you','in-app only',?
      WHERE ? IS NOT NULL AND ${activeRecipient('?2')} AND NOT EXISTS(SELECT 1 FROM b_notification_task_owners WHERE job_id=?3 AND ordinal=?6 AND email IS ?2)`,
      'native-task:'+id(),task.owner,task.job_id,new Date().toISOString(),task.owner,task.ordinal),
    stmt(db,'INSERT INTO b_notification_task_owners VALUES(?,?,?) ON CONFLICT(job_id,ordinal) DO UPDATE SET email=excluded.email',task.job_id,task.ordinal,task.owner),
  ]);
}

/** Called after successful native mutations. Discussion and review-specific
 * alerts already have their own producers and are not replayed here. */
export async function syncNotificationEvents(db: D1Database) {
  for (;;) {
    const events = await rows(db, `SELECT a.id FROM b_audit a
      WHERE NOT EXISTS(SELECT 1 FROM b_notification_events e WHERE e.source_key='audit:'||a.id)
      ORDER BY a.at,a.id LIMIT 100`);
    if (!events.length) break;
    const ids = JSON.stringify(events.map(e => e.id));
    await db.batch([
      auditProjection(db, ids, 'status_changed', 'Work status changed', 'JOIN b_jobs j ON j.id=a.object_id', 'j.preparer_email', `a.action IN (${statusActions})`),
      auditProjection(db, ids, 'upload', 'Client file uploaded', 'JOIN b_files f ON f.id=a.object_id JOIN b_jobs j ON j.id=f.job_id', 'j.preparer_email',
        "a.action='file.uploaded' AND f.channel='portal' AND f.erased_at IS NULL"),
      auditProjection(db, ids, 'organizer_submitted', 'Organizer submitted', 'JOIN b_jobs j ON j.id=a.object_id', 'j.preparer_email',
        "a.action='organizer.submitted' AND EXISTS(SELECT 1 FROM b_job_organizers g WHERE g.job_id=j.id AND g.erased_at IS NULL)"),
      ...['settled', 'failed', 'refunded', 'returned'].map(state => auditProjection(db, ids, `payment_${state}`, `Payment ${state}`,
        'JOIN b_invoices i ON i.id=a.object_id JOIN b_jobs j ON j.id=i.job_id', 'i.owner_email',
        `a.action='payment.${state}' AND i.erased_at IS NULL`)),
      stmt(db, `INSERT OR IGNORE INTO b_notification_events(source_key) SELECT 'audit:'||id FROM b_audit WHERE id IN (SELECT value FROM json_each(?))`, ids),
    ]);
    if (events.length < 100) break;
  }
  await projectWork(db);
  await projectTasks(db);
  await projectFailures(db);
}

/** One due-soon and one overdue alert per job, current preparer and due date.
 * Calendar days use each recipient's zone; DST never changes date arithmetic. */
export async function dueNotifications(db: D1Database, at: Date) {
  const firm = await firmSettings(db);
  const people = await rows(db, `SELECT DISTINCT j.preparer_email email,p.settings
    FROM b_jobs j JOIN b_clients c ON c.id=j.client_id
    LEFT JOIN b_notification_settings p ON p.email=j.preparer_email
    WHERE j.status<>'signed_off' AND c.lifecycle='active' AND c.merged_into IS NULL AND ${activeRecipient('j.preparer_email')}`);
  for (const person of people) {
    const settings = JSON.parse(person.settings ?? '{}');
    const timeZone = settings.timeZone || firm.timeZone;
    const leadDays = Number.isInteger(settings.leadDays) && settings.leadDays >= 0 && settings.leadDays <= 365 ? settings.leadDays : 1;
    const today = localClock({ ...firm, timeZone }, at).localDate;
    const through = new Date(Date.parse(today + 'T00:00:00Z') + leadDays * 86_400_000).toISOString().slice(0, 10);
    await db.batch([stmt(db, `${insertColumns}
      SELECT 'native:'||json_array('due',j.id,j.preparer_email,j.due_date,CASE WHEN j.due_date<?1 THEN 'overdue' ELSE 'due_soon' END),
        j.preparer_email,CASE WHEN j.due_date<?1 THEN 'overdue' ELSE 'due_soon' END,j.id,NULL,
        CASE WHEN j.due_date<?1 THEN 'Work overdue (due ' ELSE 'Work due soon (due ' END||j.due_date||')','in-app only',?2
      FROM b_jobs j JOIN b_clients c ON c.id=j.client_id
      WHERE j.preparer_email=?3 AND j.status<>'signed_off' AND j.due_date<=?4
        AND c.lifecycle='active' AND c.merged_into IS NULL AND ${activeRecipient('j.preparer_email')}`,
    today, at.toISOString(), person.email, through)]);
  }
}
