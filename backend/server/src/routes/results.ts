import { Router } from 'express';
import * as z from 'zod';
import { ComparisonSchema,ExplanationSchema,SummarySchema,NativeMetricsSchema } from '../shared/schemas.js';
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
  r.get('/',async(q,s)=>{const query=parse(z.strictObject({scenario_id:z.string().min(1).optional(),limit:z.coerce.number().int().min(1).max(100).default(20),offset:z.coerce.number().int().min(0).default(0)}),q.query);s.json({format_version:'comparison-history-v1',results:await store.pastRuns(query)});});
  async function get(id:unknown){const comparison=await store.comparison(parse(z.uuid(),id));if(!comparison)throw new ApiError(404,'That comparison does not exist. Submit a scenario job to run a comparison.');return ComparisonSchema.parse(comparison);}
  r.get('/:id',async(q,s)=>{const c=await get(q.params.id);s.set('X-FutureProof-Fixture',String(c.fixture));s.set('X-FutureProof-Stale',String(await store.staleComparison(String(q.params.id))));s.json(c);});
  r.get('/:id/b11-metrics',async(q,s)=>{const c=await get(q.params.id),runs=await store.nativeMetrics(String(q.params.id));if(!runs.length)throw new ApiError(404,'No native B11 metrics were retained for this comparison.');const run=c.cases[0].runs[0];s.json(NativeMetricsSchema.parse({format_version:'b11-metrics-v1',comparison_id:c.comparison_id,scenario_id:c.scenario.scenario_id,source_ids:c.sources.map(x=>x.source_id),model_version:run.model_version,data_version:run.data_version,runs}));});
  r.post('/:id/explain',async(q,s)=>s.json(ExplanationSchema.parse(await explain(await get(q.params.id),generate))));
  r.get('/:id/brief',async(q,s)=>{const c=await get(q.params.id);s.set('Content-Disposition',`attachment; filename="comparison-${c.comparison_id}.txt"`).type('text/plain').send(brief(c,await store.delayedComparison(String(q.params.id))));});
  r.get('/:id/summary',async(q,s)=>{const c=await get(q.params.id);s.json(SummarySchema.parse({comparison_id:c.comparison_id,scenario_id:c.scenario.scenario_id,source_ids:c.sources.map(x=>x.source_id),fixture:c.fixture,decision:compare(c),sensitivity:sensitivity(c,await store.delayedComparison(String(q.params.id)))}));});
  return r;
}
