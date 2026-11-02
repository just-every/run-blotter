import assert from 'node:assert/strict';
import { http } from './http.mjs';
export default async function({request,origin,email,owner,mail}){
 const api=http(request,origin,owner.cookie);
 await api('/api/blotter/team',{email,name:'Riley Reviewer',role:'reviewer'});
 await api('/api/blotter/team/invite',{email});
 const messages=await mail.read({limit:20});
 const text=messages.map(message=>message.text??message.html).join('\n');
 const token=text.match(/\/auth\/confirm\?token=([^\s"&<]+)/)?.[1];
 assert.ok(token,'Native invitation supplies its one-use confirmation');
 const response=await request(origin+'/auth/confirm',{method:'POST',redirect:'manual',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({token})});
 assert.equal(response.status,303,'Reviewer completes native admission');return response;
}
