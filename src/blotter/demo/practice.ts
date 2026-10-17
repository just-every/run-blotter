// The sample practice: Morgan & Co Bookkeeping, the firm the run site's
// drawings follow (reviewer Riley Tan, the Quarterly BAS requests), with the
// move-in fixture's clients (fixtures/client-list.csv) and a dozen more.
// Every name, email and ABN is invented; email domains are .example.
import { abn } from '../clients';
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
  bas: template('bas', 'Quarterly BAS', 'quarterly', 33000,
    'Reconcile bank accounts\nCode GST on sales and purchases\nReview PAYG withholding\nPrepare BAS worksheet\nClient approves the BAS',
    'Bank statements for the quarter\nSales invoices and receipts\nPurchase receipts and bills'),
  close: template('close', 'Month-end bookkeeping', 'monthly', 45000,
    'Import bank feeds\nReconcile bank and cards\nProcess supplier bills\nAccruals and prepayments\nMonth-end report to the client',
    'Bank and card statements\nSupplier bills not in the inbox'),
  payroll: template('payroll', 'Payroll and STP', 'monthly', 18000,
    'Timesheets and leave approved\nPay run processed\nSTP pay event lodged\nSuper paid through the clearing house',
    'Approved timesheets and leave requests'),
  company: template('company', 'Company tax return', 'annual', 220000,
    'Year-end adjustments\nDepreciation schedule\nFinancial statements drafted\nTax return prepared\nPrincipal reviews the return\nClient signs the declaration',
    'Year-end bank and loan statements\nAsset purchases and sales\nStocktake at 30 June'),
  individual: template('individual', 'Individual tax return', 'annual', 38000,
    'Prefill report downloaded\nIncome and deductions entered\nReturn prepared\nClient signs the declaration',
    'Income statement and interest\nDeduction receipts\nPrivate health insurance statement'),
};

export type Client = { id: string; name: string; abn: string; contactName: string; contactEmail: string };
const client = (name: string, abnDigits: string, contactName: string, contactEmail: string): Client =>
  ({ id: fixedId('client:' + name), name, abn: abn(abnDigits), contactName, contactEmail: contactEmail ? email(contactEmail) : '' });

export const clients = {
  harbour: client('Harbour Lane Cafe Pty Ltd', '10000000001', 'Mia Chen', 'mia@harbourlane.example'),
  ridgeline: client('Ridgeline Plumbing', '', 'Tom Ridge', 'accounts@ridgeline.example'),
  wattle: client('Wattle & Stone Studio', '10000000002', 'Ana Silva', 'ana@wattlestone.example'),
  saltwater: client('Saltwater Physio Pty Ltd', '10000000003', "Grace O'Neill", 'grace@saltwaterphysio.example'),
  kestrel: client('Kestrel Joinery Pty Ltd', '10000000004', 'Dean Kowalski', 'office@kestreljoinery.example'),
  bluegum: client('Bluegum Childcare Centre', '10000000005', 'Leah Porter', 'director@bluegumcare.example'),
  northside: client('Northside Florist', '10000000006', 'Rosa Mendes', 'rosa@northsideflorist.example'),
  cobalt: client('Cobalt Electrical Services', '10000000007', 'Aaron Fitzgerald', 'admin@cobaltelectrical.example'),
  figtree: client('Fig Tree Dental Pty Ltd', '10000000008', 'Nina Patel', 'practice@figtreedental.example'),
  marlowe: client('Marlowe Architects', '10000000009', 'Ben Marlowe', 'ben@marlowearch.example'),
  tworivers: client('Two Rivers Brewing Co', '10000000010', 'Callum Reid', 'accounts@tworiversbrewing.example'),
  ironbark: client('Ironbark Landscaping', '10000000011', 'Jess Whitford', 'jess@ironbarklandscaping.example'),
  lumen: client('Lumen Yoga Studio', '10000000012', 'Sophie Laurent', 'hello@lumenyoga.example'),
  coastal: client('Coastal Mobile Mechanics', '10000000013', 'Ravi Kumar', 'ravi@coastalmechanics.example'),
  greenway: client('Greenway Organics Pty Ltd', '10000000014', 'Hamish Doyle', 'finance@greenwayorganics.example'),
  oldmill: client('Old Mill Antiques', '', 'Margaret Ellis', ''),
};

// Who prepares and reviews each recurring engagement ('owner' is the principal).
type Who = 'owner' | (typeof team)[number]['email'];
export type Engagement = { client: Client; template: Template; preparer: Who; reviewer: Who; dueNote: string };
const riley = 'riley@morganco.example', priya = 'priya@morganco.example', sam = 'sam@morganco.example', ellie = 'ellie@morganco.example', hana = 'hana@morganco.example';
const program = 'ATO lodgement program (agent concession)', standard = 'Standard quarterly due date, client not on the program';
const e = (c: Client, t: Template, preparer: Who, reviewer: Who, dueNote: string): Engagement => ({ client: c, template: t, preparer, reviewer, dueNote });
const { bas, close, payroll, company, individual } = templates, c = clients;

export const engagements: Engagement[] = [
  e(c.harbour, bas, sam, riley, standard), e(c.harbour, close, sam, riley, 'Owner wants the month-end report by the 12th'), e(c.harbour, payroll, hana, priya, 'Monthly pay day'),
  e(c.ridgeline, bas, ellie, riley, program), e(c.ridgeline, close, ellie, priya, 'Month-end report by the 12th'),
  e(c.wattle, bas, hana, priya, standard), e(c.wattle, individual, hana, 'owner', 'Tax agent program, 2026 return'),
  e(c.saltwater, bas, sam, 'owner', program), e(c.saltwater, payroll, hana, priya, 'Monthly pay day'), e(c.saltwater, company, priya, 'owner', 'Tax agent program for companies'),
  e(c.kestrel, bas, ellie, riley, standard), e(c.kestrel, close, ellie, riley, 'Bank covenant report by the 12th'), e(c.kestrel, company, riley, 'owner', 'Tax agent program for companies'),
  e(c.bluegum, bas, sam, priya, program), e(c.bluegum, payroll, hana, priya, 'Monthly pay day'),
  e(c.northside, bas, hana, riley, standard),
  e(c.cobalt, bas, ellie, 'owner', standard), e(c.cobalt, payroll, hana, riley, 'Monthly pay day'),
  e(c.figtree, bas, sam, riley, program), e(c.figtree, close, sam, 'owner', 'Practice manager meeting on the 12th'), e(c.figtree, company, priya, 'owner', 'Tax agent program for companies'),
  e(c.marlowe, bas, ellie, priya, standard),
  e(c.tworivers, bas, sam, riley, standard), e(c.tworivers, close, sam, riley, 'Excise reconciliation needs the books by the 12th'),
  e(c.ironbark, bas, hana, priya, program),
  e(c.lumen, bas, hana, riley, standard), e(c.lumen, individual, hana, 'owner', 'Tax agent program, 2026 return'),
  e(c.coastal, bas, ellie, riley, standard),
  e(c.greenway, close, ellie, priya, 'Investor update on the 12th'), e(c.greenway, company, riley, 'owner', 'Tax agent program for companies'),
  e(c.oldmill, individual, hana, 'owner', 'Tax agent program, 2026 return'),
];
