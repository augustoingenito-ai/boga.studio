import http from 'node:http';
import { createAuth } from './auth.js';
import { backup } from 'node:sqlite';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync, existsSync, readdirSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
const root=path.dirname(fileURLToPath(import.meta.url));
const dir=process.env.DATA_DIR||path.join(root,'data'); mkdirSync(dir,{recursive:true});
const db=new DatabaseSync(path.join(dir,'boga.sqlite')); db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS records (kind TEXT NOT NULL,id TEXT PRIMARY KEY,body TEXT NOT NULL);');
const auth=await createAuth(db,root);
const kinds=['clients','quotes','jobs','notes'];
const list=k=>db.prepare('SELECT body FROM records WHERE kind=? ORDER BY rowid DESC').all(k).map(r=>JSON.parse(r.body));
const get=(k,id)=>{const r=db.prepare('SELECT body FROM records WHERE kind=? AND id=?').get(k,id);return r?JSON.parse(r.body):null;};
const error=(message,status=400)=>Object.assign(new Error(message),{status});
function validate(k,v){
 if(k==='clients'&&!String(v.name||'').trim()) throw error('El nombre del cliente es obligatorio.');
 if(k!=='clients'&&!get('clients',v.clientId))throw error('Seleccioná un cliente existente.');
 if(['quotes','jobs'].includes(k)&&!String(v.title||'').trim())throw error('El título es obligatorio.');
 if(k==='quotes'){
 if(!['Branding','Diseño'].includes(v.type))throw error('Tipo de presupuesto inválido.');
 if(!['Borrador','Enviado','Aprobado','Rechazado','Vencido'].includes(v.status))throw error('Estado inválido.');
 if(!Array.isArray(v.items)||!v.items.length||v.items.some(i=>!i.service?.trim()||!Number.isFinite(i.quantity)||i.quantity<=0||!Number.isFinite(i.price)||i.price<0))throw error('Revisá los servicios, cantidades y precios.');
 v.total=v.items.reduce((s,i)=>s+i.quantity*i.price,0);
 if(!Number.isFinite(v.paid)||v.paid<0||v.paid>v.total)throw error('El cobro debe estar entre cero y el total.');
 if(v.attachment&&(!/^data:(image\/(png|jpeg|webp)|application\/pdf);base64,[A-Za-z0-9+/=]+$/.test(v.attachment.data)||v.attachment.data.length>7000000))throw error('Adjuntá un PDF o imagen de hasta 5 MB.');
 }
 if(k==='jobs'){
 if(!['Brief','Diseño','Revisión','Entrega','Finalizado'].includes(v.stage))throw error('Etapa inválida.');
 if(v.quoteId){const q=get('quotes',v.quoteId);if(!q||q.clientId!==v.clientId||q.status!=='Aprobado')throw error('El trabajo requiere un presupuesto aprobado del mismo cliente.');}
 }
 if(k==='notes'&&!String(v.text||'').trim())throw error('Escribí una nota.');
 for(const key of ['due','followup','date','validUntil'])if(v[key]&&!/^\d{4}-\d{2}-\d{2}$/.test(v[key]))throw error('Fecha inválida.');
 return v;
}
function save(k,v){db.prepare('INSERT OR REPLACE INTO records(kind,id,body) VALUES(?,?,?)').run(k,v.id,JSON.stringify(v));return v;}
mkdirSync(path.join(dir,'backups'),{recursive:true});
async function snapshot(){const day=new Date().toISOString().slice(0,10);await backup(db,path.join(dir,'backups',day+'.sqlite'));const files=readdirSync(path.join(dir,'backups')).filter(f=>/^\d{4}-\d{2}-\d{2}\.sqlite$/.test(f)).sort().reverse();for(const f of files.slice(14))unlinkSync(path.join(dir,'backups',f));}
await snapshot();
const backupTimer=setInterval(()=>snapshot().catch(()=>console.error('No se pudo crear el respaldo diario. Revisá el disco.')),86400000);backupTimer.unref();
const server=http.createServer(async(req,res)=>{
 const send=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
 try{
 res.setHeader('X-Content-Type-Options','nosniff');
 res.setHeader('Referrer-Policy','same-origin');
 res.setHeader('X-Frame-Options','DENY');
 res.setHeader('Content-Security-Policy',"default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; font-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'; frame-ancestors 'none'; form-action 'self'");
 const url=new URL(req.url,'http://localhost');
 if(await auth.handle(req,res,url.pathname))return;
 if(url.pathname.startsWith('/api/')){
 if(!auth.sameOrigin(req))throw error('Origen no permitido.',403);
 if(url.pathname==='/api/backup'&&req.method==='GET'){const content=JSON.stringify({version:1,exportedAt:new Date().toISOString(),...Object.fromEntries(kinds.map(k=>[k,list(k)]))},null,2);res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store','Content-Disposition':'attachment; filename="boga-respaldo.json"'});res.end(content);return;}
 const [, , k,id]=url.pathname.split('/');
 if(k==='state'&&req.method==='GET')return send(200,Object.fromEntries(kinds.map(k=>[k,list(k)])));
 if(!kinds.includes(k))throw error('Ruta inexistente.',404);
 if(req.method==='DELETE'){
 if(!get(k,id))throw error('Registro inexistente.',404);
 if(k==='clients'&&['quotes','jobs','notes'].some(t=>list(t).some(v=>v.clientId===id)))throw error('El cliente tiene registros vinculados.');
 if(k==='quotes'&&list('jobs').some(v=>v.quoteId===id))throw error('El presupuesto tiene un trabajo vinculado.');
 db.prepare('DELETE FROM records WHERE kind=? AND id=?').run(k,id);return send(200,{ok:true});
 }
 if(!['POST','PUT'].includes(req.method))throw error('Método no permitido.',405);
 let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>7500000)throw error('Archivo demasiado grande.',413);}
 let body;try{body=JSON.parse(raw);}catch{throw error('Datos inválidos.');}
 const old=id?get(k,id):null;if(id&&!old)throw error('Registro inexistente.',404);
 if(!body||typeof body!=='object'||Array.isArray(body))throw error('Datos inválidos.');
 const v=validate(k,{...old,...body,id:id||randomUUID(),createdAt:old?.createdAt||new Date().toISOString()});
 if(k==='quotes'&&list('jobs').some(j=>j.quoteId===v.id&&(v.status!=='Aprobado'||j.clientId!==v.clientId)))throw error('El presupuesto vinculado a un trabajo debe mantener su cliente y su aprobación.');
 return send(id?200:201,save(k,v));
 }
 if(/^\/fonts\/[a-z0-9-]+\.woff2$/.test(url.pathname)){const fp=path.join(root,'public',url.pathname);if(existsSync(fp)){res.writeHead(200,{'Content-Type':'font/woff2','Cache-Control':'public, max-age=86400'});return res.end(readFileSync(fp));}}
 const files={'/':'index.html','/login.js':'login.js','/app.js':'app.js','/style.css':'style.css'};const f=files[url.pathname];
 if(!f){res.writeHead(404);return res.end('No encontrado');}
 res.writeHead(200,{'Content-Type':f.endsWith('html')?'text/html; charset=utf-8':f.endsWith('css')?'text/css':'text/javascript','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; font-src 'self'; frame-src data:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'"});res.end(readFileSync(path.join(root,'public',f)));
 }catch(e){send(e.status||500,{error:e.status?e.message:'No se pudo guardar. Revisá el servidor.'});if(!e.status)console.error(e);}
});
server.listen(Number(process.env.PORT||3000),process.env.HOST||'127.0.0.1',()=>console.log('BOGA CRM iniciado en puerto '+(process.env.PORT||3000)));
