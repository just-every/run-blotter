// The document-chase wall ("What we're waiting on"): every readable job with
// client document requests, the reminders sent for it, whether a reviewer
// returned it, and the one band it belongs in. Read only.
import { readableJobParams, readableJobSql, rows, type Actor, type Data } from './model';

const WEEK = 7 * 86_400_000;

export type Band = 'look' | 'waiting' | 'done';
/**
 * The wall's band rule; a job is in exactly one band or not on the wall.
 * In · needs a look: returned for rework, a document received and not yet
 * accepted, or in review with every document accepted (the reviewer's decision
 * is due). Waiting on client: open with a document still requested. Done this
 * week: signed off in the last seven days, or open with every document accepted
 * in the last seven days.
 */
function bandOf(j: Data, requests: Data[], returned: boolean, weekAgo: string): { band: Band | null; doneAt: string | null } {
  const lastAccepted = requests.reduce((m, r) => String(r.updated_at) > m ? String(r.updated_at) : m, '');
  if (returned) return { band: 'look', doneAt: null };
  if (j.status === 'signed_off') return { band: String(j.signed_off_at) >= weekAgo ? 'done' : null, doneAt: String(j.signed_off_at) };
  if (j.status === 'review' || requests.some(r => r.status === 'received')) return { band: 'look', doneAt: null };
  if (requests.some(r => r.status === 'requested')) return { band: 'waiting', doneAt: null };
  return { band: lastAccepted >= weekAgo ? 'done' : null, doneAt: lastAccepted };
}

export async function inbox(db: D1Database, actor: Actor) {
  const at = new Date(), weekAgo = new Date(at.getTime() - WEEK).toISOString();
  const monthStart = `${at.toISOString().slice(0, 7)}-01`;
  const jobs = await rows(db, `SELECT b_jobs.id,b_jobs.title,b_jobs.period_label,b_jobs.due_date,b_jobs.status,b_jobs.revision,b_jobs.preparer_email,
      b_jobs.reviewer_email,b_jobs.created_at,b_jobs.submitted_at,b_jobs.signed_off_at,c.name client_name,w.name work_type
    FROM b_jobs JOIN b_clients c ON c.id=b_jobs.client_id LEFT JOIN b_work_types w ON w.id=b_jobs.work_type_id
    WHERE ${readableJobSql} AND EXISTS(SELECT 1 FROM b_requests r WHERE r.job_id=b_jobs.id)
      AND (b_jobs.status<>'signed_off' OR b_jobs.signed_off_at>=?)
    ORDER BY b_jobs.due_date,c.name`, ...readableJobParams(actor), weekAgo);
  const ids = JSON.stringify(jobs.map(j => j.id));
  const inJobs = 'job_id IN (SELECT value FROM json_each(?))';
  const [requests, reminders, history, returns, people, asked] = await Promise.all([
    rows(db, `SELECT r.id,r.job_id,r.label,r.status,r.note,r.updated_at,(SELECT MAX(f.uploaded_at) FROM b_files f WHERE f.request_id=r.id) received_at
      FROM b_requests r WHERE r.${inJobs} ORDER BY r.ordinal`, ids),
    rows(db, `SELECT job_id,sent_at,sent_by,delivery,proposal_id FROM b_reminders WHERE ${inJobs} ORDER BY sent_at`, ids),
    rows(db, `SELECT job_id,from_stage,to_stage,by,at FROM b_job_status_history WHERE ${inJobs} ORDER BY at`, ids),
    rows(db, `SELECT object_id job_id,detail,at FROM b_audit WHERE action='job.returned' AND object_id IN (SELECT value FROM json_each(?)) ORDER BY at`, ids),
    rows(db, `SELECT email,name FROM b_members UNION ALL SELECT email,display_name FROM oa_operators WHERE role='owner'`),
    rows(db, `SELECT COUNT(*) n FROM b_requests r JOIN b_jobs ON b_jobs.id=r.job_id WHERE ${readableJobSql} AND b_jobs.created_at>=?`, ...readableJobParams(actor), monthStart),
  ]);
  const name = (email: string) => people.find(p => p.email === email)?.name || email;
  const last = <T extends Data>(list: T[], jobId: string) => list.filter(r => r.job_id === jobId).at(-1);
  return {
    now: at.toISOString(), monthStart, asked: Number(asked[0]?.n ?? 0),
    jobs: jobs.flatMap(j => {
      const move = last(history.filter(h => h.from_stage), j.id), back = last(returns, j.id), asks = requests.filter(r => r.job_id === j.id);
      // Returned for rework: the job's latest move (its creation row is not a move) is from review back to work and it is open again.
      const returned = j.status === 'open' && move?.from_stage === 'in_review' && move.to_stage !== 'in_review' && back
        ? { by: name(move.by), at: move.at, note: back.detail } : null;
      const { band, doneAt } = bandOf(j, asks, !!returned, weekAgo);
      return band ? [{
        ...j, band, done_at: band === 'done' ? doneAt : null, preparer_name: name(j.preparer_email), reviewer_name: name(j.reviewer_email), returned,
        requests: asks,
        reminders: reminders.filter(r => r.job_id === j.id).map(r => ({ at: r.sent_at, by: name(r.sent_by), delivery: r.delivery, prepared: !!r.proposal_id })),
      }] : [];
    }),
  };
}
