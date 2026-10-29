// Reviewed readers of light inputs. Product tests read the emitted Worker,
// migrations and fixtures; they do not consume contract or evidence documents.
// New test files require review before they can authorize light verification.
import { access, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const productReaders = new Set([
  'ai.test.mjs',
  'api-billing.test.mjs',
  'api-pages.test.mjs',
  'api-writes.test.mjs',
  'archive-transfers.test.mjs',
  'automation.test.mjs',
  'billing-analysis.test.mjs',
  'bulk-messages.test.mjs',
  'bulk-organizers.test.mjs',
  'contacts.test.mjs',
  'deadlines.test.mjs',
  'demo.test.mjs',
  'document-packets.test.mjs',
  'document-sharing.test.mjs',
  'efile-authorizations.test.mjs',
  'enterprise.test.mjs',
  'erasure-policy.test.mjs',
  'flows.test.mjs',
  'import-mapping.test.mjs',
  'intake.test.mjs',
  'integration-keys.test.mjs',
  'integration-webhooks.test.mjs',
  'invoices.test.mjs',
  'language.test.mjs',
  'learning.test.mjs',
  'library.test.mjs',
  'mobile-upload.test.mjs',
  'notifications.test.mjs',
  'organizers.test.mjs',
  'payments.test.mjs',
  'permissions.test.mjs',
  'pipeline-forecast.test.mjs',
  'portal-accounts.test.mjs',
  'rate-worktypes.test.mjs',
  'readiness.test.mjs',
  'recurrence-imports.test.mjs',
  'reports.test.mjs',
  'resolution-cases.test.mjs',
  'security-logs.test.mjs',
  'service-agents.test.mjs',
  'signatures.test.mjs',
  'sms-consent.test.mjs',
  'us.test.mjs',
  'vault.test.mjs',
  'work-bulk.test.mjs',
]);
const documents = new Set(['CONTRACT.md', 'ACCEPTANCE.md', 'CLAIMS.md', 'docs/CLAIMS.md', 'HANDOVER.md', 'STATUS.md']);
const evidence = path => /^(?:evidence|\.artifacts)\/.+\.(?:md|txt|png|jpe?g|pdf)$/.test(path);
export const readerCommands = new Set([
  'node scripts/contract-docs.mjs check',
  'pnpm run test:site',
]);

export async function lightReaders(files, { cwd = process.cwd() } = {}) {
  if (!files.length || !files.every(path => documents.has(path) || path === 'sources.lock.json' || evidence(path))) return;
  for (const path of ['edition.json', 'sources.lock.json', 'scripts/edition-authoring/cli.mjs', 'scripts/contract-docs.mjs', 'tests/email-link.mjs']) await access(join(cwd, path));
  const product = (await readdir(join(cwd, 'tests/blotter'))).filter(name => name.endsWith('.test.mjs'));
  const site = (await readdir(join(cwd, 'tests/site'))).filter(name => name.endsWith('.test.mjs'));
  if (product.length !== productReaders.size || product.some(name => !productReaders.has(name))
    || site.length !== 1 || site[0] !== 'site.test.mjs') return;
  const readers = [];
  // Blotter's incremental generator owns docs/CLAIMS.md rather than Base's
  // native contract-docs path. Keep its existing consistency assertion.
  if (files.some(path => documents.has(path))) readers.push('node scripts/contract-docs.mjs check');
  // This public site assertion rebuilds /contract and verifies all emitted links.
  if (files.includes('CONTRACT.md')) readers.push('pnpm run test:site');
  return readers;
}
