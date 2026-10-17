import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as z from 'zod';
import { ROOT } from '../config.js';
import { PolicySchema } from './policy.js';
import type { Comparison as PresentationComparison, Scenario, Corridor, ReplayStream } from '../../../../frontend/src/lib/types.js';
import { nativeBatchSchema, nativeComparisonSchema, type NativeComparison } from './nativeResults.js';
export type { Scenario, Corridor, ReplayStream };
export type FixtureComparison = Omit<PresentationComparison,'contract_version'> & {contract_version:'2.0.0'};
export type Comparison = FixtureComparison | NativeComparison;

// Consume the frozen generated schema rather than inventing parallel contract fields.
const contract = JSON.parse(readFileSync(resolve(ROOT, 'data/contracts/comparison.schema.json'), 'utf8'));
export const FixtureComparisonSchema = z.fromJSONSchema(contract) as z.ZodType<FixtureComparison>;
const definition = (name: string) => z.fromJSONSchema({ $defs:contract.$defs, $ref: `#/$defs/${name}` });
export const ScenarioSchema = definition('Scenario') as z.ZodType<Scenario>;
export const CorridorSchema = definition('Corridor') as z.ZodType<Corridor>;
export const ReplaySchema = definition('ReplayStream') as z.ZodType<ReplayStream>;
const StreetcarSchema=z.strictObject({id:z.string(),capacity:z.int().positive(),onboard_passenger_ids:z.array(z.string()),status:z.enum(['at_stop','in_transit','finished']),current_stop_id:z.string().nullable(),previous_stop_id:z.string().nullable(),next_stop_id:z.string().nullable(),departure_time_s:z.number().nullable(),expected_arrival_time_s:z.number().nullable()});
const NativeEventSchema=z.strictObject({time_s:z.number().nonnegative(),action:z.enum(['passenger_arrive','generate','arrive','alight','board','deny','beyond_segment','depart','terminate']),streetcar:StreetcarSchema.nullable(),stop_id:z.string().nullable(),count:z.int().nonnegative(),existing_count:z.int().nonnegative(),new_count:z.int().nonnegative(),passenger_ids:z.array(z.string()),onboard_count_after:z.int().nonnegative().nullable(),waiting_count_after:z.int().nonnegative().nullable(),stop_queues:z.record(z.string(),z.int().nonnegative())});
const NativePassengerSchema=z.strictObject({id:z.string(),origin_stop_id:z.string(),destination_stop_id:z.string().nullable(),get_to_stop_time:z.number(),rider_group:z.enum(['existing','new']),development_id:z.string().nullable(),status:z.enum(['scheduled','waiting','onboard','arrived','beyond_segment']),streetcar_id:z.string().nullable(),boarding_time_s:z.number().nullable(),exit_time_s:z.number().nullable(),denied_boarding_once:z.boolean()});
export const NativeBatchSchema = nativeBatchSchema(NativeEventSchema, NativePassengerSchema, StreetcarSchema);
export const NativeComparisonSchema = nativeComparisonSchema(definition, NativeBatchSchema);
export const ComparisonSchema: z.ZodType<Comparison> = z.union([FixtureComparisonSchema, NativeComparisonSchema]);
export const NativeReplaySchema=z.strictObject({format_version:z.literal('b11-events-v1'),comparison_id:z.string(),run_id:z.string(),scenario_id:z.string(),model_version:z.string(),data_version:z.string(),source_ids:z.array(z.string()),horizon_s:z.number().positive(),stops:z.array(definition('Stop')),events:z.array(NativeEventSchema),passengers:z.array(NativePassengerSchema)});
export type NativeReplay=z.infer<typeof NativeReplaySchema>;
export const NativeMetricsSchema=z.strictObject({format_version:z.literal('b11-metrics-v1'),comparison_id:z.string(),scenario_id:z.string(),source_ids:z.array(z.string()),model_version:z.string(),data_version:z.string(),runs:z.array(z.strictObject({run_id:z.string(),summary:z.record(z.string(),z.unknown())}))});
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
export const DemandFactorsSchema=z.strictObject({low:z.number().finite().min(0).max(1),central:z.literal(1),high:z.number().finite().min(1).max(3)});
export const JobRequestSchema = z.strictObject({scenario_id:z.string().min(1),version:z.int().positive(),random:RandomSchema,retain_replay:z.boolean().default(false),policy:PolicySchema.optional(),evaluator:z.enum(['b11','fixture']).default('b11'),demand_factors:DemandFactorsSchema.default({low:.8,central:1,high:1.2})});
export const QuestionSchema = z.strictObject({question:z.string().min(1).max(4000)});
const MoneyRange=z.strictObject({low:finite.nonnegative(),central:finite.nonnegative(),high:finite.nonnegative()});
export const PackageScreenSchema=z.array(z.strictObject({package_id:z.string(),phase_id:z.string(),feasible:z.boolean(),reasons:z.array(z.string()),vehicles:z.int().nonnegative().nullable(),extra_vehicles:z.int().nonnegative().nullable(),capital:MoneyRange.nullable(),operating:MoneyRange.nullable()}));
export const PackagePreviewSchema=z.strictObject({scenario_id:z.string(),scenario_version:z.int().positive(),status:z.literal('screen_only'),policy_status:z.enum(['user_selected','missing']),policy:PolicySchema.nullable(),assumptions_id:z.string(),packages:PackageScreenSchema,upgrade_delay:z.strictObject({years:z.literal(1),packages:PackageScreenSchema}),notice:z.string()});
export const JobSchema = z.strictObject({job_id:z.string(),scenario_id:z.string(),scenario_version:z.number(),status:z.enum(['queued','running','completed','failed']),fixture:z.boolean(),comparison_id:z.string().nullable(),error:z.string().nullable(),stale:z.boolean(),notice:z.string(),package_screen:PackageScreenSchema.nullable()});
export const ExplanationSchema = z.strictObject({text:z.string(),source_ids:z.array(z.string()),fallback:z.boolean()});
export const SummarySchema=z.strictObject({comparison_id:z.string(),scenario_id:z.string(),source_ids:z.array(z.string()),fixture:z.boolean(),
  decision:z.strictObject({wording:z.string(),cost_order:z.string(),preferred_package_id:z.string().nullable(),alternatives:z.array(z.strictObject({package_id:z.string(),capital:finite.nonnegative(),operating:finite.nonnegative(),feasible:z.boolean(),meets:z.boolean(),wait:finite.nonnegative().nullable(),denied:finite.min(0).max(1).nullable(),unresolved:finite.nonnegative().nullable(),dominated:z.boolean()}))}),
  sensitivity:z.strictObject({fixture:z.boolean(),cases:z.array(z.strictObject({demand:z.enum(['low','central','high']),preferred_package_id:z.string().nullable()})),preferred_changes:z.boolean(),upgrade_delay:z.strictObject({status:z.enum(['tested','pending_b11']),comparison_id:z.string().nullable(),preferred_changes:z.boolean().nullable(),preferred_package_id:z.string().nullable()}),repeatedly_worst_stops:z.array(z.strictObject({stop_id:z.string(),cases:z.int().nonnegative()})),limitation:z.string()})});
