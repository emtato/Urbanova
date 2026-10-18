import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { InvestigationService,type Execute } from '../src/research/service.js';
import { memoryAuditRepository } from '../src/research/repository.js';
import { paired,validatePairing,recipes } from '../src/research/analysis.js';
import { createApp } from '../src/app.js';
import { memoryStore } from './support.js';
import { reviewed } from '../src/services/bundle.js';
import type { KnowledgeLibrary } from '../src/research/knowledge.js';
const stop=reviewed.inputs.stops[1].id;
const compute:Execute=async r=>r.recipes.map(recipe=>({recipe,batch_id:`test-${recipe.id}`,overall_results:{},runs:r.seeds.map(seed=>({inputs:{seed,existing_cohort_signature:`${seed}-${recipe.demand_factor}`},summary:{overview:{conservation_valid:true},by_stop:[{stop_id:stop,by_rider_group:{existing:{denied_at_least_once_share:recipe.id==='incoming_high'?.6:recipe.id==='incoming_low'?.1:recipe.id==='no_new_homes'?.15:recipe.id==='extra_service'?.01:.2}}}]}}))}));
function setup(library?:KnowledgeLibrary){const repo=memoryAuditRepository(),service=new InvestigationService(repo,compute,library);return {repo,service,app:createApp(memoryStore(),async()=>null,service)};}
test('paired classification includes run variation, null pairs, and opposing evidence',()=>{
  assert.equal(paired([[.4,.45,.5],[.1,.1,.1]],v=>v[0]-v[1],.02).classification,'supported');
  assert.equal(paired([[0,0,0],[.2,.2,.2]],v=>v[0]-v[1],.02).classification,'contradicted');
  assert.equal(paired([[.4,0,.8],[.3,.6,.1]],v=>v[0]-v[1],.02).classification,'inconclusive');
  assert.equal(paired([[null,.5,null],[.1,.1,.1]],v=>v[0]-v[1]).classification,'inconclusive');
});
test('audit pauses without evidence and resumes only after a real submitted human redirect',async()=>{
  const {service,repo}=setup();const a=await service.start({seeds:[11,12,13]});
  await service.tick();const paused=await service.get(a.id);
  assert.equal(paused.status,'awaiting_human');assert.equal(paused.finding.classification,'supported');
  assert.equal(paused.selection?.knob,'incoming_load');assert.equal(paused.notes.length,0);
  assert.equal(paused.writeback.status,'pending_connection');
  assert.ok(paused.events.some(e=>e.type==='human_question'));
  await service.redirect(a.id,{author:'TEST researcher',note:'TEST ONLY: no extra vehicles at move-in',no_extra_vehicles:true});
  // A new service over the repository can resume the durable job.
  await new InvestigationService(repo,compute).tick();const done=await service.get(a.id);
  assert.equal(done.status,'completed');assert.equal(done.redirect?.author,'TEST researcher');
  assert.ok(done.experiments.slice(7).every(e=>e.recipe.headway_s===reviewed.inputs.headway_s));
  assert.equal(done.events.filter(e=>e.type==='human_redirect').length,1);
  assert.deepEqual(done.events.map(e=>e.sequence),done.events.map((_,i)=>i+1));
  assert.equal(done.writeback.status,'pending_connection');
});
test('no-extra-vehicles redirects an otherwise preferred service experiment',async()=>{
  const serviceCompute:Execute=async r=>{const results=await compute(r);for(const e of results)if(e.recipe.id==='incoming_high')for(const run of e.runs)run.summary.by_stop[0].by_rider_group.existing.denied_at_least_once_share=.1;return results;};
  const service=new InvestigationService(memoryAuditRepository(),serviceCompute);const a=await service.start({seeds:[1,2,3]});await service.tick();
  assert.equal((await service.get(a.id)).selection?.knob,'service_frequency');
  const redirected=await service.redirect(a.id,{author:'TEST',note:'TEST fleet unavailable',no_extra_vehicles:true});
  assert.notEqual(redirected.selection?.knob,'service_frequency');
  assert.ok(recipes(redirected).every(r=>r.headway_s===reviewed.inputs.headway_s));
});
test('manual notes remain manual and affect the next recipe only with human review',async()=>{
  const {service}=setup();const a=await service.start({seeds:[1,2,3]});await service.tick();
  const noted=await service.addNote(a.id,{id:'TEST-note',author:'TEST researcher',title:'TEST local knowledge',text:'TEST ONLY unobserved estimate',knob:'incoming_load',incoming_load_range:[40,80]});
  assert.equal(noted.notes[0].mode,'manual_copy');
  const redirect=await service.redirect(a.id,{author:'TEST reviewer',note:'TEST bounds accepted',no_extra_vehicles:true});
  assert.deepEqual(recipes(redirect)[0].incoming_load_range,[40,80]);
  assert.equal(redirect.writeback.status,'pending_connection');
});
test('HTTP validates stop IDs, seeds, bounds, states and contradictory human settings',async()=>{
  const {app,service}=setup();
  await request(app).post('/api/investigations').send({stop_id:'unknown'}).expect(422);
  await request(app).post('/api/investigations').send({seeds:[1,1,1]}).expect(422);
  await request(app).post('/api/investigations').send({incoming_load_range:[50,10]}).expect(422);
  await request(app).post('/api/investigations').send({incoming_load_range:[0,10000]}).expect(422);
  const started=await request(app).post('/api/investigations').send({seeds:[1,2,3]}).expect(202),id=started.body.id;
  await request(app).post(`/api/investigations/${id}/redirect`).send({author:'TEST',note:'TEST too early',no_extra_vehicles:true}).expect(409);
  await service.tick();
  await request(app).post(`/api/investigations/${id}/notes`).send({id:'TEST-mismatch',title:'TEST',author:'TEST',text:'TEST mismatch',knob:'service_frequency',incoming_load_range:[1,2]}).expect(422);
  await request(app).post(`/api/investigations/${id}/redirect`).send({author:'TEST',note:'TEST conflict',no_extra_vehicles:true,headway_s:reviewed.inputs.headway_s*.75}).expect(422);
  const replay=await request(app).get(`/api/investigations/${id}/replay`).expect(200);
  assert.equal(replay.body.status,'awaiting_human');assert.ok(replay.body.provenance.input_hash);
  await request(app).get(`/api/investigations/${id}/brief`).expect(200);
});
test('seed or cohort mismatches cannot become scientific findings',async()=>{
  const results=await compute({seeds:[1,2,3],recipes:[{id:'a',incoming_load_range:[1,2],headway_s:420,demand_factor:1,new_homes:true},{id:'b',incoming_load_range:[1,2],headway_s:420,demand_factor:1,new_homes:false}]});
  results[1].runs[0].inputs.existing_cohort_signature='changed';assert.throws(()=>validatePairing(results,[1,2,3]),/cohort/);
  results[1].runs[0].inputs.seed=9;assert.throws(()=>validatePairing(results,[1,2,3]),/Seed/);
});
test('a fake live transport without a receipt cannot claim Papiers integration',async()=>{
  const library:KnowledgeLibrary={mode:'papiers_live',async read(){return {notes:[]};},async write(){throw Error('Must not write');}};
  const {service}=setup(library);const a=await service.start({seeds:[1,2,3]});await service.tick();
  const paused=await service.get(a.id);assert.equal(paused.status,'awaiting_human');assert.ok(paused.events.some(e=>e.type==='knowledge_read_failed'));
});
test('verified transport receipts are preserved, but write failure keeps a local export',async()=>{
  const library:KnowledgeLibrary={mode:'papiers_live',async read(){return {notes:[],receipt:{document_id:'TEST mocked document',retrieved_at:new Date().toISOString()}};},async write(){throw Error('TEST outage');}};
  const {service}=setup(library);const a=await service.start({seeds:[1,2,3]});await service.tick();await service.redirect(a.id,{author:'TEST',note:'TEST redirect',no_extra_vehicles:true});await service.tick();
  const done=await service.get(a.id);assert.equal(done.status,'completed');assert.equal(done.writeback.status,'pending_connection');assert.ok(done.events.some(e=>e.type==='papiers_write_pending'));
});
test('Gemini cannot choose a weaker-scoring knob or invent note IDs',async()=>{
  const repo=memoryAuditRepository();
  const service=new InvestigationService(repo,compute,undefined,async<T>()=>({knob:'service_frequency',note_ids:['invented-paper']} as T));
  const a=await service.start({seeds:[1,2,3]});await service.tick();const done=await service.get(a.id);
  assert.equal(done.selection?.knob,'incoming_load');
  assert.equal((done.events.find(e=>e.type==='agent_decision')!.payload as any).chosen_by,'bounded_policy');
});
test('a validated Gemini choice is recorded separately from the simulation numbers',async()=>{
  const service=new InvestigationService(memoryAuditRepository(),compute,undefined,async<T>()=>({knob:'incoming_load',note_ids:[]} as T));
  const a=await service.start({seeds:[1,2,3]});await service.tick();const done=await service.get(a.id);
  assert.equal((done.events.find(e=>e.type==='agent_decision')!.payload as any).chosen_by,'gemini');
  assert.equal(done.finding.classification,'supported');
});
test('revision conflicts preserve earlier human notes instead of overwriting them',async()=>{
  const {service,repo}=setup();const a=await service.start({seeds:[1,2,3]});await service.tick();
  const old=await service.get(a.id);
  await service.addNote(a.id,{id:'TEST-new',author:'TEST',title:'TEST',text:'TEST real revision',knob:'incoming_load'});
  await assert.rejects(()=>repo.save(old,old.revision),/changed/);
  assert.equal((await service.get(a.id)).notes[0].id,'TEST-new');
});
