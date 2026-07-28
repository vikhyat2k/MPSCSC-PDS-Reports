@echo off
echo ======================================================
echo    PDS LIFTING PORTAL - CORE LOGIC RESTORE TOOL
echo ======================================================
echo This will revert all scrapers, processors, and UI 
echo logic to the stable "Pure Dispatch" version (v4.6).
echo.
set /p confirm="Are you sure you want to restore core logic? (Y/N): "
if /i "%confirm%" neq "Y" goto cancel

node scripts/restore_stable.js
echo.
pause
exit

:cancel
echo Restore cancelled.
pause
exit
