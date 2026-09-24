@echo off
setlocal EnableExtensions
title Personal CRM - Installation
cd /d "%~dp0"

echo.
echo ========================================
echo       Personal CRM - Installation
echo ========================================
echo.

where docker >nul 2>&1
if errorlevel 1 (
  echo Docker was not found.
  echo Install Docker Desktop from https://www.docker.com/products/docker-desktop/
  pause
  exit /b 1
)

docker info >nul 2>&1
if errorlevel 1 (
  echo Docker Desktop is not running.
  echo Start Docker Desktop, wait until it says "Running", then run this file again.
  pause
  exit /b 1
)

for %%F in (docker-compose.production.yml .env.example backend\Dockerfile frontend\Dockerfile.production frontend\nginx.conf) do (
  if not exist "%%F" (
    echo Required file is missing: %%F
    pause
    exit /b 1
  )
)

if not exist ".env" (
  copy /y ".env.example" ".env" >nul
  if errorlevel 1 (
    echo Could not create .env.
    pause
    exit /b 1
  )
  echo Created local configuration file.
)

echo Building and starting CRM containers. The first installation may take several minutes.
docker compose -f docker-compose.production.yml up -d --build
if errorlevel 1 (
  echo Installation failed while starting the containers.
  echo Run STATUS-CRM.bat for more information.
  pause
  exit /b 1
)

call :wait_for_crm
if errorlevel 1 (
  echo CRM installation did not complete successfully.
  call :show_status
  pause
  exit /b 1
)

echo.
echo Installation completed successfully.
echo Open the CRM at: http://127.0.0.1:5173/
echo.
pause
exit /b 0

:wait_for_crm
set /a attempts=0
:wait_loop
set /a attempts+=1
for /f "delims=" %%S in ('docker compose -f docker-compose.production.yml ps --status running -q 2^>nul ^| find /c /v ""') do set running=%%S
if "%running%"=="3" (
  curl.exe --silent --fail --max-time 3 http://127.0.0.1:5173/ >nul 2>&1
  if not errorlevel 1 exit /b 0
)
if %attempts% GEQ 60 exit /b 1
echo Waiting for CRM services... (%attempts%/60)
timeout /t 5 /nobreak >nul
goto wait_loop

:show_status
docker compose -f docker-compose.production.yml ps
exit /b 0
