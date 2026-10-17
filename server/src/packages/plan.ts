import { hash } from '../core/cache.js';
import { ComparisonSchema,type Comparison } from '../shared/schemas.js';
import { invariant } from '../core/errors.js';
import { feasibility } from './feasibility.js';
import type { EvaluationRequest } from './evaluate.js';
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
    assumptions_id:hash({scenario:request.scenario,policy:request.policy}),
  };
}
export interface B11Adapter {evaluate(plan:ReturnType<typeof evaluationPlan>):{comparison:Comparison;delayedComparison:Comparison}}
export function checkedB11Comparison(input:unknown,request:EvaluationRequest):Comparison {
  const c=ComparisonSchema.parse(input);
  invariant(!c.fixture,'A B11 result must not be fixture-derived.');
  invariant(JSON.stringify(c.scenario)===JSON.stringify(request.scenario),'B11 must preserve the validated scenario and shared housing.');
  const seeds=[...request.random.seed_ids].sort((a,b)=>a-b);
  invariant(new Set(seeds).size===seeds.length,'Random seed IDs must be unique.');
  const caseIds=new Set(c.cases.map(x=>x.case_id));
  invariant(caseIds.size===c.cases.length,'B11 case IDs must be unique.');
  for(const phase of request.scenario.phases)for(const demand of ['low','central','high']){
    const cases=c.cases.filter(x=>x.phase_id===phase.phase_id&&x.demand_case===demand);
    const packages=c.packages;
    invariant(packages.every(p=>p.evaluations.some(e=>e.phase_id===phase.phase_id&&e.demand_case===demand&&caseIds.has(e.case_id))),'B11 must provide every package/phase/demand evaluation.');
    for(const result of cases){
      invariant(JSON.stringify(result.runs.flatMap(r=>r.seed_ids).sort((a,b)=>a-b))===JSON.stringify(seeds),'B11 must use paired requested seeds in every case.');
      invariant(result.runs.every(r=>r.scenario_version===request.scenario.version),'Run scenario versions must agree.');
    }
    const growth=cases.filter(x=>x.kind!=='current');
    const cohort=(x:typeof growth[number])=>JSON.stringify(x.stops.map(s=>({stop:s.stop_id,group:s.rider_group,passengers:s.passengers})).sort((a,b)=>(a.stop+a.group).localeCompare(b.stop+b.group)));
    invariant(growth.every(x=>cohort(x)===cohort(growth[0])),'Packages must share the same passenger cohorts, not just the same total count.');
  }
  return c;
}
