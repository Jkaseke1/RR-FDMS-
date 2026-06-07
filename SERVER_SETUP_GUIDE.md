---
description: Server deployment guide for FDMS Bridge on Windows
---

# FDMS Bridge - Server Setup Guide (GitHub Edition)

## Overview

This guide covers deploying the FDMS Bridge from **GitHub** to a **Windows Server**. Changes pushed to the repository can be automatically or manually pulled to the server.

**What the server does:**
- Watch `C:\FDMS\unsigned\` for new invoice PDFs
- Fiscalize invoices/credit notes via ZIMRA FDMS API
- Stamp QR codes on signed PDFs in `C:\FDMS\signed\`
- Auto-open/close fiscal day daily
- Print fiscalized invoices automatically

**Deployment Methods:**
1. **Manual Update** - Run `update.ps1` to pull latest changes
2. **Auto-Update** - GitHub webhook triggers automatic deployment
3. **Windows Service** - Runs 24/7, auto-starts on boot

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

## 4. Deploy from GitHub

### Option A: Automated Deploy Script (Recommended)

On the server, run the deploy script:

```powershell
# Download the deploy script
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/Jkaseke1/RR-FDMS-/main/server/deploy.ps1" -OutFile "C:\deploy.ps1"

# Run deployment
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process -Force
C:\deploy.ps1 -InstallDir "C:\FDMS\fdms-bridge"
```

This will:
- Clone the repository from GitHub
- Install all dependencies
- Create required directories
- Set up the environment template

### Option B: Manual Git Clone

```powershell
cd C:\
git clone https://github.com/Jkaseke1/RR-FDMS-.git fdms-bridge
cd fdms-bridge
npm install
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
# Environment
NODE_ENV=production

# FDMS API (production)
FDMS_BASE_URL=https://fdmsapi.zimra.co.zw
FDMS_DEVICE_ID=41885
FDMS_ACTIVATION_KEY=00904912
FDMS_DEVICE_SERIAL_NO=RapidR-1
FDMS_DEVICE_MODEL_NAME=Server
FDMS_DEVICE_MODEL_VERSION=v1

# Certificates
FDMS_CERT_PATH=./certs/device.crt.pem
FDMS_KEY_PATH=./certs/device.key.pem
FDMS_CA_PATH=./certs/fdms-root-ca.pem
CERT_PATH=./certs/RapidR-1.p12
CERT_PASSWORD=rapidroots2024

# Customer (taxpayer) details
CUSTOMER_TIN=2002054676
CUSTOMER_VAT=220401569
CUSTOMER_NAME=Rapid Roots Investment Pvt Ltd

# Directories
UNSIGNED_DIR=C:\FDMS\unsigned
SIGNED_DIR=C:\FDMS\signed
FAILED_DIR=C:\FDMS\failed
LOGS_DIR=C:\FDMS\logs

# Scheduling
PING_INTERVAL_MINUTES=5
CONFIG_REFRESH_HOURS=24
CERT_RENEWAL_DAYS_BEFORE=30
```

> **Important:** Get your actual `.env` from the development machine — do NOT commit `.env` to GitHub.

---

## 7. Copy Certificates

Ensure these certificate files exist in `C:\fdms-bridge\certs\`:

```
certs/
  device.crt.pem       (production certificate for device 41885)
  device.key.pem       (private key)
  fdms-root-ca.pem     (ZIMRA root CA)
  fdms-chain.pem       (ZIMRA CA chain)
  RapidR-1.p12         (P12 certificate for service)
```

**Copy them from your development machine.** Do NOT commit certificates to GitHub — they are already in `.gitignore`.

---

## 8. Update from GitHub

After initial deployment, you can update the server anytime you push changes to GitHub.

### Manual Update (Recommended)

Run on the server:

```powershell
cd C:\FDMS\fdms-bridge
.\server\update.ps1
```

This will:
1. Fetch latest changes from `main` branch
2. Backup `.env` and `state.json`
3. Reset code to latest commit
4. Restore your `.env`
5. Install any new dependencies
6. Restart the service

### Check for Updates Without Applying

```powershell
.\server\update.ps1 -CheckOnly
```

### Auto-Update via GitHub Webhook (Advanced)

For automatic deployment on every push:

1. **On the server**, start the auto-update listener:
   ```powershell
   cd C:\FDMS\fdms-bridge
   node server\auto-update.js
   ```

2. **Expose the server** to the internet:
   - Option A: Use [ngrok](https://ngrok.com/) for testing
     ```powershell
     ngrok http 9000
     ```
   - Option B: Configure your firewall/router to forward port 9000

3. **In GitHub**, go to Repository → Settings → Webhooks → Add webhook
   - **Payload URL:** `http://YOUR_SERVER_IP:9000/webhook`
   - **Content type:** `application/json`
   - **Events:** Just the push event
   - Click **Add webhook**

4. Now every push to `main` will automatically update the server!

---

## 9. Copy State File (Critical for Go-Live)

Copy `C:\FDMS\state.json` from your development machine to the server at the same path. This preserves:
- Receipt counters (so invoice numbers stay sequential)
- Fiscal day state
- Processed invoice history (for credit note linkage)

> **Without this, credit notes will fail to link to original invoices.**

---

## 10. Test the Setup

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

## 11. Run as Windows Service (Auto-Start)

### Option A: Using node-windows (Recommended)

The project includes a built-in Windows service setup:

```powershell
cd C:\FDMS\fdms-bridge
node setup-windows-service.js
```

This creates the **FDMSBridge** service that:
- Auto-starts on boot
- Runs `index.js` (full fiscalization service)
- Logs to Windows Event Log

Manage the service:
```powershell
# Start
Start-Service FDMSBridge

# Stop
Stop-Service FDMSBridge

# Restart (after updates)
Restart-Service FDMSBridge

# Check status
Get-Service FDMSBridge
```

### Option B: Using NSSM (Alternative)

Download NSSM from https://nssm.cc/download and extract to `C:\nssm\`:

```powershell
cd C:\nssm
.\nssm install FDMSBridge
```

In the NSSM GUI:
- **Path:** `C:\Program Files\nodejs\node.exe`
- **Startup directory:** `C:\FDMS\fdms-bridge`
- **Arguments:** `index.js`

```powershell
.\nssm set FDMSBridge DisplayName "FDMS Bridge"
.\nssm set FDMSBridge Description "Rapid Roots FDMS Fiscalization Service"
.\nssm set FDMSBridge Start SERVICE_AUTO_START
Start-Service FDMSBridge
```

---

## 12. Configure Invoice Printing

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

## 13. Sage Integration (If Using Sage)

If Sage is installed on the same server:

1. Configure Sage to export PDFs to `C:\FDMS\unsigned\`
2. The watcher will pick them up automatically

If Sage is on a different machine:
1. Set up a shared network folder: `\\server\FDMS\unsigned\`
2. Map it on the Sage machine as a network drive
3. Configure Sage to export to that mapped drive

---

## 14. Backup Strategy

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

## 15. Troubleshooting

### Service Won't Start
```powershell
# Check logs
Get-Content C:\FDMS\logs\error.log -Tail 50

# Check service status
Get-Service FDMSBridge
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

## 16. Go-Live Checklist

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
Restart-Service FDMSBridge

# View service logs
Get-EventLog -LogName Application -Source FDMSBridge -Newest 50

# Update from GitHub
.\server\update.ps1

# Check for updates (don't apply)
.\server\update.ps1 -CheckOnly

# Deploy to fresh server
.\server\deploy.ps1
```
