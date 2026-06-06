# Server Installation - Quick Start Guide

## For Rapid Roots Production Server

### Prerequisites Checklist
- [ ] Windows Server with Administrator access
- [ ] Node.js 18+ installed
- [ ] ZIMRA Device ID: **35224**
- [ ] ZIMRA Device Serial: **RapidR-1**
- [ ] ZIMRA Certificate (.p12 file) and password
- [ ] Sage 200 Evolution installed and configured

---

## Installation (5 Steps)

### 1. Copy Files to Server
Transfer the entire `fdms-bridge` folder to:
```
C:\FDMS\fdms-bridge\
```

### 2. Run Setup Script
Open PowerShell **as Administrator**:
```powershell
cd C:\FDMS\fdms-bridge
.\setup-server.ps1
```

This will:
- Create required directories
- Install dependencies
- Create .env configuration file
- Optionally install as Windows Service

### 3. Configure Environment
Edit `C:\FDMS\fdms-bridge\.env`:

```env
NODE_ENV=production
FDMS_URL=https://fdmsapi.zimra.co.zw
DEVICE_SERIAL=RapidR-1
DEVICE_ID=35224

CERT_PATH=./certs/RapidRoots.p12
CERT_PASSWORD=YOUR_CERT_PASSWORD_HERE

UNSIGNED_DIR=C:/FDMS/unsigned
SIGNED_DIR=C:/FDMS/signed
FAILED_DIR=C:/FDMS/failed
LOGS_DIR=C:/FDMS/logs
```

### 4. Add Certificate
Copy your ZIMRA certificate to:
```
C:\FDMS\fdms-bridge\certs\RapidRoots.p12
```

### 5. Test & Start
```powershell
# Test connection
node scripts/testConnection.js

# Test device status
node scripts/checkDeviceStatus.js

# Start the service (if installed as service)
Start-Service "ZIMRA FDMS Bridge"

# OR run manually for testing
node index.js
```

---

## Configure Sage 200 Evolution

### Print-to-File Setup

1. Open Sage 200 Evolution
2. Go to **Invoice Printing Settings**
3. Configure:
   - **Print Method**: Print to File (PDF)
   - **Output Directory**: `C:\FDMS\unsigned\`
   - **File Naming Pattern**: Use default Sage naming

4. Test by printing a sample invoice

---

## Verify It's Working

### Test Invoice Flow

1. Print an invoice from Sage → `C:\FDMS\unsigned\`
2. Watch the service process it (check logs)
3. Fiscalized PDF appears in `C:\FDMS\signed\`
4. Original moves to `C:\FDMS\signed\` with QR code

### Check Logs
```powershell
Get-Content C:\FDMS\logs\fiscalization-2026-06-04.log -Tail 50 -Wait
```

### Check Service Status
```powershell
Get-Service "ZIMRA FDMS Bridge"
```

---

## Daily Operations

### Opening Fiscal Day
If fiscal day is closed:
```powershell
cd C:\FDMS\fdms-bridge
node scripts/openFiscalDay.js
```

### Monitoring
- **Logs**: `C:\FDMS\logs\`
- **Failed PDFs**: `C:\FDMS\failed\`
- **State**: `C:\FDMS\state.json`

### Restart Service
```powershell
Restart-Service "ZIMRA FDMS Bridge"
```

---

## Troubleshooting

### Service won't start
```powershell
# Check service status
Get-Service "ZIMRA FDMS Bridge"

# View service logs
Get-EventLog -LogName Application -Source "ZIMRA FDMS Bridge" -Newest 20

# Run manually to see errors
cd C:\FDMS\fdms-bridge
node index.js
```

### PDFs not processing
1. Check service is running
2. Verify PDF is in `C:\FDMS\unsigned\`
3. Check file name matches pattern
4. Review logs for errors

### Certificate errors
```powershell
# Test certificate
node scripts/testConnection.js

# Verify certificate path and password in .env
```

---

## Support

### Documentation
- **Full Guide**: `DEPLOYMENT_GUIDE.md`
- **API Reference**: `README.md`

### ZIMRA Support
- Email: fdms@zimra.co.zw
- Phone: +263 4 758891-5

### Logs Location
All logs are in: `C:\FDMS\logs\`

---

## Backup

Run daily backup:
```powershell
.\backup-fdms.ps1
```

Schedule in Task Scheduler for automatic daily backups.

---

**Installation Complete!** 🎉

The system will now automatically:
- Monitor `C:\FDMS\unsigned\` for new PDFs
- Fiscalize invoices and credit notes
- Stamp QR codes on PDFs
- Save to `C:\FDMS\signed\`
- Log all operations
