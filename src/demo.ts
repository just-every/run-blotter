// Demo mode's sample practice (Base DEMO.md): Morgan & Co Bookkeeping, with
// its team, clients, recurring jobs in every state around `now`, client
// documents, review sign-offs, billing exports and the practice assistant's
// preparations. It runs once after the owner exists, never fetches, and writes
// fixed ids with ON CONFLICT DO NOTHING, so a repeat changes nothing.
import { runtimeBindings, type Bindings } from './auth.server'
import { localDay } from './blotter/demo/clock'
import { digest } from './blotter/model'
import { fixedId } from './blotter/demo/ids'
import { clients, principal, team, templates } from './blotter/demo/practice'
import { practiceWork, type Row } from './blotter/demo/work'
import { ASSISTANT, practiceBilling } from './blotter/demo/billing'

const DAY = 86_400_000

/** One statement inserting every row of a table from a JSON array. */
function bulk(db: D1Database, table: string, rows: Row[]) {
  const columns = Object.keys(rows[0])
  return db.prepare(`INSERT INTO ${table}(${columns.join(',')}) SELECT ${columns.map(c => `json_extract(value,'$.${c}')`).join(',')} FROM json_each(?) WHERE true ON CONFLICT DO NOTHING`).bind(JSON.stringify(rows))
}
const secretDigest = () => digest(crypto.randomUUID() + crypto.randomUUID())

export async function seedDemo(original: Bindings, { ownerEmail, now }: { ownerEmail: string; now: Date }): Promise<void> {
  const env = runtimeBindings(original), db = env.DB, clock = now.getTime()
  const owner = await db.prepare("SELECT id,email FROM oa_operators WHERE email=? AND role='owner' AND status='active'").bind(ownerEmail).first<{ id: string; email: string }>()
  if (!owner) throw new Error('The demo owner does not exist yet.')
  const today = localDay(now)
  const work = practiceWork(now, owner), billing = await practiceBilling(work, now, owner, today)
  const opened = clock - 300 * DAY, iso = (ms: number) => new Date(ms).toISOString()

  // Upload links nobody holds: only a digest is ever stored. File hashes are the bytes' own.
  for (const link of work.links) link.digest = await secretDigest()
  for (const file of work.files) file.sha256 = await digest(Uint8Array.from(atob(String(file.content_base64)), c => c.charCodeAt(0)))
  for (const reminder of work.reminders) reminder.message = String(reminder.message).replace('{origin}', env.AUTH_ORIGIN)

  const people = [{ email: owner.email, rateCents: principal.rateCents }, ...team]
  await db.batch([
    db.prepare('UPDATE oa_operators SET display_name=? WHERE id=?').bind(principal.name, owner.id),
    // The owner's finished first run: the demo opens on the practice's jobs, not on setup.
    db.prepare('INSERT INTO oa_first_run(singleton,completed_by,completed_at) VALUES(1,?,?) ON CONFLICT(singleton) DO NOTHING').bind(owner.id, clock),
    bulk(db, 'oa_operators', team.map(m => ({ id: m.id, email: m.email, display_name: m.name, role: 'member', status: 'active', created_at: opened + DAY }))),
    bulk(db, 'b_members', team.map(m => ({ email: m.email, name: m.name, role: m.role, active: 1 }))),
    bulk(db, 'b_rate_cards', people.map(p => ({ id: fixedId('rate:' + p.email), scope: 'staff', person_email: p.email, rate_cents: p.rateCents, currency: 'USD', effective_from: iso(opened).slice(0, 10), created_by: owner.email, created_at: iso(opened + DAY) }))),
    bulk(db, 'b_clients', Object.values(clients).map((c, n) => ({ id: c.id, name: c.name, abn: c.abn, contact_name: c.contactName, contact_email: c.contactEmail, source: 'native', revision: fixedId('revision:' + c.id), created_at: iso(opened + (2 + n) * DAY) }))),
    bulk(db, 'b_templates', Object.values(templates).map(t => ({ id: t.id, name: t.name, recurrence: t.recurrence, steps: JSON.stringify(t.steps), requests: JSON.stringify(t.requests), fee_cents: t.feeCents, currency: 'USD', created_by: owner.email, created_at: iso(opened + DAY) }))),
    // Each template's own work type, every job in it, and the status history its dates imply (WORK-007).
    bulk(db, 'b_work_types', Object.values(templates).map(t => ({ id: 'wt-' + t.id, name: t.name, template_id: t.id, created_by: owner.email, created_at: iso(opened + DAY) }))),
    bulk(db, 'b_jobs', work.jobs.map(j => ({ ...j, work_type_id: 'wt-' + j.template_id, open_stage: 'in_progress' }))),
    bulk(db, 'b_job_status_history', work.jobs.flatMap(j => [
      { id: fixedId('status:' + j.id), job_id: j.id, from_stage: null, to_stage: 'in_progress', by: j.created_by, at: j.created_at },
      ...(j.submitted_at ? [{ id: fixedId('status:review:' + j.id), job_id: j.id, from_stage: 'in_progress', to_stage: 'in_review', by: j.submitted_by, at: j.submitted_at }] : []),
      ...(j.signed_off_at ? [{ id: fixedId('status:done:' + j.id), job_id: j.id, from_stage: 'in_review', to_stage: 'completed', by: j.signed_off_by, at: j.signed_off_at }] : []),
    ])),
    bulk(db, 'b_job_steps', work.steps),
    bulk(db, 'b_requests', work.requests),
    bulk(db, 'b_files', work.files),
    bulk(db, 'b_portal_links', work.links),
    bulk(db, 'b_reminders', work.reminders),
    bulk(db, 'b_time', work.time),
    bulk(db, 'b_time_status', work.timeStatus),
    bulk(db, 'b_exports', billing.exports),
    ...(billing.sources.length ? [bulk(db, 'b_export_sources', billing.sources)] : []),
    bulk(db, 'b_agent_keys', [
      { id: fixedId('key:assistant'), label: ASSISTANT, digest: await secretDigest(), owner_id: owner.id, revoked: 0, created_at: iso(clock - 70 * DAY) },
      { id: fixedId('key:retired'), label: 'Old spreadsheet macro', digest: await secretDigest(), owner_id: owner.id, revoked: 1, created_at: iso(opened + 20 * DAY) },
    ]),
    bulk(db, 'b_proposals', billing.proposals),
    bulk(db, 'b_audit', [...work.audit, ...billing.audit]),
  ])
}
