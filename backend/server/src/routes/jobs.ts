import { Router } from 'express';
import * as z from 'zod';
import { settings } from '../config.js';
import { dataVersion,simulationModelVersion } from '../services/bundle.js';
import { parse } from '../services/validate.js';
import { JobSchema } from '../shared/schemas.js';
import { ApiError } from '../core/errors.js';
import { submitJob } from '../services/submission.js';
import type { Store,Job } from '../storage/store.js';
const view=(job:Job)=>JobSchema.parse({job_id:job.job_id,scenario_id:job.scenario_id,scenario_version:job.scenario_version,status:job.status,comparison_id:job.comparison_id,error:job.error,stale:job.stale||Boolean(job.payload.execution_versions&&(job.payload.execution_versions.data_version!==dataVersion||job.payload.execution_versions.model_version!==settings.modelVersion||job.payload.execution_versions.simulation_model!==simulationModelVersion)),package_screen:job.package_screen,fixture:job.payload.evaluator!=='b11',notice:job.notice||(job.payload.evaluator==='b11'?'B11 computation queued or running.':'Explicit fixture mode; not requested-scenario metrics.')});
export function jobsRouter(store:Store){
  const r=Router();r.post('/',async(q,s)=>{
    const job=await submitJob(store,q.body);
    s.status(job.status==='completed'?200:202).json(view(job));
  });
  r.get('/:id',async(q,s)=>{const id=parse(z.uuid(),q.params.id),job=await store.job(id);if(!job)throw new ApiError(404,'Job not found.');s.json(view(job));});
  return r;
}
