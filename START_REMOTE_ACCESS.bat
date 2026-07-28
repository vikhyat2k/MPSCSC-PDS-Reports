@echo off
title PDS Portal Remote Access
echo ========================================================
echo   PDS Portal Remote Access (100%% FREE)
echo ========================================================
echo.

echo [1/2] Starting PDS Server on port 3000...
taskkill /F /IM node.exe >nul 2>&1
timeout /t 1 /nobreak >nul
start /min "PDS Local Server" cmd /c "node server.js"
echo     Waiting for server to start...
timeout /t 4 /nobreak >nul

echo [2/2] Launching Secure Cloudflare Tunnel...
echo.
"%~dp0cloudflared.exe" tunnel --url http://127.0.0.1:3000
pause
