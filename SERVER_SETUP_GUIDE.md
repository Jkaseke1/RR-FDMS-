---
description: Server deployment guide for FDMS Bridge on Windows
---

# FDMS Bridge - Server Setup Guide

## Overview

This guide covers deploying the FDMS Bridge on a **Windows Server** that will:
- Watch `C:\FDMS\unsigned\` for new invoice PDFs
- Fiscalize invoices/credit notes via ZIMRA FDMS API
- Stamp QR codes on signed PDFs in `C:\FDMS\signed\`
- Print fiscalized invoices automatically

---

## 1. Server Requirements

| Requirement | Minimum |
|------------|---------|
| OS | Windows 10/11 or Windows Server 2019+ |
| RAM | 4 GB |
| Disk | 10 GB free |
| Network | Stable internet (FDMS API calls) |
| Printer | Installed and configured (for invoice printing) |

---

## 2. Install Node.js

1. Download Node.js **LTS** from https://nodejs.org/
2. Run installer with **default settings**
3. Verify installation:
   ```powershell
   node --version   # Should show v20.x or higher
   npm --version    # Should show 10.x or higher
   ```

---

## 3. Create Required Directories

Run in PowerShell as Administrator:

```powershell
# Create FDMS directories
New-Item -ItemType Directory -Force -Path "C:\FDMS\unsigned"
New-Item -ItemType Directory -Force -Path "C:\FDMS\signed"
New-Item -ItemType Directory -Force -Path "C:\FDMS\logs"
```

---

## 4. Deploy Project Files

### Option A: Copy from development machine

Copy the entire project folder to the server, e.g.:
```
C:\fdms-bridge\
```

### Option B: Git clone (if using git)

```powershell
cd C:\
git clone <your-repo-url> fdms-bridge
cd fdms-bridge
```

---

## 5. Install Dependencies

```powershell
cd C:\fdms-bridge
npm install
```

This installs all required packages including:
- `pdf-lib`, `pdf-parse`, `pdfkit` — PDF processing
- `qrcode` — QR code generation
- `axios` — HTTP API calls
- `express` — API server
- `winston` — Logging
- `node-schedule` — Scheduled tasks

---

## 6. Configure Environment Variables

Create a `.env` file in `C:\fdms-bridge\`:

```env
# Environment: test or production
NODE_ENV=production

# FDMS API (use production URL for live)
FDMS_BASE_URL=https://fdmsapitest.zimra.co.zw
FDMS_DEVICE_ID=35224
FDMS_ACTIVATION_KEY=00374603
FDMS_DEVICE_SERIAL_NO=RapidR-1
FDMS_DEVICE_MODEL_NAME=Server
FDMS_DEVICE_MODEL_VERSION=v1

# Certificates
FDMS_CERT_PATH=./certs/device.cert.pem
FDMS_KEY_PATH=./certs/device.key.pem
FDMS_CA_PATH=./certs/fdms-root-ca.pem

# Supabase
SUPABASE_URL=https://tgqekxawvnlwdjingonh.supabase.co
SUPABASE_SERVICE_KEY=your-service-key-here

# Customer (taxpayer) details
CUSTOMER_TIN=2002054676
CUSTOMER_VAT=220401569
CUSTOMER_NAME=Rapid Roots Investment Pvt Ltd

# Scheduling
PING_INTERVAL_MINUTES=5
CONFIG_REFRESH_HOURS=24
CERT_RENEWAL_DAYS_BEFORE=30
```

> **Important:** Copy your actual `.env` from the dev machine — do NOT use the example values for production.

---

## 7. Copy Certificates

Ensure these certificate files exist in `C:\fdms-bridge\certs\`:

```
certs/
  device.cert.pem
  device.key.pem
  fdms-root-ca.pem
