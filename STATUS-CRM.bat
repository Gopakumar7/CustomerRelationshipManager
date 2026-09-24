@echo off
setlocal
cd /d "%~dp0"
title Personal CRM - Status

where docker >nul 2>&1 || (echo Docker Desktop is required. & pause & exit /b 1)
docker info >nul 2>&1 || (echo Docker Desktop is not running. & pause & exit /b 1)
echo.
echo Personal CRM service status:
docker compose -f docker-compose.production.yml ps
echo.
curl.exe --silent --fail --max-time 5 http://127.0.0.1:5173/ >nul 2>&1
if errorlevel 1 (
  echo CRM web page is not responding.
) else (
  echo CRM is running: http://127.0.0.1:5173/
)
echo.
pause
