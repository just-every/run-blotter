// The sample US practice: Cardinal Tax & Books, reviewer Riley Tan,
// recurring client engagements and their document requests.
// Every name, email and EIN is invented; email domains are .example.
import { ein } from '../clients';
import { email, lines } from '../model';
import { fixedId } from './ids';

export const principal = { name: 'Jordan Morgan', rateCents: 18000 };

export const team = [
  { email: 'riley@morganco.example', name: 'Riley Tan', role: 'reviewer', rateCents: 14500 },
  { email: 'priya@morganco.example', name: 'Priya Shah', role: 'reviewer', rateCents: 13500 },
  { email: 'sam@morganco.example', name: 'Sam Okafor', role: 'preparer', rateCents: 9500 },
  { email: 'ellie@morganco.example', name: 'Ellie Brooks', role: 'preparer', rateCents: 9000 },
  { email: 'hana@morganco.example', name: 'Hana Sato', role: 'preparer', rateCents: 8500 },
].map(m => ({ ...m, email: email(m.email), id: fixedId('operator:' + m.email) }));

export type Recurrence = 'monthly' | 'quarterly' | 'annual';
export type Template = { id: string; key: string; name: string; recurrence: Recurrence; steps: string[]; requests: string[]; feeCents: number };
const template = (key: string, name: string, recurrence: Recurrence, feeCents: number, steps: string, requests: string): Template =>
  ({ id: fixedId('template:' + key), key, name, recurrence, feeCents, steps: lines(steps, 'Checklist steps'), requests: lines(requests, 'Client document requests') });

export const templates = {
  salesTax: template('salesTax', 'Quarterly sales-tax return', 'quarterly', 33000,
    'Reconcile bank accounts\nReview taxable sales and exemption certificates\nReconcile state sales tax collected\nPrepare state sales-tax workpapers\nClient approves the sales-tax return',
    'Bank statements for the quarter\nSales invoices and receipts\nPurchase receipts and bills'),
  close: template('close', 'Month-end bookkeeping', 'monthly', 45000,
    'Import bank feeds\nReconcile bank and cards\nProcess supplier bills\nAccruals and prepayments\nMonth-end report to the client',
    'Bank and card statements\nSupplier bills not in the inbox'),
  payroll: template('payroll', 'Payroll compliance and W-2 review', 'monthly', 18000,
    'Timesheets and leave approved\nReconcile payroll provider reports\nReview federal and state payroll filings\nReview W-2 and 1099 information',
    'Approved timesheets and leave requests'),
  company: template('company', 'Federal and state business tax return', 'annual', 220000,
    'Year-end adjustments\nDepreciation schedule\nFinancial statements drafted\nTax return prepared\nPrincipal reviews the return\nClient signs the declaration',
    'Year-end bank and loan statements\nAsset purchases and sales\nInventory at December 31'),
  individual: template('individual', 'Form 1040 individual tax return', 'annual', 38000,
    'Collect W-2 and 1099 forms\nIncome and deductions entered\nReturn prepared\nClient signs the declaration',
    'W-2, 1099 and interest statements\nDeduction receipts\nEstimated tax payment records'),
};

export type Client = { id: string; name: string; abn: string; contactName: string; contactEmail: string };
const client = (name: string, einDigits: string, contactName: string, contactEmail: string): Client =>
  ({ id: fixedId('client:' + name), name, abn: ein(einDigits), contactName, contactEmail: contactEmail ? email(contactEmail) : '' });

