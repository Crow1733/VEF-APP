#!/usr/bin/env bash
#
# install.sh — Instala y despliega el servicio VEF en una PC nueva.
#
# Qué hace:
#   1. Instala dependencias del sistema (Python, Node/npm, OpenSSL) según la distro.
#   2. Crea un entorno virtual de Python e instala los paquetes del backend.
#   3. Instala dependencias del frontend y genera el build de producción.
#   4. Genera un certificado SSL autofirmado si no existe.
#   5. Instala, habilita y arranca el servicio systemd (usuario) con arranque en boot.
#
# Uso:
#   chmod +x install.sh
#   ./install.sh
#
# No requiere ejecutarse como root: usa sudo solo para instalar paquetes del sistema.
# Idempotente: puedes volver a ejecutarlo sin romper nada.

set -euo pipefail

# ─────────────────────────────────────────────────────────────────────────────
# Rutas (se derivan de la ubicación de este script)
# ─────────────────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR"
BACKEND="$PROJECT_ROOT/backend"
FRONTEND="$PROJECT_ROOT/frontend"
VENV="$PROJECT_ROOT/.venv"
SSL_DIR="$PROJECT_ROOT/ssl"
PORT=8765
SERVICE_NAME="vef"

# ─────────────────────────────────────────────────────────────────────────────
# Utilidades de log
# ─────────────────────────────────────────────────────────────────────────────
c_blue='\033[1;34m'; c_green='\033[1;32m'; c_yellow='\033[1;33m'; c_red='\033[1;31m'; c_off='\033[0m'
step() { echo -e "\n${c_blue}==>${c_off} $*"; }
ok()   { echo -e "${c_green}  ✓${c_off} $*"; }
warn() { echo -e "${c_yellow}  !${c_off} $*"; }
die()  { echo -e "${c_red}  ✗ $*${c_off}" >&2; exit 1; }

# ─────────────────────────────────────────────────────────────────────────────
# 1. Dependencias del sistema
# ─────────────────────────────────────────────────────────────────────────────
install_system_deps() {
  step "Instalando dependencias del sistema (Python, Node, npm, OpenSSL)…"

  if command -v pacman >/dev/null 2>&1; then
    sudo pacman -Sy --needed --noconfirm python nodejs npm openssl
  elif command -v apt-get >/dev/null 2>&1; then
    sudo apt-get update
    sudo apt-get install -y python3 python3-venv python3-pip nodejs npm openssl
  elif command -v dnf >/dev/null 2>&1; then
    sudo dnf install -y python3 python3-pip nodejs npm openssl
  elif command -v zypper >/dev/null 2>&1; then
    sudo zypper install -y python3 python3-pip nodejs npm openssl
  else
    die "Gestor de paquetes no reconocido. Instala manualmente: python3, python3-venv, nodejs, npm, openssl."
  fi
  ok "Dependencias del sistema listas."
}

check_versions() {
  step "Verificando versiones…"
  command -v python3 >/dev/null || die "python3 no está disponible."
  command -v node    >/dev/null || die "node no está disponible."
  command -v npm     >/dev/null || die "npm no está disponible."
  command -v openssl >/dev/null || die "openssl no está disponible."

  local node_major
  node_major="$(node -v | sed 's/v\([0-9]*\).*/\1/')"
  if [ "$node_major" -lt 20 ]; then
    warn "Node $(node -v) detectado. Se recomienda Node 20 o superior para Vite."
  fi
  ok "python3 $(python3 --version | awk '{print $2}') · node $(node -v) · npm $(npm -v)"
}

# ─────────────────────────────────────────────────────────────────────────────
# 2. Backend: entorno virtual + paquetes
# ─────────────────────────────────────────────────────────────────────────────
setup_backend() {
  step "Configurando el backend (entorno virtual + dependencias Python)…"
  [ -d "$VENV" ] || python3 -m venv "$VENV"
  "$VENV/bin/pip" install --upgrade pip >/dev/null
  "$VENV/bin/pip" install -r "$BACKEND/requirements.txt"
  ok "Backend listo (venv en $VENV)."
}

# ─────────────────────────────────────────────────────────────────────────────
# 3. Frontend: dependencias + build de producción
# ─────────────────────────────────────────────────────────────────────────────
setup_frontend() {
  step "Compilando el frontend (npm install + build)…"
  ( cd "$FRONTEND" && npm install && npm run build )
  [ -f "$FRONTEND/dist/index.html" ] || die "El build del frontend falló (no se generó dist/index.html)."
  ok "Frontend compilado en $FRONTEND/dist."
}

