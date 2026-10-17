# Foundation handoff
The requested FastAPI backend is the active service. The original Express starter is preserved but is not part of setup.
The React/TypeScript Vite starter is preserved. MapLibre GL is the map dependency; Recharts is the only chart library.
Python direct dependencies are pinned in requirements.txt; frontend installs use the committed package-lock.json via npm ci.

## Run on each laptop
1. Install Python 3.11, Node 24 LTS and Docker Desktop (Compose v2). On Apple Silicon the PostGIS image uses amd64 emulation.
2. Pull this commit and run bash scripts/setup.sh, or scripts/setup.ps1 in PowerShell. Setup is repeatable and never overwrites an existing .env.
3. Activate the venv as shown in README; run uvicorn backend.main:app --reload.
4. Open http://localhost:8000/api/health and http://localhost:8000/api/health/db; both must report status ok.
5. In a separate terminal run cd frontend then npm run dev; open http://localhost:5173. Vite proxies /api to port 8000.
6. Run python -m scripts.check_db --init and python -m backend.worker --once. The database check executes SELECT postgis_version();.
7. Record the actual results below. Do not mark another laptop as passing without its owner's confirmation.

| Laptop/owner | Backend | Frontend | PostGIS | Commit SHA |
| --- | --- | --- | --- | --- |
| 1 | pending | pending | pending | pending |
| 2 | pending | pending | pending | pending |
| 3 | pending | pending | pending | pending |
| 4 | pending | pending | pending | pending |

## Hosted database and offline fallback
Put the Tiger Data URL in the root .env with sslmode=require and set OFFLINE=false.
Run python -m scripts.check_db --init against Tiger Data: it uses the identical db/init/001_foundation.sql used locally.
The database account must be allowed to enable PostGIS and create tables. No Timescale-specific feature is required by the foundation.
For a wifi outage, set OFFLINE=true, ensure docker compose up -d --wait db succeeds, and restart the backend and worker.
Local and hosted databases share a schema but do not automatically replicate results. Populate any demo data in both before the demo.
All saves through backend.db.save_result attach MODEL_VERSION and DATA_VERSION; the database rejects missing versions.
Increment these constants when the model or dataset changes. No simulation results or city data have been invented at this stage.

## Gate and inputs still required
- Gemini API key and Tiger Data URL go into each laptop's .env; never commit them. Local foundation startup does not need Gemini.
- Docker must be installed and running to pass local PostGIS checks.
- All four owners must confirm the table above; product implementation waits until it passes.
- Review, commit and push the foundation changes to origin, then share the commit SHA with all owners.
- Phase 01 still needs the corridor/direction/peak window, source data and model/schema decisions; those are outside Foundation.

If port 8000 is occupied, stop the existing service before running the documented backend command; Vite proxies /api to port 8000.
