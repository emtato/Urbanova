import { mkdirSync,writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT } from '../config.js';
import { configuredKnowledgeLibrary } from '../research/papiers.js';
try{
  const library=configuredKnowledgeLibrary();
  if(library.mode==='unconnected')throw Error('Set PAPIERS_TOKEN in the saved root .env, then rerun npm run papiers:check --prefix backend/server.');
  const result=await library.read('incoming_load');
  if(!result.receipt||!result.notes.length)throw Error('No matching readable library item. Add a relevant transit/crowding note or paper to Papiers, then retry.');
  mkdirSync(resolve(ROOT,'data/cache'),{recursive:true});
  writeFileSync(resolve(ROOT,'data/cache/papiers-read-proof.json'),JSON.stringify({verified_at:new Date().toISOString(),...result},null,2),{mode:0o600});
  console.log(JSON.stringify({status:'ok',transport:'official_papiers_cli',read_only:true,receipt:result.receipt,note_ids:result.notes.map(n=>n.id),signals:result.notes.map(n=>n.signal)}));
}catch(e){console.error(e instanceof Error?e.message:'Papiers verification failed.');process.exitCode=1;}
