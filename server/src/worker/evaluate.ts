import { parentPort,workerData } from 'node:worker_threads';
import { evaluate } from '../packages/evaluate.js';
try {parentPort!.postMessage({ok:true,result:evaluate(workerData)});}
catch {parentPort!.postMessage({ok:false});}
