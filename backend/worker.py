"""Worker bootstrap; simulation/job processing is intentionally not implemented."""
import argparse
import logging
import time

from backend.config import DATA_VERSION, MODEL_VERSION
from backend.db import ping_database


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--once", action="store_true", help="Check dependencies and exit")
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO)
    logging.info("Worker bootstrap: model=%s data=%s", MODEL_VERSION, DATA_VERSION)
    try:
        ping_database()
    except Exception:
        raise SystemExit("Database check failed. Run setup and verify OFFLINE/database URL.")
    logging.info("PostGIS reachable. Waiting for the future job processor.")
    if not args.once:
        try:
            while True:
                time.sleep(30)
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    main()
