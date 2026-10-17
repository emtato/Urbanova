import assert from 'node:assert/strict';
import { PgStore } from '../storage/store.js';
import { gemini } from '../ai/gemini.js';
import { parseQuestion,PARSER_PROMPT_VERSION } from '../ai/scenarioParser.js';
import { parserCases } from '../ai/parserCases.js';
import { defaultScenario,fixture } from '../services/bundle.js';
import { applyPatch } from '../services/validate.js';
import { compare } from '../packages/compare.js';
import { explain,grounded } from '../ai/explainer.js';
const store=new PgStore();let passed=0;
try{
  await store.init();const generate=gemini(store);
  if(!process.env.GEMINI_API_KEY)throw Error('Missing backend key');
  for(const item of parserCases){
    const result=await parseQuestion(item.question,defaultScenario,generate);
    assert.equal(result.kind,item.kind);
    if(result.kind==='patch'){
      const changed=applyPatch(defaultScenario,result.patch);
      assert.deepEqual(changed.developments,defaultScenario.developments);
      for(const key of ['demand_case','capital_budget_cad','annual_operating_budget_cad','fleet_allowance'] as const)if(key in item.patch)assert.equal(changed[key],(item.patch as Record<string,unknown>)[key]);
      if('phase_years' in item.patch)assert.equal(changed.phases[0].year,2028);
    }
    passed++;console.log(`Live parser case ${passed}/${parserCases.length} passed.`);
  }
  const explanation=await explain(fixture,generate);
  assert.ok(grounded(explanation,fixture));assert.equal(compare(fixture,['central']).preferred_package_id,'extra-service');
  console.log(JSON.stringify({status:'ok',prompt_version:PARSER_PROMPT_VERSION,parser_cases:passed,numeric_agreement:true,explanation_fallback:explanation.fallback}));
}catch{console.error(JSON.stringify({status:'failed',prompt_version:PARSER_PROMPT_VERSION,passed,message:'Live prompt regression failed or Gemini unavailable. Check c_ai_calls status; forms and deterministic fallback remain available.'}));process.exitCode=1;}
finally{await store.close();}
