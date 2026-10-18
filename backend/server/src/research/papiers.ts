import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import * as z from 'zod';
import { ROOT } from '../config.js';
import type { KnowledgeLibrary } from './knowledge.js';
import { unconnectedLibrary } from './knowledge.js';
import type { Knob,KnowledgeNote } from './contracts.js';

export type PapiersCommand=(args:string[])=>Promise<unknown>;
const id=z.string().regex(/^(doc|pas|hl|nte|cnv|eq)_[A-Za-z0-9_-]+$/);
const Search=z.object({schemaVersion:z.literal('papiers.search.v1').optional(),requestId:z.string().min(1),results:z.array(z.object({id,kind:z.string(),evidence:z.array(z.object({id,kind:z.string().optional()})).optional()}))});
const Read=z.object({schemaVersion:z.literal('papiers.read.v1').optional(),requestId:z.string().min(1),items:z.array(z.object({id,kind:z.string(),ok:z.boolean(),format:z.string().optional(),content:z.string().max(12000).optional(),truncated:z.boolean().optional(),metadata:z.record(z.string(),z.unknown()).optional()}))});

// Execute the package's real entrypoint directly, avoiding shell interpolation
// and the CLI bin wrapper's synchronous grandchild. Never put a token in argv.
export function papiersCommand(token:string):PapiersCommand{return args=>new Promise((accept,reject)=>{
  const entry=createRequire(import.meta.url).resolve('papiers');
  const child=spawn(process.execPath,[entry,...args],{cwd:resolve(ROOT,'backend/server'),windowsHide:true,
    env:{PATH:process.env.PATH,SystemRoot:process.env.SystemRoot,PAPIERS_TOKEN:token,PAPIERS_API_BASE_URL:'https://api.papiers.ai'},stdio:['ignore','pipe','pipe']});
  let output='',settled=false;
  const fail=()=>{if(settled)return;settled=true;clearTimeout(timer);child.kill();reject(Error('Papiers CLI read unavailable; check token and library access.'));};
  const timer=setTimeout(fail,25000);
  child.stdout.setEncoding('utf8');
  child.stdout.on('data',chunk=>{output+=chunk;if(Buffer.byteLength(output)>128*1024)fail();});
  child.stderr.resume();child.once('error',fail);
  child.once('close',code=>{if(settled)return;if(code!==0){fail();return;}settled=true;clearTimeout(timer);try{accept(JSON.parse(output));}catch{reject(Error('Invalid Papiers CLI JSON'));}});
});}
const queries:Record<Knob,string[]>={incoming_load:['incoming load','streetcar','505'],demand_case:['trip generation','transit share','housing'],service_frequency:['headway','fleet','streetcar']};
function sourceKnob(text:string,requested:Knob):Knob{
  const hits:Knob[]=[];
  if(/incoming\s+(?:passenger\s+)?load|arrival\s+occupancy/i.test(text))hits.push('incoming_load');
  if(/trip generation|household size|transit share|residents per unit/i.test(text))hits.push('demand_case');
  if(/headway|fleet|service frequency|extra vehicles/i.test(text))hits.push('service_frequency');
  // A unique explicit topic can differ from the search topic. This tags context,
  // never extracts a number or silently enforces a note as an instruction.
  return hits.length===1?hits[0]:requested;
}
export class PapiersLibrary implements KnowledgeLibrary{
  readonly mode='papiers_live' as const;
  readonly readOnly=true;
  constructor(private command:PapiersCommand){}
  async read(knob:Knob){
    let search:z.infer<typeof Search>|undefined;
    const attempted_queries:string[]=[];
    for(const query of queries[knob]){
      attempted_queries.push(query);
      search=Search.parse(await this.command(['search',query,'--limit','5','--json']));
      if(search.results.length)break;
    }
    if(!search)throw Error('No library query configured');
    const candidates=search.results.flatMap(result=>[...result.evidence??[],result]);
    // Human judgment first; saved-only sources are curation, not team expertise.
    const ids=[...new Set(candidates.sort((a,b)=>Number(/^(nte|hl|cnv)_/.test(b.id))-Number(/^(nte|hl|cnv)_/.test(a.id))).map(r=>r.id))].slice(0,4);
    if(!ids.length)return {notes:[]};
    const read=Read.parse(await this.command(['read',...ids,'--format','plain','--max-chars-per-item','4000','--json']));
    if(read.items.length!==ids.length||read.items.some((item,i)=>item.id!==ids[i]))throw Error('Papiers returned different item IDs');
    const retrieved_at=new Date().toISOString();
    const notes:KnowledgeNote[]=read.items.filter(item=>item.ok&&item.content?.trim()).map(item=>({
      id:item.id,title:String(item.metadata?.title??item.metadata?.attachedTitle??`Papiers ${item.kind} ${item.id}`).slice(0,300),
      author:'Author not supplied by Papiers CLI',text:item.content!,knob:sourceKnob(item.content!,knob),mode:'papiers_live',retrieved_at,
      signal:/^(nte|hl|cnv)_/.test(item.id)?'human_judgment':'curation',
      locator:`${item.kind}; request ${read.requestId}; truncated=${item.truncated===true}`,
    }));
    if(!notes.length)return {notes:[]};
    return {notes,receipt:{document_id:notes[0].id,retrieved_at,request_id:read.requestId,search_request_id:search.requestId,item_ids:notes.map(n=>n.id),attempted_queries}};
  }
  async write():Promise<{receipt:string}>{throw Error('Official Papiers CLI is read-only. Export this finding for manual saving.');}
}
export function configuredKnowledgeLibrary():KnowledgeLibrary{
  const token=process.env.PAPIERS_TOKEN?.trim();
  return token?new PapiersLibrary(papiersCommand(token)):unconnectedLibrary;
}
