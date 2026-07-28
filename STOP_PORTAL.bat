@echo off
echo ========================================
echo Stopping PDS Report Server
echo ========================================
echo.

REM Kill all Node.js processes (stops the server)
taskkill /F /IM node.exe /T >nul 2>&1

if %ERRORLEVEL% EQU 0 (
    echo Server stopped successfully!
) else (
    echo No server was running.
)

echo.
pause
