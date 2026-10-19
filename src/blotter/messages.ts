// Firm and personal message templates (MSG-001). The principal keeps firm
// templates; every staff member keeps personal ones and can copy a firm
// template. Each edit is a new version with its author. Composing renders a
// template for one job and client, previews it, and refuses to send while a
// placeholder is unresolved or empty, naming the field. A version may carry
// attachments, sent with every message made from it.
import { atomic, audit, digest, human, id, insist, need, now, optional, rows, stmt, text, type Actor, type Data } from './model';
import { decodeFile } from './documents';

type File = { name: string; mime: string; encoded: string; size: number; sha256: string };
const MAX_FILES = 5;

/** The attachments a create or edit sets, or undefined to keep the previous version's. */
async function attachments(value: unknown): Promise<File[] | undefined> {
  if (value === undefined) return undefined;
  insist(Array.isArray(value) && value.length <= MAX_FILES, `Attach at most ${MAX_FILES} files`);
  return Promise.all(value.map(async item => { const f = decodeFile(item ?? {}); return { name: f.name, mime: f.mime, encoded: f.encoded, size: f.bytes.length, sha256: await digest(f.bytes) }; }));
}
const insertFiles = (db: D1Database, templateId: string, version: number, files: File[]) => files.map((f, n) =>
  stmt(db, 'INSERT INTO b_msg_template_files(template_id,version,ordinal,name,mime,size,sha256,content_base64) VALUES(?,?,?,?,?,?,?,?)', templateId, version, n + 1, f.name, f.mime, f.size, f.sha256, f.encoded));

/** A template version's files, with their contents when sending. */
export const templateFiles = (db: D1Database, templateId: string, version: number, content = false) =>
  rows(db, `SELECT ordinal,name,mime,size,sha256${content ? ',content_base64' : ''} FROM b_msg_template_files WHERE template_id=? AND version=? ORDER BY ordinal`, templateId, version);

/** Every placeholder a template may use, with the name shown when it is missing. */
export const PLACEHOLDERS: Record<string, string> = {
  firm_name: 'firm name', sender_name: 'sender', client_name: 'client', contact_first_name: 'contact first name',
  work_item: 'work item', work_type: 'work type', period: 'period', due_date: 'due date',
  outstanding_requests: 'outstanding requests', portal_link: 'portal link', invoice_amount: 'invoice amount', invoice_due_date: 'invoice due date',
};
const TOKEN = /\{\{\s*([a-z_]+)\s*\}\}/g;
/** Shown in a preview where the secure link will go; the real link is created only when sending. */
export const LINK_PREVIEW = '[secure upload link, created when you send]';

function checked(subject: string, body: string) {
  const unknown = [...`${subject}\n${body}`.matchAll(TOKEN)].map(m => m[1]).filter(k => !Object.hasOwn(PLACEHOLDERS, k));
  insist(!unknown.length, `Unknown placeholder: ${[...new Set(unknown)].map(k => `{{${k}}}`).join(', ')}. Use one of ${Object.keys(PLACEHOLDERS).map(k => `{{${k}}}`).join(', ')}`);
}
const fields = (body: Data) => {
  const subject = text(body.subject, 'Subject', 200), message = text(body.body, 'Message', 10_000);
  checked(subject, message);
  return { subject, body: message };
};

export async function setFirmName(db: D1Database, actor: Actor, body: Data) {
  human(actor); need(actor, 'owner');
  const name = text(body.name, 'Firm name', 200);
  await atomic(db, actor, [stmt(db, 'INSERT INTO b_firm(id,name,set_by,set_at) VALUES(1,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,set_by=excluded.set_by,set_at=excluded.set_at', name, actor.email, now()),
    audit(db, actor, 'firm.named', 'firm', name)]);
  return { name };
}

