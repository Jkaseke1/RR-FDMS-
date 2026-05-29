const { supabase } = require('../db/supabaseClient');

/**
 * All error codes from spec section 8.2
 * Handle FDMS API errors and determine retry strategy
 */

// Error codes that should NEVER be retried
const NON_RETRYABLE_ERRORS = [
  'DEV01', 'DEV02', 'DEV03', 'DEV04', 'DEV05',
  'RCPT013', // Duplicate invoice number
  'RCPT020', // Invalid signature
  'FILE04', 'FILE05'
];

// HTTP status codes that are retryable
const RETRYABLE_HTTP_STATUS = [500, 502, 503, 504];

/**
 * Determine if an error is retryable
 */
function isRetryable(error) {
  // HTTP 401 - never retry (authentication issue)
  if (error.status === 401) {
    return false;
  }

  // Retryable HTTP status codes
  if (RETRYABLE_HTTP_STATUS.includes(error.status)) {
    return true;
  }

  // Check FDMS error code
  if (error.fdmsError && error.fdmsError.errorCode) {
    const errorCode = error.fdmsError.errorCode;
    
    // Never retry these specific errors
    if (NON_RETRYABLE_ERRORS.includes(errorCode)) {
      return false;
    }

    // All other FDMS errors can be retried (up to max attempts)
    return true;
  }

  // Network errors, timeouts - retry
  if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
    return true;
  }

  // Default: don't retry unknown errors
  return false;
}

/**
 * Log error to database
 */
async function logError(deviceId, operation, error, extra = {}) {
  const errorRecord = {
    device_id: deviceId,
    operation_type: operation,
    error_message: error.message,
    http_status: error.status || null,
    extra_data: extra,
    created_at: new Date().toISOString()
  };

  // Add FDMS error details if available
  if (error.fdmsError) {
    errorRecord.error_code = error.fdmsError.errorCode;
    errorRecord.error_detail = error.fdmsError.detail;
    errorRecord.operation_id = error.fdmsError.operationID;
  }

  // Add receipt or fiscal day context
  if (extra.receiptId) {
    errorRecord.receipt_id = extra.receiptId;
  }
  if (extra.fiscalDayId) {
    errorRecord.fiscal_day_id = extra.fiscalDayId;
  }

  const { error: dbError } = await supabase
    .from('fdms_error_log')
    .insert(errorRecord);

  if (dbError) {
    console.error('⚠️  Failed to log error to database:', dbError.message);
  }
}

/**
 * Get error description from error code
 */
function getErrorDescription(errorCode) {
  const errorDescriptions = {
    // Device errors
    'DEV01': 'Device not registered',
    'DEV02': 'Invalid activation key',
    'DEV03': 'Device already registered',
    'DEV04': 'Certificate expired',
    'DEV05': 'Invalid certificate',
    
    // Receipt errors
    'RCPT010': 'Invalid currency',
    'RCPT011': 'Invalid receipt counter',
    'RCPT012': 'Invalid receipt global number',
    'RCPT013': 'Duplicate invoice number',
    'RCPT014': 'Invalid receipt date',
    'RCPT015': 'Credit/debit note required',
    'RCPT016': 'No receipt lines',
    'RCPT017': 'No receipt taxes',
    'RCPT018': 'No receipt payments',
    'RCPT019': 'Receipt total mismatch',
    'RCPT020': 'Invalid signature',
    'RCPT021': 'VAT not registered but tax applied',
    'RCPT022': 'Invalid line price',
    'RCPT023': 'Invalid quantity',
    'RCPT024': 'Line total mismatch',
    'RCPT025': 'Invalid tax ID',
    'RCPT026': 'Tax amount mismatch',
    'RCPT027': 'Sales amount mismatch',
    'RCPT028': 'Invalid payment amount',
    'RCPT029': 'Invalid credit/debit note',
    'RCPT030': 'Receipt date not sequential',
    'RCPT031': 'Receipt date in future',
    'RCPT034': 'Receipt notes required',
    'RCPT037': 'Receipt total calculation error',
    'RCPT038': 'Receipt total vs sales mismatch',
    'RCPT039': 'Receipt total vs payments mismatch',
    'RCPT040': 'Invalid receipt total sign',
    'RCPT041': 'Fiscal day expired',
    'RCPT043': 'Buyer data incomplete',
    'RCPT047': 'HS code required for VAT payer',
    'RCPT048': 'Invalid HS code format',
    
    // Fiscal day errors
    'FISC01': 'Fiscal day already open',
    'FISC03': 'Fiscal day not open',
    'FISC04': 'Cannot close fiscal day with errors',
    
    // File errors
    'FILE01': 'File too large',
    'FILE02': 'Invalid file format',
    'FILE03': 'File upload failed',
    'FILE04': 'File not found',
    'FILE05': 'File already processed'
  };

  return errorDescriptions[errorCode] || 'Unknown error';
}

module.exports = {
  isRetryable,
  logError,
  getErrorDescription
};
