#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo "📦 Installing frontend dependencies..."
npm install

echo "🐍 Setting up backend virtualenv and dependencies..."
python3 -m venv backend/.venv
source backend/.venv/bin/activate
pip install -r backend/requirements.txt

echo "✅ Installation complete."
echo "   You can now run ./scripts/dev.sh to start backend + frontend for local development."

