# 🔒 SAFE Sage Pastel Integration (No Live DB Changes)

## ✅ The Safest Approach: Read-Only Views

**You're absolutely right!** Never modify the live Sage database. Here's the safest way:

---

## 🏗️ Architecture: Separate Fiscalization Database

```
┌─────────────────────────────────────────────────────────────┐
│              SAGE PASTEL DATABASE (Live)                    │
│                  ⚠️  READ ONLY - NO CHANGES                 │
│                                                              │
│  Tables: _btblInvoiceLines, _etblInvoiceLines, etc.        │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      │ SQL Server Linked Server OR
                      │ SQL Server Views (Read-Only)
                      ↓
┌─────────────────────────────────────────────────────────────┐
│           FISCALIZATION DATABASE (Separate)                 │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Views pointing to Sage (read-only)                   │  │
│  │ - vw_sage_invoices                                   │  │
│  │ - vw_sage_invoice_lines                              │  │
│  │ - vw_sage_customers                                  │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Fiscalization Tables (our tables)                    │  │
│  │ - fiscalization_queue                                │  │
│  │ - fiscalization_log                                  │  │
│  │ - zimra_receipts                                     │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      │ Read invoices, fiscalize, store results
                      ↓
┌─────────────────────────────────────────────────────────────┐
│                   ZIMRA FDMS API                            │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎯 Option 1: SQL Server Views (EASIEST & SAFEST)

### Step 1: Create Separate Fiscalization Database

```sql
-- Run in SQL Server Management Studio
CREATE DATABASE FiscalizationDB;
GO

USE FiscalizationDB;
GO
```

### Step 2: Create Views to Read Sage Data

```sql
-- View: Sage Invoices (Read-Only)
CREATE VIEW vw_sage_invoices AS
SELECT 
    inv.AutoIndex,
    inv.InvNumber,
    inv.InvDate,
    inv.AccountID,
    inv.Account,
    inv.TaxNumber,
    inv.Physical1 AS Address1,
    inv.Physical2 AS Address2,
    inv.Telephone,
    inv.Email,
    inv.Total,
    inv.TaxTotal,
    inv.PaymentMethod,
    inv.Posted,
    inv.Printed
FROM [Pastel200].[dbo].[_btblInvoiceLines] inv
WHERE inv.Posted = 1 AND inv.Printed = 1;
GO

-- View: Sage Invoice Lines (Read-Only)
CREATE VIEW vw_sage_invoice_lines AS
SELECT 
    iLine.iInvoiceID AS InvoiceID,
    iLine.iLineID AS LineID,
    iLine.cDescription AS Description,
    iLine.cStockCode AS StockCode,
    iLine.fQuantity AS Quantity,
    iLine.fUnitPriceExcl AS UnitPrice,
    iLine.fLineTotal AS LineTotal,
    iLine.iTaxTypeID AS TaxTypeID,
    tax.Code AS TaxCode,
    tax.Percentage AS TaxRate,
    iLine.fTaxAmount AS TaxAmount
FROM [Pastel200].[dbo].[_etblInvoiceLines] iLine
LEFT JOIN [Pastel200].[dbo].[TaxRate] tax ON iLine.iTaxTypeID = tax.idTaxRate;
GO
```

### Step 3: Create Fiscalization Queue Table

```sql
-- Table: Fiscalization Queue
CREATE TABLE fiscalization_queue (
    id INT IDENTITY(1,1) PRIMARY KEY,
    sage_auto_index INT NOT NULL UNIQUE,
    sage_invoice_number VARCHAR(50),
    invoice_date DATETIME,
    customer_name VARCHAR(200),
    total_amount DECIMAL(15,2),
    
    -- Status
    status VARCHAR(20) DEFAULT 'pending',  -- pending, processing, completed, failed
    
    -- ZIMRA Response
    zimra_receipt_id VARCHAR(50),
    receipt_global_no VARCHAR(50),
    qr_code TEXT,
    
    -- Error Handling
    error_message TEXT,
    retry_count INT DEFAULT 0,
    
    -- Timestamps
    created_at DATETIME DEFAULT GETDATE(),
    processed_at DATETIME,
    
    INDEX idx_status (status),
    INDEX idx_sage_auto_index (sage_auto_index)
);
GO

-- Table: Fiscalization Log
CREATE TABLE fiscalization_log (
    id INT IDENTITY(1,1) PRIMARY KEY,
    sage_auto_index INT NOT NULL,
    event_type VARCHAR(50),
    event_status VARCHAR(20),
    event_message TEXT,
    created_at DATETIME DEFAULT GETDATE(),
    
    INDEX idx_sage_auto_index (sage_auto_index)
);
GO
```

### Step 4: Create Stored Procedure to Queue Invoices

```sql
-- Stored Procedure: Queue New Invoices for Fiscalization
CREATE PROCEDURE sp_queue_invoices_for_fiscalization
AS
BEGIN
    INSERT INTO fiscalization_queue (
        sage_auto_index,
        sage_invoice_number,
        invoice_date,
        customer_name,
        total_amount,
        status
    )
    SELECT 
        inv.AutoIndex,
        inv.InvNumber,
        inv.InvDate,
        inv.Account,
        inv.Total,
        'pending'
    FROM vw_sage_invoices inv
    WHERE NOT EXISTS (
        SELECT 1 FROM fiscalization_queue fq
        WHERE fq.sage_auto_index = inv.AutoIndex
    );
    
    SELECT @@ROWCOUNT AS InvoicesQueued;
