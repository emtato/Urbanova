import { invariant } from '../core/errors.js';
import type { NativeCaseResult } from '../shared/nativeResults.js';

const equal = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);
const close = (left: number | null, right: number | null) => left === right ||
  (left !== null && right !== null && Math.abs(left - right) <= 1e-9 * Math.max(1, Math.abs(right)));

/** Check C's metadata/projections against the untouched, authoritative B batch. */
export function checkNativeCase(result: NativeCaseResult): void {
  const batch = result.overall_results, runs = result.individual_results;
  invariant(batch.run_count === result.run_count && runs.length === result.run_count, 'Native batch run counts must align.');
  invariant(batch.seeds.length === runs.length && new Set(batch.seeds).size === runs.length, 'Native batch seeds must be unique and aligned.');
  invariant(batch.runtime.per_run_s.length === runs.length, 'Native run timings must align.');
  const invalid = runs.flatMap((run, i) => run.summary.overview.conservation_valid ? [] : [i]);
  invariant(equal(batch.invalid_run_indices, invalid) && batch.all_runs_conservation_valid === (invalid.length === 0), 'Native conservation checks must match individual results.');
  for (const [i, run] of runs.entries()) {
    const overview = run.summary.overview;
    invariant(run.inputs.seed === batch.seeds[i], 'Native result order must match its engine seeds.');
    invariant(equal(result.runs[i].diagnostics, run.summary.contract.diagnostics), 'Run diagnostics must preserve the simulator definitions.');
    invariant(result.per_run_mean_wait_s[i] === overview.mean_wait_s && result.per_run_p95_wait_s[i] === overview.p95_wait_s &&
      result.per_run_denied_share[i] === overview.denied_boarding_share && result.per_run_unresolved_passengers[i] === overview.unresolved_passengers,
    'Decision arrays must match native overview metrics.');
    invariant(result.runs[i].diagnostics.in_progress_at_cutoff_excluded === overview.in_progress_at_cutoff_passengers,
      'In-progress riders must stay separate from unresolved riders.');
  }
  for (const stop of result.stops) {
    invariant(stop.encountered_streetcar_passengers <= stop.passengers && stop.completed_passengers + stop.remaining_queue <= stop.passengers,
      'Stop encountered, completed and stranded riders must not exceed stop arrivals.');
  }
  const expectedMetrics=Object.entries(runs[0].summary.overview).filter(([,value])=>value===null||typeof value==='number').map(([name])=>name).sort();
  invariant(equal(Object.keys(batch.metrics).sort(),expectedMetrics),'Batch must retain every numeric overview metric.');
  for (const [name, stats] of Object.entries(batch.metrics)) {
    const values = runs.map(run => run.summary.overview[name]);
    invariant(values.every(value => value === null || typeof value === 'number'), 'Batch statistics require numeric overview metrics.');
    const present = values.filter((value): value is number => typeof value === 'number').sort((a, b) => a - b);
    const n = present.length;
    const average = n ? present.reduce((a, b) => a + b, 0) / n : null;
    const median = n ? (present[Math.floor((n - 1) / 2)] + present[Math.floor(n / 2)]) / 2 : null;
    const deviation = n > 1 ? Math.sqrt(present.reduce((sum, value) => sum + (value - average!) ** 2, 0) / (n - 1)) : null;
    invariant(stats.valid_run_count === n && stats.missing_run_count === runs.length - n &&
      close(stats.mean, average) && close(stats.median, median) && close(stats.min, n ? present[0] : null) &&
      close(stats.max, n ? present[n - 1] : null) && close(stats.stddev, deviation), 'Batch statistics must match individual runs.');
  }
}

/** Initial journeys, excluding incoming loads; final boarding outcomes may differ. */
export function nativeCohorts(result: NativeCaseResult): string {
  return JSON.stringify(result.individual_results.map(run => {
    const incoming = new Set(run.sim_log.flatMap((value: any) => value.action === 'generate' ? value.passenger_ids : []));
    return run.passengers.filter((value: any) => !incoming.has(value.id)).map((value: any) => [
      value.id, value.origin_stop_id, value.destination_stop_id, value.get_to_stop_time, value.rider_group, value.development_id,
    ]).sort((a, b) => String(a[0]).localeCompare(String(b[0])));
  }));
}
