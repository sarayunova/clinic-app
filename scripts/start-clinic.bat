@echo off
setlocal enabledelayedexpansion
title LiVi Clinic & Maternity System - Desktop & LAN Bedside Server

cls
echo ===============================================================================
echo     LiVi CLINIC & MATERNITY SYSTEM - DESKTOP & LAN BEDSIDE SERVER (0.0.0.0)
echo ===============================================================================
echo.

:: 1. Verify Node.js availability
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js was not detected in PATH.
    echo Please install Node.js LTS from https://nodejs.org/ and re-run.
    pause
    exit /b 1
)

:: 2. Configure Host and Port
set HOST=0.0.0.0
set PORT=3080
if "%CLINIC_DATA_DIR%"=="" set CLINIC_DATA_DIR=data

:: 3. Detect and Display Local Network IPv4 Addresses for Bedside LAN Access
echo [INFO] Detecting LAN Bedside Access IP addresses...
echo.
echo -------------------------------------------------------------------------------
echo   BEDSIDE TABLET & LAN ACCESS URLS:
powershell -NoProfile -Command "Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.InterfaceAlias -notmatch 'Loopback' -and $_.IPAddress -notmatch '^169\.254\.' } | ForEach-Object { Write-Host ('   - http://' + $_.IPAddress + ':%PORT% (Bedside tablet / OPD room)') }"
echo   - http://localhost:%PORT% (This computer)
echo -------------------------------------------------------------------------------
echo.

:: 4. Launch browser after a short delay in background
start "" /b powershell -NoProfile -Command "Start-Sleep -Seconds 3; Start-Process 'http://localhost:%PORT%'"

:: 5. Start Server
echo [INFO] Starting LiVi Clinic server on %HOST%:%PORT%...
echo Press Ctrl+C in this console to stop the clinic server.
echo.

npx tsx server/index.ts

if %ERRORLEVEL% neq 0 (
    echo.
    echo [WARNING] Server stopped with error code %ERRORLEVEL%.
    pause
)
