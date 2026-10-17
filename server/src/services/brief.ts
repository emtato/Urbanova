import type { Comparison } from '../shared/schemas.js';
import { compare } from '../packages/compare.js';
import { sensitivity } from '../packages/sensitivity.js';
export function brief(c:Comparison,delayed:Comparison|null=null){
  const decision=compare(c);
  return [
    'FutureProof planning brief',c.fixture?'FIXTURE — not a simulation of the requested scenario.':'Scenario experiment',
    `Scenario: ${c.scenario.scenario_id}; version: ${c.scenario.version}`,
    `Decision: ${decision.preferred_package_id??'No tested package meets all selected cases'}; ${decision.wording}.`,
    `Cost ordering: ${decision.cost_order}.`,
    ...decision.alternatives.map(p=>`Package ${p.package_id}: capital high CAD ${p.capital}; annual operating high CAD ${p.operating}; feasible ${p.feasible}; criterion ${p.meets}; dominated ${p.dominated}.`),
    ...c.packages.flatMap(p=>p.evaluations.map(e=>`${p.package_id}, ${e.phase_id}, ${e.demand_case}: ${[...e.feasibility_reasons,...e.criterion_reasons].join(' ')}`)),
    ...c.cases.map(x=>`${x.case_id}: phase ${x.phase_id}, demand ${x.demand_case}; per-run p95 seconds ${JSON.stringify(x.per_run_p95_wait_s)}; denied shares ${JSON.stringify(x.per_run_denied_share)}; unresolved ${JSON.stringify(x.per_run_unresolved_passengers)}.`),
    `Sensitivity: ${JSON.stringify(sensitivity(c,delayed))}`,
    ...c.cases.flatMap(x=>x.runs.map(r=>`Run ${r.run_id}: model ${r.model_version}; data ${r.data_version}; seeds ${r.seed_ids.join(', ')}.`)),
    ...(delayed?delayed.cases.flatMap(x=>x.runs.map(r=>`Upgrade-delay run ${r.run_id}: comparison ${delayed.comparison_id}; model ${r.model_version}; data ${r.data_version}; seeds ${r.seed_ids.join(', ')}.`)):[]),
    ...c.assumptions.map(a=>`Assumption ${a.key}: ${a.low}/${a.central}/${a.high} ${a.unit}; status ${a.status}; ${a.meaning}`),
    ...c.sources.map(s=>`Source ${s.source_id}: version ${s.version}; retrieved ${s.retrieved_at}; ${s.url}`),
    'Limitations:',...c.warnings,
  ].join('\n');
}
