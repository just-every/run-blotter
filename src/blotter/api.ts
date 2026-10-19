// Every Blotter HTTP door. Each person handler resolves the native session and
// role first; agent doors only read context or prepare proposals.
import { Hono, type Context } from 'hono';
import { deploymentHealth } from '../base/deployment-health';
import { type Bindings, runtimeBindings } from '../auth.server';
import branding from '../branding.json';
import { person, agent } from './session';
import { Fault, insist, type Actor, type Data } from './model';
import { addClient, saveTemplate, workspace } from './clients';
import { commitFields, defineField, previewFields, saveGroup, saveProfile, segment } from './profiles';
import { jobDetail, reviewJob, rollForward, setStep, startJob, submitJob } from './jobs';
import { downloadVersion, portalDecide, portalDeliverables, portalVersionFile, sendDeliverable } from './deliverables';
import { myNotifications } from './notifications';
import { openThread, readThread, reply, resolveThread, threadsFor } from './threads';
import { decideRequest, downloadFile, portalUpload, portalView, sendReminder, staffUpload } from './documents';
import { decideExpense, downloadReceipt, recordExpense, reimburseExpense, setMileageRate } from './expenses';
import { downloadAttachment, weeklyPlan } from './tasks';
import { addTime, approveExport, billingState, deleteTime, downloadExport, prepareExport, voidExport } from './billing';
import { createAgentKey, inviteMember, revokeAgentKey, saveMember, teamState } from './team';
import { setRate } from './rates';
import { commitReassign, commitSchedule, previewReassign, previewSchedule } from './bulk';
import { adjustEntry, closePeriod, correctEntry, entryHistory, reviewEntry, submitWeek, timesheets } from './timesheets';
import { agentContext, decideProposal, propose } from './proposals';
import { importAction, importState } from './imports';
import { backup, eraseFile, restore } from './archive';

type C = Context<{ Bindings: Bindings }>;
export const api = new Hono<{ Bindings: Bindings }>();
api.get('/health', c => c.json({ status: 'ok', ...deploymentHealth(c.env) }));
api.use('/api/*', async (c, next) => { await next(); c.header('cache-control', 'no-store'); c.header('x-content-type-options', 'nosniff'); c.header('referrer-policy', 'no-referrer'); });
api.onError((e, c) => {
  if (e instanceof Fault) return c.json({ error: e.message }, e.status as 400);
  if (e instanceof SyntaxError) return c.json({ error: 'Supply valid JSON' }, 400);
  if ('code' in e && /^(erasure_epoch|erased_row)/.test(String(e.code))) return c.json({ error: `This archive predates an erasure. Restore the latest archive (${String(e.code)}).` }, 409);
  if ('code' in e) return c.json({ error: String(e.code) }, ('status' in e ? Number(e.status) : 409) as 400);
  console.error(e);
  return c.json({ error: 'The operation failed. Refresh before trying again.' }, 500);
});

async function body(c: C): Promise<Data> {
  const raw = await c.req.text();
  insist(raw.length <= 24_000_000, 'Request too large', 413);
  const parsed = JSON.parse(raw);
  insist(parsed && typeof parsed === 'object' && !Array.isArray(parsed), 'Supply a JSON object');
  return parsed;
}
const db = (c: C) => runtimeBindings(c.env).DB;
const param = (c: C, key = 'id') => c.req.param(key)!;
const as = (fn: (a: Actor, c: C) => Promise<unknown>) => async (c: C) => { const result = await fn(await person(c.req.raw, c.env), c); return result instanceof Response ? result : c.json(result); };
const asAgent = (fn: (a: Actor, c: C) => Promise<unknown>) => async (c: C) => c.json(await fn(await agent(c.req.raw, c.env), c));
const P = '/api/blotter';

