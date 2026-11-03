import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { readFileSync } from 'node:fs';
const scrypt = promisify(scryptCallback);
export async function createAuth(db, root) {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  const production = process.env.NODE_ENV === 'production';
  const enabled = production || process.env.HOST === '0.0.0.0' || !!username || !!password;
  if (enabled && (!username || !password || (password.length < 12 || password.length > 1000))) {
    throw new Error('Configurá ADMIN_USERNAME y ADMIN_PASSWORD (mínimo 12 caracteres) antes de habilitar acceso remoto.');
  }
  const appUrl = process.env.APP_URL || process.env.RENDER_EXTERNAL_URL;
  if (production && (!appUrl || new URL(appUrl).protocol !== 'https:')) {
    throw new Error('En producción, APP_URL debe ser la dirección HTTPS pública de la app.');
  }
  const secure = production || appUrl?.startsWith('https:');
  const cookieName = secure ? '__Host-boga_session' : 'boga_session';
  const cookie = (value, age) => `${cookieName}=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${age}${secure ? '; Secure' : ''}`;
  const salt = randomBytes(16);
  const expected = enabled ? await scrypt(password, salt, 64) : null;
  const authVersion = enabled ? (await scrypt(password,'BOGA-session-v1:'+username,32)).toString('hex') : '';
  // Names belong to the account identity, not to a device or a password version.
  const profileId='profile-'+createHash('sha256').update('BOGA-account:'+ (username||'local')).digest('hex');
  async function profile(){
    const row=await db.prepare("SELECT body FROM records WHERE kind='userProfiles' AND id=?").get(profileId);
    return {id:profileId,username:username||'Usuario local',displayName:row?JSON.parse(row.body).displayName:username||'Usuario local'};
  }
  await db.exec('CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, expires BIGINT NOT NULL, version TEXT NOT NULL); CREATE TABLE IF NOT EXISTS login_limit (id BIGINT PRIMARY KEY, count BIGINT NOT NULL, until_at BIGINT NOT NULL);');
  await db.prepare('DELETE FROM sessions WHERE expires < ? OR version != ?').run(Date.now(), authVersion);
  async function authorized(req) {
    if (!enabled) return true;
    const token = (req.headers.cookie || '').split(';').map(s => s.trim()).find(s => s.startsWith(cookieName+'='))?.slice(cookieName.length+1);
    if (!token || !/^[a-f0-9]{64}$/.test(token)) return false;
    const session = await db.prepare('SELECT expires,version FROM sessions WHERE token=?').get(createHash('sha256').update(token).digest('hex'));
    return !!session && session.expires > Date.now() && session.version === authVersion;
  }
  function sameOrigin(req) {
    const origin = req.headers.origin;
    if (!origin) return true;
    if (appUrl) return origin === new URL(appUrl).origin;
    return ['http://'+req.headers.host, 'https://'+req.headers.host].includes(origin);
  }
  async function handle(req, res, pathname) {
    if (pathname === '/healthz') {
      await db.prepare('SELECT 1').get(); res.writeHead(200, {'Content-Type':'application/json'}); res.end('{"status":"ok"}'); return true;
    }
    if (pathname === '/login' && req.method === 'GET') {
      if (!enabled || await authorized(req)) {res.writeHead(303,{Location:'/'});res.end();return true;}
      res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});
      res.end(readFileSync(root+'/public/login.html'));return true;
    }
    if (pathname === '/api/login' && req.method === 'POST') {
      if (!sameOrigin(req)) {res.writeHead(403);res.end();return true;}
      if (!enabled) {res.writeHead(200,{'Content-Type':'application/json'});res.end('{}');return true;}
      let raw = '';
      for await (const chunk of req) {raw += chunk; if (raw.length > 4096) {res.writeHead(413);res.end();return true;}}
      let input;try{input=JSON.parse(raw);}catch{input={};}
      // Atomic across requests, restarts and PostgreSQL connections.
      const limit = await db.prepare(`INSERT INTO login_limit(id,count,until_at) VALUES(1,1,?) ON CONFLICT(id) DO UPDATE SET count=CASE WHEN login_limit.until_at > ? THEN login_limit.count+1 ELSE 1 END,until_at=CASE WHEN login_limit.until_at > ? THEN login_limit.until_at ELSE ? END RETURNING count,until_at`).get(Date.now()+900000,Date.now(),Date.now(),Date.now()+900000);
      if (limit.count > 10) {res.writeHead(429,{'Content-Type':'application/json','Retry-After':String(Math.ceil((Number(limit.until_at)-Date.now())/1000))});res.end(JSON.stringify({error:'Demasiados intentos. Esperá 15 minutos antes de volver a intentar.'}));return true;}
      const candidate = await scrypt(typeof input.password==='string' ? input.password.slice(0,1000) : '', salt, 64);
      if (input.username !== username || !timingSafeEqual(candidate,expected)) {
        res.writeHead(401,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'Usuario o contraseña incorrectos.'}));return true;
      }
      await db.prepare('DELETE FROM login_limit').run();
      await db.prepare('DELETE FROM sessions WHERE expires < ?').run(Date.now());
      const token = randomBytes(32).toString('hex');
      await db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(createHash('sha256').update(token).digest('hex'),Date.now()+7*86400000,authVersion);
      res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store','Set-Cookie':cookie(token,7*86400)});res.end('{}');return true;
    }
    if (pathname === '/api/logout' && req.method === 'POST') {
      if (!sameOrigin(req)) {res.writeHead(403);res.end();return true;}
      const token = (req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(cookieName+'='))?.slice(cookieName.length+1);
      if (token) await db.prepare('DELETE FROM sessions WHERE token=?').run(createHash('sha256').update(token).digest('hex'));
      res.writeHead(200,{'Content-Type':'application/json','Set-Cookie':cookie('',0)});res.end('{}');return true;
    }
    if (['/login.js','/style.css'].includes(pathname) || pathname.startsWith('/fonts/')) return false;
    if (!await authorized(req)) {
      if (pathname.startsWith('/api/')) {res.writeHead(401,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({error:'Tu sesión terminó. Volvé a iniciar sesión.'}));}
      else {res.writeHead(303,{Location:'/login','Cache-Control':'no-store'});res.end();}
      return true;
    }
    if(pathname==='/api/me'){
      const json=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
      if(!sameOrigin(req)){json(403,{error:'Origen no permitido.'});return true;}
      if(req.method==='GET'){json(200,await profile());return true;}
      if(req.method!=='PUT'){json(405,{error:'Método no permitido.'});return true;}
      let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>4096){json(413,{error:'Nombre demasiado largo.'});return true;}}
      let input;try{input=JSON.parse(raw);}catch{json(400,{error:'Datos inválidos.'});return true;}
      const displayName=typeof input?.displayName==='string'?input.displayName.trim():'';
      if(!displayName||displayName.length>80||/[\u0000-\u001f\u007f]/.test(displayName)){json(400,{error:'Ingresá un nombre de entre 1 y 80 caracteres.'});return true;}
      const value={id:profileId,displayName};
      await db.prepare("INSERT INTO records(kind,id,body) VALUES('userProfiles',?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body").run(profileId,JSON.stringify(value));
      json(200,await profile());return true;
    }
    return false;
  }
  return {handle, sameOrigin};
}
