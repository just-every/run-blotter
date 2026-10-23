import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { scan } from './language-ui.mjs';

/**
 * PORTAL-002 browser proof at 1440 and 390: the sign-in page and a signed-in client's entity
 * view pass the WCAG 2.2 AA scan without overflow, and staff see each contact's portal access.
 */
export async function portalAccountJourney(h, { clientCookie, clientId, locked = false }) {
  const directory = process.env.BLOTTER_PORTAL_EVIDENCE;
  if (!directory) return;
  await mkdir(directory, { recursive: true });
  const browser = await chromium.launch({ headless: true, args: ['--use-mock-keychain', '--password-store=basic'] });
  const capture = async (page, locator, name) => {
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 }); await locator.scrollIntoViewIfNeeded();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${name} ${width} overflows`);
      await recordScan(page, `${name}-${width}`, directory); await locator.screenshot({ path: `${directory}/${name}-${width}.png` });
    }
  };
  try {
    const visitor = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 1000 } }), signIn = await visitor.newPage();
    await signIn.goto(`${h.origin}/client`); await signIn.getByRole('button', { name: 'Email me a sign-in link' }).waitFor();
    await capture(signIn, signIn.locator('main'), 'client-sign-in'); await visitor.close();
    const client = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 1000 } });
    const [name, value] = clientCookie.split('='); await client.addCookies([{ name, value, url: h.origin, httpOnly: true, secure: true, sameSite: 'Strict' }]);
    const page = await client.newPage(); await page.goto(`${h.origin}/client`);
    await page.getByRole('heading', { name: 'Shared documents' }).waitFor();
    await page.getByRole('combobox', { name: 'Showing' }).selectOption(clientId);
    if (locked) await page.getByText('cedar.pdf: locked until paid', { exact: true }).waitFor();
    else await page.getByRole('link', { name: /^Download cedar\.pdf$/ }).waitFor();
    await capture(page, page.locator('main'), locked ? 'client-entity-locked' : 'client-entity'); await client.close();
    const staff = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 1000 } });
    await h.stepUp(h.owner);
    await staff.addCookies(h.owner.split('; ').map(cookie => { const at = cookie.indexOf('='); return { name: cookie.slice(0, at), value: cookie.slice(at + 1), url: h.origin }; }));
    const app = await staff.newPage(); await app.goto(h.origin + '/app');
    if (new URL(app.url()).pathname === '/setup') { await app.getByRole('checkbox').check(); await app.getByRole('button', { name: 'Finish setup' }).click(); await app.waitForURL('**/app'); }
    await app.getByRole('navigation', { name: 'Workspace' }).getByRole('button', { name: 'Clients & templates', exact: true }).click();
    const entry = app.locator('ul.list > li').filter({ hasText: 'Cedar Lane LLC' }).first();
    await entry.getByText('Client details and contacts', { exact: true }).click();
    await entry.getByText('Client portal access', { exact: true }).click();
    const panel = entry.locator('details').filter({ has: app.getByText('Client portal access', { exact: true }) }).last();
    await panel.getByRole('button', { name: /^(Send a new invitation|Invite to the client portal)$/ }).first().waitFor();
    for (const width of [1440, 390]) { await app.setViewportSize({ width, height: 1000 }); await panel.scrollIntoViewIfNeeded(); assert.equal(await app.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `portal access ${width} overflows`); await panel.screenshot({ path: `${directory}/staff-portal-access-${width}.png` }); }
    await staff.close();
  } finally { await browser.close(); }
}

// PORTAL-005 inherits the newly shipped account sign-in, factor and entity doors.
async function recordScan(page, name, directory) {
  const passed = await scan(page, name);
  if (directory) {
    await mkdir(directory, { recursive: true });
    const path = `${directory}/account-accessibility.json`;
    const receipt = await readFile(path, 'utf8').then(JSON.parse).catch(() => ({ checks: {}, violations: 0 }));
    receipt.checks[name] = passed; await writeFile(path, JSON.stringify(receipt, null, 2));
  }
}
async function spanishCapture(page, name) {
  const directory = process.env.BLOTTER_PORTAL_EVIDENCE;
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.equal(await page.locator('html').getAttribute('lang'), 'es');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${name} ${width} overflows`);
    await recordScan(page, `${name}-${width}`, directory);
    if (directory) await page.locator('main').screenshot({ path: `${directory}/${name}-${width}.png`, mask: [page.locator('code'), page.locator('a[href^="otpauth:"]')] });
  }
}
const clientContext = async (browser, origin, cookie) => {
  const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 1000 } });
  const [name, value] = cookie.split('='); await context.addCookies([{ name, value, url: origin, httpOnly: true, secure: true, sameSite: 'Strict' }]); return context;
};
/** The synthetic Spanish contact enrolls through the real UI; no profile, session or setup key is saved as evidence. */
export async function spanishAccountEnrollment(h, { clientCookie, inviteUrl, code }) {
  const browser = await chromium.launch({ headless: true, args: ['--use-mock-keychain', '--password-store=basic'] });
  try {
    const visitor = await browser.newContext({ ignoreHTTPSErrors: true }), invitation = await visitor.newPage();
    await invitation.goto(inviteUrl); await invitation.getByRole('button', { name: 'Aceptar la invitación', exact: true }).waitFor();
    assert.equal(new URL(invitation.url()).search, '', 'The bearer leaves the address bar');
    await spanishCapture(invitation, 'client-invitation-es'); await visitor.close();
    const context = await clientContext(browser, h.origin, clientCookie), page = await context.newPage();
    await page.goto(`${h.origin}/client`); await page.getByRole('heading', { name: 'Configure su aplicación de autenticación' }).waitFor();
    await page.getByRole('button', { name: 'Mostrar mi clave de configuración' }).click();
    const key = page.locator('section[aria-labelledby="enroll"] code'); await key.waitFor(); const secret = await key.textContent();
    await spanishCapture(page, 'client-enrollment-es');
    const correct = code(secret), wrong = String((Number(correct) + 1) % 1000000).padStart(6, '0');
    await page.getByLabel('Código de 6 dígitos', { exact: true }).fill(wrong); await page.getByRole('button', { name: 'Confirmar', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'Ese código no es correcto' }).waitFor();
    await spanishCapture(page, 'client-code-error-es');
    await page.getByLabel('Código de 6 dígitos', { exact: true }).fill(correct); await page.getByRole('button', { name: 'Confirmar', exact: true }).click();
    const codes = page.locator('section[aria-labelledby="codes"]'); await codes.waitFor(); assert.equal(await codes.locator('code').count(), 10);
    await spanishCapture(page, 'client-recovery-codes-es');
    await page.getByRole('button', { name: 'Ya los guardé', exact: true }).click(); await page.getByRole('heading', { name: 'Documentos compartidos' }).waitFor();
    assert.equal(await page.getByText('Cedar Lane LLC', { exact: true }).count(), 0, 'The Spanish contact sees only its own entity');
    await spanishCapture(page, 'client-entity-es'); await context.close();
  } finally { await browser.close(); }
}
export async function spanishAccountVerification(h, cookie) {
  const browser = await chromium.launch({ headless: true, args: ['--use-mock-keychain', '--password-store=basic'] });
  try {
    const context = await clientContext(browser, h.origin, cookie), page = await context.newPage();
    await page.goto(`${h.origin}/client`); await page.getByRole('heading', { name: 'Escriba el código de su aplicación de autenticación' }).waitFor();
    await spanishCapture(page, 'client-factor-verification-es');
    await page.getByRole('button', { name: '¿Perdió su autenticador? Use un código de recuperación', exact: true }).click();
    await page.getByLabel('Código de recuperación', { exact: true }).waitFor(); await spanishCapture(page, 'client-factor-recovery-es'); await context.close();
  } finally { await browser.close(); }
}
