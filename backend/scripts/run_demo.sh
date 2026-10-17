#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.."
npm run build --prefix backend/server
demo_check="$(node backend/server/dist/backend/server/src/scripts/check-demo.js)"
echo "$demo_check"
api_port="$(node -p 'JSON.parse(process.argv[1]).port' "$demo_check")"
[[ "${1:-}" != "--check-only" ]] || exit 0
mkdir -p data/cache/demo
api_pid=''; web_pid=''
cleanup() { [[ -z "$api_pid" ]] || kill "$api_pid" 2>/dev/null || true; [[ -z "$web_pid" ]] || kill "$web_pid" 2>/dev/null || true; }
trap cleanup EXIT INT TERM
node backend/server/dist/backend/server/src/index.js >data/cache/demo/api.log 2>data/cache/demo/api-error.log & api_pid=$!
(cd frontend && exec node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5173 --strictPort) >data/cache/demo/frontend.log 2>data/cache/demo/frontend-error.log & web_pid=$!
node --input-type=module -e 'const port=Number(process.argv[1]); const end=Date.now()+30000; let ready=false; while(Date.now()<end){try{const r=await fetch(`http://127.0.0.1:${port}/health`,{signal:AbortSignal.timeout(2000)});if(r.ok){ready=true;break;}}catch{} await new Promise(r=>setTimeout(r,1000));}if(!ready){console.error("API did not become healthy; inspect data/cache/demo logs.");process.exit(1);}' "$api_port"
kill -0 "$api_pid" "$web_pid" || { echo 'Server exited; inspect data/cache/demo logs and existing ports.'; exit 1; }
if command -v open >/dev/null; then open http://localhost:5173/analysis; elif command -v xdg-open >/dev/null; then xdg-open http://localhost:5173/analysis; else echo 'Open http://localhost:5173/analysis'; fi
echo 'Demo running. Ctrl+C stops the launched processes. API target follows frontend/.env.local.'
wait "$api_pid" "$web_pid"
