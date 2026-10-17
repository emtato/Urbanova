import { hash } from '../core/cache.js';
import { ComparisonSchema,type Comparison } from '../shared/schemas.js';
import { invariant } from '../core/errors.js';
import { feasibility } from './feasibility.js';
import type { EvaluationRequest } from './evaluate.js';
import { checkedComparison } from '../services/comparisonIntegrity.js';
import { materialize } from './materialize.js';
import { corridor,dataVersion,reviewed,sourceManifest,simulationModelVersion } from '../services/bundle.js';
import { nativeCohorts } from '../services/nativeIntegrity.js';
import type { NativeCaseResult,NativeComparison } from '../shared/nativeResults.js';
export function evaluationPlan(request:EvaluationRequest) {
  const screen=feasibility(request.scenario,request.policy);
  const draws={seed_ids:[...request.random.seed_ids],draws_id:request.random.draws_id};
  return {
    scenario:request.scenario,random:draws,screen,
    cases:request.scenario.phases.flatMap(phase=>(['low','central','high'] as const).map(demand_case=>({
      phase_id:phase.phase_id,demand_case,random:draws,
      feasible_package_ids:screen.filter(p=>p.phase_id===phase.phase_id&&p.feasible).map(p=>p.package_id),
    }))),
    upgrade_delay:{years:1,meaning:'Re-evaluate upgrade availability one calendar year later, holding housing, demand and draws fixed.'},
    delayed_screen:feasibility(request.scenario,request.policy,1),
    assumptions_id:hash({scenario:request.scenario,policy:request.policy}),
    base:materialize(request.scenario,request.policy,corridor.links.map(l=>l.link_id)),
    delayed:materialize(request.scenario,request.policy,corridor.links.map(l=>l.link_id),1),
    corridor,source_manifest:sourceManifest,field_metadata:reviewed.field_metadata,
    data_version:dataVersion,model_version:simulationModelVersion,
    demand_factors:request.demand_factors??{low:.8,central:1,high:1.2},
  };
}
export interface B11Adapter {evaluate(plan:ReturnType<typeof evaluationPlan>):{comparison:NativeComparison;delayedComparison:NativeComparison}|Promise<{comparison:NativeComparison;delayedComparison:NativeComparison}>}
export function checkedB11Comparison(input:unknown,request:EvaluationRequest,variant:'base'|'delayed'='base'):NativeComparison {
  const c=checkedComparison(input);
  invariant(!c.fixture,'A B11 result must not be fixture-derived.');
  invariant(c.contract_version==='3.0.0','Live B11 results must retain native batches under contract 3.0.0.');
  const expectedScenario=evaluationPlan(request)[variant].scenario;
  invariant(hash(c.scenario)===hash(expectedScenario),'B11 must preserve shared housing and the trusted materialized package assumptions.');
  const seeds=[...request.random.seed_ids].sort((a,b)=>a-b);
  invariant(new Set(seeds).size===seeds.length,'Random seed IDs must be unique.');
  const caseIds=new Set(c.cases.map(x=>x.case_id));
  const expected=evaluationPlan(request)[variant].packages.map(p=>p.package_id);
  invariant(c.packages.length===expected.length&&expected.every(id=>c.packages.some(p=>p.package_id===id)),'B11 must evaluate exactly the feasible screened packages.');
  invariant(caseIds.size===c.cases.length,'B11 case IDs must be unique.');
  for(const phase of request.scenario.phases)for(const demand of ['low','central','high']){
    const cases=c.cases.filter(x=>x.phase_id===phase.phase_id&&x.demand_case===demand);
    const packages=c.packages;
    invariant(packages.every(p=>p.evaluations.some(e=>e.phase_id===phase.phase_id&&e.demand_case===demand&&caseIds.has(e.case_id))),'B11 must provide every package/phase/demand evaluation.');
    for(const result of cases){
      invariant(JSON.stringify(result.runs.map(r=>r.seed_ids[0]))===JSON.stringify(request.random.seed_ids),'B11 must preserve requested seed order.');
      invariant(JSON.stringify(result.overall_results.seeds)===JSON.stringify(cases[0].overall_results.seeds),'Comparable packages must share ordered engine seeds.');
      invariant(JSON.stringify(result.runs.flatMap(r=>r.seed_ids).sort((a,b)=>a-b))===JSON.stringify(seeds),'B11 must use paired requested seeds in every case.');
      invariant(result.runs.every(r=>r.scenario_version===request.scenario.version),'Run scenario versions must agree.');
      invariant(result.runs.every(r=>r.model_version===simulationModelVersion&&r.data_version===dataVersion),'B11 run model/data versions must match the execution plan.');
    }
    const growth=cases.filter(x=>x.kind!=='current');
    const cohort=(x:typeof growth[number])=>nativeCohorts(x as NativeCaseResult);
    invariant(growth.every(x=>cohort(x)===cohort(growth[0])),'Packages must share the same passenger cohorts, not just the same total count.');
  }
  return c;
}
