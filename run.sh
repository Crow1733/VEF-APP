#!/usr/bin/env bash
# Arranca el servidor VEF en http://localhost:8765
set -e
cd "$(dirname "$0")/backend"
exec ../../.venv/bin/uvicorn main:app --host 0.0.0.0 --port 8765 --reload
