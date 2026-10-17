import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { memoryStore } from './support.js';
import { defaultScenario,dataVersion,simulationModelVersion } from '../src/services/bundle.js';
import { ComparisonSchema,CorridorSchema } from '../src/shared/schemas.js';
import { startScheduler } from '../src/worker/scheduler.js';

test('health, CORS, JSON errors, reviewed corridor and validation',async()=>{
  const store=memoryStore(),app=createApp(store,async()=>null);
  await request(app).get('/health').set('Origin','http://localhost:5173').expect(200).expect('Access-Control-Allow-Origin','http://localhost:5173');
  const c=await request(app).get('/api/corridor').expect(200);assert.ok(CorridorSchema.safeParse(c.body).success);
  await request(app).post('/api/scenarios').set('Content-Type','application/json').send('{').expect(400);
  await request(app).get('/missing').expect(404).expect('Content-Type',/json/);
  const bad=await request(app).post(`/api/scenarios/${defaultScenario.scenario_id}/patch`).send({version:1,patch:{fleet_allowance:101}}).expect(422);assert.match(JSON.stringify(bad.body),/100/);
  store.ping=async()=>{throw Error('postgres://secret');};const health=await request(app).get('/health').expect(503);assert.ok(!JSON.stringify(health.body).includes('secret'));
});
test('enqueue, worker thread, polling, frozen fixture, cache and stale edit',async()=>{
  const store=memoryStore(),app=createApp(store,async()=>null),stop=startScheduler(store);
  try{
    const payload={scenario_id:defaultScenario.scenario_id,version:1,random:{seed_ids:[42],draws_id:'paired-test'},retain_replay:true,evaluator:'fixture'};
    const first=await request(app).post('/api/jobs').send(payload).expect(202);
    const cached=await request(app).post('/api/jobs').send(payload).expect(202);assert.equal(cached.body.job_id,first.body.job_id);
    let job;
    for(let n=0;n<60;n++){job=(await request(app).get(`/api/jobs/${first.body.job_id}`).expect(200)).body;if(job.status==='completed'||job.status==='failed')break;await new Promise(r=>setTimeout(r,100));}
    assert.equal(job.status,'completed');assert.match(job.notice,/EXPLICIT FIXTURE MODE/);
    const c=await request(app).get(`/api/results/${job.comparison_id}`).expect(200);assert.ok(ComparisonSchema.safeParse(c.body).success);assert.equal(c.body.fixture,true);assert.notEqual(c.body.scenario.scenario_id,payload.scenario_id);
    await request(app).get(`/api/results/${job.comparison_id}/summary`).expect(200);
    await request(app).get(`/api/replay/${job.comparison_id}`).expect(200);
    const brief=await request(app).get(`/api/results/${job.comparison_id}/brief`).expect(200);assert.match(brief.text,/FIXTURE/);
    await request(app).post(`/api/scenarios/${payload.scenario_id}/patch`).send({version:1,patch:{demand_case:'high'}}).expect(200);
    const stale=await request(app).get(`/api/jobs/${job.job_id}`).expect(200);assert.equal(stale.body.stale,true);
    await request(app).post('/api/jobs').send(payload).expect(409);
    const explanation=await request(app).post(`/api/results/${job.comparison_id}/explain`).expect(200);assert.equal(explanation.body.fallback,true);
  }finally{await stop();}
});

test('runSimulation, getSimulations and deleteSimulation run single situation, persist batches and delete by id',async()=>{
  const store=memoryStore(),app=createApp(store,async()=>null);
  let completed=false;
  const pending=request(app).post('/api/run/simulation').send({
    run_count:2,seed:11,development_ids:[defaultScenario.developments[0].id],headway_randomness_s:5,
  }).expect(200).then(response=>{completed=true;return response;});
  await new Promise(resolve=>setTimeout(resolve,100));
  await request(app).get('/health').expect(200);
  assert.equal(completed,false,'Health remains responsive during worker computation');
  const first=await pending;
  assert.equal(typeof first.body.id,'string');
  assert.equal(first.body.provenance.model_version,simulationModelVersion);
  assert.equal(first.body.provenance.data_version,dataVersion);
  assert.equal(first.body.provenance.configuration_id,first.body.id);
  assert.ok(first.body.provenance.source_ids.length>0);
  assert.equal(first.body.overall_results.run_count,2);
  assert.deepEqual(first.body.overall_results.seeds,[11,12]);
  assert.equal(first.body.individual_results.length,2);
  assert.equal(first.body.individual_results[0].inputs.developments.length,1);
  assert.equal(first.body.individual_results[0].inputs.developments[0].id,defaultScenario.developments[0].id);

  const second=await request(app).post('/api/run/simulation').send({
    run_count:1,seed:11,development_ids:[],
  }).expect(200);
  assert.notEqual(second.body.id,first.body.id);
  assert.equal(second.body.individual_results[0].inputs.developments.length,0);

  const fetched=await request(app).get('/api/sim/fetch').expect(200);
  assert.equal(fetched.body.length,2);
  assert.deepEqual(fetched.body.map((b:any)=>b.id),[second.body.id,first.body.id]);

  const deleted=await request(app).post('/api/sim/delete').send({id:first.body.id}).expect(200);
  assert.deepEqual(deleted.body,{id:first.body.id,deleted:true});
  await request(app).post('/api/sim/delete').send({id:first.body.id}).expect(404);

  const remaining=await request(app).get('/api/sim/fetch').expect(200);
  assert.deepEqual(remaining.body.map((b:any)=>b.id),[second.body.id]);

  await request(app).post('/api/sim/delete').send({id:'not-a-uuid'}).expect(422);
  await request(app).post('/api/run/simulation').send({run_count:26}).expect(422);
});
