import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { chromium } from '@playwright/test';

const axeSource = async () => readFile(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');
const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

/** An automated WCAG 2.2 AA scan of the page as it stands; any violation fails with its rule, target and message. */
async function scan(page, name) {
  await page.addScriptTag({ content: await axeSource() });
  const result = await page.evaluate(tags => globalThis.axe.run(document, { runOnly: { type: 'tag', values: tags } }), WCAG);
  assert.deepEqual(result.violations.map(v => `${v.id}: ${v.nodes.map(n => n.target.join(' ')).join(', ')} (${v.help})`), [], `${name}: WCAG 2.2 AA violations`);
  return result.passes.length;
}
/** Press Tab until the located element has focus, with a visible focus indicator (WCAG 2.4.7); fail rather than click. */
async function tabTo(page, locator, name) {
  const element = await locator.elementHandle();
  for (let n = 0; n < 120; n++) {
    await page.keyboard.press('Tab');
    if (await element.evaluate(e => e === document.activeElement)) {
      const indicator = await element.evaluate(e => { const s = getComputedStyle(e); return (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) || s.boxShadow !== 'none'; });
      assert.ok(indicator, `${name} has a visible keyboard focus indicator`);
      return;
    }
  }
  assert.fail(`${name} cannot be reached with the keyboard`);
}

/**
 * PORTAL-005 browser proof at 1440 and 390: the Spanish client page passes an automated WCAG 2.2 AA scan, and an upload and a
 * signature are completed with the keyboard alone (the OS file chooser is the only step that is not a key press).
 */
export async function languageJourney(h, { job, kbToken, kbId }) {
  const directory = process.env.BLOTTER_LANGUAGE_EVIDENCE;
  if (!directory) return;
  await mkdir(directory, { recursive: true });
  const browser = await chromium.launch({ headless: true, args: ['--use-mock-keychain', '--password-store=basic'] });
  try {
    const context = await browser.newContext({ ignoreHTTPSErrors: true, locale: 'en-US', viewport: { width: 1440, height: 1000 } }), page = await context.newPage();
    await page.goto(`${h.origin}/portal/${kbToken}`);
    await page.getByRole('heading', { level: 1, name: /^Documentos para / }).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.lang), 'es');
    const checks = {};
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `portal ${width} overflows`);
      checks[width] = await scan(page, `Spanish portal at ${width}`);
      await page.screenshot({ path: `${directory}/portal-es-${width}.png`, fullPage: true });
    }
    // The unsubscribe page's strict CSP blocks an injected scanner, so this one page is scanned in a context that bypasses CSP.
    const plain = await browser.newContext({ ignoreHTTPSErrors: true, bypassCSP: true, viewport: { width: 1440, height: 1000 } }), unsubscribe = await plain.newPage(); await unsubscribe.goto(`${h.origin}/unsubscribe?lang=es`);
    await unsubscribe.getByRole('heading', { name: 'Cancelar el correo de mercadeo' }).waitFor();
    await scan(unsubscribe, 'Spanish unsubscribe page'); await unsubscribe.screenshot({ path: `${directory}/unsubscribe-es-1440.png`, fullPage: true }); await plain.close();
    // Keyboard only: skip link, then an upload.
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`${h.origin}/portal/${kbToken}`); await page.getByRole('heading', { level: 1, name: /^Documentos para / }).waitFor();
    await page.keyboard.press('Tab'); assert.equal(await page.evaluate(() => document.activeElement?.textContent), 'Saltar a sus documentos');
    await page.keyboard.press('Enter'); assert.equal(await page.evaluate(() => document.activeElement?.id), 'portal-main');
    const upload = page.getByLabel('Elija un archivo para cargar').first();
    await tabTo(page, upload, 'The upload control');
    const chooser = page.waitForEvent('filechooser'); await page.keyboard.press('Enter');
    await (await chooser).setFiles({ name: 'estado-de-cuenta.txt', mimeType: 'text/plain', buffer: Buffer.from('Estado de cuenta bancario') });
    await page.getByRole('status').filter({ hasText: 'Se cargó estado-de-cuenta.txt. Gracias.' }).waitFor();
    // Keyboard only: open the signature request, enter each field, consent and sign.
    await tabTo(page, page.getByRole('button', { name: 'Carta de firma por teclado' }), 'The signature request'); await page.keyboard.press('Enter');
    await page.getByRole('heading', { level: 3, name: 'Carta de firma por teclado' }).waitFor();
    const fields = [['signature (página 1)', 'María Gómez'], ['initials (página 1)', 'MG'], ['date (página 1)', '2026-10-10'], ['text (página 1)', 'Revisado']];
    for (const [label, value] of fields) {
      const control = page.getByLabel(label); await tabTo(page, control, label);
      // The same digits fill day-first and month-first date controls.
      if (label.startsWith('date')) { await page.keyboard.type('10102026'); } else await page.keyboard.type(value);
    }
    for (const label of ['Acepto los registros y las firmas electrónicas para este documento.', 'Estoy autorizado/a por este cliente y tengo la intención de firmar este documento.']) { await tabTo(page, page.getByLabel(label), label); await page.keyboard.press('Space'); }
    await page.setViewportSize({ width: 390, height: 1000 });
    await scan(page, 'Spanish portal with the signature form open at 390'); await page.screenshot({ path: `${directory}/signature-es-390.png`, fullPage: true });
    await tabTo(page, page.getByRole('button', { name: 'Aceptar y firmar el documento' }), 'The sign button'); await page.keyboard.press('Enter');
    const outcome = page.getByRole('status').filter({ hasText: 'Firma registrada.' }), failure = page.getByRole('alert');
    await outcome.or(failure).first().waitFor();
    assert.equal(await failure.count(), 0, `The signature was refused: ${await failure.allTextContents()}`);
    assert.equal((await h.json(`/signatures/${kbId}`, undefined, h.owner)).status, 'completed');
    await page.setViewportSize({ width: 1440, height: 1000 }); await page.screenshot({ path: `${directory}/signature-es-1440.png`, fullPage: true });
    await context.close();
    return checks;
  } finally { await browser.close(); }
}
