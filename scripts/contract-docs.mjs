// Incremental contract mirrors: preserve legacy clauses until each is migrated.
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {parseContract} from '../src/base/seed-contract.mjs';
const mode=process.argv[2];
if(!['write','check'].includes(mode))throw Error('Use node scripts/contract-docs.mjs write or check');
const migrated=['SECURE-001','MOBILE-001'];
let contract=readFileSync('CONTRACT.md','utf8');
const table=contract.split('\n').filter(line=>line.startsWith('| `')).map(line=>['',...line.trim().slice(1,-1).split(/(?<!\\)\|/).map(cell=>cell.trim())]).map(row=>{row[1]=row[1].replace(/`/g,'');return row;});
const count=rows=>['done','partial','missing'].map(status=>rows.filter(row=>row[4]===status).length).concat(rows.length);
const sets={'Published':table.filter(row=>row[3]==='published'),'Target and push further':table.filter(row=>row[3]!=='published'),'All':table};
for(const [label,rows] of Object.entries(sets))contract=contract.replace(new RegExp(`^\\| ${label} \\|.*$`,'m'),`| ${label} | ${count(rows).join(' | ')} |`);
const parsed=parseContract(contract);
let acceptance=readFileSync('ACCEPTANCE.md','utf8');
acceptance=acceptance.replace(/^Summary:.*$/m,`Summary: ${parsed.counts.done} done, ${parsed.counts.partial} partial, ${parsed.counts.missing} missing; ${parsed.counts.total} total.`);
let claims='# Generated contract claims\n\nThese clauses use the native contract mirror. Other clauses remain in the legacy acceptance register. CONTRACT.md is the source.\n';
for(const id of migrated) {
 const clause=parsed.clauses.find(clause=>clause.id===id),row=table.find(row=>row[1]===id);
 if(!clause||!row)throw Error(`Missing clause ${id}`);
 const acceptanceText=clause.text.split('**Acceptance evidence:**')[1]?.split('**Inherited BASE-001:**')[0].trim();
 if(!acceptanceText)throw Error(`Missing acceptance evidence for ${id}`);
 // End at the next numbered clause; do not touch any legacy clause's prose.
 const start=new RegExp(`^\\d+\\. \\*\\*${id} — .*`,'m').exec(acceptance);
 if(!start)throw Error(`Missing acceptance section ${id}`);
 const rest=acceptance.slice(start.index+start[0].length),next=/^\d+\. \*\*/m.exec(rest);
 const end=next?start.index+start[0].length+next.index:acceptance.length;
 const number=start[0].match(/^\d+/)[0];
 const generated=`${number}. **${id} — ${clause.title}.** Status: **${clause.status}**. ${acceptanceText} New capabilities, record kinds and doors supply BASE-001 activation evidence before shipping.\n   Current evidence: ${row[5]}\n   Remaining: ${row[6]}\n\n`;
 let projected=generated;
 if(id==='MOBILE-001') {
  // Keep the inherited obligations and existing browser proof while mirroring
  // the reviewed subset's current status, evidence and remaining work.
  projected=acceptance.slice(start.index,end)
   .replace(/Status: \*\*\w+\*\*/, `Status: **${clause.status}**`)
   .replace(/^   Generated status evidence:.*\n/gm,'')
   .replace(/^   Remaining:.*\n/gm,'').trimEnd()
   +`\n   Generated status evidence: ${row[5]}\n   Remaining: ${row[6]}\n\n`;
 }
 acceptance=acceptance.slice(0,start.index)+projected+acceptance.slice(end);
 claims+=`\n## ${id} — ${clause.title}\n\nStatus: **${clause.status}**.\n\nEvidence: ${row[5]}\n\nGap: ${row[6]}\n`;
}
for(const [path,text] of [['CONTRACT.md',contract],['ACCEPTANCE.md',acceptance],['docs/CLAIMS.md',claims]]) {
 if(mode==='write')writeFileSync(path,text);
 else if(!existsSync(path)||readFileSync(path,'utf8')!==text)throw Error(`Stale contract mirror: ${path}; run node scripts/contract-docs.mjs write`);
}
console.log(`contract-docs ${mode}: ${migrated.join(', ')}; ${parsed.counts.done} done, ${parsed.counts.partial} partial, ${parsed.counts.missing} missing`);
