# ZIMRA FDMS Bridge - Production Deployment Guide

## 🎉 You Have Production Credentials!

This guide will help you transition from **TEST** environment to **PRODUCTION** using your new ZIMRA credentials.

---

## 📋 What ZIMRA Provided You

You should have received:
- ✅ **Production Device ID** (different from test Device ID 35224)
- ✅ **Device Serial Number** (may be same or different from RapidR-1)
- ✅ **Activation Key** (used for device registration)
- ✅ **Certificate** (.p12 file or you need to generate CSR)

---

## 🚀 Quick Production Setup (10 Minutes)

### Step 1: Run Interactive Setup Script

```powershell
cd C:\FDMS\fdms-bridge
node setup-production.js
```

This will prompt you for:
- Device ID
- Device Serial Number  
- Activation Key
- Certificate Password
- Company details
- Server paths

It will automatically create:
- `.env` file with production settings
- Directory structure
- Configuration files

### Step 2: Reset for Production

Clear test data before going live:

```powershell
# DRY RUN first (see what will be deleted)
node scripts/resetForNewClient.js

# ACTUALLY RESET (when ready)
node scripts/resetForNewClient.js --confirm
```

**This deletes:**
- `C:\FDMS\state.json` (counters, fiscal day info)
- `C:\FDMS\logs\*.log` (old logs)
- `certs\*` (old test certificates)

**This does NOT delete:**
- Source code
- `.env` file
- Configuration

### Step 3: Add Production Certificate

Copy your ZIMRA production certificate to:
```
C:\FDMS\fdms-bridge\certs\[DeviceSerial].p12
```

If ZIMRA didn't provide a .p12 file and you need to register with CSR:

```powershell
# Generate certificate signing request
node scripts/testRegisterDevice.js
```

You'll need to:
1. Generate a CSR (Certificate Signing Request)
2. Submit to ZIMRA with your activation key
3. ZIMRA will return a signed certificate
4. Save the certificate as .p12 file

### Step 4: Test Production Connection

```powershell
# Test ZIMRA API connection
node scripts/testConnection.js

# Check device registration
node scripts/checkDeviceRegistration.js

# Check device status
node scripts/checkDeviceStatus.js

# Full system check
node scripts/checkSystemStatus.js
```

### Step 5: Open Fiscal Day

```powershell
# Open fiscal day for production
node scripts/openFiscalDay.js
```

### Step 6: Start Production Service

```powershell
# Option A: Run manually (for testing)
node index.js

# Option B: Install as Windows Service (for production)
node setup-windows-service.js
```

---

## 🔧 Manual Configuration (Alternative)

If you prefer to configure manually, edit `.env`:

```env
# ============================================
# CRITICAL: Switch to Production
# ============================================
NODE_ENV=production
FDMS_URL=https://fdmsapi.zimra.co.zw

# ============================================
# YOUR NEW PRODUCTION CREDENTIALS
# ============================================
DEVICE_SERIAL=YOUR_NEW_SERIAL
DEVICE_ID=YOUR_NEW_DEVICE_ID
CERT_PASSWORD=YOUR_CERT_PASSWORD

# ============================================
# CERTIFICATE PATH
# ============================================
CERT_PATH=./certs/YOUR_CERT_FILENAME.p12
```

---

## 📊 Test vs Production Differences

| Setting | Test | Production |
|---------|------|------------|
| API URL | `fdmsapitest.zimra.co.zw` | `fdmsapi.zimra.co.zw` |
| Device ID | 35224 | Your new ID |
| Device Serial | RapidR-1 | Your new serial |
| Certificate | Test cert | Production cert |
| Receipts | Not valid for tax | Valid for tax |

---

## ✅ Production Verification Checklist

Before processing real invoices:

