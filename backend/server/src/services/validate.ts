import type * as z from 'zod';
import { ApiError, invariant } from '../core/errors.js';
import { PatchSchema, ScenarioSchema, type Scenario, type ScenarioPatch } from '../shared/schemas.js';
import { defaultScenario,reviewedPhaseIds } from './bundle.js';

export function parse<T>(schema:z.ZodType<T>, input:unknown):T {
  const result=schema.safeParse(input);
  if (!result.success) throw new ApiError(422,'Invalid request; see field constraints.',result.error.issues.map(i=>({field:i.path.join('.'),message:i.message})));
  return result.data;
}
export function validateScenario(input:unknown):Scenario {
  const s=parse(ScenarioSchema,input);
  const ids=s.developments.map(d=>d.id), phases=s.phases.map(p=>p.phase_id);
  invariant(new Set(ids).size===ids.length && new Set(phases).size===phases.length,'Site and phase IDs must be unique.');
  invariant(JSON.stringify(ids)===JSON.stringify(defaultScenario.developments.map(d=>d.id)),'Sites must match the reviewed bundle, in its order.');
  invariant(JSON.stringify(s.interventions)===JSON.stringify(defaultScenario.interventions),'Options must match the reviewed intervention catalogue; no approved intervention costs have been supplied yet.');
  invariant(JSON.stringify(s.intervention_availability)===JSON.stringify(defaultScenario.intervention_availability),'Availability must match reviewed options.');
  invariant(s.budget_price_year===defaultScenario.budget_price_year,'Budget price year must match the reviewed policy.');
  invariant(s.phases.length>=1&&s.phases.length<=2&&phases.every((id,i)=>id===reviewedPhaseIds[i]),'Phases must use ordered existing IDs: phase-1, optionally phase-2.');
  const assigned=s.phases.flatMap(p=>p.development_ids);
  invariant(assigned.length===ids.length && new Set(assigned).size===ids.length && assigned.every(id=>ids.includes(id)),'Every reviewed site must belong to exactly one phase.');
  s.developments.forEach((d,i)=>{
    const expected=defaultScenario.developments[i];
    invariant(JSON.stringify({...d,net_added_units:expected.net_added_units})===JSON.stringify(expected),`Site ${d.id}: only net_added_units is editable; location, access and demographic inputs come from the reviewed bundle.`);
    invariant(d.net_added_units>=0 && d.net_added_units<=10000,`Site ${d.id}: net_added_units allowed range is 0–10000.`);
  });
  invariant(s.phases.every((p,i)=>p.year>=2026 && p.year<=2100 && (!i || p.year>=s.phases[i-1].year) && p.occupied_share>=0&&p.occupied_share<=1),'Phase years must increase within 2026–2100; occupied share must be within 0–1.');
  invariant(s.capital_budget_cad<=1e9 && s.annual_operating_budget_cad<=1e9 && s.fleet_allowance<=100,'Budgets allowed range: CAD 0–1000000000; fleet: 0–100.');
  const c=s.planning_criterion;
  invariant(c.max_denied_share>=0 && c.max_denied_share<=1 && c.max_p95_wait_s>=0 && c.max_p95_wait_s<=86400 && c.max_unresolved_passengers>=0 && c.max_unresolved_passengers<=1e7,'Criterion ranges: wait 0–86400 s, denied share 0–1, unresolved 0–10000000.');
  return s;
}
export function applyPatch(scenario:Scenario,input:unknown):Scenario {
  const patch=parse(PatchSchema,input), next=structuredClone(scenario);
  if(patch.phases)next.phases=patch.phases;
  if(patch.planning_criterion)next.planning_criterion={...next.planning_criterion,...patch.planning_criterion,meaning:'User-selected planning criterion; not a TTC service standard.'};
  for(const key of ['demand_case','capital_budget_cad','annual_operating_budget_cad','fleet_allowance'] as const) if(patch[key]!==undefined) (next as unknown as Record<string,unknown>)[key]=patch[key];
  const unique=(items:string[])=>invariant(new Set(items).size===items.length,'A patch must not repeat an ID.');
  unique((patch.phase_years??[]).map(p=>p.phase_id));
  unique((patch.development_units??[]).map(p=>p.development_id));
  for(const change of patch.phase_years??[]) {
    const phase=next.phases.find(p=>p.phase_id===change.phase_id);
    invariant(phase,`Unknown phase ${change.phase_id}; allowed IDs: ${next.phases.map(p=>p.phase_id).join(', ')}.`);
    phase.year=change.year;
  }
  for(const change of patch.development_units??[]) {
    const dev=next.developments.find(d=>d.id===change.development_id);
    invariant(dev,`Unknown site ${change.development_id}; allowed IDs: ${next.developments.map(d=>d.id).join(', ')}.`);
    dev.net_added_units=change.net_added_units;
  }
  next.version++;
  return validateScenario(next);
}
export type {ScenarioPatch};
