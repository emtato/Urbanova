# FutureProof
Live frontend: open `/analysis` to configure and run B11 package comparisons, inspect native cutoff metrics and scrub a selected replay. See [the live analysis guide](docs/live-analysis.md).
Lane C Express API: [run, endpoint contracts, worker/storage and B11 integration](docs/lane-c.md). Install Python bridge dependencies with `python -m pip install -r backend/integration/requirements.txt`. Start it with `npm ci --prefix backend/server`, `npm run db:init --prefix backend/server`, then `npm start --prefix backend/server`. The root Railway config now targets Express.
FutureProof compares housing and transit scenarios on the westbound 505, Broadview at Dundas to TMU/Yonge. Outputs are scenario experiments.
Prerequisites: Python 3.11, Node 24 LTS, and a Tiger Data Shared (free) PostgreSQL service.
Run the following commands from the repository root unless a command explicitly changes directories.
Config: copy `backend/.env.example` to the root `.env` and set `DATABASE_URL` to your Tiger Data PostgreSQL URL with `sslmode=require`; keep credentials backend-only.
Setup: `bash backend/scripts/setup.sh` (macOS/Linux/Git Bash), or `powershell -ExecutionPolicy Bypass -File backend/scripts/setup.ps1` (Windows).
Activate: `source .venv/bin/activate` (Unix), `source .venv/Scripts/activate` (Git Bash), or `.venv\Scripts\activate.bat` (Command Prompt).
Legacy Python foundation API: `python -m uvicorn backend.main:app --reload --reload-dir backend --port 8010` → http://localhost:8010/docs; health at `/api/health` and `/api/health/db`.
Worker: Express starts its worker_threads scheduler automatically; frontend in another terminal: `cd frontend` then `npm run dev` → http://localhost:5173.
Database: `python -m backend.scripts.check_db --init` initializes Tiger Data PostgreSQL and runs `SELECT postgis_version();`; every laptop uses `DATABASE_URL`.
Checks: `python -m pytest backend/tests` and `python -m backend.scripts.check_contract`; in `frontend/`, run `npm run check:contract` and `npm run build`.
Layout: backend code, setup scripts, SQL, and dependency pins live in `backend/`; the app lives in `frontend/`; documentation lives in `docs/`. Root `requirements.txt` forwards to `backend/requirements.txt`; `.python-version`, `railway.json`, and `.gitattributes` stay at the root for tooling discovery.
Precompute: `npm run pipeline --prefix backend/server -- --scenario demo --runs 20` saves two phases, low/central/high demand, four packages, and an upgrade-delay comparison. Repeat it to confirm a cache hit; selected replay and `data/cache/demo/brief.txt` are retained.
Demo: `powershell -ExecutionPolicy Bypass -File backend/scripts/run_demo.ps1` or `bash backend/scripts/run_demo.sh`; add `-CheckOnly` / `--check-only` to verify prerequisites. Tiger Data and network are required; no local database fallback is configured.
Data: `npm run seed:data --prefix backend/server` loads the versioned spatial bundle; `python -m backend.scripts.check_consistency` reports baseline schedule residuals. Walking alternatives require manual sign-off in `data/reviewed/walking_review.csv`.
Read [architecture](docs/architecture.md), [assumptions](docs/assumptions.md), [demo script](docs/demo_script.md), [Q&A](docs/qa_card.md) and [remaining checks](docs/completion.md). The frontend retains a labelled fixture option; live results use contract 3.0.0.
Gate: each teammate still confirms their own laptop using [the checklist](docs/foundation.md). Hosting: [Railway](docs/railway.md); [505 feasibility](docs/feasibility.md), [contracts](docs/contract.md), [data loading](docs/simulation-data.md).
