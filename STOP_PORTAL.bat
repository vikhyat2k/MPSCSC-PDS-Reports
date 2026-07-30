@echo off
title Stop PDS Report Server
cd /d "%~dp0"

echo ========================================
echo   Stopping PDS Report Server
echo ========================================
echo.

taskkill /F /IM node.exe /T >nul 2>&1

if %ERRORLEVEL% EQU 0 (
    echo Server stopped successfully!
) else (
    echo No active PDS server instance was running.
)

echo.
pause
