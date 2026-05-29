-- ============================================================================
-- FISCALIZATION DATABASE SETUP
-- Creates a SEPARATE database for fiscalization (does NOT touch Sage)
-- ============================================================================

-- Step 1: Create Fiscalization Database
-- ============================================================================
IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = 'FiscalizationDB')
BEGIN
    CREATE DATABASE FiscalizationDB;
    PRINT '✅ FiscalizationDB created';
END
ELSE
BEGIN
    PRINT '⚠️  FiscalizationDB already exists';
END
GO

USE FiscalizationDB;
GO

PRINT '📊 Setting up Fiscalization Database...';
GO

-- Step 2: Create Views to Read Sage Data (READ-ONLY)
-- ============================================================================
PRINT '📋 Creating views to read Sage data...';
GO

-- View: Sage Invoices (Read-Only)
IF OBJECT_ID('vw_sage_invoices', 'V') IS NOT NULL
    DROP VIEW vw_sage_invoices;
GO

CREATE VIEW vw_sage_invoices AS
SELECT 
    -- Invoice Header
    inv.AutoIndex,
    inv.InvNumber,
    inv.InvDate,
    inv.OrderNum,
    
    -- Customer Information
    inv.AccountID,
    inv.Account,
    inv.TaxNumber,
    inv.Physical1 AS Address1,
    inv.Physical2 AS Address2,
    inv.Physical3 AS Address3,
    inv.Physical4 AS Address4,
    inv.Telephone,
    inv.Telephone2,
    inv.Fax,
    inv.Email,
    
    -- Totals
    inv.Total,
    inv.TaxTotal,
    inv.Discount,
    inv.Freight,
    
    -- Payment
    inv.PaymentMethod,
    
    -- Status
    inv.Posted,
    inv.Printed,
    inv.Cancelled
    
FROM [Pastel200].[dbo].[_btblInvoiceLines] inv
WHERE inv.Posted = 1 
  AND inv.Printed = 1
  AND ISNULL(inv.Cancelled, 0) = 0;
GO

PRINT '✅ vw_sage_invoices created';
GO

-- View: Sage Invoice Lines (Read-Only)
IF OBJECT_ID('vw_sage_invoice_lines', 'V') IS NOT NULL
    DROP VIEW vw_sage_invoice_lines;
GO

CREATE VIEW vw_sage_invoice_lines AS
SELECT 
    -- Line Details
    iLine.iInvoiceID AS InvoiceID,
    iLine.iLineID AS LineID,
    iLine.cDescription AS Description,
    iLine.cStockCode AS StockCode,
    
    -- Quantities & Prices
    iLine.fQuantity AS Quantity,
    iLine.fUnitPriceExcl AS UnitPriceExcl,
    iLine.fUnitPriceIncl AS UnitPriceIncl,
    iLine.fLineTotal AS LineTotal,
    
    -- Tax Information
    iLine.iTaxTypeID AS TaxTypeID,
    tax.Code AS TaxCode,
    tax.Description AS TaxName,
    tax.Percentage AS TaxRate,
    iLine.fTaxAmount AS TaxAmount,
    
    -- Discount
    iLine.fDiscountPercent AS DiscountPercent,
    iLine.fDiscountAmount AS DiscountAmount
    
FROM [Pastel200].[dbo].[_etblInvoiceLines] iLine
LEFT JOIN [Pastel200].[dbo].[TaxRate] tax ON iLine.iTaxTypeID = tax.idTaxRate;
GO

PRINT '✅ vw_sage_invoice_lines created';
GO

-- Step 3: Create Fiscalization Tables
-- ============================================================================
PRINT '📊 Creating fiscalization tables...';
GO

-- Table: Fiscalization Queue
IF OBJECT_ID('fiscalization_queue', 'U') IS NOT NULL
    DROP TABLE fiscalization_queue;
GO

CREATE TABLE fiscalization_queue (
    id INT IDENTITY(1,1) PRIMARY KEY,
    
    -- Sage Reference
    sage_auto_index INT NOT NULL UNIQUE,
    sage_invoice_number VARCHAR(50),
    invoice_date DATETIME,
    
    -- Customer
    customer_account_id VARCHAR(50),
    customer_name VARCHAR(200),
    customer_tin VARCHAR(20),
    customer_address VARCHAR(500),
    customer_phone VARCHAR(50),
    customer_email VARCHAR(100),
    
    -- Amounts
    subtotal DECIMAL(15,2),
    tax_amount DECIMAL(15,2),
    total_amount DECIMAL(15,2),
    discount DECIMAL(15,2),
    
    -- Payment
    payment_method VARCHAR(50),
    
    -- Status
    status VARCHAR(20) DEFAULT 'pending',  -- pending, processing, completed, failed
    
    -- ZIMRA Response
    zimra_receipt_id VARCHAR(50),
    receipt_global_no VARCHAR(50),
    receipt_counter INT,
    qr_code TEXT,
    operation_id VARCHAR(100),
    
    -- Error Handling
    error_message TEXT,
    error_code VARCHAR(50),
    retry_count INT DEFAULT 0,
    last_retry_at DATETIME,
    
    -- Timestamps
    created_at DATETIME DEFAULT GETDATE(),
    queued_at DATETIME DEFAULT GETDATE(),
    processed_at DATETIME,
    
    -- Indexes
    INDEX idx_status (status),
    INDEX idx_sage_auto_index (sage_auto_index),
    INDEX idx_invoice_date (invoice_date),
    INDEX idx_created_at (created_at)
);
GO

