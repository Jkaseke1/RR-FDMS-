================================================================================
ZIMRA FDMS BRIDGE - DEPLOYMENT PACKAGE
Rapid Roots Investments (Pvt) Ltd
Version 1.0.0
================================================================================

CONTENTS OF THIS PACKAGE:
-------------------------
This folder contains everything needed to deploy the ZIMRA FDMS Bridge on your
production server.

WHAT'S INCLUDED:
----------------
✓ Complete application source code
✓ Automated setup scripts
✓ Windows Service installer
✓ Configuration templates
✓ Comprehensive documentation
✓ Diagnostic and testing tools
✓ Backup scripts

DEPLOYMENT FILES:
-----------------
📄 SERVER_QUICK_START.md       - Quick installation guide (START HERE!)
📄 DEPLOYMENT_GUIDE.md          - Complete deployment documentation
📄 setup-server.ps1             - Automated setup script for Windows
📄 setup-windows-service.js     - Windows Service installer
📄 uninstall-windows-service.js - Windows Service uninstaller
📄 backup-fdms.ps1              - Daily backup script (created by setup)
📄 .env.production.example      - Production configuration template

QUICK START (5 MINUTES):
------------------------
1. Copy this entire folder to: C:\FDMS\fdms-bridge\

2. Open PowerShell AS ADMINISTRATOR and run:
   cd C:\FDMS\fdms-bridge
   .\setup-server.ps1

3. Edit .env file with your credentials:
   - Device ID: 35224
   - Device Serial: RapidR-1
   - Certificate password

4. Copy ZIMRA certificate to: certs\RapidRoots.p12

5. Start the service:
   Start-Service "ZIMRA FDMS Bridge"

DETAILED INSTRUCTIONS:
----------------------
See SERVER_QUICK_START.md for step-by-step instructions
See DEPLOYMENT_GUIDE.md for complete documentation

SYSTEM REQUIREMENTS:
--------------------
✓ Windows Server 2016+ (or Windows 10/11)
✓ Node.js 18.x or later
✓ 4GB RAM minimum
✓ 10GB free disk space
✓ Internet access to ZIMRA API
✓ Sage 200 Evolution (for invoice printing)

WHAT THIS SYSTEM DOES:
----------------------
1. Monitors C:\FDMS\unsigned\ for new invoice/credit note PDFs from Sage
2. Automatically fiscalizes them with ZIMRA
3. Stamps QR codes on the PDFs
4. Saves fiscalized PDFs to C:\FDMS\signed\
5. Logs all operations to C:\FDMS\logs\

SUPPORT:
--------
Documentation: See DEPLOYMENT_GUIDE.md
ZIMRA Support: fdms@zimra.co.zw | +263 4 758891-5
Logs Location: C:\FDMS\logs\

IMPORTANT NOTES:
----------------
⚠ Run setup-server.ps1 as Administrator
⚠ Edit .env file before starting the service
⚠ Keep your certificate password secure
⚠ Backup C:\FDMS\state.json daily
⚠ Monitor C:\FDMS\logs\ for errors

TESTING:
--------
After installation, test with:
  node scripts/testConnection.js
  node scripts/checkDeviceStatus.js
  node scripts/checkSystemStatus.js

Then print a test invoice from Sage to verify end-to-end flow.

================================================================================
Ready to deploy? Open SERVER_QUICK_START.md and follow the steps!
================================================================================
