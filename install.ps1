# ============================================================================
#  install.ps1 - Instalador de VEF para Windows (nativo)
#
#  Qué hace:
#    1. Instala Python y Node.js si faltan (vía winget).
#    2. Crea el entorno virtual de Python e instala las dependencias.
#    3. Instala dependencias del frontend y genera el build de producción.
#    4. Genera un certificado SSL autofirmado (sin OpenSSL).
#    5. Abre el puerto 8765 en el Firewall de Windows.
#    6. Crea una tarea programada para arrancar la app al iniciar sesión.
#
#  Uso: clic derecho en install.bat -> "Ejecutar como administrador".
#       (o en PowerShell admin:  ./install.ps1)
# ============================================================================
$ErrorActionPreference = "Stop"

$ProjectRoot = $PSScriptRoot
$Backend  = Join-Path $ProjectRoot "backend"
$Frontend = Join-Path $ProjectRoot "frontend"
$Venv     = Join-Path $ProjectRoot ".venv"
$Port     = 8765

function Info($m) { Write-Host "`n==> $m" -ForegroundColor Cyan }
function Ok($m)   { Write-Host "  OK  $m" -ForegroundColor Green }
function Warn($m) { Write-Host "  !   $m" -ForegroundColor Yellow }
function Die($m)  { Write-Host "  X   $m" -ForegroundColor Red; Read-Host "Enter para salir"; exit 1 }

function Refresh-Path {
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" +
                [System.Environment]::GetEnvironmentVariable("Path","User")
}

$IsAdmin = ([Security.Principal.WindowsPrincipal] `
    [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
    [Security.Principal.WindowsBuiltInRole]::Administrator)

Write-Host "Instalador de VEF (Windows) - Proyecto: $ProjectRoot"

# --- 1. Python y Node -------------------------------------------------------
Info "Verificando Python y Node.js..."
if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
    Warn "winget no está disponible. Instala manualmente Python 3.12 y Node.js LTS,"
    Warn "luego vuelve a ejecutar este script."
}

if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    Info "Instalando Python..."
    winget install -e --id Python.Python.3.12 --accept-source-agreements --accept-package-agreements
    Refresh-Path
}
if (-not (Get-Command python -ErrorAction SilentlyContinue)) { Die "No se encontró Python tras instalar. Reinicia la terminal y reintenta." }
Ok "Python $(python --version)"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Info "Instalando Node.js LTS..."
    winget install -e --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
    Refresh-Path
}
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Die "No se encontró Node tras instalar. Reinicia la terminal y reintenta." }
Ok "Node $(node --version)"

# --- 2. Backend: venv + dependencias ---------------------------------------
Info "Creando entorno virtual e instalando dependencias del backend..."
if (-not (Test-Path $Venv)) { python -m venv $Venv }
$Py  = Join-Path $Venv "Scripts\python.exe"
& $Py -m pip install --upgrade pip | Out-Null
& $Py -m pip install -r (Join-Path $Backend "requirements.txt")
& $Py -m pip install cryptography   # para generar el certificado SSL
Ok "Backend listo."

# --- 3. Frontend: build -----------------------------------------------------
Info "Compilando el frontend (npm install + build)..."
Push-Location $Frontend
& npm.cmd install
& npm.cmd run build
Pop-Location
if (-not (Test-Path (Join-Path $Frontend "dist\index.html"))) { Die "El build del frontend falló." }
Ok "Frontend compilado."

# --- 4. Certificado SSL -----------------------------------------------------
Info "Generando certificado SSL autofirmado..."
& $Py (Join-Path $ProjectRoot "gen_cert.py")
Ok "Certificado listo."

# --- 5. Firewall ------------------------------------------------------------
Info "Abriendo el puerto $Port en el Firewall de Windows..."
if ($IsAdmin) {
    if (-not (Get-NetFirewallRule -DisplayName "VEF" -ErrorAction SilentlyContinue)) {
        New-NetFirewallRule -DisplayName "VEF" -Direction Inbound -LocalPort $Port `
            -Protocol TCP -Action Allow -Profile Any | Out-Null
    }
    Ok "Regla de firewall 'VEF' activa (puerto $Port)."
} else {
    Warn "No estás como administrador: no pude crear la regla de firewall."
    Warn "Otros dispositivos de la red no accederán hasta que abras el puerto $Port."
}

# --- 6. Autoarranque (tarea programada) -------------------------------------
Info "Configurando el arranque automático..."
$runPs1 = Join-Path $ProjectRoot "run.ps1"
if ($IsAdmin) {
    $action  = New-ScheduledTaskAction -Execute "powershell.exe" `
        -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$runPs1`""
    $trigger = New-ScheduledTaskTrigger -AtLogOn
    $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
    Register-ScheduledTask -TaskName "VEF" -Action $action -Trigger $trigger `
        -Settings $settings -RunLevel Highest -Force | Out-Null
    Ok "Tarea 'VEF' creada: la app arrancará al iniciar sesión."
} else {
    Warn "No estás como administrador: no pude crear la tarea de autoarranque."
    Warn "Podrás arrancar la app manualmente con run.bat."
}

# --- Resumen ----------------------------------------------------------------
Write-Host "`n============================================================" -ForegroundColor Green
Write-Host " VEF instalado" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host "  IMPORTANTE: copia tu base de datos real a:"
Write-Host "     $Backend\vef.db" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Luego arranca la app con:  run.bat  (doble clic)"
Write-Host "  Se abrirá y te mostrará la direccion https://... para conectarte."
Write-Host ""
Read-Host "Enter para salir"
