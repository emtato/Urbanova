import { readFileSync } from 'node:fs';
import { PgStore } from '../storage/store.js';
import { PgAuditRepository } from '../research/repository.js';
import { InvestigationService } from '../research/service.js';
import { gemini } from '../ai/gemini.js';
import { resolve } from 'node:path';
import { ROOT } from '../config.js';
import { configuredKnowledgeLibrary } from '../research/papiers.js';

// JSON files preserve actual newlines and keep credentials out of shell history.
const [command,idOrFile,file]=process.argv.slice(2),store=new PgStore();
const jsonFile=(path:string)=>JSON.parse(readFileSync(resolve(ROOT,path),'utf8').replace(/^\uFEFF/,''));
try{
  await store.init();const service=new InvestigationService(new PgAuditRepository(store.pool),undefined,configuredKnowledgeLibrary(),process.env.RESEARCH_GEMINI_ENABLED==='true'?gemini(store):undefined);
  let a;
  if(command==='start')a=await service.start(idOrFile?jsonFile(idOrFile):{});
  else if(command==='show')a=await service.get(idOrFile);
  else if(command==='redirect')a=await service.redirect(idOrFile,jsonFile(file));
  else if(command==='note')a=await service.addNote(idOrFile,jsonFile(file));
  else throw Error('Use: investigate start [request.json] | show ID | redirect ID input.json | note ID input.json');
  if(command==='start'||command==='redirect'){
    console.error(`Investigation ${a.id}: running matched-seed B11 experiments; the next pause requires actual human input.`);
    while(a.status==='queued'||a.status==='running'){
      await service.tick();a=await service.get(a.id);
      if(a.status==='running')await new Promise(r=>setTimeout(r,1000));
    }
  }
  console.log(JSON.stringify({id:a.id,status:a.status,selection:a.selection,finding:a.finding,writeback:a.writeback,human_question:a.events.findLast(e=>e.type==='human_question')?.payload},null,2));
}catch(e){console.error(e instanceof Error&&e.message.startsWith('Use:')?e.message:'Investigation unavailable; check configuration and input JSON.');process.exitCode=1;}
finally{await store.close();}
