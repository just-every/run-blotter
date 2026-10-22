// PORTAL-002 HTTP doors: staff manage portal access with their native session; clients
// sign in with an emailed link and a second factor and hold a server-side session cookie.
import type { Context, Hono } from 'hono';
import type { Bindings } from '../auth.server';
import type { Actor, Data } from './model';
import { invitePortal, portalAccess, readPortalPolicy, resetPortalFactor, revokePortal, setPortalPolicy } from './portal-accounts';
import { brandingLogo, portalBranding, setPortalBranding } from './portal-branding';
import { clientBillPdf, clientEntity, clientFile, clientSignedPdf, savePreferences } from './portal-home';
import { acceptInvitation, clientMe, clientSession, confirmFactor, confirmSignIn, requestSignIn, sameSite, signOut, startFactor, verifyFactor, type Client } from './portal-session';

type C = Context<{ Bindings: Bindings }>;
type Doors = { as: (fn: (a: Actor, c: C) => Promise<unknown>) => (c: C) => Promise<Response>; body: (c: C) => Promise<Data>; db: (c: C) => D1Database; param: (c: C, key?: string) => string };
const P = '/api/blotter';

export function portalAccountRoutes(api: Hono<{ Bindings: Bindings }>, { as, body, db, param }: Doors) {
  api.get(`${P}/clients/:id/portal-access`, as((a, c) => portalAccess(db(c), a, param(c))));
  api.post(`${P}/clients/:id/contacts/:contact/portal-invite`, as((a, c) => invitePortal(c.env, a, param(c), param(c, 'contact'))));
  api.post(`${P}/clients/:id/contacts/:contact/portal-revoke`, as(async (a, c) => revokePortal(db(c), a, param(c), param(c, 'contact'), await body(c))));
  api.post(`${P}/portal-accounts/:id/reset`, as(async (a, c) => resetPortalFactor(db(c), a, param(c), await body(c))));
  api.get(`${P}/portal-policy`, as((a, c) => readPortalPolicy(db(c), a)));
  api.post(`${P}/portal-policy`, as(async (a, c) => setPortalPolicy(db(c), a, await body(c))));
  api.post(`${P}/portal-branding`, as(async (a, c) => setPortalBranding(db(c), a, await body(c))));
  // The firm's portal logo and accent are meant for clients, so the sign-in page reads them before any session.
  api.get(`${P}/client/branding`, async c => { sameSite(c.req.raw, c.env); return c.json(await portalBranding(db(c))); });
  api.get(`${P}/client/branding/logo`, async c => { sameSite(c.req.raw, c.env); return brandingLogo(db(c)); });

  const withCookie = (c: C, result: { cookie: string; body: Data }) => c.json(result.body, 200, { 'set-cookie': result.cookie, 'cache-control': 'no-store' });
  // `open` doors serve a session still owing its second factor; every other client door needs the full check.
  const client = (fn: (x: Client, c: C) => Promise<unknown>, open = false) => async (c: C) => {
    const result = await fn(await clientSession(c.req.raw, c.env, open), c);
    return result instanceof Response ? result : c.json(result, 200, { 'cache-control': 'no-store' });
  };
  api.post(`${P}/client/sign-in`, async c => { sameSite(c.req.raw, c.env); return c.json(requestSignIn(c.env, await body(c), work => c.executionCtx.waitUntil(work)), 202); });
  api.post(`${P}/client/sign-in/confirm`, async c => { sameSite(c.req.raw, c.env); return withCookie(c, await confirmSignIn(c.env, await body(c))); });
  api.post(`${P}/client/accept`, async c => { sameSite(c.req.raw, c.env); return withCookie(c, await acceptInvitation(c.env, await body(c))); });
  api.post(`${P}/client/sign-out`, async c => withCookie(c, await signOut(c.env, await clientSession(c.req.raw, c.env, true))));
  api.get(`${P}/client/me`, client((x, c) => clientMe(db(c), x), true));
  api.post(`${P}/client/factor/start`, client((x, c) => startFactor(c.env, x), true));
  api.post(`${P}/client/factor/confirm`, client(async (x, c) => confirmFactor(c.env, x, await body(c)), true));
  api.post(`${P}/client/verify`, client(async (x, c) => verifyFactor(c.env, x, await body(c)), true));
  api.get(`${P}/client/entities/:id`, client((x, c) => clientEntity(db(c), x, param(c))));
  api.get(`${P}/client/entities/:id/files/:ref`, client((x, c) => clientFile(db(c), x, param(c), param(c, 'ref'))));
  api.get(`${P}/client/entities/:id/signatures/:request/pdf`, client((x, c) => clientSignedPdf(db(c), x, param(c), param(c, 'request'))));
  api.get(`${P}/client/entities/:id/bills/:invoice/pdf`, client((x, c) => clientBillPdf(db(c), x, param(c), param(c, 'invoice'))));
  api.post(`${P}/client/entities/:id/preferences`, client(async (x, c) => savePreferences(c.env, x, param(c), await body(c))));
}
