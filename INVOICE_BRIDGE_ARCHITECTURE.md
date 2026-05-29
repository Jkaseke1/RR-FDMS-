# 🌉 Invoice Bridge Architecture

## 📋 Overview

The invoice bridge receives invoices from your POS/ERP system, maps them to ZIMRA format, and fiscalizes them.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    YOUR POS/ERP SYSTEM                      │
│              (Generates invoices, debit notes,              │
│                    credit notes)                            │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      │ POST /api/invoices
                      │ (Your invoice format)
                      ↓
┌─────────────────────────────────────────────────────────────┐
│                   INVOICE BRIDGE API                        │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 1. Receive Invoice (your format)                     │  │
│  │ 2. Validate & Store in incoming_invoices table       │  │
│  │ 3. Map to ZIMRA format                               │  │
│  │ 4. Submit to ZIMRA (fiscalize)                       │  │
│  │ 5. Return fiscalized receipt                         │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      │ POST /Device/v1/35224/SubmitReceipt
                      │ (ZIMRA format)
                      ↓
┌─────────────────────────────────────────────────────────────┐
│                      ZIMRA FDMS API                         │
│              (Fiscalizes and returns receipt ID)            │
└─────────────────────────────────────────────────────────────┘
```

---

## 🗄️ Database Tables

### 1. `incoming_invoices` - Stores Your Original Invoices
```sql
CREATE TABLE incoming_invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Source Information
  source_system TEXT,              -- 'POS', 'ERP', 'Manual', etc.
  source_invoice_id TEXT UNIQUE,   -- Your invoice ID
  source_data JSONB,               -- Your complete invoice JSON
  
  -- Invoice Details
  invoice_type TEXT,               -- 'invoice', 'debit_note', 'credit_note'
  invoice_number TEXT,
  invoice_date TIMESTAMP,
  customer_name TEXT,
  customer_tin TEXT,
  customer_address TEXT,
  customer_phone TEXT,
  customer_email TEXT,
  
  -- Amounts
  subtotal DECIMAL(15,2),
  tax_amount DECIMAL(15,2),
  total_amount DECIMAL(15,2),
  currency TEXT DEFAULT 'USD',
  
  -- Line Items
  line_items JSONB,                -- Array of line items
  
  -- Payment Info
  payment_method TEXT,             -- 'CASH', 'CARD', 'MOBILE', etc.
  payment_amount DECIMAL(15,2),
  
  -- Processing Status
  status TEXT DEFAULT 'pending',   -- 'pending', 'mapped', 'submitted', 'failed'
  mapped_at TIMESTAMP,
  submitted_at TIMESTAMP,
  
  -- ZIMRA Mapping
  zimra_receipt_id TEXT,           -- ZIMRA's receipt ID after fiscalization
  fiscal_receipt_id UUID,          -- FK to fiscal_receipts table
  receipt_global_no TEXT,          -- RR-2024-0001
  qr_code TEXT,
  
  -- Error Handling
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_incoming_invoices_source ON incoming_invoices(source_invoice_id);
CREATE INDEX idx_incoming_invoices_status ON incoming_invoices(status);
CREATE INDEX idx_incoming_invoices_date ON incoming_invoices(invoice_date);
```

### 2. `invoice_line_items` - Detailed Line Items
```sql
CREATE TABLE invoice_line_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  incoming_invoice_id UUID REFERENCES incoming_invoices(id),
  
  -- Line Details
  line_number INTEGER,
  product_code TEXT,
  product_name TEXT,
  hs_code TEXT,                    -- Harmonized System code
  
  -- Quantities & Prices
  quantity DECIMAL(15,3),
  unit_price DECIMAL(15,2),
  line_total DECIMAL(15,2),
  
  -- Tax Information
  tax_type TEXT,                   -- 'VAT', 'Zero Rated', 'Exempt', etc.
  tax_rate DECIMAL(5,2),           -- 15.5, 0, 5, etc.
  tax_amount DECIMAL(15,2),
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_line_items_invoice ON invoice_line_items(incoming_invoice_id);
```

### 3. `invoice_mapping_rules` - Mapping Configuration
```sql
CREATE TABLE invoice_mapping_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Mapping Rules
  source_field TEXT,               -- Field in your invoice
  zimra_field TEXT,                -- Field in ZIMRA format
  transformation TEXT,             -- 'direct', 'lookup', 'calculate', etc.
  default_value TEXT,
  
  -- Lookup Tables
  lookup_table TEXT,               -- For tax codes, payment types, etc.
  lookup_key TEXT,
  lookup_value TEXT,
  
  -- Active Status
  is_active BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### 4. `tax_code_mapping` - Map Your Tax Codes to ZIMRA
