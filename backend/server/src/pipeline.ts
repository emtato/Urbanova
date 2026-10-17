import {pathToFileURL} from 'node:url';
import {writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {PgStore,type Store} from './storage/store.js';
import {submitJob} from './services/submission.js';
import {startScheduler} from './worker/scheduler.js';
import {checkedComparison} from './services/comparisonIntegrity.js';
import {brief} from './services/brief.js';
import {compare} from './packages/compare.js';
import {ROOT,settings} from './config.js';
import {demoScenario,dataVersion,simulationModelVersion} from './services/bundle.js';
import {hash} from './core/cache.js';
import {reviewedPolicy} from './services/policy.js';

export async function runPipeline(store:Store,request:unknown,options:{remoteWorker?:boolean}={}){
  let job=await submitJob(store,request);
  const cached=job.status==='completed',stop=cached||options.remoteWorker?async()=>{}:startScheduler(store),started=Date.now();
  try{
    while(job.status==='queued'||job.status==='running'){
      if(Date.now()-started>settings.jobTimeoutMs+60000)throw Error('Pipeline deadline exceeded; job remains available by ID '+job.job_id);
      await new Promise(r=>setTimeout(r,250));job=(await store.job(job.job_id))!;
    }
    if(job.status!=='completed'||!job.comparison_id)throw Error(job.error??'Pipeline evaluation failed');
    const comparison=checkedComparison(await store.comparison(job.comparison_id)),delayed=await store.delayedComparison(job.comparison_id);
    return {job,comparison,decision:compare(comparison),brief:brief(comparison,delayed),cached,runtime_s:(Date.now()-started)/1000};
  }finally{await stop();}
}

export async function prepareDemo(store:Store){
  const latest=await store.scenario(demoScenario.scenario_id),candidate={...structuredClone(demoScenario),version:latest?.version??1};
  if(latest&&hash(latest)===hash(candidate))return latest;
  candidate.version=(latest?.version??0)+1;await store.saveScenario(candidate);return candidate;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const args=process.argv.slice(2),option=(key:string,fallback:string)=>{const at=args.indexOf(key);return at<0?fallback:args[at+1];};
  const store=new PgStore();
  try{
    await store.init();const scenario=await prepareDemo(store),runs=Number(option('--runs','20')),headway=Number(option('--headway','300'));
    if(!Number.isInteger(runs)||runs<1||runs>100||![240,300,360].includes(headway))throw Error('Use --runs 1..100 and --headway 240, 300 or 360');
    if(option('--scenario','demo')!=='demo')throw Error('The reviewed headless template is --scenario demo');
    const request={scenario_id:scenario.scenario_id,version:scenario.version,random:{seed_ids:Array.from({length:runs},(_,i)=>i),draws_id:'demo-paired-v2'},policy:reviewedPolicy(headway as 240|300|360),operations:{warmup_s:Number(option('--warmup','600')),clearance_s:Number(option('--clearance','1800'))},retain_replay:true};
    const result=await runPipeline(store,request,{remoteWorker:args.includes('--remote-worker')}),directory=resolve(ROOT,'data/cache/demo');mkdirSync(directory,{recursive:true});
    writeFileSync(resolve(directory,'brief.txt'),result.brief);
    const record={status:'ok',scenario_id:scenario.scenario_id,scenario_version:scenario.version,comparison_id:result.job.comparison_id,request,data_version:dataVersion,model_version:simulationModelVersion,orchestrator_version:settings.modelVersion,run_count:runs,phases:scenario.phases.length,cases:result.comparison.cases.length,packages:result.comparison.packages.length,fixture:result.comparison.fixture,cache_hit:result.cached,runtime_s:result.runtime_s,preferred_package:result.decision.preferred_package_id};
    writeFileSync(resolve(directory,'manifest.json'),JSON.stringify(record,null,2));console.log(JSON.stringify(record));
  }catch(error){console.error(error instanceof Error?error.message:'Pipeline failed');process.exitCode=1;}
  finally{await store.close();}
}
