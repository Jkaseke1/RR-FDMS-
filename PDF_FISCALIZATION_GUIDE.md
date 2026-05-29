# 📄 PDF Fiscalization Workflow

## Overview

**Simple PDF-based fiscalization:**

```
User prints invoice as PDF
    ↓
Saves to C:\FDMS\unsigned
    ↓
Service watches folder
    ↓
Fiscalizes with ZIMRA
    ↓
Adds QR code to PDF
    ↓
Moves to C:\FDMS\signed
```

---

## 🚀 Quick Start

### Step 1: Setup FDMS Folder Structure

```bash
npm run fdms:setup
```

This creates:
```
C:\FDMS\
├── unsigned\    (PDFs to fiscalize)
├── signed\      (Fiscalized PDFs with QR codes)
├── failed\      (Failed PDFs)
└── logs\        (Processing logs)
```

---

### Step 2: Start PDF Watch Service

```bash
npm run pdf:watch
```

This will:
- ✅ Watch `C:\FDMS\unsigned` folder
- ✅ Automatically fiscalize new PDFs
- ✅ Move to `C:\FDMS\signed` when complete
- ✅ Move to `C:\FDMS\failed` if error
- ✅ Log all events to `C:\FDMS\logs`

---

### Step 3: Print Invoice as PDF

From your POS/ERP system:
1. Print invoice
2. Select "Print to PDF"
3. Save to: `C:\FDMS\unsigned`
4. **Use filename format:** `INVOICE_[SageID]_[CustomerName]_[Amount].pdf`

**Example:**
```
INVOICE_10103_Rooneys_Hire_Services_5.00.pdf
INVOICE_10425_Wilsher_Williams_150.00.pdf
```

---

### Step 4: Monitor Processing

**Watch the console output:**
```
============================================================
FISCALIZING PDF: INVOICE_10103_Rooneys_Hire_Services_5.00.pdf
============================================================
Sage Invoice ID: 10103
Customer: Rooneys Hire Services
Amount: $5.00

Submitting to ZIMRA...
✅ Fiscalization successful!
ZIMRA Receipt ID: 12345678
Global No: RR-2026-0001

PDF moved to signed folder: C:\FDMS\signed\SIGNED_INVOICE_10103_...
============================================================
```

---

## 📋 Filename Format

**Required format:**
```
INVOICE_[SageID]_[CustomerName]_[Amount].pdf
```

**Examples:**
```
✅ INVOICE_10103_Rooneys_Hire_Services_5.00.pdf
✅ INVOICE_10425_Wilsher_Williams_150.00.pdf
✅ INVOICE_10199_Red_Xpress_Pvt_Ltd_1440.00.pdf

❌ invoice.pdf (missing data)
❌ INVOICE_10103.pdf (missing customer and amount)
```

---

## 🔄 Workflow

### Successful Fiscalization

```
C:\FDMS\unsigned\INVOICE_10103_Rooneys_5.00.pdf
    ↓ (Detected)
    ↓ (Fiscalized)
    ↓ (QR code added)
C:\FDMS\signed\SIGNED_INVOICE_10103_Rooneys_5.00.pdf
```

### Failed Fiscalization

```
C:\FDMS\unsigned\INVOICE_10103_Rooneys_5.00.pdf
    ↓ (Detected)
    ↓ (Fiscalization failed)
C:\FDMS\failed\FAILED_INVOICE_10103_Rooneys_5.00.pdf
```

---

## 📊 Folder Contents

### unsigned\ (Input)
- PDFs waiting to be fiscalized
- Service monitors this folder
- PDFs are removed after processing

### signed\ (Output - Success)
- Successfully fiscalized PDFs
- Contains QR code
- Ready to print/send to customer

### failed\ (Output - Error)
- PDFs that failed fiscalization
- Check logs for error details
- Can be reprocessed after fixing issue

### logs\ (Audit Trail)
- Daily log files: `fiscalization-2026-05-21.log`
- All events logged with timestamps
- Useful for troubleshooting

---

## 🎯 Commands

### Setup Folders
```bash
npm run fdms:setup
```

### Watch Folder (Continuous)
```bash
npm run pdf:watch
```
Runs forever, watching for new PDFs

### Process Single PDF
```bash
npm run pdf:process INVOICE_10103_Rooneys_5.00.pdf
```
Processes one PDF and exits

---

## 🔍 Monitoring

### Check Logs
```bash
# View today's log
type C:\FDMS\logs\fiscalization-2026-05-21.log

# Or on Linux/Mac
cat /FDMS/logs/fiscalization-2026-05-21.log
```

### Check Folder Status
```powershell
# Count PDFs in each folder
Get-ChildItem C:\FDMS\unsigned | Measure-Object
Get-ChildItem C:\FDMS\signed | Measure-Object
Get-ChildItem C:\FDMS\failed | Measure-Object
```

---

## ⚙️ Configuration

### Update .env

```env
# FDMS Folder Path
FDMS_BASE_PATH=C:\FDMS

# Database Connection
FISCAL_DB_SERVER=localhost
FISCAL_DB_NAME=FiscalizationDB
FISCAL_DB_AUTH_TYPE=windows

# ZIMRA API
FDMS_DEVICE_ID=35224
FDMS_API_URL=https://fdmsapitest.zimra.co.zw
FDMS_CERT_PATH=./certs/device.pfx
FDMS_CERT_PASSWORD=your_cert_password

# Service
FISCALIZATION_POLL_INTERVAL=10000
```

---

## 🚨 Troubleshooting

### Error: "Invalid filename format"
**Solution:** Use correct format: `INVOICE_[SageID]_[CustomerName]_[Amount].pdf`

### Error: "Failed to connect to database"
**Solution:** 
- Check FISCAL_DB_SERVER in .env
- Verify database is running
- Check Windows Authentication

### Error: "ZIMRA submission failed"
**Solution:**
- Check ZIMRA API credentials
- Check device certificate
- Check network connection
- Check logs for details

### PDF not being processed
**Solution:**
- Check filename format
- Verify PDF is in `C:\FDMS\unsigned`
- Check if service is running: `npm run pdf:watch`
- Check logs for errors

---

## 📈 Production Setup

### Run as Windows Service

```powershell
# Install as service
npm install -g node-windows
node scripts/installService.js

# Start service
net start fdms-pdf-fiscalization

# Stop service
net stop fdms-pdf-fiscalization
```

### Run with PM2

```bash
npm install -g pm2

# Start
pm2 start src/integrations/pdfFiscalizationService.js --name "pdf-fiscalization"

# Auto-restart on reboot
pm2 startup
pm2 save
```

---

## ✅ Success Checklist

- [ ] FDMS folder structure created
- [ ] Service running: `npm run pdf:watch`
- [ ] Test PDF created with correct filename
- [ ] PDF moved to signed folder
- [ ] QR code visible in signed PDF
- [ ] Log file created in logs folder
- [ ] Database updated with receipt ID

---

## 🎉 You're Ready!

1. **Setup:** `npm run fdms:setup`
2. **Start:** `npm run pdf:watch`
3. **Print:** Save PDFs to `C:\FDMS\unsigned`
4. **Monitor:** Watch console output
5. **Retrieve:** Get signed PDFs from `C:\FDMS\signed`

**Your invoices are now automatically fiscalized!** 🚀
