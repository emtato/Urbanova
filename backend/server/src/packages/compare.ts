import type { Comparison } from '../shared/schemas.js';
import { runMetrics } from './runMetrics.js';
export function compare(c:Comparison, selectedCases:('low'|'central'|'high')[]=['low','central','high']) {
  const selected=c.packages.map(p=>{
    const evaluations=p.evaluations.filter(e=>selectedCases.includes(e.demand_case));
    const interventions=c.scenario.interventions.filter(i=>p.intervention_ids.includes(i.id));
    const cases=evaluations.map(e=>c.cases.find(x=>x.case_id===e.case_id)!);
    const criterion=c.scenario.planning_criterion;
    const passes=cases.every(x=>x.runs.every(r=>r.status==='completed'&&r.diagnostics.conservation)&&x.runs.length===x.run_count&&
      x.per_run_p95_wait_s.length===x.run_count&&x.per_run_denied_share.length===x.run_count&&x.per_run_unresolved_passengers.length===x.run_count&&
      runMetrics(x).every(m=>m.p95_wait_s!==null&&m.p95_wait_s<=criterion.max_p95_wait_s&&m.denied_share!==null&&m.denied_share<=criterion.max_denied_share&&m.unresolved_passengers<=criterion.max_unresolved_passengers));
    const outcomes=cases.flatMap(runMetrics);
    const waits=outcomes.map(m=>m.p95_wait_s),denied=outcomes.map(m=>m.denied_share);
    return {package_id:p.package_id,capital:interventions.reduce((n,i)=>n+i.capital_cost.high,0),operating:interventions.reduce((n,i)=>n+i.operating_cost.high,0),
      feasible:evaluations.length===c.scenario.phases.length*selectedCases.length&&evaluations.every(e=>e.feasible),
      meets:evaluations.length>0&&passes,
      wait:waits.some(x=>x===null)?Infinity:Math.max(...waits as number[]),denied:denied.some(x=>x===null)?Infinity:Math.max(...denied as number[]),
      unresolved:Math.max(...outcomes.map(m=>m.unresolved_passengers)),dominated:false};
  });
  const dims=(p:typeof selected[number])=>[p.capital,p.operating,p.wait,p.denied,p.unresolved];
  for(const p of selected) p.dominated=p.feasible&&selected.some(q=>q!==p&&q.feasible&&dims(q).every((v,i)=>v<=dims(p)[i])&&dims(q).some((v,i)=>v<dims(p)[i]));
  const eligible=selected.filter(p=>p.feasible&&p.meets).sort((a,b)=>a.capital-b.capital||a.operating-b.operating||a.package_id.localeCompare(b.package_id));
  return {wording:'best among the tested packages under these assumptions',cost_order:'one-time high-bound capital, then annual high-bound operating; no undisclosed present-value conversion',preferred_package_id:eligible[0]?.package_id??null,alternatives:selected.map(p=>({...p,wait:Number.isFinite(p.wait)?p.wait:null,denied:Number.isFinite(p.denied)?p.denied:null,unresolved:Number.isFinite(p.unresolved)?p.unresolved:null}))};
}
