@echo off
setlocal
cd /d "%~dp0"
echo ==========================================================
echo  BAZAARBRIEF - LOCAL FRONTEND + LIVE DATA FETCH
 echo ==========================================================
echo.
echo This starts a local Worker API, fetches upstream data immediately,
echo then starts the website. No Cloudflare login is needed for local testing.
echo Internet access is required. Upstream APIs may block or rate-limit requests.
echo.
node scripts\local-dev.mjs
if errorlevel 1 (
  echo.
  echo Local startup failed. Read the error above.
)
echo.
pause
