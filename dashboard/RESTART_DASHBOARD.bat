@echo off
echo Restarting Dashboard...
echo.

REM Kill any running node processes
taskkill /F /IM node.exe 2>nul

REM Wait a moment
timeout /t 2 /nobreak >nul

REM Delete package-lock.json
if exist package-lock.json del /F package-lock.json

REM Clean install
echo Installing dependencies...
call npm install --legacy-peer-deps

echo.
echo Starting dashboard...
call npm run dev

pause
