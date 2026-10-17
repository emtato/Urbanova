import * as z from 'zod';
import type { Comparison as FixtureComparison, CaseResult, Run, StopResult } from '../../../frontend/src/lib/types.js';

const count = z.int().nonnegative();
const nonnegative = z.number().finite().nonnegative();
const metric = nonnegative.nullable();
export const RunStatisticsSchema = z.strictObject({
  valid_run_count: count, missing_run_count: count,
  mean: z.number().finite().nullable(), median: z.number().finite().nullable(),
  min: z.number().finite().nullable(), max: z.number().finite().nullable(), stddev: metric,
});
export const NativeDiagnosticsSchema = z.strictObject({
  passengers_created: count, passengers_arrived: count, passengers_waiting: count,
  passengers_onboard: count, in_progress_at_cutoff_excluded: count,
  conservation: z.boolean(), unresolved_passengers: count, runtime_s: nonnegative,
});
const OverviewSchema = z.looseObject({
  mean_wait_s: metric, p95_wait_s: metric,
  denied_boarding_share: z.number().min(0).max(1).nullable(),
  unresolved_passengers: count, in_progress_at_cutoff_passengers: count,
  raw_waiting_at_cutoff_passengers: count, conservation_valid: z.boolean(),
});

// The simulator owns additional summary/input fields. Preserve them verbatim.
export function nativeBatchSchema(event: z.ZodType, passenger: z.ZodType, streetcar: z.ZodType) {
  const individual = z.strictObject({
    inputs: z.looseObject({ seed: z.int() }),
    streetcars: z.array(streetcar), passengers: z.array(passenger), sim_log: z.array(event),
    summary: z.looseObject({
      overview: OverviewSchema,
      contract: z.looseObject({ diagnostics: NativeDiagnosticsSchema }),
    }),
  });
  return z.strictObject({
    overall_results: z.strictObject({
      run_count: z.int().positive(), seeds: z.array(z.int()).min(1),
      metrics: z.record(z.string(), RunStatisticsSchema),
      all_runs_conservation_valid: z.boolean(), invalid_run_indices: z.array(count),
      runtime: z.strictObject({ per_run_s: z.array(nonnegative), statistics_s: RunStatisticsSchema, total_s: nonnegative }),
    }),
    individual_results: z.array(individual).min(1),
  });
}
export type NativeBatch = z.infer<ReturnType<typeof nativeBatchSchema>>;
export interface NativeRun extends Run { diagnostics: z.infer<typeof NativeDiagnosticsSchema> }
export interface NativeStopResult extends StopResult { encountered_streetcar_passengers: number }
export interface NativeCaseResult extends CaseResult, NativeBatch {
  runs: NativeRun[]; stops: NativeStopResult[];
}
export interface NativeComparison extends Omit<FixtureComparison, 'contract_version' | 'cases' | 'replay'> {
  contract_version: '3.0.0'; cases: NativeCaseResult[]; replay: null;
}

export function nativeComparisonSchema(
  definition: (name: string) => z.ZodType,
  batch: ReturnType<typeof nativeBatchSchema>,
): z.ZodType<NativeComparison> {
  const run = z.strictObject({
    run_id: z.string().min(1), scenario_version: z.int().positive(), package: z.string().min(1),
    model_version: z.string().min(1), data_version: z.string().min(1),
    seed_ids: z.array(count).min(1), status: z.enum(['completed', 'failed']), diagnostics: NativeDiagnosticsSchema,
  });
  const stop = z.strictObject({
    stop_id: z.string().min(1), rider_group: z.enum(['existing', 'new']),
    passengers: count, completed_passengers: count, mean_wait_s: metric, p95_wait_s: metric,
    denied_at_least_once_share: z.number().min(0).max(1).nullable(),
    remaining_queue: count, headway_cv: metric, encountered_streetcar_passengers: count,
  });
  const result = z.strictObject({
    case_id: z.string().min(1), kind: z.enum(['current', 'growth', 'supported_growth']),
    package_id: z.string().min(1), phase_id: z.string().min(1), demand_case: z.enum(['low', 'central', 'high']),
    stops: z.array(stop), runs: z.array(run).min(1),
    per_run_mean_wait_s: z.array(metric), per_run_p95_wait_s: z.array(metric),
    per_run_denied_share: z.array(z.number().min(0).max(1).nullable()),
    per_run_unresolved_passengers: z.array(count), run_count: z.int().positive(), unresolved_passengers: count,
    ...batch.shape,
  });
  return z.strictObject({
    contract_version: z.literal('3.0.0'), comparison_id: z.string().min(1), fixture: z.literal(false),
    product_label: z.literal('scenario experiment'), scenario: definition('Scenario'), corridor: definition('Corridor'),
    cases: z.array(result).min(3), packages: z.array(definition('Package')).min(1),
    sensitivity: z.array(definition('SensitivityResult')), assumptions: z.array(definition('Assumption')),
    sources: z.array(definition('SourceRef')).min(1), warnings: z.array(z.string()), replay: z.null(),
  }) as unknown as z.ZodType<NativeComparison>;
}
