import { organizerTemplate, validateOrganizerWorkflow } from './organizers-definition';
import { contactInsert, contactValues, legacyContactValues, readableClient } from './client-contacts';
import { clientDetail, entityValues } from './client-lifecycle';
import { firmCurrency, firmSettings } from './firm';
// Clients and recurring job templates.
import { fieldDefs, groups, profileFields, tagList } from './profiles';
import { pendingStep } from './flow';
import { templateWork } from './tasks';
import { stageSql, statusModel } from './statuses';
import { atomic, audit, guard, human, insist, id, integer, lines, need, now, optional, rows, stmt, text, email, readableJobParams, readableJobSql, type Actor, type Data } from './model';

export function abn(value: unknown) {
  const digits = optional(value, 'ABN', 20).replace(/\s/g, '');
  if (!digits) return '';
  insist(/^\d{11}$/.test(digits), 'ABN must have 11 digits');
  return digits;
}

/** New US identifiers use EIN; the existing column also retains legacy ABNs. */
export function ein(value: unknown) {
  const digits = optional(value, 'EIN', 20).replace(/[\s-]/g, '');
  insist(!digits || /^\d{9}$/.test(digits), 'EIN must have 9 digits');
  return digits;
}
export function clientTaxId(body: Data) {
  insist(!(body.ein && body.abn), 'Supply an EIN or a legacy ABN, not both');
  return body.ein !== undefined ? ein(body.ein) : abn(body.abn);
}

export async function addClient(db: D1Database, actor: Actor, body: Data) {
  human(actor); need(actor, 'owner', 'reviewer');
  const client = {
    id: id(), name: text(body.name, 'Client name', 200), abn: clientTaxId(body),
    contactName: optional(body.contactName, 'Contact name', 200),
    contactEmail: body.contactEmail ? email(body.contactEmail, 'Contact email') : '',
    fields: profileFields(await fieldDefs(db), body.fields), tags: tagList(body.tags),
  };
  const entity = await entityValues(db, body);
  insist(body.contacts === undefined || (Array.isArray(body.contacts) && body.contacts.length <= 50), 'Record at most 50 contacts');
  const contacts = (body.contacts ?? []).map((c: Data) => contactValues(c));
  insist(!contacts.length || (!client.contactName && !client.contactEmail), 'Use contacts or the legacy single contact fields, not both');
  await atomic(db, actor, [
    stmt(db, 'INSERT INTO b_clients(id,name,abn,contact_name,contact_email,source,revision,created_at,fields,tags) VALUES(?,?,?,?,?,?,?,?,?,?)', client.id, client.name, client.abn, client.contactName, client.contactEmail, 'native', id(), now(), JSON.stringify(client.fields), JSON.stringify(client.tags)),
    stmt(db, 'UPDATE b_clients SET entity_type=?,partner_email=?,team=?,services=?,owner_client_id=?,ssn_last4=? WHERE id=?', entity.entity_type,entity.partner_email,entity.team,entity.services,entity.owner_client_id,entity.ssn_last4,client.id),
    ...(client.contactName || client.contactEmail ? [contactInsert(db,actor,client.id,legacyContactValues(client.contactName,client.contactEmail),'legacy:'+client.id)] : []),
    ...contacts.map((c: Data) => contactInsert(db, actor, client.id, c)),
    audit(db, actor, 'client.added', client.id, client.name),
  ]);
  return { ...client, ...await clientDetail(db, actor, client.id), fields:client.fields, tags:client.tags };
}


/** Edit the entity without changing its recorded engagements or contacts. */
export async function editClient(db: D1Database, actor: Actor, clientId: string, body: Data) {
  human(actor); need(actor, 'owner', 'reviewer');
  const c = await readableClient(db, actor, clientId);
  insist(body.revision === c.revision, 'The client changed. Refresh and try again.', 409);
  const entity = await entityValues(db, body, c), name = body.name === undefined ? c.name : text(body.name,'Client name',200);
  const taxId = body.ein === undefined && body.abn === undefined ? c.abn : clientTaxId(body);
  const fields = profileFields(await fieldDefs(db), body.fields, JSON.parse(c.fields)), tags = body.tags === undefined ? JSON.parse(c.tags) : tagList(body.tags);
  const [check, release] = guard(db, 'EXISTS(SELECT 1 FROM b_clients WHERE id=? AND revision=? AND merged_into IS NULL)', clientId,c.revision);
  await atomic(db,actor,[check,stmt(db,'UPDATE b_clients SET name=?,abn=?,entity_type=?,partner_email=?,team=?,services=?,owner_client_id=?,ssn_last4=?,fields=?,tags=?,revision=? WHERE id=?', name,taxId,entity.entity_type,entity.partner_email,entity.team,entity.services,entity.owner_client_id,entity.ssn_last4,JSON.stringify(fields),JSON.stringify(tags),id(),clientId),
    audit(db,actor,'client.edited',clientId,name),release]);
  return clientDetail(db,actor,clientId);
}

