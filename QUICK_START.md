# ZIMRA FDMS - Quick Start Guide

## ⚡ 20-Minute Setup

Get your complete ZIMRA FDMS system running in 20 minutes!

---

## 📋 Prerequisites

- [ ] Node.js 18+ installed
- [ ] npm installed
- [ ] Internet connection
- [ ] Text editor

---

## 🚀 Step-by-Step Setup

### 1️⃣ Supabase Setup (5 minutes)

#### A. Create Account
1. Go to https://supabase.com
2. Click "Start your project"
3. Sign up with GitHub or email

#### B. Create Project
1. Click "New Project"
2. Name: `zimra-fdms-bridge`
3. Generate password (SAVE IT!)
4. Region: Europe West (Ireland)
5. Click "Create new project"
6. Wait 2 minutes ☕

#### C. Get Credentials
1. Click Settings (⚙️) → API
2. Copy these:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon public**: `eyJhbGc...` (for dashboard)
   - **service_role**: `eyJhbGc...` (for bridge)

#### D. Run Migration
1. Click SQL Editor
2. Click "New Query"
3. Open `fdms-bridge/src/db/migrations/001_initial_schema.sql`
4. Copy ALL content
5. Paste in SQL Editor
6. Click "Run"
7. Verify: "Success. No rows returned"

#### E. Verify Tables
1. Click Table Editor
2. Check 8 tables exist:
   - fiscal_devices
   - fiscal_days
   - fiscal_receipts
   - fiscal_day_counters
   - applicable_taxes
   - sage_invoice_sync
   - fdms_error_log
   - fdms_ping_log

✅ **Supabase Ready!**

---

### 2️⃣ Backend Setup (5 minutes)

```bash
# Navigate to bridge
cd C:\Users\Joseph Kaseke\CascadeProjects\fdms-bridge

# Install dependencies
npm install

# Configure environment
copy .env.example .env
```

**Edit `.env` file**:
```env
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGc...  # Use service_role key!

FDMS_BASE_URL=https://fdmsapitest.zimra.co.zw
FDMS_DEVICE_SERIAL_NO=RRFDMS-RR-001
FDMS_DEVICE_MODEL_NAME=RRFDMS
FDMS_DEVICE_MODEL_VERSION=1.0.0

CUSTOMER_TIN=2002054676
CUSTOMER_VAT=220401569
CUSTOMER_NAME=Rapid Roots Investment Pvt Ltd
```

**Test connection**:
```bash
npm run test-connection
```

Expected:
```
✅ All required environment variables present
✅ Supabase connection successful
✅ FDMS API connection successful
```

✅ **Backend Ready!**

---

### 3️⃣ Dashboard Setup (5 minutes)

```bash
# Navigate to dashboard
cd C:\Users\Joseph Kaseke\CascadeProjects\fdms-dashboard

# Install dependencies
npm install

# Configure environment
copy .env.example .env
```

**Edit `.env` file**:
```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...  # Use anon public key!

VITE_COMPANY_NAME=Rapid Roots Investment Pvt Ltd
VITE_TIN=2002054676
VITE_VAT=220401569
```

**Start dashboard**:
```bash
npm run dev
```

Dashboard opens at: http://localhost:3000

✅ **Dashboard Ready!**

---

### 4️⃣ Device Registration (When you get Device ID)

```bash
cd C:\Users\Joseph Kaseke\CascadeProjects\fdms-bridge

# Register device
npm run setup [deviceID] [activationKey]

# Example:
npm run setup 12345 00850463
```

This will:
1. ✅ Verify taxpayer
2. ✅ Generate certificates
3. ✅ Register with ZIMRA
4. ✅ Fetch configuration
5. ✅ Update .env

**Update dashboard .env**:
```env
VITE_DEVICE_ID=12345
```

✅ **Device Registered!**

---

### 5️⃣ Start the System (5 minutes)

#### A. Start Backend
```bash
cd C:\Users\Joseph Kaseke\CascadeProjects\fdms-bridge
npm start
```

You should see:
```
✅ ZIMRA FDMS Bridge Started Successfully

Services running:
  ✅ Ping scheduler
  ✅ Config refresh
  ✅ Certificate renewal checker
  ✅ Nightly reconciliation
  ✅ Receipt queue processor
```

#### B. Start Dashboard
```bash
cd C:\Users\Joseph Kaseke\CascadeProjects\fdms-dashboard
npm run dev
```

Opens at: http://localhost:3000

✅ **System Running!**

---

## 🧪 Test the System

### Test 1: Open Fiscal Day

**In Dashboard**:
1. Go to "Fiscal Days" page
2. Click "Open Day" button
3. Verify day opened

**In Backend Logs**:
```
✅ Fiscal Day Opened Successfully
   Fiscal Day No: 1
```

