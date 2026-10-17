# Foundation handoff
The requested FastAPI backend is the active service. The original Express starter is preserved but is not part of setup.
The React/TypeScript Vite starter is preserved. MapLibre GL is the map dependency; Recharts is the only chart library.
Python direct dependencies are pinned in backend/requirements.txt; root requirements.txt forwards to it for tooling discovery. Frontend installs use frontend/package-lock.json via npm ci.
Use one Tiger Data Shared (free) PostgreSQL database with PostGIS for the team. A missing DATABASE_URL is a configuration error.

## Run on each laptop
1. Install Python 3.11 and Node 24 LTS.
2. Pull the latest commit. From the repository root, copy backend/.env.example to .env and set DATABASE_URL to the Tiger Data PostgreSQL connection URL with sslmode=require. Never commit or paste credentials into chat.
3. Run bash backend/scripts/setup.sh, or powershell -ExecutionPolicy Bypass -File backend/scripts/setup.ps1 on Windows. Setup preserves an existing root .env and initializes Tiger Data PostgreSQL.
4. Activate the venv as shown in README; run python -m uvicorn backend.main:app --reload --reload-dir backend --port 8010.
5. Open http://localhost:8010/api/health and http://localhost:8010/api/health/db; both must report status ok.
6. In a separate terminal run cd frontend then npm run dev; open http://localhost:5173. Vite proxies /api to port 8010.
7. Run python -m backend.scripts.check_db --init and python -m backend.worker --once from the repository root. The database check executes SELECT postgis_version();.
8. Record actual results below. Do not mark another laptop as passing without its owner's confirmation.

| Laptop/owner | Backend | Frontend | PostGIS | Commit SHA |
| --- | --- | --- | --- | --- |
| 1 | pending | pending | pending | pending |
| 2 | pending | pending | pending | pending |
| 3 | pending | pending | pending | pending |
| 4 | pending | pending | pending | pending |

## Tiger Data
The database account needs permission to enable PostGIS and create tables.
python -m backend.scripts.check_db --init applies the repeatable backend/db/init/001_foundation.sql schema to DATABASE_URL.
All saves through backend.db.save_result attach MODEL_VERSION and DATA_VERSION; the database rejects missing versions.
Increment these constants when the model or dataset changes. No simulation results or city data have been invented at this stage.
Restart the backend and worker after editing .env. Database access requires a network connection.

## Gate and inputs still required
- Put the Tiger Data PostgreSQL connection URL and Gemini API key in each laptop's root .env. Foundation health checks do not call Gemini.
- All four owners must confirm the table above; product implementation waits until it passes.
- Push the foundation changes and share the commit SHA with all owners.
- Phase 01 implementation evidence is in docs/feasibility.md and docs/contract.md; contract 1.0.0 and the full comparison/replay fixture pass both language checks.

FutureProof uses port 8010 to avoid other local apps. Restart Vite after a proxy configuration change.
In Command Prompt, run .venv\Scripts\python.exe -m uvicorn backend.main:app --reload --reload-dir backend --port 8010 from the repository root; no activation is needed.



## Create the shared Tiger Data database
1. Sign up or log in at https://console.cloud.tigerdata.com.
2. Click New service and choose Shared, the free compute option. Select Development and name the service futureproof.
3. Download the database config when prompted and keep it private. The password is shown only at creation. Wait until the service is Ready.
4. Copy the complete PostgreSQL service URL from the config into DATABASE_URL in each laptop's root .env, preserving sslmode=require. Copy only the URL, without a psql command or wrapping quotes.
5. From the repository root, run python -m backend.scripts.check_db --init. This enables PostGIS and creates the result table.
6. Restart the backend and open http://localhost:8010/api/health/db; it must report status ok. Share credentials privately with teammates for their own .env files.

Use one database for the team. Keep raw city downloads in ignored data/raw or data/cache and monitor the free service's storage limits.
Official references: [create a free service](https://www.tigerdata.com/docs/get-started/quickstart/create-service) and [connection details](https://www.tigerdata.com/docs/integrate/find-connection-details).
