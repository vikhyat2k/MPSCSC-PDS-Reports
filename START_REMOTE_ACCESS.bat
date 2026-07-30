@echo off
title PDS Portal Remote Access
cd /d "%~dp0"

echo ========================================================
echo   PDS Portal Remote Access (100%% FREE)
echo ========================================================
echo.

:: Resolve Node.js path if not in environment PATH
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" (
        set "PATH=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;%PATH%"
    ) else if exist "%ProgramFiles%\nodejs\node.exe" (
        set "PATH=%ProgramFiles%\nodejs;%PATH%"
    ) else if exist "%ProgramFiles(x86)%\nodejs\node.exe" (
        set "PATH=%ProgramFiles(x86)%\nodejs;%PATH%"
    ) else if exist "%LOCALAPPDATA%\Programs\node\node.exe" (
        set "PATH=%LOCALAPPDATA%\Programs\node;%PATH%"
    )
)

echo [1/2] Starting PDS Server on port 3000...
taskkill /F /IM node.exe >nul 2>&1
timeout /t 1 /nobreak >nul
start /min "PDS Local Server" cmd /c "cd /d "%~dp0" && node server.js"
echo     Waiting for server to start...
timeout /t 4 /nobreak >nul

echo [2/2] Launching Secure Cloudflare Tunnel...
echo.
"%~dp0cloudflared.exe" tunnel --url http://127.0.0.1:3000
pause
