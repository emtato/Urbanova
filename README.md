# FutureProof
Lane C Express API: [run, endpoint contracts, worker/storage and fixture limits](docs/lane-c.md). Start it with `npm ci --prefix server`, `npm run db:init --prefix server`, then `npm start --prefix server`. The existing FastAPI Railway deployment remains unchanged until selecting `server/railway.json`.
FutureProof explores housing and transit readiness; this commit supplies the shared development foundation.
Prerequisites: Python 3.11, Node 24 LTS, and a Tiger Data Shared (free) PostgreSQL service.
Run the following commands from the repository root unless a command explicitly changes directories.
Config: copy `backend/.env.example` to the root `.env` and set `DATABASE_URL` to your Tiger Data PostgreSQL URL with `sslmode=require`; keep credentials backend-only.
Setup: `bash backend/scripts/setup.sh` (macOS/Linux/Git Bash), or `powershell -ExecutionPolicy Bypass -File backend/scripts/setup.ps1` (Windows).
Activate: `source .venv/bin/activate` (Unix), `source .venv/Scripts/activate` (Git Bash), or `.venv\Scripts\activate.bat` (Command Prompt).
Backend: `python -m uvicorn backend.main:app --reload --reload-dir backend --port 8010` → http://localhost:8010/docs; health at `/api/health` and `/api/health/db`.
Worker: `python -m backend.worker` (dependency-check/idle scaffold); frontend in another terminal: `cd frontend` then `npm run dev` → http://localhost:5173.
Database: `python -m backend.scripts.check_db --init` initializes Tiger Data PostgreSQL and runs `SELECT postgis_version();`; every laptop uses `DATABASE_URL`.
Checks: `python -m pytest backend/tests` and `python -m backend.scripts.check_contract`; in `frontend/`, run `npm run check:contract` and `npm run build`.
Layout: backend code, setup scripts, SQL, and dependency pins live in `backend/`; the app lives in `frontend/`; documentation lives in `docs/`. Root `requirements.txt` forwards to `backend/requirements.txt`; `.python-version`, `railway.json`, and `.gitattributes` stay at the root for tooling discovery.
Gate: follow [the four-laptop checklist](docs/foundation.md); all four must pass backend/frontend/PostGIS checks and pull the foundation commit before product work. Hosting: [Railway API setup](docs/railway.md). Phase 01: [505 feasibility](docs/feasibility.md), [contract 2.0.0](docs/contract.md) and [simulation data loading](docs/simulation-data.md). The frontend currently shows an explicitly labelled fixture.
