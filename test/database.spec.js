import { test, expect } from '@playwright/test';
import { createDatabase } from '../database.js';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
test('PostgreSQL: esquema privado, rollback e información persistente al reabrir',async()=>{
 const saved={DB_DRIVER:process.env.DB_DRIVER,DATA_DIR:process.env.DATA_DIR};
 process.env.DB_DRIVER='pglite';process.env.DATA_DIR=await mkdtemp(path.join(tmpdir(),'boga-postgres-'));
 let db;
 try{
  db=await createDatabase();
  expect((await db.prepare('SELECT table_schema AS name FROM information_schema.tables WHERE table_name=?').get('records')).name).toBe('boga_private');
  await db.prepare('INSERT INTO records(kind,id,body) VALUES(?,?,?)').run('clients','persistent-client',JSON.stringify({id:'persistent-client',name:'Persistente'}));
  await expect(db.transaction(async tx=>{await tx.prepare('DELETE FROM records').run();throw Error('rollback requerido');})).rejects.toThrow('rollback requerido');
  expect((await db.prepare('SELECT count(*) AS n FROM records').get()).n).toBe(1);
  await db.close();db=await createDatabase();
  expect(JSON.parse((await db.prepare('SELECT body FROM records WHERE id=?').get('persistent-client')).body).name).toBe('Persistente');
 }finally{await db?.close();for(const [key,value] of Object.entries(saved))value===undefined?delete process.env[key]:process.env[key]=value;}
});
