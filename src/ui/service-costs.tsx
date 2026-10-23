import {useEffect,useState} from 'react';
import {api,Empty,ExportLink,Field,Form,money,Status,type Row,type Run} from './common';
export function ServiceCosts({run,tick}:{run:Run;tick:number}) {
 const [data,setData]=useState<Row>(),[estimate,setEstimate]=useState<Row>();
 const reload=()=>api('/costs').then(setData);
 useEffect(()=>{reload().catch(()=>{});},[tick]);
 const change=(path:string,body:Row,message:string)=>run(async()=>{await api(path,body);await reload();},message);
 return <section className="panel" aria-label="Service costs"><h2>Service costs</h2>
 <p>Plan in USD before enabling optional services. Record the provider’s current quoted price and included quantity; unpriced services stay unavailable. Estimates do not charge a card or connect a provider.</p>
 {!data?<button onClick={()=>run(reload,'Costs loaded')}>Load service costs</button>:<>
 <p>{data.notice}</p><p>Reserved so far: {money(data.reservedCents)}. Lifetime budget: {data.budget?money(data.budget.limit_cents):'not set'}. Per-action threshold: {data.budget?money(data.budget.threshold_cents):'not set'}.</p>
 <details><summary>Record a sourced price</summary><Form label="Save price" submit={f=>change('/costs/prices',f,'Price recorded; explicit enablement required')}>
 <Field label="Service" name="service"><select name="service">{Object.entries(data.services).map(([k,v])=><option key={k} value={k}>{k} · {String(v)}</option>)}</select></Field>
 <Field label="Included quantity" name="included" type="number" value="0"/><Field label="USD cents per unit" name="unitCents" type="number" value="0"/><Field label="Payment basis points" name="basisPoints" type="number" value="0"/>
 <Field label="Price source and date" name="source"/>
 </Form></details>
 {data.prices.map((p:Row)=><article className="record" key={p.service}><strong>{p.service}</strong><p>{money(p.unit_cents)} per {p.unit}; {p.included} included; {p.basis_points} payment basis points. Source: {p.source}</p><p>{p.enabled?'Enabled':'Not enabled'} · revision {p.revision}</p>
 {p.service==='agent_plan'&&<Form label={p.enabled?'Disable native plans':'Approve native plan price'} submit={f=>change('/costs/services/'+p.service,{...f,revision:p.revision,enabled:!p.enabled},'Service approval recorded')}><Field label="Price approval reason" name="reason"/></Form>}</article>)}
 <details><summary>Estimate seasonal usage</summary><Form label="Estimate costs" submit={f=>run(async()=>setEstimate(await api('/costs/estimate',{items:Object.keys(data.services).map(service=>({service,quantity:Number(f[service]||0),amountCents:Number(f[service+'_amount']||0)}))})),'Estimate ready')}>
 {Object.entries(data.services).map(([k,v])=><div key={k}><Field label={`${k} quantity (${v})`} name={k} type="number" value="0"/>{['ach','card'].includes(k)&&<Field label={`${k} payment total (USD cents)`} name={k+'_amount'} type="number" value="0"/>}</div>)}
 </Form></details>
 {estimate&&<div className="notice" aria-label="Cost estimate"><h3>Seasonal estimate</h3>{estimate.items.map((i:Row)=><p key={i.service}>{i.service}: {i.estimatedCents===null?'Price not supplied':money(i.estimatedCents)} · {i.quantity} {i.unit}; {i.included??'unknown'} included · {i.enabled?'enabled':'not enabled'}</p>)}<p>Total: {estimate.totalCents===null?'Incomplete: supply all prices':money(estimate.totalCents)}</p><p>{estimate.note}</p></div>}
 <details><summary>Approve a budget or increase</summary><Form label="Approve budget" submit={f=>change('/costs/budget',f,'Budget approved; retry only the same blocked action')}><Field label="Lifetime budget (USD cents)" name="limitCents" type="number"/><Field label="Per-action threshold (USD cents)" name="thresholdCents" type="number"/><Field label="Budget approval reason" name="reason"/></Form></details>
 <h3>Usage and owned exceptions</h3>{!data.usage.length&&<Empty>No metered actions yet.</Empty>}
 {data.usage.map((u:Row)=><article className="record" key={u.action_id}><div className="split"><strong>{u.service} · {u.action_id}</strong><Status value={u.status}/></div><p>Estimated {money(u.estimated_cents)} · owner {u.owner_email}</p><p>{u.outcome}</p>{u.confirmed_cents!=null?<p>Confirmed {money(u.confirmed_cents)} · {u.receipt}</p>:u.status!=='blocked'&&<Form label="Reconcile cost" submit={f=>change('/costs/usage/'+u.action_id+'/reconcile',f,'Cost reconciled; no action replay')}><Field label="Confirmed USD cents" name="cents" type="number"/><Field label="Provider receipt or native cost evidence" name="receipt"/></Form>}</article>)}
 <ExportLink href="/api/blotter/costs/export">Export costs and usage</ExportLink><p>To change plan or provider, record the replacement quote above and explicitly approve its price. Export your usage and your firm archive before switching.</p>
 </>}
 </section>;
}
