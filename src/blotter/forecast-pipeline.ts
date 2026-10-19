// Open-prospect workload is an explicit, unweighted assumption, never signed work.
import { addMonths } from './jobs';
import { shift } from './capacity';
import { budgetEstimate } from './forecast-estimate';
import { date, insist, rows, stmt, text, type Data } from './model';

export async function pipelineChoices(db: D1Database, value: unknown): Promise<Data[]> {
  insist(value === undefined || (Array.isArray(value) && value.length <= 1000), 'Pipeline assumptions: supply up to 1000 service choices');
  const choices: Data[] = [];
  for (const raw of (value ?? []) as Data[]) {
    const prospectId = text(raw.prospectId, 'Prospect'), service = text(raw.service, 'Requested service', 120), workTypeId = raw.workTypeId ? text(raw.workTypeId, 'Work type') : '';
    const prospect = await stmt(db, 'SELECT services FROM b_prospects WHERE id=?', prospectId).first<Data>();
    insist(prospect && JSON.parse(prospect.services).includes(service), 'Prospect or requested service changed; reload the pipeline', 409);
    if (workTypeId) insist(await stmt(db, 'SELECT 1 FROM b_work_types WHERE id=?', workTypeId).first(), 'Work type not found', 404);
    insist(!choices.some(c => c.prospectId === prospectId && c.service === service), 'Choose each prospect service only once');
    choices.push({ prospectId, service, workTypeId, firstDueDate: date(raw.firstDueDate, 'First assumed work target') });
  }
  return choices;
}
export async function forecastPipeline(db: D1Database, prospects: Data[], from: string, to: string, choices: Data[]) {
  const types = await rows(db, `SELECT w.id,w.name,w.budget_minutes,t.steps,t.recurrence,t.name template_name FROM b_work_types w LEFT JOIN b_templates t ON t.id=w.template_id ORDER BY w.name`);
  const summaries: Data[] = [], demand: Data[] = [];
  for (const p of prospects.filter(p => p.stage_kind === 'open')) for (const [index, service] of (p.services as string[]).entries()) {
    const choice = choices.find(c => c.prospectId === p.id && c.service === service);
    const type = choice ? types.find(t => t.id === choice.workTypeId) : types.find(t => t.name.toLowerCase() === service.toLowerCase());
    const estimate = budgetEstimate(null, type?.budget_minutes, type?.steps ?? null), firstDueDate = choice?.firstDueDate ?? from;
    const basis = type ? estimate.basis : 'no matching work type; choose a work type to estimate';
    const summary = { prospectId: p.id, prospect: p.name, service, stageId: p.stage_id, stage: p.stage, source: p.source, ownerEmail: p.owner_email,
      estimatedAnnualFeeCents: p.created_by === 'website' && !p.fee_cents ? null : Number(p.fee_cents), currency: p.currency, feeBasis: 'estimated annual fee for the whole prospect; never converted to hours',
      workTypeId: type?.id ?? null, workType: type?.name ?? service, template: type?.template_name ?? null, recurrence: type?.recurrence ?? null,
      status: estimate.point ? 'estimated assumption' : 'unestimated', minutes: estimate.point || null, ...estimate, basis, firstDueDate,
      assumption: `Open prospect at ${p.stage}; assumed won without probability weighting. First work target ${firstDueDate}; ${type?.recurrence ? type.recurrence + ' cadence' : 'one engagement'} through the forecast. No assignment or promised deadline is created.` };
    summaries.push(summary);
    const months = ({ monthly: 1, quarterly: 3, annual: 12 } as Record<string, number>)[type?.recurrence];
    const elapsedMonths = (Number(from.slice(0, 4)) - Number(firstDueDate.slice(0, 4))) * 12 + Number(from.slice(5, 7)) - Number(firstDueDate.slice(5, 7));
    for (let n = months ? Math.max(0, Math.floor(elapsedMonths / months) - 1) : 0; ; n++) {
      if (n && !months) break;
      const due = n ? addMonths(firstDueDate, n * months) : firstDueDate;
      if (due > to) break;
      if (due < from) continue;
      const weekStart = shift(due, -((new Date(due + 'T00:00:00Z').getUTCDay() + 6) % 7));
      demand.push({ ...summary, kind: 'pipeline', ruleId: `prospect:${p.id}:${index}`, clientId: '', client: p.name, skill: summary.workType.toLowerCase(), periodStart: due, periodLabel: `Pipeline · ${p.stage}`,
        due, weekStart, samples: [], seasonal: false, basis: `${basis}; ${summary.assumption}`, reason: `${p.name} (${p.stage}) is an open-prospect assumption without client actuals${estimate.point ? '' : '; no budget or estimate for ' + service}` });
    }
  }
  return { summaries, lines: demand };
}
