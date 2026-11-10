import http from 'node:http';
import { quotePDF } from './quote-pdf.js';
import {quoteTotals,collectionType,monthlyType} from './public/quote-totals.js';
import {validDate,studioToday,quoteSchedule,quoteFollowupOn} from './public/agenda.js';
import { createWhatsApp, whatsappKinds } from './whatsapp.js';
import { createAuth } from './auth.js';
import { createDatabase } from './database.js';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
const root=path.dirname(fileURLToPath(import.meta.url));
const db=await createDatabase();
const auth=await createAuth(db,root);
const whatsapp=createWhatsApp(db);
const kinds=['clients','quotes','jobs','notes'];
const list=async k=>(await db.prepare('SELECT body FROM records WHERE kind=?').all(k)).map(r=>JSON.parse(r.body)).sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));
const get=async(k,id)=>{const r=await db.prepare('SELECT body FROM records WHERE kind=? AND id=?').get(k,id);return r?JSON.parse(r.body):null;};
const allState=async()=>({...Object.fromEntries(await Promise.all([...kinds,...whatsappKinds].map(async k=>[k,await list(k)]))),whatsappMessages:await whatsapp.messages()});
const error=(message,status=400)=>Object.assign(new Error(message),{status});
async function validate(k,v){
 if(k==='clients'&&!String(v.name||'').trim()) throw error('El nombre del cliente es obligatorio.');
 if(k!=='clients'&&!await get('clients',v.clientId))throw error('Seleccioná un cliente existente.');
 if(k==='quotes'&&!String(v.title||'').trim())v.title=String(v.number||'').trim()||'Presupuesto de '+String(v.type||'').toLowerCase();
 if(k==='jobs'&&!String(v.title||'').trim())throw error('El título es obligatorio.');
 if(k==='quotes'){
 if(!['Branding','Diseño',collectionType,monthlyType].includes(v.type))throw error('Tipo de presupuesto inválido.');
 if(!['Borrador','Enviado','Aprobado','Rechazado','Vencido'].includes(v.status))throw error('Estado inválido.');
 if(!Array.isArray(v.items)||!v.items.length||v.items.some(i=>!i.service?.trim()||!Number.isFinite(i.quantity)||i.quantity<=0||!Number.isFinite(i.price)||Math.abs(i.price)>1e12))throw error('Revisá los servicios, cantidades y precios.');
 if(v.type===collectionType){
  if(typeof v.hadConsultation!=='boolean')throw error('Indicá si el cliente tuvo asesoría previa.');
  if(!Number.isInteger(v.collectionTypologies)||v.collectionTypologies<1||v.collectionTypologies>9999)throw error('Ingresá una cantidad de tipologías entre 1 y 9999.');
  if(v.hadConsultation&&(!Number.isFinite(v.consultationAmount)||v.consultationAmount<0))throw error('Ingresá el importe cobrado por la asesoría.');
 }else{v.hadConsultation=false;v.consultationAmount=0;}
 if(!v.hadConsultation)v.consultationAmount=0;
 try{Object.assign(v,quoteTotals(v));}catch(e){throw error(e.message);}
 if(v.total<0)throw error('Los descuentos superan el subtotal. El total del presupuesto no puede ser negativo.');
 if(!Number.isFinite(v.total))throw error('El importe total no es válido.');
 if(v.timeline!==undefined&&(!Array.isArray(v.timeline)||v.timeline.length>5||v.timeline.some(t=>typeof t!=='string'||t.length>250)))throw error('Revisá los cinco campos del cronograma.');
 if(!Number.isFinite(v.paid)||v.paid<0||v.paid>v.total)throw error('El cobro debe estar entre cero y el total.');
 if(v.sentOn&&v.sentOn>studioToday())throw error('La fecha de envío no puede estar en el futuro.');
 if(v.sentOn&&v.respondedOn&&v.respondedOn<v.sentOn)throw error('La respuesta no puede ser anterior al envío.');
 if(v.sentOn&&v.followedUpOn&&v.followedUpOn<v.sentOn)throw error('El seguimiento no puede ser anterior al envío.');
 v.followupOn=quoteFollowupOn(v);
 if(v.attachment&&(!/^data:(image\/(png|jpeg|webp)|application\/pdf);base64,[A-Za-z0-9+/=]+$/.test(v.attachment.data)||v.attachment.data.length>7000000))throw error('Adjuntá un PDF o imagen de hasta 5 MB.');
 }
 if(k==='jobs'){
 if(!['Brief','Diseño','Revisión','Entrega','Finalizado'].includes(v.stage))throw error('Etapa inválida.');
 if(v.quoteId){const q=await get('quotes',v.quoteId);if(!q||q.clientId!==v.clientId||q.status!=='Aprobado')throw error('El trabajo requiere un presupuesto aprobado del mismo cliente.');}
 }
 if(k==='notes'&&!String(v.text||'').trim())throw error('Escribí una nota.');
 for(const key of ['due','reviewDue','followup','date','validUntil','sentOn','respondedOn','followedUpOn'])if(v[key]&&!validDate(v[key]))throw error('Fecha inválida.');
 return v;
}
async function save(k,v){await db.prepare('INSERT INTO records(kind,id,body) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET kind=excluded.kind,body=excluded.body').run(k,v.id,JSON.stringify(v));return v;}
await db.snapshot();
const backupTimer=setInterval(()=>db.snapshot().catch(()=>console.error('No se pudo crear el respaldo local.')),86400000);backupTimer.unref();
const server=http.createServer(async(req,res)=>{
 const send=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
 try{
 res.setHeader('X-Content-Type-Options','nosniff');
 res.setHeader('Referrer-Policy','same-origin');
 res.setHeader('X-Frame-Options','DENY');
 res.setHeader('Content-Security-Policy',"default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; font-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'");
 const url=new URL(req.url,'http://localhost');
 if(await whatsapp.webhook(req,res,url))return;
 if(await auth.handle(req,res,url.pathname))return;
 if(url.pathname.startsWith('/api/')){
 if(!auth.sameOrigin(req))throw error('Origen no permitido.',403);
 if(url.pathname==='/api/backup'&&req.method==='GET'){const content=JSON.stringify({version:1,exportedAt:new Date().toISOString(),...await allState(),userProfiles:await list('userProfiles')},null,2);res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store','Content-Disposition':'attachment; filename="boga-respaldo.json"'});res.end(content);return;}
 if(url.pathname==='/api/whatsapp/status'&&req.method==='GET')return send(200,await whatsapp.status());
 if(url.pathname==='/api/whatsapp/subscribe'&&req.method==='POST')return send(200,await whatsapp.subscribe());
 if(url.pathname==='/api/whatsapp/check'&&req.method==='POST')return send(200,await whatsapp.check());
 if(url.pathname==='/api/whatsapp/messages'&&req.method==='GET')return send(200,{messages:await whatsapp.messages(),clients:await list('clients')});
 if(url.pathname==='/api/whatsapp/messages'&&req.method==='POST'){let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>20000)throw error('Mensaje demasiado largo.',413);}let input;try{input=JSON.parse(raw);}catch{throw error('Datos inválidos.');}return send(201,await whatsapp.send(input));}
 const pdfMatch=url.pathname.match(/^\/api\/quotes\/([^/]+)\/pdf$/);
 if(pdfMatch&&req.method==='GET'){const quote=await get('quotes',decodeURIComponent(pdfMatch[1]));if(!quote)throw error('Presupuesto inexistente.',404);const client=await get('clients',quote.clientId);if(!client)throw error('Cliente inexistente.',404);const result=await quotePDF(quote,client,{editable:url.searchParams.get('editable')==='1'});res.writeHead(200,{'Content-Type':'application/pdf','Cache-Control':'no-store','Content-Disposition':(url.searchParams.get('download')==='1'?'attachment':'inline')+'; filename="BOGA-'+(quote.type==='Diseño'?'diseno':quote.type===collectionType?'coleccion':quote.type===monthlyType?'acompanamiento-mensual':'branding')+'-'+(result.editable?'editable':'final')+'.pdf"','X-Frame-Options':'SAMEORIGIN','Content-Security-Policy':"default-src 'none'; frame-ancestors 'self'; object-src 'self'; base-uri 'none'"});res.end(result.bytes);return;}
 const [, , k,id]=url.pathname.split('/');
 if(k==='state'&&req.method==='GET')return send(200,await allState());
 if(!kinds.includes(k))throw error('Ruta inexistente.',404);
 if(req.method==='DELETE'){
 if(!await get(k,id))throw error('Registro inexistente.',404);
 if(k==='clients'&&(await Promise.all(['quotes','jobs','notes',...whatsappKinds].map(list))).some(arr=>arr.some(v=>v.clientId===id)))throw error('El cliente tiene registros vinculados.');
 if(k==='quotes'&&(await list('jobs')).some(v=>v.quoteId===id))throw error('El presupuesto tiene un trabajo vinculado.');
 await db.prepare('DELETE FROM records WHERE kind=? AND id=?').run(k,id);return send(200,{ok:true});
 }
 if(!['POST','PUT'].includes(req.method))throw error('Método no permitido.',405);
 let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>7500000)throw error('Archivo demasiado grande.',413);}
 let body;try{body=JSON.parse(raw);}catch{throw error('Datos inválidos.');}
 const old=id?await get(k,id):null;if(id&&!old)throw error('Registro inexistente.',404);
 if(!body||typeof body!=='object'||Array.isArray(body))throw error('Datos inválidos.');
 const input=k==='quotes'?quoteSchedule(old,body):{...old,...body};
 const v=await validate(k,{...input,id:id||randomUUID(),createdAt:old?.createdAt||new Date().toISOString()});
 if(k==='quotes'&&(await list('jobs')).some(j=>j.quoteId===v.id&&(v.status!=='Aprobado'||j.clientId!==v.clientId)))throw error('El presupuesto vinculado a un trabajo debe mantener su cliente y su aprobación.');
 return send(id?200:201,await save(k,v));
 }
 if(/^\/fonts\/[a-z0-9-]+\.woff2$/.test(url.pathname)){const fp=path.join(root,'public',url.pathname);if(existsSync(fp)){res.writeHead(200,{'Content-Type':'font/woff2','Cache-Control':'public, max-age=86400'});return res.end(readFileSync(fp));}}
 const files={'/':'index.html','/login.js':'login.js','/brand/boga-logo.svg':'brand/boga-logo.svg','/brand/boga-studio-logo.svg':'brand/boga-studio-logo.svg','/brand/dashboard-watermark.svg':'brand/dashboard-watermark.svg','/agenda.js':'agenda.js','/quote-totals.js':'quote-totals.js','/quote-defaults.js':'quote-defaults.js','/icons.js':'icons.js','/app.js':'app.js','/style.css':'style.css'};const f=files[url.pathname];
 if(!f){res.writeHead(404);return res.end('No encontrado');}
 res.writeHead(200,{'Content-Type':f.endsWith('svg')?'image/svg+xml':f.endsWith('html')?'text/html; charset=utf-8':f.endsWith('css')?'text/css':'text/javascript','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; font-src 'self'; frame-src 'self' data:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'"});res.end(readFileSync(path.join(root,'public',f)));
 }catch(e){send(e.status||500,{error:e.status?e.message:'No se pudo guardar. Revisá el servidor.'});if(!e.status)console.error('Error interno de almacenamiento o servidor. Revisá la conexión y configuración.');}
});
server.listen(Number(process.env.PORT||3000),process.env.HOST||'127.0.0.1',()=>console.log('BOGA CRM iniciado en puerto '+(process.env.PORT||3000)));

async function shutdown(){server.close(async()=>{await db.close();process.exit(0);});setTimeout(()=>process.exit(1),10000).unref();}
process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
