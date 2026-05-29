@echo off
echo ========================================
echo Starting ZIMRA FDMS Dashboard...
echo ========================================
echo.

cd /d "C:\Users\Joseph Kaseke\CascadeProjects\fdms-bridge\dashboard"

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

echo Starting development server...
echo.
echo Dashboard will open at: http://localhost:3000
echo.
echo Press Ctrl+C to stop the server
echo ========================================
echo.

npm run dev

pause
