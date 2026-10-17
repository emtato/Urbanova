"""Regenerate the bundled Today reference, never the user's simulation history.
Run from the repository root: .venv/bin/python backend/scripts/build_today_baseline.py
"""
import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from data.simulation_input import load_simulation_input
from backend.simulation import run_repeated_simulations

inputs = load_simulation_input(overrides={"developments": [], "seed": 42})
batch = run_repeated_simulations(inputs, run_count=3, seeds=[42, 43, 44], batch_id="today-2026-10-16-v1")
# The inspector needs inputs and native summaries, not individual passenger histories.
for run in batch["individual_results"]:
    run["passengers"] = []
    run["sim_log"] = []
    run["streetcars"] = []
    run["summary"] = {key: run["summary"][key] for key in ("overview", "by_stop", "contract")}
model_files = sorted((ROOT / "backend/simulation").rglob("*.py"))
model_hash = hashlib.sha256(b"".join(p.read_bytes() for p in model_files)).hexdigest()
record = {
    "version": 1, "serviceDate": "2026-10-16", "generatedAt": datetime.now(timezone.utc).isoformat(),
    "modelDigest": model_hash,
    "dataDigest": hashlib.sha256((ROOT / "data/reviewed/simulation_input.json").read_bytes()).hexdigest(),
    "batch": batch,
}
# Keep visual proposal choices independent of the no-proposal Today configuration.
catalog = json.loads((ROOT / "data/reviewed/simulation_input.json").read_text())["inputs"]["developments"]
(ROOT / "frontend/src/data/proposed_developments.json").write_text(json.dumps(catalog, indent=2) + "\n")
out = ROOT / "frontend/src/data/today_baseline.json"
out.write_text(json.dumps(record, separators=(",", ":")) + "\n")
print(f"Bundled Today reference: {batch['overall_results']['run_count']} runs, {out.stat().st_size} bytes")
