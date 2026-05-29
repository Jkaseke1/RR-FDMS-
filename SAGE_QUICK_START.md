# 🚀 Sage Pastel 200 v11 - Quick Start Guide

## ✅ What You Need

1. **Sage Pastel 200 v11** installed and running
2. **SQL Server** with Sage database
3. **Database credentials** (server, database name, username, password)
4. **ODBC Driver** for SQL Server (usually pre-installed)

---

## 🎯 Quick Setup (5 Steps)

### **Step 1: Install Dependencies**

```bash
npm install
```

This installs:
- `odbc` - Database connector
- `express` - API server
- All other dependencies

---

### **Step 2: Configure Sage Database**

Add to your `.env` file:

```env
# Sage Pastel Database Connection
SAGE_DB_DRIVER=SQL Server
SAGE_DB_SERVER=localhost\SQLEXPRESS
SAGE_DB_NAME=Pastel200
SAGE_DB_USER=sa
SAGE_DB_PASSWORD=your_password

# Bridge API
BRIDGE_API_URL=http://localhost:3001
POLL_INTERVAL=60000
```

**Find your Sage database:**
- Open Sage Pastel
- Go to Setup → Company Information
- Note the database name (usually "Pastel200" or company name)
- SQL Server is usually `localhost\SQLEXPRESS` or `.\SQLEXPRESS`

---

### **Step 3: Create Database Tables**

Run the migration in Supabase:

```sql
-- Copy and paste contents of:
database/migrations/002_create_invoice_bridge_tables.sql
```

This creates:
- `incoming_invoices` table
- `tax_code_mapping` table
- `payment_method_mapping` table
- And more...

---

### **Step 4: Configure Tax & Payment Mappings**

**Tax Codes (already pre-configured):**
```sql
-- Verify in Supabase
SELECT * FROM tax_code_mapping;
```

Common Sage tax codes are already mapped:
- `VAT` → ZIMRA Tax ID 1 (15.5%)
- `ZERO` → ZIMRA Tax ID 2 (0%)
- `EXEMPT` → ZIMRA Tax ID 3 (0%)

**Payment Methods (already pre-configured):**
```sql
-- Verify in Supabase
SELECT * FROM payment_method_mapping;
```

Common Sage payment methods are already mapped:
- `Cash` → CASH
- `Credit Card` → CARD
- `EcoCash` → MOBILE

---

### **Step 5: Start the System**

**Terminal 1 - Start Invoice Bridge API:**
```bash
npm run bridge-api
```

**Terminal 2 - Start Sage Sync:**
```bash
npm run sage:sync:continuous
```

---

## 🔄 How It Works

```
1. Create invoice in Sage Pastel
   ↓
2. Sage Connector reads from Sage database
   ↓
3. Converts to standard format
   ↓
4. Sends to Invoice Bridge API
   ↓
5. Bridge maps to ZIMRA format
   ↓
6. Submits to ZIMRA for fiscalization
   ↓
7. ZIMRA returns receipt ID + QR code
   ↓
8. Stored in database
   ↓
9. ✅ Invoice fiscalized!
```

---

## 📊 Commands

### One-Time Sync
```bash
npm run sage:sync
```
Syncs once and exits. Good for testing.

### Continuous Sync
```bash
npm run sage:sync:continuous
```
Runs continuously, checking every 60 seconds for new invoices.

### Start Bridge API
```bash
npm run bridge-api
```
Starts the Invoice Bridge API on port 3001.

---

## 🧪 Testing

### Test Database Connection
```bash
node -e "require('./src/integrations/sageConnector').connectToSage().then(() => console.log('✅ Connected')).catch(e => console.error('❌', e.message))"
```

### Test Reading Invoices
```bash
npm run sage:sync
```

Should show:
```
✅ Connected to Sage Pastel database
📋 Found X unfiscalized invoices
📄 Processing Sage Invoice: SI001234
   ✅ Fiscalized successfully
   ZIMRA Receipt ID: 12345678
```

---

## 🔍 Troubleshooting

### Error: "Cannot connect to database"
**Solution:**
- Check SQL Server is running
- Verify database name in `.env`
- Test with SQL Server Management Studio first

### Error: "Login failed for user"
**Solution:**
- Check username/password in `.env`
- Ensure SQL Server authentication is enabled
- Grant read permissions to the user

### Error: "Table not found"
**Solution:**
- Verify Sage database name is correct
- Check Sage version (should be v11 or later)
- Sage tables start with `_btbl` and `_etbl`

### No invoices found
**Solution:**
- Check invoices are Posted in Sage
- Check invoices are Printed in Sage
- Verify query in `sageConnector.js`

---

## 📋 What Gets Fiscalized

**From Sage Pastel:**
- ✅ Posted invoices
- ✅ Printed invoices
- ✅ Not yet fiscalized (not in `incoming_invoices` table)

**Excluded:**
- ❌ Draft invoices
- ❌ Unposted invoices
- ❌ Already fiscalized invoices

---

## 🎯 Production Deployment

### Option 1: Windows Service
Install as Windows Service using `node-windows`:

```bash
npm install -g node-windows
node install-service.js
```

### Option 2: PM2 Process Manager
```bash
npm install -g pm2
pm2 start api-server-invoices.js --name "invoice-bridge"
pm2 start src/integrations/sageConnector.js --name "sage-sync" -- continuous
pm2 save
pm2 startup
```

### Option 3: Task Scheduler
Create Windows Task to run sync every 5 minutes:
```
Program: node
Arguments: C:\path\to\fdms-bridge\src\integrations\sageConnector.js once
```

---

## 📊 Monitoring

### Check Sync Status
```sql
-- In Supabase
SELECT 
  status,
  COUNT(*) as count
FROM incoming_invoices
GROUP BY status;
```

### View Recent Invoices
```sql
SELECT * FROM todays_invoices;
```

### View Failed Invoices
```sql
SELECT * FROM failed_invoices;
```

---

## ✅ Success Checklist

- [ ] Sage Pastel database accessible
- [ ] Database tables created
- [ ] Tax codes mapped
- [ ] Payment methods mapped
- [ ] Bridge API running
- [ ] Sage sync running
- [ ] Test invoice fiscalized
- [ ] QR code generated
- [ ] Receipt ID received

---

## 🎉 You're Ready!

Once everything is set up:

1. Create an invoice in Sage Pastel
2. Post and print it
3. Wait 60 seconds (or run manual sync)
4. Check database for fiscalized receipt
5. ZIMRA receipt ID and QR code will be stored

**Your Sage Pastel invoices are now automatically fiscalized with ZIMRA!** 🚀
