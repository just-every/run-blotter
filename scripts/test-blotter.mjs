// CI partitions whole public-door files; ordinary local runs still run them all.
import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const files = process.argv.slice(2);
if (!files.length) files.push(...readdirSync('tests/blotter').filter(name => name.endsWith('.test.mjs')).sort().map(name => `tests/blotter/${name}`));
const shard = process.env.BLOTTER_TEST_SHARD;
const result = spawnSync(process.execPath, ['--test', '--test-concurrency=2', ...(shard ? [`--test-shard=${shard}`] : []), ...files], { stdio: 'inherit' });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