/** Firm templates and the actor's own personal ones, newest version, with optional search and category. */
export async function templates(db: D1Database, actor: Actor, query: Data = {}) {
  const q = `%${optional(query.q, 'Search', 100).toLowerCase()}%`, category = optional(query.category, 'Category', 60);
  const files = await rows(db, 'SELECT f.template_id,f.ordinal,f.name,f.mime,f.size,f.sha256 FROM b_msg_template_files f JOIN b_msg_templates t ON t.id=f.template_id AND t.version=f.version ORDER BY f.ordinal');
  const list = await rows(db, `SELECT t.id,t.scope,t.owner_email,t.name,t.category,t.version,v.subject,v.body,v.author,v.created_at updated_at
      FROM b_msg_templates t JOIN b_msg_template_versions v ON v.template_id=t.id AND v.version=t.version
      WHERE t.deleted_at IS NULL AND (t.scope='firm' OR t.owner_email=?) AND (?='' OR t.category=?)
        AND (lower(t.name) LIKE ? OR lower(t.category) LIKE ? OR lower(v.subject) LIKE ? OR lower(v.body) LIKE ?)
      ORDER BY t.category,t.name`, actor.email, category, category, q, q, q, q);
  return {
    firmName: (await stmt(db, 'SELECT name FROM b_firm WHERE id=1').first<Data>())?.name ?? '',
    placeholders: PLACEHOLDERS,
    templates: list.map((t): Data => ({ ...t, attachments: files.filter(f => f.template_id === t.id).map(({ template_id, ...f }) => f) })),
  };
}

async function editable(db: D1Database, actor: Actor, templateId: string) {
  const t = await stmt(db, 'SELECT * FROM b_msg_templates WHERE id=? AND deleted_at IS NULL', templateId).first<Data>();
  insist(t && (t.scope === 'firm' || t.owner_email === actor.email), 'Template not found', 404);
  insist(t.scope === 'personal' || actor.role === 'owner', 'Only the principal edits firm templates; save a personal copy instead', 403);
  return t;
}

export async function createTemplate(db: D1Database, actor: Actor, body: Data, copied?: File[]) {
  human(actor);
  const files = copied ?? await attachments(body.attachments) ?? [];
  const scope = body.scope === 'firm' ? 'firm' : 'personal';
  insist(scope === 'personal' || actor.role === 'owner', 'Only the principal creates firm templates; save a personal one instead', 403);
  const t = { id: id(), name: text(body.name, 'Template name', 120), category: text(body.category ?? 'General', 'Category', 60), ...fields(body) };
  await atomic(db, actor, [
    stmt(db, 'INSERT INTO b_msg_templates(id,scope,owner_email,name,category,version,created_by,created_at) VALUES(?,?,?,?,?,1,?,?)', t.id, scope, scope === 'personal' ? actor.email : null, t.name, t.category, actor.email, now()),
    stmt(db, 'INSERT INTO b_msg_template_versions(template_id,version,subject,body,author,created_at) VALUES(?,1,?,?,?,?)', t.id, t.subject, t.body, actor.email, now()),
    ...insertFiles(db, t.id, 1, files),
    audit(db, actor, 'template.message_created', t.id, `${scope}: ${t.name}${files.length ? `, ${files.length} attachments` : ''}`)]);
  return { ...t, scope, version: 1, attachments: files.map(({ encoded, ...f }) => f) };
}

/** An edit is a new version; earlier versions and sent messages stay as they were. */
export async function editTemplate(db: D1Database, actor: Actor, templateId: string, body: Data) {
  human(actor);
  const t = await editable(db, actor, templateId), next = Number(t.version) + 1, f = fields(body), files = await attachments(body.attachments);
  const name = body.name === undefined ? t.name : text(body.name, 'Template name', 120), category = body.category === undefined ? t.category : text(body.category, 'Category', 60);
  await atomic(db, actor, [
    stmt(db, 'INSERT INTO b_msg_template_versions(template_id,version,subject,body,author,created_at) VALUES(?,?,?,?,?,?)', t.id, next, f.subject, f.body, actor.email, now()),
    // New files replace the attachments; otherwise the new version keeps the previous version's.
    ...(files ? insertFiles(db, t.id, next, files) : [stmt(db, 'INSERT INTO b_msg_template_files(template_id,version,ordinal,name,mime,size,sha256,content_base64) SELECT template_id,?,ordinal,name,mime,size,sha256,content_base64 FROM b_msg_template_files WHERE template_id=? AND version=?', next, t.id, t.version)]),
    stmt(db, 'UPDATE b_msg_templates SET version=?,name=?,category=? WHERE id=? AND version=?', next, name, category, t.id, t.version),
    audit(db, actor, 'template.message_edited', t.id, `version ${next}`)]);
  return { id: t.id, version: next };
}

