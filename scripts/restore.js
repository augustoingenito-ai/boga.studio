// Run only with the server stopped: DATA_DIR=/var/data node scripts/restore.js backup.json
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
const input=process.argv[2];if(!input)throw Error('Indicá el archivo JSON de respaldo.');
const state=JSON.parse(readFileSync(input,'utf8'));
if(state.version!==1||!['clients','quotes','jobs','notes'].every(k=>Array.isArray(state[k])))throw Error('Respaldo inválido.');
const records=['clients','quotes','jobs','notes'].flatMap(kind=>state[kind].map(v=>({kind,v})));
const ids=new Set();for(const {v} of records){if(typeof v.id!=='string'||!v.id||ids.has(v.id))throw Error('IDs inválidos o duplicados.');ids.add(v.id);}
const clients=new Set(state.clients.map(v=>v.id));for(const {kind,v} of records)if(kind!=='clients'&&!clients.has(v.clientId))throw Error('Cliente vinculado inexistente.');
const dir=process.env.DATA_DIR||path.resolve('data');mkdirSync(dir,{recursive:true});
const db=new DatabaseSync(path.join(dir,'boga.sqlite'));db.exec('CREATE TABLE IF NOT EXISTS records (kind TEXT NOT NULL,id TEXT PRIMARY KEY,body TEXT NOT NULL);');
if(db.prepare('SELECT count(*) AS n FROM records').get().n)throw Error('La base destino debe estar vacía. Conservá el directorio anterior antes de restaurar.');
db.exec('BEGIN');try{const insert=db.prepare('INSERT INTO records VALUES(?,?,?)');for(const {kind,v} of records)insert.run(kind,v.id,JSON.stringify(v));db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}finally{db.close();}
console.log(`Restaurados ${records.length} registros. Las sesiones no se importan.`);
