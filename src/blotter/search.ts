import { documentBytes } from './document-packets';
// Firm-wide search (SEARCH-001). One query covers the clients, contacts, jobs,
// tasks, client portal messages, discussion notes and documents (by name and
// extracted text) the searcher may read: the principal and reviewers read the
// whole firm; anyone else reads the jobs they may read (ACCESS-001, WORK-009),
// the clients of those jobs, and the discussions their preparer may read.
// Every query word must match a word of the result exactly, as a prefix, or
// within one typo (two for words of eight letters or more); results rank by
// that match, then by recency. A client's tax id matches only a query of four
// or more digits from a principal or reviewer, and is only ever shown masked.
import { documentText } from './pdf-text';
import { insist, now, optional, readableJobParams, readableJobSql, rows, stmt, text, type Actor, type Data } from './model';

export const TYPES = ['client', 'contact', 'job', 'task', 'portal message', 'note', 'document'] as const;
const LIMIT = 50, INDEX_PER_SEARCH = 40;

const words = (value: string) => value.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').split(/[^\p{L}\p{N}]+/u).filter(Boolean);
export const mask = (taxId: string) => { const digits = taxId.replace(/\D/g, ''); return digits.length < 4 ? '' : `•••••${digits.slice(-4)}`; };

/** Damerau-Levenshtein distance, stopping early once it exceeds `max`. */
function distance(a: string, b: string, max: number) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    let best = Infinity;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      best = Math.min(best, d[i][j]);
    }
    if (best > max) return max + 1;
  }
  return d[a.length][b.length];
}

/** How well one query word matches a set of words: 3 exact, 2 prefix, 1 within the typo allowance, 0 none. */
function wordScore(query: string, candidates: Set<string>) {
  if (candidates.has(query)) return 3;
  let score = 0;
  const allowance = query.length >= 8 ? 2 : query.length >= 4 ? 1 : 0;
  for (const word of candidates) {
    if (word.startsWith(query)) return 2;
    if (allowance && distance(query, word, allowance) <= allowance) score = 1;
  }
  return score;
}

type Hit = { type: string; id: string; title: string; detail: string; body: string; at: string; open: Data; clientId: string | null; taxId?: string; ssn?: string; phone?: string };

/** Extracts and keeps the text of readable documents that have none yet, so later searches match inside them. */
async function indexDocuments(db: D1Database, actor: Actor) {
  const pending = await rows(db, `SELECT f.id,f.name,f.mime,f.content_base64,f.storage FROM b_files f JOIN b_jobs ON b_jobs.id=f.job_id
    WHERE f.erased_at IS NULL AND f.content_base64 IS NOT NULL AND NOT EXISTS(SELECT 1 FROM b_file_text x WHERE x.file_id=f.id) AND ${readableJobSql} LIMIT ?`, ...readableJobParams(actor), INDEX_PER_SEARCH);
  for (const f of pending) {
    const bytes = await documentBytes(db,f);
    await stmt(db, 'INSERT OR IGNORE INTO b_file_text(file_id,text,extracted_at) VALUES(?,?,?)', f.id, (await documentText(f.mime, f.name, bytes)).slice(0, 200_000), now()).run();
  }
}

