// Expenses and disbursements (TIME-004): filing fees, postage, mileage at the
// firm rate and software pass-throughs, recorded against a job and its client.
// Each can carry a receipt and a markup; a reviewer or the principal approves
// it, and only approved billable expenses become billing export lines. Staff
// reimbursements are owed at cost, apart from the client charge.
import { currency } from './currency';
import { openPeriodSql } from './billing';
import { decodeFile, fileResponse } from './documents';
import { atomic, audit, date, digest, guard, human, id, insist, integer, job, need, now, readableJob, rows, stmt, text, type Actor, type Data } from './model';

export const KINDS = { filing_fee: 'Filing fee', postage: 'Postage', mileage: 'Mileage', software: 'Software pass-through', other: 'Other' } as const;
type Kind = keyof typeof KINDS;

/** Whole cents, rounded half up. */
export const markedUp = (costCents: number, percent: number) => costCents + Math.floor((costCents * percent + 50) / 100);
export const mileageCost = (tenths: number, centsPerMile: number) => Math.floor((tenths * centsPerMile + 5) / 10);

/** Miles with at most one decimal place, as tenths of a mile. */
function miles(value: unknown) {
  const v = typeof value === 'number' ? String(value) : value;
  insist(typeof v === 'string' && /^\d{1,5}(\.\d)?$/.test(v.trim()), 'Miles: enter a distance such as 12 or 12.4');
  const [whole, tenth = '0'] = v.trim().split('.');
  const tenths = Number(whole) * 10 + Number(tenth);
  insist(tenths >= 1 && tenths <= 100_000, 'Miles must be between 0.1 and 10000');
  return tenths;
}

const mileageRateSql = 'SELECT cents_per_mile FROM b_mileage_rates WHERE effective_from<=? ORDER BY effective_from DESC LIMIT 1';

export async function setMileageRate(db: D1Database, actor: Actor, body: Data) {
  human(actor); need(actor, 'owner');
  const code = currency(body.currency);
  const from = date(body.effectiveFrom, 'Effective from'), cents = integer(body.centsPerMile, 'Cents per mile', 1, 100_000);
  await atomic(db, actor, [
    stmt(db, 'INSERT INTO b_mileage_rates(effective_from,cents_per_mile,set_by,set_at,currency) VALUES(?,?,?,?,?) ON CONFLICT(effective_from) DO UPDATE SET cents_per_mile=excluded.cents_per_mile,set_by=excluded.set_by,set_at=excluded.set_at,currency=excluded.currency',
      from, cents, actor.email, now(), code),
    audit(db, actor, 'mileage_rate.set', from, `${cents} cents per mile`)]);
  return { effectiveFrom: from, centsPerMile: cents, currency: code };
}

