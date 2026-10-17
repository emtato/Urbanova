import { fixture, reviewed,dataVersion,simulationModelVersion,allSourceIds } from '../services/bundle.js';
import { ComparisonSchema, NativeBatchSchema, RunSimulationRequestSchema, type Comparison, type Scenario } from '../shared/schemas.js';
import type { NativeBatch } from '../shared/nativeResults.js';
import { invariant } from '../core/errors.js';
import { checkNativeBatch } from '../services/nativeIntegrity.js';
import { parse } from '../services/validate.js';
import { feasibility, type Policy } from './feasibility.js';
import { evaluationPlan,checkedB11Comparison,type B11Adapter } from './plan.js';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { parentPort,isMainThread,Worker } from 'node:worker_threads';
import { createGunzip } from 'node:zlib';
import { ROOT,settings } from '../config.js';
import {ApiError} from '../core/errors.js';
import type { EvaluationResult } from '../storage/store.js';
export interface EvaluationRequest {scenario:Scenario;random:{seed_ids:number[];draws_id:string};retain_replay:boolean;policy:Policy|null;evaluator?:'b11'|'fixture';demand_factors?:{low:number;central:number;high:number};operations?:{warmup_s:number;clearance_s:number}}
// Live results retain native batches and simulator-owned definitions (3.0.0).
// Explicit fixture mode retains the historical 2.0.0 contract.
export async function evaluate(request:EvaluationRequest,adapter?:B11Adapter):Promise<EvaluationResult> {
  if(request.evaluator!=='fixture'){
    const plan={...evaluationPlan(request),retain_replay:request.retain_replay};
    const result=adapter?await adapter.evaluate(plan):await runPython(plan);
    const comparison=checkedB11Comparison(result.comparison,request);
    const delayedComparison=checkedB11Comparison(result.delayedComparison,request,'delayed');
    if(!request.retain_replay)comparison.replay=null;
    return {...result,comparison,delayedComparison,package_screen:feasibility(request.scenario,request.policy),notice:'Computed from B11 with paired sampled corridor cohorts and requested seeds. Modelled incoming loads, dwell and demand factors are assumptions.'};
  }
  const comparison:Comparison=ComparisonSchema.parse(structuredClone(fixture));
  if(!request.retain_replay) comparison.replay=null;
  return {comparison,package_screen:feasibility(request.scenario,request.policy),notice:'EXPLICIT FIXTURE MODE: unchanged contract example, not an evaluation of the requested scenario, seeds or four package screens. Omit evaluator or choose b11 for computed results.'};
}

export async function runSimulationBatch(input:unknown):Promise<NativeBatch> {
  const request=parse(RunSimulationRequestSchema,input??{});
  const defaults=reviewed.inputs;
  const knownDevIds=new Set<string>(defaults.developments.map((d:{id:string})=>d.id));
  if(request.development_ids){
    const unknown=request.development_ids.filter(id=>!knownDevIds.has(id));
    invariant(unknown.length===0,`Unknown development_ids: ${unknown.join(', ')}. Allowed IDs: ${[...knownDevIds].join(', ')}.`);
  }
  if(request.seeds){
    invariant(request.seeds.length===request.run_count,'Supply exactly run_count seeds.');
  }
  const startTime=request.start_time_s??defaults.start_time_s;
  const endTime=request.end_time_s??defaults.end_time_s;
  invariant(startTime<endTime,'start_time_s must be less than end_time_s.');
  const headway=request.headway_s??defaults.headway_s;
  const randomness=request.headway_randomness_s??defaults.headway_randomness_s;
  invariant(randomness>=0&&randomness<headway,'headway_randomness_s must be nonnegative and less than headway_s.');
  const capacity=request.streetcar_capacity??defaults.streetcar_capacity;
  const incoming=request.incoming_load_range??defaults.incoming_load_range;
  invariant(incoming[0]<=incoming[1]&&incoming[1]<=capacity,'incoming_load_range must be ordered and within streetcar_capacity.');
  const dwell=request.stop_dwell_range_s??defaults.stop_dwell_range_s;
  invariant(dwell[0]<=dwell[1],'stop_dwell_range_s must be ordered.');
  const bands=request.parallel_route_bands??defaults.parallel_route_bands;
  invariant(bands[0]<=bands[1],'parallel_route_bands must be ordered.');
  if(isMainThread)return runBatchWorker(request);
  const raw=await runPython(request);
  const batch=checkNativeBatch(NativeBatchSchema.parse(raw));
  return {...batch,provenance:{format_version:'simulation-provenance-v1',configuration_id:batch.id,model_version:simulationModelVersion,data_version:dataVersion,orchestrator_version:settings.modelVersion,source_ids:allSourceIds,recorded_at:new Date().toISOString()}};
}

