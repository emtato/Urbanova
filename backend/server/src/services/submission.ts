import {parse,validateScenario} from './validate.js';
import {JobRequestSchema} from '../shared/schemas.js';
import {ApiError} from '../core/errors.js';
import {loadPolicy,checkedPolicy} from './policy.js';
import {evaluationPlan} from '../packages/plan.js';
import {dataVersion,simulationModelVersion,workerTag} from './bundle.js';
import {settings} from '../config.js';
import {cacheKey} from '../core/cache.js';
import type {Store} from '../storage/store.js';

/** One validated submission path for HTTP, headless runs and precomputation. */
export async function submitJob(store:Store,body:unknown){
  const input=parse(JobRequestSchema,body),scenario=await store.scenario(input.scenario_id,input.version);
  if(!scenario)throw new ApiError(404,'Scenario version not found.');
  if((await store.scenario(input.scenario_id))?.version!==input.version)throw new ApiError(409,'Scenario version is stale; submit the latest version.');
  validateScenario(scenario);
  const phases=scenario.phases.map(p=>p.phase_id);
  const payload={scenario,random:input.random,retain_replay:input.retain_replay,policy:input.policy?checkedPolicy(input.policy,phases):loadPolicy(phases),evaluator:input.evaluator,demand_factors:input.demand_factors,operations:input.operations,execution_versions:{data_version:dataVersion,model_version:settings.modelVersion,simulation_model:simulationModelVersion}};
  if(input.evaluator==='b11')evaluationPlan(payload);
  // Worker identity is queue metadata, not part of the scientific cache key.
  return store.enqueue(scenario,cacheKey(payload,dataVersion,settings.modelVersion,input.random),{...payload,worker_tag:workerTag});
}
