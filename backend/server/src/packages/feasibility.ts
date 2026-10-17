import type { Scenario } from '../shared/schemas.js';
export type Range={low:number;central:number;high:number};
export interface Policy {
  cycle_s:number;lane_cycle_s:number;baseline_headway_s:number;service_headway_s:number;
  peak_hours:number;service_days:number;cost_per_hour:Range;lane_capital:Range;lane_operating:Range;
  price_year:number;earliest_phase:string;source_ids:string[];assumption_label:string;
  availability?:{lane:string;extra_service:string};
  lane_travel_time_multiplier?:number;lane_link_ids?:string[];
}
export interface Screen {
  package_id:string;phase_id:string;feasible:boolean;reasons:string[];
  vehicles:number|null;extra_vehicles:number|null;capital:Range|null;operating:Range|null;
}
const zero=():Range=>({low:0,central:0,high:0});
export function validatePolicy(p:Policy) {
  for(const n of [p.cycle_s,p.lane_cycle_s,p.baseline_headway_s,p.service_headway_s]) if(!Number.isFinite(n)||n<=0) throw Error('Cycle and headway must be finite positive seconds.');
  for(const n of [p.peak_hours,p.service_days]) if(!Number.isFinite(n)||n<0) throw Error('Service hours and days must be nonnegative.');
  for(const r of [p.cost_per_hour,p.lane_capital,p.lane_operating]) if(![r.low,r.central,r.high].every(Number.isFinite)||!(0<=r.low&&r.low<=r.central&&r.central<=r.high)) throw Error('Cost ranges must be finite, nonnegative and ordered.');
  if(!p.assumption_label || !Number.isInteger(p.price_year)) throw Error('A policy needs a price year and explicit assumption/source label.');
  return p;
}
export function feasibility(s:Scenario, policy:Policy|null,delayYears=0):Screen[] {
  if(policy) validatePolicy(policy);
  return s.phases.flatMap((phase,phaseIndex)=>['existing','lane','extra-service','both'].map(package_id=>{
    const lane=package_id==='lane'||package_id==='both', extra=package_id==='extra-service'||package_id==='both';
    const result:Screen={package_id,phase_id:phase.phase_id,feasible:true,reasons:[],vehicles:null,extra_vehicles:0,capital:zero(),operating:zero()};
    if(package_id==='existing') return {...result,vehicles:policy?Math.ceil(policy.cycle_s/policy.baseline_headway_s):null};
    if(!policy) return {...result,feasible:false,reasons:['Reviewed cycle, intervention effects and cost policy unavailable; no affordability claim can be made.'],extra_vehicles:null,capital:null,operating:null};
    const baseline=Math.ceil(policy.cycle_s/policy.baseline_headway_s);
    const vehicles=Math.ceil((lane?policy.lane_cycle_s:policy.cycle_s)/(extra?policy.service_headway_s:policy.baseline_headway_s));
    const added=Math.max(0,vehicles-baseline);
    const hours=added*policy.peak_hours*policy.service_days;
    result.vehicles=vehicles;result.extra_vehicles=added;
    result.capital=lane?policy.lane_capital:zero();
    result.operating=Object.fromEntries((['low','central','high'] as const).map(bound=>[bound,hours*policy.cost_per_hour[bound]+(lane?policy.lane_operating[bound]:0)])) as Range;
    if(result.capital.high>s.capital_budget_cad) result.reasons.push(`Capital high bound ${result.capital.high} exceeds budget ${s.capital_budget_cad} CAD.`);
    if(result.operating.high>s.annual_operating_budget_cad) result.reasons.push(`Annual operating high bound ${result.operating.high} exceeds budget ${s.annual_operating_budget_cad} CAD/year.`);
    if(added>s.fleet_allowance) result.reasons.push(`Extra fleet ${added} exceeds allowance ${s.fleet_allowance}.`);
    const earliest=s.phases.findIndex(p=>p.phase_id===policy.earliest_phase);
    if(earliest<0||earliest>phaseIndex) result.reasons.push('Upgrade unavailable in this phase.');
    for(const [selected,kind] of [[lane,'lane'],[extra,'extra_service']] as const){
      if(!selected)continue;
      const available=s.phases.find(p=>p.phase_id===(policy.availability?.[kind]??policy.earliest_phase));
      if(!available||available.year+delayYears>phase.year)result.reasons.push(`${kind} unavailable by phase year ${phase.year}${delayYears?` with ${delayYears}-year upgrade delay`:''}.`);
    }
    if(policy.price_year!==s.budget_price_year) result.reasons.push('Costs and budgets use different price years.');
    result.feasible=!result.reasons.length;
    return result;
  }));
}
