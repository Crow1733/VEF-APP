@echo off
REM ==========================================================================
REM  install.bat - Instala VEF en Windows. Pide permisos de administrador
REM  (necesarios para el firewall y el arranque automatico) y ejecuta install.ps1
REM ==========================================================================
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo Solicitando permisos de administrador...
    powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1"
