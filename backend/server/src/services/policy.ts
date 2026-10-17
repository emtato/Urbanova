import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT } from '../config.js';
import { sourceManifest,interventionCatalog,corridor } from './bundle.js';
import { parse } from './validate.js';
import { invariant } from '../core/errors.js';
import { validatePolicy, type Policy } from '../packages/feasibility.js';
import { PolicySchema } from '../shared/policy.js';
export { PolicySchema } from '../shared/policy.js';
export function checkedPolicy(input:unknown,phaseIds:string[]):Policy {
  const policy=validatePolicy(parse(PolicySchema,input));
  invariant([policy.earliest_phase,...Object.values(policy.availability??{})].every(id=>phaseIds.includes(id)),`Policy availability must use phases: ${phaseIds.join(', ')}.`);
  invariant(policy.source_ids.every(id=>sourceManifest.some(s=>s.source_id===id)),'Policy source IDs must resolve to the reviewed source manifest.');
  invariant(!policy.lane_link_ids||new Set(policy.lane_link_ids).size===policy.lane_link_ids.length&&policy.lane_link_ids.every(id=>corridor.links.some(l=>l.link_id===id)),'Lane links must be distinct reviewed link IDs.');
  return policy;
}
export function reviewedPolicy(headway:240|300|360=300):Policy{
  const policy=JSON.parse(readFileSync(resolve(ROOT,`data/reviewed/package_policy_${headway}.json`),'utf8'));
  return checkedPolicy({...policy,lane_link_ids:interventionCatalog.streetcar_priority.link_ids,lane_travel_time_multiplier:1-interventionCatalog.streetcar_priority.time_saving_share.selected,assumption_label:policy.assumption_label+' Lane effect is now an explicitly simulated assumption on the listed corridor links, not an observed AM saving.'},['phase-1','phase-2']);
}
export function loadPolicy(phaseIds:string[]):Policy|null {
  const path=process.env.PACKAGE_POLICY_PATH;if(path==='none')return null;if(!path)return checkedPolicy(reviewedPolicy(),phaseIds);
  return checkedPolicy(JSON.parse(readFileSync(resolve(ROOT,path),'utf8')),phaseIds);
}
