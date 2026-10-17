"""The same SQL bootstrap and result writer serve local and hosted Postgres."""
from typing import Any
from uuid import UUID

import psycopg
from psycopg.types.json import Jsonb

from backend.config import DATA_VERSION, MODEL_VERSION, ROOT_DIR, settings


def connect():
    return psycopg.connect(settings.active_database_url, connect_timeout=5)


def ping_database() -> str:
    with connect() as connection:
        return connection.execute("SELECT postgis_version();").fetchone()[0]


def initialize_database() -> None:
    with connect() as connection:
        connection.execute((ROOT_DIR / "db/init/001_foundation.sql").read_text())


def save_result(payload: dict[str, Any]) -> UUID:
    """All results saved through this boundary carry both provenance versions."""
    with connect() as connection:
        row = connection.execute(
            """INSERT INTO saved_results (payload, model_version, data_version)
               VALUES (%s, %s, %s) RETURNING id""",
            (Jsonb(payload), MODEL_VERSION, DATA_VERSION),
        ).fetchone()
        return row[0]
