# FutureProof
FutureProof explores housing and transit readiness; this commit supplies the shared development foundation.
Prerequisites: Python 3.11, Node 24 LTS, Docker Desktop with Compose v2; start Docker first.
Setup: `bash scripts/setup.sh` (macOS/Linux/Git Bash), or `powershell -ExecutionPolicy Bypass -File scripts/setup.ps1` (Windows).
Config: setup copies `.env.example` to `.env`; keep credentials backend-only; `OFFLINE=true` selects local PostGIS.
Activate: `source .venv/bin/activate` (Unix), `source .venv/Scripts/activate` (Git Bash), or `.venv\Scripts\Activate.ps1` (PowerShell).
Backend: `uvicorn backend.main:app --reload --port 8010` → http://localhost:8010/docs; health at `/api/health` and `/api/health/db`.
Worker: `python -m backend.worker` (dependency-check/idle scaffold); frontend in another terminal: `cd frontend` then `npm run dev` → http://localhost:5173.
Database: `python -m scripts.check_db --init` applies the shared schema and runs `SELECT postgis_version();`; set Tiger Data `DATABASE_URL` and `OFFLINE=false` to use hosted storage.
Gate: follow [the four-laptop checklist](docs/foundation.md); all four must pass backend/frontend/PostGIS checks and push the foundation commit before product work.