END;
GO
```

---

## 🎯 Option 2: CSV Export (NO DATABASE ACCESS NEEDED)

### Step 1: Export from Sage Pastel

1. Open Sage Pastel
2. Go to **Reports → Invoices → Invoice List**
3. Select date range
4. Click **Export → CSV**
5. Save to: `C:\FiscalizationBridge\sage_exports\invoices.csv`

### Step 2: Create CSV Watcher Script

```javascript
// src/integrations/csvWatcher.js
const fs = require('fs');
const csv = require('csv-parser');

function watchCSVFolder(folderPath) {
    fs.watch(folderPath, async (eventType, filename) => {
        if (filename.endsWith('.csv')) {
            console.log(`📄 New CSV file detected: ${filename}`);
            await processCSVFile(`${folderPath}/${filename}`);
        }
    });
}

async function processCSVFile(filePath) {
    const invoices = [];
    
    fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row) => {
            invoices.push({
                invoice_id: row['Invoice Number'],
                invoice_date: row['Date'],
                customer_name: row['Customer'],
                total_amount: parseFloat(row['Total']),
                // ... map other fields
            });
        })
        .on('end', async () => {
            console.log(`✅ Parsed ${invoices.length} invoices`);
            
            // Send to bridge API
            for (const invoice of invoices) {
                await fiscalizeInvoice(invoice);
            }
            
            // Archive processed file
            fs.renameSync(filePath, filePath.replace('.csv', '_processed.csv'));
        });
}
```

---

## 🎯 Option 3: Sage ODBC Export (RECOMMENDED)

### Step 1: Create ODBC Export Script

```javascript
// src/integrations/sageODBCExport.js
const odbc = require('odbc');

async function exportToFiscalizationDB() {
    // Connect to Sage (READ ONLY)
    const sageConn = await odbc.connect(SAGE_CONNECTION_STRING);
    
    // Connect to Fiscalization DB (WRITE)
    const fiscalConn = await odbc.connect(FISCAL_CONNECTION_STRING);
    
    // Read from Sage
    const invoices = await sageConn.query(`
        SELECT * FROM _btblInvoiceLines 
        WHERE Posted = 1 AND Printed = 1
    `);
    
    // Write to Fiscalization DB
    for (const inv of invoices) {
        await fiscalConn.query(`
            INSERT INTO fiscalization_queue (sage_auto_index, ...)
            VALUES (?, ...)
        `, [inv.AutoIndex, ...]);
    }
    
    console.log(`✅ Exported ${invoices.length} invoices`);
}
```

---

## 📋 Comparison: Which Method to Use?

| Method | Ease | Safety | Real-Time | Best For |
|--------|------|--------|-----------|----------|
| **SQL Views** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ✅ Yes | Best option! |
| **CSV Export** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ❌ No | No DB access |
| **ODBC Export** | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ✅ Yes | Scheduled sync |

---

## ✅ RECOMMENDED: SQL Server Views Method

### Why This is Best:

1. ✅ **100% Safe** - Only reads from Sage, never writes
2. ✅ **No Sage Changes** - Sage database untouched
3. ✅ **Real-Time** - Always current data
4. ✅ **Easy Setup** - Just create views
5. ✅ **Separate Database** - All fiscalization data isolated
6. ✅ **Rollback Safe** - Can delete fiscalization DB anytime

---

## 🚀 Quick Setup (SQL Views Method)

### 1. Create Fiscalization Database
```sql
CREATE DATABASE FiscalizationDB;
```

### 2. Create Views (see SQL above)
```sql
CREATE VIEW vw_sage_invoices AS ...
CREATE VIEW vw_sage_invoice_lines AS ...
```

### 3. Create Queue Tables (see SQL above)
```sql
CREATE TABLE fiscalization_queue ...
CREATE TABLE fiscalization_log ...
```

### 4. Update .env
```env
# Fiscalization Database (separate from Sage)
FISCAL_DB_SERVER=localhost\SQLEXPRESS
FISCAL_DB_NAME=FiscalizationDB
FISCAL_DB_USER=sa
FISCAL_DB_PASSWORD=your_password
```

### 5. Run Connector
```bash
npm run sage:sync:continuous
```

---

## 🔒 Safety Features

### Read-Only Access
```sql
-- Grant only SELECT permission on Sage database
GRANT SELECT ON [Pastel200].[dbo].[_btblInvoiceLines] TO FiscalUser;
GRANT SELECT ON [Pastel200].[dbo].[_etblInvoiceLines] TO FiscalUser;
-- NO INSERT, UPDATE, DELETE permissions!
```

### Separate Database
- Sage database: **Pastel200** (untouched)
- Fiscal database: **FiscalizationDB** (all our data)
- Can delete FiscalizationDB without affecting Sage

### Transaction Safety
```javascript
// If fiscalization fails, Sage is unaffected
try {
    await fiscalizeInvoice(invoice);
} catch (error) {
    // Sage data unchanged
    // Only fiscalization_queue updated
}
```

---

## 📊 Workflow

```
1. Invoice created in Sage Pastel
   ↓
2. Invoice posted & printed in Sage
   ↓
3. View vw_sage_invoices shows new invoice (read-only)
   ↓
4. Connector reads from view
   ↓
5. Adds to fiscalization_queue table (separate DB)
   ↓
6. Fiscalizes with ZIMRA
   ↓
7. Updates fiscalization_queue with receipt ID
   ↓
8. Sage database: COMPLETELY UNTOUCHED ✅
```

---

## 🎯 Next Steps

1. ✅ **Create FiscalizationDB** (separate database)
2. ✅ **Create views** (read-only access to Sage)
3. ✅ **Create queue tables** (store fiscalization data)
4. ✅ **Test connection** (verify read-only access)
5. ✅ **Run sync** (fiscalize invoices)

---

**This is the SAFEST way - your Sage database is never touched!** 🔒
