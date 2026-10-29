import { chromium } from '@playwright/test';

try {
  const browser = await chromium.launch({
    headless: true,
    ...(process.platform === 'darwin' ? { args: ['--use-mock-keychain', '--password-store=basic'] } : {}),
  });
  await browser.close();
} catch (error) {
  console.error(error);
  // A cache ownership failure cannot be repaired by installing OS libraries.
  process.exit(/EACCES|permission denied/i.test(String(error)) ? 77 : 1);
}
