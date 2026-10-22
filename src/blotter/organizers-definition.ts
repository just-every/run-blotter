// Versioned organizer definitions. Conditions refer backwards, so visibility
// is deterministic and a hidden ancestor keeps the entire section hidden.
import { insist, integer, optional, text, type Data } from './model';

export type OrganizerQuestion = { key: string; label: string; type: 'text' | 'choice'; options: string[]; required: boolean; when: { question: string; values: string[] } | null; request: string; workflowQuestion: string; es?: { label: string; options?: string[]; request?: string } };
export type OrganizerDefinition = { name: string; kind: 'tax' | 'bookkeeping'; version: number; questions: OrganizerQuestion[]; es?: { name: string } };

export function organizerTemplate(value: unknown): OrganizerDefinition | null {
  if (value === undefined || value === null || value === '') return null;
  let input: Data;
  if (typeof value === 'string') { try { input = JSON.parse(value); } catch { insist(false, 'Supply a valid organizer definition'); } }
  else input = value as Data;
  insist(input && typeof input === 'object' && !Array.isArray(input), 'Supply an organizer definition');
  insist(['tax', 'bookkeeping'].includes(input.kind), 'Organizer kind: choose tax or bookkeeping');
  insist(Array.isArray(input.questions) && input.questions.length > 0 && input.questions.length <= 60, 'An organizer needs between 1 and 60 questions');
  const questions: OrganizerQuestion[] = [];
  for (const raw of input.questions) {
    insist(raw && typeof raw === 'object' && !Array.isArray(raw), 'Each organizer question is an object');
    const key = text(raw.key, 'Question key', 40);
    insist(/^[a-z][a-z0-9_-]*$/.test(key) && !questions.some(q => q.key === key), 'Question keys must be unique lowercase names');
    insist(['text', 'choice'].includes(raw.type), 'Question type: choose text or choice');
    const options: string[] = raw.type === 'choice' ? (() => {
      insist(Array.isArray(raw.options) && raw.options.length >= 2 && raw.options.length <= 10, 'Choice questions need between 2 and 10 options');
      const list = raw.options.map((v: unknown) => text(v, 'Choice', 80));
      insist(new Set(list).size === list.length, 'Question choices must be distinct'); return list;
    })() : [];
    insist(raw.required === undefined || typeof raw.required === 'boolean', 'Required must be true or false');
    let when: OrganizerQuestion['when'] = null;
    if (raw.when) {
      const parent = questions.find(q => q.key === raw.when.question);
      insist(parent?.type === 'choice', 'A condition must name an earlier choice question');
      insist(Array.isArray(raw.when.values) && raw.when.values.length > 0 && raw.when.values.every((v: unknown) => parent.options.includes(String(v))), 'Choose existing parent answers for the condition');
      when = { question: parent.key, values: [...new Set(raw.when.values as string[])] };
    }
    const workflowQuestion = optional(raw.workflowQuestion, 'Workflow question key', 40);
    insist(!workflowQuestion || (raw.type === 'choice' && !questions.some(q => q.workflowQuestion === workflowQuestion)), 'A workflow question binds to one choice question');
    // PORTAL-005: an optional Spanish rendering of the question; stored answers always use the recorded (English) choice values.
    let es: OrganizerQuestion['es'];
    if (raw.es !== undefined && raw.es !== null) {
      insist(typeof raw.es === 'object' && !Array.isArray(raw.es), 'The Spanish question is an object');
      const spanishOptions = raw.type === 'choice' && raw.es.options !== undefined ? (() => {
        insist(Array.isArray(raw.es.options) && raw.es.options.length === options.length, 'Give one Spanish choice for each recorded choice, in the same order');
        const list = raw.es.options.map((v: unknown) => text(v, 'Spanish choice', 80)); insist(new Set(list).size === list.length, 'Spanish choices must be distinct'); return list;
      })() : undefined;
      es = { label: text(raw.es.label, 'Spanish question label', 200), ...(spanishOptions ? { options: spanishOptions } : {}), ...(raw.es.request ? { request: text(raw.es.request, 'Spanish document request', 200) } : {}) };
    }
    questions.push({ key, label: text(raw.label, 'Question label', 200), type: raw.type, options, required: raw.required === true, when,
      request: optional(raw.request, 'Supporting document request', 200), workflowQuestion, ...(es ? { es } : {}) });
  }
  const es = input.es?.name ? { name: text(input.es.name, 'Spanish organizer name', 120) } : undefined;
  return { name: text(input.name, 'Organizer name', 120), kind: input.kind, version: integer(input.version ?? 1, 'Organizer version', 1, 1_000_000), questions, ...(es ? { es } : {}) };
}

export function visibleQuestions(definition: OrganizerDefinition, answers: Data): Set<string> {
  const shown = new Set<string>();
  for (const q of definition.questions) {
    const a = q.when ? answers[q.when.question] : null;
    if (!q.when || (shown.has(q.when.question) && a?.confirmed && q.when.values.includes(a.value))) shown.add(q.key);
  }
  return shown;
}

export function checkedAnswer(question: OrganizerQuestion, input: unknown) {
  insist(input && typeof input === 'object' && !Array.isArray(input), 'An answer includes its value and confirmation');
  const answer = input as Data;
  insist(typeof answer.confirmed === 'boolean', 'Confirm whether this answer is current');
  const value = optional(answer.value, question.label, question.type === 'choice' ? 80 : 4000);
  insist(question.type !== 'choice' || value === '' || question.options.includes(value), `Choose one of the recorded answers for ${question.label}`);
  return { value, confirmed: answer.confirmed && value !== '' };
}

export function validateOrganizerWorkflow(definition: OrganizerDefinition | null, workflow: Data[]) {
  for (const question of definition?.questions ?? []) {
    const bound=workflow.find(q=>q.key===(question.workflowQuestion||question.key));
    insist(!question.workflowQuestion||bound,`Organizer question ${question.label} names a missing workflow question`);
    if(bound) insist(question.type==='choice'&&question.options.every(option=>bound.options.includes(option)),`Organizer choices for ${question.label} must match the workflow question`);
  }
}
