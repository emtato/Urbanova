import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as z from 'zod';
import { ROOT } from '../config.js';
import type { Comparison, Scenario, Corridor, ReplayStream } from '../../../frontend/src/lib/types.js';
export type { Comparison, Scenario, Corridor, ReplayStream };

// Consume the frozen generated schema rather than inventing parallel contract fields.
const contract = JSON.parse(readFileSync(resolve(ROOT, 'data/contracts/comparison.schema.json'), 'utf8'));
export const ComparisonSchema = z.fromJSONSchema(contract) as z.ZodType<Comparison>;
const definition = (name: string) => z.fromJSONSchema({ $defs:contract.$defs, $ref: `#/$defs/${name}` });
export const ScenarioSchema = definition('Scenario') as z.ZodType<Scenario>;
export const CorridorSchema = definition('Corridor') as z.ZodType<Corridor>;
export const ReplaySchema = definition('ReplayStream') as z.ZodType<ReplayStream>;
const finite = z.number().finite();
export const PatchSchema = z.strictObject({
  demand_case: z.enum(['low','central','high']).optional(),
  capital_budget_cad: finite.min(0).max(1e9).optional(),
  annual_operating_budget_cad: finite.min(0).max(1e9).optional(),
  fleet_allowance: z.int().min(0).max(100).optional(),
  phase_years: z.array(z.strictObject({phase_id:z.string().min(1),year:z.int().min(2026).max(2100)})).max(20).optional(),
  development_units: z.array(z.strictObject({development_id:z.string().min(1),net_added_units:z.int().min(0).max(10000)})).max(100).optional(),
  planning_criterion:z.strictObject({max_p95_wait_s:finite.min(0).max(86400).optional(),max_denied_share:finite.min(0).max(1).optional(),max_unresolved_passengers:z.int().min(0).max(1e7).optional()}).optional(),
});
export type ScenarioPatch = z.infer<typeof PatchSchema>;
// Preserve the live-tested model schema. Criterion edits use the same validated
// form boundary, while natural-language parsing stays within this smaller set.
export const ParseAnswerSchema = z.strictObject({kind:z.enum(['patch','unsupported','missing_observation']),patch:PatchSchema.omit({planning_criterion:true}),answer:z.string().max(2000)});
export const RandomSchema = z.strictObject({seed_ids:z.array(z.int().min(0).max(2147483647)).min(1).max(100).refine(ids=>new Set(ids).size===ids.length,'Seed IDs must be unique'), draws_id:z.string().min(1).max(100)});
export const JobRequestSchema = z.strictObject({scenario_id:z.string().min(1),version:z.int().positive(),random:RandomSchema,retain_replay:z.boolean().default(false)});
export const QuestionSchema = z.strictObject({question:z.string().min(1).max(4000)});
const MoneyRange=z.strictObject({low:finite.nonnegative(),central:finite.nonnegative(),high:finite.nonnegative()});
export const PackageScreenSchema=z.array(z.strictObject({package_id:z.string(),phase_id:z.string(),feasible:z.boolean(),reasons:z.array(z.string()),vehicles:z.int().nonnegative().nullable(),extra_vehicles:z.int().nonnegative().nullable(),capital:MoneyRange.nullable(),operating:MoneyRange.nullable()}));
export const JobSchema = z.strictObject({job_id:z.string(),scenario_id:z.string(),scenario_version:z.number(),status:z.enum(['queued','running','completed','failed']),fixture:z.boolean(),comparison_id:z.string().nullable(),error:z.string().nullable(),stale:z.boolean(),notice:z.string(),package_screen:PackageScreenSchema.nullable()});
export const ExplanationSchema = z.strictObject({text:z.string(),source_ids:z.array(z.string()),fallback:z.boolean()});
export const SummarySchema=z.strictObject({comparison_id:z.string(),scenario_id:z.string(),source_ids:z.array(z.string()),fixture:z.boolean(),
  decision:z.strictObject({wording:z.string(),cost_order:z.string(),preferred_package_id:z.string().nullable(),alternatives:z.array(z.strictObject({package_id:z.string(),capital:finite.nonnegative(),operating:finite.nonnegative(),feasible:z.boolean(),meets:z.boolean(),wait:finite.nonnegative().nullable(),denied:finite.min(0).max(1).nullable(),unresolved:finite.nonnegative().nullable(),dominated:z.boolean()}))}),
  sensitivity:z.strictObject({fixture:z.boolean(),cases:z.array(z.strictObject({demand:z.enum(['low','central','high']),preferred_package_id:z.string().nullable()})),preferred_changes:z.boolean(),upgrade_delay:z.strictObject({status:z.enum(['tested','pending_b11']),preferred_package_id:z.string().nullable()}),repeatedly_worst_stops:z.array(z.strictObject({stop_id:z.string(),cases:z.int().nonnegative()})),limitation:z.string()})});
