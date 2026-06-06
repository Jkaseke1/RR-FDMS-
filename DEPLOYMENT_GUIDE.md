# ZIMRA FDMS Bridge - Server Deployment Guide

## Overview
This guide covers deploying the ZIMRA FDMS Bridge on the Rapid Roots production server where Sage 200 Evolution prints invoices.

---

## Prerequisites

### Server Requirements
- **OS**: Windows Server 2016 or later (or Windows 10/11)
- **Node.js**: Version 18.x or later
- **RAM**: Minimum 4GB
- **Disk Space**: 10GB free space
- **Network**: Internet access to ZIMRA FDMS API

### Required Information
- ZIMRA Device Serial Number
- ZIMRA Device ID
- ZIMRA Certificate files (.p12)
- Certificate password
- Supabase credentials (if using cloud sync)

---

## Installation Steps

### Step 1: Install Node.js on Server

1. Download Node.js LTS from https://nodejs.org/
2. Run installer and follow prompts
3. Verify installation:
   ```powershell
   node --version
   npm --version
   ```

### Step 2: Transfer Project Files

1. Copy the entire `fdms-bridge` folder to server:
   ```
   C:\FDMS\fdms-bridge\
   ```

2. Ensure the following directories exist:
   ```
   C:\FDMS\unsigned\      (for incoming PDFs from Sage)
   C:\FDMS\signed\        (for fiscalized PDFs)
   C:\FDMS\failed\        (for failed PDFs)
   C:\FDMS\logs\          (for application logs)
   ```

### Step 3: Install Dependencies

Open PowerShell as Administrator in `C:\FDMS\fdms-bridge\`:

```powershell
npm install
```

### Step 4: Configure Environment

1. Copy `.env.example` to `.env`:
   ```powershell
   Copy-Item .env.example .env
   ```

2. Edit `.env` file with production values:
   ```env
   # ZIMRA FDMS Configuration
   NODE_ENV=production
   FDMS_URL=https://fdmsapi.zimra.co.zw
   DEVICE_SERIAL=RapidR-1
   DEVICE_ID=35224
   
   # Certificate Configuration
   CERT_PATH=./certs/RapidRoots.p12
   CERT_PASSWORD=your_certificate_password
   
   # Directories
   UNSIGNED_DIR=C:/FDMS/unsigned
   SIGNED_DIR=C:/FDMS/signed
   FAILED_DIR=C:/FDMS/failed
   LOGS_DIR=C:/FDMS/logs
   
   # Supabase (optional - for cloud sync)
   SUPABASE_URL=your_supabase_url
   SUPABASE_KEY=your_supabase_key
   ```

### Step 5: Install Certificates

1. Copy your ZIMRA certificate files to `C:\FDMS\fdms-bridge\certs\`
2. Verify certificate:
   ```powershell
   node scripts/testConnection.js
   ```

### Step 6: Test Configuration

Run diagnostic checks:

```powershell
# Test device registration
node scripts/checkDeviceRegistration.js

# Test device status
node scripts/checkDeviceStatus.js

# Test full system
node scripts/checkSystemStatus.js
```

### Step 7: Configure Sage 200 Print-to-File

1. In Sage 200 Evolution, configure invoice printing:
   - **Print Method**: Print to File (PDF)
   - **Output Directory**: `C:\FDMS\unsigned\`
   - **File Naming**: `Tax Invoice_YYYYMMDD_HHMMSS.pdf` or `Tax Credit Note_YYYYMMDD_HHMMSS.pdf`

2. Test by printing a sample invoice from Sage

---

## Running the Service

### Option 1: Manual Start (for testing)

```powershell
cd C:\FDMS\fdms-bridge
node index.js
```

### Option 2: Windows Service (Production - Recommended)

Install as Windows Service using `node-windows`:

1. Install node-windows:
   ```powershell
   npm install -g node-windows
   ```

2. Run the service installer:
   ```powershell
   node setup-windows-service.js
   ```

3. Service will start automatically and run on boot

4. Manage service:
   ```powershell
   # Check status
   Get-Service "ZIMRA-FDMS-Bridge"
   
   # Stop service
   Stop-Service "ZIMRA-FDMS-Bridge"
   
   # Start service
   Start-Service "ZIMRA-FDMS-Bridge"
   
   # Restart service
   Restart-Service "ZIMRA-FDMS-Bridge"
   ```

### Option 3: Task Scheduler (Alternative)

1. Open Task Scheduler
2. Create Basic Task:
   - **Name**: ZIMRA FDMS Bridge
   - **Trigger**: At startup
   - **Action**: Start a program
   - **Program**: `C:\Program Files\nodejs\node.exe`
   - **Arguments**: `index.js`
   - **Start in**: `C:\FDMS\fdms-bridge`
3. Configure to run whether user is logged in or not
4. Run with highest privileges

---

## Monitoring and Maintenance

### Log Files

Logs are written to `C:\FDMS\logs\fiscalization-YYYY-MM-DD.log`

Monitor logs:
```powershell
# View today's log
Get-Content C:\FDMS\logs\fiscalization-2026-06-04.log -Tail 50 -Wait

