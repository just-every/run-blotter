import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
export const cookies=response=>response.headers.getSetCookie().map(value=>value.split(';',1)[0]).join('; ');
export const http=(request,origin,cookie)=>async(path,body,method=body===undefined?'GET':'POST')=>{
 const response=await request(origin+path,{method,redirect:'manual',headers:{Origin:origin,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
 assert.equal(response.status,200,`Native ${method} ${path} returned ${response.status}`);
 return response.json();
};
export function totp(secret){
 let bits=0,value=0,bytes=[];
 for(const char of secret){value=(value<<5)|'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'.indexOf(char);bits+=5;if(bits>=8){bytes.push((value>>>(bits-8))&255);bits-=8;}}
 const step=Buffer.alloc(8);step.writeBigUInt64BE(BigInt(Math.floor(Date.now()/30000)));
 const mac=createHmac('sha1',Buffer.from(bytes)).update(step).digest(),offset=mac[19]&15;
 return String((mac.readUInt32BE(offset)&0x7fffffff)%1000000).padStart(6,'0');
}
