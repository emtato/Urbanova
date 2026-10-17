import { fixture } from '../services/bundle.js';
import { ComparisonSchema, type Comparison, type Scenario } from '../shared/schemas.js';
import { feasibility, type Policy } from './feasibility.js';
import { evaluationPlan,checkedB11Comparison,type B11Adapter } from './plan.js';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { parentPort } from 'node:worker_threads';
import { ROOT } from '../config.js';
import type { EvaluationResult } from '../storage/store.js';
export interface EvaluationRequest {scenario:Scenario;random:{seed_ids:number[];draws_id:string};retain_replay:boolean;policy:Policy|null;evaluator?:'b11'|'fixture';demand_factors?:{low:number;central:number;high:number}}
// B11 must return the frozen Comparison with all phase/demand evaluations and
// paired seed IDs. The stub never relabels fixture metrics as a requested run.
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

function runPython(plan:unknown):Promise<any>{
  const local=resolve(ROOT,process.platform==='win32'?'.venv/Scripts/python.exe':'.venv/bin/python');
  const executable=process.env.PYTHON_EXECUTABLE??(existsSync(local)?local:'python3');
  return new Promise((accept,reject)=>{
    const child=spawn(executable,['-m','backend.integration.b11'],{cwd:ROOT,windowsHide:true,stdio:['pipe','pipe','pipe']});
    if(child.pid)parentPort?.postMessage({type:'child',pid:child.pid});
    let output='',diagnostic='';
    child.stdout.on('data',chunk=>{output+=chunk;if(Buffer.byteLength(output)>64*1024*1024){child.kill();reject(Error('B11 output exceeds limit'));}});
    child.stderr.on('data',chunk=>{diagnostic=(diagnostic+chunk).slice(-3000);});
    child.once('error',()=>reject(Error('Python runtime unavailable')));
    child.once('close',code=>{if(code!==0){console.error(diagnostic);reject(Error('B11 computation failed'));return;}try{accept(JSON.parse(output));}catch{reject(Error('Invalid B11 output'));}});
    child.stdin.on('error',()=>{});child.stdin.end(JSON.stringify(plan));
  });
}
