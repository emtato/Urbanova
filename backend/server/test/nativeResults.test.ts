import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Pool } from 'pg';
import { evaluate } from '../src/packages/evaluate.js';
import { compare } from '../src/packages/compare.js';
import { checkedB11Comparison } from '../src/packages/plan.js';
import { brief } from '../src/services/brief.js';
import { explain } from '../src/ai/explainer.js';
import { checkedComparison } from '../src/services/comparisonIntegrity.js';
import { defaultScenario, dataVersion, simulationModelVersion } from '../src/services/bundle.js';
import { NativeBatchSchema } from '../src/shared/schemas.js';
import type { NativeComparison } from '../src/shared/nativeResults.js';
import { PgStore, type Job, type EvaluationResult } from '../src/storage/store.js';

const request = {scenario: structuredClone(defaultScenario), policy: null,
  random: {seed_ids: [17], draws_id: 'native-handoff-test'}, retain_replay: true, evaluator: 'b11' as const};
let computation: Promise<EvaluationResult & {comparison: NativeComparison}> | undefined;
function computed() {
  return computation ??= evaluate(request).then(result => {
    if (result.comparison.contract_version !== '3.0.0') throw Error('Expected native comparison');
    return {...result, comparison: result.comparison};
  });
}

test('native batch survives schema validation with every original run section', async () => {
  const {comparison} = await computed();
  const result = comparison.cases[0];
  const batch = {id: result.id, overall_results: result.overall_results, individual_results: result.individual_results};
  assert.deepEqual(NativeBatchSchema.parse(batch), batch);
  assert.deepEqual(Object.keys(batch.individual_results[0]).sort(), ['inputs','passengers','sim_log','streetcars','summary']);
  assert.ok(batch.individual_results[0].summary.overview.in_progress_at_cutoff_passengers > 0);
  assert.equal(result.runs[0].diagnostics.unresolved_passengers, batch.individual_results[0].summary.overview.unresolved_passengers);
  assert.ok(checkedComparison(comparison));
});

test('native validation rejects altered metrics, missing aggregates, seed order and cutoff reclassification', async () => {
  const original = (await computed()).comparison;
  const damages: ((c: NativeComparison) => void)[] = [
    c => {c.cases[0].per_run_unresolved_passengers[0]++;},
    c => {c.cases[0].overall_results.metrics.mean_wait_s.mean!++;},
    c => {delete c.cases[0].overall_results.metrics.mean_wait_s;},
    c => {c.cases[0].individual_results[0].inputs.seed++;},
    c => {c.cases[0].runs[0].diagnostics.in_progress_at_cutoff_excluded++;},
    c => {c.cases[0].stops[0].encountered_streetcar_passengers = c.cases[0].stops[0].passengers + 1;},
  ];
  for (const damage of damages) {
    const changed = structuredClone(original); damage(changed);
    assert.throws(() => checkedComparison(changed));
  }
});

test('cohort matching compares initial journeys instead of package-dependent completion counts', async () => {
  const changed = structuredClone((await computed()).comparison);
  const retained = changed.cases.flatMap(c=>c.individual_results).find(r=>r.inputs.retention==='full-selected-run')!;
  const passenger = retained.passengers[0] as {get_to_stop_time: number};
  passenger.get_to_stop_time++;
  assert.throws(() => checkedB11Comparison(changed, request), /cohorts/);
  const compact=structuredClone((await computed()).comparison);
  const growth=compact.cases.find(c=>c.kind==='supported_growth')!;
  growth.individual_results[0].inputs.cohort_signature='0'.repeat(64);
  assert.throws(()=>checkedB11Comparison(compact,request),/cohorts/);
});

test('package decisions read native metrics and keep in-progress riders separate', async () => {
  const changed = structuredClone((await computed()).comparison);
  changed.scenario.planning_criterion = {max_p95_wait_s: 86400, max_denied_share: 1,
    max_unresolved_passengers: 0, meaning: 'Test criterion'};
  assert.ok(changed.cases.every(c => c.individual_results.every(r => r.summary.overview.unresolved_passengers === 0)));
  // Old derived arrays must not silently replace the native decision source.
  for (const result of changed.cases) {
    result.per_run_unresolved_passengers.fill(1000000);
    result.per_run_p95_wait_s.fill(1000000);
  }
  const decision = compare(changed);
  assert.equal(decision.alternatives[0].meets, true);
  assert.equal(decision.alternatives[0].unresolved, 0);
  assert.equal(decision.preferred_package_id, 'existing');
  assert.match(brief(changed), /boarded-rider p95/);
  assert.match(brief(changed), /in progress/);
  assert.match(brief(changed), /mean-wait statistics across runs/);
});

