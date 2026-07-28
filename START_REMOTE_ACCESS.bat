@echo off
title Start PDS Portal Remote Access
echo ========================================================
echo   PDS Portal Remote Access (100%% FREE)
echo ========================================================
echo.
echo Select URL mode:
echo   [1] Cloudflare Quick Tunnel (Recommended — Fast & Reliable)
echo   [2] Custom Subdomain Name
echo.
set /p mode="Enter choice (1 or 2): "

if "%mode%"=="2" (
    set /p sub="Enter custom name (just the name, e.g. pds-betul): "
    echo.
    echo Launching LocalTunnel...
    npx localtunnel --port 3000 --subdomain pds-betul
) else (
    echo.
    echo Launching Cloudflare Tunnel...
    cloudflared.exe tunnel --url http://localhost:3000
)
pause
