// Adapt the canonical evidence lifecycle to Blotter's shared build and seven
// file partitions. The shared assertions are also a required proof partition.
import { appendFile } from 'node:fs/promises';
import { planVerification } from '../verify-plan.mjs';
import { run } from '../verify-app.mjs';
import { lightReaders, readerCommands } from './verification-readers.mjs';

export const plan = {
  push: [{ name: 'checks', browser: true }, ...Array.from({ length: 7 }, (_, index) => ({ name: `blotter-${index + 1}`, browser: true }))],
  // No installer, scale or live-provider journey was part of the existing wall.
  nightly: [],
};

const [mode, extra] = process.argv.slice(2);
if (extra) throw Error('Usage: verification.mjs --plan|--light');
if (mode === '--plan') {
  const decision = await planVerification({ plan, readers: lightReaders });
  const hasChecks = decision.matrix.include.some(shard => shard.name === 'checks');
  const matrix = { include: decision.matrix.include.filter(shard => shard.name !== 'checks').map(shard => ({ ...shard, partition: `${shard.name.slice('blotter-'.length)}/7` })) };
  const output = Object.entries({ ...decision, matrix: JSON.stringify(matrix), readers: JSON.stringify(decision.readers),
    has_checks: hasChecks, has_nightly: plan.nightly.length > 0, has_shards: matrix.include.length > 0 })
    .map(([key, value]) => `${key}=${value}\n`).join('');
  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, output);
  process.stdout.write(output);
} else if (mode === '--light') {
  const readers = JSON.parse(process.env.LIGHT_READERS);
  if (!Array.isArray(readers) || readers.some(command => !readerCommands.has(command))) throw Error('Invalid light readers');
  run('node scripts/edition-authoring/cli.mjs check');
  run('pnpm exec rer check --profile first-party');
  for (const command of readers) run(command);
  run('pnpm run build --site');
} else {
  throw Error('Usage: verification.mjs --plan|--light');
}
