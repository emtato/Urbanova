-- 1. Reviewed development access joined to the affected stops, version pinned.
SELECT a.development_id,s.stop_id,s.name,a.source_ids
FROM c_development_access a JOIN c_stops s USING(data_version,stop_id)
WHERE a.data_version=$1 ORDER BY a.development_id,s.stop_id;

-- 2. Worst stops in one comparison/phase. Null waits remain unknown.
SELECT stop_id,package_id,demand_case,rider_group,
 (metrics->>'p95_wait_s')::double precision AS p95_wait_s,
 (metrics->>'remaining_queue')::integer AS remaining_queue
FROM c_stop_aggregates WHERE comparison_id=$1 AND phase_id=$2
ORDER BY remaining_queue DESC,p95_wait_s DESC NULLS LAST;

-- 3. Same package across actual runs and assumption versions; retain fixture flag.
SELECT comparison_id,run_id,scenario_id,phase_id,demand_case,model_version,
 data_version,assumption_version,seed_ids,metrics,fixture
FROM c_run_aggregates WHERE package_id=$1
ORDER BY assumption_version,comparison_id,run_id;

-- Use EXPLAIN (ANALYZE, BUFFERS) with representative bound parameters before
-- claiming a speed-up. This schema makes no measured performance claim.
