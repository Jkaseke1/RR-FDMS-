@echo off
echo Updating device information in .env file...
echo.

cd /d "C:\Users\Joseph Kaseke\CascadeProjects\fdms-bridge"

REM Backup current .env
copy .env .env.backup

REM Update device info using PowerShell
powershell -Command "(Get-Content .env) -replace 'FDMS_DEVICE_ID=.*', 'FDMS_DEVICE_ID=35224' | Set-Content .env"
powershell -Command "(Get-Content .env) -replace 'FDMS_DEVICE_SERIAL_NO=.*', 'FDMS_DEVICE_SERIAL_NO=Rapi-IR-1' | Set-Content .env"

echo.
echo ✅ Device information updated:
echo    Device ID: 35224
echo    Serial No: Rapi-IR-1
echo.
echo Backup saved as: .env.backup
echo.
pause
