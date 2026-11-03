import { test, expect } from '@playwright/test';
import { mkdtemp, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
const exec=promisify(execFile);
test.use({baseURL:'http://127.0.0.1:3102'});
const credentials={username:'test-admin',password:'test-password-only-1234'};
test('acceso privado: bloqueo anónimo, login, exportación y cierre de sesión',async({page,request})=>{
 expect((await request.get('/api/state')).status()).toBe(401);
 expect((await request.get('/api/backup')).status()).toBe(401);
 await page.goto('/');await expect(page).toHaveURL(/\/login$/);
 await page.getByLabel('Usuario',{exact:true}).fill(credentials.username);await page.getByLabel('Contraseña',{exact:true}).fill('incorrecta');await page.getByRole('button',{name:'Ingresar a mi estudio'}).click();await expect(page.getByRole('alert')).toContainText('incorrectos');
 await page.getByLabel('Contraseña',{exact:true}).fill(credentials.password);await page.getByRole('button',{name:'Ingresar a mi estudio'}).click();await expect(page.getByRole('heading',{name:'Tu estudio, en perspectiva.'})).toBeVisible();
 await page.reload();await expect(page.getByRole('heading',{name:'Tu estudio, en perspectiva.'})).toBeVisible();
 const exported=await page.request.get('/api/backup');expect(exported.ok()).toBe(true);expect(await exported.json()).toMatchObject({version:1,clients:[],quotes:[]});
 await page.getByRole('button',{name:'Salir',exact:true}).first().click();await expect(page).toHaveURL(/\/login$/);expect((await page.request.get('/api/state')).status()).toBe(401);
 await page.screenshot({path:'/tmp/boga-login.png',fullPage:true});
});
test('protección contra login entre sitios y límite de intentos',async({request})=>{
 expect((await request.post('/api/login',{headers:{Origin:'https://other.example'},data:credentials})).status()).toBe(403);
 for(let i=0;i<10;i++)expect((await request.post('/api/login',{data:{username:'wrong',password:'wrong'}})).status()).toBe(401);
 expect((await request.post('/api/login',{data:credentials})).status()).toBe(429);
 expect((await request.get('/healthz')).status()).toBe(200);
});
test('restauración de un respaldo en disco y negativa a sobrescribir datos',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'boga-restore-'));const file=path.join(dir,'backup.json');
 await writeFile(file,JSON.stringify({version:1,clients:[{id:'client-1',name:'Cliente restaurado'}],quotes:[],jobs:[],notes:[]}));
 const options={cwd:process.cwd(),env:{...process.env,DATA_DIR:dir}};
 await exec(process.execPath,['scripts/restore.js',file],options);
 const verify=await exec(process.execPath,['--input-type=module','-e',`import {DatabaseSync} from 'node:sqlite';const db=new DatabaseSync(process.env.DATA_DIR+'/boga.sqlite');console.log(JSON.parse(db.prepare('SELECT body FROM records').get().body).name);`],options);
 expect(verify.stdout.trim()).toBe('Cliente restaurado');
 await expect(exec(process.execPath,['scripts/restore.js',file],options)).rejects.toThrow(/base destino debe estar vacía/);
});
test('arranque público falla sin credenciales o dirección HTTPS',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'boga-config-'));
 await expect(exec(process.execPath,['server.js'],{env:{...process.env,DATA_DIR:dir,NODE_ENV:'production',ADMIN_USERNAME:'',ADMIN_PASSWORD:''}})).rejects.toThrow(/DATABASE_URL/);
 await expect(exec(process.execPath,['--input-type=module','-e',"import {createAuth} from './auth.js';await createAuth({},'.');"],{env:{...process.env,DATA_DIR:dir,NODE_ENV:'production',ADMIN_USERNAME:credentials.username,ADMIN_PASSWORD:credentials.password,APP_URL:'http://insecure.example'}})).rejects.toThrow(/HTTPS/);
});
