import type { MailSender } from './modules/operator-auth/index.mjs'
import type { Bindings } from './auth.server'
export function operatorMail(env: Bindings): MailSender | undefined
export function verifyMailWebhook(input: { provider: 'resend' | 'sendgrid'; rawBody: Uint8Array; headers: Headers; key: string; now: number }): Promise<boolean>
