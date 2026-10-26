import { runFollowups } from './blotter/followups'
import { runAgentRules } from './blotter/scheduled-agents'
import { runInvoiceSchedules } from './blotter/invoices-retainers'
import { runInvoiceReminders } from './blotter/invoices-collections'
import { runAuthorizationAlerts } from './blotter/authorizations'
import { runReports } from './blotter/report-schedules'
import { runAutomation } from './blotter/automation-runner'
import { purgeDocumentUploads } from './blotter/document-packets'
import { withDemo } from './modules/demo/index.mjs'
import { rejectedResponse } from './base/rejected-response'
import start from '@tanstack/react-start/server-entry'
import { api } from './blotter/api'
import { dispatch } from './base/dispatch'
import { staticAssetResponse } from './base/static-assets'
import { lobbyResponse } from './base/lobby'
import { setupStateResponse } from './base/setup-state'
import { authResponse, runtimeBindings, type Bindings } from './auth.server'
import { identity } from './identity'
import { seedDemo } from './demo'
import { intakeResponse } from './blotter/intake-page'
import { unsubscribeResponse } from './blotter/unsubscribe-page'
import { runBulk } from './blotter/bulk-messages'
import { clearIntakeChecks } from './blotter/intake'
import { refreshNotifications } from './blotter/notifications'
import { runIntegrationWebhooks } from './blotter/integration-webhooks'
import { runRules } from './blotter/recurrence'


// Start documents keep their own cache policy and add no-transform, so no proxy
// rewrites the HTML React hydrates (Cloudflare's email address obfuscation
// honours it; src/base/hydration/README.md).
function noTransform(response: Response): Response {
  const headers = new Headers(response.headers), policy = headers.get('cache-control')
  headers.set('cache-control', policy ? `${policy}, no-transform` : 'no-transform')
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers })
}

export default withDemo<Bindings, ExportedHandler<Bindings>>({
  async fetch(request, env, execution) {
    const asset = await staticAssetResponse(request, env)
    if (asset) return asset
    const intake = await intakeResponse(request, env)
    if (intake) return rejectedResponse(request, intake)
    const unsubscribe = await unsubscribeResponse(request, env)
    if (unsubscribe) return rejectedResponse(request, unsubscribe)
    const auth = await authResponse(request, env)
    if (auth) return auth
    // The installed variant: the Lobby at / and the public claim state it reads.
    // Local dev serves the saved origin's data at its own port (RER_DEV_ORIGIN).
    const state = await setupStateResponse(request, runtimeBindings(env))
    if (state) return state
    const lobby = await lobbyResponse(request, runtimeBindings(env), identity)
    if (lobby) return lobby
    return rejectedResponse(request, await dispatch(request, () => api.fetch(request, env, execution), async () => noTransform(await start.fetch(request))))
  },
  // The hourly Cron Trigger creates recurring work (WORK-002).
  async scheduled(controller, env) {
    await clearIntakeChecks(env.DB)
    await purgeDocumentUploads(env.DB,new Date(controller.scheduledTime).toISOString())
    await runInvoiceSchedules(env,new Date(controller.scheduledTime))
    await runInvoiceReminders(env,new Date(controller.scheduledTime))
    await runAuthorizationAlerts(env.DB,new Date(controller.scheduledTime))
    await runRules(env, new Date(controller.scheduledTime), 'cron')
    await runIntegrationWebhooks(env)
    await runAutomation(env, new Date(controller.scheduledTime))
    await runFollowups(env, new Date(controller.scheduledTime))
    await runAgentRules(env, new Date(controller.scheduledTime))
    await runReports(env, new Date(controller.scheduledTime))
    await runBulk(env, new Date(controller.scheduledTime))
    await refreshNotifications(env, new Date(controller.scheduledTime), true)
  },
} satisfies ExportedHandler<Bindings>, { seed: seedDemo })
