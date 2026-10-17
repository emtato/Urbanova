import {test} from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import {parseSettings} from '../src/config.js';
import {demoScenario,defaultScenario,corridor} from '../src/services/bundle.js';
import {reviewedPolicy} from '../src/services/policy.js';
import {materialize} from '../src/packages/materialize.js';
import {applyPatch,validateScenario} from '../src/services/validate.js';
import {runPipeline,prepareDemo} from '../src/pipeline.js';
import {createApp} from '../src/app.js';
import {memoryStore} from './support.js';

test('configuration errors are bounded and never echo a database credential',()=>{
  const env={DATABASE_URL:'postgresql://test:private-marker@localhost/test',GEMINI_ENABLED:'false'};
  assert.equal(parseSettings(env).port,8010);
  assert.throws(()=>parseSettings({...env,PORT:'bad'}),error=>!String(error).includes('private-marker'));
  assert.throws(()=>parseSettings({...env,GEMINI_ENABLED:'true'}),/GEMINI_API_KEY/);
  assert.throws(()=>parseSettings({...env,CORS_ORIGINS:'["https://example.com/path"]'}),/origins/);
});

test('reviewed policies materialize their actual listed-link effect and preserve two-phase housing',()=>{
  const policy=reviewedPolicy();assert.equal(policy.service_headway_s,300);assert.equal(policy.lane_travel_time_multiplier,.88);
  assert.ok(policy.source_ids.length>0);
  const plan=materialize(validateScenario(demoScenario),policy,corridor.links.map(l=>l.link_id));
  assert.equal(plan.packages.length,4);
  assert.ok(plan.scenario.interventions.filter(i=>i.type==='priority_lane').every(i=>i.effect.central===.88));
  const changed=applyPatch(defaultScenario,{phases:demoScenario.phases});assert.equal(changed.phases.length,2);
  assert.throws(()=>applyPatch(defaultScenario,{phases:demoScenario.phases.map(p=>({...p,development_ids:[defaultScenario.developments[0].id]}))}),/exactly one phase/);
});

test('one submission pipeline supports headless workers, persisted reload, cache, stale edits and brief download',async()=>{
  const store=memoryStore(),scenario=await prepareDemo(store);
  const input={scenario_id:scenario.scenario_id,version:scenario.version,random:{seed_ids:[42],draws_id:'pipeline-test'},evaluator:'fixture',retain_replay:true};
  const first=await runPipeline(store,input),cached=await runPipeline(store,input);
  assert.equal(first.job.job_id,cached.job.job_id);assert.equal(cached.cached,true);assert.equal(first.comparison.fixture,true);
  const app=createApp(store,async()=>null);
  await request(app).get(`/api/scenarios/${scenario.scenario_id}?version=1`).expect(200);
  const history=await request(app).get(`/api/results?scenario_id=${scenario.scenario_id}`).expect(200);assert.equal(history.body.results.length,1);
  await request(app).get(`/api/results/${first.job.comparison_id}/brief`).expect(200).expect('Content-Disposition',/attachment/);
  await request(app).post(`/api/scenarios/${scenario.scenario_id}/patch`).send({version:1,patch:{fleet_allowance:0}}).expect(200);
  assert.equal(await store.staleComparison(first.job.comparison_id!),true);
  await assert.rejects(()=>runPipeline(store,input),/stale/);
});

test('reviewed catalogue is exposed without changing frontend contracts and refuses invalid history filters',async()=>{
  const app=createApp(memoryStore(),async()=>null);
  const catalogue=await request(app).get('/api/corridor/interventions').expect(200);assert.equal(catalogue.body.policies.length,3);
  await request(app).get('/api/results?limit=0').expect(422);
  await request(app).get('/api/scenarios/default?version=0').expect(200);
});
