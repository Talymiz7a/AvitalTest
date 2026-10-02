#!/usr/bin/env bash
# Starts the backend (http://127.0.0.1:8000) and the app (http://localhost:5173) together.
set -euo pipefail
cd "$(dirname "$0")"
UV="$(command -v uv || echo "$HOME/.local/bin/uv")"

[ -d frontend/node_modules ] || (cd frontend && npm install)

(cd backend && "$UV" run uvicorn app.main:app --reload --port 8000) &
BACKEND=$!
trap 'kill $BACKEND 2>/dev/null' EXIT

cd frontend && npm run dev -- --open
