import { parentPort,workerData } from 'node:worker_threads';
import { evaluate } from '../packages/evaluate.js';
try {parentPort!.postMessage({ok:true,result:await evaluate(workerData)});}
catch(error) {parentPort!.postMessage({ok:false,error:error instanceof Error?error.message:'Evaluation failed'});}
