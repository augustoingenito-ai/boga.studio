import { DatabaseSync, backup } from 'node:sqlite';
import { mkdirSync, readdirSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { postgresOptions, connectionError } from './database-config.js';

export async function createDatabase() {
  const remote = !!process.env.DATABASE_URL;
  if (process.env.NODE_ENV === 'production' && !remote) {
    throw new Error('Configurá DATABASE_URL de Supabase antes de publicar. La base local no es persistente en Render gratis.');
  }
  let driver, sqlite;
  if (remote) {
    const { Pool } = await import('pg');
    driver = new Pool(postgresOptions());
    driver.on('error',()=>console.error('Conexión de base de datos interrumpida.'));
  } else if (process.env.DB_DRIVER === 'pglite') {
    // Real PostgreSQL engine for offline integration tests; never selected in production.
    const { PGlite } = await import('@electric-sql/pglite');
    driver = new PGlite(process.env.DATA_DIR);
    await driver.waitReady;
  } else {
    const dir=process.env.DATA_DIR||path.resolve('data');mkdirSync(dir,{recursive:true});
    sqlite=new DatabaseSync(path.join(dir,'boga.sqlite'));sqlite.exec('PRAGMA journal_mode=WAL');
  }
  const qualify=sql=>sql.replace(/(\b(?:FROM|INTO|UPDATE|TABLE IF NOT EXISTS|TABLE)\s+)(records|sessions|login_limit)\b/gi,'$1boga_private.$2');
  const sqlForPg=sql=>{let n=0;return qualify(sql).replace(/\?/g,()=>'$'+(++n));};
  const prepare=(target,sql)=>{const query=async args=>target.query(sqlForPg(sql),args);return {async all(...args){return sqlite?sqlite.prepare(sql).all(...args):(await query(args)).rows;},async get(...args){return sqlite?sqlite.prepare(sql).get(...args):(await query(args)).rows[0];},async run(...args){return sqlite?sqlite.prepare(sql).run(...args):query(args);}};};
  const db={
    async exec(sql) { if(sqlite)return sqlite.exec(sql); for(const statement of sql.split(';').filter(s=>s.trim()))await driver.query(qualify(statement)); },
    prepare(sql) {return prepare(driver,sql);},
    async transaction(work){
      const connection=sqlite?null:(driver.connect?await driver.connect():driver);
      const exec=async sql=>sqlite?sqlite.exec(sql):connection.query(sql);
      await exec('BEGIN');
      try{const result=await work({prepare:sql=>prepare(connection,sql)});await exec('COMMIT');return result;}catch(e){await exec('ROLLBACK');throw e;}finally{connection?.release?.();}
    },
    async close(){if(sqlite)sqlite.close();else if(driver.end)await driver.end();else await driver.close();},
    async snapshot(){
      if(!sqlite)return; // Remote data must be backed up outside Render's ephemeral disk.
      const dir=process.env.DATA_DIR||path.resolve('data'),folder=path.join(dir,'backups');mkdirSync(folder,{recursive:true});
      await backup(sqlite,path.join(folder,new Date().toISOString().slice(0,10)+'.sqlite'));
      const files=readdirSync(folder).filter(f=>/^\d{4}-\d{2}-\d{2}\.sqlite$/.test(f)).sort().reverse();
      for(const f of files.slice(14))unlinkSync(path.join(folder,f));
    }
  };
  try {
  if(driver){await db.exec('CREATE SCHEMA IF NOT EXISTS boga_private; REVOKE ALL ON SCHEMA boga_private FROM PUBLIC;');}
  await db.exec('CREATE TABLE IF NOT EXISTS records (kind TEXT NOT NULL,id TEXT PRIMARY KEY,body TEXT NOT NULL);');
  return db;
  } catch (e) {
    await db.close().catch(()=>{});
    if(remote)throw new Error(connectionError(e.code));
    throw e;
  }
}
