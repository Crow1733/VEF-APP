#!/usr/bin/env bash
# Arranca el servidor VEF en https://0.0.0.0:8765
set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/backend"
exec ../../.venv/bin/uvicorn main:app \
    --host 0.0.0.0 \
    --port 8765 \
    --ssl-keyfile "$SCRIPT_DIR/ssl/key.pem" \
    --ssl-certfile "$SCRIPT_DIR/ssl/cert.pem"
