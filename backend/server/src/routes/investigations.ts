import { Router } from 'express';
import * as z from 'zod';
import { parse } from '../services/validate.js';
import type { InvestigationService } from '../research/service.js';
import { assertCurrent,type Investigation } from '../research/contracts.js';
export function investigationsRouter(service:InvestigationService){
  const r=Router(),id=(raw:unknown)=>parse(z.string().uuid(),raw);
  const stale=(a:Investigation)=>{try{assertCurrent(a);return false;}catch{return true;}};
  // Keep private library excerpts in backend storage. Public residents can inspect
  // citation IDs/receipts and findings, not another person's reading history.
  const publicView=(a:Investigation)=>({...a,notes:a.notes.map(note=>note.mode==='papiers_live'?{...note,text:'[Private Papiers excerpt; open the item in your library to review.]'}:note)});
  r.get('/integration',(_q,s)=>s.json(service.integrationStatus()));
  r.post('/ask', async (q, s) => {
    const { question, scenario } = q.body ?? {};
    if (!question || typeof question !== 'string') {
      return s.status(400).json({ error: 'Question is required' });
    }
    const result = await service.askResearch(question, scenario);
    s.json(result);
  });
  r.post('/',async(q,s)=>s.status(202).json(await service.start(q.body)));
  r.get('/:id',async(q,s)=>{const a=await service.get(id(q.params.id));s.json({...publicView(a),stale:stale(a)});});
  r.get('/:id/replay',async(q,s)=>{const a=await service.get(id(q.params.id));s.json({investigation_id:a.id,status:a.status,stale:stale(a),provenance:a.provenance,events:a.events,finding:a.finding??null,writeback:a.writeback});});
  r.get('/:id/brief',async(q,s)=>{const a=await service.get(id(q.params.id));s.set('Content-Disposition',`attachment; filename="investigation-${a.id}.json"`).json(publicView(a));});
  r.post('/:id/notes',async(q,s)=>s.json(publicView(await service.addNote(id(q.params.id),q.body))));
  r.post('/:id/redirect',async(q,s)=>s.status(202).json(publicView(await service.redirect(id(q.params.id),q.body))));
  return r;
}
