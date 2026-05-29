# 🚀 Fiscalization Service Setup

## Overview

The Fiscalization Service connects your **FiscalizationDB** to **ZIMRA API** for real-time invoice fiscalization.

---

## 📋 Prerequisites

✅ FiscalizationDB created  
✅ 4 invoices queued  
✅ Stored procedures created  
✅ Node.js installed  

---

## 🔧 Configuration

### Update .env file:

```env
# Fiscalization Database
FISCAL_DB_SERVER=localhost\SQLEXPRESS
FISCAL_DB_NAME=FiscalizationDB
FISCAL_DB_USER=sa
FISCAL_DB_PASSWORD=your_password

# Fiscalization Service
FISCALIZATION_POLL_INTERVAL=10000

# ZIMRA API (already configured)
FDMS_DEVICE_ID=35224
FDMS_API_URL=https://fdmsapitest.zimra.co.zw
FDMS_CERT_PATH=./certs/device.pfx
FDMS_CERT_PASSWORD=your_cert_password
```

---

## 📦 Install Dependencies

```bash
npm install
```

This installs:
- ✅ `mssql` - SQL Server connector
- ✅ `axios` - HTTP client
- ✅ All other dependencies

---

## 🚀 Run Fiscalization Service

### Option 1: Process Once (Test)

```bash
npm run fiscalize:once
```

**What it does:**
- Connects to FiscalizationDB
- Gets first pending invoice
- Converts to ZIMRA format
- Submits to ZIMRA
- Updates database with receipt ID
- Exits

**Expected Output:**
```
============================================================
🔄 FISCALIZATION SERVICE (ONE-TIME)
============================================================

📋 Checking for pending invoices...

============================================================
📄 FISCALIZING INVOICE
============================================================
   Sage Invoice ID: 10103
   Customer: Rooneys Hire Services Pvt Ltd
   Amount: $5.00

🚀 Submitting to ZIMRA...
   ✅ Fiscalization successful!
   ZIMRA Receipt ID: 12345678
   Global No: RR-2026-0001

============================================================

📊 SUMMARY
============================================================
   Processed: 1
   Success: 1
   Failed: 0
============================================================
```

---

### Option 2: Continuous (Production)

```bash
npm run fiscalize:continuous
```

**What it does:**
- Connects to FiscalizationDB
- Polls every 10 seconds for pending invoices
- Automatically fiscalizes when found
- Runs forever (until stopped)
- Logs all events

**Expected Output:**
```
============================================================
🔄 FISCALIZATION SERVICE STARTED
============================================================
   Poll Interval: 10000ms
   Device ID: 35224
============================================================

📋 Checking for pending invoices...
✅ No pending invoices
```

---

## 📊 How It Works

### Real-Time Flow:

```
1. FiscalizationDB
   ↓
2. Get next pending invoice
   ↓
3. Convert to ZIMRA format
   ↓
4. Submit to ZIMRA API
   ↓
5. Receive ZIMRA Receipt ID
   ↓
6. Update database with receipt
   ↓
7. Log event in audit trail
   ↓
8. Move to next invoice
```

---

## 🔍 Monitor Progress

### Check Queue Status:

```sql
USE FiscalizationDB;
GO

-- View pending invoices
SELECT COUNT(*) AS Pending FROM fiscalization_queue WHERE status = 'pending';

-- View completed invoices
SELECT COUNT(*) AS Completed FROM fiscalization_queue WHERE status = 'completed';

-- View failed invoices
SELECT COUNT(*) AS Failed FROM fiscalization_queue WHERE status = 'failed';
```

### View Audit Trail:

```sql
-- See all events
SELECT * FROM fiscalization_log ORDER BY created_at DESC;

-- See latest status
SELECT 
    id,
    sage_auto_index,
    status,
    zimra_receipt_id,
    receipt_global_no,
    processed_at
FROM fiscalization_queue
ORDER BY processed_at DESC;
```

---

## ✅ Testing Workflow

### Step 1: Start Service (Once)

```bash
npm run fiscalize:once
```

### Step 2: Check Results

```sql
SELECT * FROM fiscalization_queue WHERE id = 1;
```

Should show:
- ✅ status = 'completed'
- ✅ zimra_receipt_id = (ZIMRA ID)
- ✅ receipt_global_no = 'RR-2026-0001'

### Step 3: Check Audit Log

```sql
SELECT * FROM fiscalization_log ORDER BY created_at DESC;
```

Should show events for the invoice.

---

## 🚨 Error Handling

### If Fiscalization Fails:

1. **Status** = 'failed'
2. **error_message** = Error details
3. **retry_count** = Incremented
4. **last_retry_at** = Timestamp

### Retry Failed Invoices:

```sql
-- Update failed invoice back to pending
UPDATE fiscalization_queue
SET status = 'pending', retry_count = 0
WHERE id = 1;
```

Then run:
```bash
npm run fiscalize:once
```

---

## 📊 Current Queue Status

| Status | Count |
|--------|-------|
| Pending | 3 |
| Processing | 0 |
| Completed | 1 |
| Failed | 0 |

---

## 🎯 Next Steps

1. ✅ Install dependencies: `npm install`
2. ✅ Update .env with database credentials
3. ✅ Test once: `npm run fiscalize:once`
4. ✅ Check results in database
5. ✅ Run continuous: `npm run fiscalize:continuous`

---

## 📞 Troubleshooting

### Error: "Cannot connect to FiscalizationDB"
- Check FISCAL_DB_SERVER in .env
- Check FISCAL_DB_USER and password
- Verify SQL Server is running

### Error: "No line items found"
- Check vw_sage_invoice_lines view
- Verify invoices have line items in Sage

### Error: "ZIMRA submission failed"
- Check ZIMRA API credentials
- Check device certificate
- Check network connection

---

**Ready to fiscalize your invoices!** 🚀
