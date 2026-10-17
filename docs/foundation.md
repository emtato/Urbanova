# Foundation handoff
The requested FastAPI backend is the active service. The original Express starter is preserved but is not part of setup.
The React/TypeScript Vite starter is preserved. MapLibre GL is the map dependency; Recharts is the only chart library.
Python direct dependencies are pinned in requirements.txt; frontend installs use the committed package-lock.json via npm ci.
Use a hosted PostgreSQL database with PostGIS; Neon Free is the recommended starting option. A missing DATABASE_URL is a configuration error.

## Run on each laptop
1. Install Python 3.11 and Node 24 LTS.
2. Pull the latest commit. Copy .env.example to .env and set DATABASE_URL to the hosted PostgreSQL connection URL with sslmode=require. Never commit or paste credentials into chat.
3. Run bash scripts/setup.sh, or powershell -ExecutionPolicy Bypass -File scripts/setup.ps1 on Windows. Setup preserves an existing .env and initializes hosted PostgreSQL.
4. Activate the venv as shown in README; run python -m uvicorn backend.main:app --reload --port 8010.
5. Open http://localhost:8010/api/health and http://localhost:8010/api/health/db; both must report status ok.
6. In a separate terminal run cd frontend then npm run dev; open http://localhost:5173. Vite proxies /api to port 8010.
7. Run python -m scripts.check_db --init and python -m backend.worker --once. The database check executes SELECT postgis_version();.
8. Record actual results below. Do not mark another laptop as passing without its owner's confirmation.

| Laptop/owner | Backend | Frontend | PostGIS | Commit SHA |
| --- | --- | --- | --- | --- |
| 1 | pending | pending | pending | pending |
| 2 | pending | pending | pending | pending |
| 3 | pending | pending | pending | pending |
| 4 | pending | pending | pending | pending |

## hosted PostgreSQL
The database account needs permission to enable PostGIS and create tables.
python -m scripts.check_db --init applies the repeatable db/init/001_foundation.sql schema to DATABASE_URL.
All saves through backend.db.save_result attach MODEL_VERSION and DATA_VERSION; the database rejects missing versions.
Increment these constants when the model or dataset changes. No simulation results or city data have been invented at this stage.
Restart the backend and worker after editing .env. Database access requires a network connection.

## Gate and inputs still required
- Put the hosted PostgreSQL connection URL and Gemini API key in each laptop's root .env. Foundation health checks do not call Gemini.
- All four owners must confirm the table above; product implementation waits until it passes.
- Push the foundation changes and share the commit SHA with all owners.
- Phase 01 still needs the corridor/direction/peak window, source data and model/schema decisions; those are outside Foundation.

FutureProof uses port 8010 to avoid other local apps. Restart Vite after a proxy configuration change.
In Command Prompt, run .venv\Scripts\python.exe -m uvicorn backend.main:app --reload --port 8010 from the repository root; no activation is needed.


## Create a free shared database
1. Sign up at https://console.neon.tech and stay on the Free plan.
2. Create a project named futureproof in a nearby region.
3. Click Connect and copy the PostgreSQL connection URL. For schema initialization, use a direct connection (turn off connection pooling in the connection dialog).
4. Put the URL in DATABASE_URL in the root .env, keeping the SSL options supplied by Neon. Copy only the URL, without a psql command or wrapping quotes.
5. Run python -m scripts.check_db --init. The script enables PostGIS and creates the result table.
6. Restart the backend, then open http://localhost:8010/api/health/db. Share the credentials privately with teammates for their own .env files.

The Free plan has storage and compute limits: keep large source downloads in ignored data/raw or data/cache, and store only the corridor data/results needed for the demo.
Official references: [free plan](https://neon.com/pricing), [PostGIS](https://neon.com/docs/extensions/postgis), and [connecting](https://neon.com/docs/connect/connect-from-any-app).
