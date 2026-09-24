@echo off
setlocal
cd /d "%~dp0"
title Personal CRM - Start

where docker >nul 2>&1 || (echo Docker Desktop is required. & pause & exit /b 1)
docker info >nul 2>&1 || (echo Please start Docker Desktop first. & pause & exit /b 1)
if not exist ".env" copy /y ".env.example" ".env" >nul

echo Starting Personal CRM...
docker compose -f docker-compose.production.yml up -d
if errorlevel 1 (
  echo Could not start Personal CRM.
  pause
  exit /b 1
)
echo CRM is starting. Open http://127.0.0.1:5173/ in your browser.
pause
