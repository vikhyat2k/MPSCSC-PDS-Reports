@echo off
title PDS Lifting Intelligence Portal
cd /d "%~dp0"

echo ========================================================
echo   PDS Lifting Intelligence Portal - Starting Server
echo ========================================================
echo.

:: Auto-heal / ensure Desktop shortcuts exist
if not exist "%USERPROFILE%\Desktop\Start PDS Portal.lnk" (
    echo [*] Restoring desktop shortcuts...
    powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0create_shortcuts.ps1" >nul 2>&1
)

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

where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js executable could not be located.
    echo Please install Node.js or ensure node.exe path is configured.
    echo.
    pause
    exit /b 1
)

echo [1/2] Launching portal in default web browser in 3 seconds...
start /min cmd /c "timeout /t 3 /nobreak >nul && start http://localhost:3000"

echo [2/2] Starting PDS Portal Node.js Server...
echo Web Interface: http://localhost:3000
echo ========================================================
echo.
node server.js
pause
