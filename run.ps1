# ============================================================================
#  run.ps1 - Arranca el servidor VEF en Windows y muestra las direcciones
#            por las que se puede acceder desde esta PC y desde la red.
# ============================================================================
$ProjectRoot = $PSScriptRoot
$Backend = Join-Path $ProjectRoot "backend"
$Venv    = Join-Path $ProjectRoot ".venv"
$Port    = 8765

$Uvicorn = Join-Path $Venv "Scripts\uvicorn.exe"
if (-not (Test-Path $Uvicorn)) {
    Write-Host "ERROR: no se encontró el entorno virtual. Ejecuta install.bat primero." -ForegroundColor Red
    Read-Host "Enter para salir"; exit 1
}

$Key  = Join-Path $ProjectRoot "ssl\key.pem"
$Cert = Join-Path $ProjectRoot "ssl\cert.pem"
if (-not (Test-Path $Key) -or -not (Test-Path $Cert)) {
    Write-Host "ERROR: falta el certificado SSL (ssl\cert.pem / key.pem). Ejecuta install.bat." -ForegroundColor Red
    Read-Host "Enter para salir"; exit 1
}

# --- Mostrar direcciones de acceso -----------------------------------------
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  VEF - servidor iniciando" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  En esta misma PC:"
Write-Host "    -> https://localhost:$Port"
Write-Host ""
$ips = Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } |
    Select-Object -ExpandProperty IPAddress
if ($ips) {
    Write-Host "  Desde otro dispositivo en la MISMA red, conectate a:"
    foreach ($ip in $ips) { Write-Host "    -> https://${ip}:$Port" }
} else {
    Write-Host "  (no se detecto IP de red local; solo habra acceso local)"
}
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  El navegador mostrara 'No seguro' (certificado autofirmado):"
Write-Host "  acepta la excepcion. Deten el servidor con Ctrl+C."
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

Set-Location $Backend
& $Uvicorn main:app --host 0.0.0.0 --port $Port --ssl-keyfile $Key --ssl-certfile $Cert
