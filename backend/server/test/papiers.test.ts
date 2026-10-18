import test from 'node:test';
import assert from 'node:assert/strict';
import { PapiersLibrary,configuredKnowledgeLibrary } from '../src/research/papiers.js';
const search={requestId:'TEST-search-receipt',results:[{id:'doc_paper',kind:'document',evidence:[{id:'hl_thinking',kind:'highlight'}]},{id:'nte_team',kind:'note'}]};
test('official CLI adapter searches then reads real returned IDs, prioritizing human judgments',async()=>{
  const calls:string[][]=[];
  const library=new PapiersLibrary(async args=>{
    calls.push(args);
    if(args[0]==='search')return search;
    return {requestId:'TEST-read-receipt',items:args.slice(1,args.indexOf('--format')).map(id=>({id,kind:id.startsWith('doc_')?'document':'note',ok:true,format:'plain',content:'TEST human context; do not turn this into a numerical observation',truncated:false,metadata:{title:'TEST context'}}))};
  });
  const result=await library.read('incoming_load');
  assert.equal(calls[0][0],'search');assert.equal(calls[1][0],'read');
  assert.deepEqual(calls[1].slice(1,4),['hl_thinking','nte_team','doc_paper']);
  assert.equal(result.receipt?.document_id,'hl_thinking');
  assert.deepEqual(result.notes.map(n=>n.signal),['human_judgment','human_judgment','curation']);
  assert.ok(result.notes.every(n=>n.mode==='papiers_live'&&n.incoming_load_range===undefined));
  await assert.rejects(()=>library.write(),/read-only/);
});
test('empty search is not proof of a real content read',async()=>{
  let calls=0;const library=new PapiersLibrary(async()=>{calls++;return {requestId:'TEST',results:[]};});
  const result=await library.read('demand_case');assert.equal(calls,3);assert.equal(result.receipt,undefined);assert.deepEqual(result.notes,[]);
});
test('metadata-only or failed items cannot produce a verified read receipt',async()=>{
  const library=new PapiersLibrary(async args=>args[0]==='search'?{requestId:'TEST',results:[{id:'doc_one',kind:'document'}]}:{requestId:'TEST-read',items:[{id:'doc_one',kind:'document',ok:false}]});
  assert.equal((await library.read('service_frequency')).receipt,undefined);
});
test('changed IDs and oversized content are rejected',async()=>{
  const library=new PapiersLibrary(async args=>args[0]==='search'?{requestId:'TEST',results:[{id:'nte_one',kind:'note'}]}:{requestId:'TEST-read',items:[{id:'nte_other',kind:'note',ok:true,content:'TEST'}]});
  await assert.rejects(()=>library.read('incoming_load'),/different item/);
  const oversized=new PapiersLibrary(async args=>args[0]==='search'?{requestId:'TEST',results:[{id:'nte_one',kind:'note'}]}:{requestId:'TEST-read',items:[{id:'nte_one',kind:'note',ok:true,content:'x'.repeat(12001)}]});
  await assert.rejects(()=>oversized.read('incoming_load'));
});
test('a broader-search service note is not labelled incoming-load evidence',async()=>{
  const calls:string[][]=[];
  const library=new PapiersLibrary(async args=>{calls.push(args);if(args[0]==='search')return {requestId:'TEST',results:args[1]==='505'?[{id:'nte_team',kind:'note'}]:[]};return {requestId:'TEST-read',items:[{id:'nte_team',kind:'note',ok:true,content:'No extra vehicles at move-in; keep current service frequency.'}]};});
  const result=await library.read('incoming_load');assert.equal(calls.length,4);assert.equal(result.notes[0].knob,'service_frequency');assert.equal(result.notes[0].headway_s,undefined);assert.ok(result.receipt);
});
test('missing token is unconnected and cannot claim a live read',()=>{
  const previous=process.env.PAPIERS_TOKEN;try{delete process.env.PAPIERS_TOKEN;assert.equal(configuredKnowledgeLibrary().mode,'unconnected');}finally{if(previous===undefined)delete process.env.PAPIERS_TOKEN;else process.env.PAPIERS_TOKEN=previous;}
});
