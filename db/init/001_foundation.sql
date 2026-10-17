-- Apply this exact, repeatable schema to local PostGIS and Tiger Data.
BEGIN;
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE TABLE IF NOT EXISTS saved_results (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at timestamptz NOT NULL DEFAULT now(),
    model_version text NOT NULL CHECK (length(model_version) > 0),
    data_version text NOT NULL CHECK (length(data_version) > 0),
    payload jsonb NOT NULL
);
COMMIT;