export const clients = {
  harbour: client('Chen Family Cafe LLC', '100000001', 'Mia Chen', 'mia@chencafe.example'),
  ridgeline: client('Ridgeline Plumbing', '', 'Tom Ridge', 'accounts@ridgeline.example'),
  wattle: client('Garcia Design Studio', '100000002', 'Ana Garcia', 'ana@garciadesign.example'),
  saltwater: client('Saltwater Physio LLC', '100000003', "Grace O'Neill", 'grace@saltwaterphysio.example'),
  kestrel: client('Kestrel Joinery LLC', '100000004', 'Dean Kowalski', 'office@kestreljoinery.example'),
  bluegum: client('Nguyen Childcare Center', '100000005', 'Linh Nguyen', 'linh@nguyencare.example'),
  northside: client('Northside Florist', '100000006', 'Rosa Mendes', 'rosa@northsideflorist.example'),
  cobalt: client('Cobalt Electrical Services', '100000007', 'Aaron Fitzgerald', 'admin@cobaltelectrical.example'),
  figtree: client('Fig Tree Dental LLC', '100000008', 'Nina Patel', 'practice@figtreedental.example'),
  marlowe: client('Marlowe Architects', '100000009', 'Ben Marlowe', 'ben@marlowearch.example'),
  tworivers: client('Two Rivers Brewing Co', '100000010', 'Callum Reid', 'accounts@tworiversbrewing.example'),
  ironbark: client('Oak City Landscaping', '100000011', 'Jesse Williams', 'jesse@oakcitylandscaping.example'),
  lumen: client('Lumen Yoga Studio', '100000012', 'Sophie Laurent', 'hello@lumenyoga.example'),
  coastal: client('Coastal Mobile Mechanics', '100000013', 'Ravi Kumar', 'ravi@coastalmechanics.example'),
  greenway: client('Greenway Organics LLC', '100000014', 'Hamish Doyle', 'finance@greenwayorganics.example'),
  oldmill: client('Old Mill Antiques', '', 'Margaret Ellis', ''),
};

// Who prepares and reviews each recurring engagement ('owner' is the principal).
type Who = 'owner' | (typeof team)[number]['email'];
export type Engagement = { client: Client; template: Template; preparer: Who; reviewer: Who; dueNote: string };
const riley = 'riley@morganco.example', priya = 'priya@morganco.example', sam = 'sam@morganco.example', ellie = 'ellie@morganco.example', hana = 'hana@morganco.example';
const program = 'Principal recorded the engagement deadline after checking the state account', standard = 'Client engagement target recorded by the principal';
const e = (c: Client, t: Template, preparer: Who, reviewer: Who, dueNote: string): Engagement => ({ client: c, template: t, preparer, reviewer, dueNote });
const { salesTax, close, payroll, company, individual } = templates, c = clients;

export const engagements: Engagement[] = [
  e(c.harbour, salesTax, sam, riley, standard), e(c.harbour, close, sam, riley, 'Owner wants the month-end report by the 12th'), e(c.harbour, payroll, hana, priya, 'Monthly pay day'),
  e(c.ridgeline, salesTax, ellie, riley, program), e(c.ridgeline, close, ellie, priya, 'Month-end report by the 12th'),
  e(c.wattle, salesTax, hana, priya, standard), e(c.wattle, individual, hana, 'owner', 'Principal recorded the annual return target'),
  e(c.saltwater, salesTax, sam, 'owner', program), e(c.saltwater, payroll, hana, priya, 'Monthly pay day'), e(c.saltwater, company, priya, 'owner', 'Principal recorded the business return target'),
  e(c.kestrel, salesTax, ellie, riley, standard), e(c.kestrel, close, ellie, riley, 'Bank covenant report by the 12th'), e(c.kestrel, company, riley, 'owner', 'Principal recorded the business return target'),
  e(c.bluegum, salesTax, sam, priya, program), e(c.bluegum, payroll, hana, priya, 'Monthly pay day'),
  e(c.northside, salesTax, hana, riley, standard),
  e(c.cobalt, salesTax, ellie, 'owner', standard), e(c.cobalt, payroll, hana, riley, 'Monthly pay day'),
  e(c.figtree, salesTax, sam, riley, program), e(c.figtree, close, sam, 'owner', 'Practice manager meeting on the 12th'), e(c.figtree, company, priya, 'owner', 'Principal recorded the business return target'),
  e(c.marlowe, salesTax, ellie, priya, standard),
  e(c.tworivers, salesTax, sam, riley, standard), e(c.tworivers, close, sam, riley, 'Excise reconciliation needs the books by the 12th'),
  e(c.ironbark, salesTax, hana, priya, program),
  e(c.lumen, salesTax, hana, riley, standard), e(c.lumen, individual, hana, 'owner', 'Principal recorded the annual return target'),
  e(c.coastal, salesTax, ellie, riley, standard),
  e(c.greenway, close, ellie, priya, 'Investor update on the 12th'), e(c.greenway, company, riley, 'owner', 'Principal recorded the business return target'),
  e(c.oldmill, individual, hana, 'owner', 'Principal recorded the annual return target'),
];
