/** Original US practice starting checklists, maintained as library releases.
 * Firms review scope, applicability, estimates and dates before adoption. These
 * are not verified legal/tax guidance. Offsets are internal planning targets
 * relative to the firm's recorded job due date, never statutory calculations.
 * Organizer questions remain empty until the PORTAL-004 organizer exists.
 */
export type StarterTask = {
  label: string;
  assignee: 'preparer' | 'reviewer';
  startFrom: 'start' | 'due'; startDays: number;
  dueFrom: 'start' | 'due'; dueDays: number;
  estimateMinutes: number;
  instructions: string;
};
export type StarterMessage = { name: string; subject: string; body: string };
export type StarterVersion = {
  version: number;
  tasks: StarterTask[];
  requests: string[];
  questions: [];
  messages: StarterMessage[];
  budgetMinutes: number;
  description: string;
};
export type StarterTemplate = {
  id: string;
  name: string;
  recurrence: 'monthly' | 'quarterly' | 'annual';
  versions: StarterVersion[];
};

const task = (label: string, assignee: StarterTask['assignee'], startDays: number, dueDays: number, estimateMinutes: number, instructions: string): StarterTask =>
  ({ label, assignee, startFrom: 'due', startDays, dueFrom: 'due', dueDays, estimateMinutes, instructions });

const requestMessage = (name: string, note: string): StarterMessage => ({
  name,
  subject: '{{work_type}} — {{client_name}} — {{period}}',
  body: 'Hello {{contact_first_name}},\n\nWe are gathering information for {{work_item}} for {{period}}. Our current work target is {{due_date}}.\n\nPlease provide the outstanding items through your secure upload link:\n{{outstanding_requests}}\n\n{{portal_link}}\n\n'
    + note + '\n\nPlease tell us if an item does not apply or will arrive later.\n\n{{sender_name}}\n{{firm_name}}',
});

const release = (version: number, description: string, tasks: StarterTask[], requests: string[], message: StarterMessage): StarterVersion => ({
  version, description, tasks, requests, questions: [], messages: [message],
  budgetMinutes: tasks.reduce((minutes, entry) => minutes + entry.estimateMinutes, 0),
});

const closeTasks = [
  task('Confirm close scope and information received', 'preparer', -14, -10, 20, 'Confirm the period, accounts and services covered by the engagement. List missing statements and unresolved prior-period items; agree an owner and next action for each.'),
  task('Reconcile balance-sheet accounts', 'preparer', -10, -5, 120, 'In the client ledger, reconcile bank, card, loan and other in-scope balance-sheet accounts to supporting records. Attach reconciliation evidence and explain reconciling items. Blotter records the work; it does not perform bookkeeping.'),
  task('Review results and outstanding adjustments', 'reviewer', -5, -2, 45, 'Review the prepared reconciliations, unusual movements and proposed adjustments against the agreed scope. Return unresolved questions to the preparer; record review conclusions and any client decisions needed.'),
  task('Deliver close package and carry forward actions', 'preparer', -2, 0, 30, 'After reviewer approval, provide the agreed reports through the approved client channel. Record delivery evidence and carry unresolved items into the next period with an owner.'),
];
const closeRequests = ['Bank and credit-card statements for the period', 'Loan statements and details of new financing', 'Support for unusual transactions and outstanding prior-period questions'];

const individualTasks = [
  task('Confirm individual return scope and prior-year carryovers', 'preparer', -40, -30, 45, 'Confirm the taxpayer, household changes, engagement scope and jurisdictions with the client. Compare the prior return and workpapers; identify carryovers for verification in the tax software. Have a practitioner confirm applicable deadlines and record them separately.'),
  task('Organize documents and prepare the return externally', 'preparer', -30, -14, 180, 'Reconcile source documents to the intake list and investigate missing or inconsistent information. Prepare the in-scope return in the firm tax software and retain workpapers supporting judgments; do not infer missing amounts.'),
  task('Review return and resolve preparation questions', 'reviewer', -14, -7, 75, 'Review source-document coverage, prior-year differences, carryovers and jurisdiction coverage. Record review points and resolve them with the preparer before approving the client review copy.'),
  task('Coordinate client review and required authorizations', 'preparer', -7, 0, 30, 'Explain the reviewed package through the firm approved process, resolve client corrections and obtain the required authorizations through the authorized signing process. Record actual transmission and acceptance evidence from the filing system separately; completion is not filing acceptance.'),
];
const individualRequests = ['Prior-year return and relevant carryover workpapers', 'Current-year income statements and supporting records', 'Deduction, credit and estimated-payment records within the agreed scope'];