```sql
CREATE TABLE tax_code_mapping (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Your System
  your_tax_code TEXT UNIQUE,       -- 'VAT', 'STANDARD', 'ZERO', etc.
  your_tax_name TEXT,
  
  -- ZIMRA System
  zimra_tax_id INTEGER,            -- 1, 2, 3, 4
  zimra_tax_percent DECIMAL(5,2),  -- 15.5, 0, 5, etc.
  zimra_tax_label TEXT,            -- 'A-15.5%', 'B-Zero Rated', etc.
  
  -- Active Status
  is_active BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW()
);

-- Default mappings
INSERT INTO tax_code_mapping (your_tax_code, your_tax_name, zimra_tax_id, zimra_tax_percent, zimra_tax_label) VALUES
('VAT', 'Standard VAT', 1, 15.5, 'A-15.5%'),
('ZERO', 'Zero Rated', 2, 0, 'B-Zero Rated'),
('EXEMPT', 'Exempt', 3, 0, 'C-Exempt'),
('WITHHOLDING', 'Withholding Tax', 4, 5, 'D-Withholding 5%');
```

### 5. `payment_method_mapping` - Map Payment Types
```sql
CREATE TABLE payment_method_mapping (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Your System
  your_payment_code TEXT UNIQUE,   -- 'cash', 'card', 'mobile', etc.
  your_payment_name TEXT,
  
  -- ZIMRA System
  zimra_money_type TEXT,           -- 'CASH', 'CARD', 'MOBILE', etc.
  
  -- Active Status
  is_active BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW()
);

-- Default mappings
INSERT INTO payment_method_mapping (your_payment_code, your_payment_name, zimra_money_type) VALUES
('cash', 'Cash Payment', 'CASH'),
('card', 'Card Payment', 'CARD'),
('mobile', 'Mobile Money', 'MOBILE'),
('bank', 'Bank Transfer', 'BANK'),
('credit', 'Credit/Account', 'CREDIT');
```

---

## 🔄 Invoice Processing Flow

### Step 1: Receive Invoice from Your System
```javascript
POST /api/invoices
{
  "invoice_id": "POS-2024-001",
  "invoice_date": "2024-05-21T10:00:00",
  "customer": {
    "name": "ABC Company",
    "tin": "1234567890",
    "phone": "+263771234567"
  },
  "items": [
    {
      "product": "Product A",
      "qty": 2,
      "price": 100,
      "tax_code": "VAT"
    }
  ],
  "payment": {
    "method": "cash",
    "amount": 231.00
  }
}
```

### Step 2: Store in Database
```javascript
// Save to incoming_invoices table
INSERT INTO incoming_invoices (
  source_invoice_id,
  source_data,
  status
) VALUES (
  'POS-2024-001',
  '{"invoice_id": "POS-2024-001", ...}',
  'pending'
);
```

### Step 3: Map to ZIMRA Format
```javascript
// Use mapping rules to convert
{
  "receiptType": 0,
  "invoiceNo": "POS-2024-001",
  "receiptDate": "2024-05-21T10:00:00",
  "buyerData": {
    "buyerRegisterName": "ABC Company",
    "buyerTIN": "1234567890"
  },
  "receiptLines": [
    {
      "receiptLineName": "Product A",
      "receiptLineQuantity": 2,
      "receiptLinePrice": 100,
      "taxID": 1,        // Mapped from "VAT"
      "taxPercent": 15.5
    }
  ],
  "receiptPayments": [
    {
      "moneyTypeCode": "CASH",  // Mapped from "cash"
      "paymentAmount": 231.00
    }
  ]
}
```

### Step 4: Submit to ZIMRA
```javascript
// Call submitReceipt()
const result = await submitReceipt(deviceId, zimraReceipt);
```

### Step 5: Update Database
```javascript
// Update incoming_invoices
UPDATE incoming_invoices SET
  status = 'submitted',
  zimra_receipt_id = '12345678',
  receipt_global_no = 'RR-2024-0001',
  qr_code = 'https://verify.zimra.co.zw/...',
  submitted_at = NOW()
WHERE source_invoice_id = 'POS-2024-001';
```

---

## 📡 API Endpoints Needed

### 1. Submit Invoice
```
POST /api/invoices
```

### 2. Submit Debit Note
```
POST /api/debit-notes
```

### 3. Submit Credit Note
```
POST /api/credit-notes
```

### 4. Get Invoice Status
```
GET /api/invoices/:invoiceId/status
```

### 5. Get Fiscalized Receipt
```
GET /api/invoices/:invoiceId/receipt
```

---

## 🎯 Next Steps

1. ✅ Create database tables (see SQL above)
2. ✅ Create API endpoints (see next file)
3. ✅ Create invoice mapper (see next file)
4. ✅ Test with your invoice format
5. ✅ Deploy and integrate with POS

---

See `api-server-invoices.js` for the complete API implementation.
