import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
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
export async function languageJourney(h, { job, client, maria, englishOnly, kbToken, kbId }) {
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
    for (const width of [1440, 390]) {
      await unsubscribe.setViewportSize({ width, height: 1000 });
      assert.equal(await unsubscribe.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      checks[`unsubscribe-${width}`] = await scan(unsubscribe, `Spanish unsubscribe page at ${width}`);
      await unsubscribe.screenshot({ path: `${directory}/unsubscribe-es-${width}.png`, fullPage: true });
    }
    await plain.close();
    // Keyboard only: skip link, then an upload.
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`${h.origin}/portal/${kbToken}`); await page.getByRole('heading', { level: 1, name: /^Documentos para / }).waitFor();
    await page.keyboard.press('Tab'); assert.equal(await page.evaluate(() => document.activeElement?.textContent), 'Saltar a sus documentos');
    await page.keyboard.press('Enter'); assert.equal(await page.evaluate(() => document.activeElement?.id), 'portal-main');
    const upload = page.getByLabel('Elija un archivo para cargar').first();
    await tabTo(page, upload, 'The upload control');
    const chooser = page.waitForEvent('filechooser'); await page.keyboard.press('Space');
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
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      checks[`signature-${width}`] = await scan(page, `Spanish signature form at ${width}`);
      await page.screenshot({ path: `${directory}/signature-form-es-${width}.png`, fullPage: true });
    }
    await tabTo(page, page.getByRole('button', { name: 'Aceptar y firmar el documento' }), 'The sign button'); await page.keyboard.press('Enter');
    const outcome = page.getByRole('status').filter({ hasText: 'Firma registrada.' }), failure = page.getByRole('alert');
    await outcome.or(failure).first().waitFor();
    assert.equal(await failure.count(), 0, `The signature was refused: ${await failure.allTextContents()}`);
    assert.equal((await h.json(`/signatures/${kbId}`, undefined, h.owner)).status, 'completed');
    await page.setViewportSize({ width: 1440, height: 1000 }); await page.screenshot({ path: `${directory}/signature-es-1440.png`, fullPage: true });
    await context.close();
    // The staff doors for contact language, translations, organizer authoring and the pre-send warning.
    const staff = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 1000 } });
    await staff.addCookies(h.owner.split('; ').map(cookie => { const at = cookie.indexOf('='); return { name: cookie.slice(0, at), value: cookie.slice(at + 1), url: h.origin }; }));
    const operator = await staff.newPage(); await operator.goto(h.origin + '/app');
    if (new URL(operator.url()).pathname === '/setup') { await operator.getByRole('checkbox').check(); await operator.getByRole('button', { name: 'Finish setup' }).click(); await operator.waitForURL('**/app'); }
    const capture = async (locator, name) => {
      for (const width of [1440, 390]) {
        await operator.setViewportSize({ width, height: 1000 }); await locator.scrollIntoViewIfNeeded();
        assert.equal(await operator.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${name} ${width} overflows`);
        await locator.screenshot({ path: `${directory}/${name}-${width}.png` });
      }
    };
    await operator.getByRole('navigation', { name: 'Workspace' }).getByRole('button', { name: 'Clients & templates', exact: true }).click();
    const entry = operator.locator('ul.list > li').filter({ hasText: client.name }).first();
    await entry.getByText('Client details and contacts', { exact: true }).click();
    const contact = entry.locator('details').filter({ has: operator.locator('summary').filter({ hasText: maria.name }) }).last();
    await contact.locator('summary').first().click();
    assert.equal(await contact.getByLabel('Language for this contact', { exact: true }).inputValue(), 'es');
    await capture(contact, 'contact-language');
    const messages = operator.locator('section.panel').filter({ has: operator.getByRole('heading', { name: 'Message templates', exact: true }) });
    const untranslated = messages.locator('article.record').filter({ hasText: englishOnly.name });
    await untranslated.getByText('Add the Spanish version of version 1', { exact: true }).click();
    await untranslated.getByLabel(`Spanish subject for ${englishOnly.name}`, { exact: true }).fill('Documentos para {{client_name}}');
    await untranslated.getByLabel(`Spanish message for ${englishOnly.name}`, { exact: true }).fill('Hola {{contact_first_name}}, cargue {{outstanding_requests}} en {{portal_link}}.');
    await capture(messages, 'message-translation');
    const organizers = operator.locator('section.panel').filter({ has: operator.getByRole('heading', { name: 'Organizer versions', exact: true }) });
    await organizers.locator('select').first().selectOption(job.template_id);
    await organizers.getByLabel('Spanish organizer name (optional)', { exact: true }).waitFor();
    await capture(organizers, 'organizer-translation');
    await operator.goto(`${h.origin}/app?job=${job.id}`);
    const composer = operator.locator('details').filter({ has: operator.getByText('Send a reminder with an upload link', { exact: true }) }).first();
    await composer.locator('summary').first().click();
    await composer.getByLabel('Recipient for this entity', { exact: true }).selectOption(maria.id);
    await composer.getByLabel('Template', { exact: true }).selectOption(englishOnly.id);
    await composer.getByRole('alert').filter({ hasText: 'has no Spanish version' }).waitFor();
    await capture(composer, 'missing-translation-warning');
    await staff.close();
    await writeFile(`${directory}/accessibility.json`, JSON.stringify({ checks, violations: 0, keyboardUpload: true, keyboardSignature: true }, null, 2));
    return checks;
  } finally { await browser.close(); }
}