api.get(`${P}/state`, as((a, c) => workspace(db(c), a)));
api.post(`${P}/clients`, as(async (a, c) => addClient(db(c), a, await body(c))));
api.post(`${P}/clients/fields`, as(async (a, c) => defineField(db(c), a, await body(c))));
api.get(`${P}/clients/segment`, as((a, c) => segment(db(c), a, c.req.query())));
api.post(`${P}/clients/bulk-fields/preview`, as(async (a, c) => previewFields(db(c), a, await body(c))));
api.post(`${P}/clients/bulk-fields`, as(async (a, c) => commitFields(db(c), a, await body(c))));
api.post(`${P}/clients/:id/profile`, as(async (a, c) => saveProfile(db(c), a, param(c), await body(c))));
api.post(`${P}/groups`, as(async (a, c) => saveGroup(db(c), a, await body(c))));
api.post(`${P}/templates`, as(async (a, c) => saveTemplate(db(c), a, await body(c))));
api.post(`${P}/jobs`, as(async (a, c) => startJob(db(c), a, await body(c))));
api.get(`${P}/jobs/:id`, as((a, c) => jobDetail(db(c), a, param(c))));
api.post(`${P}/bulk/schedule/preview`, as(async (a, c) => previewSchedule(db(c), a, await body(c))));
api.post(`${P}/bulk/schedule`, as(async (a, c) => commitSchedule(db(c), a, await body(c))));
api.post(`${P}/bulk/reassign/preview`, as(async (a, c) => previewReassign(db(c), a, await body(c))));
api.post(`${P}/bulk/reassign`, as(async (a, c) => commitReassign(db(c), a, await body(c))));
api.post(`${P}/jobs/:id/roll-forward`, as(async (a, c) => rollForward(db(c), a, param(c), await body(c))));
api.get(`${P}/plan`, as((a, c) => weeklyPlan(db(c), a, c.req.query())));
api.get(`${P}/jobs/:id/steps/:ordinal/attachment`, as((a, c) => downloadAttachment(db(c), a, param(c), param(c, 'ordinal'))));
api.post(`${P}/jobs/:id/steps`, as(async (a, c) => setStep(db(c), a, param(c), await body(c))));
api.post(`${P}/jobs/:id/submit`, as(async (a, c) => submitJob(c.env, a, param(c), await body(c))));
api.post(`${P}/jobs/:id/review`, as(async (a, c) => reviewJob(c.env, a, param(c), await body(c))));
api.get(`${P}/jobs/:id/threads`, as((a, c) => threadsFor(db(c), a, param(c))));
api.post(`${P}/jobs/:id/threads`, as(async (a, c) => openThread(c.env, a, param(c), await body(c))));
api.get(`${P}/threads/:id`, as((a, c) => readThread(db(c), a, param(c))));
api.post(`${P}/threads/:id/messages`, as(async (a, c) => reply(c.env, a, param(c), await body(c))));
api.post(`${P}/threads/:id/resolve`, as(async (a, c) => resolveThread(c.env, a, param(c), await body(c))));
api.get(`${P}/notifications`, as((a, c) => myNotifications(db(c), a)));
api.post(`${P}/jobs/:id/reminders`, as(async (a, c) => sendReminder(c.env, a, param(c), await body(c))));
api.post(`${P}/jobs/:id/time`, as(async (a, c) => addTime(db(c), a, param(c), await body(c))));
api.post(`${P}/time/:id/delete`, as((a, c) => deleteTime(db(c), a, param(c))));
api.get(`${P}/time/:id/history`, as((a, c) => entryHistory(db(c), a, param(c))));
api.post(`${P}/time/:id/review`, as(async (a, c) => reviewEntry(db(c), a, param(c), await body(c))));
api.post(`${P}/time/:id/correct`, as(async (a, c) => correctEntry(db(c), a, param(c), await body(c))));
api.post(`${P}/time/:id/adjust`, as(async (a, c) => adjustEntry(db(c), a, param(c), await body(c))));
api.post(`${P}/jobs/:id/expenses`, as(async (a, c) => recordExpense(db(c), a, param(c), await body(c))));
api.post(`${P}/expenses/:id/decide`, as(async (a, c) => decideExpense(db(c), a, param(c), await body(c))));
api.post(`${P}/expenses/:id/reimbursed`, as((a, c) => reimburseExpense(db(c), a, param(c))));
api.get(`${P}/expenses/:id/receipt`, as((a, c) => downloadReceipt(db(c), a, param(c))));
api.post(`${P}/mileage-rates`, as(async (a, c) => setMileageRate(db(c), a, await body(c))));
api.get(`${P}/timesheets`, as((a, c) => timesheets(db(c), a)));
api.post(`${P}/timesheets/submit`, as(async (a, c) => submitWeek(db(c), a, await body(c))));
api.post(`${P}/periods/close`, as(async (a, c) => closePeriod(db(c), a, await body(c))));
api.post(`${P}/jobs/:id/deliverables`, as(async (a, c) => sendDeliverable(c.env, a, param(c), await body(c))));
api.get(`${P}/deliverables/versions/:id/file`, as((a, c) => downloadVersion(db(c), a, param(c))));
api.post(`${P}/requests/:id/files`, as(async (a, c) => staffUpload(db(c), a, param(c), await body(c))));
api.post(`${P}/requests/:id/decide`, as(async (a, c) => decideRequest(db(c), a, param(c), await body(c))));
api.get(`${P}/files/:id`, as((a, c) => downloadFile(db(c), a, param(c))));
api.post(`${P}/files/:id/erase`, as(async (a, c) => eraseFile(db(c), a, param(c), await body(c))));
api.get(`${P}/billing`, as((a, c) => billingState(db(c), a)));
api.post(`${P}/exports`, as(async (a, c) => prepareExport(db(c), a, await body(c))));
api.post(`${P}/exports/:id/approve`, as(async (a, c) => approveExport(db(c), a, param(c), await body(c))));
api.post(`${P}/exports/:id/void`, as(async (a, c) => voidExport(db(c), a, param(c), await body(c))));
api.get(`${P}/exports/:id/csv`, as((a, c) => downloadExport(db(c), a, param(c))));
api.get(`${P}/team`, as((a, c) => teamState(db(c), a)));
api.post(`${P}/team`, as(async (a, c) => saveMember(db(c), a, await body(c))));
api.post(`${P}/team/rates`, as(async (a, c) => setRate(db(c), a, await body(c))));
api.post(`${P}/team/invite`, as(async (a, c) => inviteMember(c.req.raw, c.env, a, await body(c))));
api.post(`${P}/keys`, as(async (a, c) => createAgentKey(db(c), a, await body(c))));
api.post(`${P}/keys/:id/revoke`, as((a, c) => revokeAgentKey(db(c), a, param(c))));
api.post(`${P}/proposals/:id/decide`, as(async (a, c) => decideProposal(c.env, a, param(c), await body(c))));
api.get(`${P}/import`, as((a, c) => importState(db(c), a)));
api.post(`${P}/import/:op`, as(async (a, c) => importAction(db(c), a, param(c, 'op'), await body(c))));
api.get(`${P}/backup`, as((a, c) => backup(db(c), a)));
api.post(`${P}/restore`, as(async (a, c) => restore(db(c), a, await body(c))));