### Test 2: Submit Receipt

Create test file `test-receipt.js`:
```javascript
const { submitReceipt } = require('./src/receipts/submitReceipt');

const receipt = {
  receiptType: 'FiscalInvoice',
  receiptCurrency: 'USD',
  invoiceNo: 'TEST-001',
  receiptTotal: 100.00,
  receiptLinesTaxInclusive: true,
  receiptLines: [{
    receiptLineNo: 1,
    receiptLineType: 'Sale',
    receiptLineName: 'Test Item',
    receiptLinePrice: 100.00,
    receiptLineQuantity: 1,
    receiptLineTotal: 100.00
  }],
  receiptTaxes: [{
    taxID: 1,
    taxPercent: 0,
    taxAmount: 0,
    salesAmountWithTax: 100.00
  }],
  receiptPayments: [{
    moneyType: 'Cash',
    paymentAmount: 100.00
  }]
};

submitReceipt(12345, receipt)
  .then(() => console.log('✅ Receipt submitted'))
  .catch(err => console.error('❌ Failed:', err));
```

Run:
```bash
node test-receipt.js
```

**In Dashboard**:
1. Go to "Receipts" page
2. See receipt appear
3. Click QR code
4. Verify on ZIMRA portal

### Test 3: Close Fiscal Day

**In Dashboard**:
1. Go to "Fiscal Days" page
2. Click "Close Day" button
3. Wait for confirmation
4. Verify day closed

✅ **System Working!**

---

## 📊 What You Have Now

### Backend (Running on Terminal 1)
- ✅ ZIMRA API integration
- ✅ Receipt processing
- ✅ Signature generation
- ✅ QR code creation
- ✅ Automated schedulers
- ✅ Error handling

### Dashboard (Running on Terminal 2)
- ✅ Real-time monitoring
- ✅ Receipt management
- ✅ Fiscal day control
- ✅ Error logs
- ✅ Certificate status

### Database (Supabase)
- ✅ 8 tables created
- ✅ Data persistence
- ✅ Real-time updates
- ✅ Backup & recovery

---

## 🎯 Daily Operations

### Morning
1. Open dashboard: http://localhost:3000
2. Check fiscal day status
3. Review any overnight errors

### During Day
1. Monitor receipt queue
2. Watch for failed receipts
3. Check certificate expiry

### Evening
1. Review day's receipts
2. Close fiscal day if needed
3. Check reconciliation report

---

## 🆘 Troubleshooting

### Backend won't start
```bash
# Check environment
npm run test-connection

# Check logs
npm start
```

### Dashboard shows no data
1. Check Supabase connection
2. Verify tables exist
3. Check browser console

### Receipts not submitting
1. Check fiscal day is open
2. Verify device registered
3. Check error logs

### Certificate errors
```bash
# Re-fetch server cert
cd fdms-bridge
npm run test-connection
```

---

## 📚 Documentation

### Detailed Guides
- `fdms-bridge/FINAL_STATUS.md` - Complete backend status
- `fdms-dashboard/SETUP_GUIDE.md` - Detailed setup
- `fdms-dashboard/SUPABASE_VISUAL_GUIDE.md` - Supabase walkthrough
- `COMPLETE_PROJECT_SUMMARY.md` - Full system overview

### API Reference
- ZIMRA Spec: Fiscal Device Gateway API v7.2
- Supabase Docs: https://supabase.com/docs

---

## 🚀 Production Deployment

### Backend
```bash
# Install PM2
npm install -g pm2

# Start with PM2
cd fdms-bridge
pm2 start index.js --name zimra-bridge
pm2 save
pm2 startup
```

### Dashboard
1. Build: `npm run build`
2. Deploy `dist/` to:
   - Netlify (recommended)
   - Vercel
   - Any static host

---

## ✅ Success Checklist

- [ ] Supabase account created
- [ ] Database migrated (8 tables)
- [ ] Backend configured & tested
- [ ] Dashboard configured & running
- [ ] Device registered with ZIMRA
- [ ] Fiscal day opened
- [ ] Test receipt submitted
- [ ] QR code verified
- [ ] Fiscal day closed
- [ ] System ready for production

---

## 🎉 You're Done!

**Total Time**: ~20 minutes  
**Status**: Production Ready ✅

Your complete ZIMRA FDMS system is now running!

### Next Steps:
1. Integrate with Sage ERP
2. Process real invoices
3. Monitor dashboard daily
4. Deploy to production

---

**Questions?** Check the detailed guides in each project folder.

**Support**: Refer to ZIMRA API spec v7.2 for compliance questions.

**Built for**: Rapid Roots Investment Pvt Ltd  
**Date**: May 20, 2026
