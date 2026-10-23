import {useEffect,useState} from 'react';
import {api,Empty,Field,Form,money,Status,when,type Row,type Run} from './common';
export function ScheduledAgents({state,run,open}:{state:Row;run:Run;open:(id:string)=>void}) {
 const [data,setData]=useState<Row>(),[keys,setKeys]=useState<Row[]>([]),[trigger,setTrigger]=useState('file'),[tool,setTool]=useState('reminder');
 const reload=async()=>{setData(await api('/agent-rules'));setKeys((await api('/team')).keys.filter((k:Row)=>!k.revoked));};
 useEffect(()=>{reload().catch(()=>{});},[]);
 const change=(path:string,b:Row,message:string)=>run(async()=>{await api(path,b);await reload();},message);
 return <section className="panel" aria-label="Scheduled agents"><h2>Scheduled agents</h2><p>Agents prepare; people approve. A file, completed task, question or schedule can prepare one bounded plan for one client. This native planner calls no model and transmits no data to a provider. Configure Service costs before enabling plans.</p>
 {!data?<button onClick={()=>run(reload,'Agents loaded')}>Load scheduled agents</button>:<><p>{data.exclusions}</p>
 <details><summary>Enable a supervised agent</summary><Form label="Approve agent grant" submit={f=>change('/agent-rules',f,'Client, data, tool and budget grant approved')}>
 <Field label="Agent name" name="name"/><Field label="Supervisor’s agent key" name="keyId"><select name="keyId" required><option value="">Choose a live key…</option>{keys.map(k=><option key={k.id} value={k.id}>{k.label}</option>)}</select></Field>
 <Field label="One client" name="clientId"><select name="clientId" required><option value="">Choose client…</option>{state.clients.filter((c:Row)=>c.lifecycle==='active').map((c:Row)=><option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
 <Field label="Agent trigger" name="trigger"><select name="trigger" value={trigger} onChange={e=>setTrigger(e.target.value)}>{[['file','File uploaded'],['tasks_complete','Tasks completed'],['question','Client question'],['schedule','Schedule']].map(([v,label])=><option key={v} value={v}>{label}</option>)}</select></Field>
 {trigger==='schedule'&&<><Field label="Start time including timezone" name="startsAt" hint="For example 2026-11-01T09:00:00-05:00"/><Field label="Every hours" name="everyHours" type="number" value="24"/></>}
 <Field label="Granted preparation tool" name="tool"><select name="tool" value={tool} onChange={e=>setTool(e.target.value)}><option value="reminder">Prepare document reminder</option><option value="rollforward">Prepare roll-forward</option></select></Field>
 {tool==='rollforward'&&<><Field label="Proposed due date" name="dueDate" type="date"/><Field label="Due-date source" name="dueNote"/></>}
 <Field label="Lifetime plan budget" name="budget" type="number" value="10"/>
 <p>Supervisor: {state.actor.email}. Data: job metadata and outstanding request labels only. External messages, staffing, deadlines, fees, write-offs, financial changes and final judgments require their existing human review doors.</p>
 </Form></details>
 {data.rules.map((r:Row)=><article className="record" key={r.id}><div className="split"><strong>{r.name}</strong><Status value={r.status}/></div><p>{r.trigger} · {r.tool} · supervisor {r.supervisor_email} · {r.used}/{r.budget} plans</p><p>{r.data_scope}</p><p>{r.model_policy}</p>{r.status==='active'&&<button className="danger" onClick={()=>change(`/agent-rules/${r.id}/revoke`,{},'Agent revoked; pending effects are refused')}>Revoke agent</button>}</article>)}
 <button onClick={()=>change('/agent-rules/run',{},'Agent events evaluated; review plans and outcomes')}>Evaluate agent events</button>
 <h3>Retained plans and outcomes</h3>{!data.runs.length&&<Empty>No agent runs yet.</Empty>}{data.runs.map((r:Row)=><article className="record" key={r.id}><div className="split"><strong>{data.rules.find((d:Row)=>d.id===r.rule_id)?.name}</strong><Status value={r.decision??r.status}/></div><small>{when(r.created_at)} · source {r.event_key}</small><p>{r.outcome} · estimated {money(r.cost_cents)}</p><button className="quiet" onClick={()=>open(r.job_id)}>Open source job</button>{r.proposal_id&&<p>Plan {r.proposal_id}: review it in the preparations above. {r.decision_note}</p>}</article>)}</>}
 </section>;
}
