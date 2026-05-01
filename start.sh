#!/bin/bash

# ── Churn Intelligence Dashboard — Local Runner ────────────────────────────────

ROOT="$(cd "$(dirname "$0")" && pwd)"

echo ""
echo "============================================================"
echo "  CHURN INTELLIGENCE DASHBOARD"
echo "============================================================"

# ── Check Node.js ──────────────────────────────────────────────────────────────
if ! command -v node &>/dev/null; then
  echo "[ERROR] Node.js not found. Install from https://nodejs.org"
  exit 1
fi

# ── Check Python ───────────────────────────────────────────────────────────────
PYTHON=$(command -v python3 || command -v python)
if [ -z "$PYTHON" ]; then
  echo "[ERROR] Python not found."
  exit 1
fi

# ── Check required output files exist ─────────────────────────────────────────
if [ ! -f "$ROOT/outputs/results/summary_stats.json" ]; then
  echo ""
  echo "[WARNING] Pipeline outputs not found."
  echo "  Run the ML pipeline first:"
  echo "    python main.py"
  echo ""
fi

# ── Install API deps if needed ─────────────────────────────────────────────────
echo ""
echo "[1/3] Checking API dependencies..."
$PYTHON -m pip install -q fastapi "uvicorn[standard]" pandas numpy aiofiles

# ── Install UI deps if needed ──────────────────────────────────────────────────
echo "[2/3] Checking UI dependencies..."
if [ ! -d "$ROOT/ui/node_modules" ]; then
  echo "  Running npm install..."
  cd "$ROOT/ui" && npm install --silent
  cd "$ROOT"
fi

# ── Start API server ───────────────────────────────────────────────────────────
echo "[3/3] Starting services..."
echo ""
echo "  API  →  http://localhost:8000"
echo "  UI   →  http://localhost:5173"
echo ""
echo "  Press Ctrl+C to stop both."
echo "============================================================"
echo ""

# Kill any existing processes on the ports
lsof -ti :8000 | xargs kill -9 2>/dev/null
lsof -ti :5173 | xargs kill -9 2>/dev/null

# Start API in background
$PYTHON -m uvicorn api.main:app --port 8000 --reload &
API_PID=$!

# Start UI in background
cd "$ROOT/ui" && npm run dev -- --port 5173 &
UI_PID=$!
cd "$ROOT"

# ── Wait and clean up on Ctrl+C ───────────────────────────────────────────────
trap "echo ''; echo 'Stopping...'; kill $API_PID $UI_PID 2>/dev/null; exit 0" SIGINT SIGTERM

wait $API_PID $UI_PID
