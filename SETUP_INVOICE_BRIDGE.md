# 🌉 Setup Invoice Bridge - Complete Guide

## 📋 Overview

This guide shows you how to set up the invoice bridge to receive invoices from your POS/ERP system and fiscalize them with ZIMRA.

---

## ✅ Step 1: Create Database Tables

Run the SQL migration to create all required tables:

```bash
# Connect to your Supabase database and run:
psql -h your-supabase-host -U postgres -d postgres -f database/migrations/002_create_invoice_bridge_tables.sql
```

**Or** run directly in Supabase SQL Editor:
1. Go to Supabase Dashboard → SQL Editor
2. Copy contents of `database/migrations/002_create_invoice_bridge_tables.sql`
3. Click "Run"

**Tables Created:**
- ✅ `incoming_invoices` - Stores your invoices
- ✅ `invoice_line_items` - Line item details
- ✅ `tax_code_mapping` - Maps your tax codes to ZIMRA
- ✅ `payment_method_mapping` - Maps payment methods
- ✅ `invoice_mapping_rules` - Flexible mapping config
- ✅ `invoice_processing_log` - Audit trail

---

## ✅ Step 2: Configure Tax Code Mapping

The migration already creates default mappings. Verify and customize:

```sql
SELECT * FROM tax_code_mapping;
```

**Add your custom tax codes:**
```sql
INSERT INTO tax_code_mapping (
  your_tax_code,
  your_tax_name,
  your_tax_rate,
  zimra_tax_id,
  zimra_tax_percent,
  zimra_tax_label
) VALUES (
  'STANDARD_VAT',  -- Your code
  'Standard VAT',  -- Your name
  15.5,            -- Your rate
  1,               -- ZIMRA tax ID
  15.5,            -- ZIMRA rate
  'A-15.5%'        -- ZIMRA label
);
```

---

## ✅ Step 3: Configure Payment Method Mapping

Verify default mappings:

```sql
SELECT * FROM payment_method_mapping;
```

**Add your custom payment methods:**
```sql
INSERT INTO payment_method_mapping (
  your_payment_code,
  your_payment_name,
  zimra_money_type
) VALUES (
  'ecocash',       -- Your code
  'EcoCash',       -- Your name
  'MOBILE'         -- ZIMRA type
);
```

---

## ✅ Step 4: Start Invoice Bridge API

```bash
# Install dependencies (if not already done)
npm install express

# Start the invoice bridge API
node api-server-invoices.js
```

**Output:**
```
============================================================
🌉 INVOICE BRIDGE API SERVER STARTED
============================================================
   Port: 3001
   Device ID: 35224
   Environment: development
============================================================

📡 API Endpoints:
   POST   http://localhost:3001/api/invoices
   POST   http://localhost:3001/api/debit-notes
   POST   http://localhost:3001/api/credit-notes
   GET    http://localhost:3001/api/invoices/:id/status
   GET    http://localhost:3001/api/invoices/:id/receipt
============================================================

✅ Ready to receive invoices from your POS/ERP system!
```

---

## ✅ Step 5: Test with Sample Invoice

Send a test invoice:

```bash
curl -X POST http://localhost:3001/api/invoices \
  -H "Content-Type: application/json" \
  -d @examples/your-invoice-template.json
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Invoice fiscalized successfully",
  "data": {
    "invoice_id": "...",
    "source_invoice_id": "POS-2024-001",
    "zimra_receipt_id": "12345678",
    "receipt_global_no": "RR-2024-0001",
    "qr_code": "https://verify.zimra.co.zw/...",
    "operation_id": "...",
    "fiscalized_at": "2024-05-21T10:00:00Z"
  }
}
```

---

## 📝 Step 6: Customize Invoice Template

Edit `examples/your-invoice-template.json` to match YOUR invoice format:

```json
{
  "invoice_id": "YOUR-INVOICE-ID",
  "customer": {
    "name": "Your Customer Name",
    "tin": "Customer TIN"
  },
  "items": [
    {
      "product_name": "Your Product",
      "quantity": 1,
      "unit_price": 100,
      "tax_code": "VAT"
    }
  ],
  "payment": {
    "method": "cash",
    "amount": 115.50
  },
  "total_amount": 115.50
}
```

---

## 🔄 How It Works

### 1. Your POS/ERP Sends Invoice
```
POST http://localhost:3001/api/invoices
{
  "invoice_id": "POS-001",
  "customer": {...},
  "items": [...],
  "payment": {...}
}
```

### 2. Bridge Receives & Stores
- Saves to `incoming_invoices` table
- Status: "pending"

### 3. Bridge Maps to ZIMRA Format
- Uses `tax_code_mapping`
- Uses `payment_method_mapping`
- Converts to ZIMRA structure

### 4. Bridge Submits to ZIMRA
- Calls `submitReceipt()`
- ZIMRA fiscalizes receipt
- Returns receipt ID

### 5. Bridge Updates Database
- Status: "submitted"
- Stores ZIMRA receipt ID
- Stores QR code

### 6. Bridge Returns Response
- Your invoice ID
- ZIMRA receipt ID
- QR code for verification

---

## 📊 Monitor Invoices

### View Pending Invoices
```sql
SELECT * FROM pending_invoices;
```

### View Failed Invoices
```sql
SELECT * FROM failed_invoices;
```

### View Today's Invoices
```sql
SELECT * FROM todays_invoices;
```

### Check Invoice Status
```bash
curl http://localhost:3001/api/invoices/POS-001/status
```

### Get Fiscalized Receipt
```bash
curl http://localhost:3001/api/invoices/POS-001/receipt
```

---

## 🔧 Integration with Your POS/ERP

### Option 1: HTTP API (Recommended)
Your POS sends HTTP POST requests to the bridge:

```javascript
// In your POS/ERP system
const response = await fetch('http://localhost:3001/api/invoices', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(yourInvoice)
});

const result = await response.json();
console.log('ZIMRA Receipt ID:', result.data.zimra_receipt_id);
```

### Option 2: Database Polling
Bridge watches `incoming_invoices` table for new records:

```javascript
// Your POS inserts directly to database
INSERT INTO incoming_invoices (source_invoice_id, source_data, ...)
VALUES ('POS-001', '{"invoice_id": "POS-001", ...}', ...);

// Bridge polls and processes automatically
```

### Option 3: Message Queue
Use RabbitMQ, Redis, or similar:

```javascript
// Your POS publishes to queue
queue.publish('invoices', yourInvoice);

// Bridge consumes from queue
queue.subscribe('invoices', async (invoice) => {
  await processInvoice(invoice);
});
```

---

## 🎯 Production Checklist

Before going live:

- [ ] Database tables created
- [ ] Tax code mappings configured
- [ ] Payment method mappings configured
- [ ] Invoice bridge API running
- [ ] Test invoices fiscalized successfully
- [ ] POS/ERP integration tested
- [ ] Error handling tested
- [ ] Monitoring configured
- [ ] Backup procedures in place

---

## 📞 Support

If you need help:
1. Check logs: `console.log` output
2. Check database: `incoming_invoices` table
3. Check ZIMRA response: `invoice_processing_log` table

---

**You're ready to receive and fiscalize invoices!** 🎉
