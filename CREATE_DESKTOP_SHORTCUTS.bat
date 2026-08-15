@echo off
title Create PDS Desktop Shortcuts
cd /d "%~dp0"

echo ========================================================
echo   Creating PDS Lifting Intelligence Desktop Shortcuts
echo ========================================================
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0create_shortcuts.ps1"

echo.
echo ========================================================
echo Done! All desktop shortcuts have been created.
echo ========================================================
timeout /t 3
