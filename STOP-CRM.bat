@echo off
setlocal
cd /d "%~dp0"
title Personal CRM - Stop

where docker >nul 2>&1 || (echo Docker Desktop is required. & pause & exit /b 1)
docker compose -f docker-compose.production.yml stop
if errorlevel 1 (
  echo Could not stop Personal CRM.
  pause
  exit /b 1
)
echo Personal CRM has been stopped. Your data remains safely stored in Docker.
pause
