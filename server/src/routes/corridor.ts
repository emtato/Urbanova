import { Router } from 'express';
import { corridor } from '../services/bundle.js';
import { CorridorSchema } from '../shared/schemas.js';
export function corridorRouter(){const r=Router();r.get('/',(_q,s)=>s.json(CorridorSchema.parse(corridor)));return r;}
