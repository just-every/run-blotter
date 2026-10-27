// Generate status projections from the pinned parser without changing acceptance prose.
import fs from 'node:fs';
import { parseContract } from '../src/base/seed-contract.mjs';
const [mode, ...ids] = process.argv.slice(2);
if (!['write','check'].includes(mode) || !ids.length) throw Error('Usage: node scripts/contract-docs.mjs write|check CLAUSE [CLAUSE ...]');
const source = fs.readFileSync('CONTRACT.md','utf8');
const contract = parseContract(source);
const cells = new Map(source.split('\n').filter(l=>l.startsWith('| `')).map(l=>{
  const row=l.replace(/^\|\s*|\s*\|$/g,'').split(/(?<!\\)\|/).map(s=>s.trim());return [row[0].replaceAll('`',''),row];
}));
let acceptance = fs.readFileSync('ACCEPTANCE.md','utf8');
for(const id of ids){
 const clause=contract.clauses.find(c=>c.id===id),row=cells.get(id);if(!clause||!row)throw Error('Unknown clause '+id);
 const re=new RegExp('(^\\d+\\. \\*\\*'+id+' — [\\s\\S]*?)(?=^\\d+\\. \\*\\*|(?![\\s\\S]))','m');
 if(!re.test(acceptance))throw Error('Acceptance entry missing for '+id);
 acceptance=acceptance.replace(re,block=>{
   block=block.replace(/Status: \*\*\w+\*\*/,`Status: **${clause.status}**`);
   block=block.replace(/^   Generated status evidence:.*\n/gm,'');
   block=block.replace(/^   Remaining:.*\n/gm,'');
   return block.trimEnd()+`\n   Generated status evidence: ${row[4]}\n   Remaining: ${row[5] || 'None.'}\n\n`;
 });
}
const claims = '# Current contract status\n\nGenerated from CONTRACT.md. The linked source contains the complete obligations, Evidence and Gap for every row.\n\n'
  + `Counts: ${contract.counts.done} done, ${contract.counts.partial} partial, ${contract.counts.missing} missing; ${contract.counts.total} total.\n\n`
  + '| Clause | Title | Status | Proof and remaining work |\n| --- | --- | --- | --- |\n'
  + contract.clauses.map(c => `| ${c.id} | ${c.title.replaceAll('/', ' or ')} | ${c.status} | [Contract source](../CONTRACT.md#status) |`).join('\n') + '\n';
for(const [path,expected] of [['ACCEPTANCE.md',acceptance],['docs/CLAIMS.md',claims]]){
 if(mode==='write')fs.writeFileSync(path,expected);
 else if(!fs.existsSync(path)||fs.readFileSync(path,'utf8')!==expected)throw Error(path+' is stale; regenerate contract docs');
}
console.log('Contract docs '+mode+' passed: '+ids.join(', '));
