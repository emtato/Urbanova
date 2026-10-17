"""Initialize either database with the shared schema, then run the gate query."""
import argparse

from backend.db import initialize_database, ping_database


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--init", action="store_true")
    args = parser.parse_args()
    try:
        if args.init:
            initialize_database()
        version = ping_database()
    except Exception:
        raise SystemExit(
            "Database check failed. Start Docker/PostGIS or check DATABASE_URL and OFFLINE. "
            "Hosted databases need permission to create the PostGIS extension."
        )
    print(f"SELECT postgis_version(); => {version}")


if __name__ == "__main__":
    main()
