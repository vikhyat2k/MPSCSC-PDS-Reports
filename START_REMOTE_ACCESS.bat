@echo off
title Start PDS Portal Remote Access with Custom URL
echo ========================================================
echo   PDS Portal Remote Access (100%% FREE)
echo ========================================================
echo.
echo Select URL mode:
echo   [1] Cloudflare Quick Tunnel (Random secure URL)
echo   [2] Custom Subdomain (e.g. https://pds-betul.loca.lt)
echo.
set /p mode="Enter choice (1 or 2): "

if "%mode%"=="2" (
    set /p sub="Enter your preferred custom subdomain name (e.g. pds-betul): "
    echo.
    echo Starting tunnel at https://%sub%.loca.lt ...
    npx localtunnel --port 3000 --subdomain %sub%
) else (
    echo.
    echo Launching Cloudflare Tunnel...
    cloudflared.exe tunnel --url http://localhost:3000
)
pause
