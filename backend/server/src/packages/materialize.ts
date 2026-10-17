import type { Scenario } from '../shared/schemas.js';
import { feasibility,type Policy,type Range } from './feasibility.js';
import { ApiError } from '../core/errors.js';

export function materialize(input:Scenario,policy:Policy|null,linkIds:string[],delayYears=0){
  const scenario=structuredClone(input),screen=feasibility(input,policy,delayYears);
  scenario.interventions=[];scenario.intervention_availability={};
  const packages=[{package_id:'existing',label:'Existing service',intervention_ids:[] as string[]}];
  if(!policy)return {scenario,screen,packages};
  const phaseFor=(kinds:('lane'|'extra_service')[])=>{
    const ids=[policy.earliest_phase,...kinds.map(k=>policy.availability?.[k]??policy.earliest_phase)];
    const positions=ids.map(id=>input.phases.findIndex(p=>p.phase_id===id));
    if(positions.some(i=>i<0))return undefined;
    const earliest=Math.max(...positions),year=input.phases[earliest].year+delayYears;
    return input.phases.find((p,i)=>i>=earliest&&p.year>=year)?.phase_id;
  };
  const cost=(r:Range,unit:'CAD'|'CAD/year')=>({...r,currency:'CAD' as const,price_year:policy.price_year,scope:policy.assumption_label,unit,status:'user_selected' as const,source_ids:policy.source_ids});
  for(const id of ['lane','extra-service','both']){
    if(!screen.some(s=>s.package_id===id&&s.feasible))continue;
    const lane=id!=='extra-service',extra=id!=='lane';
    const phase=phaseFor([...(lane?['lane' as const]:[]),...(extra?['extra_service' as const]:[])]);
    if(!phase)continue;
    const representative=screen.find(s=>s.package_id===id)!;
    if(extra&&representative.extra_vehicles!<1)throw new ApiError(422,`${id}: the frozen extra-service contract requires at least one added vehicle. Review cycle and headway assumptions; zero-added-vehicle upgrades are not supported by this contract.`);
    const ids:string[]=[];
    for(const kind of [...(lane?['priority_lane' as const]:[]),...(extra?['extra_service' as const]:[])]){
      const interventionId=`${id}:${kind}`,isLane=kind==='priority_lane';ids.push(interventionId);
      const value=isLane?(policy.lane_travel_time_multiplier??policy.lane_cycle_s/policy.cycle_s):policy.service_headway_s;
      scenario.interventions.push({id:interventionId,type:kind,link_ids:isLane?(policy.lane_link_ids??linkIds):[],headway_s:isLane?null:policy.service_headway_s,
        capital_cost:cost(isLane?policy.lane_capital:{low:0,central:0,high:0},'CAD'),
        operating_cost:cost(isLane?policy.lane_operating:Object.fromEntries((['low','central','high'] as const).map(k=>[k,representative.operating![k]-(lane?policy.lane_operating[k]:0)])) as Range,'CAD/year'),
        extra_vehicles:isLane?0:representative.extra_vehicles!,earliest_phase:phase,
        effect:{key:`${interventionId}:effect`,unit:isLane?'travel-time multiplier':'seconds',meaning:`User-selected package assumption. ${policy.assumption_label}`,low:value,central:value,high:value,allowed_range:{low:0,high:Math.max(value,86400)},status:'user_selected',source_ids:policy.source_ids}});
      scenario.intervention_availability[interventionId]=phase;
    }
    packages.push({package_id:id,label:id==='both'?'Lane and extra service':id==='lane'?'Priority lane':'Extra service',intervention_ids:ids});
  }
  return {scenario,screen,packages};
}
