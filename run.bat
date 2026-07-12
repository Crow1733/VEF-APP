@echo off
REM ==========================================================================
REM  run.bat - Arranca el servidor VEF (doble clic para iniciarlo).
REM  Muestra la direccion https://... para conectarte desde la red.
REM ==========================================================================
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0run.ps1"
pause