export async function recordExpense(db: D1Database, actor: Actor, jobId: string, body: Data) {
  human(actor);
  const j = await job(db, actor, jobId);
  const kind = body.kind as Kind;
  insist(Object.hasOwn(KINDS, kind), 'Choose the kind of expense');
  const day = date(body.date), description = text(body.description, 'Description', 300);
  const billable = body.billable === true, paidBy = body.paidBy === 'staff' ? 'staff' : 'firm';
  insist(body.paidBy === undefined || ['firm', 'staff'].includes(body.paidBy), 'Choose who paid: the firm or you');
  const markup = billable ? integer(body.markupPercent ?? 0, 'Markup percent', 0, 100) : 0;
  insist(billable || !Number(body.markupPercent), 'Only a billable expense carries a markup');
  let code = currency(body.currency ?? j.currency);
  let tenths: number | null = null, rate: number | null = null, cost: number;
  if (kind === 'mileage') {
    tenths = miles(body.miles);
    const found = await stmt(db, mileageRateSql.replace('SELECT cents_per_mile', 'SELECT cents_per_mile,currency'), day).first<Data>();
    insist(found, `Ask the principal to set a mileage rate in force on ${day}`, 409);
    code = found.currency;
    rate = Number(found.cents_per_mile); cost = mileageCost(tenths, rate);
  } else cost = integer(body.costCents, 'Cost in cents', 1, 100_000_000);
  insist(code === j.currency, `Record this expense in the job currency (${j.currency})`, 409);
  const receipt = body.receipt ? decodeFile(body.receipt) : null;
  insist(!await stmt(db, `SELECT 1 WHERE NOT ${openPeriodSql}`, day).first(), `The billing period covering ${day} is closed`, 409);
  const expense = { id: id(), kind, currency: code, date: day, description, billable, markupPercent: markup, costCents: cost, chargeCents: billable ? markedUp(cost, markup) : 0, paidBy, mileTenths: tenths, centsPerMile: rate };
  // The mileage rate and the open period are checked again inside the batch.
  const [check, release] = guard(db, `${openPeriodSql} AND (? IS NULL OR ((${mileageRateSql})=? AND (${mileageRateSql.replace('SELECT cents_per_mile', 'SELECT currency')})=?))`, day, rate, day, rate, day, code);
  await atomic(db, actor, [check,
    stmt(db, `INSERT INTO b_expenses(id,job_id,client_id,kind,date,description,mile_tenths,cents_per_mile,cost_cents,billable,markup_percent,charge_cents,paid_by,person_email,
        receipt_name,receipt_mime,receipt_size,receipt_sha256,receipt_base64,created_by,created_at,currency) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      expense.id, j.id, j.client_id, kind, day, description, tenths, rate, cost, billable ? 1 : 0, markup, expense.chargeCents, paidBy, actor.email,
      receipt?.name ?? null, receipt?.mime ?? null, receipt?.bytes.length ?? null, receipt ? await digest(receipt.bytes) : null, receipt?.encoded ?? null, actor.email, now(), code),
    release, audit(db, actor, 'expense.recorded', expense.id, `${KINDS[kind]} ${cost} cents${billable ? `, billable +${markup}%` : ', not billable'}, paid by ${paidBy}`)]);
  return { ...expense, status: 'pending' };
}

async function visibleExpense(db: D1Database, actor: Actor, expenseId: string) {
  const e = await stmt(db, 'SELECT * FROM b_expenses WHERE id=?', expenseId).first<Data>();
  insist(e, 'Expense not found', 404);
  await readableJob(db, actor, e.job_id);
  return e;
}

/** A reviewer or the principal approves or rejects; nobody but the principal approves their own expense. */
export async function decideExpense(db: D1Database, actor: Actor, expenseId: string, body: Data) {
  human(actor); need(actor, 'owner', 'reviewer');
  const e = await visibleExpense(db, actor, expenseId);
  insist(e.status === 'pending', 'This expense was already decided', 409);
  insist(e.person_email !== actor.email || actor.role === 'owner', 'Another person approves your expense', 403);
  insist(body.decision === 'approve' || body.decision === 'reject', 'Choose approve or reject');
  const status = body.decision === 'approve' ? 'approved' : 'rejected', reason = status === 'rejected' ? text(body.reason, 'Reason for rejecting', 500) : '';
  await atomic(db, actor, [
    stmt(db, "UPDATE b_expenses SET status=?,reason=?,decided_by=?,decided_at=? WHERE id=? AND status='pending'", status, reason, actor.email, now(), e.id),
    audit(db, actor, `expense.${status}`, e.id, reason)]);
  return { id: e.id, status, reason };
}

/** The principal records paying a staff member back for an approved expense they paid. */
export async function reimburseExpense(db: D1Database, actor: Actor, expenseId: string) {
  human(actor); need(actor, 'owner');
  const e = await visibleExpense(db, actor, expenseId);
  insist(e.paid_by === 'staff' && e.status === 'approved', 'Only an approved expense a staff member paid is reimbursed', 409);
  insist(!e.reimbursed_at, 'This expense was already reimbursed', 409);
  await atomic(db, actor, [
    stmt(db, 'UPDATE b_expenses SET reimbursed_by=?,reimbursed_at=? WHERE id=? AND reimbursed_at IS NULL', actor.email, now(), e.id),
    audit(db, actor, 'expense.reimbursed', e.id, `${e.cost_cents} cents to ${e.person_email}`)]);
  return { id: e.id, reimbursed: true };
}

export async function downloadReceipt(db: D1Database, actor: Actor, expenseId: string) {
  const e = await visibleExpense(db, actor, expenseId);
  insist(e.receipt_base64, 'This expense has no receipt', 404);
  return fileResponse({ name: e.receipt_name, mime: e.receipt_mime, content_base64: e.receipt_base64 });
}

const listed = 'id,job_id,currency,kind,date,description,mile_tenths,cents_per_mile,cost_cents,billable,markup_percent,charge_cents,paid_by,person_email,receipt_name,receipt_size,receipt_sha256,status,decided_by,decided_at,reason,reimbursed_by,reimbursed_at,created_at';

/**
 * A job's expenses and its margin before staff cost: the fixed fee, approved
 * billable time and its adjustments and approved billable expense charges, less the cost of
 * every approved expense, billable or not.
 */
export async function jobExpenses(db: D1Database, j: Data) {
  const expenses = await rows(db, `SELECT ${listed},(SELECT export_id FROM b_export_sources WHERE source_key='exp:'||b_expenses.id) export_id FROM b_expenses WHERE job_id=? ORDER BY date,created_at`, j.id);
  const sums = await stmt(db, `SELECT
      (SELECT COALESCE(SUM(t.amount_cents),0) FROM b_time t JOIN b_time_status s ON s.entry_id=t.id AND s.status='approved' WHERE t.job_id=? AND t.billable=1) time_cents,
      (SELECT COALESCE(SUM(a.amount_cents),0) FROM b_time_adjustments a JOIN b_time t ON t.id=a.entry_id WHERE t.job_id=? AND t.billable=1) adjustment_cents`, j.id, j.id).first<Data>();
  const approved = expenses.filter(e => e.status === 'approved');
  const sum = (list: Data[], key: string) => list.reduce((total, e) => total + Number(e[key]), 0);
  const billableCharges = sum(approved.filter(e => e.billable), 'charge_cents'), expenseCost = sum(approved, 'cost_cents');
  const value = Number(j.fee_cents) + Number(sums!.time_cents) + Number(sums!.adjustment_cents) + billableCharges;
  return {
    expenses,
    profitability: {
      currency: j.currency,
      feeCents: Number(j.fee_cents), timeCents: Number(sums!.time_cents) + Number(sums!.adjustment_cents), billableExpenseCents: billableCharges,
      expenseCostCents: expenseCost, nonBillableExpenseCents: sum(approved.filter(e => !e.billable), 'cost_cents'),
      billableValueCents: value, marginCents: value - expenseCost,
    },
  };
}

/** Staff reimbursements owed and paid, kept apart from client charges. */
export async function reimbursements(db: D1Database) {
  return rows(db, `SELECT e.id,e.currency,e.person_email,e.kind,e.date,e.description,e.cost_cents,e.reimbursed_by,e.reimbursed_at,j.title job,j.period_label period,c.name client
    FROM b_expenses e JOIN b_jobs j ON j.id=e.job_id JOIN b_clients c ON c.id=e.client_id
    WHERE e.paid_by='staff' AND e.status='approved' ORDER BY e.reimbursed_at IS NOT NULL,e.person_email,e.date`);
}
export const mileageRates = (db: D1Database) => rows(db, 'SELECT * FROM b_mileage_rates ORDER BY effective_from DESC');
