-- ZIMRA FDMS Bridge - Complete Database Schema
-- Run this in Supabase SQL Editor

-- 1. FISCAL DEVICES TABLE
CREATE TABLE IF NOT EXISTS fiscal_devices (
  id BIGSERIAL PRIMARY KEY,
  device_id INTEGER UNIQUE NOT NULL,
  device_serial_no TEXT NOT NULL,
  activation_key TEXT,
  
  -- Certificate details
  certificate_pem TEXT,
  private_key_path TEXT,
  certificate_subject_cn TEXT,
  certificate_valid_till TIMESTAMPTZ,
  
  -- Taxpayer information
  taxpayer_name TEXT,
  taxpayer_tin TEXT,
  vat_number TEXT,
  bp_number TEXT,
  
  -- Branch information
  device_branch_name TEXT,
  device_branch_address JSONB,
  device_branch_contacts JSONB,
  
  -- Device configuration
  device_operating_mode TEXT DEFAULT 'Online',
  device_model_name TEXT,
  device_model_version TEXT,
  
  -- Fiscal day configuration
  tax_payer_day_max_hrs INTEGER,
  taxpayer_day_end_notification_hrs INTEGER,
  
  -- QR and reporting
  qr_url TEXT,
  reporting_frequency_minutes INTEGER,
  
  -- Applicable taxes (from getConfig)
  applicable_taxes JSONB,
  
  -- Metadata
  registration_operation_id TEXT,
  last_config_fetched_at TIMESTAMPTZ,
  registered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. FISCAL DAYS TABLE
CREATE TABLE IF NOT EXISTS fiscal_days (
  id BIGSERIAL PRIMARY KEY,
  device_id INTEGER NOT NULL REFERENCES fiscal_devices(device_id),
  fiscal_day_no INTEGER NOT NULL,
  
  -- Status with CHECK constraint
  status TEXT NOT NULL DEFAULT 'FiscalDayClosed',
  CONSTRAINT fiscal_day_status_check CHECK (
    status IN ('FiscalDayClosed', 'FiscalDayOpened', 'FiscalDayCloseInitiated', 'FiscalDayCloseFailed')
  ),
  
  -- Timestamps
  opened_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  
  -- Operation IDs
  open_operation_id TEXT,
  close_operation_id TEXT,
  
  -- Signatures
  fiscal_day_device_signature JSONB,
  fiscal_day_server_signature JSONB,
  
  -- Counters
  receipt_counter INTEGER DEFAULT 0,
  last_receipt_global_no INTEGER DEFAULT 0,
  
  -- Error tracking
  closing_error_code TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(device_id, fiscal_day_no)
);

-- Unique index: only one FiscalDayOpened per device
CREATE UNIQUE INDEX idx_one_open_day_per_device 
ON fiscal_days(device_id) 
WHERE status = 'FiscalDayOpened';

-- 3. FISCAL RECEIPTS TABLE
CREATE TABLE IF NOT EXISTS fiscal_receipts (
  id BIGSERIAL PRIMARY KEY,
  device_id INTEGER NOT NULL,
  fiscal_day_id BIGINT REFERENCES fiscal_days(id),
  fiscal_day_no INTEGER NOT NULL,
  
  -- Receipt identification
  receipt_id BIGINT, -- assigned by FDMS
  receipt_type TEXT NOT NULL,
  CONSTRAINT receipt_type_check CHECK (
    receipt_type IN ('FiscalInvoice', 'CreditNote', 'DebitNote')
  ),
  
  -- Receipt numbers
  receipt_counter INTEGER NOT NULL,
  receipt_global_no INTEGER NOT NULL,
  invoice_no TEXT NOT NULL,
  
  -- Receipt details
  receipt_currency TEXT NOT NULL,
  receipt_date TIMESTAMPTZ NOT NULL,
  receipt_total NUMERIC(21,2) NOT NULL,
  receipt_lines_tax_inclusive BOOLEAN NOT NULL,
  receipt_print_form TEXT DEFAULT 'Receipt48',
  
  -- Receipt data (JSONB)
  receipt_lines JSONB NOT NULL,
  receipt_taxes JSONB NOT NULL,
  receipt_payments JSONB NOT NULL,
  buyer_data JSONB,
  credit_debit_note JSONB,
  receipt_notes TEXT,
  
  -- Signature fields
  receipt_hash TEXT,
  device_signature TEXT,
  server_signature JSONB,
  server_date TIMESTAMPTZ,
  previous_receipt_hash TEXT,
  
  -- QR code
  qr_code TEXT,
  qr_data TEXT,
  
  -- Submission tracking
  submission_status TEXT DEFAULT 'pending',
  CONSTRAINT submission_status_check CHECK (
    submission_status IN ('pending', 'submitted', 'failed', 'skipped')
  ),
  submission_attempts INTEGER DEFAULT 0,
  last_error TEXT,
  operation_id TEXT,
  
  -- Validation
  validation_color TEXT,
  CONSTRAINT validation_color_check CHECK (
    validation_color IN ('Green', 'Yellow', 'Red', 'Grey') OR validation_color IS NULL
  ),
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(device_id, receipt_global_no)
);

-- 4. FISCAL DAY COUNTERS TABLE
CREATE TABLE IF NOT EXISTS fiscal_day_counters (
  id BIGSERIAL PRIMARY KEY,
  fiscal_day_id BIGINT NOT NULL REFERENCES fiscal_days(id),
  device_id INTEGER NOT NULL,
  fiscal_day_no INTEGER NOT NULL,
  
  -- Counter type
  fiscal_counter_type TEXT NOT NULL,
  CONSTRAINT counter_type_check CHECK (
    fiscal_counter_type IN (
      'SaleByTax', 'SaleTaxByTax', 
      'CreditNoteByTax', 'CreditNoteTaxByTax',
      'DebitNoteByTax', 'DebitNoteTaxByTax',
      'BalanceByMoneyType'
    )
  ),
  
  -- Counter identifiers
  fiscal_counter_currency TEXT NOT NULL,
  fiscal_counter_tax_id INTEGER,
  fiscal_counter_tax_percent NUMERIC(5,2),
  fiscal_counter_money_type TEXT,
  
  -- Counter value
  fiscal_counter_value NUMERIC(19,2) NOT NULL DEFAULT 0,
  
  -- Metadata
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. APPLICABLE TAXES TABLE
CREATE TABLE IF NOT EXISTS applicable_taxes (
  id BIGSERIAL PRIMARY KEY,
  device_id INTEGER NOT NULL REFERENCES fiscal_devices(device_id),
  tax_id INTEGER NOT NULL,
  tax_percent NUMERIC(5,2),
  tax_name TEXT NOT NULL,
  tax_code TEXT,
  tax_valid_from DATE NOT NULL,
  tax_valid_till DATE,
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(device_id, tax_id)
);

-- 6. SAGE INVOICE SYNC TABLE
CREATE TABLE IF NOT EXISTS sage_invoice_sync (
  id BIGSERIAL PRIMARY KEY,
  sage_invoice_number TEXT UNIQUE NOT NULL,
  
  -- FDMS mapping
  device_id INTEGER NOT NULL,
  receipt_id BIGINT REFERENCES fiscal_receipts(id),
  receipt_global_no INTEGER,
  
  -- Status tracking
  fdms_status TEXT DEFAULT 'pending',
  CONSTRAINT fdms_status_check CHECK (
    fdms_status IN ('pending', 'processing', 'submitted', 'failed', 'skipped')
  ),
  
  -- Error handling
  retry_count INTEGER DEFAULT 0,
  last_error TEXT,
  
  -- Raw data
  raw_data JSONB,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. FDMS ERROR LOG TABLE
CREATE TABLE IF NOT EXISTS fdms_error_log (
  id BIGSERIAL PRIMARY KEY,
  device_id INTEGER NOT NULL,
  
  -- Error details
  error_code TEXT,
  error_message TEXT,
  error_detail TEXT,
  operation_id TEXT,
  
  -- Context
  operation_type TEXT, -- e.g., 'submitReceipt', 'closeDay', 'openDay'
  receipt_id BIGINT REFERENCES fiscal_receipts(id),
  fiscal_day_id BIGINT REFERENCES fiscal_days(id),
  
  -- HTTP details
  http_status INTEGER,
  
  -- Extra context
  extra_data JSONB,
  
  -- Resolution
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. FDMS PING LOG TABLE
CREATE TABLE IF NOT EXISTS fdms_ping_log (
  id BIGSERIAL PRIMARY KEY,
  device_id INTEGER NOT NULL,
  
  -- Ping details
  pinged_at TIMESTAMPTZ DEFAULT NOW(),
  reporting_frequency_minutes INTEGER,
  
  -- Result
  success BOOLEAN NOT NULL,
  error_message TEXT,
  operation_id TEXT
);

-- PERFORMANCE INDEXES

-- Fiscal receipts indexes
CREATE INDEX idx_fiscal_receipts_device_day 
ON fiscal_receipts(device_id, fiscal_day_no);

CREATE INDEX idx_fiscal_receipts_status 
ON fiscal_receipts(submission_status);

CREATE INDEX idx_fiscal_receipts_device_global 
ON fiscal_receipts(device_id, receipt_global_no);

CREATE INDEX idx_fiscal_receipts_validation 
ON fiscal_receipts(validation_color) 
WHERE validation_color IN ('Grey', 'Red');

-- Error log indexes
CREATE INDEX idx_error_log_device_date 
ON fdms_error_log(device_id, created_at DESC);

CREATE INDEX idx_error_log_unresolved 
ON fdms_error_log(device_id) 
WHERE resolved = FALSE;

-- Sage sync indexes
CREATE INDEX idx_sage_sync_status 
ON sage_invoice_sync(fdms_status);

CREATE INDEX idx_sage_sync_device 
ON sage_invoice_sync(device_id, created_at DESC);

-- Fiscal day counters indexes
CREATE INDEX idx_counters_fiscal_day 
ON fiscal_day_counters(fiscal_day_id);

-- TRIGGERS FOR UPDATED_AT

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_fiscal_devices_updated_at
  BEFORE UPDATE ON fiscal_devices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_fiscal_days_updated_at
  BEFORE UPDATE ON fiscal_days
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_fiscal_receipts_updated_at
  BEFORE UPDATE ON fiscal_receipts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sage_invoice_sync_updated_at
  BEFORE UPDATE ON sage_invoice_sync
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- COMMENTS

COMMENT ON TABLE fiscal_devices IS 'ZIMRA fiscal device registration and configuration';
COMMENT ON TABLE fiscal_days IS 'Fiscal day lifecycle tracking';
COMMENT ON TABLE fiscal_receipts IS 'All receipts submitted to ZIMRA';
COMMENT ON TABLE fiscal_day_counters IS 'Accumulated fiscal counters per day';
COMMENT ON TABLE applicable_taxes IS 'Tax rates from ZIMRA getConfig';
COMMENT ON TABLE sage_invoice_sync IS 'Sage invoice to FDMS receipt mapping';
COMMENT ON TABLE fdms_error_log IS 'ZIMRA API error tracking';
COMMENT ON TABLE fdms_ping_log IS 'Device ping history';
