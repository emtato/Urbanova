#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
command -v node >/dev/null || { echo "Install Node.js 22.12+ (24 LTS recommended)."; exit 1; }
command -v npm >/dev/null || { echo "Install npm."; exit 1; }
if command -v py >/dev/null 2>&1; then
  python_cmd=(py -3.11)
else
  python_cmd=(python3.11)
fi
"${python_cmd[@]}" -c 'import sys; assert sys.version_info[:2] == (3, 11), "Use Python 3.11"'
if [[ ! -d .venv ]]; then
  "${python_cmd[@]}" -m venv .venv
fi
if [[ -f .venv/Scripts/python.exe ]]; then
  venv_python=.venv/Scripts/python.exe
else
  venv_python=.venv/bin/python
fi
[[ -f .env ]] || cp .env.example .env
"$venv_python" -m pip install -r requirements.txt
(cd frontend && npm ci)
mkdir -p data/cache data/raw
offline=$("$venv_python" -c 'from backend.config import settings; print(str(settings.offline or settings.database_url is None).lower())')
if [[ "$offline" == true ]]; then
  command -v docker >/dev/null || { echo "Install/start Docker Desktop, then rerun setup."; exit 1; }
  docker compose up -d --wait db
fi
"$venv_python" -m scripts.check_db --init
echo "Setup passed. See README.md for the three startup commands."