test('explanations receive checked metrics and variation without full passenger/replay archives', async () => {
  const {comparison} = await computed();
  let inspected = false;
  const result = await explain(comparison, async (_purpose, prompt) => {
    inspected = true;
    assert.ok(!prompt.includes('"individual_results"'));
    assert.ok(prompt.includes('"overall_results"'));
    assert.match(prompt, /unresolved means denied and still waiting/);
    assert.ok(prompt.length < JSON.stringify(comparison).length / 5);
    return null;
  });
  assert.equal(inspected, true);
  assert.equal(result.fallback, true);
});

/** Query adapter tests exercise PgStore values and transactions without a live DB. */
function recordingStore(failReplay = false) {
  const store = new PgStore('postgres://audit@localhost/audit');
  const calls: {sql: string; values: any[]}[] = [];
  const saved = new Map<string, any>(), replay = new Map<string, any>();
  const native = new Map<string, {run_id: string; summary: unknown}[]>();
  const query = async (sql: string, values: any[] = []) => {
    calls.push({sql, values: structuredClone(values)});
    if (sql.startsWith('SELECT job_id')) return {rows: [{job_id: 'owned'}], rowCount: 1};
    if (sql.startsWith('INSERT INTO c_comparisons')) saved.set(values[0], structuredClone(values[1]));
    if (sql.startsWith('INSERT INTO c_b11_run_metrics')) for(let i=0;i<values.length;i+=3)native.set(values[i], [...(native.get(values[i]) ?? []), {run_id: values[i+1], summary: structuredClone(values[i+2])}]);
    if (sql.startsWith('INSERT INTO c_b11_replays')) {
      if (failReplay) throw Error('Injected replay write failure');
      replay.set(values[0], structuredClone(values[2]));
    }
    if (sql.startsWith('SELECT payload FROM c_comparisons')) return {rows: saved.has(values[0]) ? [{payload: structuredClone(saved.get(values[0]))}] : []};
    if (sql.startsWith('SELECT payload FROM c_b11_replays')) return {rows: replay.has(values[0]) ? [{payload: structuredClone(replay.get(values[0]))}] : []};
    if (sql.startsWith('SELECT run_id,payload AS summary')) return {rows: structuredClone(native.get(values[0]) ?? [])};
    if (sql.startsWith('INSERT INTO c_simulations')) {
      saved.set(values[0], { payload: structuredClone(values[1]), name: values[4] });
      return { rows: [], rowCount: 1 };
    }
    if (/^SELECT\s+.*\s+FROM c_simulations\b/.test(sql)) {
      return { rows: [...saved.values()].filter(s => s.payload && s.payload.overall_results).map(s => ({ payload: structuredClone(s.payload), name: s.name })) };
    }
    if (sql.startsWith('UPDATE c_simulations SET name')) {
      const existing = saved.get(values[0]);
      if (existing) {
        existing.name = values[1];
        existing.payload.name = values[1];
        return { rows: [{ id: values[0] }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }
    if (sql.startsWith('DELETE FROM c_simulations')) {
      const existed = saved.delete(values[0]);
      return { rows: existed ? [{ id: values[0] }] : [], rowCount: existed ? 1 : 0 };
    }
    return {rows: [], rowCount: 1};
  };
  store.pool = {query, connect: async () => ({query, release() {}})} as unknown as Pool;
  return {store, calls, saved};
}
function job(): Job {
  return {job_id: 'job', scenario_id: defaultScenario.scenario_id, scenario_version: 1,
    status: 'running', comparison_id: null, error: null, stale: false, notice: '', package_screen: null, lease_token: 'owned',
    payload: {evaluator: 'b11', retain_replay: true, execution_versions: {simulation_model: simulationModelVersion, data_version: dataVersion}}};
}

test('PgStore saves and retrieves full native batches, summaries and selected replay', async () => {
  const result = structuredClone(await computed());
  result.comparison.cases[0].individual_results[0].summary.extension = {retained: ['without', 'flattening']};
  delete result.native_metrics; // The native dictionaries are sufficient on their own.
  const {store, calls, saved} = recordingStore();
  await store.finish(job(), result);
  const id = [...saved.keys()][0];
  const restored = await store.comparison(id);
  assert.equal(restored?.contract_version, '3.0.0');
  assert.deepEqual(restored?.cases, result.comparison.cases);
  const selected = await store.nativeReplay(id);
  assert.deepEqual(selected?.events, result.native_replay?.events);
  const summaries = await store.nativeMetrics(id);
  assert.equal(summaries.length, result.comparison.cases.length);
  assert.deepEqual(summaries[0].summary, result.comparison.cases[0].individual_results[0].summary);
  const metrics = calls.find(c => c.sql.startsWith('INSERT INTO c_run_aggregates'))!.values[11];
  const overview = result.comparison.cases[0].individual_results[0].summary.overview;
  assert.equal(metrics.unresolved_passengers, overview.unresolved_passengers);
  assert.equal(metrics.in_progress_at_cutoff_passengers, overview.in_progress_at_cutoff_passengers);
  assert.equal(metrics.denied_share, overview.denied_boarding_share);
  assert.ok(calls.some(c => c.sql === 'COMMIT'));
  assert.equal(await store.comparison('missing'), null);
});

test('PgStore rolls back a failed replay write without completing the job', async () => {
  const {store, calls} = recordingStore(true);
  await assert.rejects(store.finish(job(), await computed()), /Injected replay write failure/);
  assert.equal(calls.at(-1)!.sql, 'ROLLBACK');
  assert.ok(!calls.some(c => c.sql.startsWith("UPDATE c_jobs SET status='completed'")));
});

test('past-run query filters and paginates without loading full simulation dictionaries', async () => {
  const {store, calls} = recordingStore();
  await store.pastRuns({scenario_id: 'selected-scenario', limit: 5, offset: 10});
  assert.deepEqual(calls[0].values, ['selected-scenario', 5, 10]);
  assert.match(calls[0].sql, /NOT EXISTS \(SELECT 1 FROM c_delayed_comparisons/);
  assert.match(calls[0].sql, /ORDER BY created_at DESC, comparison_id DESC LIMIT/);
  assert.equal(calls.length, 1);
});

test('PgStore saves, fetches, renames and deletes native simulations', async () => {
  const {store} = recordingStore();
    const stat = { valid_run_count: 1, missing_run_count: 0, mean: 0, median: 0, min: 0, max: 0, stddev: null };
    const sampleBatch: any = {
      id: '3f6a29bc-49e0-47b7-b088-7e5bebf92ea3',
      overall_results: {
        run_count: 1, seeds: [42],
        metrics: {
          denied_boarding_share: stat,
          in_progress_at_cutoff_passengers: stat,
          mean_wait_s: stat,
          p95_wait_s: stat,
          raw_waiting_at_cutoff_passengers: stat,
          unresolved_passengers: stat,
        },
        all_runs_conservation_valid: true, invalid_run_indices: [],
        runtime: { per_run_s: [0.1], statistics_s: { valid_run_count: 1, missing_run_count: 0, mean: 0.1, median: 0.1, min: 0.1, max: 0.1, stddev: null }, total_s: 0.1 }
      },
      individual_results: [
        { inputs: { seed: 42 }, streetcars: [], passengers: [], sim_log: [], summary: { overview: { in_progress_at_cutoff_passengers: 0, raw_waiting_at_cutoff_passengers: 0, unresolved_passengers: 0, conservation_valid: true, mean_wait_s: 0, p95_wait_s: 0, denied_boarding_share: 0 }, contract: { diagnostics: { passengers_created: 0, passengers_arrived: 0, passengers_waiting: 0, passengers_onboard: 0, in_progress_at_cutoff_excluded: 0, conservation: true, unresolved_passengers: 0, runtime_s: 0.1 } } } }
      ]
    };
  await store.saveSimulation(sampleBatch, 'Original Name');
  const fetched = await store.fetchSimulations();
  assert.equal(fetched.length, 1);
  assert.equal(fetched[0].name, 'Original Name');

  const renamed = await store.renameSimulation(sampleBatch.id, 'New Name');
  assert.equal(renamed, true);
  const refetched = await store.fetchSimulations();
  assert.equal(refetched[0].name, 'New Name');

  const missingRename = await store.renameSimulation('00000000-0000-0000-0000-000000000000', 'Missing');
  assert.equal(missingRename, false);

  const deleted = await store.deleteSimulation(sampleBatch.id);
  assert.equal(deleted, true);
  assert.equal((await store.fetchSimulations()).length, 0);

  const missingDelete = await store.deleteSimulation('00000000-0000-0000-0000-000000000000');
  assert.equal(missingDelete, false);
});