PRINT '✅ fiscalization_queue created';
GO

-- Table: Fiscalization Log
IF OBJECT_ID('fiscalization_log', 'U') IS NOT NULL
    DROP TABLE fiscalization_log;
GO

CREATE TABLE fiscalization_log (
    id INT IDENTITY(1,1) PRIMARY KEY,
    queue_id INT,
    sage_auto_index INT NOT NULL,
    
    -- Event Details
    event_type VARCHAR(50),      -- queued, processing, completed, failed, retry
    event_status VARCHAR(20),    -- success, error, warning
    event_message TEXT,
    event_data TEXT,             -- JSON data
    
    -- Timestamps
    created_at DATETIME DEFAULT GETDATE(),
    
    -- Indexes
    INDEX idx_queue_id (queue_id),
    INDEX idx_sage_auto_index (sage_auto_index),
    INDEX idx_event_type (event_type),
    INDEX idx_created_at (created_at),
    
    -- Foreign Key
    FOREIGN KEY (queue_id) REFERENCES fiscalization_queue(id)
);
GO

PRINT '✅ fiscalization_log created';
GO

-- Step 4: Create Stored Procedures
-- ============================================================================
PRINT '📝 Creating stored procedures...';
GO

-- Procedure: Queue New Invoices for Fiscalization
IF OBJECT_ID('sp_queue_invoices_for_fiscalization', 'P') IS NOT NULL
    DROP PROCEDURE sp_queue_invoices_for_fiscalization;
GO

CREATE PROCEDURE sp_queue_invoices_for_fiscalization
AS
BEGIN
    SET NOCOUNT ON;
    
    DECLARE @InvoicesQueued INT = 0;
    
    -- Insert new invoices into queue
    INSERT INTO fiscalization_queue (
        sage_auto_index,
        sage_invoice_number,
        invoice_date,
        customer_account_id,
        customer_name,
        customer_tin,
        customer_address,
        customer_phone,
        customer_email,
        total_amount,
        tax_amount,
        discount,
        payment_method,
        status
    )
    SELECT 
        inv.AutoIndex,
        inv.InvNumber,
        inv.InvDate,
        inv.AccountID,
        inv.Account,
        inv.TaxNumber,
        CONCAT_WS(', ', inv.Address1, inv.Address2, inv.Address3),
        inv.Telephone,
        inv.Email,
        inv.Total,
        inv.TaxTotal,
        ISNULL(inv.Discount, 0),
        ISNULL(inv.PaymentMethod, 'Cash'),
        'pending'
    FROM vw_sage_invoices inv
    WHERE NOT EXISTS (
        SELECT 1 FROM fiscalization_queue fq
        WHERE fq.sage_auto_index = inv.AutoIndex
    );
    
    SET @InvoicesQueued = @@ROWCOUNT;
    
    -- Log the queuing
    IF @InvoicesQueued > 0
    BEGIN
        PRINT CONCAT('✅ Queued ', @InvoicesQueued, ' new invoices for fiscalization');
    END
    ELSE
    BEGIN
        PRINT '📋 No new invoices to queue';
    END
    
    SELECT @InvoicesQueued AS InvoicesQueued;
END;
GO

PRINT '✅ sp_queue_invoices_for_fiscalization created';
GO

-- Procedure: Get Pending Invoices
IF OBJECT_ID('sp_get_pending_invoices', 'P') IS NOT NULL
    DROP PROCEDURE sp_get_pending_invoices;
GO

CREATE PROCEDURE sp_get_pending_invoices
    @Limit INT = 10
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT TOP (@Limit)
        fq.*
    FROM fiscalization_queue fq
    WHERE fq.status = 'pending'
    ORDER BY fq.invoice_date ASC, fq.created_at ASC;
END;
GO

PRINT '✅ sp_get_pending_invoices created';
GO

-- Procedure: Update Queue Status
IF OBJECT_ID('sp_update_queue_status', 'P') IS NOT NULL
    DROP PROCEDURE sp_update_queue_status;
GO

