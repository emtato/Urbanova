import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import {createApp} from '../src/app.js';
import {memoryStore} from './support.js';
import {copilot,copilotDefaults,CopilotPatch} from '../src/ai/copilot.js';
import {googleSchema} from '../src/ai/schema.js';
import type {Generate} from '../src/ai/gemini.js';
const reply=(value:unknown):Generate=>async(_purpose,_prompt,schema)=>schema.parse(value);
test('incoming load exposes array items to Gemini and enforces exactly two values',()=>{
 const schema=googleSchema(CopilotPatch);
 assert.equal(schema.properties?.incoming_load_range.items?.type,'INTEGER');
 assert.equal(CopilotPatch.safeParse({incoming_load_range:[1]}).success,false);
 assert.equal(CopilotPatch.safeParse({incoming_load_range:[1,2]}).success,true);
});
test('chat endpoint validates input and returns real translated fields with reviewed originals',async()=>{
 const app=createApp(memoryStore(),reply({kind:'patch',answer:'Review the proposed headway.',patch:{headway_s:180}}));
 await request(app).post('/api/chat').send({question:''}).expect(422);
 await request(app).post('/api/chat').send({question:'x'.repeat(2001)}).expect(422);
 const r=await request(app).post('/api/chat').send({question:'Set headway to 3 minutes'}).expect(200);
 assert.equal(r.body.patch.headway_s,180);assert.equal(r.body.defaults.headway_s,copilotDefaults.headway_s);assert.equal(r.body.fallback,false);assert.ok(r.body.data_version);
});
test('a general question does not become a fabricated high-demand patch',async()=>{
 const r=await copilot('Hello',reply({kind:'answer',answer:'Hello. I can help review simulation inputs.',patch:{}}));
 assert.deepEqual(r.patch,{});assert.equal(r.kind,'answer');
});
test('provider failure supports only explicit deterministic headway requests and labels fallback',async()=>{
 const r=await copilot('Set headway to 5 minutes',async()=>null);assert.deepEqual(r.patch,{headway_s:300});assert.equal(r.fallback,true);
 const unknown=await copilot('Tell me something',async()=>null);assert.deepEqual(unknown.patch,{});assert.equal(unknown.kind,'unsupported');
 const doubled=await copilot('Double streetcar frequency',async()=>null);assert.equal(doubled.patch.headway_s,copilotDefaults.headway_s/2);
});
test('unknown IDs and inconsistent vehicle loads cannot be applied',async()=>{
 for(const patch of [{development_ids:['invented-site']},{streetcar_capacity:10},{incoming_load_range:[40,20] as [number,number]}]){
  const r=await copilot('Change inputs',reply({kind:'patch',answer:'Change requested.',patch}));assert.equal(r.kind,'unsupported');assert.deepEqual(r.patch,{});
 }
});
test('invented outcome numbers are removed rather than displayed as computed results',async()=>{
 const r=await copilot('Set headway to 3 minutes',reply({kind:'patch',answer:'Your wait will be 987654.321 seconds.',patch:{headway_s:180}}));
 assert.ok(!r.answer.includes('987654'));assert.equal(r.patch.headway_s,180);
});
test('stop explanations offer an actual investigation and observed demand is not invented',async()=>{
 const never:Generate=async()=>{throw Error('Should not call provider')};
 const research=await copilot('Why does my stop get worse?',never);assert.equal('investigate' in research&&research.investigate,true);assert.deepEqual(research.patch,{});
 const observation=await copilot('What is observed incoming occupancy?',never);assert.match(observation.answer,/unavailable/);assert.deepEqual(observation.patch,{});
 const defaults=await copilot('What headway and capacity does the model use?',never);assert.ok(defaults.answer.includes(String(copilotDefaults.headway_s)));
});
