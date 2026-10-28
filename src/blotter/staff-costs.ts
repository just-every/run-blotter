// BILL-018 staff cost rates: the practice's hourly cost of a person, from an effective date. Only
// the principal records them in a native session; the report shows the derived cost to the
// principal and financial-authority holders only, and recorded rates never change retroactively.
import { atomic, audit, date, email, human, id, insist, integer, need, now, rows, stmt, text, type Actor, type Data } from './model';

export async function setStaffCost(db: D1Database, actor: Actor, body: Data) {
  human(actor); need(actor, 'owner');
  const person = email(body.email), costCents = integer(body.costCents, 'Hourly staff cost in USD cents', 0, 1_000_000), effectiveFrom = date(body.effectiveFrom, 'Effective from'), reason = text(body.reason, 'Source of this cost rate', 1000);
  insist(body.currency === undefined || body.currency === 'USD', 'Staff costs are recorded in USD');
  insist(person === actor.email || await stmt(db, 'SELECT 1 FROM b_members WHERE email=?', person).first(), 'Add the person to the practice first', 404);
  const costId = id();
  await atomic(db, actor, [stmt(db, 'INSERT INTO b_staff_costs(id,person_email,cost_cents,effective_from,reason,set_by,set_at) VALUES(?,?,?,?,?,?,?)', costId, person, costCents, effectiveFrom, reason, actor.email, now()),
    audit(db, actor, 'staff_cost.set', costId, `${person}; ${costCents} USD cents an hour from ${effectiveFrom}; ${reason}`)]);
  return { id: costId, email: person, costCents, effectiveFrom };
}
export async function staffCosts(db: D1Database, actor: Actor) {
  human(actor); need(actor, 'owner');
  return rows(db, 'SELECT * FROM b_staff_costs ORDER BY person_email,effective_from,set_at');
}

/** The cost of invoiced time and adjustment lines, by source key; minutes with no cost rate in force are reported, never guessed. */
export async function invoicedStaffCost(db: D1Database, jobsJson: string) {
  const lines = await rows(db, `SELECT 'time:'||t.id source_key,t.person_email,t.date,t.minutes FROM b_time t WHERE t.id IN (SELECT substr(s.source_key,6) FROM b_invoice_sources s JOIN b_invoices i ON i.id=s.invoice_id WHERE i.job_id IN (SELECT value FROM json_each(?)) AND s.source_key LIKE 'time:%')
    UNION ALL SELECT 'adj:'||a.id,t.person_email,t.date,a.minutes FROM b_time_adjustments a JOIN b_time t ON t.id=a.entry_id WHERE a.id IN (SELECT substr(s.source_key,5) FROM b_invoice_sources s JOIN b_invoices i ON i.id=s.invoice_id WHERE i.job_id IN (SELECT value FROM json_each(?)) AND s.source_key LIKE 'adj:%')`, jobsJson, jobsJson);
  const rates = await rows(db, 'SELECT person_email,cost_cents,effective_from FROM b_staff_costs ORDER BY effective_from,set_at');
  return new Map(lines.map(l => {
    const rate = rates.filter(r => r.person_email === l.person_email && r.effective_from <= l.date).at(-1);
    return [l.source_key as string, { cents: rate ? Math.round(Number(l.minutes) * Number(rate.cost_cents) / 60) : 0, unratedMinutes: rate ? 0 : Math.abs(Number(l.minutes)) }];
  }));
}