let batchBusy=false;
function runBatchWorker(request:unknown):Promise<NativeBatch>{
  if(batchBusy)throw new ApiError(429,'A configured simulation is already running; retry after it completes.');
  batchBusy=true;
  return new Promise((accept,reject)=>{
    const worker=new Worker(resolve(ROOT,'backend/server/dist/backend/server/src/worker/simulation.js'),{workerData:request});
    let childPid:number|undefined,settled=false;
    const cleanup=()=>{clearTimeout(timer);batchBusy=false;};
    const abort=()=>{if(childPid)try{process.kill(childPid);}catch{}void worker.terminate();};
    const fail=()=>{if(settled)return;settled=true;abort();cleanup();reject(new ApiError(503,'Simulation unavailable; retry after checking worker logs.'));};
    const timer=setTimeout(fail,settings.jobTimeoutMs);
    worker.on('message',message=>{if(settled)return;if(message.type==='child'){childPid=message.pid;return;}if(!message.ok){fail();return;}settled=true;cleanup();accept(message.result);});
    worker.once('error',fail);worker.once('exit',()=>{if(!settled)fail();});
  });
}

function runPython(plan:unknown):Promise<any>{
  const local=resolve(ROOT,process.platform==='win32'?'.venv/Scripts/python.exe':'.venv/bin/python');
  const executable=process.env.PYTHON_EXECUTABLE??(existsSync(local)?local:'python3');
  return new Promise((accept,reject)=>{
    const limit=Number(process.env.B11_MAX_OUTPUT_BYTES??512*1024*1024);
    if(!Number.isSafeInteger(limit)||limit<1){reject(Error('B11_MAX_OUTPUT_BYTES must be a positive integer'));return;}
    // Python computes only; Node owns persistence and database credentials.
    const child=spawn(executable,['-m','backend.integration.b11','--gzip'],{cwd:ROOT,env:{...process.env,DATABASE_URL:''},windowsHide:true,stdio:['pipe','pipe','pipe']});
    if(child.pid)parentPort?.postMessage({type:'child',pid:child.pid});
    const decoder=createGunzip(),chunks:Buffer[]=[];
    let bytes=0,wireBytes=0,diagnostic='',closed=false,decoded=false,settled=false,exitCode:number|null=null,decodeError:Error|null=null;
    const fail=(error:Error)=>{if(settled)return;settled=true;child.kill();decoder.destroy();chunks.length=0;reject(error);};
    const finish=()=>{
      if(settled||!closed||(!decoded&&!decodeError))return;
      if(decodeError){fail(decodeError);return;}
      settled=true;
      try{accept(JSON.parse(Buffer.concat(chunks).toString('utf8')));}
      catch{reject(Error('Invalid B11 output'));}
      finally{chunks.length=0;}
    };
    child.stdout.on('data',(chunk:Buffer)=>{wireBytes+=chunk.length;if(wireBytes>64*1024*1024)fail(Error('Compressed B11 output exceeds limit'));});
    decoder.on('data',(chunk:Buffer)=>{bytes+=chunk.length;if(bytes>limit){fail(Error('Decoded B11 output exceeds B11_MAX_OUTPUT_BYTES'));return;}chunks.push(chunk);});
    decoder.once('end',()=>{decoded=true;finish();});
    decoder.once('error',()=>{decodeError=Error('Invalid compressed B11 output');finish();});
    child.stdout.pipe(decoder);
    child.stderr.on('data',chunk=>{diagnostic=(diagnostic+chunk).slice(-3000);});
    child.once('error',()=>fail(Error('Python runtime unavailable')));
    child.once('close',code=>{closed=true;exitCode=code;if(exitCode!==0){console.error(diagnostic);fail(Error('B11 computation failed'));return;}finish();});
    child.stdin.on('error',()=>{});child.stdin.end(JSON.stringify(plan));
  });
}
