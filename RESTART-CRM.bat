@echo off
setlocal
cd /d "%~dp0"
title Personal CRM - Restart

where docker >nul 2>&1 || (echo Docker Desktop is required. & pause & exit /b 1)
docker info >nul 2>&1 || (echo Please start Docker Desktop first. & pause & exit /b 1)
echo Restarting Personal CRM...
docker compose -f docker-compose.production.yml restart
if errorlevel 1 (
  echo Could not restart Personal CRM.
  pause
  exit /b 1
)
echo CRM restarted. Open http://127.0.0.1:5173/
pause
