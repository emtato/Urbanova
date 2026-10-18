import { randomUUID } from 'node:crypto';
import { type Store, type Job, type PastRun, formatSimulationTimestamp } from '../src/storage/store.js';
import { defaultScenario } from '../src/services/bundle.js';
import { NativeBatchSchema, type Comparison,type Scenario, type NativeReplay } from '../src/shared/schemas.js';
import type { NativeBatch } from '../src/shared/nativeResults.js';
import { checkNativeBatch } from '../src/services/nativeIntegrity.js';
export function memoryStore():Store {
  const scenarios=new Map([[defaultScenario.scenario_id,[structuredClone(defaultScenario)]]]);
  const jobs=new Map<string,Job>(),results=new Map<string,Comparison>(),keys=new Map<string,string>();
  const delays=new Map<string,Comparison>();
  const native=new Map<string,NativeReplay>();
  const metrics=new Map<string,{run_id:string;summary:unknown}[]>(),history:PastRun[]=[];
  const simulations=new Map<string,NativeBatch>();
  return {
    async ping(){},async init(){},async close(){},async audit(){},
    async scenario(id,version){const all=scenarios.get(id);return structuredClone(all?.find(s=>version?s.version===version:s.version===all.at(-1)!.version)??null);},
    async saveScenario(s){const all=scenarios.get(s.scenario_id)??[];if(s.version!==(all.at(-1)?.version??0)+1)throw Error('conflict');scenarios.set(s.scenario_id,[...all,structuredClone(s)]);for(const job of jobs.values())if(job.scenario_id===s.scenario_id)job.stale=true;},
    async enqueue(s,key,payload){const cached=keys.get(key);if(cached)return jobs.get(cached)!;const job:Job={job_id:randomUUID(),scenario_id:s.scenario_id,scenario_version:s.version,status:'queued',comparison_id:null,error:null,stale:false,notice:'',package_screen:null,payload,lease_token:''};jobs.set(job.job_id,job);keys.set(key,job.job_id);return job;},
    async job(id){return jobs.get(id)??null;},
    async claim(){const job=[...jobs.values()].find(j=>j.status==='queued');if(!job)return null;job.status='running';job.lease_token=randomUUID();return job;},
    async fail(job){job.status='failed';job.error='Evaluation unavailable';},
    async renew(){return true;},async nativeReplay(id){return structuredClone(native.get(id)??null);},async nativeMetrics(id){return structuredClone(metrics.get(id)??[]);},
    async pastRuns({scenario_id,limit=20,offset=0}={}){return structuredClone(history.filter(row=>!scenario_id||row.scenario_id===scenario_id).slice(offset,offset+limit));},
    async saveSimulation(batch,name){const simName=(name??batch.name)?.trim()||formatSimulationTimestamp();const checked=checkNativeBatch(NativeBatchSchema.parse(simName?{...batch,name:simName}:batch));simulations.delete(checked.id);simulations.set(checked.id,structuredClone(checked));return structuredClone(checked);},
    async fetchSimulations(){return [...simulations.values()].reverse().map(item=>{const copy=structuredClone(item);if(!copy.name)copy.name=formatSimulationTimestamp();return copy;});},
    async renameSimulation(id,name){const trimmed=name.trim();if(!trimmed||trimmed.length>80)throw Error('invalid name');const item=simulations.get(id);if(!item)return false;item.name=trimmed;return true;},
    async deleteSimulation(id){return simulations.delete(id);},
    async finish(job,result){const id=randomUUID();results.set(id,structuredClone({...result.comparison,comparison_id:id}));if(result.delayedComparison)delays.set(id,structuredClone(result.delayedComparison));if(result.native_replay)native.set(id,structuredClone({...result.native_replay,comparison_id:id}));const ids=new Set(result.comparison.cases.flatMap(c=>c.runs.map(r=>r.run_id)));metrics.set(id,structuredClone(result.comparison.contract_version==='3.0.0'?result.comparison.cases.flatMap(c=>c.runs.map((r,i)=>({run_id:r.run_id,summary:c.individual_results[i].summary}))):(result.native_metrics??[]).filter(m=>ids.has(m.run_id))));history.unshift({comparison_id:id,scenario_id:job.scenario_id,scenario_version:job.scenario_version,created_at:new Date().toISOString(),contract_version:result.comparison.contract_version,fixture:result.comparison.fixture});job.comparison_id=id;job.status='completed';job.notice=result.notice;job.package_screen=result.package_screen;},
    async delayedComparison(id){return delays.get(id)??null;},
    async comparison(id){return structuredClone(results.get(id)??null);},async staleComparison(id){return [...jobs.values()].some(j=>j.comparison_id===id&&j.stale);},
  };
}
