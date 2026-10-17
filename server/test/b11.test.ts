import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {ROOT} from '../src/config.js';
import {defaultScenario,corridor,simulationModelVersion,dataVersion} from '../src/services/bundle.js';
import {materialize} from '../src/packages/materialize.js';
import {evaluate} from '../src/packages/evaluate.js';
import {NativeReplaySchema} from '../src/shared/schemas.js';
const policy=JSON.parse(readFileSync(resolve(ROOT,'server/config/package-policy.example.json'),'utf8'));
const scenario={...structuredClone(defaultScenario),capital_budget_cad:1e7,annual_operating_budget_cad:2e6,fleet_allowance:20};
const links=corridor.links.map(l=>l.link_id);

test('materialized combined service preserves fleet savings and additive costs',()=>{
  const plan=materialize(scenario,policy,links);
  assert.equal(plan.packages.length,4);
  const both=plan.packages.find(p=>p.package_id==='both')!;
  const interventions=plan.scenario.interventions.filter(i=>both.intervention_ids.includes(i.id));
  const screen=plan.screen.find(p=>p.package_id==='both')!;
  assert.equal(interventions.reduce((n,i)=>n+i.extra_vehicles,0),screen.extra_vehicles);
  assert.equal(interventions.reduce((n,i)=>n+i.operating_cost.high,0),screen.operating!.high);
  assert.ok(screen.extra_vehicles!<plan.screen.find(p=>p.package_id==='extra-service')!.extra_vehicles!);
});

test('upgrade delay uses calendar availability without inventing phases',()=>{
  assert.deepEqual(materialize(scenario,policy,links,1).packages.map(p=>p.package_id),['existing']);
  const later={...scenario,phases:[...scenario.phases,{phase_id:'later',year:2035,development_ids:[],occupied_share:1}]};
  const delayed=materialize(later,policy,links,1);
  assert.equal(delayed.packages.length,4);
  assert.ok(delayed.scenario.interventions.every(i=>i.earliest_phase==='later'));
});

test('unsupported zero-added-vehicle service fails before enqueue',()=>{
  assert.throws(()=>materialize(scenario,{...policy,lane_cycle_s:100},links),/at least one added vehicle/);
});

test('real B11 bridge preserves cohorts, computes waits, and retains native incoming/arrival events',async()=>{
  const result=await evaluate({scenario:structuredClone(defaultScenario),policy:null,random:{seed_ids:[17],draws_id:'b11-regression'},retain_replay:true,evaluator:'b11'});
  const c=result.comparison;
  assert.equal(c.fixture,false);
  assert.deepEqual(c.packages.map(p=>p.package_id),['existing']);
  assert.equal(c.cases.length,9);
  assert.ok(c.cases.every(item=>item.runs.every(r=>r.model_version===simulationModelVersion&&r.data_version===dataVersion&&r.seed_ids[0]===17&&r.diagnostics.conservation)));
  const replay=NativeReplaySchema.parse(result.native_replay);
  assert.ok(replay.events.some(e=>e.action==='passenger_arrive'));
  const incoming=new Set(replay.events.filter(e=>e.action==='generate').flatMap(e=>e.streetcar!.onboard_passenger_ids));
  assert.ok(incoming.size>0,'shared-cohort injection must preserve incoming riders');
  const waits=replay.passengers.filter(p=>!incoming.has(p.id)&&['arrived','beyond_segment'].includes(p.status)&&p.boarding_time_s!==null).map(p=>Math.max(0,p.boarding_time_s!-p.get_to_stop_time)).sort((a,b)=>a-b);
  assert.ok(waits.length>0);
  const runCase=c.cases.find(item=>item.runs.some(r=>r.run_id===replay.run_id))!;
  assert.equal(runCase.per_run_p95_wait_s[0],waits[Math.ceil(.95*waits.length)-1]);
  const native=result.native_metrics!.find(m=>m.run_id===replay.run_id)!.summary as any;
  assert.ok(native.contract.diagnostics.in_progress_at_cutoff_excluded>=0);
  const d=runCase.runs[0].diagnostics;
  assert.equal(d.passengers_created,native.contract.diagnostics.passengers_created+native.contract.diagnostics.in_progress_at_cutoff_excluded);
  assert.equal(d.unresolved_passengers,native.contract.diagnostics.unresolved_passengers+native.contract.diagnostics.in_progress_at_cutoff_excluded);
  assert.equal(result.native_metrics!.length,c.cases.length+result.delayedComparison!.cases.length);
  assert.equal(result.delayedComparison?.fixture,false);
});
