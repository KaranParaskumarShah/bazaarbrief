@echo off
setlocal
cd /d "%~dp0"
echo ==========================================================
echo  BAZAARBRIEF - AUTOMATED CLOUDFLARE FREE DEPLOYMENT
echo ==========================================================
echo.
echo This deploys the Worker, creates KV, builds and deploys the site.
echo You only need to approve the Cloudflare login in your browser.
echo Node.js 20+ and an active Cloudflare account are required.
echo.
pause
node scripts\deploy-cloudflare.mjs
if errorlevel 1 (
  echo.
  echo Deployment stopped. Read the error above.
) else (
  echo.
  echo Deployment script completed. Check the URLs above.
)
echo.
pause