export async function saveTemplate(db: D1Database, actor: Actor, body: Data) {
  human(actor); need(actor, 'owner', 'reviewer');
  const recurrence = body.recurrence;
  insist(['monthly', 'quarterly', 'annual'].includes(recurrence), 'Choose monthly, quarterly or annual');
  const organizer = organizerTemplate(body.organizer);
  const template = {
    id: id(), name: text(body.name, 'Template name', 120), recurrence,
    ...await templateWork(db, body),
    currency: await firmCurrency(db, body.currency),
    feeCents: integer(body.feeCents ?? 0, 'Fixed fee in cents', 0, 100_000_000),
  };
  validateOrganizerWorkflow(organizer,template.questions);
  await atomic(db, actor, [
    stmt(db, 'INSERT INTO b_templates(id,name,recurrence,steps,requests,questions,fee_cents,created_by,created_at,currency) VALUES(?,?,?,?,?,?,?,?,?,?)', template.id, template.name, recurrence, JSON.stringify(template.steps), JSON.stringify(template.requests), JSON.stringify(template.questions), template.feeCents, actor.email, now(), template.currency),
    ...(organizer ? [stmt(db,'UPDATE b_templates SET organizer=? WHERE id=?',JSON.stringify(organizer),template.id),
      stmt(db,'INSERT INTO b_organizer_versions(template_id,version,definition,author,created_at) VALUES(?,?,?,?,?)',template.id,organizer.version,JSON.stringify(organizer),actor.email,now())] : []),
    // Each template has a work type of its own name (WORK-007), the default for its jobs.
    stmt(db, 'INSERT INTO b_work_types(id,name,template_id,created_by,created_at) VALUES(?,?,?,?,?)', 'wt-' + template.id, template.name, template.id, actor.email, now()),
    audit(db, actor, 'template.saved', template.id, template.name),
  ]);
  return template;
}

/** Everything the workspace lists, filtered to what this person may see. */
export async function workspace(db: D1Database, actor: Actor) {
  const wide = actor.role !== 'preparer', firm = await firmSettings(db);
  const jobs = await rows(db, `SELECT b_jobs.*,c.name client_name,
      (SELECT COUNT(*) FROM b_requests r WHERE r.job_id=b_jobs.id AND r.organizer_active=1 AND r.status<>'accepted') open_requests,
      (SELECT COUNT(*) FROM b_job_steps s WHERE s.job_id=b_jobs.id AND ${pendingStep('s')}) open_steps,
      (SELECT COUNT(*) FROM b_portal_items p WHERE p.job_id=b_jobs.id AND p.kind='question' AND p.status='open') client_questions,
      ${stageSql('b_jobs')} stage,(SELECT name FROM b_sub_statuses WHERE id=b_jobs.sub_status_id) sub_status,w.name work_type,w.color work_type_color
    FROM b_jobs JOIN b_clients c ON c.id=b_jobs.client_id LEFT JOIN b_work_types w ON w.id=b_jobs.work_type_id
    WHERE ${readableJobSql}
    ORDER BY b_jobs.status='signed_off',CASE WHEN b_jobs.status<>'signed_off' THEN b_jobs.due_date END,b_jobs.signed_off_at DESC,c.name`, ...readableJobParams(actor));
  const clients = wide ? await rows(db, 'SELECT * FROM b_clients WHERE merged_into IS NULL ORDER BY name')
    : await rows(db, `SELECT c.* FROM b_clients c WHERE merged_into IS NULL AND EXISTS(SELECT 1 FROM b_jobs WHERE b_jobs.client_id=c.id AND ${readableJobSql}) ORDER BY name`, ...readableJobParams(actor));
  return {
    actor: { email: actor.email, name: actor.name, role: actor.role },
    jobs,
    clients: clients.map(c => ({ ...c, ssn_last4:c.ssn_last4 ? '•••••'+c.ssn_last4 : '' })),
    templates: await rows(db, 'SELECT * FROM b_templates ORDER BY name'),
    statusModel: await statusModel(db),
    firm: { timeZone: firm.timeZone, currency: firm.currency },
    fields: await fieldDefs(db),
    groups: wide ? await groups(db) : [],
    people: wide ? await rows(db, `SELECT email,name,role FROM b_members WHERE active=1 UNION ALL SELECT email,display_name,'owner' FROM oa_operators WHERE role='owner' AND status='active' ORDER BY 2`) : [],
    proposals: await rows(db, 'SELECT * FROM b_proposals WHERE for_email=? ORDER BY created_at DESC LIMIT 100', actor.email),
  };
}
