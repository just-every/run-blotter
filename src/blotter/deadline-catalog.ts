// The maintained deadline catalog (DUE-001, DUE-003), release 2026.1. Each
// rule names its agency source; a firm approves a rule before any client uses
// it, and later source revisions are imported and approved through
// deadlines.ts. Dates follow the published instructions as of 1 January 2026.
import type { DueSpec } from './deadline-calendar';

export type Entity = 'individual' | 'business' | 'trust';
export type Frequency = 'monthly' | 'quarterly' | 'annual';
export type Rule = {
  key: string; form: string; title: string; jurisdiction: string; entities: Entity[]; frequency: Frequency; due: DueSpec;
  extension?: { form: string; due: DueSpec; automatic: boolean };
  /** Fiscal years ending in `endMonth` and starting before `startsBefore` use these dates instead. */
  fiscal?: { endMonth: number; startsBefore: string; due: DueSpec; extension: DueSpec }[];
  /** Filed for the calendar year whatever the client's fiscal year. */
  calendarYear?: true;
  source: { url: string; title: string }; version: string; effective: string;
};

const IRS = (title: string, url: string) => ({ url, title: `IRS: ${title}` });
const r = (rule: Omit<Rule, 'version' | 'effective'>): Rule => ({ ...rule, version: '2026.1', effective: '2026-01-01' });
const after = (months: number, day: number | 'last'): DueSpec => ({ type: 'after-period-end', months, day });

