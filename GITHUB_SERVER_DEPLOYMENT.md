# FDMS Bridge - GitHub Server Deployment Guide

## Overview

Deploy and manage the FDMS Bridge on a Windows Server using GitHub. Push code changes from your development machine, then pull them to the server.

**Repository:** `https://github.com/Jkaseke1/RR-FDMS-.git`

---

## Architecture

```
┌──────────────────────┐         ┌──────────────────────┐
│  Your Computer       │         │  Windows Server      │
│  (Development)       │         │  (Production)        │
│                      │         │                      │
│  Edit code → Push    │ ──────► │  Pull → Run          │
│  to GitHub           │  Git    │  Node.js app         │
│                      │         │                      │
│  Certs & .env kept   │         │  Certs & .env copied │
│  locally             │         │  from dev machine    │
└──────────────────────┘         └──────────────────────┘
```

---

## Server Deployment Steps

### Step 1: Prepare the Server

On your Windows Server, install:
1. **Node.js 18+** from https://nodejs.org/
2. **Git** from https://git-scm.com/download/win
3. **OpenSSL** (included with Git)

Verify:
```powershell
node --version    # v20.x or higher
npm --version     # 10.x or higher
git --version     # Any version
```

### Step 2: Run Deploy Script

Open PowerShell **as Administrator**:

```powershell
# Download and run deploy script
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/Jkaseke1/RR-FDMS-/main/server/deploy.ps1" -OutFile "C:\deploy.ps1"
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process -Force
C:\deploy.ps1 -InstallDir "C:\FDMS\fdms-bridge"
```

This will:
- Clone the repository
- Install npm dependencies
- Create required directories (`C:\FDMS\unsigned`, `signed`, `failed`, `logs`)
- Create `.env` from template (you'll need to edit it)

### Step 3: Copy Secrets from Dev Machine

Copy these files from your development machine to the server:

| File | Source (Dev) | Destination (Server) |
|------|-------------|---------------------|
| `.env` | `C:\...\fdms-bridge\.env` | `C:\FDMS\fdms-bridge\.env` |
| Certificates | `certs\device.crt.pem` | `C:\FDMS\fdms-bridge\certs\` |
| | `certs\device.key.pem` | `C:\FDMS\fdms-bridge\certs\` |
| | `certs\fdms-root-ca.pem` | `C:\FDMS\fdms-bridge\certs\` |
| | `certs\fdms-chain.pem` | `C:\FDMS\fdms-bridge\certs\` |
| | `certs\RapidR-1.p12` | `C:\FDMS\fdms-bridge\certs\` |
| State | `C:\FDMS\state.json` | `C:\FDMS\state.json` |

> **Important:** `state.json` preserves receipt counters and fiscal day state.

### Step 4: Test

```powershell
cd C:\FDMS\fdms-bridge
node scripts\checkDeviceStatus.js
node scripts\openFiscalDayDirect.js
```

### Step 5: Install as Windows Service

```powershell
cd C:\FDMS\fdms-bridge
node setup-windows-service.js
```

This creates the **FDMSBridge** service that runs automatically on boot.

---

## Workflow: Making Changes via GitHub

### 1. Edit Code on Development Machine

Make changes to your code locally (on this computer).

### 2. Commit and Push

```powershell
git add -A
git commit -m "Your change description"
git push origin main
```

### 3. Update the Server

**Option A: Manual Update (Recommended)**

On the server, run:

```powershell
cd C:\FDMS\fdms-bridge
.\server\update.ps1
```

This will:
1. Pull latest changes from GitHub
2. Backup `.env` and `state.json`
3. Install new dependencies
4. Restart the FDMSBridge service

**Option B: Check for Updates Without Applying**

```powershell
.\server\update.ps1 -CheckOnly
```

**Option C: Auto-Update via GitHub Webhook**

For automatic deployment on every push:

1. On the server, start the webhook listener:
   ```powershell
   cd C:\FDMS\fdms-bridge
   node server\auto-update.js
   ```

2. Expose the server to internet:
   - Use ngrok for testing: `ngrok http 9000`
   - Or configure firewall to forward port 9000

3. In GitHub → Repository Settings → Webhooks → Add webhook:
   - **Payload URL:** `http://YOUR_SERVER:9000/webhook`
   - **Content type:** `application/json`
   - **Events:** Push only

4. Now every push to `main` automatically deploys to the server!

---

## Important Rules

### ✅ Do Commit to GitHub
- Source code (`src/`)
- Scripts (`scripts/`)
- Documentation (`.md` files)
- Package files (`package.json`, `package-lock.json`)
- Deployment scripts (`server/`)

### ❌ Do NOT Commit to GitHub
- `.env` file (contains passwords and keys)
- `certs/` folder (contains private certificates)
- `state.json` (contains live counters)
- `node_modules/` (installed by npm)
- Log files (`.log`)

These are already in `.gitignore` and won't be pushed.

---

## Troubleshooting

### Server Won't Update
```powershell
# Check git status
cd C:\FDMS\fdms-bridge
git status

# If there are local changes, stash them
git stash

# Then pull
git pull origin main
```

### Service Won't Start After Update
```powershell
# Check if .env was restored
Get-Content .env | Select-Object -First 5

# Check service status
Get-Service FDMSBridge

# Restart manually
Restart-Service FDMSBridge
```

### Certificates Missing After Update
```powershell
# Verify certs exist
Get-ChildItem certs\*

# If missing, copy from backup or dev machine
```

---

## Summary

| Action | Command |
|--------|---------|
| **First deploy** | `C:\deploy.ps1` |
| **Manual update** | `.\server\update.ps1` |
| **Check for updates** | `.\server\update.ps1 -CheckOnly` |
| **Auto-update** | `node server\auto-update.js` |
| **Start service** | `Start-Service FDMSBridge` |
| **Restart service** | `Restart-Service FDMSBridge` |
| **Check service** | `Get-Service FDMSBridge` |
| **View logs** | `Get-Content C:\FDMS\logs\app.log -Tail 50` |

---

## Next Steps

1. ✅ Run deploy script on server
2. ✅ Copy `.env` and certificates from dev machine
3. ✅ Test with `node scripts\checkDeviceStatus.js`
4. ✅ Open fiscal day with `node scripts\openFiscalDayDirect.js`
5. ✅ Install as Windows Service
6. ✅ Start processing invoices!

**For detailed setup:** See `SERVER_SETUP_GUIDE.md`
