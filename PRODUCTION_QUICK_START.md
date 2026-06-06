# Production Quick Start

## 🎯 You Have Production Credentials from ZIMRA!

Here's exactly what to do **RIGHT NOW**:

---

## 📋 What You Need From ZIMRA

Make sure you have these 4 items:
1. **Production Device ID** (number, e.g., 12345)
2. **Device Serial Number** (e.g., RapidRoots-Prod-1)
3. **Activation Key** (for device registration)
4. **Certificate** (.p12 file OR instructions to generate CSR)

---

## 🚀 5-Step Production Setup

### STEP 1: Reset Test Data (2 minutes)

Open PowerShell as Administrator:

```powershell
cd C:\FDMS\fdms-bridge

# See what will be reset (dry run)
node scripts/resetForNewClient.js

# Actually reset (when ready)
node scripts/resetForNewClient.js --confirm
```

**What this does:**
- Clears old test counters
- Removes old logs
- Removes old test certificates
- Keeps your source code and config

---

### STEP 2: Configure Production Settings (2 minutes)

Run the interactive setup:

```powershell
node setup-production.js
```

**Enter your details when prompted:**
- Device ID: (from ZIMRA)
- Device Serial: (from ZIMRA)
- Activation Key: (from ZIMRA)
- Certificate Password: (create one or from ZIMRA)

This creates your `.env` file automatically.

---

### STEP 3: Add Production Certificate (2 minutes)

**Option A: ZIMRA gave you a .p12 file**

Copy it to:
```
C:\FDMS\fdms-bridge\certs\[YourDeviceSerial].p12
```

**Option B: You need to register with CSR**

```powershell
node scripts/registerProductionDevice.js
```

Follow prompts to:
1. Submit CSR + Activation Key to ZIMRA
2. Receive certificate
3. Save as .p12 file in certs folder

---

### STEP 4: Test Everything (3 minutes)

```powershell
# Test 1: Connection
node scripts/testConnection.js

# Test 2: Device Status
node scripts/checkDeviceStatus.js

# Test 3: System Check
node scripts/checkSystemStatus.js

# Test 4: Open Fiscal Day
node scripts/openFiscalDay.js
```

**Expected Results:**
- ✅ Connection successful
- ✅ Device registered
- ✅ Fiscal day opened
- ✅ No errors

---

### STEP 5: Start Production Service (1 minute)

**For testing:**
```powershell
node index.js
```

**For production (install as service):**
```powershell
node setup-windows-service.js
```

---

## ✅ Production Verification

### Test with Real Invoice

1. **Configure Sage 200** to print to:
   ```
   C:\FDMS\unsigned\
   ```

2. **Print a test invoice** from Sage

3. **Wait 10 seconds** for processing

4. **Check results:**
   - PDF in `C:\FDMS\signed\` ✅
   - QR code on PDF ✅
   - No errors in logs ✅

5. **Verify on ZIMRA portal**

---

## 🔄 Switching Test ↔ Production

### To Production:
```powershell
# .env should have:
NODE_ENV=production
FDMS_URL=https://fdmsapi.zimra.co.zw
DEVICE_ID=YOUR_PROD_ID
DEVICE_SERIAL=YOUR_PROD_SERIAL
```

### To Test:
```powershell
# .env should have:
NODE_ENV=test
FDMS_URL=https://fdmsapitest.zimra.co.zw
DEVICE_ID=35224
DEVICE_SERIAL=RapidR-1
```

---

## 🆘 Common Issues

### "Device not registered"
```powershell
# Check registration
node scripts/registerProductionDevice.js
# or
node scripts/checkDeviceRegistration.js
```

### "Certificate error"
```powershell
# Verify certificate
node scripts/testConnection.js
# Check CERT_PATH and CERT_PASSWORD in .env
```

### "Fiscal day closed"
```powershell
# Open it
node scripts/openFiscalDay.js
```

---

## 📞 Need Help?

**ZIMRA Support:**
- Email: fdms@zimra.co.zw
- Phone: +263 4 758891-5

**Full Guides:**
- `PRODUCTION_DEPLOYMENT.md` - Complete guide
- `DEPLOYMENT_GUIDE.md` - Full documentation
- `SERVER_QUICK_START.md` - Server setup

**Diagnostics:**
```powershell
node scripts/checkSystemStatus.js
```

---

## 🎉 Done!

Your production system is now live and processing real invoices!

**Remember:**
- Monitor logs daily: `C:\FDMS\logs\`
- Backup state.json: `C:\FDMS\state.json`
- Open fiscal day each morning

**Good luck! 🚀**
