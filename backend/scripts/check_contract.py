"""Validate the fixture and detect drift in JSON Schema and TypeScript copies.

Run --write after intentional contract/fixture edits, then run frontend npm run build.
The TS copy uses `satisfies Comparison`, so compilation checks the JSON values too.
"""
import argparse
import json

from backend.config import ROOT_DIR
from backend.schemas import Comparison

FIXTURE_PATH = ROOT_DIR / "data/fixtures/sample_comparison.json"
SCHEMA_PATH = ROOT_DIR / "data/contracts/comparison.schema.json"
TYPESCRIPT_PATH = ROOT_DIR / "frontend/src/lib/sampleComparison.ts"


def artifacts() -> dict:
    text = FIXTURE_PATH.read_text(encoding="utf-8")
    Comparison.model_validate_json(text)
    payload = json.dumps(json.loads(text), indent=2, ensure_ascii=False)
    return {
        SCHEMA_PATH: json.dumps(Comparison.model_json_schema(), indent=2) + "\n",
        TYPESCRIPT_PATH: (
            '// Generated from data/fixtures/sample_comparison.json; do not edit.\n'
            'import type { Comparison } from "./types"\n\n'
            'export const sampleComparison = ' + payload + ' satisfies Comparison\n'
        ),
    }


def check_contract(*, write: bool = False) -> None:
    for path, expected in artifacts().items():
        if write:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(expected, encoding="utf-8")
        elif not path.exists() or path.read_text(encoding="utf-8") != expected:
            raise ValueError(f"Contract drift in {path.relative_to(ROOT_DIR)}; run python -m backend.scripts.check_contract --write")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--write", action="store_true")
    args = parser.parse_args()
    check_contract(write=args.write)
    print("Contract 1.0.0: fixture, references, replay accounting and generated artifacts passed.")


if __name__ == "__main__":
    main()
