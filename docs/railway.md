# Railway backend deployment
The API runs on Railway; PostgreSQL and PostGIS remain in Tiger Data.
The committed railway.json config uses Railpack, starts FastAPI on Railway's PORT, and checks /api/health.
.python-version selects Python 3.11. Local development continues on port 8010.

## Create the API service
1. Sign in at https://railway.com and choose New Project > Deploy from GitHub repo.
2. Select emtato/Urbanova and branch main. Keep Root Directory empty (the repository root).
   Root requirements.txt forwards to backend/requirements.txt; .python-version and railway.json stay at the root for discovery. The backend package and SQL schema live in backend/.
   Do not select backend/: it also contains the preserved Express starter.
3. In the service Variables tab, add DATABASE_URL using the Tiger Data URL from your private .env.
   Add GEMINI_API_KEY and set GEMINI_MODEL=gemini-3.8-flash for the verified Gemini integration.
   Railway does not receive the ignored .env file.
4. Set CORS_ORIGINS to a JSON array containing the exact frontend origins, for example:
   ["http://localhost:5173","http://127.0.0.1:5173","https://your-frontend.example"]
   Replace the example with the actual frontend origin, without a trailing slash or path.
   The default allows the two local Vite origins. CORS only controls browser access; it does not authenticate callers.
5. Deploy the service. Keep the start command from railway.json; do not use --reload in hosting.
6. Under Settings > Networking, click Generate Domain to obtain the public HTTPS API URL.
7. Check that <api-url>/api/health and <api-url>/api/health/db both return status ok.
   Interactive API documentation is at <api-url>/docs.

## Connect the frontend
The existing Vite development proxy points to the local backend on 8010.
When your frontend teammate connects to Railway, their API client must use the public HTTPS API URL
(or a frontend-host proxy); Vite's development proxy is not included in a production build.
Add the deployed frontend origin to CORS_ORIGINS and redeploy when its URL is known.
Database credentials and Gemini keys stay in Railway Variables, never frontend VITE_ variables.

## Database and worker
The Tiger Data schema was initialized from the development machine. For a new database, run
python -m backend.scripts.check_db --init from the repository root locally with that database's DATABASE_URL before deployment.
The API deployment does not automatically run schema changes.
This configuration deploys only the API. The current worker is a dependency-check/idle scaffold;
the eventual job-processing worker will require its own service and start command.
Runtime caches are disposable; persist results in Tiger Data.

References: [FastAPI on Railway](https://docs.railway.com/guides/fastapi),
[configuration](https://docs.railway.com/config-as-code/reference),
[Python versions](https://railpack.com/languages/python/).
