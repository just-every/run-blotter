// CAPACITY-012's common estimate chain for work without client actuals.
import { type Data } from './model';
export function budgetEstimate(ruleBudget: unknown, typeBudget: unknown, steps: string | Data[] | null) {
  const tasks = typeof steps === 'string' ? JSON.parse(steps) as Data[] : steps ?? [];
  const total = tasks.reduce((n, task) => n + Number(task?.estimateMinutes ?? 0), 0);
  const [basis, minutes] = ruleBudget ? ['rule time budget', Number(ruleBudget)] : typeBudget ? ['work type budget', Number(typeBudget)] : total ? ['template task estimates', total] : ['no estimate', 0];
  return { basis: String(basis), point: Number(minutes), low: Math.round(Number(minutes) / 2), high: Math.round(Number(minutes) * 3 / 2) };
}
