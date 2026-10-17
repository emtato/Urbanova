import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as z from 'zod';
import { ROOT } from '../config.js';
import { sourceManifest } from './bundle.js';
import { parse } from './validate.js';
import { invariant } from '../core/errors.js';
import { validatePolicy, type Policy } from '../packages/feasibility.js';
const nonnegative=z.number().finite().nonnegative(),positive=z.number().finite().positive();
const range=z.strictObject({low:nonnegative,central:nonnegative,high:nonnegative});
export const PolicySchema=z.strictObject({cycle_s:positive.max(86400),lane_cycle_s:positive.max(86400),baseline_headway_s:positive.max(86400),service_headway_s:positive.max(86400),peak_hours:nonnegative.max(24),service_days:z.int().min(0).max(366),cost_per_hour:range,lane_capital:range,lane_operating:range,price_year:z.int(),earliest_phase:z.string().min(1),source_ids:z.array(z.string()),assumption_label:z.string().min(1)});
export function loadPolicy(phaseIds:string[]):Policy|null {
  const path=process.env.PACKAGE_POLICY_PATH;if(!path)return null;
  const policy=validatePolicy(parse(PolicySchema,JSON.parse(readFileSync(resolve(ROOT,path),'utf8'))));
  invariant(phaseIds.includes(policy.earliest_phase),`Policy phase must be one of ${phaseIds.join(', ')}.`);
  invariant(policy.source_ids.every(id=>sourceManifest.some(s=>s.source_id===id)),'Policy source IDs must resolve to the reviewed source manifest.');
  return policy;
}