export async function deleteTemplate(db: D1Database, actor: Actor, templateId: string) {
  human(actor);
  const t = await editable(db, actor, templateId);
  await atomic(db, actor, [stmt(db, 'UPDATE b_msg_templates SET deleted_by=?,deleted_at=? WHERE id=? AND deleted_at IS NULL', actor.email, now(), t.id), audit(db, actor, 'template.message_deleted', t.id, t.name)]);
  return { id: t.id, deleted: true };
}

/** A personal copy of a firm (or own) template, at its current version, with its attachments. */
export async function copyTemplate(db: D1Database, actor: Actor, templateId: string, body: Data) {
  const source = (await templates(db, actor)).templates.find(t => t.id === templateId);
  insist(source, 'Template not found', 404);
  const files = (await templateFiles(db, source.id, source.version, true)).map(f => ({ name: f.name, mime: f.mime, encoded: f.content_base64, size: f.size, sha256: f.sha256 }));
  return createTemplate(db, actor, { scope: 'personal', name: body.name ?? `${source.name} (my copy)`, category: source.category, subject: source.subject, body: source.body }, files);
}

/** Placeholder values for one job and its client contact, as they are now. */
export async function valuesFor(db: D1Database, actor: Actor, j: Data, client: Data, outstanding: string[], link: string) {
  const firm = await stmt(db, 'SELECT name FROM b_firm WHERE id=1').first<Data>();
  return {
    firm_name: firm?.name ?? '', sender_name: actor.name || actor.email, client_name: client.name,
    // The contact's first name is the first word of their recorded name until CRM-001 stores names in parts.
    contact_first_name: String(client.contact_name ?? '').trim().split(/\s+/)[0] ?? '',
    work_item: `${j.title} ${j.period_label}`, work_type: j.title, period: j.period_label, due_date: j.due_date,
    outstanding_requests: outstanding.map(label => `- ${label}`).join('\n'), portal_link: link, invoice_amount: '', invoice_due_date: '',
  } as Record<string, string>;
}

/**
 * Render a subject and body. A filled-in value replaces an empty or missing
 * one; every placeholder still empty is reported by name.
 */
export function render(subject: string, body: string, values: Record<string, string>, fill: unknown) {
  const filled: Record<string, string> = { ...values };
  if (fill && typeof fill === 'object') for (const [k, v] of Object.entries(fill as Data)) {
    insist(Object.hasOwn(PLACEHOLDERS, k), `Unknown placeholder: {{${k}}}`);
    const value = optional(v, PLACEHOLDERS[k], 2000);
    if (value) filled[k] = value;
  }
  checked(subject, body);
  const missing = new Set<string>(), apply = (s: string) => s.replace(TOKEN, (_, k: string) => { const v = filled[k]?.trim(); if (!v) missing.add(k); return v ?? ''; });
  return { subject: apply(subject), body: apply(body), missing: [...missing].map(k => ({ key: k, label: PLACEHOLDERS[k] })) };
}

/** The template a sender may use: a firm template or their own, at its current version. */
export async function usable(db: D1Database, actor: Actor, templateId: string) {
  const t = (await templates(db, actor)).templates.find(row => row.id === templateId);
  insist(t, 'Template not found', 404);
  return t;
}
