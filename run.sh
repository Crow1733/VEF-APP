#!/usr/bin/env bash
# Arranca el servidor VEF en https://0.0.0.0:8765 y muestra las direcciones
# por las que se puede acceder desde esta PC y desde otros dispositivos de la red.
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PORT=8765

# ── Localiza el uvicorn del entorno virtual ──────────────────────────────────
# Soporta el venv que crea install.sh (dentro del proyecto) y el de esta PC
# (un nivel por encima del proyecto).
if [ -x "$SCRIPT_DIR/.venv/bin/uvicorn" ]; then
    UVICORN="$SCRIPT_DIR/.venv/bin/uvicorn"
elif [ -x "$SCRIPT_DIR/../.venv/bin/uvicorn" ]; then
    UVICORN="$SCRIPT_DIR/../.venv/bin/uvicorn"
else
    echo "ERROR: no se encontró el entorno virtual (.venv). Ejecuta ./install.sh primero." >&2
    exit 1
fi

# ── Muestra las direcciones de acceso ────────────────────────────────────────
echo "════════════════════════════════════════════════════════════"
echo "  VEF — servidor iniciando"
echo "════════════════════════════════════════════════════════════"
echo "  En esta misma PC:"
echo "    → https://localhost:$PORT"
echo ""
ips="$(ip -4 -o addr show scope global 2>/dev/null | awk '{print $4}' | cut -d/ -f1)"
if [ -n "$ips" ]; then
    echo "  Desde otro dispositivo en la MISMA red, conéctate a:"
    printf '%s\n' "$ips" | while IFS= read -r ip; do
        [ -n "$ip" ] && echo "    → https://$ip:$PORT"
    done
else
    echo "  (no se detectó IP de red local; solo habrá acceso local)"
fi
echo "════════════════════════════════════════════════════════════"
echo "  El navegador mostrará «No seguro» (certificado autofirmado):"
echo "  acepta la excepción. Detén el servidor con Ctrl+C."
echo "════════════════════════════════════════════════════════════"
echo ""

cd "$SCRIPT_DIR/backend"
exec "$UVICORN" main:app \
    --host 0.0.0.0 \
    --port "$PORT" \
    --ssl-keyfile "$SCRIPT_DIR/ssl/key.pem" \
    --ssl-certfile "$SCRIPT_DIR/ssl/cert.pem"
