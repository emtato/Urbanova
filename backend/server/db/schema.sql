BEGIN;
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE TABLE IF NOT EXISTS a_bundles(data_version text PRIMARY KEY,payload jsonb NOT NULL,loaded_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS a_sources(data_version text NOT NULL,source_id text NOT NULL,payload jsonb NOT NULL,PRIMARY KEY(data_version,source_id));
CREATE TABLE IF NOT EXISTS a_stops(data_version text NOT NULL,stop_id text NOT NULL,name text NOT NULL,seq integer NOT NULL,geom geometry(Point,4326) NOT NULL,payload jsonb NOT NULL,PRIMARY KEY(data_version,stop_id));
CREATE TABLE IF NOT EXISTS a_links(data_version text NOT NULL,link_id text NOT NULL,from_stop text NOT NULL,to_stop text NOT NULL,length_m double precision NOT NULL CHECK(length_m>0),geom geometry(LineString,4326) NOT NULL,payload jsonb NOT NULL,PRIMARY KEY(data_version,link_id),FOREIGN KEY(data_version,from_stop) REFERENCES a_stops(data_version,stop_id),FOREIGN KEY(data_version,to_stop) REFERENCES a_stops(data_version,stop_id));
CREATE TABLE IF NOT EXISTS a_developments(data_version text NOT NULL,development_id text NOT NULL,geom geometry(Point,4326) NOT NULL,payload jsonb NOT NULL,PRIMARY KEY(data_version,development_id));
CREATE TABLE IF NOT EXISTS a_walking_access(data_version text NOT NULL,development_id text NOT NULL,stop_id text NOT NULL,walk_m double precision NOT NULL CHECK(walk_m>=0),review_status text NOT NULL,payload jsonb NOT NULL,PRIMARY KEY(data_version,development_id,stop_id),FOREIGN KEY(data_version,development_id) REFERENCES a_developments(data_version,development_id),FOREIGN KEY(data_version,stop_id) REFERENCES a_stops(data_version,stop_id));
CREATE TABLE IF NOT EXISTS a_interventions(data_version text NOT NULL,intervention_id text NOT NULL,payload jsonb NOT NULL,PRIMARY KEY(data_version,intervention_id));
ALTER TABLE a_walking_access ADD COLUMN IF NOT EXISTS geom geometry(LineString,4326);
CREATE INDEX IF NOT EXISTS a_stops_geom ON a_stops USING gist(geom);
CREATE INDEX IF NOT EXISTS a_links_geom ON a_links USING gist(geom);
CREATE INDEX IF NOT EXISTS a_developments_geom ON a_developments USING gist(geom);
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
-- Skip claims from older servers that still use an unfiltered claim query.
-- Legacy jobs without a tag remain readable. This is compatibility, not auth.
CREATE OR REPLACE FUNCTION c_guard_worker_claim() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.status='running' AND (OLD.status<>'running' OR NEW.lease_token IS DISTINCT FROM OLD.lease_token)
 AND NEW.payload->>'worker_tag' IS NOT NULL
 AND coalesce(current_setting('application_name',true),'')<>NEW.payload->>'worker_tag' THEN
  RETURN NULL;
 END IF;
 RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS c_worker_claim ON c_jobs;
CREATE TRIGGER c_worker_claim BEFORE UPDATE ON c_jobs FOR EACH ROW EXECUTE FUNCTION c_guard_worker_claim();
CREATE TABLE IF NOT EXISTS c_comparisons (
 comparison_id uuid PRIMARY KEY, payload jsonb NOT NULL, model_version text NOT NULL,
 data_version text NOT NULL, requested_scenario_id text NOT NULL, requested_scenario_version integer NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS c_comparisons_history ON c_comparisons(requested_scenario_id,created_at DESC,comparison_id DESC);
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
CREATE TABLE IF NOT EXISTS c_delayed_comparisons (
 comparison_id uuid PRIMARY KEY REFERENCES c_comparisons(comparison_id),
 delayed_comparison_id uuid NOT NULL UNIQUE REFERENCES c_comparisons(comparison_id)
);
CREATE TABLE IF NOT EXISTS c_b11_run_metrics (
  comparison_id uuid NOT NULL REFERENCES c_comparisons(comparison_id) ON DELETE CASCADE,
  run_id text NOT NULL, payload jsonb NOT NULL, PRIMARY KEY(comparison_id,run_id)
);
CREATE TABLE IF NOT EXISTS c_b11_replays (
 comparison_id uuid PRIMARY KEY REFERENCES c_comparisons(comparison_id),
 run_id text NOT NULL,payload jsonb NOT NULL
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
CREATE TABLE IF NOT EXISTS c_simulations (
 id uuid PRIMARY KEY,payload jsonb NOT NULL,model_version text NOT NULL,
 data_version text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 name text
);
ALTER TABLE c_simulations ADD COLUMN IF NOT EXISTS name text;
CREATE INDEX IF NOT EXISTS c_simulations_history ON c_simulations(created_at DESC,id DESC);
COMMIT;
