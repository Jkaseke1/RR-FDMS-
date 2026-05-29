-- ============================================================================
-- INVOICE BRIDGE DATABASE TABLES
-- Creates tables for receiving and mapping invoices from POS/ERP systems
-- ============================================================================

-- 1. INCOMING INVOICES TABLE
-- Stores original invoices from your POS/ERP system
-- ============================================================================
CREATE TABLE IF NOT EXISTS incoming_invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Source Information
  source_system TEXT NOT NULL,              -- 'POS', 'ERP', 'Manual', 'API'
  source_invoice_id TEXT NOT NULL UNIQUE,   -- Your invoice ID (must be unique)
  source_data JSONB NOT NULL,               -- Complete original invoice JSON
  
  -- Invoice Type
  invoice_type TEXT NOT NULL,               -- 'invoice', 'debit_note', 'credit_note'
  original_invoice_id TEXT,                 -- For debit/credit notes
  
  -- Invoice Details
  invoice_number TEXT NOT NULL,
  invoice_date TIMESTAMP NOT NULL,
  
  -- Customer Information
  customer_name TEXT,
  customer_tin TEXT,
  customer_address TEXT,
  customer_phone TEXT,
  customer_email TEXT,
  
  -- Amounts
  subtotal DECIMAL(15,2) NOT NULL,
  tax_amount DECIMAL(15,2) NOT NULL,
  total_amount DECIMAL(15,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  
  -- Line Items (denormalized for quick access)
  line_items JSONB,
  
  -- Payment Information
  payment_method TEXT,                      -- 'CASH', 'CARD', 'MOBILE', etc.
  payment_amount DECIMAL(15,2),
  
  -- Processing Status
  status TEXT DEFAULT 'pending',            -- 'pending', 'mapped', 'submitted', 'failed'
  mapped_at TIMESTAMP,
  submitted_at TIMESTAMP,
  
  -- ZIMRA Integration
  zimra_receipt_id TEXT,                    -- ZIMRA's receipt ID (after fiscalization)
  fiscal_receipt_id UUID,                   -- FK to fiscal_receipts table
  receipt_global_no TEXT,                   -- RR-2024-0001
  receipt_counter INTEGER,
  qr_code TEXT,
  operation_id TEXT,
  
  -- Error Handling
  error_message TEXT,
  error_code TEXT,
  retry_count INTEGER DEFAULT 0,
  last_retry_at TIMESTAMP,
  
  -- Notes
  notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for incoming_invoices
CREATE INDEX IF NOT EXISTS idx_incoming_invoices_source ON incoming_invoices(source_invoice_id);
CREATE INDEX IF NOT EXISTS idx_incoming_invoices_status ON incoming_invoices(status);
CREATE INDEX IF NOT EXISTS idx_incoming_invoices_date ON incoming_invoices(invoice_date DESC);
CREATE INDEX IF NOT EXISTS idx_incoming_invoices_type ON incoming_invoices(invoice_type);
CREATE INDEX IF NOT EXISTS idx_incoming_invoices_created ON incoming_invoices(created_at DESC);

-- ============================================================================
-- 2. INVOICE LINE ITEMS TABLE
-- Detailed line items for each invoice
-- ============================================================================
CREATE TABLE IF NOT EXISTS invoice_line_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  incoming_invoice_id UUID NOT NULL REFERENCES incoming_invoices(id) ON DELETE CASCADE,
  
  -- Line Details
  line_number INTEGER NOT NULL,
  product_code TEXT,
  product_name TEXT NOT NULL,
  hs_code TEXT,                             -- Harmonized System code (8 digits)
  
  -- Quantities & Prices
  quantity DECIMAL(15,3) NOT NULL,
  unit_price DECIMAL(15,2) NOT NULL,
  line_total DECIMAL(15,2) NOT NULL,
  
  -- Tax Information
  tax_type TEXT,                            -- 'VAT', 'Zero Rated', 'Exempt', etc.
  tax_rate DECIMAL(5,2),                    -- 15.5, 0, 5, etc.
  tax_amount DECIMAL(15,2),
  
  -- ZIMRA Mapping
  zimra_tax_id INTEGER,
  zimra_tax_percent DECIMAL(5,2),
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for invoice_line_items
CREATE INDEX IF NOT EXISTS idx_line_items_invoice ON invoice_line_items(incoming_invoice_id);

-- ============================================================================
-- 3. TAX CODE MAPPING TABLE
-- Maps your tax codes to ZIMRA tax codes
-- ============================================================================
CREATE TABLE IF NOT EXISTS tax_code_mapping (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Your System
  your_tax_code TEXT NOT NULL UNIQUE,       -- 'VAT', 'STANDARD', 'ZERO', etc.
  your_tax_name TEXT NOT NULL,
  your_tax_rate DECIMAL(5,2),               -- Your tax rate (for validation)
  
  -- ZIMRA System
  zimra_tax_id INTEGER NOT NULL,            -- 1, 2, 3, 4
  zimra_tax_percent DECIMAL(5,2) NOT NULL,  -- 15.5, 0, 5, etc.
  zimra_tax_label TEXT NOT NULL,            -- 'A-15.5%', 'B-Zero Rated', etc.
  
  -- Configuration
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Default tax code mappings
INSERT INTO tax_code_mapping (your_tax_code, your_tax_name, your_tax_rate, zimra_tax_id, zimra_tax_percent, zimra_tax_label, is_default) VALUES
('VAT', 'Standard VAT', 15.5, 1, 15.5, 'A-15.5%', true),
('STANDARD', 'Standard VAT', 15.5, 1, 15.5, 'A-15.5%', false),
('ZERO', 'Zero Rated', 0, 2, 0, 'B-Zero Rated', false),
('EXEMPT', 'Exempt', 0, 3, 0, 'C-Exempt', false),
('WITHHOLDING', 'Withholding Tax', 5, 4, 5, 'D-Withholding 5%', false)
ON CONFLICT (your_tax_code) DO NOTHING;

-- ============================================================================
-- 4. PAYMENT METHOD MAPPING TABLE
-- Maps your payment methods to ZIMRA money types
-- ============================================================================
CREATE TABLE IF NOT EXISTS payment_method_mapping (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Your System
  your_payment_code TEXT NOT NULL UNIQUE,   -- 'cash', 'card', 'mobile', etc.
  your_payment_name TEXT NOT NULL,
  
  -- ZIMRA System
  zimra_money_type TEXT NOT NULL,           -- 'CASH', 'CARD', 'MOBILE', etc.
  
  -- Configuration
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Default payment method mappings
INSERT INTO payment_method_mapping (your_payment_code, your_payment_name, zimra_money_type, is_default) VALUES
('cash', 'Cash Payment', 'CASH', true),
('CASH', 'Cash Payment', 'CASH', false),
('card', 'Card Payment', 'CARD', false),
('CARD', 'Card Payment', 'CARD', false),
('mobile', 'Mobile Money', 'MOBILE', false),
('MOBILE', 'Mobile Money', 'MOBILE', false),
('ecocash', 'EcoCash', 'MOBILE', false),
('bank', 'Bank Transfer', 'BANK', false),
('BANK', 'Bank Transfer', 'BANK', false),
('credit', 'Credit/Account', 'CREDIT', false),
('CREDIT', 'Credit/Account', 'CREDIT', false)
ON CONFLICT (your_payment_code) DO NOTHING;

-- ============================================================================
-- 5. INVOICE MAPPING RULES TABLE
-- Flexible mapping configuration
-- ============================================================================
CREATE TABLE IF NOT EXISTS invoice_mapping_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Rule Name
  rule_name TEXT NOT NULL UNIQUE,
  rule_description TEXT,
  
  -- Mapping Configuration
  source_field TEXT NOT NULL,               -- Field in your invoice JSON
  zimra_field TEXT NOT NULL,                -- Field in ZIMRA format
  transformation TEXT DEFAULT 'direct',     -- 'direct', 'lookup', 'calculate', 'format'
  
  -- Transformation Details
  default_value TEXT,
  lookup_table TEXT,                        -- 'tax_code_mapping', 'payment_method_mapping'
  lookup_key TEXT,
  lookup_value TEXT,
  format_pattern TEXT,                      -- For date/number formatting
  
  -- Validation
  is_required BOOLEAN DEFAULT false,
  validation_regex TEXT,
  
  -- Active Status
  is_active BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- 6. INVOICE PROCESSING LOG TABLE
-- Audit trail for invoice processing
-- ============================================================================
CREATE TABLE IF NOT EXISTS invoice_processing_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  incoming_invoice_id UUID REFERENCES incoming_invoices(id) ON DELETE CASCADE,
  
  -- Event Details
  event_type TEXT NOT NULL,                 -- 'received', 'validated', 'mapped', 'submitted', 'failed'
  event_status TEXT NOT NULL,               -- 'success', 'error', 'warning'
  event_message TEXT,
  event_data JSONB,
  
  -- Error Details
  error_code TEXT,
  error_detail TEXT,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index for processing log
CREATE INDEX IF NOT EXISTS idx_processing_log_invoice ON invoice_processing_log(incoming_invoice_id);
CREATE INDEX IF NOT EXISTS idx_processing_log_type ON invoice_processing_log(event_type);
CREATE INDEX IF NOT EXISTS idx_processing_log_created ON invoice_processing_log(created_at DESC);

-- ============================================================================
-- 7. VIEWS FOR EASY QUERYING
-- ============================================================================

-- View: Pending Invoices
CREATE OR REPLACE VIEW pending_invoices AS
SELECT 
  id,
  source_invoice_id,
  invoice_number,
  invoice_date,
  customer_name,
  total_amount,
  currency,
  status,
  error_message,
  created_at
FROM incoming_invoices
WHERE status = 'pending'
ORDER BY created_at ASC;

-- View: Failed Invoices
CREATE OR REPLACE VIEW failed_invoices AS
SELECT 
  id,
  source_invoice_id,
  invoice_number,
  invoice_date,
  customer_name,
  total_amount,
  error_message,
  retry_count,
  last_retry_at,
  created_at
FROM incoming_invoices
WHERE status = 'failed'
ORDER BY created_at DESC;

-- View: Today's Invoices
CREATE OR REPLACE VIEW todays_invoices AS
SELECT 
  id,
  source_invoice_id,
  invoice_number,
  invoice_type,
  customer_name,
  total_amount,
  currency,
  status,
  zimra_receipt_id,
  created_at
FROM incoming_invoices
WHERE DATE(created_at) = CURRENT_DATE
ORDER BY created_at DESC;

-- ============================================================================
-- GRANTS (if using RLS - Row Level Security)
-- ============================================================================

-- Grant access to authenticated users
-- GRANT ALL ON incoming_invoices TO authenticated;
-- GRANT ALL ON invoice_line_items TO authenticated;
-- GRANT ALL ON tax_code_mapping TO authenticated;
-- GRANT ALL ON payment_method_mapping TO authenticated;
-- GRANT ALL ON invoice_mapping_rules TO authenticated;
-- GRANT ALL ON invoice_processing_log TO authenticated;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Verify tables created
SELECT 
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
  AND table_name IN (
    'incoming_invoices',
    'invoice_line_items',
    'tax_code_mapping',
    'payment_method_mapping',
    'invoice_mapping_rules',
    'invoice_processing_log'
  )
ORDER BY table_name;
