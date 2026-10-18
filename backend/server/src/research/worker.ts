import { parentPort,workerData } from 'node:worker_threads';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { ROOT } from '../config.js';

const local=resolve(ROOT,process.platform==='win32'?'.venv/Scripts/python.exe':'.venv/bin/python');
const child=spawn(process.env.PYTHON_EXECUTABLE??(existsSync(local)?local:'python3'),['-m','backend.integration.assumption_audit'],
  {cwd:ROOT,env:{...process.env,DATABASE_URL:'',GEMINI_API_KEY:''},windowsHide:true,stdio:['pipe','pipe','pipe']});
if(child.pid)parentPort!.postMessage({type:'child',pid:child.pid});
const chunks:Buffer[]=[];let bytes=0;
child.stdout.on('data',(chunk:Buffer)=>{bytes+=chunk.length;if(bytes>32*1024*1024){child.kill();parentPort!.postMessage({ok:false});}else chunks.push(chunk);});
child.stderr.resume();child.stdin.on('error',()=>{});
child.on('error',()=>parentPort!.postMessage({ok:false}));
child.on('close',code=>{if(code!==0){parentPort!.postMessage({ok:false});return;}try{parentPort!.postMessage({ok:true,result:JSON.parse(Buffer.concat(chunks).toString())});}catch{parentPort!.postMessage({ok:false});}});
child.stdin.end(JSON.stringify(workerData));
