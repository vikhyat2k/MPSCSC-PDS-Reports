@echo off
title Sync PDS Lifting Report to Cloud (Render)
echo ========================================================
echo   Syncing Code Changes to Cloud (https://pds-mpscsc.onrender.com)
echo ========================================================
echo.
git add .
set /p commit_msg="Enter description of changes (or press Enter for default): "
if "%commit_msg%"=="" set commit_msg="Update portal code"

git commit -m "%commit_msg%"
echo.
echo Pushing to GitHub...
git push origin main

echo.
echo ========================================================
echo SUCCESS! Your changes have been pushed to GitHub.
echo Render is now automatically updating https://pds-mpscsc.onrender.com (takes ~1-2 minutes).
echo ========================================================
pause
