#!/usr/bin/env bash
# Desarrollo: arranca backend (uvicorn :8765) y frontend (Vite dev :5173) juntos.
# El dev-server de Vite hace proxy de /api → :8765 (ver frontend/vite.config.ts).
# Abre http://localhost:5173
set -e
cd "$(dirname "$0")"

# Frontend: instala dependencias la primera vez.
if [ ! -d frontend/node_modules ]; then
  echo "Instalando dependencias del frontend..."
  ( cd frontend && npm install )
fi

( cd backend && exec ../.venv/bin/uvicorn main:app --host 0.0.0.0 --port 8765 --reload ) &
BACK=$!

( cd frontend && exec npm run dev ) &
FRONT=$!

trap 'kill $BACK $FRONT 2>/dev/null' EXIT INT TERM
echo "Backend  → http://localhost:8765  (PID $BACK)"
echo "Frontend → http://localhost:5173  (PID $FRONT)"
wait
