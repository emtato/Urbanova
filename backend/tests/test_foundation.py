import uuid
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from backend.config import DATA_VERSION, MODEL_VERSION, Settings
from backend.db import initialize_database, save_result
from backend.main import app


def test_hosted_connection_url_is_used():
    config = Settings(_env_file=None, database_url="postgresql://hosted:secret@remote/futureproof?sslmode=require")
    assert config.active_database_url == "postgresql://hosted:secret@remote/futureproof?sslmode=require"


def test_dotenv_loading_and_validation(tmp_path):
    env = tmp_path / ".env"
    env.write_text("DATABASE_URL=postgresql://user:secret@remote/db?sslmode=require\nSIM_RUNS=42\n")
    config = Settings(_env_file=env)
    assert config.sim_runs == 42
    assert "remote" in config.active_database_url
    with pytest.raises(ValidationError):
        Settings(_env_file=None, sim_runs=0)


@pytest.mark.parametrize("database_url", ["", None])
def test_missing_vultr_url_requests_configuration(database_url):
    config = Settings(_env_file=None, database_url=database_url)
    with pytest.raises(ValueError, match="Set DATABASE_URL"):
        _ = config.active_database_url


def test_health_and_database_failure_do_not_leak_secrets():
    client = TestClient(app)
    assert client.get("/api/health").json()["model_version"] == MODEL_VERSION
    with patch("backend.main.ping_database", return_value="3.5"):
        assert client.get("/api/health/db").json()["postgis_version"] == "3.5"
    with patch("backend.main.ping_database", side_effect=RuntimeError("secret-password")):
        response = client.get("/api/health/db")
        assert response.status_code == 503
        assert "secret-password" not in response.text


def test_database_initialization_loads_schema_from_any_working_directory(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    with patch("backend.db.connect") as connect:
        initialize_database()
    sql = connect.return_value.__enter__.return_value.execute.call_args.args[0]
    assert "CREATE EXTENSION IF NOT EXISTS postgis" in sql
    assert "CREATE TABLE IF NOT EXISTS saved_results" in sql


def test_result_writer_always_records_versions():
    connection = MagicMock()
    result_id = uuid.uuid4()
    connection.execute.return_value.fetchone.return_value = (result_id,)
    with patch("backend.db.connect") as connect:
        connect.return_value.__enter__.return_value = connection
        assert save_result({"test": True}) == result_id
    args = connection.execute.call_args.args
    assert args[1][1:] == (MODEL_VERSION, DATA_VERSION)


@pytest.mark.parametrize("origin", ["http://localhost:5173", "http://127.0.0.1:5173"])
def test_frontend_origin_can_call_hosted_api(origin):
    client = TestClient(app)
    response = client.options(
        "/api/health",
        headers={
            "Origin": origin,
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "Content-Type",
        },
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == origin
    assert "access-control-allow-credentials" not in response.headers


def test_unlisted_frontend_origin_is_rejected():
    client = TestClient(app)
    response = client.options(
        "/api/health",
        headers={
            "Origin": "https://unlisted.example",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert response.status_code == 400
    assert "access-control-allow-origin" not in response.headers
