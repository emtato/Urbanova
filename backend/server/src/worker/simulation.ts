import {parentPort,workerData} from 'node:worker_threads';
import {runSimulationBatch} from '../packages/evaluate.js';
try{parentPort!.postMessage({ok:true,result:await runSimulationBatch(workerData)});}
catch{parentPort!.postMessage({ok:false});}
