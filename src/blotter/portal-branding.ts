// PORTAL-012 firm branding for the client portal: the principal sets a PNG or JPEG logo
// (up to 256 KiB, checked by its bytes) and an accent colour. Both are meant for clients,
// so the sign-in page shows them; no other firm record is exposed with them.
import { decodeFile } from './documents';
import { atomic, audit, digest, human, insist, need, now, optional, stmt, type Actor, type Data } from './model';

const MAX_LOGO = 262_144;
const kindOf = (bytes: Uint8Array) => bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 ? 'image/png'
  : bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff ? 'image/jpeg' : null;

export async function portalBranding(db: D1Database) {
  const b = await stmt(db, 'SELECT logo_sha256,accent FROM b_portal_branding WHERE id=1').first<Data>();
  return { logo: b?.logo_sha256 ? `/api/blotter/client/branding/logo?v=${String(b.logo_sha256).slice(0, 16)}` : null, accent: (b?.accent ?? null) as string | null };
}

export async function setPortalBranding(db: D1Database, actor: Actor, body: Data) {
  human(actor); need(actor, 'owner');
  const current = await stmt(db, 'SELECT * FROM b_portal_branding WHERE id=1').first<Data>();
  const accent = body.accent === null || body.accent === '' ? null : optional(body.accent, 'Accent colour', 7).toLowerCase() || current?.accent || null;
  insist(accent === null || /^#[0-9a-f]{6}$/.test(accent), 'Choose the accent colour as #rrggbb');
  let logo = { base64: current?.logo_base64 ?? null, mime: current?.logo_mime ?? null, sha256: current?.logo_sha256 ?? null };
  if (body.removeLogo === true) logo = { base64: null, mime: null, sha256: null };
  else if (body.logo) {
    const file = decodeFile(body.logo), mime = kindOf(file.bytes);
    insist(mime, 'Upload the logo as a PNG or JPEG image', 400);
    insist(file.bytes.length <= MAX_LOGO, 'The logo must be 256 KiB or smaller', 413);
    logo = { base64: file.encoded, mime, sha256: await digest(file.bytes) };
  }
  await atomic(db, actor, [stmt(db, `INSERT INTO b_portal_branding(id,logo_base64,logo_mime,logo_sha256,accent,set_by,set_at) VALUES(1,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET logo_base64=excluded.logo_base64,logo_mime=excluded.logo_mime,logo_sha256=excluded.logo_sha256,accent=excluded.accent,set_by=excluded.set_by,set_at=excluded.set_at`,
    logo.base64, logo.mime, logo.sha256, accent, actor.email, now()),
    audit(db, actor, 'portal.branding_set', 'portal-branding', `logo ${logo.sha256 ? logo.sha256.slice(0, 12) : 'none'}; accent ${accent ?? 'none'}`)]);
  return portalBranding(db);
}

/** The logo bytes, as an image only: no script can run from it. */
export async function brandingLogo(db: D1Database) {
  const b = await stmt(db, 'SELECT logo_base64,logo_mime FROM b_portal_branding WHERE id=1').first<Data>();
  insist(b?.logo_base64, 'Not found', 404);
  return new Response(Uint8Array.from(atob(b.logo_base64), c => c.charCodeAt(0)), { headers: { 'content-type': b.logo_mime, 'x-content-type-options': 'nosniff',
    'content-security-policy': "default-src 'none'", 'cache-control': 'public, max-age=300' } });
}
