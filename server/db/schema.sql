BEGIN;
CREATE TABLE IF NOT EXISTS c_scenarios (
 scenario_id text NOT NULL, version integer NOT NULL, payload jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(scenario_id,version)
);
CREATE TABLE IF NOT EXISTS c_jobs (
 job_id uuid PRIMARY KEY, scenario_id text NOT NULL, scenario_version integer NOT NULL,
 cache_key text NOT NULL UNIQUE, payload jsonb NOT NULL, status text NOT NULL DEFAULT 'queued'
 CHECK(status IN ('queued','running','completed','failed')), stale boolean NOT NULL DEFAULT false,
 comparison_id uuid, error text, notice text NOT NULL DEFAULT '', package_screen jsonb,
 lease_token uuid, lease_until timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(scenario_id,scenario_version) REFERENCES c_scenarios(scenario_id,version)
);
CREATE INDEX IF NOT EXISTS c_jobs_claim ON c_jobs(status,lease_until,created_at);
CREATE TABLE IF NOT EXISTS c_comparisons (
 comparison_id uuid PRIMARY KEY, payload jsonb NOT NULL, model_version text NOT NULL,
 data_version text NOT NULL, requested_scenario_id text NOT NULL, requested_scenario_version integer NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS c_run_aggregates (
 comparison_id uuid NOT NULL REFERENCES c_comparisons(comparison_id), run_id text NOT NULL,
 scenario_id text NOT NULL, phase_id text NOT NULL, package_id text NOT NULL, demand_case text NOT NULL,
 model_version text NOT NULL,data_version text NOT NULL,assumption_version text NOT NULL,
 seed_ids jsonb NOT NULL,source_ids jsonb NOT NULL,metrics jsonb NOT NULL,fixture boolean NOT NULL,
 PRIMARY KEY(comparison_id,run_id)
);
CREATE TABLE IF NOT EXISTS c_stop_aggregates (
 comparison_id uuid NOT NULL REFERENCES c_comparisons(comparison_id),case_id text NOT NULL,
 phase_id text NOT NULL,package_id text NOT NULL,demand_case text NOT NULL,
 stop_id text NOT NULL,rider_group text NOT NULL,metrics jsonb NOT NULL,
 PRIMARY KEY(comparison_id,case_id,stop_id,rider_group)
);
CREATE TABLE IF NOT EXISTS c_replays (
 comparison_id uuid NOT NULL REFERENCES c_comparisons(comparison_id),run_id text NOT NULL,
 payload jsonb NOT NULL, PRIMARY KEY(comparison_id,run_id)
);
CREATE TABLE IF NOT EXISTS c_development_access (
 data_version text NOT NULL,development_id text NOT NULL,stop_id text NOT NULL,source_ids jsonb NOT NULL,
 PRIMARY KEY(data_version,development_id,stop_id)
);
CREATE TABLE IF NOT EXISTS c_stops (
 data_version text NOT NULL,stop_id text NOT NULL,name text NOT NULL,PRIMARY KEY(data_version,stop_id)
);
CREATE TABLE IF NOT EXISTS c_ai_calls (
 call_id uuid PRIMARY KEY,created_at timestamptz NOT NULL DEFAULT now(),purpose text NOT NULL,
 model text NOT NULL,prompt_hash text NOT NULL,status text NOT NULL,duration_ms integer NOT NULL
);
COMMIT;
