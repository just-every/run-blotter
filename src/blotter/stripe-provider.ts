import type { Bindings } from '../auth.server';
import { Fault, insist, type Data } from './model';

export const STRIPE_VERSION = '2026-09-30.endive';
/** Every call uses the same API contract and an explicit idempotency key for writes. */
export async function stripe(env: Bindings, path: string, input?: Record<string, string>, key?: string): Promise<Data> {
  insist(env.STRIPE_SECRET_KEY, 'Stripe is not configured. The principal must connect the merchant account.', 409);
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: input === undefined ? 'GET' : 'POST',
    headers: { authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, 'Stripe-Version': STRIPE_VERSION,
      ...(input === undefined ? {} : { 'content-type': 'application/x-www-form-urlencoded' }), ...(key ? { 'Idempotency-Key': key } : {}) },
    ...(input === undefined ? {} : { body: new URLSearchParams(input) }), signal: AbortSignal.timeout(20_000),
  });
  const result = await response.json() as Data;
  if (!response.ok) throw new Fault('Stripe refused the request. Inspect the payment outcome before trying again.', 409,
    { providerCode: result.error?.code ?? result.error?.type ?? 'provider_refused', paymentIntent: result.error?.payment_intent?.id ?? null });
  return result;
}

/** Verify the exact wire body, with a five-minute timestamp bound and all rotated v1 signatures. */
export async function verifyStripe(env: Bindings, raw: string, header: string | undefined) {
  insist(env.STRIPE_WEBHOOK_SECRET, 'Stripe events are not configured', 503);
  const parts = (header ?? '').split(',').map(p => p.split('=')), timestamp = parts.find(p => p[0] === 't')?.[1];
  insist(timestamp && /^\d+$/.test(timestamp) && Math.abs(Date.now() / 1000 - Number(timestamp)) <= 300, 'Invalid Stripe signature', 401);
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.STRIPE_WEBHOOK_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  for (const [, signature] of parts.filter(p => p[0] === 'v1')) {
    if (!/^[0-9a-f]{64}$/.test(signature)) continue;
    const bytes = Uint8Array.from(signature.match(/../g)!, x => parseInt(x, 16));
    if (await crypto.subtle.verify('HMAC', key, bytes, new TextEncoder().encode(`${timestamp}.${raw}`))) return;
  }
  insist(false, 'Invalid Stripe signature', 401);
}
