// The public one-page marketing unsubscribe (MSG-002): no sign-in, fee or extra
// fields. A link token (stored hashed) or a typed address withdraws marketing
// for that address across the whole firm, immediately; engagement notices keep
// arriving. Mailbox providers' one-click POST (RFC 8058) uses the same URL.
import { runtimeBindings, type Bindings } from '../auth.server';
import { firmSettings } from './firm';
import { withdrawStatements } from './marketing-consent';
import { isLanguage, tr, type Language } from '../i18n/catalog';
import { Fault, digest, email, insist, rows, stmt, type Data } from './model';

const escape = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

export async function unsubscribeResponse(request: Request, original: Bindings): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== '/unsubscribe') return null;
  const env = runtimeBindings(original), db = env.DB, token = url.searchParams.get('t') ?? '';
  let done = '', error = '', status = 200;
  try {
    insist(url.origin === env.AUTH_ORIGIN, 'Invalid host', 403);
    insist(['GET', 'POST'].includes(request.method), 'Method not allowed', 405);
    if (request.method === 'POST') {
      insist(Number(request.headers.get('content-length') ?? 0) <= 8000, 'Request too large', 413);
      const raw = await request.arrayBuffer();
      insist(raw.byteLength <= 8000, 'Request too large', 413);
      // Browsers post the page's forms and mailbox providers post one-click (RFC 8058) as urlencoded or multipart form data.
      let form: FormData;
      try { form = await new Response(raw, { headers: { 'content-type': request.headers.get('content-type') ?? '' } }).formData(); }
      catch { throw new Fault('Supply the unsubscribe form'); }
      const oneClick = form.get('List-Unsubscribe') === 'One-Click', typed = form.get('address') ? String(form.get('address')) : '';
      let address: string, source: 'unsubscribe_link' | 'one_click';
      if (typed && !oneClick) { address = email(typed, 'Email address'); source = 'unsubscribe_link'; }
      else {
        const secret = String(form.get('t') || token);
        insist(/^us_[0-9a-f]{64}$/.test(secret), 'This unsubscribe link is not valid; type your email address instead', 404);
        const link = await stmt(db, 'SELECT address FROM b_unsubscribe_tokens WHERE digest=?', await digest(secret)).first<Data>();
        insist(link, 'This unsubscribe link is not valid; type your email address instead', 404);
        address = link.address; source = oneClick ? 'one_click' : 'unsubscribe_link';
      }
      // A marketing reply and an unsubscribe file to the client only when the address belongs to exactly one.
      const clients = await rows(db, 'SELECT DISTINCT client_id FROM b_client_contacts WHERE email=? AND active=1', address);
      await db.batch(withdrawStatements(db, address, source, oneClick ? 'one-click unsubscribe' : 'unsubscribe page', typed && !oneClick ? 'address typed on the unsubscribe page' : 'unsubscribe link', clients.length === 1 ? clients[0].client_id : null));
      if (oneClick) return new Response(null, { status: 200, headers: { 'cache-control': 'no-store' } });
      done = address;
    }
  } catch (e) {
    if (!(e instanceof Fault)) throw e;
    error = e.message; status = e.status;
  }
  // The page language comes from ?lang= (set on Spanish marketing links and carried by this page's forms) or from the
  // emailed link's own recipient. A typed address is never looked up for it: the reply must not reveal whether an address is a contact.
  const wanted = url.searchParams.get('lang'), linked = /^us_[0-9a-f]{64}$/.test(token) ? (await stmt(db, 'SELECT address FROM b_unsubscribe_tokens WHERE digest=?', await digest(token)).first<Data>())?.address : '';
  const language: Language = isLanguage(wanted) ? wanted : linked && await stmt(db, "SELECT 1 FROM b_client_contacts WHERE email=? AND active=1 AND language='es'", linked).first() ? 'es' : 'en';
  const lang = language === 'en' ? '' : `lang=${language}`;
  const T = (key: Parameters<typeof tr>[1], vars: Record<string, string | number> = {}) => tr(language, key, vars);
  if (error === 'This unsubscribe link is not valid; type your email address instead') error = T('unsub.invalid');
  const firm = (await firmSettings(db)).name || T('unsub.thisPractice');
  const page = done
    ? `<p role="status">${escape(T('unsub.done', { address: done, firm }))}</p>`
    : `${token ? `<form action="/unsubscribe?t=${escape(token)}${lang ? '&amp;' + lang : ''}" method="post"><input type="hidden" name="t" value="${escape(token)}"><button type="submit">${escape(T('unsub.button'))}</button></form><p class="muted">${escape(T('unsub.or'))}</p>` : ''}
      <form action="/unsubscribe${lang ? '?' + lang : ''}" method="post"><label class="field">${escape(T('unsub.address'))}<input name="address" type="email" required maxlength="254" autocomplete="email"></label><button type="submit">${escape(T('unsub.addressButton'))}</button></form>`;
  return new Response(`<!doctype html><html lang="${language}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(T('unsub.title'))} · ${escape(firm)}</title><link rel="stylesheet" href="/fonts/fonts.css"><link rel="stylesheet" href="/rer-theme.css"><link rel="stylesheet" href="/app/base.css"></head><body><div class="portal"><main><section class="panel"><h1>${escape(T('unsub.heading'))}</h1>${error ? `<p role="alert">${escape(error)}</p>` : ''}${page}<p class="muted">${escape(T('unsub.footer'))}</p></section></main></div></body></html>`, {
    status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'referrer-policy': 'no-referrer', 'x-content-type-options': 'nosniff', 'x-robots-tag': 'noindex',
      'content-security-policy': "default-src 'none'; style-src 'self'; font-src 'self'; img-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'" },
  });
}
