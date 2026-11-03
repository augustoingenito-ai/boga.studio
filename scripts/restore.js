// Run only with the server stopped: DATA_DIR=/var/data node scripts/restore.js backup.json
import { createDatabase } from '../database.js';
import { readFileSync } from 'node:fs';
import path from 'node:path';
const input=process.argv[2];if(!input)throw Error('Indicá el archivo JSON de respaldo.');
const state=JSON.parse(readFileSync(input,'utf8'));
if(state.version!==1||!['clients','quotes','jobs','notes'].every(k=>Array.isArray(state[k])))throw Error('Respaldo inválido.');
for(const k of ['whatsappMessages','whatsappStatuses']){if(state[k]===undefined)state[k]=[];if(!Array.isArray(state[k]))throw Error('Respaldo WhatsApp inválido.');}
const records=['clients','quotes','jobs','notes','whatsappMessages','whatsappStatuses'].flatMap(kind=>state[kind].map(v=>({kind,v})));
const ids=new Set();for(const {v} of records){if(typeof v.id!=='string'||!v.id||ids.has(v.id))throw Error('IDs inválidos o duplicados.');ids.add(v.id);}
const clients=new Set(state.clients.map(v=>v.id));for(const {kind,v} of records)if(!['clients','whatsappStatuses'].includes(kind)&&!clients.has(v.clientId))throw Error('Cliente vinculado inexistente.');
const db=await createDatabase();
try{await db.transaction(async tx=>{
 if(Number((await tx.prepare('SELECT count(*) AS n FROM records').get()).n))throw Error('La base destino debe estar vacía. Conservá el directorio anterior antes de restaurar.');
 const insert=tx.prepare('INSERT INTO records(kind,id,body) VALUES(?,?,?)');
 for(const {kind,v} of records)await insert.run(kind,v.id,JSON.stringify(v));
});}finally{await db.close();}
console.log(`Restaurados ${records.length} registros. Las sesiones no se importan.`);
