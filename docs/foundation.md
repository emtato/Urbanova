# Foundation handoff
The requested FastAPI backend is the active service. The original Express starter is preserved but is not part of setup.
The React/TypeScript Vite starter is preserved. MapLibre GL is the map dependency; Recharts is the only chart library.
Python direct dependencies are pinned in requirements.txt; frontend installs use the committed package-lock.json via npm ci.
Vultr Managed PostgreSQL is the only database. A missing DATABASE_URL is a configuration error.

## Run on each laptop
1. Install Python 3.11 and Node 24 LTS.
2. Pull the latest commit. Copy .env.example to .env and set DATABASE_URL to the Vultr Managed PostgreSQL connection URL with sslmode=require. Never commit or paste credentials into chat.
3. Run bash scripts/setup.sh, or powershell -ExecutionPolicy Bypass -File scripts/setup.ps1 on Windows. Setup preserves an existing .env and initializes Vultr Managed PostgreSQL.
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

## Vultr Managed PostgreSQL
The database account needs permission to enable PostGIS and create tables.
python -m scripts.check_db --init applies the repeatable db/init/001_foundation.sql schema to DATABASE_URL.
All saves through backend.db.save_result attach MODEL_VERSION and DATA_VERSION; the database rejects missing versions.
Increment these constants when the model or dataset changes. No simulation results or city data have been invented at this stage.
Restart the backend and worker after editing .env. Database access requires a network connection.

## Gate and inputs still required
- Put the Vultr Managed PostgreSQL connection URL and Gemini API key in each laptop's root .env. Foundation health checks do not call Gemini.
- All four owners must confirm the table above; product implementation waits until it passes.
- Push the foundation changes and share the commit SHA with all owners.
- Phase 01 still needs the corridor/direction/peak window, source data and model/schema decisions; those are outside Foundation.

FutureProof uses port 8010 to avoid other local apps. Restart Vite after a proxy configuration change.
In Command Prompt, run .venv\Scripts\python.exe -m uvicorn backend.main:app --reload --port 8010 from the repository root; no activation is needed.

## Create the shared database on Vultr
1. Sign in at https://my.vultr.com and open Products > Databases > Add Managed Database.
2. Choose PostgreSQL 17, a small plan and a nearby region. Name the service futureproof. Review the cost summary and credit eligibility, then deploy one database for the team.
3. Once ready, open Overview > Connection Details > Copy Connection String > Copy PostgreSQL URL.
4. Put that complete URL in DATABASE_URL in each laptop's root .env. Include sslmode=require and preserve the supplied hostname, port, username, password and database name.
5. Under Overview > Trusted Sources, allow the public IP addresses from which your teammates connect if access is restricted.
6. Run python -m scripts.check_db --init, then restart the backend and worker. The initialization enables PostGIS and creates the result table.

Official guides: [create a database](https://docs.vultr.com/products/storage/databases/postgresql/provisioning), [connection URL](https://docs.vultr.com/products/storage/databases/postgresql/management/connection/connection-details), and [trusted sources](https://docs.vultr.com/products/storage/databases/postgresql/management/connection/trusted-sources).
