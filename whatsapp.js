import { createHash, createHmac, timingSafeEqual, randomUUID } from 'node:crypto';
const hash=v=>createHash('sha256').update(v).digest('hex');
const same=(a,b)=>{const x=Buffer.from(a||''),y=Buffer.from(b||'');return x.length===y.length&&timingSafeEqual(x,y);};
const problem=(message,status=400)=>Object.assign(new Error(message),{status});
const messageId=id=>'wa-message:'+hash(id);
const statusId=(id,status)=>'wa-status:'+hash(id+':'+status);
const rank={sent:1,failed:2,delivered:3,read:4};
export const whatsappKinds=['whatsappMessages','whatsappStatuses'];
export function createWhatsApp(db,{env=process.env,fetcher=fetch,now=()=>Date.now()}={}){
 const config=()=>({phoneId:env.WHATSAPP_PHONE_NUMBER_ID,wabaId:env.WHATSAPP_BUSINESS_ACCOUNT_ID,token:env.WHATSAPP_ACCESS_TOKEN,secret:env.WHATSAPP_APP_SECRET,verify:env.WHATSAPP_VERIFY_TOKEN,version:env.WHATSAPP_API_VERSION});
 const read=async id=>{const r=await db.prepare('SELECT body FROM records WHERE id=?').get(id);return r?JSON.parse(r.body):null;};
 const list=async kind=>(await db.prepare('SELECT body FROM records WHERE kind=?').all(kind)).map(r=>JSON.parse(r.body));
 const put=async(kind,v)=>db.prepare('INSERT INTO records(kind,id,body) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body').run(kind,v.id,JSON.stringify(v));
 async function messages(){const states=await list('whatsappStatuses');return (await list('whatsappMessages')).map(m=>({...m,delivery:states.filter(s=>s.externalId===m.externalId).sort((a,b)=>rank[b.status]-rank[a.status])[0]?.status||m.status})).sort((a,b)=>a.timestamp-b.timestamp);}
 async function status(){const c=config();return {configured:!!(c.phoneId&&c.wabaId&&c.token&&c.secret&&c.verify&&/^v\d+\.\d+$/.test(c.version||'')),requirements:{phoneId:!!c.phoneId,businessAccountId:!!c.wabaId,token:!!c.token,appSecret:!!c.secret,verifyToken:!!c.verify,apiVersion:/^v\d+\.\d+$/.test(c.version||'')},connection:(await read('wa-connection'))?.phoneId===c.phoneId?await read('wa-connection'):null};}
 async function graph(path,options={},resource=config().phoneId){
  const c=config();if(!resource||!/^\d+$/.test(resource)||!c.token||!/^v\d+\.\d+$/.test(c.version||''))throw problem('Completá los datos de la API de WhatsApp en Render.',503);
  let r;try{r=await fetcher(`https://graph.facebook.com/${c.version}/${resource}${path}`,{...options,headers:{'Content-Type':'application/json',Authorization:'Bearer '+c.token},signal:AbortSignal.timeout(15000)});}catch{throw problem('Meta no respondió. No reenvíes el mensaje hasta comprobar si llegó en WhatsApp.',502);}
  let data;try{data=await r.json();}catch{throw problem('Meta devolvió una respuesta no válida.',502);}
  if(!r.ok)throw problem('Meta rechazó la solicitud'+(Number.isInteger(data.error?.code)?` (código ${data.error.code})`:'')+'. Revisá el token, el número y los permisos en Meta.',502);
  return data;
 }
 async function check(){const d=await graph('?fields=id,display_phone_number,verified_name');if(!d.id)throw problem('No se pudo verificar el número con Meta.',502);const v={id:'wa-connection',phoneId:d.id,phone:d.display_phone_number,name:d.verified_name,verifiedAt:new Date(now()).toISOString()};await put('whatsappSettings',v);return v;}
 async function subscribe(){const c=config();if(!c.wabaId)throw problem('Completá el identificador de cuenta de WhatsApp Business en Render.',503);const data=await graph('/subscribed_apps',{method:'POST',body:'{}'},c.wabaId);if(!data.success)throw problem('Meta no confirmó la suscripción de recepción.',502);return {subscribed:true};}
 async function inbound(value){
  if(value.metadata?.phone_number_id!==config().phoneId)return;
  for(const m of value.messages||[]){
   if(typeof m.id!=='string'||!/^\d{8,15}$/.test(m.from||''))continue;
   const id=messageId(m.id);if(await read(id))continue;
   const phone='+'+m.from;
   const clients=(await list('clients')).filter(c=>String(c.phone||'').replace(/\D/g,'')===m.from);
   const contact=(value.contacts||[]).find(c=>c.wa_id===m.from);
   const clientId=clients.length===1?clients[0].id:'wa-client:'+hash(m.from);
   const createdAt=new Date(now()).toISOString();
   const eventTime=Number(m.timestamp)*1000;
   if(!Number.isFinite(eventTime)||eventTime<=0||eventTime>now()+300000)continue;
   const text=m.type==='text'?String(m.text?.body||''):m.type==='button'?String(m.button?.text||''):m.type==='interactive'?String(m.interactive?.button_reply?.title||m.interactive?.list_reply?.title||'Respuesta interactiva'):`[${({image:'Imagen',document:'Documento',audio:'Audio',video:'Video',sticker:'Sticker',location:'Ubicación',contacts:'Contacto'})[m.type]||'Contenido'} recibido; abrilo en WhatsApp]`;
   await db.transaction(async tx=>{
    if(clients.length!==1)await tx.prepare('INSERT INTO records(kind,id,body) VALUES(?,?,?) ON CONFLICT(id) DO NOTHING').run('clients',clientId,JSON.stringify({id:clientId,name:String(contact?.profile?.name||phone),phone,tags:'WhatsApp',createdAt}));
    await tx.prepare('INSERT INTO records(kind,id,body) VALUES(?,?,?) ON CONFLICT(id) DO NOTHING').run('whatsappMessages',id,JSON.stringify({id,clientId,externalId:m.id,direction:'in',type:m.type,text:text.slice(0,10000),timestamp:eventTime,createdAt,status:'received',phone}));
   });
  }
  for(const s of value.statuses||[]){
   if(typeof s.id!=='string'||!['sent','delivered','read','failed'].includes(s.status))continue;
   const id=statusId(s.id,s.status);
   await db.prepare('INSERT INTO records(kind,id,body) VALUES(?,?,?) ON CONFLICT(id) DO NOTHING').run('whatsappStatuses',id,JSON.stringify({id,externalId:s.id,status:s.status,timestamp:Number(s.timestamp)*1000||now(),errorCode:Number(s.errors?.[0]?.code)||null}));
  }
 }
 async function webhook(req,res,url){
  if(url.pathname!=='/webhooks/whatsapp')return false;
  const c=config();
  if(req.method==='GET'){
   if(c.verify&&url.searchParams.get('hub.mode')==='subscribe'&&same(url.searchParams.get('hub.verify_token'),c.verify)){res.writeHead(200,{'Content-Type':'text/plain'});res.end(url.searchParams.get('hub.challenge')||'');}else{res.writeHead(403);res.end();}return true;
  }
  if(req.method!=='POST'){res.writeHead(405);res.end();return true;}
  if(!c.secret||!c.phoneId){res.writeHead(503);res.end();return true;}
  const chunks=[];let bytes=0;for await(const chunk of req){bytes+=chunk.length;if(bytes>2000000){res.writeHead(413);res.end();return true;}chunks.push(chunk);}
  const raw=Buffer.concat(chunks),expected='sha256='+createHmac('sha256',c.secret).update(raw).digest('hex');
  if(!same(req.headers['x-hub-signature-256'],expected)){res.writeHead(401);res.end();return true;}
  let body;try{body=JSON.parse(raw.toString());}catch{res.writeHead(400);res.end();return true;}
  if(body.object==='whatsapp_business_account')for(const entry of body.entry||[])for(const change of entry.changes||[])if(change.field==='messages')await inbound(change.value||{});
  res.writeHead(200);res.end('EVENT_RECEIVED');return true;
 }
 async function send(input){
  if(typeof input.clientId!=='string'||typeof input.text!=='string'||!input.text.trim()||input.text.length>4096||!/^[a-zA-Z0-9-]{16,80}$/.test(input.requestId||''))throw problem('Seleccioná un cliente y escribí un mensaje de hasta 4096 caracteres.');
  const client=await read(input.clientId);if(!client||!(await list('clients')).some(c=>c.id===input.clientId))throw problem('Cliente inexistente.',404);
  const phone=String(client.phone||'').replace(/[\s()-]/g,'');if(!/^\+\d{8,15}$/.test(phone))throw problem('Guardá el teléfono del cliente con + y código de país, como aparece en WhatsApp.');
  const incoming=(await list('whatsappMessages')).filter(m=>m.clientId===client.id&&m.direction==='in'&&m.phone===phone);
  const latest=Math.max(0,...incoming.map(m=>m.timestamp));
  if(!latest||now()-latest>=86400000)throw problem('El cliente debe escribirte por WhatsApp para abrir una ventana de respuesta de 24 horas. Las plantillas no están habilitadas.',409);
  const c=config();if(!c.phoneId||!c.token||!/^v\d+\.\d+$/.test(c.version||''))throw problem('Falta configurar la API en Render.',503);
  const id='wa-out:'+input.requestId;
  const record={id,clientId:client.id,phone,text:input.text.trim(),direction:'out',type:'text',timestamp:now(),createdAt:new Date(now()).toISOString(),status:'pending'};
  const inserted=await db.prepare('INSERT INTO records(kind,id,body) VALUES(?,?,?) ON CONFLICT(id) DO NOTHING RETURNING id').get('whatsappMessages',id,JSON.stringify(record));
  if(!inserted){const existing=await read(id);if(existing.clientId!==client.id)throw problem('Solicitud duplicada.',409);if(existing.externalId)return existing;throw problem('Este envío ya se intentó. Revisá su estado antes de enviar otro mensaje.',409);}
  try{
   const data=await graph('/messages',{method:'POST',body:JSON.stringify({messaging_product:'whatsapp',recipient_type:'individual',to:phone.slice(1),type:'text',text:{preview_url:false,body:record.text}})});
   if(!data.messages?.[0]?.id)throw problem('Meta no confirmó el envío. Revisá WhatsApp antes de volver a enviarlo.',502);
   record.externalId=data.messages[0].id;record.status='accepted';await put('whatsappMessages',record);return record;
  }catch(e){record.status='unknown';await put('whatsappMessages',record);throw e;}
 }
 return {webhook,status,check,subscribe,messages,send};
}
