# FutureProof
FutureProof explores housing and transit readiness; this commit supplies the shared development foundation.
Prerequisites: Python 3.11, Node 24 LTS, and a Tiger Data Shared (free) PostgreSQL service.
Config: copy `.env.example` to `.env` and set `DATABASE_URL` to your Tiger Data PostgreSQL URL with `sslmode=require`; keep credentials backend-only.
Setup: `bash scripts/setup.sh` (macOS/Linux/Git Bash), or `powershell -ExecutionPolicy Bypass -File scripts/setup.ps1` (Windows).
Activate: `source .venv/bin/activate` (Unix), `source .venv/Scripts/activate` (Git Bash), or `.venv\Scripts\activate.bat` (Command Prompt).
Backend: `python -m uvicorn backend.main:app --reload --reload-dir backend --port 8010` → http://localhost:8010/docs; health at `/api/health` and `/api/health/db`.
Worker: `python -m backend.worker` (dependency-check/idle scaffold); frontend in another terminal: `cd frontend` then `npm run dev` → http://localhost:5173.
Database: `python -m scripts.check_db --init` initializes Tiger Data PostgreSQL and runs `SELECT postgis_version();`; every laptop uses `DATABASE_URL`.
Gate: follow [the four-laptop checklist](docs/foundation.md); all four must pass backend/frontend/PostGIS checks and pull the foundation commit before product work. Hosting: [Railway API setup](docs/railway.md).
