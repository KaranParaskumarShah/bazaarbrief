@echo off
setlocal
cd /d "%~dp0"
echo ==========================================================
echo  BAZAARBRIEF - SINGLE WORKER DEPLOYMENT
echo ==========================================================
echo.
echo This deploys the React site and live-data API together.
echo No KV namespace is required for first launch.
echo Node.js 20+ and Cloudflare login are required.
echo.
pause
node scripts\deploy-cloudflare.mjs
if errorlevel 1 (
  echo.
  echo Deployment stopped. Read the error above.
) else (
  echo.
  echo Deployment command completed. Check the health and API URLs.
)
echo.
pause
