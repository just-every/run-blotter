// Test-only network boundary. All application routes, authorization and accounting use the built Worker.
import assert from 'node:assert/strict';
export function stripeEdge(){
 let n=0;const sessions=new Map(),intents=new Map(),calls=[];
 const key=()=>`synthetic-blotter-${++n}`;
 const pi=(paymentId,amount,customer,save=false,kind='card')=>({id:key(),amount:Number(amount),amount_received:Number(amount),currency:'usd',status:'succeeded',metadata:{blotter_payment_id:paymentId},customer:customer??key(),setup_future_usage:save?'off_session':null,payment_method:{id:key(),type:kind,[kind]:{last4:kind==='card'?'4242':'6789'}},latest_charge:{id:key(),amount_refunded:0,disputed:false,balance_transaction:{fee:33}}});
 const respond=async request=>{
  assert.equal(request.headers.get('stripe-version'),'2026-09-30.endive');
  const u=new URL(request.url),path=u.pathname.replace('/v1/',''),body=request.method==='POST'?new URLSearchParams(await request.text()):null;calls.push({path,body});
  if(path==='customers')return Response.json({id:key()});
  if(path==='checkout/sessions'){
   assert.ok(!body.has('payment_method_types[0]'));const id=key(),p=pi(body.get('metadata[blotter_payment_id]'),body.get('line_items[0][price_data][unit_amount]'),body.get('customer'),body.has('payment_intent_data[setup_future_usage]'));
   intents.set(p.id,p);sessions.set(id,{id,payment_intent:p.id,status:'complete',url:`https://checkout.stripe.com/c/pay/${id}`});return Response.json(sessions.get(id));
  }
  if(path.startsWith('checkout/sessions/'))return Response.json(sessions.get(path.split('/').at(-1)));
  if(path==='payment_intents'){
   const p=pi(body.get('metadata[blotter_payment_id]'),body.get('amount'),body.get('customer'),false,body.get('allowed_payment_method_types[0]'));intents.set(p.id,p);return Response.json(p);
  }
  if(path.startsWith('payment_intents/'))return Response.json(intents.get(path.split('/').at(-1)));
  if(path==='refunds'){const p=intents.get(body.get('payment_intent'));p.latest_charge.amount_refunded+=Number(body.get('amount'));return Response.json({id:key(),status:'succeeded'});}
  if(path.startsWith('payment_methods/'))return Response.json({id:path.split('/')[1],customer:null});
  if(path==='disputes')return Response.json({data:[{id:key(),status:'needs_response'}]});
  throw new Error(`Unexpected provider request ${path}`);
 };
 return {respond,sessions,intents,calls};
}
