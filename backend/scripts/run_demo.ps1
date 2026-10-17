param([switch]$CheckOnly)
$ErrorActionPreference='Stop'
$repoRoot=Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
Set-Location -LiteralPath $repoRoot
npm run build --prefix backend/server
if($LASTEXITCODE -ne 0){throw 'Backend build failed'}
$demoCheck=node backend/server/dist/backend/server/src/scripts/check-demo.js
if($LASTEXITCODE -ne 0){throw 'Demo cache/database check failed; run npm run pipeline --prefix backend/server first'}
Write-Output $demoCheck
$apiPort=($demoCheck | ConvertFrom-Json).port
if($CheckOnly){exit 0}
$logDirectory=Join-Path $repoRoot 'data/cache/demo'
New-Item -ItemType Directory -Force -Path $logDirectory | Out-Null
$apiProcess=$null
$webProcess=$null
try{
    $apiProcess=Start-Process -FilePath (Get-Command node.exe).Source -ArgumentList 'backend/server/dist/backend/server/src/index.js' -WorkingDirectory $repoRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logDirectory 'api.log') -RedirectStandardError (Join-Path $logDirectory 'api-error.log')
    $webProcess=Start-Process -FilePath (Get-Command node.exe).Source -ArgumentList 'node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5173 --strictPort' -WorkingDirectory (Join-Path $repoRoot 'frontend') -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logDirectory 'frontend.log') -RedirectStandardError (Join-Path $logDirectory 'frontend-error.log')
    $ready=$false
    for($attempt=0;$attempt -lt 30;$attempt++){
        if($apiProcess.HasExited -or $webProcess.HasExited){break}
        try{$health=Invoke-RestMethod "http://127.0.0.1:$apiPort/health" -TimeoutSec 2; if($health.status -eq 'ok'){$ready=$true;break}}catch{}
        Start-Sleep -Seconds 1
    }
    if(-not $ready){throw 'Backend did not become healthy; inspect data/cache/demo/api-error.log'}
    if($apiProcess.HasExited -or $webProcess.HasExited){throw 'A server exited; check data/cache/demo logs and existing port usage'}
    Start-Process 'http://localhost:5173/analysis'
    Write-Host 'Demo running. Keep this terminal open; Ctrl+C stops the launched processes. Frontend API target follows frontend/.env.local.'
    while(-not $apiProcess.HasExited -and -not $webProcess.HasExited){Start-Sleep -Seconds 1}
}finally{
    foreach($process in @($apiProcess,$webProcess)){if($null -ne $process -and -not $process.HasExited){Stop-Process -Id $process.Id}}
}
