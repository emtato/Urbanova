"""Phase 01 access check: PostGIS plus one validated Gemini structured response."""
import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal

from pydantic import BaseModel

from backend.config import ROOT_DIR, settings
from backend.db import ping_database


class AccessProbe(BaseModel):
    status: Literal["ok"]
    origin: Literal["futureproof-access-check"]


def check_access(*, skip_gemini: bool = False) -> dict:
    report = {"checked_at": datetime.now(timezone.utc).isoformat()}
    try:
        report["database"] = {"status": "ok", "postgis_version": ping_database()}
    except Exception:
        report["database"] = {"status": "failed", "reason": "Check DATABASE_URL, network access and PostGIS."}
    if skip_gemini:
        report["gemini"] = {"status": "skipped", "reason": "Explicit --skip-gemini; Phase 01 access gate remains pending."}
    elif not settings.gemini_api_key.get_secret_value():
        report["gemini"] = {"status": "not_configured", "reason": "Set GEMINI_API_KEY in the root .env, then rerun."}
    else:
        from google import genai
        from google.genai import types

        try:
            client = genai.Client(
                api_key=settings.gemini_api_key.get_secret_value(),
                http_options=types.HttpOptions(timeout=15000),
            )
            response = client.models.generate_content(
                model=settings.gemini_model,
                contents='Return status "ok" and origin "futureproof-access-check". This is a connectivity test.',
                config=types.GenerateContentConfig(
                    response_mime_type="application/json", response_schema=AccessProbe,
                    temperature=0,
                ),
            )
            probe = AccessProbe.model_validate_json(response.text)
            report["gemini"] = {"status": "ok", "model": settings.gemini_model, "response": probe.model_dump()}
        except Exception:
            # SDK errors may contain request credentials or provider response data.
            report["gemini"] = {"status": "failed", "model": settings.gemini_model,
                                "reason": "Check Gemini credentials, model access, quota and network."}
    report["gate_passed"] = all(report[key]["status"] == "ok" for key in ("database", "gemini"))
    return report


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--skip-gemini", action="store_true")
    parser.add_argument("--output", type=Path, default=ROOT_DIR / "data/reviewed/access_check.json")
    args = parser.parse_args()
    report = check_access(skip_gemini=args.skip_gemini)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))
    raise SystemExit(0 if report["gate_passed"] else 1)


if __name__ == "__main__":
    main()