```

Copy them from your activated development machine.

---

## 8. Copy State File (Critical for Go-Live)

Copy `C:\FDMS\state.json` from your development machine to the server at the same path. This preserves:
- Receipt counters (so invoice numbers stay sequential)
- Fiscal day state
- Processed invoice history (for credit note linkage)

> **Without this, credit notes will fail to link to original invoices.**

---

## 9. Test the Setup

### 9.1 Check fiscal day status
```powershell
cd C:\fdms-bridge
npm run status
```

### 9.2 Run PDF watcher in test mode
```powershell
npm run pdf:process
```

### 9.3 Start continuous watching
```powershell
npm run pdf:watch
```

---

## 10. Run as Windows Service (Auto-Start)

Use **NSSM** (Non-Sucking Service Manager) to run the watcher as a Windows service:

### 10.1 Download NSSM
```powershell
# Download from https://nssm.cc/download
# Extract nssm.exe to C:\nssm\
```

### 10.2 Create the Service
```powershell
cd C:\nssm
.\nssm install FDMS-Bridge
```

In the NSSM GUI:
- **Path:** `C:\Program Files\nodejs\node.exe`
- **Startup directory:** `C:\fdms-bridge`
- **Arguments:** `src/integrations/pdfFiscalizationService.js watch`

### 10.3 Configure Service
```powershell
.\nssm set FDMS-Bridge DisplayName "FDMS Bridge Invoice Watcher"
.\nssm set FDMS-Bridge Description "Watches C:\FDMS\unsigned for invoices and fiscalizes them via ZIMRA"
.\nssm set FDMS-Bridge Start SERVICE_AUTO_START
```

### 10.4 Start the Service
```powershell
Start-Service FDMS-Bridge
```

---

## 11. Configure Invoice Printing

The fiscalized PDFs are saved to `C:\FDMS\signed\`. To auto-print:

### Option A: PDF Viewer Auto-Print
Configure your PDF viewer (e.g., Adobe Reader, SumatraPDF) to auto-print files dropped into `C:\FDMS\signed\`.

### Option B: PowerShell Print Script
Create `C:\FDMS\print.ps1`:

```powershell
$folder = "C:\FDMS\signed"
$printer = "Your-Printer-Name"

Get-ChildItem $folder -Filter "*.pdf" | ForEach-Object {
    Start-Process -FilePath $_.FullName -Verb Print -PassThru | ForEach-Object {
        Start-Sleep -Seconds 5
        Stop-Process -Id $_.Id -Force
    }
    Move-Item $_.FullName "C:\FDMS\printed\" -Force
}
```

Schedule it via Task Scheduler every 30 seconds.

---

## 12. Sage Integration (If Using Sage)

If Sage is installed on the same server:

1. Configure Sage to export PDFs to `C:\FDMS\unsigned\`
2. The watcher will pick them up automatically

If Sage is on a different machine:
1. Set up a shared network folder: `\\server\FDMS\unsigned\`
2. Map it on the Sage machine as a network drive
3. Configure Sage to export to that mapped drive

---

## 13. Backup Strategy

### Daily Backup (Critical Files)
```powershell
# Backup state.json (receipt counters & history)
Copy-Item "C:\FDMS\state.json" "C:\FDMS\backups\state-$(Get-Date -Format 'yyyyMMdd').json"

# Backup .env
Copy-Item "C:\fdms-bridge\.env" "C:\FDMS\backups\.env-$(Get-Date -Format 'yyyyMMdd')"
```

### What to Backup
| File | Why |
|------|-----|
| `C:\FDMS\state.json` | Receipt counters, fiscal day state, processed invoice history |
| `C:\fdms-bridge\.env` | API keys and configuration |
| `C:\fdms-bridge\certs\` | FDMS device certificates |

---

## 14. Troubleshooting

### Service Won't Start
```powershell
# Check logs
Get-Content C:\FDMS\logs\error.log -Tail 50

# Check service status
Get-Service FDMS-Bridge
```

### "Fiscal day not open"
```powershell
cd C:\fdms-bridge
npm run openday
```

### Credit Note Fails (RCPT032)
The original invoice wasn't processed on this server. Ensure `state.json` was copied from the dev machine.

### ZIMRA API Errors
- Check internet connection
- Verify certificates are valid (`npm run test-connection`)
- Check device status: `npm run device:status`

---

## 15. Go-Live Checklist

Before going live, verify:

- [ ] Node.js installed and working
- [ ] `npm install` completed without errors
- [ ] `.env` configured with production values
- [ ] Certificates copied to `certs\` folder
- [ ] `state.json` copied from dev machine to `C:\FDMS\`
- [ ] `C:\FDMS\unsigned\` and `C:\FDMS\signed\` directories exist
- [ ] Test invoice processes successfully
- [ ] Test credit note processes successfully
- [ ] Portal shows "Valid" for test invoices
- [ ] Windows service auto-starts on boot
- [ ] Printer configured and tested
- [ ] Backup script in place

---

## Quick Reference Commands

```powershell
# Start watcher manually
npm run pdf:watch

# Check fiscal day
npm run status

# Open fiscal day
npm run openday

# Close fiscal day
npm run closeday

# Check device status
npm run device:status

# Test ZIMRA connection
npm run test-connection

# Restart service
Restart-Service FDMS-Bridge

# View service logs
Get-EventLog -LogName Application -Source FDMS-Bridge -Newest 50
```