async function candidates(db: D1Database, actor: Actor): Promise<Hit[]> {
  const job = readableJobParams(actor), lead = actor.role !== 'preparer';
  const clientSql = lead ? '1=1' : `EXISTS(SELECT 1 FROM b_jobs WHERE b_jobs.client_id=c.id AND ${readableJobSql})`;
  const threadSql = lead ? '1=1' : `EXISTS(SELECT 1 FROM b_jobs WHERE b_jobs.preparer_email=? AND (b_jobs.id=t.job_id OR (t.job_id IS NULL AND b_jobs.client_id=t.client_id)))`;
  const [clients, contacts, jobs, tasks, portal, notes, files] = await Promise.all([
    rows(db, `SELECT c.* FROM b_clients c WHERE c.merged_into IS NULL AND ${clientSql}`, ...(lead ? [] : job)),
    rows(db, `SELECT p.*,c.name entity FROM b_client_contacts p JOIN b_clients c ON c.id=p.client_id WHERE c.merged_into IS NULL AND p.active=1 AND ${clientSql}`, ...(lead ? [] : job)),
    rows(db, `SELECT b_jobs.*,c.name client FROM b_jobs JOIN b_clients c ON c.id=b_jobs.client_id WHERE ${readableJobSql}`, ...job),
    rows(db, `SELECT s.job_id,s.ordinal,s.label,s.instructions,s.done_at,b_jobs.title,b_jobs.period_label,b_jobs.client_id,b_jobs.created_at,c.name client FROM b_job_steps s JOIN b_jobs ON b_jobs.id=s.job_id JOIN b_clients c ON c.id=b_jobs.client_id WHERE ${readableJobSql}`, ...job),
    rows(db, `SELECT p.*,b_jobs.title,b_jobs.client_id,c.name client FROM b_portal_items p JOIN b_jobs ON b_jobs.id=p.job_id JOIN b_clients c ON c.id=b_jobs.client_id WHERE ${readableJobSql}`, ...job),
    rows(db, `SELECT m.id,m.body,m.created_at,t.id thread_id,t.title,t.job_id,t.client_id,c.name client FROM b_thread_messages m JOIN b_threads t ON t.id=m.thread_id JOIN b_clients c ON c.id=t.client_id WHERE ${threadSql}`, ...(lead ? [] : [actor.email])),
    rows(db, `SELECT f.id,f.name,f.job_id,f.uploaded_at,x.text,b_jobs.title,b_jobs.client_id,c.name client FROM b_files f JOIN b_jobs ON b_jobs.id=f.job_id JOIN b_clients c ON c.id=b_jobs.client_id
      LEFT JOIN b_file_text x ON x.file_id=f.id WHERE f.erased_at IS NULL AND ${readableJobSql}`, ...job),
  ]);
  return [
    ...clients.map(c => ({ type: 'client', id: c.id, title: c.name, detail: c.contact_name, body: '', at: c.created_at ?? '', open: { kind: 'client', clientId: c.id }, clientId: c.id, taxId: c.abn, ssn: c.ssn_last4 })),
    ...contacts.map(c => ({ type: 'contact', id:c.id, title:c.name || c.email, detail:`${c.email} · ${c.entity}`, body:c.phone ?? '', phone:c.phone, at:c.updated_at, open:{kind:'client',clientId:c.client_id},clientId:c.client_id })),
    ...jobs.map(j => ({ type: 'job', id: j.id, title: `${j.title} · ${j.period_label}`, detail: `${j.client} · due ${j.due_date}`, body: '', at: j.created_at, open: { kind: 'job', jobId: j.id }, clientId: j.client_id })),
    ...tasks.map(t => ({ type: 'task', id: `${t.job_id}:${t.ordinal}`, title: t.label, detail: `${t.client} · ${t.title} · ${t.period_label}`, body: t.instructions ?? '', at: t.done_at ?? t.created_at, open: { kind: 'job', jobId: t.job_id, ordinal: t.ordinal }, clientId: t.client_id })),
    ...portal.map(p => ({ type: 'portal message', id: p.id, title: p.body.slice(0, 120), detail: `${p.client} · ${p.title} · ${p.kind}`, body: `${p.body} ${p.response ?? ''}`, at: p.closed_at ?? p.created_at, open: { kind: 'job', jobId: p.job_id }, clientId: p.client_id })),
    ...notes.map(n => ({ type: 'note', id: n.id, title: n.title, detail: `${n.client} · ${n.body.slice(0, 120)}`, body: n.body, at: n.created_at, open: { kind: 'thread', threadId: n.thread_id, jobId: n.job_id }, clientId: n.client_id })),
    ...files.map(f => ({ type: 'document', id: f.id, title: f.name, detail: `${f.client} · ${f.title}`, body: f.text ?? '', at: f.uploaded_at, open: { kind: 'file', fileId: f.id, jobId: f.job_id }, clientId: f.client_id })),
  ];
}

/** Searches what the actor may read, optionally one type; a tax-id query needs a principal or reviewer and shows the number masked. */
export async function search(db: D1Database, actor: Actor, query: Data) {
  const q = text(query.q, 'Search', 200), type = optional(query.type, 'Type', 40);
  insist(!type || (TYPES as readonly string[]).includes(type), `Type: choose ${TYPES.join(', ')}`);
  const terms = words(q), phrase = terms.join(' '), digits = q.replace(/[\s-]/g, ''), taxQuery = /^\d{4,}$/.test(digits);
  insist(terms.length, 'Search: type a word or number');
  await indexDocuments(db, actor);
  const scored = (await candidates(db, actor)).filter(h => !type || h.type === type).map(h => {
    const title = new Set(words(h.title)), rest = new Set(words(`${h.detail} ${h.body}`));
    let score = 0;
    for (const term of terms) {
      const best = Math.max(wordScore(term, title) * 2, wordScore(term, rest));
      if (!best) { score = 0; break; }
      score += best;
    }
    if (score && words(`${h.title} ${h.detail} ${h.body}`).join(' ').includes(phrase)) score += 5;
    if (taxQuery && actor.role !== 'preparer' && ((h.taxId && h.taxId.replace(/\D/g, '').includes(digits)) || (h.ssn && h.ssn === digits))) score = Math.max(score, 10);
    if (h.phone && q.replace(/\D/g,'').length >= 7 && h.phone.replace(/\D/g,'').includes(q.replace(/\D/g,''))) score = Math.max(score,10);
    return { ...h, score };
  }).filter(h => h.score > 0);
  scored.sort((a, b) => b.score - a.score || String(b.at).localeCompare(String(a.at)));
  return {
    q, type, total: scored.length,
    results: scored.slice(0, LIMIT).map(({ body, taxId, ssn, phone, ...h }) => ({ ...h, ...(h.type === 'client' ? { taxId: taxId ? mask(taxId) : ssn && actor.role !== 'preparer' ? mask(ssn) : '', taxIdType: taxId ? (taxId.length === 11 ? 'legacy ABN' : 'EIN') : ssn && actor.role !== 'preparer' ? 'SSN last four' : '' } : {}), snippet: snippet(body, terms) })),
  };
}

function snippet(body: string, terms: string[]) {
  if (!body) return '';
  const lower = body.toLowerCase(), at = terms.map(t => lower.indexOf(t)).find(n => n >= 0) ?? 0, start = Math.max(0, at - 60);
  return (start ? '…' : '') + body.slice(start, start + 180).replace(/\s+/g, ' ').trim() + (start + 180 < body.length ? '…' : '');
}
