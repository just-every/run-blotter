// Prospects and the onboarding pipeline (CRM-005, first slice). The principal
// and reviewers track prospects through the firm's ordered stages with lead
// source, requested services, estimated annual fees and owner. Moving to a
// lost stage needs a reason. Winning converts the prospect into exactly one
// client with its contact and starts its onboarding job from a template in the
// same batch; repeating the win returns that client and creates nothing. The
// pipeline report counts conversion, stage age and fees by source and owner.
import { currency } from './currency';
import { createStatements, eligible } from './jobs';
import { fieldDefs, profileFields } from './profiles';
import { atomic, audit, date, email, guard, human, id, insist, integer, need, now, optional, rows, stmt, text, type Actor, type Data } from './model';

const DAY = 86_400_000;
const lead = (actor: Actor) => need(actor, 'owner', 'reviewer');
const BUILT_IN = [
  { id: 'ps-inquiry', name: 'Inquiry', position: 10, kind: 'open' }, { id: 'ps-consult', name: 'Consult booked', position: 20, kind: 'open' },
  { id: 'ps-proposal', name: 'Proposal sent', position: 30, kind: 'open' }, { id: 'ps-won', name: 'Won', position: 900, kind: 'won' }, { id: 'ps-lost', name: 'Lost', position: 1000, kind: 'lost' },
];
/** The built-in stages and the firm's added open stages, in position order. */
async function stages(db: D1Database): Promise<Data[]> {
  return [...BUILT_IN, ...await rows(db, 'SELECT id,name,position,kind FROM b_prospect_stages')].sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));
}
const days = (from: string, to: string) => Math.floor((Date.parse(to) - Date.parse(from)) / DAY);

async function prospectRow(db: D1Database, prospectId: string) {
  const p = await stmt(db, 'SELECT * FROM b_prospects WHERE id=?', prospectId).first<Data>();
  insist(p, 'Prospect not found', 404);
  const stage = (await stages(db)).find(s => s.id === p.stage_id)!;
  return { ...p, stage: stage.name, stage_kind: stage.kind } as Data;
}
const event = (db: D1Database, prospectId: string, from: string | null, to: string, note: string, by: string, at: string) =>
  stmt(db, 'INSERT INTO b_prospect_events(id,prospect_id,from_stage,to_stage,note,by_email,at) VALUES(?,?,?,?,?,?,?)', id(), prospectId, from, to, note, by, at);

/** The principal adds an open stage at a position. */
export async function addStage(db: D1Database, actor: Actor, body: Data) {
  human(actor); need(actor, 'owner');
  const name = text(body.name, 'Stage name', 60), position = integer(body.position, 'Position', 1, 899), stageId = id();
  insist(!(await stages(db)).some(s => s.name.toLowerCase() === name.toLowerCase()), `${name} already exists`, 409);
  await atomic(db, actor, [stmt(db, "INSERT INTO b_prospect_stages(id,name,position,kind,created_by,created_at) VALUES(?,?,?,'open',?,?)", stageId, name, position, actor.email, now()), audit(db, actor, 'pipeline.stage_added', stageId, name)]);
  return { id: stageId, name, position, kind: 'open' };
}

/** A person records a prospect in the first open stage (or a chosen open stage). */
export async function addProspect(db: D1Database, actor: Actor, body: Data) {
  human(actor); lead(actor);
  const owner = email(body.ownerEmail, 'Owner');
  insist(await eligible(db, owner, ['preparer', 'reviewer']), `${owner} is not an active practice member`);
  insist(Array.isArray(body.services) && body.services.length > 0 && body.services.length <= 20, 'Requested services: list between 1 and 20');
  const services = [...new Set((body.services as unknown[]).map((s, n) => text(s, `Service ${n + 1}`, 120)))];
  const wanted = body.stageId ? text(body.stageId, 'Stage') : '', stage = (await stages(db)).find(s => s.kind === 'open' && (!wanted || s.id === wanted));
  insist(stage, 'Choose an open stage', 404);
  const at = now(), prospect = {
    id: id(), name: text(body.name, 'Prospect name', 200), contactName: text(body.contactName, 'Contact name', 200), contactEmail: email(body.contactEmail, 'Contact email'),
    source: text(body.source, 'Lead source', 120), fee: integer(body.estimatedFeeCents, 'Estimated annual fees in cents', 0, 100_000_000),
  };
  await atomic(db, actor, [
    stmt(db, 'INSERT INTO b_prospects(id,name,contact_name,contact_email,source,services,fee_cents,owner_email,stage_id,stage_since,created_by,created_at,currency) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)',
      prospect.id, prospect.name, prospect.contactName, prospect.contactEmail, prospect.source, JSON.stringify(services), prospect.fee, owner, stage.id, at, actor.email, at, currency(body.currency)),
    event(db, prospect.id, null, stage.id, 'Added', actor.email, at), audit(db, actor, 'prospect.added', prospect.id, `${prospect.name} from ${prospect.source}`)]);
  return prospectRow(db, prospect.id);
}

/** Moves a prospect to an open or lost stage; lost needs a reason. Winning goes through `winProspect`. */
export async function moveProspect(db: D1Database, actor: Actor, prospectId: string, body: Data) {
  human(actor); lead(actor);
  const p = await prospectRow(db, prospectId);
  insist(p.stage_kind !== 'won', 'A won prospect is a client now', 409);
  const wanted = text(body.stageId, 'Stage'), stage = (await stages(db)).find(s => s.id === wanted);
  insist(stage, 'Stage not found', 404);
  insist(stage.kind !== 'won', 'Use Win to convert the prospect into a client', 409);
  insist(stage.id !== p.stage_id, `Already in ${stage.name}`, 409);
  const reason = stage.kind === 'lost' ? text(body.reason, 'Why it was lost', 500) : null, at = now();
  await atomic(db, actor, [

    stmt(db, 'UPDATE b_prospects SET stage_id=?,stage_since=?,lost_reason=? WHERE id=? AND stage_id=?', stage.id, at, reason, p.id, p.stage_id),
    event(db, p.id, p.stage_id, stage.id, reason ?? optional(body.note, 'Note', 500), actor.email, at), audit(db, actor, 'prospect.moved', p.id, `${p.stage} → ${stage.name}${reason ? `: ${reason}` : ''}`)]);
  return prospectRow(db, p.id);
}

