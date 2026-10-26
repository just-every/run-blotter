import assert from 'node:assert/strict';

/** The payment screens share these two icon-only workspace controls. */
export async function paymentTooltips(page, directory) {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    const search = page.getByRole('button', { name: 'Search', exact: true });
    await search.focus();
    await page.getByRole('tooltip', { name: 'Search workspace', exact: true }).waitFor();
    await page.screenshot({ path: `${directory}/payment-search-tooltip-${width}.png` });
    await search.blur(); await page.mouse.move(1, 999); await search.hover();
    await page.waitForTimeout(150); assert.equal(await page.getByRole('tooltip').count(), 0);
    await page.getByRole('tooltip', { name: 'Search workspace', exact: true }).waitFor();
    await page.mouse.move(1, 999);
    const account = page.locator('summary[aria-label]').first();
    await account.focus();
    await page.getByRole('tooltip', { name: 'Account menu', exact: true }).waitFor();
    await page.screenshot({ path: `${directory}/payment-account-tooltip-${width}.png` });
    await account.blur();
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
}
