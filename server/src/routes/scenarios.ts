import { Router } from 'express';
import * as z from 'zod';
import { ApiError } from '../core/errors.js';
import { defaultScenario } from '../services/bundle.js';
import { applyPatch, parse, validateScenario } from '../services/validate.js';
import { PatchSchema, QuestionSchema, ScenarioSchema, ParseAnswerSchema } from '../shared/schemas.js';
import { parseQuestion } from '../ai/scenarioParser.js';
import type { Generate } from '../ai/gemini.js';
import type { Store } from '../storage/store.js';
export function scenariosRouter(store:Store,generate:Generate){
  const r=Router();
  r.get('/default',(_q,s)=>s.json(ScenarioSchema.parse(defaultScenario)));
  r.post('/',async(q,s)=>{
    const {scenario_id}=parse(z.strictObject({scenario_id:z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/)}),q.body);
    const scenario=validateScenario({...structuredClone(defaultScenario),scenario_id});
    await store.saveScenario(scenario);s.status(201).json(scenario);
  });
  r.get('/:id',async(q,s)=>{const scenario=await store.scenario(String(q.params.id));if(!scenario)throw new ApiError(404,'Scenario not found.');s.json(ScenarioSchema.parse(scenario));});
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