/**
 * Winning converts the prospect into exactly one client with its contact and starts the onboarding job from the
 * chosen template, in one batch. A repeated win (the same acceptance arriving again) returns that client unchanged.
 */
export async function winProspect(db: D1Database, actor: Actor, prospectId: string, body: Data) {
  human(actor); lead(actor);
  const p = await prospectRow(db, prospectId);
  if (p.client_id) return { repeated: true, clientId: p.client_id, jobId: p.onboarding_job_id, prospect: p };
  insist(p.stage_kind === 'open', 'Reopen a lost prospect before winning it', 409);
  const template = await stmt(db, 'SELECT * FROM b_templates WHERE id=?', text(body.templateId, 'Onboarding template')).first<Data>();
  insist(template, 'Template not found', 404);
  const type = await stmt(db, 'SELECT roles FROM b_work_types WHERE id=?', 'wt-' + template.id).first<Data>();
  insist(!JSON.parse(type?.roles ?? '[]').length, 'Choose an onboarding template whose work needs only a preparer and reviewer');
  const preparer = email(body.preparerEmail, 'Preparer'), reviewer = email(body.reviewerEmail, 'Reviewer');
  insist(await eligible(db, preparer, ['preparer', 'reviewer']), `${preparer} cannot prepare work`);
  insist(await eligible(db, reviewer, ['reviewer']) && reviewer !== preparer, 'The reviewer must be an active reviewer other than the preparer');
  const clientId = id(), jobId = id(), at = now(), won = (await stages(db)).find(s => s.kind === 'won');
  const fields = profileFields(await fieldDefs(db), body.fields);
  const [check, release] = guard(db, 'EXISTS(SELECT 1 FROM b_prospects WHERE id=? AND client_id IS NULL AND stage_id=?)', p.id, p.stage_id);
  await atomic(db, actor, [check,
    stmt(db, "INSERT INTO b_clients(id,name,abn,contact_name,contact_email,source,revision,created_at,fields,tags) VALUES(?,?,'',?,?,'native',?,?,?,'[]')", clientId, p.name, p.contact_name, p.contact_email, id(), at, JSON.stringify(fields)),
    audit(db, actor, 'client.added', clientId, `${p.name} (won prospect)`),
    ...createStatements(db, actor, template, { id: jobId, clientId, periodStart: date(body.periodStart, 'Onboarding period start'), dueDate: date(body.dueDate, 'Onboarding due date'),
      dueNote: text(body.dueNote, 'Where the onboarding due date comes from', 300), preparer, reviewer }),

    stmt(db, 'UPDATE b_prospects SET stage_id=?,stage_since=?,lost_reason=NULL,client_id=?,onboarding_job_id=? WHERE id=?', won!.id, at, clientId, jobId, p.id),
    event(db, p.id, p.stage_id, won!.id, 'Won', actor.email, at), audit(db, actor, 'prospect.won', p.id, `${p.name} became a client`), release]);
  return { repeated: false, clientId, jobId, prospect: await prospectRow(db, p.id) };
}

/** Prospects with their stage age, the stages, and the pipeline report as of today (UTC days, rounded down). */
export async function pipeline(db: D1Database, actor: Actor) {
  lead(actor);
  const [all, prospects] = await Promise.all([stages(db), rows(db, 'SELECT * FROM b_prospects ORDER BY stage_since')]);
  const order = new Map(all.map((s, n) => [s.id, n])), today = now();
  const list: Data[] = prospects.map(p => { const s = all.find(x => x.id === p.stage_id)!; return { ...p, stage: s.name, stage_kind: s.kind, services: JSON.parse(p.services), answers: JSON.parse(p.answers), stageAgeDays: days(p.stage_since, today) } as Data; })
    .sort((a, b) => order.get(a.stage_id)! - order.get(b.stage_id)!);
  const group = (key: 'source' | 'owner_email') => [...new Set(list.map(p => JSON.stringify([p[key], p.currency])))].sort().map(pair => {
    const [value, currency] = JSON.parse(pair);
    const mine = list.filter(p => p[key] === value && p.currency === currency), count = (kind: string) => mine.filter(p => p.stage_kind === kind);
    const won = count('won'), lost = count('lost'), open = count('open'), fees = (l: Data[]) => l.reduce((n, p) => n + Number(p.fee_cents), 0);
    return { [key === 'source' ? 'source' : 'owner']: value, currency, prospects: mine.length, open: open.length, won: won.length, lost: lost.length,
      conversionPercent: won.length + lost.length ? Math.round(won.length * 100 / (won.length + lost.length)) : null, openFeeCents: fees(open), wonFeeCents: fees(won), lostFeeCents: fees(lost) };
  });
  return {
    stages: all, prospects: list,
    report: {
      bySource: group('source'), byOwner: group('owner_email'),
      stageAge: all.filter(s => s.kind === 'open').map(s => { const here = list.filter(p => p.stage_id === s.id); return { stage: s.name, open: here.length, averageDays: here.length ? Math.floor(here.reduce((n, p) => n + p.stageAgeDays, 0) / here.length) : null, oldestDays: here.length ? Math.max(...here.map(p => p.stageAgeDays)) : null }; }),
    },
  };
}
