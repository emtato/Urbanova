import { Worker } from 'node:worker_threads';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT } from '../config.js';
import type { Store } from '../storage/store.js';
export function startScheduler(store:Store) {
  let busy=false,stopping=false,active:Worker|undefined;
  async function tick(){
    if(busy||stopping)return;busy=true;
    try{
      const job=await store.claim();if(!job)return;
      try{
        const entry=resolve(ROOT,'server/dist/server/src/worker/evaluate.js');
        if(!existsSync(entry))throw Error('Build the server before starting its worker.');
        const result=await new Promise<any>((resolve,reject)=>{
          const worker=new Worker(entry,{workerData:job.payload});active=worker;
          const timeout=setTimeout(()=>{void worker.terminate();reject(Error('Worker timeout'));},120000);
          const done=()=>{clearTimeout(timeout);active=undefined;};
          worker.once('message',message=>{done();if(message.ok)resolve(message.result);else reject(Error('Evaluation failed'));});
          worker.once('error',error=>{done();reject(error);});
          worker.once('exit',code=>{done();if(code!==0)reject(Error('Worker exited'));});
        });
        await store.finish(job,result);
      }catch{await store.fail(job);}
    }catch{console.error('Job scheduler unavailable; retrying.');}finally{busy=false;}
  }
  const timer=setInterval(()=>void tick(),1000);void tick();
  return async()=>{stopping=true;clearInterval(timer);if(active)await active.terminate();};
}
