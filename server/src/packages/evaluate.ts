import { fixture } from '../services/bundle.js';
import { ComparisonSchema, type Comparison, type Scenario } from '../shared/schemas.js';
import { feasibility, type Policy } from './feasibility.js';
import { evaluationPlan,checkedB11Comparison,type B11Adapter } from './plan.js';
export interface EvaluationRequest {scenario:Scenario;random:{seed_ids:number[];draws_id:string};retain_replay:boolean;policy:Policy|null}
// B11 must return the frozen Comparison with all phase/demand evaluations and
// paired seed IDs. The stub never relabels fixture metrics as a requested run.
export function evaluate(request:EvaluationRequest,adapter?:B11Adapter) {
  if(adapter){
    const result=adapter.evaluate(evaluationPlan(request));
    const comparison=checkedB11Comparison(result.comparison,request);
    const delayedComparison=checkedB11Comparison(result.delayedComparison,request);
    if(!request.retain_replay)comparison.replay=null;
    return {comparison,delayedComparison,package_screen:feasibility(request.scenario,request.policy),notice:'Computed by the installed B11 adapter with paired requested seeds.'};
  }
  const comparison:Comparison=ComparisonSchema.parse(structuredClone(fixture));
  if(!request.retain_replay) comparison.replay=null;
  return {comparison,package_screen:feasibility(request.scenario,request.policy),notice:'FIXTURE STUB: B11 passenger metrics are unavailable. This comparison is the unchanged contract example, not an evaluation of the requested scenario, seeds or four package screens.'};
}
