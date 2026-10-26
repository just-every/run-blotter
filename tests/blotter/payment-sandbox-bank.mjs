import assert from 'node:assert/strict';

const pause = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

async function visible(page, selector) {
  for (const frame of page.frames().toReversed()) {
    for (const locator of await selector(frame).all()) {
      if (await locator.isVisible()) return locator;
    }
  }
}

/** Enter Stripe's published test account through its hosted manual bank form. */
export async function sandboxBank(page, account, returnOrigin) {
  await page.waitForURL('https://checkout.stripe.com/**', { timeout: 60_000 });
  await page.locator('#email').fill('synthetic-blotter@example.com');
  const name = page.locator('#billingName');
  if (await name.isVisible()) await name.fill('Synthetic Blotter');
  await page.getByText('US bank account', { exact: true }).filter({ visible: true }).first().click({ force: true });
  let entered = false, submitted = false, manualOpened = false, lastAction;
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    if (new URL(page.url()).origin === returnOrigin) {
      assert.ok(entered && submitted, 'Hosted Checkout accepted the selected test bank account');
      return;
    }
    if (await name.isVisible() && !await name.inputValue()) await name.fill('Synthetic Blotter');
    const routing = await visible(page, frame => frame.getByLabel(/routing number/i));
    if (routing && !entered) {
      await routing.fill('110000000');
      const number = await visible(page, frame => frame.getByLabel(/^account number$/i));
      assert.ok(number, 'Stripe manual entry exposes an account number field');
      await number.fill(account);
      const confirm = await visible(page, frame => frame.getByLabel(/confirm.*account number|re.enter.*account number/i));
      if (confirm) await confirm.fill(account);
      const holder = await visible(page, frame => frame.getByLabel(/account holder.*name|full name|name on.*account/i));
      if (holder) await holder.fill('Synthetic Blotter');
      const checking = await visible(page, frame => frame.getByRole('radio', { name: /checking/i }));
      if (checking) await checking.check();
      entered = true;
    }
    const manual = manualOpened ? null : await visible(page, frame => frame.getByText('Enter bank details manually', { exact: true }));
    if (manual) {
      manualOpened = true;
      await manual.click();
      await pause(500);
      await page.screenshot({ path: `${process.env.BLOTTER_PAYMENT_EVIDENCE}/ach-bank-entry.png`, fullPage: true });
      continue;
    }
    const next = await visible(page, frame => frame.getByRole('button', { name: /^(Continue|Finish without saving|Confirm account|Agree and continue|Verify account|Connect account|Submit|Pay(?:\s.*)?|Authorize(?:\s.*)?)$/i }));
    const action = next ? await next.innerText() : '';
    if (next && await next.isEnabled() && action !== lastAction && (entered || !/^Pay/.test(action))) {
      lastAction = action;
      if (entered) submitted = true;
      await next.click();
    }
    await pause(750);
  }
  throw new Error('Stripe manual bank entry did not finish within the bounded hosted journey');
}

/** Diagnostic labels and control identifiers exclude entered values and frame URLs. */
export async function sandboxBankDiagnostics(page) {
  const frames = [];
  for (const frame of page.frames()) {
    frames.push(await frame.evaluate(() => Array.from(document.querySelectorAll('input,select,button,a,label')).filter(element => {
      const bounds = element.getBoundingClientRect(); return bounds.width > 0 && bounds.height > 0;
    }).map(element => ({ tag: element.tagName.toLowerCase(), id: element.id || null,
      label: element.getAttribute('aria-label') || (['BUTTON', 'LABEL'].includes(element.tagName) ? element.textContent?.trim().slice(0, 150) : null),
      type: element.getAttribute('type'), name: element.getAttribute('name') })).slice(0, 80)).catch(() => []));
  }
  return frames;
}

/** Capture the native invoice and native deliverable portal at both supported widths. */
export async function sandboxBankScreens(page, h, fixture, gate, directory, state) {
  for (const [label, url] of [['invoice', `${h.origin}/invoice/${fixture.token}`], ['file-gate', gate.url]]) {
    await page.goto(url);
    await page.locator('h1').first().waitFor();
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `ACH ${state} portal fits ${width}`);
      await page.screenshot({ path: `${directory}/ach-${state}-${label}-${width}.png`, fullPage: true });
    }
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
}
