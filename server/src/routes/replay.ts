import { Router } from 'express';
import * as z from 'zod';
import { ReplaySchema } from '../shared/schemas.js';
import { parse } from '../services/validate.js';
import { ApiError } from '../core/errors.js';
import type { Store } from '../storage/store.js';
export function replayRouter(store:Store){const r=Router();r.get('/:id',async(q,s)=>{
  const c=await store.comparison(parse(z.uuid(),q.params.id));
  if(!c?.replay)throw new ApiError(404,'Replay not retained. Submit a job with retain_replay=true.');
  s.set('X-FutureProof-Fixture',String(c.fixture));s.json(ReplaySchema.parse(c.replay));
});return r;}
