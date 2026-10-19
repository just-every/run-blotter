// Three-way library changes: a firm edit is never overwritten by an upstream release.
import { type StarterVersion } from './starter-content';
import { type Data } from './model';
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export function releaseState(release: StarterVersion): Data {
  return { tasks: Object.fromEntries(release.tasks.map(t => [slug(t.label), t])), requests: Object.fromEntries(release.requests.map(r => [slug(r), r])),
    organizer: release.organizer ?? null, questions:release.questions ?? [], messages: Object.fromEntries(release.messages.map(m => [slug(m.name), m])), budgetMinutes: release.budgetMinutes, description: release.description };
}
const flat = (s: Data) => ({ ...Object.fromEntries((s.questions??[]).map((q:Data)=>['workflowQuestions:'+q.key,q])),organizerName:s.organizer?.name??null,organizerKind:s.organizer?.kind??null,...Object.fromEntries((s.organizer?.questions??[]).map((q:Data)=>['organizerQuestions:'+q.key,q])),budgetMinutes: s.budgetMinutes, description: s.description, ...Object.fromEntries(['tasks', 'requests', 'messages'].flatMap(kind => Object.entries(s[kind]).map(([key, value]) => [`${kind}:${key}`, value]))) });
export const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
export function changes(base: Data, current: Data, next: Data) {
  const [b, c, n] = [flat(base), flat(current), flat(next)] as Data[];
  return [...new Set([...Object.keys(b), ...Object.keys(n)])].filter(key => !same(b[key], n[key])).map(key => ({ key, before: b[key] ?? null, after: n[key] ?? null, current: c[key] ?? null, conflict: !same(b[key], c[key]) }));
}
export function applyChange(state: Data, key: string, value: unknown) {
  const [kind, name] = key.split(':');
  if (kind === 'organizerQuestions' || key === 'organizerName' || key === 'organizerKind') {
    state.organizer ??= {version:1,questions:[]};
    if (kind === 'organizerQuestions') { const at=state.organizer.questions.findIndex((q:Data)=>q.key===name); if(value===null){ if(at>=0)state.organizer.questions.splice(at,1); } else if(at>=0)state.organizer.questions[at]=value; else state.organizer.questions.push(value); }
    else state.organizer[key==='organizerName'?'name':'kind']=value;
  } else if(kind==='workflowQuestions') {
    state.questions??=[]; const at=state.questions.findIndex((q:Data)=>q.key===name);
    if(value===null){if(at>=0)state.questions.splice(at,1);} else if(at>=0)state.questions[at]=value;else state.questions.push(value);
  } else if (!name) state[kind] = value;
  else if (value === null) delete state[kind][name];
  else state[kind][name] = value;
}
export const publicTasks = (state: Data) => Object.values(state.tasks).sort((a: any, b: any) => a.dueDays - b.dueDays) as Data[];
