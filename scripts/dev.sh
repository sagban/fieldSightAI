#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")/.."

cleanup() {
  echo ""
  echo "🛑 Stopping dev servers..."
  pids=$(jobs -p || true)
  if [ -n "${pids}" ]; then
    kill -TERM ${pids} 2>/dev/null || true
    sleep 2
    kill -KILL ${pids} 2>/dev/null || true
  fi
  # extra safety: kill uvicorn on 8000 if still running
  lsof -ti:8000 | xargs kill -9 2>/dev/null || true
  exit
}

trap cleanup SIGINT SIGTERM

echo "🔧 Starting FieldSight AI dev environment..."

if [ ! -f ".env.local" ] && [ -f ".env.example" ]; then
  echo "⚠️  .env.local not found. Copying from .env.example..."
  cp .env.example .env.local
  echo "   Please update .env.local with your keys and project IDs."
fi

echo "📦 Ensuring frontend deps are installed..."
npm install

echo "🐍 Ensuring backend venv + deps..."
if [ ! -d "backend/.venv" ]; then
  python3 -m venv backend/.venv
fi
source backend/.venv/bin/activate
pip install -r backend/requirements.txt

echo "🚀 Starting backend (Uvicorn, port 8000)..."
uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!

echo "🎨 Starting frontend (Vite, port 3000)..."
npm run dev &
FRONTEND_PID=$!

wait $BACKEND_PID $FRONTEND_PID

