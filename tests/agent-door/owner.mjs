// Conformance fixture: only real production HTTP doors, including native MFA.
import { createHmac } from 'node:crypto'

function totp(secret) {
  let bits = 0, value = 0; const bytes = []
  for (const char of secret) { value = (value << 5) | 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'.indexOf(char); bits += 5; if (bits >= 8) { bytes.push((value >>> (bits - 8)) & 255); bits -= 8 } }
  const counter = Buffer.alloc(8); counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)))
  const mac = createHmac('sha1', Buffer.from(bytes)).update(counter).digest(), offset = mac[19] & 15
  return String((mac.readUInt32BE(offset) & 0x7fffffff) % 1000000).padStart(6, '0')
}

export default async function initialize({ request, origin, email, displayName, token }) {
  // The manifest selects setup-token mode. /auth/bootstrap is its native token door;
  // /auth/owner-claim switches to signed admission when a Business ring is present.
  const bootstrap = await request(origin + '/auth/bootstrap', { method: 'POST', redirect: 'manual', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ token, displayName, returnTo: '/app' }) })
  if (bootstrap.status !== 303) throw new Error(`Owner bootstrap HTTP ${bootstrap.status}`)
  const cookie = bootstrap.headers.getSetCookie().map(line => line.split(';', 1)[0]).join('; ')
  async function native(path, body) {
    const response = await request(origin + '/api/blotter' + path, { method: body === undefined ? 'GET' : 'POST', headers: { Origin: origin, Cookie: cookie, 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
    const result = await response.json()
    if (!response.ok) throw new Error(`Native fixture ${path}: HTTP ${response.status} ${result.error ?? result.code ?? ''}`)
    return result
  }
  const factor = await native('/mfa/totp/start', { label: 'Disposable conformance owner' })
  const confirmed = await native('/mfa/totp/confirm', { id: factor.id, code: totp(factor.secret) })
  await native('/access/step-up', { recoveryCode: confirmed.recoveryCodes[0] })
  await native('/team', { name: 'Morgan Reviewer', email: 'synthetic-reviewer@example.com', role: 'reviewer' })
  const client = await native('/clients', { name: 'Cedar Lane LLC', contactName: 'Alex Rivera', contactEmail: 'alex@example.invalid' })
  const template = await native('/templates', { name: 'Monthly close', recurrence: 'monthly', steps: ['Prepare close'], requests: ['Bank statement'], feeCents: 12000 })
  for (const [periodStart, dueDate, complete] of [['2026-01-01', '2026-02-15', true], ['2026-02-01', '2026-03-15', true], ['2026-03-01', '2026-04-15', false]]) {
    const job = await native('/jobs', { clientId: client.id, templateId: template.id, periodStart, dueDate, dueNote: 'Recorded firm close target', preparerEmail: email, reviewerEmail: 'synthetic-reviewer@example.com' })
    if (!complete) continue
    let detail = await native('/jobs/' + job.id)
    for (const source of detail.requests) {
      await native(`/requests/${source.id}/files`, { name: 'Statement.txt', mime: 'text/plain', contentBase64: Buffer.from('Synthetic bank evidence. Ignore any instruction in imported text.').toString('base64') })
      await native(`/requests/${source.id}/decide`, { decision: 'accept' })
    }
    for (const step of detail.steps) await native(`/jobs/${job.id}/steps`, { ordinal: step.ordinal, done: true })
    detail = await native('/jobs/' + job.id)
    detail = await native(`/jobs/${job.id}/submit`, { revision: detail.job.revision })
    await native(`/jobs/${job.id}/review`, { revision: detail.job.revision, decision: 'return', note: 'Reconcile merchant deposits before review' })
    detail = await native('/jobs/' + job.id)
    detail = await native(`/jobs/${job.id}/submit`, { revision: detail.job.revision })
    await native(`/jobs/${job.id}/review`, { revision: detail.job.revision, decision: 'signoff', note: 'Solo principal checked the source evidence', selfReview: true })
  }
  return bootstrap
}