- [ ] `.env` has `NODE_ENV=production`
- [ ] `.env` has `FDMS_URL=https://fdmsapi.zimra.co.zw`
- [ ] `.env` has new `DEVICE_ID` from ZIMRA
- [ ] `.env` has new `DEVICE_SERIAL` from ZIMRA
- [ ] Production certificate copied to `certs\` folder
- [ ] `scripts/testConnection.js` returns success
- [ ] `scripts/checkDeviceStatus.js` shows device registered
- [ ] Fiscal day is open
- [ ] `C:\FDMS\state.json` is clean (counters reset)
- [ ] Service starts without errors
- [ ] Test invoice processes successfully
- [ ] ZIMRA portal shows receipt as valid

---

## 🧪 Testing Production Setup

### Test 1: Connection
```powershell
node scripts/testConnection.js
```
Expected: ✅ Certificate valid, API accessible

### Test 2: Device Status
```powershell
node scripts/checkDeviceStatus.js
```
Expected: ✅ Device registered, fiscal day status shown

### Test 3: Open Fiscal Day
```powershell
node scripts/openFiscalDay.js
```
Expected: ✅ Fiscal day opened successfully

### Test 4: Process Test Invoice
1. Copy a test PDF to `C:\FDMS\unsigned\`
2. Wait 10 seconds
3. Check `C:\FDMS\signed\` for fiscalized PDF
4. Verify QR code on PDF
5. Check ZIMRA portal for receipt

---

## 🔄 Switching Between Test and Production

If you need to switch back to test:

```powershell
# Create test .env backup
Copy-Item .env .env.production

# Edit .env for test
# Change FDMS_URL to https://fdmsapitest.zimra.co.zw
# Change DEVICE_ID back to 35224
# Change DEVICE_SERIAL back to RapidR-1
```

To switch back to production:
```powershell
# Restore production .env
Copy-Item .env.production .env
```

---

## 🛡️ Production Security

### Certificate Protection
- Store certificate password securely
- Restrict access to `certs\` folder
- Backup certificates in secure location

### Access Control
- Limit `C:\FDMS\` folder access to administrators
- Use Windows Service with limited permissions
- Monitor logs for unauthorized access

### Backup Strategy
- Backup `C:\FDMS\state.json` daily
- Backup fiscalized PDFs (`C:\FDMS\signed\`)
- Backup logs (`C:\FDMS\logs\`)
- Test restore procedures monthly

---

## 📞 Troubleshooting Production Issues

### "Device not registered"
- Verify Device ID matches ZIMRA records
- Check activation key was used correctly
- Run: `node scripts/testRegisterDevice.js`

### "Certificate error"
- Verify certificate path in `.env`
- Check certificate password
- Ensure certificate is not expired
- Run: `node scripts/testConnection.js`

### "Fiscal day closed"
- Open fiscal day: `node scripts/openFiscalDay.js`
- Verify device is operational
- Check ZIMRA portal for device status

### "Invalid tax is used"
- Check tax codes in Sage match ZIMRA config
- Verify tax mapping in `pdfFiscalizationService.js`
- Ensure all 3 tax types configured (Standard, Zero, Exempt)

---

## 📈 Going Live Checklist

Before processing real customer invoices:

1. **Verify Configuration**
   - [ ] All `.env` values correct
   - [ ] Production API URL
   - [ ] Production Device ID/Serial

2. **Test End-to-End**
   - [ ] Print test invoice from Sage
   - [ ] PDF fiscalized automatically
   - [ ] QR code on fiscalized PDF
   - [ ] Receipt visible on ZIMRA portal

3. **Verify Tax Handling**
   - [ ] Standard VAT (15.5%) works
   - [ ] Zero-rated (0%) works
   - [ ] Exempt (null) works

4. **Check Credit Notes**
   - [ ] Credit note references invoice
   - [ ] Negative amounts correct
   - [ ] All tax types preserved

5. **Confirm Production Ready**
   - [ ] Service running stable
   - [ ] No errors in logs
   - [ ] Backup working
   - [ ] Monitoring in place

---

## 🎉 You're Live!

Once all checks pass, your system is ready for production!

The FDMS Bridge will now:
- ✅ Process real invoices from Sage
- ✅ Fiscalize with production ZIMRA API
- ✅ Generate valid tax receipts
- ✅ Stamp QR codes on PDFs
- ✅ Store everything securely

**Welcome to production! 🚀**

---

## 📞 Support

- **ZIMRA**: fdms@zimra.co.zw | +263 4 758891-5
- **Documentation**: See DEPLOYMENT_GUIDE.md
- **Diagnostics**: Run `node scripts/checkSystemStatus.js`