CREATE PROCEDURE sp_update_queue_status
    @QueueId INT,
    @Status VARCHAR(20),
    @ZimraReceiptId VARCHAR(50) = NULL,
    @ReceiptGlobalNo VARCHAR(50) = NULL,
    @QRCode TEXT = NULL,
    @OperationId VARCHAR(100) = NULL,
    @ErrorMessage TEXT = NULL,
    @ErrorCode VARCHAR(50) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    UPDATE fiscalization_queue
    SET 
        status = @Status,
        zimra_receipt_id = ISNULL(@ZimraReceiptId, zimra_receipt_id),
        receipt_global_no = ISNULL(@ReceiptGlobalNo, receipt_global_no),
        qr_code = ISNULL(@QRCode, qr_code),
        operation_id = ISNULL(@OperationId, operation_id),
        error_message = @ErrorMessage,
        error_code = @ErrorCode,
        processed_at = CASE WHEN @Status = 'completed' THEN GETDATE() ELSE processed_at END,
        retry_count = CASE WHEN @Status = 'failed' THEN retry_count + 1 ELSE retry_count END,
        last_retry_at = CASE WHEN @Status = 'failed' THEN GETDATE() ELSE last_retry_at END
    WHERE id = @QueueId;
    
    -- Log the update
    INSERT INTO fiscalization_log (queue_id, sage_auto_index, event_type, event_status, event_message)
    SELECT 
        id,
        sage_auto_index,
        @Status,
        CASE WHEN @Status = 'completed' THEN 'success' ELSE 'error' END,
        ISNULL(@ErrorMessage, 'Status updated to ' + @Status)
    FROM fiscalization_queue
    WHERE id = @QueueId;
END;
GO

PRINT '✅ sp_update_queue_status created';
GO

-- Step 5: Create Views for Monitoring
-- ============================================================================
PRINT '📊 Creating monitoring views...';
GO

-- View: Pending Invoices
IF OBJECT_ID('vw_pending_invoices', 'V') IS NOT NULL
    DROP VIEW vw_pending_invoices;
GO

CREATE VIEW vw_pending_invoices AS
SELECT 
    id,
    sage_auto_index,
    sage_invoice_number,
    invoice_date,
    customer_name,
    total_amount,
    status,
    created_at
FROM fiscalization_queue
WHERE status = 'pending';
GO

-- View: Failed Invoices
IF OBJECT_ID('vw_failed_invoices', 'V') IS NOT NULL
    DROP VIEW vw_failed_invoices;
GO

CREATE VIEW vw_failed_invoices AS
SELECT 
    id,
    sage_auto_index,
    sage_invoice_number,
    invoice_date,
    customer_name,
    total_amount,
    error_message,
    retry_count,
    last_retry_at,
    created_at
FROM fiscalization_queue
WHERE status = 'failed';
GO

-- View: Completed Invoices
IF OBJECT_ID('vw_completed_invoices', 'V') IS NOT NULL
    DROP VIEW vw_completed_invoices;
GO

CREATE VIEW vw_completed_invoices AS
SELECT 
    id,
    sage_auto_index,
    sage_invoice_number,
    invoice_date,
    customer_name,
    total_amount,
    zimra_receipt_id,
    receipt_global_no,
    processed_at
FROM fiscalization_queue
WHERE status = 'completed';
GO

PRINT '✅ Monitoring views created';
GO

-- Step 6: Create Initial Test
-- ============================================================================
PRINT '';
PRINT '🧪 Testing setup...';
GO

-- Test: Queue invoices
EXEC sp_queue_invoices_for_fiscalization;
GO

-- Test: View pending
SELECT COUNT(*) AS PendingCount FROM vw_pending_invoices;
GO

-- Step 7: Summary
-- ============================================================================
PRINT '';
PRINT '============================================================';
PRINT '✅ FISCALIZATION DATABASE SETUP COMPLETE';
PRINT '============================================================';
PRINT '';
PRINT '📊 Created Objects:';
PRINT '   ✅ Database: FiscalizationDB';
PRINT '   ✅ Views: vw_sage_invoices, vw_sage_invoice_lines';
PRINT '   ✅ Tables: fiscalization_queue, fiscalization_log';
PRINT '   ✅ Procedures: sp_queue_invoices_for_fiscalization, etc.';
PRINT '   ✅ Monitoring Views: vw_pending_invoices, etc.';
PRINT '';
PRINT '🔒 Safety Features:';
PRINT '   ✅ Sage database is READ-ONLY (via views)';
PRINT '   ✅ All fiscalization data in separate database';
PRINT '   ✅ Can delete FiscalizationDB without affecting Sage';
PRINT '';
PRINT '🎯 Next Steps:';
PRINT '   1. Update .env with FiscalizationDB connection';
PRINT '   2. Run: npm run sage:sync';
PRINT '   3. Check: SELECT * FROM vw_pending_invoices;';
PRINT '';
PRINT '============================================================';
GO
