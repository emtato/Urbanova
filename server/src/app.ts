import express,{type ErrorRequestHandler} from 'express';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import cors from 'cors';
import { settings,ROOT } from './config.js';
import { ApiError } from './core/errors.js';
import { fixture } from './services/bundle.js';
import { dataVersion } from './services/bundle.js';
import { ComparisonSchema } from './shared/schemas.js';
import { gemini,type Generate } from './ai/gemini.js';
import type { Store } from './storage/store.js';
import { corridorRouter } from './routes/corridor.js';
import { scenariosRouter } from './routes/scenarios.js';
import { jobsRouter } from './routes/jobs.js';
import { resultsRouter } from './routes/results.js';
import { replayRouter } from './routes/replay.js';
export function createApp(store:Store,generate:Generate=gemini(store)){
  const app=express();app.disable('x-powered-by');
  app.use(cors({origin:settings.origins,methods:['GET','POST'],allowedHeaders:['Content-Type']}));
  app.use(express.json({limit:'256kb'}));
  app.get('/',(_q,s)=>s.json({service:'FutureProof',api:'/api',health:'/health',docs:'/docs'}));
  app.get('/docs',(_q,s)=>s.type('text/plain').send(readFileSync(resolve(ROOT,'docs/lane-c.md'),'utf8')));
  app.get(['/health','/api/health','/api/health/db'],async(_q,s)=>{try{await store.ping();s.json({status:'ok',database:'ok',model_version:settings.modelVersion,data_version:dataVersion});}catch{s.status(503).json({status:'unavailable',database:'unavailable'});}});
  app.get('/api/fixtures/sample-comparison',(_q,s)=>{s.set('X-FutureProof-Fixture','true');s.json(ComparisonSchema.parse(fixture));});
  app.use('/api/corridor',corridorRouter());app.use('/api/scenarios',scenariosRouter(store,generate));
  app.use('/api/jobs',jobsRouter(store));app.use('/api/results',resultsRouter(store,generate));app.use('/api/replay',replayRouter(store));
  app.use((_q,_s,next)=>next(new ApiError(404,'Endpoint not found.')));
  const error:ErrorRequestHandler=(e,_q,s,_next)=>{
    if(e instanceof ApiError){s.status(e.status).json({error:e.message,details:e.details??null});return;}
    if(e?.type==='entity.parse.failed'){s.status(400).json({error:'Malformed JSON.'});return;}
    if(e?.type==='entity.too.large'){s.status(413).json({error:'Request exceeds 256kb.'});return;}
    // Never send PostgreSQL, SDK or stack details (which may contain secrets).
    s.status(503).json({error:'Service temporarily unavailable.'});
  };
  app.use(error);return app;
}
