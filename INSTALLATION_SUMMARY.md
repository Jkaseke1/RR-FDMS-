# ZIMRA FDMS Bridge - Installation Summary

## 🎯 What You Have Now

A complete, production-ready ZIMRA FDMS Bridge system that:

✅ **Automatically fiscalizes** invoices and credit notes from Sage 200  
✅ **Handles 3 tax types**: Standard (15.5%), Zero-rated (0%), Exempt (null)  
✅ **Supports multiple currencies**: USD, ZWG  
✅ **Stamps QR codes** on fiscalized PDFs  
✅ **Runs as Windows Service** for automatic startup  
✅ **Comprehensive logging** and error handling  
✅ **Backup scripts** for data protection  

---

## 📦 Deployment Package Contents

### Core Files
- **`index.js`** - Main application entry point
- **`src/`** - Application source code
- **`scripts/`** - Diagnostic and utility scripts
- **`certs/`** - Certificate storage directory

### Setup & Installation
- **`setup-server.ps1`** - Automated Windows setup script ⭐
- **`setup-windows-service.js`** - Windows Service installer
- **`uninstall-windows-service.js`** - Service uninstaller
- **`.env.production.example`** - Production configuration template

### Documentation
- **`SERVER_QUICK_START.md`** - Quick installation guide (5 min) ⭐
- **`DEPLOYMENT_GUIDE.md`** - Complete deployment manual ⭐
- **`DEPLOYMENT_PACKAGE_README.txt`** - Package overview
- **`README.md`** - Technical documentation

### Configuration
- **`.env`** - Environment configuration (create from template)
- **`package.json`** - Node.js dependencies

---

## 🚀 Installation Steps (Server)

### Step 1: Transfer Files
Copy the entire `fdms-bridge` folder to:
```
C:\FDMS\fdms-bridge\
```

### Step 2: Run Setup
Open PowerShell **as Administrator**:
```powershell
cd C:\FDMS\fdms-bridge
.\setup-server.ps1
```

This automated script will:
- ✅ Check Node.js installation
- ✅ Create directory structure
- ✅ Install npm dependencies
- ✅ Create .env configuration
- ✅ Optionally install Windows Service
- ✅ Create backup script

### Step 3: Configure
Edit `C:\FDMS\fdms-bridge\.env`:
```env
DEVICE_ID=35224
DEVICE_SERIAL=RapidR-1
CERT_PASSWORD=your_password
FDMS_URL=https://fdmsapi.zimra.co.zw
```

### Step 4: Add Certificate
Copy ZIMRA certificate to:
```
C:\FDMS\fdms-bridge\certs\RapidRoots.p12
```

### Step 5: Start Service
```powershell
Start-Service "ZIMRA FDMS Bridge"
```

---

## 🔧 Configure Sage 200 Evolution

### Print-to-File Setup
1. Open Sage 200 Evolution
2. Go to Invoice Printing Settings
3. Set:
   - **Print Method**: Print to File (PDF)
   - **Output Directory**: `C:\FDMS\unsigned\`
4. Test by printing a sample invoice

---

## ✅ Verification

### Test the Installation
```powershell
# Test ZIMRA connection
node scripts/testConnection.js

# Check device status
node scripts/checkDeviceStatus.js

# Full system check
node scripts/checkSystemStatus.js
```

### Test Invoice Flow
1. Print invoice from Sage → `C:\FDMS\unsigned\`
2. Service processes it automatically
3. Fiscalized PDF appears in `C:\FDMS\signed\`
4. Check logs: `C:\FDMS\logs\fiscalization-YYYY-MM-DD.log`

---

## 📊 Directory Structure

```
C:\FDMS\
├── fdms-bridge\              # Application
│   ├── src\                  # Source code
│   ├── scripts\              # Utilities
│   ├── certs\                # Certificates
│   ├── .env                  # Configuration
│   └── index.js              # Main entry
├── unsigned\                 # Incoming PDFs from Sage
├── signed\                   # Fiscalized PDFs (output)
├── failed\                   # Failed PDFs
├── logs\                     # Application logs
└── state.json                # Application state (BACKUP THIS!)
```

---

## 🔄 Daily Operations

### Opening Fiscal Day
```powershell
node scripts/openFiscalDay.js
```

### Monitoring
```powershell
# View live logs
Get-Content C:\FDMS\logs\fiscalization-2026-06-04.log -Tail 50 -Wait

# Check service status
Get-Service "ZIMRA FDMS Bridge"

# Restart service
Restart-Service "ZIMRA FDMS Bridge"
```

### Backup
Run daily backup:
```powershell
.\backup-fdms.ps1
```

Schedule in Task Scheduler for automatic backups.

---

## 🛠️ Troubleshooting

### Service Won't Start
```powershell
# Check service
Get-Service "ZIMRA FDMS Bridge"

# Run manually to see errors
node index.js
```

### PDFs Not Processing
1. ✓ Service is running
2. ✓ PDFs in `C:\FDMS\unsigned\`
3. ✓ Check logs for errors
4. ✓ Verify .env configuration

### Certificate Errors
```powershell
# Test certificate
node scripts/testConnection.js

# Verify in .env:
# - CERT_PATH
# - CERT_PASSWORD
```

---

## 📚 Documentation Reference

| Document | Purpose |
|----------|---------|
| **SERVER_QUICK_START.md** | Quick installation (5 min) |
| **DEPLOYMENT_GUIDE.md** | Complete deployment manual |
| **README.md** | Technical documentation |
| **DEPLOYMENT_PACKAGE_README.txt** | Package overview |

---

## 🎓 Key Features Implemented

### Tax Handling
✅ Standard VAT (15.5%) - Tax Code 1  
✅ Zero-rated (0%) - Tax Code 6  
✅ Exempt (null taxPercent) - Tax Code 7  

### Document Types
✅ Fiscal Invoices  
✅ Credit Notes (with original invoice reference)  

### Currencies
✅ USD (United States Dollar)  
✅ ZWG (Zimbabwe Gold)  

### Processing
✅ Automatic PDF monitoring  
✅ QR code stamping  
✅ Signature generation  
✅ ZIMRA API integration  
✅ Error handling & retry logic  

### Operations
✅ Fiscal day management  
✅ Receipt counter tracking  
✅ State persistence  
✅ Comprehensive logging  

---

## 📞 Support

### ZIMRA Support
- **Email**: fdms@zimra.co.zw
- **Phone**: +263 4 758891-5

### System Logs
All operations logged to: `C:\FDMS\logs\`

### Diagnostic Tools
```powershell
node scripts/checkSystemStatus.js
node scripts/diagnoseDevice.js
node scripts/testAllEndpoints.js
```

---

## ✨ Success Criteria

Your installation is successful when:

✅ Service starts automatically on server boot  
✅ Sage invoices print to `C:\FDMS\unsigned\`  
✅ PDFs are fiscalized within seconds  
✅ Fiscalized PDFs appear in `C:\FDMS\signed\` with QR codes  
✅ No errors in logs  
✅ ZIMRA portal shows receipts as accepted  

---

## 🎉 You're Ready!

The system is now production-ready. Follow the **SERVER_QUICK_START.md** guide to deploy on your server.

**Next Steps:**
1. Transfer files to production server
2. Run `setup-server.ps1`
3. Configure `.env`
4. Add certificate
5. Start service
6. Test with Sage invoice

**Good luck with your deployment!** 🚀
