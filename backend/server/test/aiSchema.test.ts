import { test } from 'node:test';
import assert from 'node:assert/strict';
import { googleSchema,normalizeOptionalNulls } from '../src/ai/schema.js';
import { ParseAnswerSchema } from '../src/shared/schemas.js';
test('provider schema is generated from patch fields and optional nulls cannot bypass bounds',()=>{
  const provider=googleSchema(ParseAnswerSchema);
  assert.ok(provider.properties!.patch.properties!.phase_years);
  const raw={kind:'patch',patch:{demand_case:'high',capital_budget_cad:null,annual_operating_budget_cad:null,fleet_allowance:null,phase_years:null,development_units:null},answer:'Use high demand.'};
  const clean=normalizeOptionalNulls(raw,ParseAnswerSchema);
  assert.deepEqual(ParseAnswerSchema.parse(clean).patch,{demand_case:'high'});
  assert.equal(ParseAnswerSchema.safeParse(normalizeOptionalNulls({...raw,patch:{fleet_allowance:101}},ParseAnswerSchema)).success,false);
});
