import { Worker } from 'node:worker_threads';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { ROOT,settings } from '../config.js';
import { reviewed } from '../services/bundle.js';
import { ApiError } from '../core/errors.js';
import { parse } from '../services/validate.js';
import { StartAudit,Redirect,Note,append,provenance,assertCurrent,type Experiment,type Investigation } from './contracts.js';
import { recipes,assess,selectNext,validatePairing,values,paired } from './analysis.js';
import { type AuditRepository } from './repository.js';
import { unconnectedLibrary,type KnowledgeLibrary } from './knowledge.js';
import * as z from 'zod';
import type { Generate } from '../ai/gemini.js';

export type Execute=(request:{seeds:number[];recipes:ReturnType<typeof recipes>})=>Promise<Experiment[]>;
export const execute:Execute=request=>new Promise((accept,reject)=>{
  const worker=new Worker(resolve(ROOT,'backend/server/dist/backend/server/src/research/worker.js'),{workerData:request});
  let pid:number|undefined,settled=false;
  const stop=()=>{if(pid)try{process.kill(pid);}catch{}void worker.terminate();};
  const fail=()=>{if(settled)return;settled=true;clearTimeout(timer);stop();reject(new ApiError(503,'Investigation computation unavailable.'));};
  const timer=setTimeout(fail,settings.jobTimeoutMs);
  worker.on('message',m=>{if(settled)return;if(m.type==='child'){pid=m.pid;return;}if(!m.ok){fail();return;}settled=true;clearTimeout(timer);accept(m.result);});
  worker.once('error',fail);worker.once('exit',()=>{if(!settled)fail();});
});
export class InvestigationService{
  constructor(readonly repo:AuditRepository,private compute:Execute=execute,private library:KnowledgeLibrary=unconnectedLibrary,private generate?:Generate){}
  private async choose(a:Investigation){
    a.selection=selectNext(a);
    const scores=a.selection.scores as Array<{knob:string;score:number|null}>;
    const best=Math.max(...scores.map(s=>s.score??-1));
    const permitted=scores.filter(s=>(s.score??-1)===best).map(s=>s.knob);
    const schema=z.strictObject({knob:z.enum(['incoming_load','demand_case','service_frequency']),note_ids:z.array(z.string()).max(20)});
    const decision=this.generate?await this.generate('research_next_experiment',
      'Choose the next model-assumption experiment for the research team. You cannot invent data or edit numbers. Choose only from permitted_knobs; cite existing relevant note IDs only. The numeric sensitivity/evidence policy is authoritative. Return structured fields only.\n'+JSON.stringify({permitted_knobs:permitted,scores,extra_vehicles_unavailable:a.redirect?.no_extra_vehicles??null,notes:a.notes.map(n=>({id:n.id,knob:n.knob,mode:n.mode}))}),schema):null;
    const accepted=decision&&permitted.includes(decision.knob)&&decision.note_ids.every(id=>a.notes.some(n=>n.id===id&&n.knob===decision.knob));
    if(accepted)a.selection.knob=decision.knob;
    append(a,'agent_decision',{selection:a.selection,chosen_by:accepted?'gemini':'bounded_policy',model:accepted?settings.model:null,cited_note_ids:accepted?decision.note_ids:[],fallback:!accepted});
  }
  async start(input:unknown){
    const request=parse(StartAudit,input??{});
    if(request.stop_id&&!reviewed.inputs.stops.some((s:{id:string})=>s.id===request.stop_id))throw new ApiError(422,'Unknown stop_id. Use a reviewed corridor stop.');
    const a:Investigation={id:randomUUID(),revision:0,status:'queued',stage:'screen',request,stop_id:request.stop_id,events:[],experiments:[],notes:[],provenance:provenance(request),writeback:{status:'pending_connection'}};
    append(a,'investigation_started',{question:'Why does my stop get worse?',scope:'Model assumption audit, not an observed TTC attribution',human:'Research team; reviews evidence and constrains the next experiment',seeds:request.seeds},'system');
    append(a,'prediction_registered',{hypothesis:'Incoming load drives more existing-rider denied boarding than added homes.',metric:'(high incoming − low incoming) − (central homes − no new homes)',minimum_effect:request.minimum_effect,
      stop_selection:request.stop_id??'Exploratory worst central-run stop; selected before evaluating contrast',recipes:recipes(a)});
    await this.repo.create(a);return a;
  }
  async get(id:string){const a=await this.repo.get(id);if(!a)throw new ApiError(404,'Investigation not found.');return a;}
  integrationStatus(){return {transport:this.library.mode,verified_read_required:true,manual_notes_label:'manual_copy',setup:this.library.mode==='unconnected'?'Sponsor integration guide and authorized library connection required. No live read or write is claimed.':'Transport configured; inspect each investigation for a read receipt and write receipt.'};}
  async addNote(id:string,input:unknown){const a=await this.get(id);assertCurrent(a);if(a.status!=='awaiting_human')throw new ApiError(409,'Add research notes while awaiting human review.');
    const note={...parse(Note,input),mode:'manual_copy' as const,retrieved_at:new Date().toISOString()};
    if(a.notes.some(n=>n.id===note.id))throw new ApiError(409,'Note ID already exists; use a new revision ID.');
    a.notes.push(note);append(a,'knowledge_note_added',note,'human');await this.repo.save(a,a.revision);return a;
  }
  async redirect(id:string,input:unknown){const a=await this.get(id);assertCurrent(a);if(a.status!=='awaiting_human')throw new ApiError(409,'Investigation is not awaiting a human redirect.');
    const redirect=parse(Redirect,input);
    if(redirect.no_extra_vehicles&&redirect.headway_s!==undefined&&redirect.headway_s!==reviewed.inputs.headway_s)throw new ApiError(422,'No extra vehicles requires the current headway. Remove the shorter headway.');
    a.redirect=redirect;append(a,'human_redirect',redirect,'human');await this.choose(a);append(a,'next_experiment_reselected',a.selection);
    a.status='queued';a.stage='followup';append(a,'followup_prediction_registered',{recipes:recipes(a),condition:'Housing is held constant; only the selected knob and explicit human settings change.'});await this.repo.save(a,a.revision);return a;
  }
  async tick(){const a=await this.repo.claim();if(!a)return false;
    const revision=a.revision;
    const heartbeat=setInterval(()=>void this.repo.renew(a).catch(()=>false),20000);heartbeat.unref();
    try{
      assertCurrent(a);const plan=recipes(a),experiments=await this.compute({seeds:a.request.seeds,recipes:plan});
      if(JSON.stringify(experiments.map(e=>e.recipe))!==JSON.stringify(plan))throw Error('Experiment recipe mismatch');
      validatePairing(experiments,a.request.seeds);a.experiments.push(...experiments);
      append(a,'experiments_completed',{stage:a.stage,experiments:experiments.map(e=>({recipe:e.recipe,batch_id:e.batch_id,seed_ids:e.runs.map(r=>r.inputs.seed)}))});
      if(a.stage==='screen'){
        assess(a);await this.choose(a);
        try{
          const read=await this.library.read(a.selection!.knob);
          const verified=this.library.mode==='papiers_live'&&Boolean(read.receipt?.document_id&&read.receipt?.retrieved_at);
          if(this.library.mode==='papiers_live'&&!verified)throw Error('Missing read receipt');
          for(const raw of read.notes){const {mode:_mode,retrieved_at:_time,...fields}=raw;const note=Note.parse(fields);a.notes.push({...note,mode:verified?'papiers_live':'manual_copy',retrieved_at:new Date().toISOString()});}
          append(a,'knowledge_read',{mode:verified?'papiers_live':'unconnected',receipt:verified?read.receipt:null,note_ids:read.notes.map(n=>n.id),knob:a.selection!.knob});
        }catch{append(a,'knowledge_read_failed',{mode:this.library.mode,reason:'No verified read; human knowledge is required.'});}
        a.status='awaiting_human';append(a,'human_question',{question:`What bounds or operational constraint should guide ${a.selection!.knob}? Can extra vehicles actually be available at move-in?`,reason:a.notes.length?'Review library context and supply an operational redirect.':'No relevant verified knowledge was available. Do not infer an observed baseline.',needed:['author','note','no_extra_vehicles'],optional:['incoming_load_range','demand_case','headway_s']});
      }else{
        const e=Object.fromEntries(experiments.map(e=>[e.recipe.id,e]));
        const variation=paired(['followup_high','followup_low'].map(id=>values(e[id],a.stop_id!)),v=>v[0]-v[1]);
        a.finding={...a.finding,followup:{knob:a.selection!.knob,variation,recipes:plan,human_constraint:a.redirect},
          resident_answer:`This is a model investigation at ${a.stop_id}. ${a.finding.premise} The initial incoming-load prediction was ${a.finding.classification}. The research team's constraint changed the follow-up experiment. Read the paired effects and tested conditions below; no observed stop baseline or untested threshold is claimed.`};
        append(a,'finding_written_locally',a.finding);a.status='completed';
        try{if(this.library.mode==='papiers_live'&&a.events.some(e=>e.type==='knowledge_read'&&(e.payload as any).mode==='papiers_live')){const result=await this.library.write(a);if(!result.receipt)throw Error('Missing write receipt');a.writeback={status:'written',receipt:result.receipt};append(a,'papiers_write_confirmed',result);}}
        catch{append(a,'papiers_write_pending',{reason:'Write failed; finding remains saved locally for retry or manual export.'});}
      }
      await this.repo.save(a,revision);
    }catch{a.status='failed';a.error='Investigation failed; start a new audit after checking worker configuration.';append(a,'investigation_failed',{error:a.error},'system');await this.repo.save(a,revision);}
    finally{clearInterval(heartbeat);}return true;
  }
  startScheduler(){let busy=false,closing=false;const timer=setInterval(()=>{if(busy||closing)return;busy=true;void this.tick().catch(()=>console.error('Investigation worker unavailable')).finally(()=>busy=false);},1000);timer.unref();return async()=>{closing=true;clearInterval(timer);while(busy)await new Promise(r=>setTimeout(r,100));};}
}
