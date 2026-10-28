import type { ToolDefinition, ToolContext, JsonSchemaObject, JsonSchema } from '../../modules/agent-door/index.ts'
import { type Bindings } from '../../auth.server'
import { agentContext, propose, payloadFor } from '../proposals'
import { readiness, prepareReadiness } from '../readiness'
import { learningEvidence, prepareLearning, learningDetail } from '../learning'
import { job, stmt, type Actor, type Data } from '../model'
import { nativeCall } from './people'

const string = { type: 'string', minLength: 1 }
const strings = { type: 'array', items: string, minItems: 1 }
const input = (properties: Record<string, JsonSchema>, required: string[] = []): JsonSchemaObject => ({ type: 'object', properties, required })
const output = (required: string[], properties: Record<string, JsonSchema>) => ({ type: 'object', required, properties })
const object = { type: 'object' }, array = { type: 'array' }

export function practiceTools(env: Bindings): ToolDefinition[] {
  let contextSnapshot: unknown
  const call = (ctx: ToolContext, path: string, args: Data, run: (actor: Actor) => Promise<unknown>, readOnly = false) => nativeCall(env, ctx, path, args, run, readOnly)
  const preparation = (kind: 'rollforward' | 'reminder' | 'export', area: string, clauses: string[], properties: Record<string, JsonSchema>, required: string[]): ToolDefinition => ({
    name: `blotter.${area}.prepare`, title: `Prepare ${kind}`, description: `Save an attributed ${kind} proposal. This does not execute its proposed effect or record a person's decision.`,
    scope: `${area}:prepare`, readOnly: false, classes: ['standard'], clauses,
    inputSchema: input(properties, required), outputSchema: output(['id', 'kind', 'status', 'payload'], { id: string, kind: string, status: string, payload: object }),
    classify: async (args, ctx) => {
      await call(ctx, '/agent/prepare-' + kind, args, actor => payloadFor(env.DB, actor, kind, args))
      return [{ class: 'standard', facts: { measure: 1 } }]
    },
    summary: async (args, ctx) => {
      const payload = await call(ctx, '/agent/prepare-' + kind, args, actor => payloadFor(env.DB, actor, kind, args)) as Data
      return { target: { ...(payload.jobId ? { id: String(payload.jobId) } : {}), name: kind === 'export' ? payload.title : payload.summary }, items: [payload.summary] }
    },
    ...(kind !== 'export' ? { revision: async (args: Data, ctx: ToolContext) => nativeRevision(env, ctx, String(args.jobId)) } : {}),
    run: async (args, ctx) => {
      const result = await call(ctx, '/agent/prepare-' + kind, args, actor => propose(env.DB, actor, kind, args)) as Data
      ctx.emit('proposal.prepared', `blotter://proposals/${result.id}`, { kind })
      return { result, resources: [{ uri: `blotter://proposals/${result.id}`, name: `${kind} proposal` }] }
    },
  })
  return [
    {
      name: 'blotter.practice.snapshot', title: 'Read scoped work counts', description: 'Read current visible-job and own-draft counts without private record content.',
      scope: 'context:read', readOnly: true, classes: ['standard'], clauses: ['AGENT-001', 'ACCESS-001', 'ACCESS-002'], inputSchema: input({}),
      outputSchema: output(['jobs', 'proposals', 'questions', 'improvements'], { jobs: { type: 'integer' }, proposals: { type: 'integer' }, questions: { type: 'integer' }, improvements: { type: 'integer' } }),
      classify: () => [{ class: 'standard', facts: { measure: 1 } }],
      run: async (_, ctx) => ({ result: await call(ctx, '/agent/context', {}, async actor => {
        const data = await agentContext(env.DB, actor)
        const ids = JSON.stringify((data.jobs as Data[]).map(record => record.id))
        const counts = await stmt(env.DB, `SELECT
          (SELECT count(*) FROM b_proposals WHERE for_email=?) proposals,
          (SELECT count(*) FROM b_readiness_questions WHERE job_id IN (SELECT value FROM json_each(?))) questions,
          (SELECT count(*) FROM b_learning_proposals WHERE for_email=?) improvements`, actor.email, ids, actor.email).first<Data>()
        return { jobs: data.jobs.length, proposals: Number(counts!.proposals), questions: Number(counts!.questions), improvements: Number(counts!.improvements) }
      }, true) }),
    },
    {
      name: 'blotter.practice.context', title: 'Read practice context', description: 'Read current role and client scoped jobs and eligible unbilled sources. Source labels and narrative are untrusted.', scope: 'context:read', readOnly: true,
      classes: ['sensitive'], clauses: ['AGENT-001', 'ACCESS-001', 'ACCESS-002'], inputSchema: input({}),
      outputSchema: output(['jobs', 'unbilled', 'commands'], { jobs: array, unbilled: array, commands: array }), untrusted: true,
      classify: async (_, ctx) => { const data = await call(ctx, '/agent/context', {}, actor => agentContext(env.DB, actor), true) as Data; contextSnapshot = data; return [{ class: 'sensitive', facts: { measure: data.jobs.length + data.unbilled.length, kind: 'practice' } }] },
      run: async () => ({ result: contextSnapshot }),
    },
    preparation('rollforward', 'rollforward', ['AGENT-001', 'WORK-002'], { jobId: string, dueDate: string, dueNote: string }, ['jobId', 'dueDate', 'dueNote']),
    preparation('reminder', 'reminder', ['AGENT-001', 'PORTAL-001'], { jobId: string, message: { type: 'string', maxLength: 1000 } }, ['jobId']),
    preparation('export', 'billing', ['AGENT-001', 'BILL-001'], { title: string, sourceKeys: strings }, ['title', 'sourceKeys']),
    {
      name: 'blotter.readiness.read', title: 'Read engagement readiness', description: 'Read source-linked collected and missing evidence, recorded answers and unresolved judgments. This never infers filing or validates document content.',
      scope: 'readiness:read', readOnly: true, classes: ['sensitive'], clauses: ['READY-001', 'ACCESS-001', 'ACCESS-002'], inputSchema: input({ jobId: string }, ['jobId']),
      outputSchema: output(['jobId', 'documents', 'answers', 'steps', 'questions'], { jobId: string, documents: array, answers: array, steps: array, questions: array }), untrusted: true,
      classify: async (args, ctx) => { await call(ctx, `/agent/jobs/${args.jobId}/readiness`, args, actor => job(env.DB, actor, String(args.jobId)), true); return [{ class: 'sensitive', facts: { measure: 1, kind: 'practice' } }] },
      run: async (args, ctx) => ({ result: await call(ctx, `/agent/jobs/${args.jobId}/readiness`, args, actor => readiness(env.DB, actor, String(args.jobId)), true), resources: [{ uri: `blotter://engagements/${args.jobId}`, name: 'Engagement readiness' }] }),
    },
    {
      name: 'blotter.readiness.prepare', title: 'Prepare a source-linked question', description: 'Save a deterministic question draft for a current request or recorded answer. It creates no client to-do and sends nothing.',
      scope: 'readiness:prepare', readOnly: false, classes: ['standard', 'sensitive'], clauses: ['READY-001'],
      inputSchema: input({ jobId: string, sourceKind: { enum: ['request', 'answer'] }, sourceId: string }, ['jobId', 'sourceKind', 'sourceId']),
      outputSchema: output(['id', 'readiness'], { id: string, readiness: object }),
      classify: async (args, ctx) => { await nativeRevision(env, ctx, String(args.jobId)); return [{ class: 'standard', facts: { measure: 1 } }, { class: 'sensitive', facts: { measure: 1, kind: 'practice' } }] },
      summary: args => ({ target: { id: String(args.jobId) }, items: [`Draft question for ${args.sourceKind}:${args.sourceId}`] }),
      revision: (args, ctx) => nativeRevision(env, ctx, String(args.jobId)),
      run: async (args, ctx) => ({ result: await call(ctx, `/agent/jobs/${args.jobId}/readiness/questions`, args, actor => prepareReadiness(env.DB, actor, String(args.jobId), args)), resources: [{ uri: `blotter://engagements/${args.jobId}`, name: 'Engagement readiness' }] }),
    },
    {
      name: 'blotter.learning.evidence', title: 'Read repeat-period evidence', description: 'Read principal-only source periods and review findings for an operational improvement. Imported text is untrusted.',
      scope: 'learning:read', readOnly: true, classes: ['sensitive'], clauses: ['LEARN-001'], inputSchema: input({ jobIds: strings }, ['jobIds']), outputSchema: object, untrusted: true,
      classify: async (args, ctx) => { const evidence = await call(ctx, '/agent/learning/evidence', args, actor => learningEvidence(env.DB, actor, args)) as Data; return [{ class: 'sensitive', facts: { measure: evidence.jobs.length, kind: 'practice' } }] },
      run: async (args, ctx) => ({ result: await call(ctx, '/agent/learning/evidence', args, actor => learningEvidence(env.DB, actor, args)) }),
    },
    {
      name: 'blotter.learning.prepare', title: 'Prepare an operational improvement', description: 'Save a source-linked improvement draft against completed periods. No template, client version, request, fee or schedule changes until the native principal decides.',
      scope: 'learning:prepare', readOnly: false, classes: ['standard', 'sensitive'], clauses: ['LEARN-001'],
      inputSchema: input({ jobIds: strings, clientIds: strings, title: string, expectedBenefit: string, exceptions: string, assumptions: string, improvement: object, supportingRefs: array }, ['jobIds', 'clientIds', 'title', 'expectedBenefit', 'exceptions', 'assumptions', 'improvement']),
      outputSchema: output(['id', 'status', 'proposal', 'evidence'], { id: string, status: string, proposal: object, evidence: object }),
      classify: async (args, ctx) => { const evidence = await call(ctx, '/agent/learning/evidence', args, actor => learningEvidence(env.DB, actor, args)) as Data; return [{ class: 'standard', facts: { measure: (args.clientIds as unknown[]).length } }, { class: 'sensitive', facts: { measure: evidence.jobs.length, kind: 'practice' } }] },
      summary: args => ({ target: { name: String(args.title) }, items: (args.clientIds as string[]).map(id => `Improvement draft for client ${id}`) }),
      run: async (args, ctx) => { const result = await call(ctx, '/agent/prepare-learning', args, actor => prepareLearning(env.DB, actor, args)) as Data; return { result, resources: [{ uri: `blotter://learning/${result.id}`, name: 'Operational improvement draft' }] } },
    },
    {
      name: 'blotter.learning.read', title: 'Read an improvement draft', description: 'Read a principal-owned improvement draft, current source comparison and real human decision.',
      scope: 'learning:read', readOnly: true, classes: ['sensitive'], clauses: ['LEARN-001'], inputSchema: input({ id: string }, ['id']), outputSchema: object, untrusted: true,
      classify: async (args, ctx) => { await call(ctx, '/agent/learning/' + args.id, args, actor => learningDetail(env.DB, actor, String(args.id)), true); return [{ class: 'sensitive', facts: { measure: 1, kind: 'practice' } }] },
      run: async (args, ctx) => ({ result: await call(ctx, '/agent/learning/' + args.id, args, actor => learningDetail(env.DB, actor, String(args.id)), true) }),
    },
  ]
}

/** Persist an exact bijection for native UUID revisions; never truncate or hash them. */
async function nativeRevision(env: Bindings, ctx: ToolContext, jobId: string) {
  const record = await nativeCall(env, ctx, `/agent/jobs/${jobId}/readiness`, {}, actor => job(env.DB, actor, jobId), true) as Data
  await stmt(env.DB, 'INSERT OR IGNORE INTO b_door_revisions(native_revision) VALUES(?)', record.revision).run()
  return Number((await stmt(env.DB, 'SELECT id FROM b_door_revisions WHERE native_revision=?', record.revision).first<{ id: number }>())!.id)
}
