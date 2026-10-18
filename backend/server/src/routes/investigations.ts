import { Router } from 'express';
import * as z from 'zod';
import { parse } from '../services/validate.js';
import type { InvestigationService } from '../research/service.js';
import { assertCurrent,type Investigation } from '../research/contracts.js';
export function investigationsRouter(service:InvestigationService){
  const r=Router(),id=(raw:unknown)=>parse(z.string().uuid(),raw);
  const stale=(a:Investigation)=>{try{assertCurrent(a);return false;}catch{return true;}};
  r.get('/integration',(_q,s)=>s.json(service.integrationStatus()));
  r.post('/',async(q,s)=>s.status(202).json(await service.start(q.body)));
  r.get('/:id',async(q,s)=>{const a=await service.get(id(q.params.id));s.json({...a,stale:stale(a)});});
  r.get('/:id/replay',async(q,s)=>{const a=await service.get(id(q.params.id));s.json({investigation_id:a.id,status:a.status,stale:stale(a),provenance:a.provenance,events:a.events,finding:a.finding??null,writeback:a.writeback});});
  r.get('/:id/brief',async(q,s)=>{const a=await service.get(id(q.params.id));s.set('Content-Disposition',`attachment; filename="investigation-${a.id}.json"`).json(a);});
  r.post('/:id/notes',async(q,s)=>s.json(await service.addNote(id(q.params.id),q.body)));
  r.post('/:id/redirect',async(q,s)=>s.status(202).json(await service.redirect(id(q.params.id),q.body)));
  return r;
}
