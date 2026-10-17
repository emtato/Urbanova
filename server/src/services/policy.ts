import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT } from '../config.js';
import { sourceManifest } from './bundle.js';
import { parse } from './validate.js';
import { invariant } from '../core/errors.js';
import { validatePolicy, type Policy } from '../packages/feasibility.js';
import { PolicySchema } from '../shared/policy.js';
export { PolicySchema } from '../shared/policy.js';
export function checkedPolicy(input:unknown,phaseIds:string[]):Policy {
  const policy=validatePolicy(parse(PolicySchema,input));
  invariant([policy.earliest_phase,...Object.values(policy.availability??{})].every(id=>phaseIds.includes(id)),`Policy availability must use phases: ${phaseIds.join(', ')}.`);
  invariant(policy.source_ids.every(id=>sourceManifest.some(s=>s.source_id===id)),'Policy source IDs must resolve to the reviewed source manifest.');
  return policy;
}
export function loadPolicy(phaseIds:string[]):Policy|null {
  const path=process.env.PACKAGE_POLICY_PATH;if(!path)return null;
  return checkedPolicy(JSON.parse(readFileSync(resolve(ROOT,path),'utf8')),phaseIds);
}