export const RunSimulationRequestSchema=z.strictObject({
  run_count:z.int().min(1).max(25).default(1),
  seed:z.int().min(0).max(2147483647).optional(),
  seeds:z.array(z.int().min(0).max(2147483647)).min(1).max(25).refine(ids=>new Set(ids).size===ids.length,'Seeds must be unique').optional(),
  development_ids:z.array(z.string().min(1)).optional(),
  developments:z.array(definition('Development')).optional(),
  stops:z.array(definition('Stop')).optional(),
  existing_residences:z.array(z.record(z.string(),z.unknown())).optional(),
  link_travel_times_s:z.array(finite.positive()).optional(),
  streetcar_capacity:z.int().positive().optional(),
  headway_s:finite.positive().optional(),
  rush_hour_duration_s:finite.positive().optional(),
  trips_per_resident_in_window:finite.nonnegative().optional(),
  start_time_s:z.int().nonnegative().optional(),
  end_time_s:z.int().positive().optional(),
  headway_randomness_s:finite.nonnegative().optional(),
  commuter_distribution:z.array(finite.nonnegative()).min(1).optional(),
  link_travel_time_variation_share:finite.min(0).lt(1).optional(),
  westward_share:finite.min(0).max(1).optional(),
  walk_limit_m:finite.positive().optional(),
  parallel_route_bands:z.tuple([finite.min(0).max(1),finite.min(0).max(1)]).optional(),
  incoming_load_range:z.tuple([z.int().nonnegative(),z.int().nonnegative()]).optional(),
  stop_dwell_range_s:z.tuple([z.int().nonnegative(),z.int().nonnegative()]).optional(),
});
export type RunSimulationRequest=z.infer<typeof RunSimulationRequestSchema>;
export const SimulationListSchema=z.array(NativeBatchSchema);
export const DeleteSimulationRequestSchema=z.strictObject({id:z.string().uuid()});
export const RenameSimulationRequestSchema=z.strictObject({
  id:z.string().uuid(),
  name:z.string().trim().min(1,'Name must be between 1 and 80 characters.').max(80,'Name must be between 1 and 80 characters.'),
});
export type RenameSimulationRequest=z.infer<typeof RenameSimulationRequestSchema>;
