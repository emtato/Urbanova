import { randomUUID } from 'node:crypto';
import type { Store,Job } from '../src/storage/store.js';
import { defaultScenario } from '../src/services/bundle.js';
import type { Comparison,Scenario } from '../src/shared/schemas.js';
export function memoryStore():Store {
  const scenarios=new Map([[defaultScenario.scenario_id,[structuredClone(defaultScenario)]]]);
  const jobs=new Map<string,Job>(),results=new Map<string,Comparison>(),keys=new Map<string,string>();
  const delays=new Map<string,Comparison>();
  return {
    async ping(){},async init(){},async close(){},async audit(){},
    async scenario(id,version){const all=scenarios.get(id);return structuredClone(all?.find(s=>version?s.version===version:s.version===all.at(-1)!.version)??null);},
    async saveScenario(s){const all=scenarios.get(s.scenario_id)??[];if(s.version!==(all.at(-1)?.version??0)+1)throw Error('conflict');scenarios.set(s.scenario_id,[...all,structuredClone(s)]);for(const job of jobs.values())if(job.scenario_id===s.scenario_id)job.stale=true;},
    async enqueue(s,key,payload){const cached=keys.get(key);if(cached)return jobs.get(cached)!;const job:Job={job_id:randomUUID(),scenario_id:s.scenario_id,scenario_version:s.version,status:'queued',comparison_id:null,error:null,stale:false,notice:'',package_screen:null,payload,lease_token:''};jobs.set(job.job_id,job);keys.set(key,job.job_id);return job;},
    async job(id){return jobs.get(id)??null;},
    async claim(){const job=[...jobs.values()].find(j=>j.status==='queued');if(!job)return null;job.status='running';job.lease_token=randomUUID();return job;},
    async fail(job){job.status='failed';job.error='Evaluation unavailable';},
    async finish(job,result){const id=randomUUID();results.set(id,{...result.comparison,comparison_id:id});if(result.delayedComparison)delays.set(id,result.delayedComparison);job.comparison_id=id;job.status='completed';job.notice=result.notice;job.package_screen=result.package_screen;},
    async delayedComparison(id){return delays.get(id)??null;},
    async comparison(id){return results.get(id)??null;},async staleComparison(id){return [...jobs.values()].some(j=>j.comparison_id===id&&j.stale);},
  };
}