# ─────────────────────────────────────────────────────────────────────────────
# 4. Certificado SSL autofirmado
# ─────────────────────────────────────────────────────────────────────────────
setup_ssl() {
  step "Preparando certificado SSL…"
  mkdir -p "$SSL_DIR"
  if [ -f "$SSL_DIR/cert.pem" ] && [ -f "$SSL_DIR/key.pem" ]; then
    ok "Ya existe un certificado en $SSL_DIR (se conserva)."
    return
  fi
  openssl req -x509 -newkey rsa:2048 -nodes \
    -keyout "$SSL_DIR/key.pem" -out "$SSL_DIR/cert.pem" \
    -days 3650 -subj "/CN=VEF" \
    -addext "subjectAltName=DNS:localhost,IP:127.0.0.1" 2>/dev/null
  chmod 600 "$SSL_DIR/key.pem"
  ok "Certificado autofirmado generado (válido 10 años)."
}

# ─────────────────────────────────────────────────────────────────────────────
# 5. Servicio systemd (usuario) con arranque en boot
# ─────────────────────────────────────────────────────────────────────────────
setup_service() {
  step "Instalando el servicio systemd de usuario…"
  local unit_dir="$HOME/.config/systemd/user"
  mkdir -p "$unit_dir"

  cat > "$unit_dir/${SERVICE_NAME}.service" <<EOF
[Unit]
Description=VEF App
After=network.target

[Service]
Type=simple
WorkingDirectory=$BACKEND
ExecStart=$VENV/bin/uvicorn main:app \\
    --host 0.0.0.0 \\
    --port $PORT \\
    --ssl-keyfile $SSL_DIR/key.pem \\
    --ssl-certfile $SSL_DIR/cert.pem
Restart=on-failure
RestartSec=5

[Install]
WantedBy=default.target
EOF

  # Permite que el servicio arranque en boot aunque el usuario no inicie sesión.
  loginctl enable-linger "$USER" 2>/dev/null || warn "No se pudo activar linger (el servicio arrancará al iniciar sesión)."

  systemctl --user daemon-reload
  systemctl --user enable "$SERVICE_NAME"
  systemctl --user restart "$SERVICE_NAME"
  sleep 2

  if systemctl --user is-active --quiet "$SERVICE_NAME"; then
    ok "Servicio '$SERVICE_NAME' activo y habilitado en boot."
  else
    warn "El servicio no quedó activo. Revisa: systemctl --user status $SERVICE_NAME"
  fi
}

# ─────────────────────────────────────────────────────────────────────────────
# Resumen final
# ─────────────────────────────────────────────────────────────────────────────
final_summary() {
  local ip
  ip="$(hostname -I 2>/dev/null | awk '{print $1}')"
  echo -e "\n${c_green}════════════════════════════════════════════════════════════${c_off}"
  echo -e "${c_green} VEF instalado y en ejecución${c_off}"
  echo -e "${c_green}════════════════════════════════════════════════════════════${c_off}"
  echo "  Local:      https://localhost:$PORT"
  [ -n "$ip" ] && echo "  En la red:  https://$ip:$PORT"
  echo ""
  echo "  Usuario inicial por defecto (si la base de datos se crea vacía):"
  echo "    admin / admin123   ·   caja / caja123"
  echo -e "    ${c_yellow}Cámbialas tras el primer inicio de sesión.${c_off}"
  echo ""
  echo "  Comandos útiles:"
  echo "    systemctl --user status $SERVICE_NAME     # estado"
  echo "    systemctl --user restart $SERVICE_NAME    # reiniciar"
  echo "    journalctl --user -u $SERVICE_NAME -f     # ver logs"
  echo ""
  echo -e "  ${c_yellow}Nota:${c_off} el certificado es autofirmado; el navegador mostrará"
  echo "  «No seguro». Acepta la excepción una vez por dispositivo."
  echo "  Si otros equipos no acceden, abre el puerto $PORT en el firewall."
}

# ─────────────────────────────────────────────────────────────────────────────
main() {
  echo -e "${c_blue}Instalador del servicio VEF${c_off}"
  echo "Proyecto: $PROJECT_ROOT"
  install_system_deps
  check_versions
  setup_backend
  setup_frontend
  setup_ssl
  setup_service
  final_summary
}

main "$@"