export const CATALOG: Rule[] = [
  // DUE-001's five obligation types.
  r({ key: 'us-1040', form: '1040', title: 'U.S. individual income tax return', jurisdiction: 'US', entities: ['individual'], frequency: 'annual', due: after(4, 15),
    extension: { form: '4868', due: after(10, 15), automatic: false }, source: IRS('Publication 509, Tax Calendars', 'https://www.irs.gov/publications/p509') }),
  r({ key: 'us-1120s', form: '1120-S', title: 'U.S. income tax return for an S corporation', jurisdiction: 'US', entities: ['business'], frequency: 'annual', due: after(3, 15),
    extension: { form: '7004', due: after(9, 15), automatic: false }, source: IRS('Instructions for Form 1120-S', 'https://www.irs.gov/instructions/i1120s') }),
  r({ key: 'us-1065', form: '1065', title: 'U.S. return of partnership income', jurisdiction: 'US', entities: ['business'], frequency: 'annual', due: after(3, 15),
    extension: { form: '7004', due: after(9, 15), automatic: false }, source: IRS('Instructions for Form 1065', 'https://www.irs.gov/instructions/i1065') }),
  r({ key: 'us-941', calendarYear: true, form: '941', title: "Employer's quarterly federal tax return", jurisdiction: 'US', entities: ['business', 'individual', 'trust'], frequency: 'quarterly', due: after(1, 'last'),
    source: IRS('Instructions for Form 941', 'https://www.irs.gov/instructions/i941') }),
  r({ key: 'ca-sales', calendarYear: true, form: 'CDTFA-401', title: 'California sales and use tax return', jurisdiction: 'CA', entities: ['business', 'individual'], frequency: 'quarterly', due: after(1, 'last'),
    source: { url: 'https://www.cdtfa.ca.gov/taxes-and-fees/sutprograms.htm', title: 'CDTFA: Sales and use tax filing due dates' } }),
  r({ key: 'tx-sales', calendarYear: true, form: '01-114', title: 'Texas sales and use tax return', jurisdiction: 'TX', entities: ['business', 'individual'], frequency: 'monthly', due: after(1, 20),
    source: { url: 'https://comptroller.texas.gov/taxes/sales/', title: 'Texas Comptroller: Sales and use tax due dates' } }),
  // DUE-003's wider catalog.
  r({ key: 'us-1120', form: '1120', title: 'U.S. corporation income tax return', jurisdiction: 'US', entities: ['business'], frequency: 'annual', due: after(4, 15),
    extension: { form: '7004', due: after(10, 15), automatic: false },
    fiscal: [{ endMonth: 6, startsBefore: '2026-01-01', due: after(3, 15), extension: after(10, 15) }], source: IRS('Instructions for Form 1120', 'https://www.irs.gov/instructions/i1120') }),
  r({ key: 'us-1041', form: '1041', title: 'U.S. income tax return for estates and trusts', jurisdiction: 'US', entities: ['trust'], frequency: 'annual', due: after(4, 15),
    extension: { form: '7004', due: after(9, 'last'), automatic: false }, source: IRS('Instructions for Form 1041', 'https://www.irs.gov/instructions/i1041') }),
  r({ key: 'us-990', form: '990 series', title: 'Return of organization exempt from income tax (990, 990-EZ, 990-PF)', jurisdiction: 'US', entities: ['business', 'trust'], frequency: 'annual', due: after(5, 15),
    extension: { form: '8868', due: after(11, 15), automatic: false }, source: IRS('Instructions for Form 990', 'https://www.irs.gov/instructions/i990') }),
  r({ key: 'us-940', calendarYear: true, form: '940', title: "Employer's annual federal unemployment (FUTA) tax return", jurisdiction: 'US', entities: ['business', 'individual', 'trust'], frequency: 'annual', due: after(1, 'last'),
    source: IRS('Instructions for Form 940', 'https://www.irs.gov/instructions/i940') }),
  r({ key: 'us-w2', calendarYear: true, form: 'W-2/W-3', title: 'Wage statements to employees and the SSA', jurisdiction: 'US', entities: ['business', 'individual', 'trust'], frequency: 'annual', due: after(1, 'last'),
    source: IRS('General Instructions for Forms W-2 and W-3', 'https://www.irs.gov/instructions/iw2w3') }),
  r({ key: 'us-1099nec', calendarYear: true, form: '1099-NEC', title: 'Nonemployee compensation, to recipients and the IRS', jurisdiction: 'US', entities: ['business', 'individual', 'trust'], frequency: 'annual', due: after(1, 'last'),
    source: IRS('Instructions for Forms 1099-MISC and 1099-NEC', 'https://www.irs.gov/instructions/i1099mec') }),
  r({ key: 'us-1099misc', calendarYear: true, form: '1099-MISC', title: 'Miscellaneous information, filed electronically with the IRS', jurisdiction: 'US', entities: ['business', 'individual', 'trust'], frequency: 'annual', due: after(3, 'last'),
    source: IRS('Instructions for Forms 1099-MISC and 1099-NEC', 'https://www.irs.gov/instructions/i1099mec') }),
  r({ key: 'us-1040es', form: '1040-ES', title: 'Estimated tax for individuals (four installments)', jurisdiction: 'US', entities: ['individual'], frequency: 'quarterly', due: { type: 'installments', offsets: [3, 5, 8, 12], day: 15 },
    source: IRS('Form 1040-ES, Estimated Tax for Individuals', 'https://www.irs.gov/forms-pubs/about-form-1040-es') }),
  r({ key: 'us-1120w', form: '1120-W', title: 'Estimated tax for corporations (four installments)', jurisdiction: 'US', entities: ['business'], frequency: 'quarterly', due: { type: 'installments', offsets: [3, 5, 8, 11], day: 15 },
    source: IRS('Instructions for Form 1120-W', 'https://www.irs.gov/instructions/i1120w') }),
  r({ key: 'us-fbar', calendarYear: true, form: 'FinCEN 114', title: 'Report of foreign bank and financial accounts (FBAR)', jurisdiction: 'US', entities: ['individual', 'business', 'trust'], frequency: 'annual', due: after(4, 15),
    extension: { form: 'none required', due: after(10, 15), automatic: true }, source: { url: 'https://www.fincen.gov/report-foreign-bank-and-financial-accounts', title: 'FinCEN: Report Foreign Bank and Financial Accounts' } }),
  r({ key: 'ca-de9', calendarYear: true, form: 'DE 9', title: 'California quarterly contribution return and report of wages (withholding and unemployment)', jurisdiction: 'CA', entities: ['business', 'individual', 'trust'], frequency: 'quarterly', due: after(1, 'last'),
    source: { url: 'https://edd.ca.gov/en/payroll_taxes/due_dates_calendar/', title: 'California EDD: Payroll tax due dates' } }),
  r({ key: 'tx-c3', calendarYear: true, form: 'C-3', title: "Texas employer's quarterly unemployment tax report", jurisdiction: 'TX', entities: ['business', 'individual', 'trust'], frequency: 'quarterly', due: after(1, 'last'),
    source: { url: 'https://www.twc.texas.gov/businesses/unemployment-tax', title: 'Texas Workforce Commission: Unemployment tax' } }),
  r({ key: 'tx-franchise', calendarYear: true, form: '05-158', title: 'Texas franchise tax annual report', jurisdiction: 'TX', entities: ['business'], frequency: 'annual', due: after(5, 15),
    extension: { form: '05-164', due: after(8, 15), automatic: false }, source: { url: 'https://comptroller.texas.gov/taxes/franchise/', title: 'Texas Comptroller: Franchise tax due dates' } }),
  r({ key: 'de-annual-report', calendarYear: true, form: 'Annual Franchise Tax Report', title: 'Delaware corporation annual report and franchise tax', jurisdiction: 'DE', entities: ['business'], frequency: 'annual', due: after(3, 1),
    source: { url: 'https://corp.delaware.gov/paytaxes/', title: 'Delaware Division of Corporations: Annual report and taxes' } }),
];
