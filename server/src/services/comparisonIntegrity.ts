import { ComparisonSchema,type Comparison } from '../shared/schemas.js';
import { invariant } from '../core/errors.js';
import { checkNativeCase } from './nativeIntegrity.js';
import type { NativeCaseResult } from '../shared/nativeResults.js';

/** Semantic checks omitted by JSON Schema, shared by storage and B11. */
export function checkedComparison(input:unknown):Comparison {
  const c=ComparisonSchema.parse(input);
  const unique=(ids:unknown[],label:string)=>invariant(new Set(ids).size===ids.length,`${label} must be unique.`);
  const sources=new Set(c.sources.map(s=>s.source_id)),stops=new Set(c.corridor.stops.map(s=>s.id));
  unique(c.sources.map(s=>s.source_id),'Source IDs');unique([...c.corridor.stops.map(s=>s.id)],'Stop IDs');
  unique(c.cases.map(x=>x.case_id),'Case IDs');unique(c.packages.map(x=>x.package_id),'Package IDs');
  unique(c.cases.flatMap(x=>x.runs.map(r=>r.run_id)),'Run IDs');
  const visit=(value:any)=>{
    if(!value||typeof value!=='object')return;
    if(Array.isArray(value.source_ids))invariant(value.source_ids.every((id:string)=>sources.has(id)),'Every source ID must resolve in the Comparison.');
    for(const child of Object.values(value))visit(child);
  };visit(c);
  const phases=new Set(c.scenario.phases.map(p=>p.phase_id)),packages=new Set(c.packages.map(p=>p.package_id));
  const criterion=c.scenario.planning_criterion;
  for(const phase of phases)for(const demand of ['low','central','high']){
    const kinds=new Set(c.cases.filter(x=>x.phase_id===phase&&x.demand_case===demand).map(x=>x.kind));
    invariant(['current','growth','supported_growth'].every(kind=>kinds.has(kind as any)),'Every phase/demand needs current, growth and supported_growth cases.');
  }
  for(const result of c.cases){
    if(c.contract_version==='3.0.0')checkNativeCase(result as NativeCaseResult);
    invariant(phases.has(result.phase_id)&&packages.has(result.package_id),'Case phase/package must exist.');
    unique(result.stops.map(s=>s.stop_id+':'+s.rider_group),'Stop/cohort results');
    invariant(result.stops.length===stops.size*2&&result.stops.every(s=>stops.has(s.stop_id)),'Cases must cover both cohorts at every known stop.');
    const arrays=[result.runs,result.per_run_mean_wait_s,result.per_run_p95_wait_s,result.per_run_denied_share,result.per_run_unresolved_passengers];
    invariant(arrays.every(a=>a.length===result.run_count),'Per-run arrays must align with run_count.');
    invariant(result.unresolved_passengers===result.per_run_unresolved_passengers.reduce((n,x)=>n+x,0),'Case unresolved count must sum the runs.');
    for(const [index,run] of result.runs.entries()){
      const d=run.diagnostics;unique(run.seed_ids,'Run seeds');
      invariant(run.package===result.package_id&&run.scenario_version===c.scenario.version,'Run must match its package and scenario version.');
      invariant(d.conservation===(d.passengers_created===d.passengers_arrived+d.passengers_waiting+d.passengers_onboard),'Passenger conservation flag is inconsistent.');
      invariant(run.status!=='completed'||d.conservation,'Completed runs must conserve passengers.');
      invariant(d.unresolved_passengers===d.passengers_waiting+d.passengers_onboard&&result.per_run_unresolved_passengers[index]===d.unresolved_passengers,'Unresolved passengers must match diagnostics.');
    }
  }
  for(const p of c.packages){
    unique(p.intervention_ids,'Package interventions');
    invariant(p.intervention_ids.every(id=>c.scenario.interventions.some(i=>i.id===id)),'Package interventions must exist in the scenario.');
    unique(p.evaluations.map(e=>e.phase_id+':'+e.demand_case),'Package evaluations');
    invariant(p.evaluations.length===phases.size*3,'Packages must cover every phase and demand case.');
    for(const e of p.evaluations){
      const result=c.cases.find(x=>x.case_id===e.case_id);
      invariant(result&&result.package_id===p.package_id&&result.phase_id===e.phase_id&&result.demand_case===e.demand_case,'Evaluation must reference its own package/phase/demand case.');
      const interventions=c.scenario.interventions.filter(i=>p.intervention_ids.includes(i.id));
      const phaseIndex=c.scenario.phases.findIndex(p=>p.phase_id===e.phase_id);
      const available=(id:string)=>{const index=c.scenario.phases.findIndex(p=>p.phase_id===id);return index>=0&&index<=phaseIndex;};
      const feasible=interventions.reduce((n,i)=>n+i.capital_cost.high,0)<=c.scenario.capital_budget_cad&&interventions.reduce((n,i)=>n+i.operating_cost.high,0)<=c.scenario.annual_operating_budget_cad&&interventions.reduce((n,i)=>n+i.extra_vehicles,0)<=c.scenario.fleet_allowance&&interventions.every(i=>available(i.earliest_phase)&&available(c.scenario.intervention_availability[i.id]));
      invariant(e.feasible===feasible,'Feasibility flag must match budgets, fleet and availability.');
      const passes=result.runs.every(r=>r.status==='completed')&&result.per_run_p95_wait_s.every((wait,i)=>wait!==null&&wait<=criterion.max_p95_wait_s&&result.per_run_denied_share[i]!==null&&result.per_run_denied_share[i]!<=criterion.max_denied_share&&result.per_run_unresolved_passengers[i]<=criterion.max_unresolved_passengers);
      invariant(e.criterion_met===passes,'Criterion flag must agree with all numeric run outcomes.');
    }
  }
  return c;
}
