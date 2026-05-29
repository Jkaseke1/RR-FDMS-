# ZIMRA FDMS Dashboard - Complete Setup Guide

## Part 1: Supabase Setup

### Step 1: Create Supabase Account

1. Go to https://supabase.com
2. Click "Start your project"
3. Sign up with GitHub (recommended) or email
4. Verify your email if required

### Step 2: Create New Project

1. Click "New Project"
2. Select or create an Organization
3. Fill in project details:
   - **Name**: `zimra-fdms-bridge`
   - **Database Password**: Generate strong password (SAVE THIS!)
   - **Region**: Choose closest to Zimbabwe:
     - `eu-west-1` (Ireland) - recommended
     - `ap-southeast-1` (Singapore)
     - `us-east-1` (N. Virginia)
   - **Pricing Plan**: Free tier is sufficient for testing
4. Click "Create new project"
5. Wait 2-3 minutes for provisioning

### Step 3: Get API Credentials

1. Once project is ready, click **Settings** (gear icon, bottom left)
2. Click **API** in the sidebar
3. Copy these values:

```
Project URL: https://xxxxxxxxxxxxx.supabase.co
anon public key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
service_role key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Important**:
- `anon public` key → Use in dashboard (frontend)
- `service_role` key → Use in bridge (backend) - KEEP SECRET!

### Step 4: Run Database Migration

1. Click **SQL Editor** (left sidebar)
2. Click **New Query**
3. Open `fdms-bridge/src/db/migrations/001_initial_schema.sql`
4. Copy ALL contents (entire file)
5. Paste into Supabase SQL Editor
6. Click **Run** (or press Ctrl+Enter)
7. Wait for completion
8. You should see: "Success. No rows returned"

### Step 5: Verify Tables Created

1. Click **Table Editor** (left sidebar)
2. You should see 8 tables:
   - ✅ fiscal_devices
   - ✅ fiscal_days
   - ✅ fiscal_receipts
   - ✅ fiscal_day_counters
   - ✅ applicable_taxes
   - ✅ sage_invoice_sync
   - ✅ fdms_error_log
   - ✅ fdms_ping_log

3. Click on each table to verify structure

### Step 6: Configure Row Level Security (Optional - For Production)

For development, you can skip this. For production:

1. Go to **Authentication** → **Policies**
2. Run this SQL:

```sql
-- Enable RLS
ALTER TABLE fiscal_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiscal_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE fdms_error_log ENABLE ROW LEVEL SECURITY;

-- Allow read access
CREATE POLICY "Allow read access" ON fiscal_receipts
  FOR SELECT USING (true);

CREATE POLICY "Allow read access" ON fiscal_days
  FOR SELECT USING (true);

CREATE POLICY "Allow read access" ON fdms_error_log
  FOR SELECT USING (true);

-- Allow updates for retry functionality
CREATE POLICY "Allow update receipts" ON fiscal_receipts
  FOR UPDATE USING (true);

CREATE POLICY "Allow update errors" ON fdms_error_log
  FOR UPDATE USING (true);
```

---

## Part 2: Backend Setup (FDMS Bridge)

### Step 1: Configure Backend Environment

1. Navigate to bridge folder:
```bash
cd C:\Users\Joseph Kaseke\CascadeProjects\fdms-bridge
```

2. Copy environment file:
```bash
copy .env.example .env
```

3. Edit `.env` and add:
```env
# Supabase
SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGc...  # Use service_role key!

# FDMS
FDMS_BASE_URL=https://fdmsapitest.zimra.co.zw
FDMS_DEVICE_SERIAL_NO=RRFDMS-RR-001
FDMS_DEVICE_MODEL_NAME=RRFDMS
FDMS_DEVICE_MODEL_VERSION=1.0.0
FDMS_DEVICE_ID=  # Leave empty for now

# Certificates
FDMS_CERT_PATH=./certs/device.cert.pem
FDMS_KEY_PATH=./certs/device.key.pem
FDMS_CA_PATH=./certs/fdms-root-ca.pem

# Customer
CUSTOMER_TIN=2002054676
CUSTOMER_VAT=220401569
CUSTOMER_NAME=Rapid Roots Investment Pvt Ltd
```

### Step 2: Install Backend Dependencies

```bash
npm install
```

### Step 3: Test Connection

```bash
npm run test-connection
```

Expected output:
```
✅ All required environment variables present
✅ Supabase connection successful
✅ FDMS API connection successful
```

---

## Part 3: Dashboard Setup

### Step 1: Configure Dashboard Environment

1. Navigate to dashboard folder:
```bash
cd C:\Users\Joseph Kaseke\CascadeProjects\fdms-dashboard
```

2. Copy environment file:
```bash
copy .env.example .env
```

3. Edit `.env` and add:
```env
# Supabase (use anon key for frontend!)
VITE_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...  # Use anon public key!

