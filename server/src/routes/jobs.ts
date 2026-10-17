import { Router } from 'express';
import * as z from 'zod';
import { cacheKey } from '../core/cache.js';
import { settings } from '../config.js';
import { dataVersion } from '../services/bundle.js';
import { parse, validateScenario } from '../services/validate.js';
import { JobRequestSchema, JobSchema } from '../shared/schemas.js';
import { ApiError } from '../core/errors.js';
import { loadPolicy,checkedPolicy } from '../services/policy.js';
import type { Store,Job } from '../storage/store.js';
const view=(job:Job)=>JobSchema.parse({job_id:job.job_id,scenario_id:job.scenario_id,scenario_version:job.scenario_version,status:job.status,comparison_id:job.comparison_id,error:job.error,stale:job.stale||Boolean(job.payload.execution_versions&&(job.payload.execution_versions.data_version!==dataVersion||job.payload.execution_versions.model_version!==settings.modelVersion)),package_screen:job.package_screen,fixture:true,notice:job.notice||'B11 unavailable: this job returns an explicitly labelled contract fixture, not requested-scenario metrics.'});
export function jobsRouter(store:Store){
  const r=Router();r.post('/',async(q,s)=>{
    const input=parse(JobRequestSchema,q.body),scenario=await store.scenario(input.scenario_id,input.version);
    if(!scenario)throw new ApiError(404,'Scenario version not found.');
    const latest=await store.scenario(input.scenario_id);
    if(latest?.version!==input.version)throw new ApiError(409,'Scenario version is stale; submit the latest version.');
    validateScenario(scenario);
    const phaseIds=scenario.phases.map(p=>p.phase_id);
    const payload={scenario,random:input.random,retain_replay:input.retain_replay,policy:input.policy?checkedPolicy(input.policy,phaseIds):loadPolicy(phaseIds),execution_versions:{data_version:dataVersion,model_version:settings.modelVersion}};
    const key=cacheKey(payload,dataVersion,settings.modelVersion,input.random);
    const job=await store.enqueue(scenario,key,payload);
    s.status(job.status==='completed'?200:202).json(view(job));
  });
  r.get('/:id',async(q,s)=>{const id=parse(z.uuid(),q.params.id),job=await store.job(id);if(!job)throw new ApiError(404,'Job not found.');s.json(view(job));});
  return r;
}
