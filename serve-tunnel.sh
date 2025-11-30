#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-3000}"

cleanup() {
  if [[ -n "${SERVE_PID:-}" ]]; then
    kill "$SERVE_PID" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

echo ">> Starting local server on http://127.0.0.1:${PORT}"
npx serve . --listen "$PORT" &
SERVE_PID=$!
sleep 1

echo ">> Starting Cloudflare quick tunnel to http://127.0.0.1:${PORT}"
cloudflared tunnel --url "http://127.0.0.1:${PORT}"
