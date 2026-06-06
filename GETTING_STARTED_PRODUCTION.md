# Getting Started with Production Credentials

## 🎉 Congratulations!

ZIMRA has approved your production credentials. Here's your complete action plan.

---

## 📦 What You Have Now (New Files Created)

We've prepared everything for production deployment:

### Setup Scripts
- **`setup-production.js`** - Interactive production configuration
- **`scripts/registerProductionDevice.js`** - Device registration with activation key
- **`scripts/resetForNewClient.js`** - Clean test data before going live

### Documentation
- **`PRODUCTION_QUICK_START.md`** - 5-step quick start (START HERE!)
- **`PRODUCTION_DEPLOYMENT.md`** - Complete production guide
- **`SERVER_QUICK_START.md`** - Server installation guide
- **`DEPLOYMENT_GUIDE.md`** - Full deployment manual

---

## 🎯 Your Exact Next Steps

### RIGHT NOW (Do These Steps)

#### 1. Gather Your ZIMRA Credentials

You should have received from ZIMRA:
```
Device ID:        ________________ (write it down)
Device Serial:    ________________ (write it down)
Activation Key:   ________________ (write it down)
Certificate:      □ .p12 file provided
                  □ Need to generate CSR
```

#### 2. Reset Test Data

Open PowerShell as Administrator:
```powershell
cd C:\FDMS\fdms-bridge
node scripts/resetForNewClient.js --confirm
```

This clears:
- Old test counters
- Old logs
- Old certificates

**Keeps:** Your source code and configuration files

#### 3. Run Production Setup

```powershell
node setup-production.js
```

Enter your ZIMRA credentials when prompted.
This automatically creates your `.env` file.

#### 4. Handle Certificate

**If ZIMRA gave you .p12 file:**
```powershell
# Copy to certs folder
copy "C:\Users\You\Downloads\your-cert.p12" "C:\FDMS\fdms-bridge\certs\"
```

**If you need to register with CSR:**
```powershell
node scripts/registerProductionDevice.js
```

#### 5. Test & Go Live

```powershell
# Test connection
node scripts/testConnection.js

# Check device
node scripts/checkDeviceStatus.js

# Open fiscal day
node scripts/openFiscalDay.js

# Start service
node index.js
```

---

## 📋 Complete Checklist

### Before You Start
- [ ] Have all ZIMRA credentials
- [ ] Server ready (Node.js installed)
- [ ] PowerShell open as Administrator
- [ ] Sage 200 configured for print-to-file

### During Setup
- [ ] Reset test data
- [ ] Run setup-production.js
- [ ] Add production certificate
- [ ] Test connection
- [ ] Verify device status
- [ ] Open fiscal day
- [ ] Start service

### After Going Live
- [ ] Print test invoice from Sage
- [ ] Verify fiscalization (check logs)
- [ ] Check QR code on PDF
- [ ] Verify on ZIMRA portal
- [ ] Set up daily backups
- [ ] Configure monitoring

---

## 🗂️ File Reference

### Start Here
```
PRODUCTION_QUICK_START.md      ← 5-step quick start
```

### During Setup
```
setup-production.js              ← Run this first
scripts/registerProductionDevice.js  ← If needed
scripts/resetForNewClient.js     ← Clear test data
```

### For Help
```
PRODUCTION_DEPLOYMENT.md       ← Complete guide
DEPLOYMENT_GUIDE.md            ← Full manual
SERVER_QUICK_START.md          ← Server setup
```

### Testing
```
scripts/testConnection.js      ← Test API connection
scripts/checkDeviceStatus.js   ← Check device
scripts/checkSystemStatus.js   ← Full system check
scripts/openFiscalDay.js       ← Open fiscal day
```

---

## ⚠️ Important Notes

### Test vs Production
- **Test Environment**: Already working with device 35224
- **Production Environment**: New device, new credentials
- **Receipts**: Test receipts are NOT valid for tax
- **Production receipts**: ARE valid for tax

### Certificate
- Production certificate is DIFFERENT from test
- Keep certificate password secure
- Backup certificate in safe location

### State File
- `C:\FDMS\state.json` tracks receipt counters
- Backup this file daily
- Don't delete unless resetting

### Fiscal Day
- Must be opened daily before processing invoices
- Can use `AUTO_OPEN_FISCAL_DAY=true` in `.env`
- Or manually: `node scripts/openFiscalDay.js`

---

## 🆘 Troubleshooting

### Problem: "Can't find setup-production.js"
**Solution**: Make sure you're in the fdms-bridge directory:
```powershell
cd C:\FDMS\fdms-bridge
```

### Problem: "Node.js not found"
**Solution**: Install Node.js from https://nodejs.org/

### Problem: "Certificate error"
**Solution**: 
1. Check certificate path in `.env`
2. Verify certificate password
3. Run: `node scripts/testConnection.js`

### Problem: "Device not registered"
**Solution**:
1. Check Device ID is correct
2. Verify activation key
3. Run: `node scripts/registerProductionDevice.js`

---

## 📞 Support Contacts

| Issue | Contact |
|-------|---------|
| ZIMRA API/Portal | fdms@zimra.co.zw |
| ZIMRA Phone | +263 4 758891-5 |
| Certificate Issues | ZIMRA IT Support |
| System Setup | See documentation |

---

## ✅ Success Criteria

You'll know production is working when:

1. ✅ Service starts without errors
2. ✅ `scripts/testConnection.js` returns success
3. ✅ Device status shows registered
4. ✅ Fiscal day is open
5. ✅ Sage invoice prints to `C:\FDMS\unsigned\`
6. ✅ PDF automatically moves to `C:\FDMS\signed\`
7. ✅ QR code appears on fiscalized PDF
8. ✅ Receipt visible on ZIMRA portal
9. ✅ All 3 tax types work correctly
10. ✅ Credit notes reference invoices properly

---

## 🚀 Ready to Start?

**Open PowerShell as Administrator and run:**

```powershell
cd C:\FDMS\fdms-bridge
node setup-production.js
```

**Follow the prompts and you'll be live in minutes!**

---

**Good luck with your production deployment! 🎉**
