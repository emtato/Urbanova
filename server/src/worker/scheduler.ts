import { Worker } from 'node:worker_threads';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT,settings } from '../config.js';
import { dataVersion } from '../services/bundle.js';
import type { Store } from '../storage/store.js';
export function startScheduler(store:Store,options:{workerPath?:string;timeoutMs?:number;pollMs?:number}={}) {
  let busy=false,stopping=false,active:Worker|undefined;
  let inFlight:Promise<void>|undefined;
  async function tick(){
    if(busy||stopping)return;busy=true;
    try{
      const job=await store.claim();if(!job)return;
      try{
        const versions=job.payload.execution_versions;
        if(versions&&(versions.data_version!==dataVersion||versions.model_version!==settings.modelVersion))throw Error('Stale execution versions; submit a new job.');
        const entry=options.workerPath??resolve(ROOT,'server/dist/server/src/worker/evaluate.js');
        if(!existsSync(entry))throw Error('Build the server before starting its worker.');
        const result=await new Promise<any>((resolve,reject)=>{
          const worker=new Worker(entry,{workerData:job.payload});active=worker;
          const timeout=setTimeout(()=>{void worker.terminate();reject(Error('Worker timeout'));},options.timeoutMs??120000);
          const done=()=>{clearTimeout(timeout);active=undefined;};
          worker.once('message',message=>{done();if(message.ok)resolve(message.result);else reject(Error('Evaluation failed'));});
          worker.once('error',error=>{done();reject(error);});
          worker.once('exit',()=>{done();reject(Error('Worker exited without a result'));});
        });
        await store.finish(job,result);
      }catch{await store.fail(job);}
    }catch{console.error('Job scheduler unavailable; retrying.');}finally{busy=false;}
  }
  const kick=()=>{if(!inFlight)inFlight=tick().finally(()=>{inFlight=undefined;});};
  const timer=setInterval(kick,options.pollMs??1000);kick();
  return async()=>{stopping=true;clearInterval(timer);if(active)await active.terminate();await inFlight;};
}
