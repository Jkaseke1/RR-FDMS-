@echo off
echo ========================================
echo Opening Supabase in your browser...
echo ========================================
echo.
echo This will open:
echo 1. Supabase homepage (to sign up/login)
echo 2. Supabase dashboard (to manage your project)
echo.
echo Press any key to continue...
pause > nul

start https://supabase.com
timeout /t 2 > nul
start https://app.supabase.com

echo.
echo ========================================
echo Supabase opened in browser!
echo ========================================
echo.
echo Next steps:
echo 1. Sign up or login
echo 2. Create project: "zimra-fdms-bridge"
echo 3. Follow SUPABASE_SETUP_CHECKLIST.md
echo.
echo Press any key to exit...
pause > nul
