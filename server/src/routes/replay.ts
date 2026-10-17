import { Router } from 'express';
import * as z from 'zod';
import { ReplaySchema,NativeReplaySchema } from '../shared/schemas.js';
import { parse } from '../services/validate.js';
import { ApiError } from '../core/errors.js';
import type { Store } from '../storage/store.js';
export function replayRouter(store:Store){const r=Router();r.get('/:id',async(q,s)=>{
  const id=parse(z.uuid(),q.params.id),native=await store.nativeReplay(id);
  if(native){s.set('X-FutureProof-Fixture','false');s.json(NativeReplaySchema.parse(native));return;}
  const c=await store.comparison(id);
  if(!c?.replay)throw new ApiError(404,'Replay not retained. Submit a job with retain_replay=true.');
  s.set('X-FutureProof-Fixture',String(c.fixture));s.json(ReplaySchema.parse(c.replay));
});return r;}
