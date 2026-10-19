// The embeddable public inquiry page uses the practice's existing form styles.
import { runtimeBindings, type Bindings } from '../auth.server';
import { Fault, insist } from './model';
import { intakeToken, submitIntake } from './intake';

const escape = (s: string) => s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const CONSENT = 'Your details go only to this practice to reply to this inquiry.';
export async function intakeResponse(request: Request, original: Bindings): Promise<Response | null> {
  if (new URL(request.url).pathname !== '/intake') return null;
  const env = runtimeBindings(original);
  let error = '', received = false, status = 200;
  try {
    insist(new URL(request.url).origin === env.AUTH_ORIGIN, 'Invalid host', 403);
    insist(['GET', 'POST'].includes(request.method), 'Method not allowed', 405);
    if (request.method === 'POST') {
      insist(Number(request.headers.get('content-length') ?? 0) <= 4_300_000, 'Submission too large', 413);
      const reader = request.body?.getReader();
      insist(reader, 'Supply the inquiry form');
      const chunks: Uint8Array[] = []; let size = 0;
      for (;;) { const part = await reader.read(); if (part.done) break; size += part.value.length; if (size > 4_300_000) { await reader.cancel(); insist(false, 'Submission too large', 413); } chunks.push(part.value); }
      const bytes = new Uint8Array(size); let offset = 0; for (const part of chunks) { bytes.set(part, offset); offset += part.length; }
      let form: FormData;
      try { form = await new Response(bytes, { headers: { 'content-type': request.headers.get('content-type') ?? '' } }).formData(); }
      catch { insist(false, 'Supply a valid inquiry form'); }
      const uploads = [];
      for (const f of form.getAll('uploads')) if (f instanceof File && f.size) {
        insist(f.size <= 1_048_576, 'Each file must be at most 1 MiB');
        const bytes = new Uint8Array(await f.arrayBuffer());
        let binary = ''; for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
        uploads.push({ name: f.name, mime: f.type, contentBase64: btoa(binary) });
      }
      await submitIntake(env, request, { ...Object.fromEntries(form), consent: form.get('consent') === 'yes', turnstileToken: form.get('cf-turnstile-response'), uploads });
      received = true;
    }
  } catch (e) {
    if (!(e instanceof Fault)) throw e;
    error = e.message; status = e.status;
  }
  const field = (label: string, name: string, type = 'text') => `<label class="field">${label}<input name="${name}" type="${type}" required maxlength="200"></label>`;
  const token = received ? '' : await intakeToken(env.SESSION_SECRET);
  const turnstile = !!(env.TURNSTILE_SITE_KEY && env.TURNSTILE_SECRET_KEY);
  const form = `<form action="/intake" method="post" enctype="multipart/form-data">
    <input type="hidden" name="token" value="${escape(token)}">
    ${field('Business or individual name', 'name')}${field('Contact name', 'contactName')}${field('Contact email', 'contactEmail', 'email')}
    <label class="field">How did you hear about us?<input name="source" maxlength="120" value="Website intake"></label>
    <label class="field">Requested services (comma separated)<input name="services" required maxlength="1000" placeholder="Monthly bookkeeping, annual tax return"></label>
    <label class="field">Estimated annual budget (optional)<input name="feeBand" maxlength="120" placeholder="For example, USD 5,000–10,000"></label>
    <label class="field">Tell us about your inquiry<textarea name="details" maxlength="4000" rows="4"></textarea></label>
    <label class="field">Attachments (up to 3 files, 1 MiB each)<input name="uploads" type="file" multiple></label>
    <div hidden aria-hidden="true"><label>Leave this blank<input name="website" tabindex="-1" autocomplete="off"></label></div>
    <label class="field"><span><input name="consent" type="checkbox" value="yes" required> ${CONSENT}</span></label>
    <p class="muted">Spam checks: please take at least 3 seconds. This form expires after 24 hours. Up to 5 inquiries per hour from your connection.</p>
    ${turnstile ? `<div class="cf-turnstile" data-sitekey="${escape(env.TURNSTILE_SITE_KEY!)}"></div><script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>` : ''}
    <button type="submit">Send inquiry</button></form>`;
  return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Practice inquiry · Blotter</title><link rel="stylesheet" href="/rer-theme.css"><link rel="stylesheet" href="/blotter.css"></head><body><div class="portal"><main><section class="panel"><h1>Practice inquiry</h1>${error ? `<p role="alert">${escape(error)}</p>` : ''}${received ? '<p role="status">Your inquiry has been received. The practice will contact you about your requested services.</p>' : form}</section></main></div></body></html>`, {
    status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'referrer-policy': 'same-origin', 'x-content-type-options': 'nosniff', 'x-robots-tag': 'noindex',
      'content-security-policy': "default-src 'none'; style-src 'self'; font-src 'self'; img-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors *" + (turnstile ? "; script-src https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; connect-src 'self' https://challenges.cloudflare.com" : '') },
  });
}
