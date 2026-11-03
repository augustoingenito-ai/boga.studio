import {test,expect} from '@playwright/test';
import {createDatabase} from '../database.js';
import {createAuth} from '../auth.js';
import {Readable} from 'node:stream';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';

test('perfil: nombre persistente, tipografía y marcas del dashboard en escritorio y móvil',async({page,request})=>{
 const original=await (await request.get('/api/me')).json();
 await page.goto('/');await page.getByRole('heading',{name:'Tu estudio, en perspectiva.'}).waitFor();
 await page.getByRole('button',{name:'Editar mi perfil'}).click();await page.getByLabel('Nombre para mostrar',{exact:true}).fill('Martina Berraz');await page.getByRole('button',{name:'Guardar nombre',exact:true}).click();await expect(page.locator('#modal')).not.toBeVisible();
 await expect(page.locator('#profile-name')).toHaveText('Martina Berraz');await expect(page.locator('#profile-initials')).toHaveText('MB');await page.reload();await expect(page.locator('#profile-name')).toHaveText('Martina Berraz');
 await expect(page.getByRole('button',{name:'+ Nuevo presupuesto',exact:true})).toHaveCount(0);await expect(page.getByText('EL DETRÁS DE TU ESTUDIO',{exact:true})).toHaveCount(0);await expect(page.getByText('TU ESPACIO DE TRABAJO',{exact:true})).toHaveCount(0);await expect(page.locator('.hero-art')).toHaveCount(0);
 await expect(page.locator('.logo img')).toHaveAttribute('src','/brand/boga-studio-logo.svg');
 const styles=await page.evaluate(async()=>{await document.fonts.ready;const body=getComputedStyle(document.body),heading=getComputedStyle(document.querySelector('h1')),badge=getComputedStyle(document.querySelector('.badge'));return {loaded:document.fonts.check('14px Coolvetica'),body:body.fontFamily,heading:heading.fontFamily,spacing:parseFloat(body.letterSpacing)/parseFloat(body.fontSize),badgeSpacing:parseFloat(badge.letterSpacing)/parseFloat(badge.fontSize),background:getComputedStyle(document.querySelector('.hero')).backgroundImage};});
 expect(styles.loaded).toBe(true);expect(styles.body).toContain('Coolvetica');expect(styles.heading).toContain('Coolvetica');expect(styles.spacing).toBeCloseTo(-.035,4);expect(styles.badgeSpacing).toBeCloseTo(-.035,4);expect(styles.background).toContain('/brand/dashboard-watermark.svg');
 await page.screenshot({path:'/tmp/boga-interface-desktop.png',fullPage:true});await page.setViewportSize({width:390,height:844});await expect(page.locator('#profile-name')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'/tmp/boga-interface-mobile.png',fullPage:true});
 await request.put('/api/me',{data:{displayName:original.displayName}});
});

test('perfil: identidad de cuenta separada, sin aceptar otro usuario desde el navegador',async()=>{
 const keys=['ADMIN_USERNAME','ADMIN_PASSWORD','NODE_ENV','HOST','APP_URL','RENDER_EXTERNAL_URL','DATABASE_URL','DATA_DIR','DB_DRIVER'],previous=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
 for(const key of keys)delete process.env[key];process.env.DATA_DIR=await mkdtemp(path.join(tmpdir(),'boga-profiles-'));process.env.DB_DRIVER=process.env.TEST_DB_DRIVER||'';
 const db=await createDatabase();
 async function call(auth,method,pathname,input,cookie){
  const req=Readable.from(input?[JSON.stringify(input)]:[]);req.method=method;req.headers={host:'localhost',...(cookie?{cookie}:{})};let status,headers,raw;
  const res={writeHead(code,value){status=code;headers=value;},end(value){raw=value;}};
  expect(await auth.handle(req,res,pathname)).toBe(true);return {status,headers,body:raw?JSON.parse(raw):null};
 }
 async function login(username){
  process.env.ADMIN_USERNAME=username;process.env.ADMIN_PASSWORD='profile-test-password-1234';const auth=await createAuth(db,process.cwd());
  expect((await call(auth,'GET','/api/me')).status).toBe(401);
  const logged=await call(auth,'POST','/api/login',{username,password:process.env.ADMIN_PASSWORD});expect(logged.status).toBe(200);return {auth,cookie:logged.headers['Set-Cookie'].split(';')[0]};
 }
 try{
  const first=await login('martina');let me=await call(first.auth,'PUT','/api/me',{displayName:'Martina Berraz',username:'otro',id:'otra-cuenta'},first.cookie);expect(me.body.username).toBe('martina');expect(me.body.displayName).toBe('Martina Berraz');const firstId=me.body.id;
  expect((await call(first.auth,'PUT','/api/me',{displayName:''},first.cookie)).status).toBe(400);
  const second=await login('otro');me=await call(second.auth,'GET','/api/me',null,second.cookie);expect(me.body.displayName).toBe('otro');expect(me.body.id).not.toBe(firstId);await call(second.auth,'PUT','/api/me',{displayName:'Otro usuario'},second.cookie);
  const again=await login('martina');me=await call(again.auth,'GET','/api/me',null,again.cookie);expect(me.body).toMatchObject({id:firstId,username:'martina',displayName:'Martina Berraz'});
 }finally{await db.close();for(const key of keys){if(previous[key]===undefined)delete process.env[key];else process.env[key]=previous[key];}}
});
