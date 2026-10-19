// Clients and recurring job templates.
import { fieldDefs, groups, profileFields, tagList } from './profiles';
import { atomic, audit, human, insist, id, integer, lines, need, now, optional, rows, stmt, text, email, visibleJobParams, type Actor, type Data } from './model';

export function abn(value: unknown) {
  const digits = optional(value, 'ABN', 20).replace(/\s/g, '');
  if (!digits) return '';
  insist(/^\d{11}$/.test(digits), 'ABN must have 11 digits');
  return digits;
}

export async function addClient(db: D1Database, actor: Actor, body: Data) {
  human(actor); need(actor, 'owner', 'reviewer');
  const client = {
    id: id(), name: text(body.name, 'Client name', 200), abn: abn(body.abn),
    contactName: optional(body.contactName, 'Contact name', 200),
    contactEmail: body.contactEmail ? email(body.contactEmail, 'Contact email') : '',
    fields: profileFields(await fieldDefs(db), body.fields), tags: tagList(body.tags),
  };
  await atomic(db, actor, [
    stmt(db, 'INSERT INTO b_clients(id,name,abn,contact_name,contact_email,source,revision,created_at,fields,tags) VALUES(?,?,?,?,?,?,?,?,?,?)', client.id, client.name, client.abn, client.contactName, client.contactEmail, 'native', id(), now(), JSON.stringify(client.fields), JSON.stringify(client.tags)),
    audit(db, actor, 'client.added', client.id, client.name),
  ]);
  return client;
}

export async function saveTemplate(db: D1Database, actor: Actor, body: Data) {
  human(actor); need(actor, 'owner', 'reviewer');
  const recurrence = body.recurrence;
  insist(['monthly', 'quarterly', 'annual'].includes(recurrence), 'Choose monthly, quarterly or annual');
  const template = {
    id: id(), name: text(body.name, 'Template name', 120), recurrence,
    steps: lines(body.steps, 'Checklist steps'), requests: lines(body.requests, 'Client document requests'),
    feeCents: integer(body.feeCents ?? 0, 'Fixed fee in cents', 0, 100_000_000),
  };
  await atomic(db, actor, [
    stmt(db, 'INSERT INTO b_templates(id,name,recurrence,steps,requests,fee_cents,created_by,created_at) VALUES(?,?,?,?,?,?,?,?)', template.id, template.name, recurrence, JSON.stringify(template.steps), JSON.stringify(template.requests), template.feeCents, actor.email, now()),
    audit(db, actor, 'template.saved', template.id, template.name),
  ]);
  return template;
}

/** Everything the workspace lists, filtered to what this person may see. */
export async function workspace(db: D1Database, actor: Actor) {
  const wide = actor.role !== 'preparer';
  const jobs = await rows(db, `SELECT b_jobs.*,c.name client_name,
      (SELECT COUNT(*) FROM b_requests r WHERE r.job_id=b_jobs.id AND r.status<>'accepted') open_requests,
      (SELECT COUNT(*) FROM b_job_steps s WHERE s.job_id=b_jobs.id AND s.done_at IS NULL) open_steps
    FROM b_jobs JOIN b_clients c ON c.id=b_jobs.client_id
    WHERE (?='owner' OR ?='reviewer' OR b_jobs.preparer_email=?)
    ORDER BY b_jobs.status='signed_off',CASE WHEN b_jobs.status<>'signed_off' THEN b_jobs.due_date END,b_jobs.signed_off_at DESC,c.name`, ...visibleJobParams(actor));
  return {
    actor: { email: actor.email, name: actor.name, role: actor.role },
    jobs,
    clients: wide ? await rows(db, 'SELECT * FROM b_clients ORDER BY name')
      : await rows(db, 'SELECT * FROM b_clients WHERE id IN (SELECT client_id FROM b_jobs WHERE preparer_email=?) ORDER BY name', actor.email),
    templates: await rows(db, 'SELECT * FROM b_templates ORDER BY name'),
    fields: await fieldDefs(db),
    groups: wide ? await groups(db) : [],
    people: wide ? await rows(db, `SELECT email,name,role FROM b_members WHERE active=1 UNION ALL SELECT email,display_name,'owner' FROM oa_operators WHERE role='owner' AND status='active' ORDER BY 2`) : [],
    proposals: await rows(db, 'SELECT * FROM b_proposals WHERE for_email=? ORDER BY created_at DESC LIMIT 100', actor.email),
  };
}