# Device (optional - for display)
VITE_DEVICE_ID=
VITE_COMPANY_NAME=Rapid Roots Investment Pvt Ltd
VITE_TIN=2002054676
VITE_VAT=220401569
```

**CRITICAL**: Use `anon public` key, NOT `service_role` key!

### Step 2: Install Dashboard Dependencies

```bash
npm install
```

### Step 3: Start Dashboard

```bash
npm run dev
```

Dashboard will open at: http://localhost:3000

---

## Part 4: First Run

### Step 1: Register Device (When you get Device ID from ZIMRA)

```bash
cd C:\Users\Joseph Kaseke\CascadeProjects\fdms-bridge
npm run setup [deviceID] [activationKey]
```

Example:
```bash
npm run setup 12345 00850463
```

This will:
1. Verify taxpayer
2. Generate certificates
3. Register with ZIMRA
4. Fetch configuration
5. Update `.env` with device ID

### Step 2: Update Dashboard .env

After registration, update dashboard `.env`:
```env
VITE_DEVICE_ID=12345
```

### Step 3: Start Backend Bridge

```bash
cd C:\Users\Joseph Kaseke\CascadeProjects\fdms-bridge
npm start
```

### Step 4: View Dashboard

Open http://localhost:3000

You should see:
- Dashboard with stats
- Empty receipts list
- No fiscal day open
- No errors

---

## Part 5: Test the System

### Step 1: Open Fiscal Day

In dashboard:
1. Go to "Fiscal Days" page
2. Click "Open Day" button
3. Verify fiscal day opened
4. Check backend logs

### Step 2: Submit Test Receipt

Create test receipt (via API or script):
```javascript
// Example test receipt
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
```

### Step 3: Monitor Dashboard

1. Go to "Receipts" page
2. See receipt in queue
3. Watch status change to "submitted"
4. Click QR code to verify on ZIMRA portal

### Step 4: Close Fiscal Day

1. Go to "Fiscal Days" page
2. Click "Close Day" button
3. Wait for confirmation
4. Verify day closed successfully

---

## Troubleshooting

### Dashboard shows "Missing Supabase environment variables"

**Solution**:
- Check `.env` file exists in `fdms-dashboard/`
- Verify variable names start with `VITE_`
- Restart dev server: `npm run dev`

### Backend can't connect to Supabase

**Solution**:
- Check you're using `service_role` key (not `anon`)
- Verify Supabase URL is correct
- Check internet connection

### Tables not showing in dashboard

**Solution**:
- Verify database migration ran successfully
- Check table names in Supabase Table Editor
- Verify RLS policies if enabled

### Certificate errors

**Solution**:
- Run `npm run test-connection` first
- Check `certs/` folder exists
- Verify OpenSSL is installed

---

## Production Deployment

### Backend (FDMS Bridge)

**Option 1: PM2 (Recommended)**

```bash
npm install -g pm2
pm2 start index.js --name zimra-bridge
pm2 save
pm2 startup
```

**Option 2: Docker**

Create `Dockerfile`:
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
CMD ["node", "index.js"]
```

### Dashboard

**Option 1: Netlify**

1. Push to GitHub
2. Connect to Netlify
3. Build: `npm run build`
4. Publish: `dist`
5. Add environment variables

**Option 2: Vercel**

1. Push to GitHub
2. Import to Vercel
3. Framework: Vite
4. Add environment variables

---

## Summary Checklist

### Supabase
- [x] Account created
- [x] Project created
- [x] API credentials copied
- [x] Database migration run
- [x] Tables verified

### Backend
- [x] Dependencies installed
- [x] `.env` configured
- [x] Connection tested
- [x] Device registered (when ID received)

### Dashboard
- [x] Dependencies installed
- [x] `.env` configured
- [x] Dev server running
- [x] Connected to Supabase

### Testing
- [x] Fiscal day opened
- [x] Receipt submitted
- [x] QR code verified
- [x] Fiscal day closed

---

**Setup Complete! 🎉**

Your ZIMRA FDMS system is now ready for production use.
