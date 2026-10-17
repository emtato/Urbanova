"""Foundation endpoints and the explicitly labelled Phase 01 contract fixture."""
from pathlib import Path

from fastapi import Response
from fastapi import FastAPI
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from backend.config import DATA_VERSION, MODEL_VERSION, settings
from backend.db import ping_database
from backend.schemas import Comparison

app = FastAPI(title="FutureProof", version=MODEL_VERSION)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Content-Type", "Authorization"],
)


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


@app.get("/api/fixtures/sample-comparison", response_model=Comparison, tags=["fixtures"])
def sample_comparison(response: Response):
    """Synthetic integration fixture; never a computed scenario or stored result."""
    path = Path(__file__).resolve().parents[1] / "data/fixtures/sample_comparison.json"
    comparison = Comparison.model_validate_json(path.read_text(encoding="utf-8"))
    if not comparison.fixture:
        raise ValueError("The fixture endpoint requires fixture=true")
    response.headers["X-FutureProof-Fixture"] = "true"
    return comparison
