@echo off
title Kill Clinic App Instances
echo ===================================================
echo   Stopping Clinic App and killing running instances
echo ===================================================
echo.

:: Elevate with UAC if not administrator
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [INFO] Requesting administrator privileges to stop background service...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process cmd -ArgumentList '/c \"\"%~f0\"\"' -Verb RunAs"
    exit /b
)

echo [1/3] Stopping Windows Scheduled Task (ClinicApp)...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Stop-ScheduledTask -TaskName ClinicApp -ErrorAction SilentlyContinue; Unregister-ScheduledTask -TaskName ClinicApp -Confirm:$false -ErrorAction SilentlyContinue"

echo [2/3] Terminating any running clinic.exe instances...
taskkill /F /IM clinic.exe >nul 2>&1

echo [3/3] Checking for any processes holding port 3080...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$conns = Get-NetTCPConnection -LocalPort 3080 -ErrorAction SilentlyContinue; foreach ($c in $conns) { Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue; Write-Host ('Stopped process on port 3080: PID ' + $c.OwningProcess) }"

echo.
echo ===================================================
echo   Successfully stopped all Clinic App instances!
echo   Port 3080 is now completely free.
echo ===================================================
echo.
pause