// Agent doors: read context, prepare proposals. Nothing here changes practice records.
api.get(`${P}/agent/context`, asAgent((a, c) => agentContext(db(c), a)));
api.post(`${P}/agent/:command`, asAgent(async (a, c) => propose(db(c), a, param(c, 'command').replace(/^prepare-/, ''), await body(c))));

// Client portal: the link's secret is the only credential; same-origin uploads only.
api.get(`${P}/portal/:token`, async c => c.json(await portalView(db(c), param(c, 'token'), branding.name)));
const sameOrigin = (c: C) => insist(c.req.header('origin') === runtimeBindings(c.env).AUTH_ORIGIN && c.req.header('sec-fetch-site') !== 'cross-site', 'Invalid request origin', 403);
api.post(`${P}/portal/:token/requests/:request`, async c => {
  sameOrigin(c);
  return c.json(await portalUpload(db(c), param(c, 'token'), param(c, 'request'), await body(c)));
});
api.get(`${P}/portal/:token/deliverables`, async c => c.json(await portalDeliverables(db(c), param(c, 'token'))));
api.get(`${P}/portal/:token/deliverables/:version/file`, async c => portalVersionFile(db(c), param(c, 'token'), param(c, 'version')));
api.post(`${P}/portal/:token/deliverables/:version/decide`, async c => {
  sameOrigin(c);
  return c.json(await portalDecide(c.env, param(c, 'token'), param(c, 'version'), await body(c)));
});
