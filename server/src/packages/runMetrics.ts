import type { CaseResult } from '../../../frontend/src/lib/types.js';
import type { NativeCaseResult } from '../shared/nativeResults.js';

/** Decisions read the native overview; legacy arrays belong to fixtures only. */
export function runMetrics(result: CaseResult | NativeCaseResult) {
  if ('individual_results' in result) return result.individual_results.map(run => ({
    mean_wait_s: run.summary.overview.mean_wait_s,
    p95_wait_s: run.summary.overview.p95_wait_s,
    denied_share: run.summary.overview.denied_boarding_share,
    unresolved_passengers: run.summary.overview.unresolved_passengers,
    in_progress_passengers: run.summary.overview.in_progress_at_cutoff_passengers,
  }));
  return result.runs.map((_, i) => ({
    mean_wait_s: result.per_run_mean_wait_s[i], p95_wait_s: result.per_run_p95_wait_s[i],
    denied_share: result.per_run_denied_share[i], unresolved_passengers: result.per_run_unresolved_passengers[i],
    in_progress_passengers: 0,
  }));
}
