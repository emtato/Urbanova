import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {ROOT} from '../src/config.js';
import {defaultScenario,corridor,simulationModelVersion,dataVersion} from '../src/services/bundle.js';
import {materialize} from '../src/packages/materialize.js';
import {evaluate} from '../src/packages/evaluate.js';
import {NativeReplaySchema} from '../src/shared/schemas.js';
const policy=JSON.parse(readFileSync(resolve(ROOT,'backend/server/config/package-policy.example.json'),'utf8'));
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
  if(c.contract_version!=='3.0.0')throw Error('Expected native result contract');
  assert.equal(c.fixture,false);
  assert.deepEqual(c.packages.map(p=>p.package_id),['existing']);
  assert.equal(c.cases.length,9);
  assert.ok(c.cases.every(item=>item.runs.every(r=>r.model_version===simulationModelVersion&&r.data_version===dataVersion&&r.seed_ids[0]===17&&r.diagnostics.conservation)));
  const replay=NativeReplaySchema.parse(result.native_replay);
  assert.ok(replay.events.some(e=>e.action==='passenger_arrive'));
  const incoming=new Set(replay.events.filter(e=>e.action==='generate').flatMap(e=>e.streetcar!.onboard_passenger_ids));
  assert.ok(incoming.size>0,'shared-cohort injection must preserve incoming riders');
  const waits=replay.passengers.filter(p=>!incoming.has(p.id)&&p.boarding_time_s!==null).map(p=>Math.max(0,p.boarding_time_s!-p.get_to_stop_time)).sort((a,b)=>a-b);
  assert.ok(waits.length>0);
  const runCase=c.cases.find(item=>item.runs.some(r=>r.run_id===replay.run_id))!;
  assert.equal(runCase.per_run_p95_wait_s[0],waits[Math.ceil(.95*waits.length)-1]);
  const native=result.native_metrics!.find(m=>m.run_id===replay.run_id)!.summary as any;
  assert.ok(native.contract.diagnostics.in_progress_at_cutoff_excluded>=0);
  const d=runCase.runs[0].diagnostics;
  assert.deepEqual(d,native.contract.diagnostics);
  assert.equal(d.unresolved_passengers,native.overview.unresolved_passengers);
  assert.equal(runCase.per_run_denied_share[0],native.overview.denied_boarding_share);
  assert.equal(runCase.overall_results.run_count,1);
  assert.equal(runCase.overall_results.metrics.mean_wait_s.stddev,null);
  assert.equal(runCase.individual_results[0].inputs.seed,runCase.overall_results.seeds[0]);
  assert.deepEqual(runCase.individual_results[0].sim_log,replay.events);
  assert.deepEqual(runCase.individual_results[0].summary,native);
  assert.equal(result.native_metrics!.length,c.cases.length+result.delayedComparison!.cases.length);
  assert.equal(result.delayedComparison?.fixture,false);
});

test('all four real packages retain native batches and matching requested seeds',async()=>{
  const result=await evaluate({scenario,policy,random:{seed_ids:[29],draws_id:'native-four-packages'},retain_replay:false,evaluator:'b11'});
  const c=result.comparison;
  if(c.contract_version!=='3.0.0')throw Error('Expected native comparison');
  assert.equal(c.packages.length,4);
  assert.equal(c.cases.length,15);
  assert.equal(result.native_replay,null);
  assert.ok(c.cases.every(item=>item.individual_results.length===1&&item.runs[0].seed_ids[0]===29));
  assert.ok(c.cases.every(item=>item.per_run_unresolved_passengers[0]===item.individual_results[0].summary.overview.unresolved_passengers));
});

test('multiple seeds preserve ordering and native variation through compressed transport',async()=>{
  const result=await evaluate({scenario:structuredClone(defaultScenario),policy:null,random:{seed_ids:[8,3],draws_id:'native-multiple-seeds'},retain_replay:false,evaluator:'b11'});
  const c=result.comparison;
  if(c.contract_version!=='3.0.0')throw Error('Expected native comparison');
  for(const item of c.cases){
    assert.deepEqual(item.runs.map(r=>r.seed_ids[0]),[8,3]);
    assert.equal(item.overall_results.run_count,2);
    assert.deepEqual(item.individual_results.map(r=>r.inputs.seed),item.overall_results.seeds);
    assert.equal(item.overall_results.metrics.mean_wait_s.valid_run_count,2);
    assert.ok(item.overall_results.metrics.mean_wait_s.stddev!==null);
  }
});