export const STARTER_LIBRARY: StarterTemplate[] = [
  {
    id: 'monthly-close', name: 'Monthly bookkeeping close', recurrence: 'monthly',
    versions: [
      release(1, 'Monthly close covering reconciliations, review and delivery; tailor accounts and scope to the engagement.', closeTasks, closeRequests,
        requestMessage('Monthly close information request', 'Include all pages of each statement and identify any accounts opened or closed during the period.')),
      release(2, 'Adds a separate cutoff and completeness review plus support for receivables, payables and payroll balances.', [
        { ...closeTasks[0], instructions: closeTasks[0].instructions + ' Review prior close exceptions with the responsible person before requesting this period’s records.' }, closeTasks[1],
        task('Check cutoff and balance completeness', 'preparer', -6, -4, 40, 'Compare the in-scope receivable, payable and payroll balances to supporting schedules. Investigate transactions near the period boundary and missing liabilities; document adjustments proposed for reviewer approval in the client ledger.'),
        ...closeTasks.slice(2),
      ], [...closeRequests, 'Receivable, payable and payroll balance support, where included in scope'],
      requestMessage('Monthly close information request', 'Include all statement pages, identify new or closed accounts, and provide the in-scope receivable, payable and payroll balance support so we can check cutoff.')),
    ],
  },
  {
    id: 'quarterly-941', name: 'Quarterly payroll — Form 941', recurrence: 'quarterly',
    versions: [release(1, 'Federal quarterly payroll preparation and review; confirm filing requirements and due dates with the responsible practitioner.', [
      task('Confirm employer scope and quarter', 'preparer', -21, -16, 25, 'Confirm the employer identity, quarter, payroll provider responsibilities and whether this engagement includes Form 941. Obtain the prior quarter record and have a practitioner record the applicable filing and deposit deadlines.'),
      task('Reconcile payroll and payment evidence', 'preparer', -16, -10, 75, 'Reconcile the quarter payroll registers, ledger payroll balances and available deposit confirmations. Investigate voids, off-cycle runs, adjustments and differences before preparing the return in the payroll system.'),
      task('Review prepared 941 package', 'reviewer', -10, -4, 40, 'Review the external payroll system draft against reconciled records and supporting schedules. Resolve differences and confirm the responsible filer and required client approvals.'),
      task('Coordinate approval and retain filing evidence', 'preparer', -4, 0, 20, 'Obtain required approval using the firm process. Retain submission and acceptance evidence actually received from the responsible filer and track any rejection or unpaid item with an owner.'),
    ], ['Quarter payroll registers, including off-cycle and corrected runs', 'Payroll tax deposit confirmations and relevant agency correspondence', 'Prior-quarter return and payroll adjustment details'],
    requestMessage('Quarterly 941 records request', 'Please identify payroll corrections and tell us whether your payroll provider is responsible for preparing or submitting this return.'))],
  },
  {
    id: 'state-withholding', name: 'Quarterly state withholding', recurrence: 'quarterly',
    versions: [release(1, 'Quarterly planning cadence for state withholding work; each jurisdiction and actual filing frequency requires firm review.', [
      task('Confirm state accounts and filing responsibilities', 'preparer', -21, -16, 30, 'Confirm the states, account identifiers, payroll provider scope and actual filing frequencies with the responsible practitioner. Record jurisdiction-specific due dates manually; split work where a quarterly cadence does not fit.'),
      task('Reconcile state withholding records', 'preparer', -16, -9, 60, 'Compare state payroll summaries with ledger balances, deposit evidence and employee location changes. Resolve account, period and allocation differences in the payroll system.'),
      task('Review state withholding package', 'reviewer', -9, -4, 35, 'Review each in-scope state draft and payment reconciliation. Confirm that amendments, credits and agency correspondence have been considered by the practitioner.'),
      task('Coordinate approval and track outcomes', 'preparer', -4, 0, 20, 'Obtain required approvals and record actual submission, acceptance and payment evidence from the responsible filer. Assign follow-up for unresolved differences or agency responses.'),
    ], ['State payroll summaries and employee work-location changes', 'State withholding payment confirmations and account statements', 'State notices, prior filings and correction details'],
    requestMessage('State withholding records request', 'Please identify new state payroll accounts and employees whose work location changed during the quarter.'))],
  },
  {
    id: 'unemployment', name: 'Quarterly unemployment reporting', recurrence: 'quarterly',
    versions: [release(1, 'Quarterly unemployment reporting workflow; the firm verifies applicable programs, account settings and filing schedules.', [
      task('Confirm unemployment accounts and quarter scope', 'preparer', -21, -16, 25, 'Confirm the applicable jurisdictions, responsible payroll provider and in-scope unemployment reports. Have the practitioner verify current account notices, filing frequencies and deadlines.'),
      task('Reconcile wage detail and account evidence', 'preparer', -16, -9, 65, 'Compare employee wage detail, payroll summaries, prior-quarter records and account payments. Resolve wage corrections and employee-identification questions through the secure client process before external preparation.'),
      task('Review unemployment reporting package', 'reviewer', -9, -4, 35, 'Review the externally prepared wage reports and reconciliations. Confirm the provider used the practitioner-approved account information and resolve exceptions.'),
      task('Coordinate release and retain acknowledgments', 'preparer', -4, 0, 20, 'Obtain required client approval, confirm the responsible filer and retain actual acknowledgments and payment evidence. Track rejected reports or disputed account balances.'),
    ], ['Quarter employee wage detail and payroll summaries', 'Unemployment account notices and current account information', 'Payment confirmations, prior-quarter reports and wage corrections'],
    requestMessage('Unemployment reporting records request', 'Upload employee wage detail securely and include any new unemployment account notices or corrected payroll runs.'))],
  },
  {
    id: 'sales-tax', name: 'Sales-tax filing', recurrence: 'monthly',
    versions: [release(1, 'Sales-tax preparation coordination with a monthly starting cadence; firm review sets jurisdictions, obligations and actual frequency.', [
      task('Confirm jurisdictions and reporting scope', 'preparer', -21, -15, 30, 'Confirm registrations, in-scope jurisdictions, marketplaces and the responsible filer with the practitioner. Record filing frequencies and deadlines separately; route nexus or taxability questions to the practitioner.'),
      task('Reconcile sales and supporting schedules', 'preparer', -15, -8, 90, 'Reconcile sales-channel reports to the client ledger and identify refunds, marketplace activity and exempt-sale support. Document differences for practitioner resolution and preparation in the external filing system.'),
      task('Review prepared sales-tax package', 'reviewer', -8, -3, 40, 'Review the source reconciliation, practitioner decisions and externally prepared returns for each in-scope jurisdiction. Resolve exceptions before client approval.'),
      task('Coordinate approval and capture outcome', 'preparer', -3, 0, 20, 'Obtain client approval and retain actual filing acknowledgments and payment evidence from the responsible filer. Record unresolved matters and next-period follow-up.'),
    ], ['Sales-channel reports, including marketplace sales and refunds', 'Client ledger sales summaries and prior-period reconciliation', 'Exempt-sale support and jurisdiction account correspondence'],
    requestMessage('Sales-tax information request', 'Please identify new selling channels, new locations and any notices received so the practitioner can review the reporting scope.'))],
  },
  {
    id: '1040', name: 'Form 1040 individual return', recurrence: 'annual',
    versions: [
      release(1, 'Individual return document collection, external preparation, review and authorization coordination.', individualTasks, individualRequests,
        requestMessage('Individual return records request', 'Please identify changes in your household, income sources or states connected to your work or residence.')),
      release(2, 'Adds a dedicated completeness discussion covering changed circumstances and a request for current-year change details.', [
        individualTasks[0],
        task('Resolve changed circumstances and missing information', 'preparer', -30, -24, 30, 'Compare the client change summary with the prior-year return and current documents. Discuss new income sources, household changes and state connections. Record unanswered questions and practitioner decisions before preparation; do not treat silence as confirmation.'),
        ...individualTasks.slice(1),
      ], [...individualRequests, 'Summary of household, income-source and state work or residence changes'],
      requestMessage('Individual return records request', 'Please include a summary of household changes, new income sources, and states connected to your work or residence. Tell us about information still outstanding so we can discuss next steps.')),
    ],
  },
  {
    id: '1120s', name: 'Form 1120-S S corporation return', recurrence: 'annual',
    versions: [release(1, 'S corporation return workflow requiring practitioner review of entity, shareholder and jurisdiction scope.', [
      task('Confirm entity and shareholder information', 'preparer', -45, -32, 45, 'Confirm engagement scope, entity identity, ownership changes, prior returns and in-scope states. Escalate election, eligibility and ownership questions to the practitioner; record practitioner-confirmed deadlines separately.'),
      task('Prepare reconciled entity workpapers', 'preparer', -32, -16, 210, 'Tie the trial balance to financial records and assemble shareholder activity, distributions, payroll and fixed-asset support. Prepare the return and shareholder schedules in external tax software; investigate unsupported balances.'),
      task('Review corporate return and shareholder schedules', 'reviewer', -16, -7, 90, 'Review reconciliations, ownership allocations, shareholder activity and externally prepared schedules against evidence. Resolve review points and record practitioner conclusions.'),
      task('Coordinate officer approval and shareholder delivery', 'preparer', -7, 0, 35, 'Coordinate client review and required officer authorizations using the approved signature process. Deliver reviewed shareholder schedules securely to authorized recipients and retain actual filing outcomes separately.'),
    ], ['Prior-year return and shareholder schedules', 'Year-end trial balance, financial statements and account reconciliations', 'Shareholder ownership, contribution, distribution and loan activity', 'Payroll, fixed-asset and estimated-payment support'],
    requestMessage('S corporation return records request', 'Please flag shareholder changes and distinguish shareholder loans, contributions and distributions in the supporting records.'))],
  },
  {
    id: '1065', name: 'Form 1065 partnership return', recurrence: 'annual',
    versions: [release(1, 'Partnership return workflow with agreement, ownership and partner-activity review.', [
      task('Confirm partnership scope and agreement changes', 'preparer', -45, -32, 50, 'Confirm entity details, partner changes, in-scope jurisdictions and the current agreement. Refer allocation and transaction questions to the practitioner and record practitioner-confirmed deadlines separately.'),
      task('Prepare partnership and partner workpapers', 'preparer', -32, -16, 240, 'Reconcile the trial balance and assemble capital, contributions, distributions, liabilities and special-transaction support. Prepare the return and partner schedules in external tax software using documented practitioner decisions.'),
      task('Review return and partner allocations', 'reviewer', -16, -7, 100, 'Review source reconciliations, agreement-related decisions, partner activity and externally prepared schedules. Resolve differences and confirm the authorized client reviewer.'),
      task('Coordinate approval and partner packages', 'preparer', -7, 0, 40, 'Coordinate required client review and authorizations. Deliver reviewed partner packages to authorized recipients and record actual submission and acceptance evidence separately from task completion.'),
    ], ['Prior-year return and partner schedules', 'Year-end trial balance, reconciliations and liability support', 'Partnership agreement, amendments and ownership-change details', 'Partner contributions, distributions and capital activity'],
    requestMessage('Partnership return records request', 'Please include agreement amendments, ownership transfers and details of contributions or distributions made outside the normal course.'))],
  },
  {
    id: '1120', name: 'Form 1120 corporation return', recurrence: 'annual',
    versions: [release(1, 'Corporate return preparation and review; entity-specific tax decisions remain with the practitioner.', [
      task('Confirm corporation and jurisdiction scope', 'preparer', -45, -32, 40, 'Confirm entity identity, ownership and organizational changes, prior-year positions and in-scope jurisdictions. Obtain practitioner confirmation of deadlines and record them separately.'),
      task('Reconcile financial records and prepare externally', 'preparer', -32, -16, 210, 'Tie the trial balance to the financial statements and assemble fixed-asset, equity, related-party and payment support. Document book-to-return differences in workpapers and prepare the return in external tax software.'),
      task('Review corporate return workpapers', 'reviewer', -16, -7, 90, 'Review reconciliations, carryovers, unusual transactions and the externally prepared return. Resolve unsupported positions and record the practitioner-approved treatment.'),
      task('Coordinate officer review and authorization', 'preparer', -7, 0, 30, 'Provide the reviewed package to the authorized officer and coordinate required approvals and signatures. Track actual filing acknowledgments and payment evidence from the responsible system separately.'),
    ], ['Prior-year corporate return and carryover workpapers', 'Year-end trial balance, financial statements and reconciliations', 'Fixed-asset, equity and related-party transaction support', 'Estimated-payment records and relevant agency correspondence'],
    requestMessage('Corporation return records request', 'Please identify ownership or organizational changes and provide support for unusual or related-party transactions.'))],
  },
  {
    id: '1041', name: 'Form 1041 estate or trust return', recurrence: 'annual',
    versions: [release(1, 'Fiduciary return workflow; the practitioner determines the reporting entity, period and beneficiary treatment.', [
      task('Confirm fiduciary authority and return scope', 'preparer', -45, -32, 50, 'Confirm the entity, fiduciary authority, governing documents, reporting period and prior filings. Refer legal-document interpretation and filing requirements to the responsible practitioner; record confirmed deadlines separately.'),
      task('Organize fiduciary income and distribution support', 'preparer', -32, -16, 180, 'Reconcile financial and investment statements, expenses and beneficiary distributions. Prepare the return and any beneficiary schedules in external tax software using documented practitioner decisions.'),
      task('Review fiduciary return and beneficiary schedules', 'reviewer', -16, -7, 80, 'Review source coverage, governing-document decisions, distribution support and prepared beneficiary schedules. Resolve discrepancies with the preparer and authorized fiduciary.'),
      task('Coordinate fiduciary approval and secure delivery', 'preparer', -7, 0, 35, 'Coordinate required fiduciary review and authorizations. Deliver reviewed beneficiary schedules only to authorized recipients and record actual filing outcomes separately.'),
    ], ['Governing documents and fiduciary authority records', 'Prior-year return and beneficiary schedules', 'Income, investment and expense statements for the reporting period', 'Beneficiary details and distribution records'],
    requestMessage('Estate or trust return records request', 'Please identify changes in fiduciaries or beneficiaries and include the dates and support for distributions.'))],
  },
  {
    id: '990', name: 'Form 990 exempt organization return', recurrence: 'annual',
    versions: [release(1, 'Exempt organization return workflow; the practitioner confirms the appropriate return, schedules and disclosures.', [
      task('Confirm organization scope and reporting requirements', 'preparer', -50, -36, 50, 'Confirm organizational identity, reporting period, exemption records, prior return and engagement scope. Have the practitioner determine the applicable return and schedules and record confirmed deadlines separately.'),
      task('Assemble financial and organizational disclosures', 'preparer', -36, -18, 210, 'Reconcile financial records and collect program, governance, compensation, fundraising and related-organization information relevant to practitioner-approved scope. Prepare the return in external tax software and list unanswered disclosure questions.'),
      task('Review return and disclosure completeness', 'reviewer', -18, -8, 100, 'Review financial ties and narrative disclosures against source records and client responses. Resolve inconsistencies and confirm the organization review process before release.'),
      task('Coordinate organization review and authorization', 'preparer', -8, 0, 40, 'Provide the reviewed package to the authorized organization representative, complete the agreed review and signature process, and retain actual filing outcome evidence separately. Handle any public copy under practitioner instructions.'),
    ], ['Prior-year return, exemption records and organizational changes', 'Year-end financial statements, trial balance and reconciliations', 'Program activities, governance and compensation records', 'Fundraising, donor and related-organization support within scope'],
    requestMessage('Exempt organization return records request', 'Please coordinate one response for financial records and organizational disclosures, and identify questions requiring board or officer input.'))],
  },
  {
    id: '1099', name: 'Year-end 1099 reporting', recurrence: 'annual',
    versions: [release(1, 'Year-end information-return workflow; practitioner review determines payees, forms, methods and deadlines.', [
      task('Confirm payer scope and reporting responsibilities', 'preparer', -35, -25, 30, 'Confirm payer identity, engagement scope and which provider prepares and submits information returns. Have the practitioner determine applicable forms, delivery methods and deadlines; record these separately.'),
      task('Reconcile payees and payment records', 'preparer', -25, -12, 100, 'Reconcile vendor payments to the ledger and secure payee records. Flag missing or inconsistent names, tax identifiers, payment-method distinctions and corrections for practitioner review before external preparation.'),
      task('Review prepared information returns', 'reviewer', -12, -5, 50, 'Review the practitioner-approved reporting population, payer/payee details, payment reconciliation and externally prepared forms. Resolve missing identifiers through the secure client process.'),
      task('Coordinate authorized filing and recipient delivery', 'preparer', -5, 0, 30, 'Obtain required approval and coordinate filing and recipient delivery through the authorized provider. Retain actual acknowledgments and delivery evidence; assign corrections and rejected records for follow-up.'),
    ], ['Vendor payment detail reconciled to the ledger', 'Secure payee tax-information records and current addresses', 'Prior-year information returns and current-year correction details'],
    requestMessage('1099 reporting records request', 'Use the secure upload link for tax-information records. Please identify payment methods, vendor changes and corrections so the practitioner can review the reporting population.'))],
  },
  {
    id: 'w2', name: 'Year-end W-2 reporting', recurrence: 'annual',
    versions: [release(1, 'Year-end wage reporting workflow coordinated with the responsible payroll provider.', [
      task('Confirm employer and payroll-provider responsibilities', 'preparer', -35, -25, 25, 'Confirm employer accounts, payroll systems, year-end scope and the provider responsible for preparation, filing and employee delivery. Record practitioner-confirmed deadlines separately.'),
      task('Reconcile annual wages and employee records', 'preparer', -25, -12, 100, 'Reconcile annual payroll summaries to quarterly reports and the ledger. Resolve employee identity or address issues securely and document off-cycle payroll, benefit adjustments and corrections for the payroll provider.'),
      task('Review draft wage statements', 'reviewer', -12, -5, 50, 'Compare the provider drafts and annual reconciliation. Resolve discrepancies and obtain practitioner decisions on benefit or adjustment questions before approval.'),
      task('Coordinate release and track corrections', 'preparer', -5, 0, 25, 'Coordinate authorized employer approval, provider submission and employee delivery. Retain actual acknowledgments and delivery evidence and record corrections or rejections with an owner.'),
    ], ['Annual payroll register and quarterly payroll reports', 'Secure employee identity and address change records', 'Year-end benefit adjustments, off-cycle runs and correction details'],
    requestMessage('W-2 reporting records request', 'Please upload employee records securely and identify year-end adjustments that have not yet been included in payroll.'))],
  },
  {
    id: 'tax-notice', name: 'Tax notice response', recurrence: 'annual',
    versions: [release(1, 'Event-driven notice response using an annual storage cadence; start manually for each notice and confirm every response date.', [
      task('Triage notice and record practitioner-confirmed dates', 'preparer', -21, -17, 30, 'Capture every page of the notice, received date, agency, period and stated response date. Escalate urgent notices immediately rather than waiting for this planning offset. Have the responsible practitioner confirm scope, authority and response dates.'),
      task('Reconcile notice to return and payment records', 'preparer', -17, -8, 90, 'Compare the notice with filed-return evidence, account records, payments and prior correspondence. Record differences and assemble a proposed factual response without making unsupported concessions.'),
      task('Review response and client instructions', 'reviewer', -8, -3, 45, 'Review the evidence, authority and proposed response with the responsible practitioner. Resolve technical or representation questions and obtain the client decisions required by the engagement.'),
      task('Coordinate response and track agency follow-up', 'preparer', -3, 0, 30, 'After required approval, coordinate delivery through the authorized response channel. Retain actual delivery evidence, set a human-confirmed follow-up date and track the agency outcome without assuming the matter is resolved.'),
    ], ['Complete notice, all attachments and date received', 'Relevant return, filing acknowledgment and payment evidence', 'Related agency correspondence and existing representation authority'],
    requestMessage('Tax notice information request', 'Upload every page of the notice promptly and tell us when it arrived. If a stated response date is close or has passed, contact your practice team directly as well.'))],
  },
  {
    id: 'onboarding', name: 'New-client onboarding', recurrence: 'annual',
    versions: [release(1, 'Event-driven client setup using an annual storage cadence; start manually and tailor to the accepted engagement.', [
      task('Confirm accepted scope and authorized contacts', 'preparer', -21, -16, 35, 'Verify the accepted engagement and identify authorized contacts, entities, services and responsibilities. Resolve missing scope or authority before requesting account access; do not treat this checklist as a signed engagement.'),
      task('Collect records and coordinate secure access', 'preparer', -16, -9, 60, 'Request agreed records and use each provider delegated-access process. Never ask for shared passwords, one-time codes or secret keys. Record access owners and track outstanding predecessor information.'),
      task('Review opening information and delivery plan', 'reviewer', -9, -4, 45, 'Review initial records, opening balances where in scope, prior-provider handover and service boundaries. Agree the first deliverables, human-confirmed dates and unresolved issues with the client.'),
      task('Confirm readiness and launch agreed work', 'preparer', -4, 0, 30, 'Confirm the client communication channel, responsible staff and approved first work items. Start only the agreed jobs or recurrence rules, and carry outstanding onboarding matters forward with named owners.'),
    ], ['Accepted engagement documents and authorized contact details', 'Prior-provider handover and prior-year records within scope', 'Current financial records and account inventory within scope'],
    requestMessage('Welcome and onboarding information', 'Please use provider invitations for delegated account access. Do not upload passwords, one-time codes or secret keys. We will confirm the first deliverables and responsibilities with you.'))],
  },
  {
    id: 'offboarding', name: 'Client offboarding', recurrence: 'annual',
    versions: [release(1, 'Event-driven engagement closure using an annual storage cadence; start manually and apply the firm approved retention policy.', [
      task('Confirm closure scope and handover authority', 'reviewer', -21, -16, 35, 'Confirm the ending services, effective date, authorized recipients and remaining responsibilities with the client under the engagement terms. Record unresolved deadlines and who will handle them.'),
      task('Prepare authorized handover package', 'preparer', -16, -8, 60, 'Inventory in-scope client records, completed deliverables and outstanding matters. Prepare only the authorized handover package; check recipient authority and exclude unrelated client or internal restricted material.'),
      task('Review retention and access closure plan', 'reviewer', -8, -3, 40, 'Review handover completeness, outstanding work and the firm approved retention or legal-hold requirements. Agree which delegated access ends and when; do not erase records merely because the engagement ends.'),
      task('Record handover and close agreed access', 'preparer', -3, 0, 30, 'Retain actual handover acknowledgment, coordinate removal of delegated access and stop only the agreed future work. Record remaining matters, owners and retention handling; verify access changes in the relevant provider.'),
    ], ['Authorized successor or recipient details and handover instructions', 'Confirmation of remaining services, responsibilities and effective end date', 'Client-owned records or access-transfer items still outstanding'],
    requestMessage('Engagement closure and handover', 'Please confirm the authorized handover recipient and any work you expect to remain open. We will agree the handover and access changes before completing closure.'))],
  },
];
