import { Router } from 'express';
import * as z from 'zod';
import { ApiError } from '../core/errors.js';
import { defaultScenario,demoScenario } from '../services/bundle.js';
import { applyPatch, parse, validateScenario } from '../services/validate.js';
import { PatchSchema, QuestionSchema, ScenarioSchema, ParseAnswerSchema,PackageScreenSchema,PackagePreviewSchema } from '../shared/schemas.js';
import { PolicySchema } from '../shared/policy.js';
import { checkedPolicy,loadPolicy } from '../services/policy.js';
import { feasibility } from '../packages/feasibility.js';
import { hash } from '../core/cache.js';
import { parseQuestion } from '../ai/scenarioParser.js';
import type { Generate } from '../ai/gemini.js';
import type { Store } from '../storage/store.js';
export function scenariosRouter(store:Store,generate:Generate){
  const r=Router();
  r.get('/default',(_q,s)=>s.json(ScenarioSchema.parse(defaultScenario)));
  r.get('/templates',(_q,s)=>s.json({format_version:'scenario-templates-v1',default:defaultScenario,demo:demoScenario,notice:'Demo years, budgets, occupancy and criterion are illustrative user-selected inputs, not project delivery forecasts or TTC standards.'}));
  r.post('/',async(q,s)=>{
    const {scenario_id,template}=parse(z.strictObject({scenario_id:z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/),template:z.enum(['default','demo']).default('default')}),q.body);
    const scenario=validateScenario({...structuredClone(template==='demo'?demoScenario:defaultScenario),scenario_id});
    await store.saveScenario(scenario);s.status(201).json(scenario);
  });
  r.get('/:id',async(q,s)=>{const query=parse(z.strictObject({version:z.coerce.number().int().positive().optional()}),q.query);const scenario=await store.scenario(String(q.params.id),query.version);if(!scenario)throw new ApiError(404,'Scenario not found.');s.json(ScenarioSchema.parse(scenario));});
  r.post('/:id/packages',async(q,s)=>{
    const input=parse(z.strictObject({version:z.int().positive(),policy:PolicySchema.optional()}),q.body);
    const scenario=await store.scenario(String(q.params.id));if(!scenario)throw new ApiError(404,'Scenario not found.');
    if(scenario.version!==input.version)throw new ApiError(409,'Scenario version changed; reload before screening.');
    validateScenario(scenario);
    const phases=scenario.phases.map(p=>p.phase_id),policy=input.policy?checkedPolicy(input.policy,phases):loadPolicy(phases);
    const screen=PackageScreenSchema.parse(feasibility(scenario,policy));
    const delayed=PackageScreenSchema.parse(feasibility(scenario,policy,1));
    s.json(PackagePreviewSchema.parse({scenario_id:scenario.scenario_id,scenario_version:scenario.version,status:'screen_only',policy_status:policy?'user_selected':'missing',policy,assumptions_id:hash({scenario,policy}),packages:screen,upgrade_delay:{years:1,packages:delayed},notice:'Cost/fleet/availability screen only. No ridership or service-outcome simulation has run. Submitted policy values are explicit assumptions, not verified TTC quotes.'}));
  });
  r.post('/:id/patch',async(q,s)=>{
    const input=parse(z.strictObject({version:z.int().positive(),patch:PatchSchema}),q.body);
    const current=await store.scenario(String(q.params.id));if(!current)throw new ApiError(404,'Scenario not found.');
    if(current.version!==input.version)throw new ApiError(409,'Scenario version changed; reload before editing.');
    const changed=applyPatch(current,input.patch);await store.saveScenario(changed);s.json(ScenarioSchema.parse(changed));
  });
  r.post('/:id/parse',async(q,s)=>{
    const {question}=parse(QuestionSchema,q.body),scenario=await store.scenario(String(q.params.id));
    if(!scenario)throw new ApiError(404,'Scenario not found.');
    s.json(ParseAnswerSchema.parse(await parseQuestion(question,scenario,generate)));
  });
  return r;
}
