import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT } from '../config.js';
import { createApp } from '../app.js';
import { PgStore } from '../storage/store.js';
import { startScheduler } from '../worker/scheduler.js';
import { ComparisonSchema,NativeReplaySchema } from '../shared/schemas.js';
const store=new PgStore();let stop:undefined|(()=>Promise<void>),server:ReturnType<ReturnType<typeof createApp>['listen']>|undefined;
try{
  await store.init();stop=startScheduler(store);server=createApp(store,async()=>null).listen(0,'127.0.0.1');await once(server,'listening');
  const address=server.address();if(!address||typeof address==='string')throw Error('No port');
  const base=`http://127.0.0.1:${address.port}/api`;
  async function call(path:string,body?:unknown){const response=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});if(!response.ok)throw Error(`HTTP ${response.status} for ${path}`);return response.json();}
  const s=await call('/scenarios',{scenario_id:'b11-smoke-'+randomUUID()});
  await call(`/scenarios/${s.scenario_id}/patch`,{version:1,patch:{capital_budget_cad:10000000,annual_operating_budget_cad:2000000,fleet_allowance:20}});
  const policy=JSON.parse(readFileSync(resolve(ROOT,'server/config/package-policy.example.json'),'utf8'));
  const input={scenario_id:s.scenario_id,version:2,random:{seed_ids:[42],draws_id:'b11-real-smoke'},policy,retain_replay:true};
  let job=await call('/jobs',input);const id=job.job_id;
  for(let n=0;n<1200&&job.status!=='completed'&&job.status!=='failed';n++){await new Promise(r=>setTimeout(r,250));job=await call('/jobs/'+id);}
  if(job.status!=='completed')throw Error('B11 job failed or timed out');
  const c=ComparisonSchema.parse(await call('/results/'+job.comparison_id));
  if(c.fixture||c.packages.length!==4)throw Error('Expected four real package evaluations');
  const replay=NativeReplaySchema.parse(await call('/replay/'+job.comparison_id));
  if(!replay.events.some(e=>e.action==='passenger_arrive')||!replay.events.some(e=>e.action==='generate'&&(e.onboard_count_after??0)>0))throw Error('Replay must retain arrivals and incoming occupancy');
  const summary=await call('/results/'+job.comparison_id+'/summary');
  const native=await call('/results/'+job.comparison_id+'/b11-metrics');
  if(native.format_version!=='b11-metrics-v1'||native.runs.length!==c.cases.length)throw Error('Missing native B11 summaries');
  if(await store.staleComparison(job.comparison_id))throw Error('Fresh B11 result incorrectly stale');
  if(summary.sensitivity.upgrade_delay.status!=='tested')throw Error('Missing independently materialized delay result');
  const cached=await call('/jobs',input);if(cached.job_id!==id)throw Error('Cache mismatch');
  const aggregates=await store.pool.query('SELECT count(*)::int AS n FROM c_run_aggregates WHERE comparison_id=$1',[job.comparison_id]);
  console.log(JSON.stringify({status:'ok',fixture:false,packages:c.packages.map(p=>p.package_id),cases:c.cases.length,persisted_runs:aggregates.rows[0].n,native_events:replay.events.length,delay:'tested',cache:'hit',comparison_id:job.comparison_id,costs:'explicit synthetic test assumptions; service metrics computed by B11'}));
}catch(error){console.error(error instanceof Error?error.message:'B11 smoke failed');process.exitCode=1;}
finally{if(stop)await stop();if(server)await new Promise<void>(r=>server!.close(()=>r()));await store.close();}
