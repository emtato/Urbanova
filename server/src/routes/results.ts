import { Router } from 'express';
import * as z from 'zod';
import { ComparisonSchema,ExplanationSchema,SummarySchema } from '../shared/schemas.js';
import { ApiError } from '../core/errors.js';
import { parse } from '../services/validate.js';
import { explain } from '../ai/explainer.js';
import { brief } from '../services/brief.js';
import { compare } from '../packages/compare.js';
import { sensitivity } from '../packages/sensitivity.js';
import type { Generate } from '../ai/gemini.js';
import type { Store } from '../storage/store.js';
export function resultsRouter(store:Store,generate:Generate){
  const r=Router();
  async function get(id:unknown){const comparison=await store.comparison(parse(z.uuid(),id));if(!comparison)throw new ApiError(404,'That comparison does not exist. Submit a scenario job to run a comparison.');return ComparisonSchema.parse(comparison);}
  r.get('/:id',async(q,s)=>{const c=await get(q.params.id);s.set('X-FutureProof-Fixture',String(c.fixture));s.set('X-FutureProof-Stale',String(await store.staleComparison(String(q.params.id))));s.json(c);});
  r.post('/:id/explain',async(q,s)=>s.json(ExplanationSchema.parse(await explain(await get(q.params.id),generate))));
  r.get('/:id/brief',async(q,s)=>s.type('text/plain').send(brief(await get(q.params.id),await store.delayedComparison(String(q.params.id)))));
  r.get('/:id/summary',async(q,s)=>{const c=await get(q.params.id);s.json(SummarySchema.parse({comparison_id:c.comparison_id,scenario_id:c.scenario.scenario_id,source_ids:c.sources.map(x=>x.source_id),fixture:c.fixture,decision:compare(c),sensitivity:sensitivity(c,await store.delayedComparison(String(q.params.id)))}));});
  return r;
}
