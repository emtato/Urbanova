import type { Comparison } from '../shared/schemas.js';
import { compare } from './compare.js';
export function sensitivity(c:Comparison, delayed:Comparison|null=null) {
  const cases=(['low','central','high'] as const).map(demand=>({demand,preferred_package_id:compare(c,[demand]).preferred_package_id}));
  const worst=new Map<string,number>();
  for(const result of c.cases) {
    const candidates=result.stops.filter(s=>s.p95_wait_s!==null);
    const max=Math.max(...candidates.map(s=>s.p95_wait_s!));
    for(const id of new Set(candidates.filter(s=>s.p95_wait_s===max).map(s=>s.stop_id))) worst.set(id,(worst.get(id)??0)+1);
  }
  return {fixture:c.fixture,cases,preferred_changes:new Set(cases.map(x=>x.preferred_package_id)).size>1,
    upgrade_delay:delayed?{status:'tested',preferred_package_id:compare(delayed).preferred_package_id}:{status:'pending_b11',preferred_package_id:null},
    repeatedly_worst_stops:[...worst].sort((a,b)=>b[1]-a[1]).map(([stop_id,count])=>({stop_id,cases:count})),
    limitation:'Delay outcomes require an independently evaluated delayed-upgrade case. No result is inferred by moving labels.'};
}
