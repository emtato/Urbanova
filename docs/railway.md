# Railway Express deployment

The root railway.json and server/railway.json both target the Lane C Express API. Keep Root Directory at the repository root. Railway builds server/Dockerfile, starts the API and worker scheduler together, and checks /health. Teammates do not need Docker installed locally.

Set backend-only Railway variables DATABASE_URL, GEMINI_API_KEY, GEMINI_MODEL and CORS_ORIGINS. Origins are a JSON array including the exact deployed frontend origin. The ignored local .env is not uploaded. The API listens on Railway PORT; local development defaults to 8010. Use the committed Node start command.

Startup applies the additive Tiger Data schema. Check /health, /api/health/db and /docs on the deployed domain. /docs serves the endpoint/run guide. A passing local smoke is not proof of a successful hosted deployment; verify Railway logs and the public health URL.

The Vite development proxy points to http://127.0.0.1:8010. Production frontend hosting needs its API URL or a host-level proxy plus the matching CORS origin. Database and Gemini keys never belong in VITE variables.

Python under backend/ remains the simulation/data implementation; uvicorn can still run its foundation endpoints locally. Express owns the Lane C routes and scheduler and computes real B11 results by default. See [Lane C](lane-c.md) for package assumptions and [the live workspace](live-analysis.md) for frontend settings and the deployment migration.

References: [Railway Dockerfiles](https://docs.railway.com/builds/dockerfiles), [configuration reference](https://docs.railway.com/config-as-code/reference).
