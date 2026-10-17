$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
function Confirm-Exit {
    if ($LASTEXITCODE -ne 0) { throw "Command failed with exit code $LASTEXITCODE" }
}
node --version
Confirm-Exit
if (-not (Test-Path .venv)) {
    py -3.11 -m venv .venv
    Confirm-Exit
}
$venvPython = Join-Path $PWD '.venv/Scripts/python.exe'
& $venvPython -c 'import sys; assert sys.version_info[:2] == (3, 11)'
Confirm-Exit
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
& $venvPython -m pip install -r requirements.txt
Confirm-Exit
Push-Location frontend
try { npm ci; Confirm-Exit } finally { Pop-Location }
New-Item -ItemType Directory -Force data/cache,data/raw | Out-Null
$useLocal = & $venvPython -c 'from backend.config import settings; print(str(settings.offline or settings.database_url is None).lower())'
Confirm-Exit
if ($useLocal -eq 'true') {
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        throw 'Install/start Docker Desktop, then rerun setup.'
    }
    docker compose up -d --wait db
    Confirm-Exit
}
& $venvPython -m scripts.check_db --init
Confirm-Exit
Write-Host 'Setup passed. See README.md for the three startup commands.'
