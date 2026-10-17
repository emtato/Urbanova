import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { createApp } from '../app.js';
import { PgStore } from '../storage/store.js';
import { startScheduler } from '../worker/scheduler.js';
import { ComparisonSchema,ScenarioSchema } from '../shared/schemas.js';
const store=new PgStore();let closeWorker:(()=>Promise<void>)|undefined;
let server:ReturnType<ReturnType<typeof createApp>['listen']>|undefined;
try{
  await store.init();closeWorker=startScheduler(store);
  server=createApp(store,async()=>null).listen(0,'127.0.0.1');await once(server,'listening');
  const address=server.address();if(!address||typeof address==='string')throw Error('No local port');
  const base=`http://127.0.0.1:${address.port}/api`;
  async function call(path:string,body?:unknown){const response=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});if(!response.ok)throw Error(`HTTP ${response.status} for ${path}`);return response.json();}
  const scenario=ScenarioSchema.parse(await call('/scenarios',{scenario_id:'lane-c-smoke-'+randomUUID()}));
  const created=await call('/jobs',{scenario_id:scenario.scenario_id,version:1,random:{seed_ids:[42],draws_id:'smoke-paired'},retain_replay:true});
  let job=created;
  for(let n=0;n<80&&job.status!=='completed'&&job.status!=='failed';n++){await new Promise(r=>setTimeout(r,250));job=await call('/jobs/'+created.job_id);}
  if(job.status!=='completed')throw Error('Job did not complete');
  const c=ComparisonSchema.parse(await call('/results/'+job.comparison_id));
  if(!c.fixture)throw Error('Stub must remain labelled fixture');
  await call('/replay/'+job.comparison_id);
  const count=await store.pool.query('SELECT count(*)::int AS count FROM c_run_aggregates WHERE comparison_id=$1',[job.comparison_id]);
  if(count.rows[0].count!==c.cases.reduce((n,x)=>n+x.runs.length,0))throw Error('Run aggregate count mismatch');
  await call('/scenarios/'+scenario.scenario_id+'/patch',{version:1,patch:{demand_case:'high'}});
  const stale=await call('/jobs/'+job.job_id);if(!stale.stale)throw Error('Old job must be stale');
  const plan=await store.pool.query('SELECT a.development_id,s.name FROM c_development_access a JOIN c_stops s USING(data_version,stop_id) LIMIT 1');
  if(!plan.rowCount)throw Error('No access join rows');
  console.log(JSON.stringify({status:'ok',storage:'Tiger Data',worker:'worker_threads',fixture:true,persisted_runs:count.rows[0].count,stale_edit:true,access_join:true}));
}catch{console.error('Live storage smoke failed; check DB/network and worker configuration.');process.exitCode=1;}
finally{if(closeWorker)await closeWorker();if(server)await new Promise<void>(r=>server!.close(()=>r()));await store.close();}
