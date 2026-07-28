@echo off
title PDS Portal Remote Access
echo ========================================================
echo   PDS Portal Remote Access (100%% FREE)
echo ========================================================
echo.

netstat -ano | findstr :3000 >nul 2>&1
if %errorlevel% neq 0 (
    echo [1/2] Starting local PDS Server on port 3000...
    start /min "PDS Local Server" node server.js
    timeout /t 3 /nobreak >nul
) else (
    echo [1/2] Local PDS Server is already running.
)

echo [2/2] Launching Secure Cloudflare Tunnel...
echo.
"%~dp0cloudflared.exe" tunnel --url http://localhost:3000
pause
