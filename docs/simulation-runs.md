# Repeated simulation runs (B11)

`backend/simulation/paired_runs.py` orchestrates existing single-run simulations.
It returns full result dictionaries and run-level statistics without changing
passenger generation, movement, dwell, or the simulator owner's metric definitions.

## Run one input set 20 times

```python
from backend.simulation import run_repeated_simulations
from data.simulation_input import load_simulation_input

inputs = load_simulation_input()
batch = run_repeated_simulations(inputs)

overall = batch["overall_results"]
individual = batch["individual_results"]
average_wait = overall["metrics"]["mean_wait_s"]
runtime = overall["runtime"]
first_run = individual[0]  # The original run_simulation() result dictionary.
```

The return value has exactly these two top-level keys:

```text
overall_results:
  run_count: 20
  seeds: [0, 1, ..., 19]
  metrics:
    mean_wait_s: {valid_run_count, missing_run_count, mean, median, min, max, stddev}
    p95_wait_s: {same statistics}
    ...every numeric/null summary.overview metric...
  all_runs_conservation_valid: true/false
  invalid_run_indices: [...zero-based indices...]
  runtime:
    per_run_s: [...elapsed seconds aligned with individual_results...]
    statistics_s: {same statistics}
    total_s: elapsed seconds for the entire batch
individual_results:
  - {inputs, streetcars, passengers, sim_log, summary}
  - ...19 more full single-run dictionaries...
```

Default seeds start at `inputs.seed` and increase by one. A deep copy of the
original inputs is made for every run because Stop queues are mutable. Only the
seed changes; each seed samples its own passengers and operating randomness.
The caller's input objects remain unchanged. Results stay in seed order.

For an explicit seed list, supply its length as `run_count`, for example
`run_repeated_simulations(inputs, run_count=3, seeds=[13, 2, 19])`.
Counts must be positive; seeds must be distinct integers. Failures propagate
instead of producing a partial batch that appears to contain 20 successful runs.

The averages give each run equal weight. Missing values are excluded and counted,
never treated as zero. `stddev` is the sample standard deviation and is null with
fewer than two valid values. A mean of 20 run p95s is **not** a pooled passenger
p95 or a confidence interval. Full passenger histories remain in the individual
results if a different aggregation is needed later.

The simulator owner's definitions are authoritative here: riders onboard at
cutoff and riders still awaiting their first car are classified as in progress;
unresolved riders are those still waiting after being denied boarding. Denied
share uses corridor riders who encountered a streetcar. This layer does not
substitute Lane C's earlier contract definitions.

Runtime is measured around each full call, including input copying and the
single-run analyzer. Total batch runtime also includes aggregate calculation.
Runtime fields naturally differ when repeating an otherwise reproducible batch.
The individual dictionaries retain their existing internal runtime field too.

## Compare packages with matching seeds

```python
from dataclasses import replace
from backend.simulation import run_paired_comparisons

comparison = run_paired_comparisons(
    {
        "baseline": inputs,
        "extra_service": replace(inputs, headway_s=inputs.headway_s / 2),
    },
    baseline_case="baseline",
)

baseline_batch = comparison["cases"]["baseline"]
service_batch = comparison["cases"]["extra_service"]
wait_improvement = comparison["improvements"]["extra_service"]["mean_wait_s"]
```

This example changes the current engine's headway input; it does not implement
the alternative timetable required by B8. Every named case receives the same
ordered seed list, derived from the baseline input's seed unless explicitly
provided. Each case contains the same `overall_results` / `individual_results`
structure. `total_run_count` counts all simulations, including the baseline, and
`runtime_s` measures the whole comparison.

For metrics with a clear lower-is-better meaning (waits, journey/ride times,
denied shares, unresolved riders, physical queue and full-departure share), each
comparison records:

- `per_run_reduction`: baseline minus candidate, matched by seed.
- `reduction`: mean, median, min, max and sample standard deviation of reductions.
- `per_run_reduction_percent`: 100 times reduction divided by the baseline.
- `reduction_percent`: statistics over those paired percentage reductions.

Positive values mean improvement; negative values mean deterioration. Missing
metrics give null paired differences. A zero baseline gives null percentage
reduction, even when both values are zero. Share differences are fractions;
multiply by 100 to express a difference in percentage points. Average percentage
reduction is the mean of per-seed percentages, not a ratio of aggregate means.
Passenger and vehicle counts are summarized but not automatically scored.

Use one comparison per demand/phase combination, with packages as named cases,
so improvement is measured against the appropriate baseline. Repeating this for
three demand cases and two phases with four packages means 480 simulations;
additional baselines or delay cases increase that count. This module accepts
prepared inputs; it does not invent package, demand, or phase definitions.

Matching seeds is orchestration support for pairing. Fixed vehicle/link draws
across event-order changes remain B2 work. This layer also does not convert
results to Lane C's Comparison/replay schema. The owner's handoff decision makes
C responsible for consuming the native dictionaries and preserving these metric
definitions; see [the contract](contract.md#active-owner-decision-native-simulation-results-2026-10-17).

## Measured local benchmark

On 2026-10-17, the reviewed `data/reviewed/simulation_input.json` ran with seeds
0–19, retaining all 20 full dictionaries in memory. Total batch time was
**20.23 seconds**; per-run mean 1.01 s, median 0.92 s, min 0.82 s, max 1.49 s
and sample standard deviation 0.21 s. All 20 runs passed the existing
single-run conservation check. The mean wait varied from 187.96 to 203.29 s
across seeds (mean 193.63 s, sample standard deviation 3.81 s).

Multiplying the measured mean runtime by 480 gives **about 485 seconds (8.1
minutes)**. This is a runtime estimate for comparable cases, not a measured
480-run package/demand/phase benchmark; different case sizes and persistence
costs can change it. Retaining full passenger histories and replay logs also
consumes more memory as run counts increase.
