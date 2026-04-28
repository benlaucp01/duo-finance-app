@echo off
cd /d "%~dp0"
echo Starting finance app preview...
echo.
echo Keep this window open while testing the app.
echo When you are done, close this window.
echo.
npm.cmd run dev -- --host 127.0.0.1 --configLoader native
pause
