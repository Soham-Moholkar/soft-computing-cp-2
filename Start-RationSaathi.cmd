@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-local.ps1" %*
if errorlevel 1 (
  echo.
  echo SoftGraph could not start. Read the message above, then press any key to close.
  pause >nul
  exit /b 1
)
