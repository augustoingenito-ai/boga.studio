import { test, expect } from '@playwright/test';
import { Readable } from 'node:stream';
import { createHmac } from 'node:crypto';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createDatabase } from '../database.js';
import { createWhatsApp } from '../whatsapp.js';
const env={WHATSAPP_PHONE_NUMBER_ID:'12345',WHATSAPP_BUSINESS_ACCOUNT_ID:'67890',WHATSAPP_ACCESS_TOKEN:'fixture-token',WHATSAPP_APP_SECRET:'fixture-secret',WHATSAPP_VERIFY_TOKEN:'fixture-verify',WHATSAPP_API_VERSION:'v23.0'};
async function fixture(work){const saved={DATA_DIR:process.env.DATA_DIR,DB_DRIVER:process.env.DB_DRIVER};process.env.DATA_DIR=await mkdtemp(path.join(tmpdir(),'boga-wa-'));process.env.DB_DRIVER=process.env.TEST_DB_DRIVER||'';const db=await createDatabase();try{await work(db);}finally{await db.close();for(const [k,v] of Object.entries(saved))v===undefined?delete process.env[k]:process.env[k]=v;}}
async function deliver(wa,body,{signed=true}={}){const raw=Buffer.from(JSON.stringify(body)),req=Readable.from([raw]);req.method='POST';req.headers={'x-hub-signature-256':signed?'sha256='+createHmac('sha256',env.WHATSAPP_APP_SECRET).update(raw).digest('hex'):'sha256=invalid'};const response={writeHead(n){this.status=n;},end(v){this.body=v;}};await wa.webhook(req,response,new URL('http://localhost/webhooks/whatsapp'));return response;}
const incoming=(id='wamid.fixture',phone='5491112345678',timestamp=Date.now())=>({object:'whatsapp_business_account',entry:[{changes:[{field:'messages',value:{metadata:{phone_number_id:'12345'},contacts:[{wa_id:phone,profile:{name:'Cliente WhatsApp'}}],messages:[{id,from:phone,timestamp:String(Math.floor(timestamp/1000)),type:'text',text:{body:'Quiero un presupuesto de branding'}}]}}]}]});
const statuses=(id,status)=>({object:'whatsapp_business_account',entry:[{changes:[{field:'messages',value:{metadata:{phone_number_id:'12345'},statuses:[{id,status,timestamp:String(Math.floor(Date.now()/1000))}]}}]}]});
test('webhook: desafío, firma inválida, contacto automático y deduplicación persistente',async()=>fixture(async db=>{
 const wa=createWhatsApp(db,{env});const response={writeHead(s){this.status=s;},end(v){this.body=v;}};
 await wa.webhook({method:'GET'},response,new URL('http://localhost/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=fixture-verify&hub.challenge=123'));expect(response.status).toBe(200);expect(response.body).toBe('123');
 expect((await deliver(wa,incoming(),{signed:false})).status).toBe(401);expect(await wa.messages()).toHaveLength(0);
 expect((await deliver(wa,incoming())).status).toBe(200);await deliver(wa,incoming());expect(await wa.messages()).toHaveLength(1);
 const clients=await db.prepare('SELECT body FROM records WHERE kind=?').all('clients');expect(clients).toHaveLength(1);expect(JSON.parse(clients[0].body).phone).toBe('+5491112345678');
 const other=createWhatsApp(db,{env});expect(await other.messages()).toHaveLength(1);
}));
test('respuestas: ventana 24h, payload a Meta, doble envío y estados fuera de orden',async()=>fixture(async db=>{
 let sends=0;const wa=createWhatsApp(db,{env,fetcher:async(url,options)=>{sends++;expect(url).toBe('https://graph.facebook.com/v23.0/12345/messages');expect(JSON.parse(options.body)).toMatchObject({to:'5491112345678',type:'text',text:{body:'Hola, te ayudo'}});return {ok:true,json:async()=>({messages:[{id:'wamid.sent'}]})};}});
 await deliver(wa,incoming());const clientId=(await wa.messages())[0].clientId;
 const payload={clientId,text:'Hola, te ayudo',requestId:'fixture-request-123456'};
 const sent=await wa.send(payload);expect(sent.status).toBe('accepted');await wa.send(payload);expect(sends).toBe(1);
 await Promise.all([deliver(wa,statuses('wamid.sent','read')),deliver(wa,statuses('wamid.sent','sent'))]);expect((await wa.messages()).find(m=>m.direction==='out').delivery).toBe('read');
 const expired=createWhatsApp(db,{env,now:()=>Date.now()+86401000,fetcher:()=>{throw Error('No debe enviar');}});await expect(expired.send({...payload,requestId:'fixture-request-new-123'})).rejects.toThrow(/24 horas/);
}));
test('un timeout no provoca reenvíos y nunca expone credenciales; estado seguro',async()=>fixture(async db=>{
 let sends=0;const wa=createWhatsApp(db,{env,fetcher:async()=>{sends++;throw Error('private-token-should-not-leak');}});await deliver(wa,incoming());const clientId=(await wa.messages())[0].clientId;
 const payload={clientId,text:'Hola',requestId:'fixture-timeout-123456'};
 await expect(wa.send(payload)).rejects.toThrow(/Meta no respondió/);await expect(wa.send(payload)).rejects.toThrow(/ya se intentó/);expect(sends).toBe(1);expect((await wa.messages()).find(m=>m.direction==='out').status).toBe('unknown');
 expect(JSON.stringify(await wa.status())).not.toContain('fixture-token');expect(JSON.stringify(await wa.status())).not.toContain('fixture-secret');
}));
test('teléfono existente, número ajeno y API sin configurar',async()=>fixture(async db=>{
 await db.prepare('INSERT INTO records(kind,id,body) VALUES(?,?,?)').run('clients','existing-client',JSON.stringify({id:'existing-client',name:'Existente',phone:'+54 9 11 1234-5678'}));
 const wa=createWhatsApp(db,{env});await deliver(wa,incoming());expect((await wa.messages())[0].clientId).toBe('existing-client');
 const other=incoming('another');other.entry[0].changes[0].value.metadata.phone_number_id='999';await deliver(wa,other);expect(await wa.messages()).toHaveLength(1);
 const missing=createWhatsApp(db,{env:{}});expect((await missing.status()).configured).toBe(false);await expect(missing.check()).rejects.toThrow(/Completá/);
}));

test('verificación de número y suscripción usan el recurso correcto en Meta',async()=>fixture(async db=>{
 const wa=createWhatsApp(db,{env,fetcher:async(url,options)=>{if(url.endsWith('/subscribed_apps')){expect(url).toContain('/67890/');expect(options.method).toBe('POST');return {ok:true,json:async()=>({success:true})};}expect(url).toContain('/12345?fields=');return {ok:true,json:async()=>({id:'12345',display_phone_number:'+541100000000',verified_name:'BOGA'})};}});
 expect((await wa.check()).phoneId).toBe('12345');expect((await wa.status()).connection.name).toBe('BOGA');expect(await wa.subscribe()).toEqual({subscribed:true});
}));
