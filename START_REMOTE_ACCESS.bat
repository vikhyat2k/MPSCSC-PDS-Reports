@echo off
title PDS Portal Remote Access
echo ========================================================
echo   PDS Portal Remote Access (100%% FREE)
echo ========================================================
echo.
echo Launching Secure Cloudflare Tunnel...
echo.
"%~dp0cloudflared.exe" tunnel --url http://localhost:3000
pause