# Search for errors
Select-String -Path "C:\FDMS\logs\*.log" -Pattern "ERROR"
```

### State File

Application state is stored in `C:\FDMS\state.json`:
- Last processed receipt number
- Fiscal day status
- Device configuration
- Processed invoices/credit notes

**Backup this file regularly!**

### Daily Checks

1. **Fiscal Day Status**: Ensure fiscal day is open
   ```powershell
   node scripts/checkDeviceStatus.js
   ```

2. **Failed PDFs**: Check `C:\FDMS\failed\` for any failed fiscalizations

3. **Log Review**: Check logs for errors or warnings

### Opening Fiscal Day

If fiscal day is closed, open it:
```powershell
node scripts/openFiscalDay.js
```

---

## Troubleshooting

### Issue: PDFs not being processed

**Check:**
1. Service is running: `Get-Service "ZIMRA-FDMS-Bridge"`
2. PDFs are in correct directory: `C:\FDMS\unsigned\`
3. PDF file names match expected pattern
4. Check logs for errors

### Issue: Certificate errors

**Solution:**
1. Verify certificate path in `.env`
2. Check certificate password
3. Ensure certificate is not expired
4. Run: `node scripts/testConnection.js`

### Issue: "Fiscal day closed" error

**Solution:**
```powershell
node scripts/openFiscalDay.js
```

### Issue: Network/API errors

**Check:**
1. Internet connectivity
2. ZIMRA API status
3. Firewall settings (allow outbound HTTPS to zimra.co.zw)
4. Proxy settings if applicable

### Issue: Invalid tax errors

**Check:**
1. Tax codes in Sage match mapping (1=VAT, 6=Zero, 7=Exempt)
2. HS Codes are valid 8-digit codes
3. Line items parsed correctly (check logs)

---

## Backup and Recovery

### Files to Backup Daily

1. **State file**: `C:\FDMS\state.json`
2. **Signed PDFs**: `C:\FDMS\signed\*`
3. **Logs**: `C:\FDMS\logs\*`
4. **Configuration**: `C:\FDMS\fdms-bridge\.env`

### Backup Script

Create `backup.ps1`:
```powershell
$BackupDir = "D:\Backups\FDMS\$(Get-Date -Format 'yyyy-MM-dd')"
New-Item -ItemType Directory -Path $BackupDir -Force

Copy-Item "C:\FDMS\state.json" $BackupDir
Copy-Item "C:\FDMS\signed\*" "$BackupDir\signed\" -Recurse
Copy-Item "C:\FDMS\logs\*" "$BackupDir\logs\" -Recurse
Copy-Item "C:\FDMS\fdms-bridge\.env" $BackupDir
```

Schedule in Task Scheduler to run daily.

---

## Security Considerations

1. **Certificate Protection**:
   - Store certificate password securely
   - Restrict access to `certs\` folder
   - Use Windows DPAPI for password encryption if possible

2. **File Permissions**:
   - Restrict `C:\FDMS\` to authorized users only
   - Service account should have minimal required permissions

3. **Network Security**:
   - Use firewall rules to restrict outbound connections
   - Monitor API access logs

4. **Audit Trail**:
   - All fiscalizations are logged
   - Signed PDFs contain ZIMRA verification codes
   - State file tracks all processed documents

---

## Support and Contacts

### ZIMRA Support
- **Email**: fdms@zimra.co.zw
- **Phone**: +263 4 758891-5

### System Administrator
- Check logs first: `C:\FDMS\logs\`
- Run diagnostics: `node scripts/checkSystemStatus.js`
- Review this guide for common issues

---

## Appendix: File Structure

```
C:\FDMS\
├── fdms-bridge\              # Application code
│   ├── src\
│   ├── scripts\
│   ├── certs\
│   ├── .env                  # Configuration
│   ├── index.js              # Main entry point
│   └── package.json
├── unsigned\                 # Incoming PDFs from Sage
├── signed\                   # Fiscalized PDFs
├── failed\                   # Failed PDFs
├── logs\                     # Application logs
└── state.json                # Application state

```

---

## Version History

- **v1.0.0** (2026-06-04): Initial production deployment
  - Support for invoices and credit notes
  - Multi-currency support (USD, ZWG)
  - Three tax types (Standard, Zero-rated, Exempt)
  - Automatic PDF processing
  - QR code stamping on fiscalized PDFs

---

**End of Deployment Guide**
