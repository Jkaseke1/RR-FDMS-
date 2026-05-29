@echo off
echo ========================================
echo Testing FDMS Bridge Connection...
echo ========================================
echo.

cd /d "C:\Users\Joseph Kaseke\CascadeProjects\fdms-bridge"

echo Checking environment file...
if not exist .env (
    echo ERROR: .env file not found!
    echo.
    echo Please configure .env file first:
    echo 1. Copy .env.example to .env
    echo 2. Add your Supabase credentials
    echo.
    pause
    exit /b 1
)

echo Running connection test...
echo.

npm run test-connection

echo.
echo ========================================
echo Test Complete
echo ========================================
echo.
pause
