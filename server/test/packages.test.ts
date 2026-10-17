import { test } from 'node:test';
import assert from 'node:assert/strict';
import { feasibility,type Policy } from '../src/packages/feasibility.js';
import { cacheKey } from '../src/core/cache.js';
import { defaultScenario,fixture } from '../src/services/bundle.js';
import { sensitivity } from '../src/packages/sensitivity.js';
import { compare } from '../src/packages/compare.js';
const policy:Policy={cycle_s:3600,lane_cycle_s:3000,baseline_headway_s:600,service_headway_s:300,peak_hours:2,service_days:250,cost_per_hour:{low:100,central:120,high:150},lane_capital:{low:10000,central:15000,high:20000},lane_operating:{low:0,central:0,high:0},price_year:2026,earliest_phase:'phase-1',source_ids:[],assumption_label:'Synthetic test policy, not cost quotes'};
test('four package screen uses cycle ceilings, incremental vehicle hours and conservative limits',()=>{
  const s={...structuredClone(defaultScenario),capital_budget_cad:20000,annual_operating_budget_cad:400000,fleet_allowance:5};
  const rows=feasibility(s,policy);assert.equal(rows.length,4);
  const extra=rows.find(r=>r.package_id==='extra-service')!,both=rows.find(r=>r.package_id==='both')!;
  assert.equal(extra.vehicles,12);assert.equal(extra.extra_vehicles,6);assert.equal(extra.operating!.high,450000);assert.equal(extra.feasible,false);assert.equal(extra.reasons.length,2);
  assert.equal(both.vehicles,10);assert.equal(both.extra_vehicles,4);assert.equal(both.operating!.high,300000);assert.equal(both.feasible,true);
  assert.equal(feasibility(s,null).filter(r=>r.feasible).length,1);
  assert.ok(feasibility(s,{...policy,earliest_phase:'unknown'}).find(r=>r.package_id==='lane')!.reasons.some(r=>r.includes('unavailable')));
});
test('cache includes full input, data/model versions, seeds and draws; object order is immaterial',()=>{
  const key=cacheKey({a:1,b:2},'data','model',{seed_ids:[1],draws_id:'a'});
  assert.equal(key,cacheKey({b:2,a:1},'data','model',{draws_id:'a',seed_ids:[1]}));
  assert.notEqual(key,cacheKey({a:2,b:2},'data','model',{seed_ids:[1],draws_id:'a'}));
  assert.notEqual(key,cacheKey({a:1,b:2},'other','model',{seed_ids:[1],draws_id:'a'}));
  assert.notEqual(key,cacheKey({a:1,b:2},'data','other',{seed_ids:[1],draws_id:'a'}));
  assert.notEqual(key,cacheKey({a:1,b:2},'data','model',{seed_ids:[2],draws_id:'a'}));
});
test('low/central/high choices are reported; delay stays pending without a run',()=>{
  const result=sensitivity(fixture);assert.equal(result.cases.length,3);assert.equal(result.preferred_changes,true);assert.equal(result.upgrade_delay.status,'pending_b11');assert.ok(result.repeatedly_worst_stops.length);
});
test('criterion selection checks numeric per-run metrics instead of trusting flags',()=>{
  const c=structuredClone(fixture);
  c.packages.forEach(p=>p.evaluations.forEach(e=>e.criterion_met=true));
  c.scenario.planning_criterion.max_p95_wait_s=0;
  assert.equal(compare(c,['central']).preferred_package_id,null);
});
test('criteria are editable through the validated form boundary',async()=>{
  const {applyPatch}=await import('../src/services/validate.js');
  const changed=applyPatch(defaultScenario,{planning_criterion:{max_p95_wait_s:120,max_denied_share:.1,max_unresolved_passengers:0}});
  assert.equal(changed.planning_criterion.max_p95_wait_s,120);
  assert.throws(()=>applyPatch(defaultScenario,{planning_criterion:{max_denied_share:2}}));
});
