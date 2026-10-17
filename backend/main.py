"""Foundation endpoints only; product routes follow the four-laptop gate."""
from fastapi import FastAPI
from fastapi.responses import JSONResponse

from backend.config import DATA_VERSION, MODEL_VERSION
from backend.db import ping_database

app = FastAPI(title="FutureProof", version=MODEL_VERSION)


@app.get("/")
def root():
    return {"service": "FutureProof", "docs": "/docs"}


@app.get("/api/health")
def health():
    return {"status": "ok", "model_version": MODEL_VERSION, "data_version": DATA_VERSION}


@app.get("/api/health/db")
def database_health():
    try:
        return {"status": "ok", "postgis_version": ping_database()}
    except Exception:
        # Database errors may include credentials: keep them out of responses.
        return JSONResponse(status_code=503, content={"status": "unavailable"})
