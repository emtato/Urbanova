"""Initialize the hosted PostgreSQL schema, then run the PostGIS gate query."""
import argparse

from backend.config import settings
from backend.db import initialize_database, ping_database


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--init", action="store_true")
    args = parser.parse_args()
    if settings.database_url is None:
        raise SystemExit("Set DATABASE_URL in the root .env to your hosted PostgreSQL connection URL.")
    try:
        if args.init:
            initialize_database()
        version = ping_database()
    except Exception:
        raise SystemExit(
            "hosted PostgreSQL check failed. Verify DATABASE_URL, network access, and sslmode=require. "
            "The database account needs permission to create tables and enable PostGIS."
        )
    print(f"SELECT postgis_version(); => {version}")


if __name__ == "__main__":
    main()
