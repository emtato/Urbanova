import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseQuestion,PARSER_PROMPT_VERSION } from '../src/ai/scenarioParser.js';
import { defaultScenario,fixture } from '../src/services/bundle.js';
import { applyPatch } from '../src/services/validate.js';
import { grounded,explain } from '../src/ai/explainer.js';
import { compare } from '../src/packages/compare.js';
import type { Generate } from '../src/ai/gemini.js';
import { parserCases as cases } from '../src/ai/parserCases.js';

// Ten fixed questions. Re-run on every prompt change; no paid/network dependency.
for(const item of cases)test(`parser ${PARSER_PROMPT_VERSION}: ${item.question}`,async()=>{
  const generate:Generate=async(_purpose,prompt,schema)=>{assert.ok(prompt.includes(PARSER_PROMPT_VERSION));assert.ok(prompt.includes('Untrusted request'));return schema.parse({kind:item.replyKind??'patch',patch:item.patch,answer:''});};
  const result=await parseQuestion(item.question,defaultScenario,generate);
  assert.equal(result.kind,item.kind);
  if(result.kind==='patch'){
    const changed=applyPatch(defaultScenario,result.patch);
    assert.deepEqual(changed.developments,defaultScenario.developments);
    for(const key of ['demand_case','capital_budget_cad','annual_operating_budget_cad','fleet_allowance'] as const)if(key in item.patch)assert.equal(changed[key],(item.patch as Record<string,unknown>)[key]);
    if('phase_years' in item.patch)assert.equal(changed.phases[0].year,2028);
  }else assert.deepEqual(result.patch,{});
});
test('grounding rejects invented numbers and source IDs, preserving numeric results',async()=>{
  assert.equal(grounded({text:'A wait of 999999.123 seconds',source_ids:[]},fixture),false);
  assert.equal(grounded({text:'A claim [source:invented]',source_ids:[]},fixture),false);
  const result=await explain(fixture,async(_p,_s,schema)=>schema.parse({text:'999999.123 passengers',source_ids:[]}));
  assert.equal(result.fallback,true);
  assert.equal(compare(fixture,['central']).preferred_package_id,'extra-service');
  assert.equal(compare(fixture).preferred_package_id,null);
});
test('Gemini outage leaves form edits available',async()=>{
  const result=await parseQuestion('Use low demand',defaultScenario,async()=>null);
  assert.equal(result.kind,'unsupported');
  assert.equal(applyPatch(defaultScenario,{demand_case:'low'}).demand_case,'low');
});
