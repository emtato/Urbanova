import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT } from '../src/config.js';
import { createApp } from '../src/app.js';
import { defaultScenario,fixture } from '../src/services/bundle.js';
import { checkedComparison } from '../src/services/comparisonIntegrity.js';
import { memoryStore } from './support.js';
import { startScheduler } from '../src/worker/scheduler.js';
const policy=JSON.parse(readFileSync(resolve(ROOT,'server/config/package-policy.example.json'),'utf8'));

test('cost screen accepts labelled assumptions and checks budgets, phase IDs, source IDs and ranges',async()=>{
  const app=createApp(memoryStore(),async()=>null),path=`/api/scenarios/${defaultScenario.scenario_id}/packages`;
  const preview=await request(app).post(path).send({version:1,policy}).expect(200);
  assert.equal(preview.body.policy_status,'user_selected');assert.equal(preview.body.packages.length,4);
  assert.equal(preview.body.upgrade_delay.packages.filter((p:any)=>p.feasible).length,1);
  assert.match(preview.body.notice,/No ridership/);
  await request(app).post(path).send({version:1,policy:{...policy,source_ids:['made-up']}}).expect(422);
  await request(app).post(path).send({version:1,policy:{...policy,availability:{lane:'missing',extra_service:'phase-1'}}}).expect(422);
  await request(app).post(path).send({version:1,policy:{...policy,cost_per_hour:{low:500,central:10,high:1}}}).expect(422);
  const job=await request(app).post('/api/jobs').send({scenario_id:defaultScenario.scenario_id,version:1,random:{seed_ids:[1],draws_id:'policy-test'},policy}).expect(202);
  assert.equal(job.body.fixture,true);
});

test('frozen output guard rejects cross-references, wrong flags and broken accounting',()=>{
  assert.ok(checkedComparison(fixture));
  for(const damage of [
    (c:typeof fixture)=>{c.corridor.source_ids=['unknown'];},
    (c:typeof fixture)=>{c.packages[0].evaluations[0].case_id=c.packages[1].evaluations[0].case_id;},
    (c:typeof fixture)=>{c.cases[0].runs[0].diagnostics.passengers_created++;},
    (c:typeof fixture)=>{c.packages[0].evaluations[0].criterion_met=true;},
    (c:typeof fixture)=>{c.packages[0].evaluations[0].feasible=false;},
  ]){const c=structuredClone(fixture);damage(c);assert.throws(()=>checkedComparison(c));}
});

for(const fault of ['empty','hang'])test(`worker ${fault} fails the job and allows graceful shutdown`,async()=>{
  const store=memoryStore();const job=await store.enqueue(defaultScenario,fault,{scenario:defaultScenario});
  const stop=startScheduler(store,{workerPath:resolve(ROOT,`server/dist/server/test/workers/${fault}.js`),timeoutMs:300,pollMs:10});
  try{for(let n=0;n<50&&job.status!=='failed';n++)await new Promise(r=>setTimeout(r,20));assert.equal(job.status,'failed');}
  finally{await stop();}
});

test('saved delayed results are consumed by summary and planning brief',async()=>{
  const store=memoryStore(),job=await store.enqueue(defaultScenario,'delay-report',{});
  const delayed=structuredClone(fixture);delayed.comparison_id='test-delayed-comparison';
  await store.finish(job,{comparison:fixture,delayedComparison:delayed,package_screen:[],notice:'Synthetic test only'});
  const app=createApp(store,async()=>null);
  const summary=await request(app).get(`/api/results/${job.comparison_id}/summary`).expect(200);
  assert.equal(summary.body.sensitivity.upgrade_delay.status,'tested');
  assert.equal(summary.body.sensitivity.upgrade_delay.comparison_id,delayed.comparison_id);
  const brief=await request(app).get(`/api/results/${job.comparison_id}/brief`).expect(200);assert.match(brief.text,/Upgrade-delay run/);
});
test('queued work pins execution versions and refuses mixed-version evaluation',async()=>{
  const store=memoryStore(),job=await store.enqueue(defaultScenario,'stale-data',{execution_versions:{data_version:'old-data',model_version:'old-model'}});
  const app=createApp(store,async()=>null);
  const status=await request(app).get(`/api/jobs/${job.job_id}`).expect(200);assert.equal(status.body.stale,true);
  const stop=startScheduler(store,{pollMs:10});
  try{for(let n=0;n<50&&job.status!=='failed';n++)await new Promise(r=>setTimeout(r,20));assert.equal(job.status,'failed');}
  finally{await stop();}
});
test('Railway configs target the same Express image and docs are served',async()=>{
  const root=JSON.parse(readFileSync(resolve(ROOT,'railway.json'),'utf8'));
  const server=JSON.parse(readFileSync(resolve(ROOT,'server/railway.json'),'utf8'));
  assert.deepEqual(root,server);assert.equal(root.build.dockerfilePath,'server/Dockerfile');
  await request(createApp(memoryStore(),async()=>null)).get('/docs').expect(200).expect('Content-Type',/text\/plain/);
});
