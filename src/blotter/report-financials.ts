import type { Data } from './model';

const amounts = ['approvedTimeCents', 'fixedFeeCents', 'expenseChargeCents', 'expenseCostCents', 'marginBeforeStaffCostCents', 'unbilledCents', 'approvedExportCents'] as const;
type FinancialGroup = {
  id: string | null;
  name: string | null;
  currency: string;
  jobIds: string[];
} & Record<(typeof amounts)[number], number>;

/** Group the report's existing native financial projection; source detail stays on jobs. */
export function financialBreakdowns(jobs: Data[]) {
  const clients = new Map<string, FinancialGroup>(), services = new Map<string, FinancialGroup>();
  const add = (groups: Map<string, FinancialGroup>, id: string | null, name: string | null, job: Data) => {
    const financial = job.financial, key = JSON.stringify([id, financial.currency]);
    let group = groups.get(key);
    if (!group) {
      group = { id, name, currency: financial.currency, jobIds: [], approvedTimeCents: 0, fixedFeeCents: 0,
        expenseChargeCents: 0, expenseCostCents: 0, marginBeforeStaffCostCents: 0, unbilledCents: 0, approvedExportCents: 0 };
      groups.set(key, group);
    }
    group.jobIds.push(job.id);
    for (const field of amounts) group[field] += financial[field];
  };
  for (const job of jobs) {
    add(clients, job.client_id, job.client_name, job);
    add(services, job.work_type_id ?? null, job.work_type ?? null, job);
  }
  const ordered = (groups: Map<string, FinancialGroup>) => [...groups.values()].sort((a, b) =>
    (a.name ?? '').localeCompare(b.name ?? '') || (a.id ?? '').localeCompare(b.id ?? '') || a.currency.localeCompare(b.currency));
  for (const group of [...clients.values(), ...services.values()]) group.jobIds.sort();
  return { clients: ordered(clients), services: ordered(services) };
}
